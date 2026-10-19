import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { AccountRepository } from '../auth/account.repository'
import { AuthConfig } from '../auth/auth.config'
import { authError } from '../auth/auth.errors'
import type { RequestInfo, SessionGrant } from '../auth/auth.service'
import { assemble, buildGrants } from '../auth/session-view'
import { SessionStore } from '../auth/session.store'
import { deriveCsrf } from '../auth/tokens'

/**
 * Opens a session for a user without a password check (registration and password reset have just
 * proved who the caller is), and rotates a live session. It mirrors what `AuthService.login` does
 * after the credentials match: first grant is the active role, not remembered, `last_login_at` set.
 * Run it inside the caller's transaction (it uses `prisma.client`).
 */
@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuthConfig) private readonly config: AuthConfig,
    @Inject(AccountRepository) private readonly accounts: AccountRepository,
    @Inject(SessionStore) private readonly store: SessionStore,
  ) {}

  async issue(userId: string, info: RequestInfo): Promise<SessionGrant> {
    const account = await this.accounts.loadAccount(idFromString(userId))
    const grants = account ? buildGrants(account) : null
    if (!account || !grants || grants.length === 0) throw authError('ACCOUNT_INACTIVE')
    const now = this.clock.now()
    const activeRole = (grants[0] as { role: string }).role
    const issued = await this.store.create({
      userId: account.user.id,
      activeRole,
      remember: false,
      userAgent: info.userAgent,
      ip: info.ip,
    })
    await this.accounts.recordLogin(account.user, now, null)
    const assembled = assemble(account, issued.row, deriveCsrf(this.config.secret, issued.token))
    if (!assembled) throw authError('ACCOUNT_INACTIVE')
    return { session: assembled.session, token: issued.token, expiresAt: issued.row.expiresAt }
  }

  /** New cookie value for a live session (same role and mode); the old row is deleted. 401 if it was already replaced. */
  async rotate(sessionRowId: string, info: RequestInfo): Promise<SessionGrant> {
    const row = await this.prisma.client.session.findUnique({ where: { id: sessionRowId } })
    if (!row || row.revokedAt !== null) throw ApiError.of('UNAUTHORIZED')
    const account = await this.accounts.loadAccount(row.userId)
    if (!account) throw ApiError.of('UNAUTHORIZED')
    const mode =
      row.modeKind === 'mod_pelajar' && row.modeReturnRole && row.modeSince
        ? { kind: 'mod_pelajar' as const, returnRole: row.modeReturnRole, since: row.modeSince }
        : null
    const issued = await this.store.regenerate(row, { activeRole: row.activeRole, mode, userAgent: info.userAgent, ip: info.ip })
    if (!issued) throw ApiError.of('UNAUTHORIZED')
    const assembled = assemble(account, issued.row, deriveCsrf(this.config.secret, issued.token))
    if (!assembled) throw authError('ACCOUNT_INACTIVE')
    return { session: assembled.session, token: issued.token, expiresAt: issued.row.expiresAt }
  }
}
