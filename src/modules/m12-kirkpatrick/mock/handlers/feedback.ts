/**
 * SRS M12 v1.6 §7 #12 `GET /api/feedback/status` (S10) and #13 `POST /api/feedback`. Open to any logged-in user
 * (SRS §9; INFERRED for the roles other than admin). One response per user per calendar month: a second answers
 * `409 CONFLICT`; `nps` (integer 0-10) and `satisfaction` (integer 1-5) out of range answer `422` (PROPOSED).
 * The role of the response is derived from the session, never from the body (SEC-M12-07).
 */

import { created, ok, requireAuth, route, validationError, type RouteDef } from '@/mock/define'

import { feedbackRepo } from '../repository'
import { monthKeyOf } from '../repository/common'
import { FIELD_INVALID, FIELD_REQUIRED, refusal, viewerOf } from './common'

const blank = (v: unknown): boolean => v === undefined || v === null || v === ''

/** A whole number from a JSON number or numeric text. */
function whole(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isInteger(v) ? v : undefined
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v.trim())
  return undefined
}

export const feedbackRoutes: RouteDef[] = [
  route('GET', '/api/feedback/status', [requireAuth()], (req, ctx) => {
    const month = monthKeyOf(ctx.clock.now())
    return ok({ month, answered: feedbackRepo.hasResponse(viewerOf(req).id, month) })
  }),

  route('POST', '/api/feedback', [requireAuth()], (req, ctx) => {
    const body =
      typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {}
    const fields: Record<string, string> = {}
    const nps = whole(body.nps)
    const satisfaction = whole(body.satisfaction)
    if (blank(body.nps)) fields.nps = FIELD_REQUIRED
    else if (nps === undefined || nps < 0 || nps > 10) fields.nps = FIELD_INVALID
    if (blank(body.satisfaction)) fields.satisfaction = FIELD_REQUIRED
    else if (satisfaction === undefined || satisfaction < 1 || satisfaction > 5) {
      fields.satisfaction = FIELD_INVALID
    }
    if (Object.keys(fields).length > 0) return validationError(fields)

    const viewer = viewerOf(req)
    try {
      return created(
        feedbackRepo.submit(
          { id: viewer.id, role: viewer.role, schoolId: viewer.schoolId },
          { nps: nps as number, satisfaction: satisfaction as number },
          ctx.clock.now(),
        ),
      )
    } catch (error) {
      return refusal(error)
    }
  }),
]
