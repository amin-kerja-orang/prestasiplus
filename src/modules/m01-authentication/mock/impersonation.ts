/**
 * The school-admin impersonation session switch ("Menyamar", XR-M27-21; M27 FT-M27-8.5, BR-M27-42,
 * endpoints #20 and #21, SEC-M27-11/12). Owner: M01. The M02 admin "Login As" (#9) is a separate,
 * unchanged path with no way back.
 *
 * Mechanics: `start` opens a NEW session for the target whose core `sessions` row carries
 * `parentToken` = the actor's token. The actor's own row stays valid and is never slid by the
 * target's requests. `leave` revokes the target session and answers the actor's own session
 * (same token). The way back is taken only from the server-held `parentToken`, never from a client
 * value (SEC-M27-12).
 *
 * Guards of `start`, in this order (gap G-5: nested first, so a second start answers 409 although
 * the impersonated session is a pupil or teacher):
 * 1. the calling session already carries a `parentToken`            -> NESTED (409)
 * 2. the calling user is not a school admin with a school            -> NOT_SCHOOL_ADMIN (403)
 * 3. the target does not exist                                       -> UNKNOWN_TARGET (404)
 * 4. the target is of another school                                 -> UNKNOWN_TARGET (404)
 * 5. the target has no session role                                  -> NO_SESSION_ROLE (403)
 * 6. the target is not a pupil or teacher (staff)                    -> STAFF_TARGET (403)
 * 7. the target is inactive                                          -> INACTIVE_TARGET (403)
 * A refusal changes nothing: no session is opened and no audit row is written.
 *
 * Audit: an in-memory, append-only list (actor, target, action, time; no secret, no password),
 * read through the `impersonationAudit` hook. It lives for the page session (M27.1 item 5).
 */

import { toIsoMyt } from '@/lib/time'
import { sessions } from '@/mock/auth/sessions'
import type { ClientSession } from '@/mock/core-data/client-session'
import { toUserMe } from '@/mock/core-data/me'

import { isSessionUser } from './datasets/users-types'
import { usersRepo as users } from './repository/users'

export type ImpersonationErrorCode =
  | 'NESTED'
  | 'NOT_SCHOOL_ADMIN'
  | 'UNKNOWN_TARGET'
  | 'NO_SESSION_ROLE'
  | 'STAFF_TARGET'
  | 'INACTIVE_TARGET'
  | 'NOT_IMPERSONATING'
  | 'PARENT_EXPIRED'

/** HTTP status each refusal maps to (SRS M27 §19 #20, #21). */
const STATUS: Readonly<Record<ImpersonationErrorCode, 403 | 404 | 409>> = {
  NESTED: 409,
  NOT_SCHOOL_ADMIN: 403,
  UNKNOWN_TARGET: 404,
  NO_SESSION_ROLE: 403,
  STAFF_TARGET: 403,
  INACTIVE_TARGET: 403,
  NOT_IMPERSONATING: 403,
  PARENT_EXPIRED: 403,
}

export class ImpersonationError extends Error {
  readonly code: ImpersonationErrorCode
  readonly status: 403 | 404 | 409
  constructor(code: ImpersonationErrorCode) {
    super(`impersonation refused: ${code}`)
    this.name = 'ImpersonationError'
    this.code = code
    this.status = STATUS[code]
  }
}

export type ImpersonationAction = 'impersonate.start' | 'impersonate.leave'

export interface ImpersonationAuditRow {
  actorId: number
  targetId: number
  action: ImpersonationAction
  /** Epoch ms (mock clock). */
  at: number
}

export type ImpersonationReturnTo = '/admin-sekolah/pelajar' | '/admin-sekolah/guru'

const RETURN_TO: Readonly<Record<'student' | 'teacher', ImpersonationReturnTo>> = {
  student: '/admin-sekolah/pelajar',
  teacher: '/admin-sekolah/guru',
}

