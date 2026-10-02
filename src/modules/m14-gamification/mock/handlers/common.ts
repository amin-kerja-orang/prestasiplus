/**
 * Helpers shared by the M14 handlers (SRS M14 v1.8 §7, §9): the guards, the refusal mapping, the
 * body readers and the shared copy.
 *
 * Guards (SRS §7): **S** = any logged-in user (guest 401); **T** = role `teacher` or `admin`;
 * **AD** = role `admin` (other roles 403 `FORBIDDEN`, BR-M14-01). Messages that the SRS marks
 * PROPOSED COPY (§8.2) live in `MSG`.
 */

import {
  abort,
  conflict,
  forbidden,
  notFound,
  requireAuth,
  requireRole,
  validationError,
  type MockRequest,
  type MockResponse,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { M14Error } from '../repository/errors'

/** SRS §7 `S`: any logged-in user. */
export const anySession = requireAuth()
/** SRS §7 `T`: teacher or admin. */
export const teacherOnly = requireRole('teacher', 'admin')
/** SRS §7 `AD`: admin. */
export const adminOnly = requireRole('admin')

/** The signed-in user of a guarded route. */
export function viewerId(req: MockRequest): number {
  if (!req.session) throw new Error('a guard must run before this handler')
  return req.session.userId
}

/** PROPOSED COPY (SRS M14 §8.2) and the generic validation text (SRS.md §7.3 example). */
export const MSG = {
  required: 'Medan ini diperlukan.',
  invalid: 'Medan ini tidak sah.',
  summary: 'Sila lengkapkan semua medan wajib.',
  amountInvalid: 'Jumlah syiling tidak sah.',
  userNotFound: 'Pengguna tidak dijumpai.',
  tierExists: 'Nama tier sudah wujud.',
  poolInvalid: 'Format JSON kolam hadiah tidak sah.',
  imageType: 'Gambar mesti berjenis imej.',
} as const

/**
 * Maps a refusal of an M14 repository write to its §7 response: `VALIDATION_ERROR` 422 (the
 * message under `field` when given), `NOT_FOUND` 404, `CASH_DISABLED` 403, the rest 409
 * (`INSUFFICIENT_BALANCE`, `OUT_OF_STOCK`, `LIMIT_REACHED`, `DRAW_CLOSED`, `TICKET_LIMIT`).
 */
export function refusal(e: M14Error, field?: string): MockResponse {
  switch (e.code) {
    case 'VALIDATION_ERROR':
      return validationError(field ? { [field]: e.message } : {}, e.message)
    case 'NOT_FOUND':
      return notFound(e.message)
    case 'CASH_DISABLED':
      return forbidden(e.message, 'CASH_DISABLED')
    default:
      return conflict(e.message, e.code)
  }
}

/**
 * Runs `fn`; an `M14Error` becomes a thrown `MockHttpError`, so the server rolls back the whole
 * request transaction (BR-M14-30: a refused write changes nothing, even inside a bigger step).
 */
export function guarded<T>(fn: () => T, field?: string): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof M14Error) abort(refusal(e, field))
    throw e
  }
}

/** The display name of a user ('' when unknown). */
export const nameOf = (userId: number): string => users.get(userId)?.name ?? ''

/** Avatar initials (FN-M14-5.1.5): the first letter of the first two words. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return words
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase()
}

/** The single initial of S18 / S15 cards. */
export const initialOf = (name: string): string => [...name.trim()][0]?.toUpperCase() ?? ''

/** DV-M14-02: the share link points to the viewer's own profile. */
export const profileUrlOf = (userId: number): string =>
  `https://prestasiplus.my/pelajar/${String(userId)}`
