import { randomBytes } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  ACCOUNT_AUTH_MESSAGES,
  ACCOUNT_SECURITY_NOTIFICATIONS,
  type AccountPasswordEmailRequest,
  type AccountPasswordResetIcRequest,
  type AccountPasswordResetRequest,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { CLOCK, type Clock } from '../../db/clock'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { AuthConfig } from '../auth/auth.config'
import type { RequestInfo, SessionGrant } from '../auth/auth.service'
import { PasswordService } from '../auth/password.service'
import { SessionStore } from '../auth/session.store'
import { hmacHex, safeEqualHex } from '../auth/tokens'
import { IcService } from '../users/credentials'
import { UsersRepository, type UserCredentials } from '../users'
import { ACCOUNT_AUDIT, ACCOUNT_TX, RESET_TOKEN_BYTES, RESET_TOKEN_TTL_MS } from './account.constants'
import { accountInactive, icMismatch, tokenInvalid } from './account.errors'
import { AccountDataRepository } from './account-data.repository'
import { AccountThrottle } from './account-throttle.service'
import { holdUntil, overloadTo429 } from './helpers'
import { MAIL_PORT, NOTIFICATION_PORT, type AccountNotice, type MailPort, type NotificationPort } from './ports'
import { SessionIssuer } from './session-issuer.service'

/** Stands in for a missing IC hash so the compare always runs (equal work for every reason of failure). */
const NO_HASH = '0'.repeat(64)
/** A 12-digit value no real IC check uses; hashed when the typed IC is malformed. */
const NO_IC = '000000000000'