const auditRows: ImpersonationAuditRow[] = []

export const impersonation = {
  /**
   * Opens an impersonated session for `targetId` on behalf of the school admin whose session is
   * `actor.sessionToken`. Throws `ImpersonationError` (see the guard order above).
   */
  start(
    actor: { id: number; sessionToken: string },
    targetId: number,
    now: number,
  ): { session: ClientSession; impersonator: { id: number; name: string } } {
    const calling = sessions.peek(actor.sessionToken)
    if (calling?.parentToken) throw new ImpersonationError('NESTED')
    const admin = users.get(actor.id)
    if (
      !calling ||
      calling.userId !== actor.id ||
      !admin ||
      admin.role !== 'school_admin' ||
      admin.schoolId === null
    ) {
      throw new ImpersonationError('NOT_SCHOOL_ADMIN')
    }
    const target = users.get(targetId)
    if (!target || target.schoolId !== admin.schoolId) throw new ImpersonationError('UNKNOWN_TARGET')
    if (!isSessionUser(target)) throw new ImpersonationError('NO_SESSION_ROLE')
    if (target.role !== 'student' && target.role !== 'teacher') {
      throw new ImpersonationError('STAFF_TARGET')
    }
    if (!target.isActive) throw new ImpersonationError('INACTIVE_TARGET')

    const row = sessions.create(target.id, false, now, actor.sessionToken)
    const impersonator = { id: admin.id, name: admin.name }
    auditRows.push({ actorId: admin.id, targetId: target.id, action: 'impersonate.start', at: now })
    return {
      session: {
        token: row.id,
        remember: false,
        expiresAt: toIsoMyt(row.expiresAt),
        user: toUserMe(target),
        impersonator: { ...impersonator, returnTo: RETURN_TO[target.role] },
      },
      impersonator,
    }
  },

  /**
   * Ends the impersonated session `sessionToken` (revoked) and answers the actor's own session
   * (same token as before `start`). Throws `NOT_IMPERSONATING` when the session carries no
   * `parentToken`, and `PARENT_EXPIRED` when the actor's session has expired or been ended
   * meanwhile (the impersonated session is revoked either way; the caller must log in again).
   */
  leave(
    sessionToken: string,
    now: number,
  ): { session: ClientSession; returnTo: ImpersonationReturnTo } {
    const child = sessions.peek(sessionToken)
    if (!child?.parentToken) throw new ImpersonationError('NOT_IMPERSONATING')
    const target = users.get(child.userId)
    sessions.revoke(sessionToken)
    const parent = sessions.resolve(child.parentToken, now)
    const actor = parent ? users.get(parent.userId) : undefined
    if (!parent || !actor || !isSessionUser(actor)) throw new ImpersonationError('PARENT_EXPIRED')
    auditRows.push({
      actorId: actor.id,
      targetId: child.userId,
      action: 'impersonate.leave',
      at: now,
    })
    return {
      session: {
        token: parent.id,
        remember: parent.remember,
        expiresAt: toIsoMyt(parent.expiresAt),
        user: toUserMe(actor),
      },
      returnTo: RETURN_TO[target?.role === 'teacher' ? 'teacher' : 'student'],
    }
  },

  /** `true` when `sessionToken` is an impersonated session (it carries the actor's token). */
  isImpersonating(sessionToken: string): boolean {
    return Boolean(sessions.peek(sessionToken)?.parentToken)
  },

  /** A copy of the audit list, oldest first (also the `impersonationAudit` hook). */
  audit(): ImpersonationAuditRow[] {
    return auditRows.map((row) => ({ ...row }))
  },

  /** Empties the audit list (seed and tests). */
  resetAudit(): void {
    auditRows.length = 0
  },
}

/** Dev and test hook `window.__mock.impersonationAudit()` (existing hook pattern). */
export function impersonationAudit(): ImpersonationAuditRow[] {
  return impersonation.audit()
}
