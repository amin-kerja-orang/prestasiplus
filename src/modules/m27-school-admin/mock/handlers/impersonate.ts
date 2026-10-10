/**
 * SRS M27 Part B §19 #20 `POST /api/admin-sekolah/users/:id/impersonate` and #21 `POST
 * /api/admin-sekolah/impersonate/leave` (M27-T1d, FT-M27-8.5, BR-M27-42, SEC-M27-11/12).
 *
 * Thin wrappers over the M01 contract `impersonation` (XR-M27-21). M01 decides every refusal and its
 * order (nested 409 first, then the school-admin check, then the target checks), so #20 carries NO
 * generic school-admin guard: only a missing session answers 401 here. #21 is not an SA route either:
 * the impersonated session (a pupil or teacher) calls it, and M01 refuses a session that carries no
 * impersonation with 403. The way back is taken only from the server-held parent token, never from
 * the request. M27 keeps no state of its own; the audit rows are M01's `impersonationAudit` hook.
 */

import {
  conflict,
  forbidden,
  notFound,
  ok,
  route,
  unauthorized,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { ImpersonationError, impersonation } from '@/modules/m01-authentication/mock'

const BASE = '/api/admin-sekolah'

export const MSG_IMPERSONATE_START = (name: string): string => `Anda kini menyamar sebagai ${name}.`
export const MSG_IMPERSONATE_LEAVE = 'Anda telah kembali ke akaun pentadbir.'

/** Maps the owner's refusal onto the stable error envelope; anything else is a real bug and propagates. */
function refusal(error: unknown): MockResponse {
  if (!(error instanceof ImpersonationError)) throw error
  if (error.status === 404) return notFound()
  if (error.status === 409) return conflict()
  return forbidden()
}

/** `:id` as a positive integer; anything else can name no user, so it is an unknown target (404). */
function targetOf(raw: unknown): number {
  const text = String(raw)
  return /^[1-9]\d*$/.test(text) ? Number(text) : -1
}

const startRoute = route('POST', `${BASE}/users/:id/impersonate`, (req, ctx) => {
  const session = req.session
  if (!session) return unauthorized()
  try {
    return ctx.transaction(() => {
      const out = impersonation.start(
        { id: session.userId, sessionToken: session.token },
        targetOf(req.params.id),
        ctx.clock.now(),
      )
      const { token, expiresAt, user } = out.session
      return ok(
        { token, expiresAt, user, impersonator: out.impersonator },
        { status: MSG_IMPERSONATE_START(user.name) },
      )
    })
  } catch (error) {
    return refusal(error)
  }
})

const leaveRoute = route('POST', `${BASE}/impersonate/leave`, (req, ctx) => {
  const session = req.session
  if (!session) return unauthorized()
  try {
    // No transaction wrapper: M01 revokes the impersonated session even when the parent has expired
    // (PARENT_EXPIRED), and that revoke must survive the refusal.
    const out = impersonation.leave(session.token, ctx.clock.now())
    const { token, expiresAt, user, remember } = out.session
    return ok({ token, expiresAt, user, remember, returnTo: out.returnTo }, { status: MSG_IMPERSONATE_LEAVE })
  } catch (error) {
    return refusal(error)
  }
})

export const impersonateRoutes: RouteDef[] = [startRoute, leaveRoute]