/**
 * Password reset by e-mail link and by IC number (mock BR-10 to BR-12; decisions D55a, D55b, D59a).
 *
 * Security rules, each with its test in `test/account/`:
 * - The token is 256 random bits; only `HMAC(secret, token)` is stored; it expires after 60 minutes,
 *   is single use (an atomic `UPDATE ... WHERE used_at IS NULL`), and is bound to the user it was
 *   issued for. A new token spends the user's earlier ones.
 * - An unknown e-mail, an inactive account, a wrong IC and a wrong token are indistinguishable in
 *   status, body and (through a response floor) timing; every e-mail based counter is applied to every request.
 * - The link goes through `MailPort` (logging only); no secret is written to the audit log.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuthConfig) private readonly config: AuthConfig,
    @Inject(AccountDataRepository) private readonly data: AccountDataRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(IcService) private readonly ic: IcService,
    @Inject(AccountThrottle) private readonly throttle: AccountThrottle,
    @Inject(SessionStore) private readonly sessions: SessionStore,
    @Inject(SessionIssuer) private readonly issuer: SessionIssuer,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    @Inject(NOTIFICATION_PORT) private readonly notices: NotificationPort,
  ) {}

  private hashToken(token: string): string {
    return hmacHex(this.config.secret, 'pw-reset', token)
  }

  private usable(user: UserCredentials | null): user is UserCredentials {
    return user !== null && user.isActive && !user.isSuspended
  }

  // --- POST /auth/password/email -----------------------------------------------------------------

  /** Always the same answer for a known and an unknown e-mail (D55b). */
  async requestLink(body: AccountPasswordEmailRequest, info: RequestInfo): Promise<{ status: string }> {
    return overloadTo429(async () => {
      const started = performance.now()
      await this.throttle.mailRequest(body.email, info.ip)
      const user = await this.users.findCredentialsByEmail(body.email)
      if (this.usable(user) && user.email) {
        try {
          const issued = await this.issueToken(user, 'email')
          await this.mail.sendPasswordReset({
            to: user.email,
            userId: user.id,
            resetId: issued.resetId,
            token: issued.token,
            link: `/password/reset#token=${issued.token}&email=${encodeURIComponent(user.email)}`,
            expiresAt: issued.expiresAt,
          })
          await this.auditSafe(ACCOUNT_AUDIT.RESET_REQUESTED, user, info, { channel: 'email', resetId: issued.resetId })
        } catch {
          // Whatever failed (mail, audit, database), the answer must not tell a known e-mail from an unknown one.
          this.logger.warn(`password reset link not issued (requestId=${info.requestId ?? '-'})`)
        }
      }
      await holdUntil(started, this.config.failureFloorMs)
      return { status: ACCOUNT_AUTH_MESSAGES.resetSent }
    })
  }

  // --- POST /auth/password/reset -------------------------------------------------------------------

  async reset(body: AccountPasswordResetRequest, info: RequestInfo): Promise<SessionGrant> {
    return overloadTo429(async () => {
      const started = performance.now()
      await this.throttle.redeemGuard(body.email, info.ip)

      const user = await this.users.findCredentialsByEmail(body.email)
      const hash = this.hashToken(body.token)
      const row = await this.data.findToken(hash)
      const now = this.clock.now()
      const valid =
        user !== null &&
        row !== null &&
        row.userId === user.id &&
        row.usedAt === null &&
        row.expiresAt.getTime() > now.getTime() &&
        safeEqualHex(row.tokenHash, hash)
      if (!valid || !user || !row) {
        await this.refuseToken(body.email, info, started)
        throw tokenInvalid()
      }
      // BR-23 (inferred): a reset logs the user in, so an inactive account is refused and nothing changes.
      if (!this.usable(user)) throw accountInactive()

      const passwordHash = await this.passwords.hash(body.password, 'high')
      const grant = await this.prisma.transaction(async () => {
        if (!(await this.data.consumeToken(row.id, now))) return null
        await this.data.spendOpenTokens(user.id, now)
        await this.users.update(user.id, { passwordHash, mustChangePassword: false, now })
        // Every other session of the user ends with the old password.
        await this.sessions.revokeAllFor(idFromString(user.id))
        const issued = await this.issuer.issue(user.id, info)
        await this.audit.record({
          action: ACCOUNT_AUDIT.RESET_DONE,
          actorUserId: user.id,
          targetType: 'user',
          targetId: user.id,
          schoolId: user.schoolId,
          requestId: info.requestId,
          ip: info.ip,
          details: { channel: row.channel, resetId: row.id },
        })
        return issued
      }, ACCOUNT_TX)
      if (!grant) {
        // Lost a race: another request spent the token first.
        await this.refuseToken(body.email, info, started)
        throw tokenInvalid()
      }
      await this.throttle.redeemSucceeded(body.email, info.ip).catch(() => undefined)
      await this.notify(user, ACCOUNT_SECURITY_NOTIFICATIONS.resetDone)
      return grant
    })
  }

  private async refuseToken(email: string, info: RequestInfo, started: number): Promise<void> {
    try {
      await this.throttle.redeemFailed(email, info.ip)
    } catch {
      this.logger.warn(`password reset failure counter not written (requestId=${info.requestId ?? '-'})`)
    }
    await holdUntil(started, this.config.failureFloorMs)
  }

  // --- POST /auth/password/reset-ic ----------------------------------------------------------------

  async resetByIc(body: AccountPasswordResetIcRequest, info: RequestInfo): Promise<{ token: string }> {
    return overloadTo429(async () => {
      const started = performance.now()
      // D55a: counted before anything is compared, per account and per address, match or not.
      await this.throttle.resetIcAttempt(body.email, info.ip)

      const user = await this.users.findCredentialsByEmail(body.email)
      const digits = this.ic.normalise(body.icNumber)
      const candidate = this.ic.hash(digits ?? NO_IC)
      const stored = user?.icHash ?? NO_HASH
      const sameIc = safeEqualHex(candidate, stored)
      if (!(this.usable(user) && user.icHash !== null && digits !== null && sameIc)) {
        await holdUntil(started, this.config.failureFloorMs)
        throw icMismatch()
      }

      const issued = await this.issueToken(user, 'ic')
      await this.auditSafe(ACCOUNT_AUDIT.RESET_IC_ISSUED, user, info, { channel: 'ic', resetId: issued.resetId })
      await this.notify(user, ACCOUNT_SECURITY_NOTIFICATIONS.resetIcIssued)
      return { token: issued.token }
    })
  }

  // --- shared ----------------------------------------------------------------------------------------

  /** Spends the user's open tokens and stores a new one (hash only). Returns the raw token, which exists only in memory. */
  private async issueToken(user: UserCredentials, channel: 'email' | 'ic'): Promise<{ token: string; resetId: string; expiresAt: Date }> {
    const token = randomBytes(RESET_TOKEN_BYTES).toString('base64url')
    const at = this.clock.now()
    const expiresAt = new Date(at.getTime() + RESET_TOKEN_TTL_MS)
    const resetId = await this.prisma.transaction(async () => {
      await this.data.spendOpenTokens(user.id, at)
      return this.data.insertToken({ userId: user.id, tokenHash: this.hashToken(token), channel, expiresAt, at })
    }, ACCOUNT_TX)
    return { token, resetId, expiresAt }
  }

  /** Audit row of a public flow: no actor session, ids and channel only. A failed write is logged, never surfaced. */
  private async auditSafe(action: string, user: UserCredentials, info: RequestInfo, details: Record<string, unknown>): Promise<void> {
    try {
      await this.audit.record({
        action,
        actorUserId: null,
        targetType: 'user',
        targetId: user.id,
        schoolId: user.schoolId,
        requestId: info.requestId,
        ip: info.ip,
        details,
      })
    } catch {
      this.logger.warn(`audit write failed (action=${action}, requestId=${info.requestId ?? '-'})`)
    }
  }

  /** D59a: the account owner and the school admins of the owner's school. A failing port never fails the request. */
  private async notify(user: UserCredentials, owner: AccountNotice): Promise<void> {
    const school = ACCOUNT_SECURITY_NOTIFICATIONS.schoolNotice
    try {
      await this.notices.push(user.id, { type: owner.type, title: owner.title, body: owner.body })
      if (user.schoolId) {
        for (const adminId of await this.users.schoolAdminIds(user.schoolId)) {
          await this.notices.push(adminId, { type: school.type, title: school.title, body: school.body.replace('{name}', user.name) })
        }
      }
    } catch {
      this.logger.warn('security notice not delivered')
    }
  }
}
