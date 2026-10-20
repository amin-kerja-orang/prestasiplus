import { Inject, Injectable } from '@nestjs/common'
import type { RoleGrant, Session } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import type { SessionResolver } from '../../common/guards/session-resolver'
import type { AuthContext } from '../../common/scope/auth-context'
import { CLOCK, type Clock } from '../../db/clock'
import type { Session as SessionRow } from '../../db/generated/client'
import { AccountRepository, type AccountRecord } from './account.repository'
import { AuthConfig } from './auth.config'
import { CSRF_HEADER, SAFE_METHODS } from './auth.constants'
import { authError } from './auth.errors'
import { sessionTokenOf, setSessionCookie } from './cookies'
import { assemble, type Assembled } from './session-view'
import { SessionStore } from './session.store'
import { deriveCsrf, safeEqualHex, sha256Hex } from './tokens'

/** Everything a session endpoint needs about the caller, resolved once per request. */
export interface ResolvedSession {
  auth: AuthContext
  /** The wire body (`GET /session`), including the derived `csrf`. */
  session: Session
  row: SessionRow
  /** Raw cookie value of this request. */
  token: string
  account: AccountRecord
  grants: RoleGrant[]
  assembled: Assembled
}

/**
 * `SessionResolver` over the Postgres session store (card AC 4, 5 and 11).
 *
 * On every request it rebuilds the `AuthContext` from the session row and the CURRENT `users`,
 * `user_roles`, `user_scopes` and `schools` rows, so a deactivated account gets 401 and a changed
 * role, scope or school shows on the next request. It also enforces CSRF on mutating methods and
 * slides the expiry (at most once a minute). The result is memoised per request, so the global
 * guard and a controller that asks again do the work once.
 */
@Injectable()
export class PostgresSessionResolver implements SessionResolver {
  private readonly memo = new WeakMap<Request, ResolvedSession | null>()

  constructor(
    @Inject(SessionStore) private readonly store: SessionStore,
    @Inject(AccountRepository) private readonly accounts: AccountRepository,
    @Inject(AuthConfig) private readonly config: AuthConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async resolve(req: Request): Promise<AuthContext | null> {
    return (await this.resolveState(req))?.auth ?? null
  }

  async resolveState(req: Request): Promise<ResolvedSession | null> {
    if (this.memo.has(req)) return this.memo.get(req) ?? null
    const state = await this.load(req)
    this.memo.set(req, state)
    return state
  }

  /** 401 `UNAUTHORIZED` when there is no valid session. */
  async require(req: Request): Promise<ResolvedSession> {
    const state = await this.resolveState(req)
    if (!state) throw ApiError.of('UNAUTHORIZED')
    return state
  }

  private async load(req: Request): Promise<ResolvedSession | null> {
    const token = sessionTokenOf(req, this.config)
    if (!token) return null
    const now = this.clock.now()

    let row = await this.store.findByToken(token)
    if (!row || !this.store.isLive(row, now)) return null

    const account = await this.accounts.loadAccount(row.userId)
    const school = account?.school ?? null
    if (!account || !account.user.isActive || account.user.isSuspended || (school && !school.isActive)) {
      // The account was deactivated (or its school was) after login: the session dies with it.
      await this.store.revokeRow(row.id)
      return null
    }

    const csrf = deriveCsrf(this.config.secret, token)
    let assembled = assemble(account, row, csrf)
    if (!assembled) {
      await this.store.revokeRow(row.id)
      return null
    }

    // CSRF only after the session is known to be valid, so an anonymous request is just a 401.
    if (!SAFE_METHODS.includes(req.method.toUpperCase())) {
      const header = req.headers[CSRF_HEADER]
      const value = Array.isArray(header) ? header[0] : header
      if (!value || !safeEqualHex(sha256Hex(value), row.csrfHash)) throw authError('CSRF_INVALID')
    }

    if (assembled.repaired) {
      row = await this.store.setState(row.id, assembled.baseRole, null)
      assembled = assemble(account, row, csrf) ?? assembled
    }

    const slid = await this.store.slide(row, now)
    if (slid.moved) {
      row = slid.row
      assembled = assemble(account, row, csrf) ?? assembled
      // Keep the cookie lifetime in step with the server-side expiry.
      if (req.res) setSessionCookie(req.res, this.config, token, row.expiresAt, now)
    }

    return { auth: assembled.auth, session: assembled.session, row, token, account, grants: assembled.grants, assembled }
  }
}
