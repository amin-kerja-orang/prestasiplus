/**
 * Helpers shared by the M16 handlers: the viewer, and the two error styles of SRS M16 v1.6 §7 — the
 * live JSON bodies of the 13 `/api/battle/*` endpoints (`{error}` strings, `{}` bodies, kept so the
 * page script reads them as on live) and the standard `{error: {code, message, fields?}}` envelope.
 */

import {
  conflict,
  forbidden,
  notFound,
  raw,
  validationError,
  type MockRequest,
  type MockResponse,
} from '@/mock/define'
import { users, type UserRow } from '@/modules/m01-authentication/mock'

import { M16Error } from '../repository'

/** The viewer of a `requireAuth()` route. */
export function viewerOf(req: MockRequest): UserRow {
  if (!req.session) throw new Error('requireAuth() must run first')
  const row = users.get(req.session.userId)
  if (!row) throw new Error(`M16: session user ${String(req.session.userId)} has no users row`)
  return row
}

/** Answers a refused write on a live-shaped battle endpoint (bodies as on live, §7 #2-#14). */
export function liveRefusal(error: unknown): MockResponse {
  if (!(error instanceof M16Error)) throw error
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return raw(422, { error: error.message })
    case 'FORBIDDEN':
      return raw(403, { error: error.message })
    case 'CONFLICT':
      return raw(409, { error: error.message })
    default:
      return raw(404, { error: error.message })
  }
}

/** The start endpoints (#2, #3): 422 and 403 have **empty** bodies `{}` (BR-M16-03; client fallback). */
export function startRefusal(error: unknown): MockResponse {
  if (!(error instanceof M16Error)) throw error
  if (error.code === 'VALIDATION_ERROR') return raw(422, {})
  if (error.code === 'FORBIDDEN') return raw(403, {})
  return liveRefusal(error)
}

/** Answers a refused write on an envelope endpoint: 404, 403, 409 and 422 with `fields`. */
export function refusal(error: unknown, field = 'form'): MockResponse {
  if (!(error instanceof M16Error)) throw error
  switch (error.code) {
    case 'NOT_FOUND':
      return notFound(error.message)
    case 'FORBIDDEN':
      return forbidden(error.message)
    case 'CONFLICT':
      return conflict(error.message)
    default:
      return validationError(
        error.fields ?? { [error.field ?? field]: error.message },
        error.message,
      )
  }
}
