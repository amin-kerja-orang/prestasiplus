import { ACCOUNT_AUTH_MESSAGES, AUTH_ERROR_MESSAGES } from '@pp/contract'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { AuthConfig } from '../auth/auth.config'
import { hmacHex } from '../auth/tokens'
import {
  ANY,
  IC_IP_LIMIT,
  IC_IP_WARN_AT,
  IC_LIMIT,
  IC_WINDOW_MS,
  MAIL_INTERVAL_MS,
  MAIL_IP_LIMIT,
  MAIL_IP_WINDOW_MS,
  PASSWORD_CHANGE_CEILING,
  PASSWORD_CHANGE_CEILING_WINDOW_MS,
  PASSWORD_CHANGE_LIMIT,
  PASSWORD_CHANGE_WINDOW_MS,
  REDEEM_IP_LIMIT,
  REDEEM_PAIR_LIMIT,
  REDEEM_WINDOW_MS,
  RESET_KEYS,
} from './account.constants'
import { tooMany } from './account.errors'

interface Counter {
  attempts: number
  expiresAt: Date
}

/** Normalised e-mail used for every keyed hash: NFKC, trimmed, lower-case (the same rule as the login identifier). */
export const normaliseEmail = (email: string): string => email.normalize('NFKC').trim().toLowerCase()

/**
 * Counters of the public reset flow and of the password change, on `login_attempts` (rows keyed by
 * HMAC, prefixed `reset:` or `pwchange:`; no e-mail, IC or address is stored). Fixed window per key,
 * started by the first hit. The e-mail keys are applied to EVERY request, whether the account
 * exists or not, so a 429 is never an existence oracle (D55b, contract throttle rules).
 */
@Injectable()
export class AccountThrottle {
  private readonly logger = new Logger(AccountThrottle.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthConfig) private readonly config: AuthConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private id(prefix: string, value: string): string {
    return `${prefix}:${hmacHex(this.config.secret, prefix, value)}`
  }

  private ipOf(ip: string): string {
    return hmacHex(this.config.secret, 'ip', ip)
  }

  private retryAfter(counter: Counter, now: Date): number {
    return Math.min(900, Math.max(1, Math.ceil((counter.expiresAt.getTime() - now.getTime()) / 1000)))
  }

  /** Counts one hit in a fixed window (atomic upsert) and returns the counter after it. */
  private async hit(identifier: string, ipHash: string, windowMs: number, now: Date): Promise<Counter> {
    const windowEnd = new Date(now.getTime() + windowMs)
    const rows = await this.prisma.client.$queryRaw<{ attempts: number; expires_at: Date }[]>`
      INSERT INTO login_attempts (identifier_hash, ip_hash, attempts, expires_at, created_at, updated_at)
      VALUES (${identifier}, ${ipHash}, 1, ${windowEnd}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT (identifier_hash, ip_hash) DO UPDATE SET
        attempts   = CASE WHEN login_attempts.expires_at <= ${now}::timestamptz THEN 1 ELSE login_attempts.attempts + 1 END,
        expires_at = CASE WHEN login_attempts.expires_at <= ${now}::timestamptz THEN ${windowEnd}::timestamptz ELSE login_attempts.expires_at END,
        updated_at = ${now}::timestamptz
      RETURNING attempts, expires_at`
    const row = rows[0]
    return { attempts: row?.attempts ?? 1, expiresAt: row?.expires_at ?? windowEnd }
  }

  /** The live counter of a key (no write), or zero. */
  private async peek(identifier: string, ipHash: string, now: Date): Promise<Counter> {
    const row = await this.prisma.client.loginAttempt.findUnique({
      where: { identifierHash_ipHash: { identifierHash: identifier, ipHash } },
    })
    return row && row.expiresAt > now ? { attempts: row.attempts, expiresAt: row.expiresAt } : { attempts: 0, expiresAt: now }
  }

  private async drop(identifier: string, ipHash: string): Promise<void> {
    await this.prisma.client.loginAttempt.deleteMany({ where: { identifierHash: identifier, ipHash } })
  }

  // --- POST /auth/password/email and the 60 s interval ---------------------------------------------

  /** Per-address ceiling over all e-mails, then one request per e-mail per 60 s. Throws 429 `RATE_LIMITED`. */
  async mailRequest(email: string, ip: string): Promise<void> {
    const now = this.clock.now()
    const byIp = await this.hit(this.id(RESET_KEYS.mailIp, ANY), this.ipOf(ip), MAIL_IP_WINDOW_MS, now)
    if (byIp.attempts > MAIL_IP_LIMIT) throw tooMany(this.retryAfter(byIp, now))
    const byMail = await this.hit(this.id(RESET_KEYS.mailInterval, normaliseEmail(email)), ANY, MAIL_INTERVAL_MS, now)
    if (byMail.attempts > 1) {
      throw tooMany(this.retryAfter(byMail, now), ACCOUNT_AUTH_MESSAGES.resetThrottled, { email: ACCOUNT_AUTH_MESSAGES.resetThrottled })
    }
  }

  // --- POST /auth/password/reset-ic (D55a) ----------------------------------------------------------

