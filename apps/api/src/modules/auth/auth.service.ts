import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  canEnterModPelajar,
  type LoginRequest,
  type LoginSchoolCandidate,
  type RoleCode,
  type Session,
} from '@pp/contract'

import { AUDIT_ACTIONS } from '../../common/audit/audit-actions'
import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import type { Session as SessionRow } from '../../db/generated/client'
import { PrismaService } from '../../db/prisma.service'
import { AccountRepository, type AccountRecord, type LoginCandidate } from './account.repository'
import { AuthConfig } from './auth.config'
import { authError, isOverloadError, rateLimited } from './auth.errors'
import { LOGIN_TX, MAX_LEGACY_CHECKS_PER_LOGIN } from './auth.constants'
import { isLegacyBcrypt, LegacyBcryptBusyError } from './legacy-bcrypt'
import { LoginThrottle, type ThrottleKeys } from './login-throttle.service'
import { PasswordService } from './password.service'
import type { ResolvedSession } from './session-resolver.service'
import { assemble, buildGrants } from './session-view'
import { SessionStore, type IssuedSession } from './session.store'
import { deriveCsrf } from './tokens'

/** What the service needs to know about the HTTP request (never the body, never a cookie value). */
export interface RequestInfo {
  ip: string
  userAgent: string | null
  requestId: string | null
}

/** A session to hand to the client: the wire body and the cookie to set. */
export interface SessionGrant {
  session: Session
  token: string
  expiresAt: Date
}

