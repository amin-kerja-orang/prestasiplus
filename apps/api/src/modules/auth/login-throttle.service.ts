import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '../../db/prisma.service'
import { AuthConfig } from './auth.config'
import {
  IDENTIFIER_FAIL_WINDOW_MS,
  IP_FAIL_LIMIT,
  IP_FAIL_WINDOW_MS,
  LOGIN_WINDOW_MS,
} from './auth.constants'
import { rateLimited } from './auth.errors'
import { hmacHex } from './tokens'

export interface ThrottleKeys {
  /** Pair counter: this identifier from this address. */
  identifierHash: string
  ipHash: string
  /** Global counter keys (see `fail`). */
  ipOnly: { identifierHash: string; ipHash: string }
  identifierOnly: { identifierHash: string; ipHash: string }
}

const ANY_IP = 'any-ip'
const ANY_IDENTIFIER = 'any-identifier'

function retryAfterOf(expiresAt: Date, now: Date): number {
  return Math.min(900, Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)))
}

/**
 * Login throttle, three layers on `login_attempts` (counter rows, keyed hashes only):
 *
 * 1. Pair (mock BR-02, card AC 3): at most `THROTTLE_LOGIN_PER_MINUTE` attempts per identifier +
 *    client address in 60 s. Every attempt is counted BEFORE the password is checked, in one atomic
 *    upsert, so parallel guesses cannot pass the limit. A success clears the row and a refusal that
 *    is not a credential failure (inactive account, ambiguous username) gives its count back. The
 *    attempt over the limit gets 429 even with the correct password.
 * 2. Per address (security review M1): 20 failed logins per minute across all identifiers. One unit
 *    is RESERVED before the work and given back on success or a non-credential refusal, so a burst
 *    of parallel requests cannot all pass the check (a failure keeps its unit).
 * 3. Per identifier (M1, LEAD N2): `LOGIN_IDENTIFIER_FAIL_LIMIT` (default 100) failed logins per
 *    15 minutes across all addresses.
 *    Layers 2 and 3 count failures only, weighted by the number of password hashes checked, and a
 *    success never resets them (otherwise one valid account would reset them for an attacker).
 *    The identifier ceiling is read before and written after a failure, so a burst can overshoot it
 *    by the burst size.
 *
 * The key is the identifier (NFKC, trimmed, lower-cased) and the address; it deliberately ignores
 * `schoolId`, as the mock keys on the e-mail only, so a username cannot be sprayed school by school.
 * Neither the identifier nor the address is stored.
 */
@Injectable()
export class LoginThrottle {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthConfig) private readonly config: AuthConfig,
  ) {}

  keys(identifier: string, ip: string): ThrottleKeys {
    const id = hmacHex(this.config.secret, 'login-id', identifier.normalize('NFKC').trim().toLowerCase())
    const ipHash = hmacHex(this.config.secret, 'ip', ip)
    return {
      identifierHash: id,
      ipHash,
      ipOnly: { identifierHash: ANY_IDENTIFIER, ipHash },
      identifierOnly: { identifierHash: id, ipHash: ANY_IP },
    }
  }

  /** Counts this attempt; throws 429 `RATE_LIMITED` when a ceiling is already used up. */
  async begin(keys: ThrottleKeys, now: Date): Promise<void> {
    const global = await this.prisma.client.loginAttempt.findMany({
      where: {
        OR: [
          { identifierHash: keys.ipOnly.identifierHash, ipHash: keys.ipOnly.ipHash },
          { identifierHash: keys.identifierOnly.identifierHash, ipHash: keys.identifierOnly.ipHash },
        ],
        expiresAt: { gt: now },
      },
    })
    for (const row of global) {
      if (row.ipHash === ANY_IP && row.attempts >= this.config.identifierFailLimit) {
        throw rateLimited(retryAfterOf(row.expiresAt, now))
      }
    }

    // Reserve one unit of the per-address ceiling before any work is done.
    const ip = (await this.upsert(keys.ipOnly, now, IP_FAIL_WINDOW_MS, 1))[0]
    if (ip && ip.attempts > IP_FAIL_LIMIT) {
      await this.releaseIp(keys)
      throw rateLimited(retryAfterOf(ip.expires_at, now))
    }

    const row = (await this.upsert(keys, now, LOGIN_WINDOW_MS, 1))[0]
    if (row && row.attempts > this.config.loginLimit) {
      await this.releaseIp(keys)
      throw rateLimited(retryAfterOf(row.expires_at, now))
    }
  }

  private async releaseIp(keys: ThrottleKeys): Promise<void> {
    await this.prisma.client.$executeRaw`
      UPDATE login_attempts SET attempts = GREATEST(attempts - 1, 0)
       WHERE identifier_hash = ${keys.ipOnly.identifierHash} AND ip_hash = ${keys.ipOnly.ipHash}`
  }

  /**
   * A failed credential check: feeds the global ceilings. `weight` is the number of hashes checked;
   * the per-address ceiling already holds one reserved unit from `begin`.
   */
  async fail(keys: ThrottleKeys, now: Date, weight: number): Promise<void> {
    const w = Math.max(1, weight)
    if (w > 1) await this.upsert(keys.ipOnly, now, IP_FAIL_WINDOW_MS, w - 1)
    await this.upsert(keys.identifierOnly, now, IDENTIFIER_FAIL_WINDOW_MS, w)
  }

  private upsert(
    key: { identifierHash: string; ipHash: string },
    now: Date,
    windowMs: number,
    add: number,
  ): Promise<{ attempts: number; expires_at: Date }[]> {
    const windowEnd = new Date(now.getTime() + windowMs)
    return this.prisma.client.$queryRaw<{ attempts: number; expires_at: Date }[]>`
      INSERT INTO login_attempts (identifier_hash, ip_hash, attempts, expires_at, created_at, updated_at)
      VALUES (${key.identifierHash}, ${key.ipHash}, ${add}::int, ${windowEnd}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT (identifier_hash, ip_hash) DO UPDATE SET
        attempts   = CASE WHEN login_attempts.expires_at <= ${now}::timestamptz THEN ${add}::int
                          ELSE login_attempts.attempts + ${add}::int END,
        expires_at = CASE WHEN login_attempts.expires_at <= ${now}::timestamptz THEN ${windowEnd}::timestamptz
                          ELSE login_attempts.expires_at END,
        updated_at = ${now}::timestamptz
      RETURNING attempts, expires_at`
  }

  /** Gives one attempt back (a refusal that is not a failed credential check). */
  async refund(keys: ThrottleKeys): Promise<void> {
    await this.releaseIp(keys)
    await this.prisma.client.$executeRaw`
      UPDATE login_attempts SET attempts = GREATEST(attempts - 1, 0)
       WHERE identifier_hash = ${keys.identifierHash} AND ip_hash = ${keys.ipHash}`
  }

  /** A successful login resets the pair counter and gives its address unit back; the failure ceilings stay. */
  async clear(keys: ThrottleKeys): Promise<void> {
    await this.releaseIp(keys)
    await this.prisma.client.loginAttempt.deleteMany({
      where: { identifierHash: keys.identifierHash, ipHash: keys.ipHash },
    })
  }
}