  /**
   * Counts the attempt against the account (5 per 15 minutes) and the address (IC_IP_LIMIT per 15 minutes), whichever
   * result; a match gives its address unit back through resetIcSucceeded.
   * Every attempt, match or not, also starts the 60 s interval of the link request, so a 429 there is no match oracle.
   */
  async resetIcAttempt(email: string, ip: string): Promise<Date> {
    const now = this.clock.now()
    const account = await this.hit(this.id(RESET_KEYS.icAccount, normaliseEmail(email)), ANY, IC_WINDOW_MS, now)
    const byIp = await this.hit(this.id(RESET_KEYS.icIp, ANY), this.ipOf(ip), IC_WINDOW_MS, now)
    await this.hit(this.id(RESET_KEYS.mailInterval, normaliseEmail(email)), ANY, MAIL_INTERVAL_MS, now)
    // Failure signal (hashed address only: no e-mail, IC, user id or raw address).
    if (byIp.attempts === IC_IP_WARN_AT || byIp.attempts > IC_IP_LIMIT) {
      this.logger.warn({
        event: byIp.attempts > IC_IP_LIMIT ? 'reset_ic.ip_limited' : 'reset_ic.ip_failures_high',
        ipHash: this.ipOf(ip),
        count: byIp.attempts,
        windowEnd: byIp.expiresAt.toISOString(),
      })
    }
    const over = [
      ...(account.attempts > IC_LIMIT ? [account] : []),
      ...(byIp.attempts > IC_IP_LIMIT ? [byIp] : []),
    ]
    if (over.length > 0) {
      const wait = Math.max(...over.map((c) => this.retryAfter(c, now)))
      throw tooMany(wait, ACCOUNT_AUTH_MESSAGES.resetIcRateLimited)
    }
    return byIp.expiresAt
  }

  /** A match: the unit reserved on the address is given back (only in the window it was reserved in, `windowEnd`). */
  async resetIcSucceeded(ip: string, windowEnd: Date): Promise<void> {
    await this.prisma.client.$executeRaw`
      UPDATE login_attempts SET attempts = GREATEST(attempts - 1, 0)
      WHERE identifier_hash = ${this.id(RESET_KEYS.icIp, ANY)} AND ip_hash = ${this.ipOf(ip)} AND expires_at = ${windowEnd}::timestamptz`
  }

  // --- POST /auth/password/reset: failed redemptions -------------------------------------------------

  /** Refuses (429) when this (e-mail, address) pair or this address has used up its failure budget. */
  async redeemGuard(email: string, ip: string): Promise<void> {
    const now = this.clock.now()
    const pair = await this.peek(this.id(RESET_KEYS.redeemPair, normaliseEmail(email)), this.ipOf(ip), now)
    if (pair.attempts >= REDEEM_PAIR_LIMIT) throw tooMany(this.retryAfter(pair, now))
    const byIp = await this.peek(this.id(RESET_KEYS.redeemIp, ANY), this.ipOf(ip), now)
    if (byIp.attempts >= REDEEM_IP_LIMIT) throw tooMany(this.retryAfter(byIp, now))
  }

  async redeemFailed(email: string, ip: string): Promise<void> {
    const now = this.clock.now()
    await this.hit(this.id(RESET_KEYS.redeemPair, normaliseEmail(email)), this.ipOf(ip), REDEEM_WINDOW_MS, now)
    await this.hit(this.id(RESET_KEYS.redeemIp, ANY), this.ipOf(ip), REDEEM_WINDOW_MS, now)
  }

  async redeemSucceeded(email: string, ip: string): Promise<void> {
    await this.drop(this.id(RESET_KEYS.redeemPair, normaliseEmail(email)), this.ipOf(ip))
  }

  // --- PUT /me/password: wrong current password, per user -----------------------------------------------

  /**
   * Reserves one unit BEFORE the password is checked (as LoginThrottle.begin does), so parallel guesses cannot
   * exceed the budget. A wrong password keeps its unit; passwordChangeSucceeded gives the counter back.
   */
  async passwordChangeBegin(userId: string): Promise<void> {
    const now = this.clock.now()
    const ceiling = await this.peek(this.id(RESET_KEYS.passwordChangeCeiling, userId), ANY, now)
    if (ceiling.attempts >= PASSWORD_CHANGE_CEILING) throw tooMany(this.retryAfter(ceiling, now), AUTH_ERROR_MESSAGES.RATE_LIMITED)
    const c = await this.hit(this.id(RESET_KEYS.passwordChange, userId), ANY, PASSWORD_CHANGE_WINDOW_MS, now)
    if (c.attempts > PASSWORD_CHANGE_LIMIT) throw tooMany(this.retryAfter(c, now), AUTH_ERROR_MESSAGES.RATE_LIMITED)
  }

  /** A wrong current password: counts toward the 15-minute ceiling and returns the failures so far. */
  async passwordChangeFailed(userId: string): Promise<number> {
    const c = await this.hit(this.id(RESET_KEYS.passwordChangeCeiling, userId), ANY, PASSWORD_CHANGE_CEILING_WINDOW_MS, this.clock.now())
    return c.attempts
  }

  async passwordChangeSucceeded(userId: string): Promise<void> {
    await this.drop(this.id(RESET_KEYS.passwordChange, userId), ANY)
  }
}