/** What a login attempt has reserved in the throttle, so an overload can give it back. */
interface AttemptState {
  keys: ThrottleKeys | null
  /** True once a failed credential check was counted (that unit stays). */
  counted: boolean
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuthConfig) private readonly config: AuthConfig,
    @Inject(AccountRepository) private readonly accounts: AccountRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(LoginThrottle) private readonly throttle: LoginThrottle,
    @Inject(SessionStore) private readonly store: SessionStore,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * Login by e-mail or username (mock BR-01, BR-02, BR-23). The order is fixed:
   * throttle, credentials, account state. A wrong password, an unknown identifier and an account
   * without a password hash all end in the same 401. `oldToken` is the session cookie the request
   * carried, if any; it is revoked so a login never keeps an earlier session id alive.
   */
  async login(body: LoginRequest, info: RequestInfo, oldToken?: string): Promise<SessionGrant> {
    const started = performance.now()
    const attempt: AttemptState = { keys: null, counted: false }
    try {
      return await this.attemptLogin(body, info, oldToken, attempt)
    } catch (err) {
      // An overloaded database or event loop is retryable: 429 with Retry-After, never a 500.
      if (isOverloadError(err)) {
        this.logger.warn(`login overloaded (requestId=${info.requestId ?? '-'})`)
        // The attempt never tested a credential: give the reserved unit back (pair and address counters)
        // so an overload retry does not count against the user. A credential failure already counted stays.
        if (attempt.keys && !attempt.counted) {
          try {
            await this.throttle.refund(attempt.keys)
          } catch {
            this.logger.warn(`login overload refund failed (requestId=${info.requestId ?? '-'})`)
          }
        }
        throw rateLimited(5)
      }
      // Timing oracle floor: every failed credential answer takes at least the floor, held with a
      // timer (no CPU), so account type (argon2, legacy bcrypt, unknown) cannot be told by speed.
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        const wait = this.config.failureFloorMs - (performance.now() - started)
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      }
      throw err
    }
  }

  private async attemptLogin(body: LoginRequest, info: RequestInfo, oldToken: string | undefined, attempt: AttemptState): Promise<SessionGrant> {
    const now = this.clock.now()
    const keys = this.throttle.keys(body.identifier, info.ip)
    await this.throttle.begin(keys, now)
    attempt.keys = keys

    const candidates = await this.accounts.findLoginCandidates(body.identifier, body.schoolId)
    let checks: Awaited<ReturnType<AuthService['checkAll']>>
    try {
      checks = await this.checkAll(candidates, body.password)
    } catch (err) {
      // The hashing queue is full or timed out: this attempt did not test a credential, give it back.
      if (err instanceof LegacyBcryptBusyError) {
        await this.throttle.refund(keys)
        throw rateLimited(5)
      }
      throw err
    }
    const matches = checks.filter((c) => c.ok && c.candidate)

    if (matches.length === 0) {
      const only = candidates.length === 1 ? (candidates[0] as LoginCandidate) : null
      try {
        await this.throttle.fail(keys, now, checks.length)
        attempt.counted = true
      } catch {
        // Never turn a 401 into a 500 because the global counters could not be written.
        this.logger.warn(`login throttle write failed (requestId=${info.requestId ?? '-'})`)
      }
      await this.refuse(info, 'invalid_credentials', only?.id ?? null)
      throw authError('INVALID_CREDENTIALS')
    }

    if (matches.length > 1) {
      // The same username and password fit several schools: the client must pick one (contract).
      await this.throttle.refund(keys)
      const schools: LoginSchoolCandidate[] = matches.flatMap((m) =>
        m.candidate && m.candidate.schoolId !== null && m.candidate.schoolName
          ? [{ id: m.candidate.schoolId.toString(), name: m.candidate.schoolName }]
          : [],
      )
      throw authError('AMBIGUOUS_USERNAME', { details: { schools } })
    }

    const match = matches[0] as { candidate: LoginCandidate; ok: boolean; needsRehash: boolean }
    const account = await this.accounts.loadAccount(match.candidate.id)
    if (!account) {
      await this.refuse(info, 'invalid_credentials', null)
      throw authError('INVALID_CREDENTIALS')
    }

    // BR-23: checked after the credentials match; the refused attempt does not count as a failure.
    if (!account.user.isActive || account.user.isSuspended) {
      await this.throttle.refund(keys)
      await this.refuse(info, 'account_inactive', account.user.id)
      throw authError('ACCOUNT_INACTIVE')
    }
    if (account.school && !account.school.isActive) {
      await this.throttle.refund(keys)
      await this.refuse(info, 'school_inactive', account.user.id)
      throw authError('SCHOOL_INACTIVE')
    }
    const grants = buildGrants(account)
    if (!grants || grants.length === 0) {
      // No usable role (data problem): treated as an unusable account, never as a half session.
      await this.throttle.refund(keys)
      await this.refuse(info, 'no_usable_role', account.user.id)
      throw authError('ACCOUNT_INACTIVE')
    }

    const activeRole = (grants[0] as { role: RoleCode }).role
    const rememberDays = this.config.rememberDaysFor(grants.map((g) => g.role))
    const remember = body.remember && rememberDays > 0
    const newHash = match.needsRehash ? await this.passwords.hash(body.password, 'high') : null
    // Four short statements; a slow database must not turn a correct login into a 500, so the
    // interactive transaction gets more room than Prisma's 5 s default (and an overload answers 429).
    const granted = await this.prisma.transaction(async () => {
      if (oldToken) await this.store.revokeByToken(oldToken)
      const issued = await this.store.create({
        userId: account.user.id,
        activeRole,
        remember,
        // "Remember me" is capped by the highest-privilege role of the account (LEAD, M2).
        rememberDays,
        userAgent: info.userAgent,
        ip: info.ip,
      })
      await this.accounts.recordLogin(account.user, now, newHash)
      const out = this.grantFrom(issued, account)
      await this.audit.record({
        action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
        actorUserId: out.session.user.id,
        actorRole: out.session.active.role,
        sessionRowId: issued.row.id,
        targetType: 'session',
        targetId: issued.row.id,
        scopeLevel: out.session.active.scope.level,
        schoolId: out.session.active.scope.schoolId ?? null,
        requestId: info.requestId,
        ip: info.ip,
        details: { remember, rehashed: newHash !== null },
      })
      return out
    }, LOGIN_TX)
    try {
      await this.throttle.clear(keys)
    } catch {
      // The login already succeeded; a stale counter only expires with its window.
      this.logger.warn(`login throttle reset failed (requestId=${info.requestId ?? '-'})`)
    }
    return granted
  }

  /** Logout: the session row stops resolving at once. Safe to call with no session. */
  async logout(token: string | undefined, state: ResolvedSession | null, info: RequestInfo): Promise<void> {
    if (token) await this.store.revokeByToken(token)
    if (state) {
      try {
        await this.audit.record({
          action: AUDIT_ACTIONS.LOGOUT,
          actorUserId: state.auth.userId,
          actorRole: state.auth.active.role,
          sessionRowId: state.row.id,
          scopeLevel: state.auth.active.scope.level,
          schoolId: state.auth.active.scope.schoolId ?? null,
          targetType: 'session',
          targetId: state.row.id,
          requestId: info.requestId,
          ip: info.ip,
          isTest: state.auth.mode !== null,
        })
      } catch {
        // The session is already revoked; an audit failure must not keep the cookie alive.
        this.logger.warn(`logout audit write failed (requestId=${info.requestId ?? '-'})`)
      }
    }
  }

  /** `POST /session/role`. */
  async switchRole(state: ResolvedSession, role: RoleCode, info: RequestInfo): Promise<SessionGrant> {
    if (state.auth.mode) throw authError('MODE_ACTIVE')
    const target = state.grants.find((g) => g.role === role)
    if (!target) throw authError('ROLE_NOT_ALLOWED')
    return this.regenerate(state, { activeRole: role, mode: null }, info, {
      action: AUDIT_ACTIONS.ROLE_SWITCHED,
      role,
      details: { from: state.assembled.baseRole, to: role },
    })
  }

  /** `POST /session/mode`. */
  async enterMode(state: ResolvedSession, info: RequestInfo): Promise<SessionGrant> {
    if (state.auth.mode) throw authError('MODE_ALREADY_ACTIVE')
    const role = state.assembled.baseRole
    if (!canEnterModPelajar(role)) throw authError('MODE_NOT_ALLOWED')
    return this.regenerate(
      state,
      { activeRole: role, mode: { kind: 'mod_pelajar', returnRole: role, since: this.clock.now() } },
      info,
      { action: AUDIT_ACTIONS.MODE_ENTERED, role, details: { mode: 'mod_pelajar' } },
    )
  }

  /** `DELETE /session/mode`. */
  async exitMode(state: ResolvedSession, info: RequestInfo): Promise<SessionGrant> {
    const mode = state.assembled.mode
    if (!mode) throw authError('NO_MODE_ACTIVE')
    return this.regenerate(state, { activeRole: mode.returnRole, mode: null }, info, {
      action: AUDIT_ACTIONS.MODE_EXITED,
      role: mode.returnRole,
      details: { mode: 'mod_pelajar' },
    })
  }

  /**
   * Password checks for every candidate (at most MAX_LOGIN_CANDIDATES, at most 3 of them legacy
   * bcrypt). With no candidate one dummy check still runs, so an unknown identifier costs the same
   * as a known one. A full or slow legacy-bcrypt queue throws `LegacyBcryptBusyError` (caller: 429).
   */
  private async checkAll(candidates: LoginCandidate[], password: string) {
    const out: { candidate: LoginCandidate | null; ok: boolean; needsRehash: boolean }[] = []
    if (candidates.length === 0) {
      out.push({ candidate: null, ok: (await this.passwords.check(password, null)).ok, needsRehash: false })
    }
    let legacyChecks = 0
    for (const candidate of candidates) {
      if (candidate.passwordHash && isLegacyBcrypt(candidate.passwordHash)) {
        // Each legacy check costs about a second of worker time; later ones count as failed unchecked.
        if (legacyChecks >= MAX_LEGACY_CHECKS_PER_LOGIN) {
          out.push({ candidate, ok: false, needsRehash: false })
          continue
        }
        legacyChecks++
      }
      const check = await this.passwords.check(password, candidate.passwordHash)
      out.push({ candidate, ok: check.ok, needsRehash: check.needsRehash })
    }
    return out
  }

  /** Audit row of a refused login. Carries a reason code only: never the identifier or the password. */
  private async refuse(info: RequestInfo, reason: string, userId: bigint | null): Promise<void> {
    try {
      await this.audit.record({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        actorUserId: userId === null ? null : userId.toString(),
        requestId: info.requestId,
        ip: info.ip,
        details: { reason },
      })
    } catch {
      // An audit failure must never change the auth response. Log the reason code and request id only.
      this.logger.warn(`login failure audit write failed (reason=${reason}, requestId=${info.requestId ?? '-'})`)
    }
  }

  /** New session id for the same login, plus its audit row, in one transaction. */
  private async regenerate(
    state: ResolvedSession,
    next: { activeRole: string; mode: { kind: 'mod_pelajar'; returnRole: string; since: Date } | null },
    info: RequestInfo,
    audit: { action: string; role: RoleCode; details: Record<string, unknown> },
  ): Promise<SessionGrant> {
    return this.prisma.transaction(async () => {
      const issued = await this.store.regenerate(state.row, { ...next, userAgent: info.userAgent, ip: info.ip })
      // The old session was already replaced by a parallel request: this one is no longer valid.
      if (!issued) throw ApiError.of('UNAUTHORIZED')
      const out = this.grantFrom(issued, state.account)
      await this.audit.record({
        action: audit.action,
        actorUserId: state.auth.userId,
        actorRole: audit.role,
        sessionRowId: issued.row.id,
        targetType: 'session',
        targetId: issued.row.id,
        scopeLevel: state.assembled.grants.find((g) => g.role === audit.role)?.scope.level ?? null,
        schoolId: state.assembled.grants.find((g) => g.role === audit.role)?.scope.schoolId ?? null,
        requestId: info.requestId,
        ip: info.ip,
        details: audit.details,
      })
      return out
    })
  }

  private grantFrom(issued: IssuedSession, account: AccountRecord): SessionGrant {
    const row: SessionRow = issued.row
    const assembled = assemble(account, row, deriveCsrf(this.config.secret, issued.token))
    if (!assembled) throw authError('ACCOUNT_INACTIVE')
    return { session: assembled.session, token: issued.token, expiresAt: row.expiresAt }
  }
}
