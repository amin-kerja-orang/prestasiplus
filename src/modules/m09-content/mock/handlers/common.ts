/**
 * Helpers shared by the M09-T1 reader handlers (SRS M09 v1.5 §7): the viewer of a request, the M09
 * error to response mapping, the M03 lookups and the flash texts (PROPOSED COPY, §8.2). Nothing here
 * writes.
 */

import {
  conflict,
  rule,
  forbidden,
  notFound,
  validationError,
  type MockRequest,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { M09Error } from '../repository'
import type { Viewer } from '../types'

/** The viewer of the request, or `null` for a guest (public endpoints). */
export function viewerOf(req: MockRequest): Viewer | null {
  if (!req.session) return null
  const { userId, role } = req.session
  return { id: userId, role, schoolId: users.get(userId)?.schoolId ?? null }
}

/** The viewer of a `requireAuth()` route. */
export function requireViewer(req: MockRequest): Viewer {
  const viewer = viewerOf(req)
  if (!viewer) throw new Error('requireAuth() must run first')
  return viewer
}

/** `{id, name}` of an M03 subject, or `null`. */
export function subjectRef(id: number | null): { id: number; name: string } | null {
  if (id === null) return null
  const s = curriculum.subject(id)
  return s ? { id: s.id, name: s.name } : null
}

/** `{id, name}` of an M03 education level, or `null`. */
export function levelRef(id: number): { id: number; name: string } | null {
  const l = curriculum.level(id)
  // Secondary-only (D72): a hidden Darjah level has no reference (its audio sets are not listed).
  return l && !curriculum.isLevelHidden(id) ? { id: l.id, name: l.name } : null
}

/** Flash texts of the mutating endpoints (PROPOSED COPY, SRS M09 §8.2). */
export const FLASH = {
  videoCreated: 'Video berjaya diterbitkan.',
  videoUpdated: 'Video berjaya dikemaskini.',
  videoDeleted: 'Video berjaya dipadam.',
  perutusanSent: 'Perutusan berjaya dihantar.',
  perutusanScheduled: 'Perutusan dijadualkan.',
  perutusanDraft: 'Draf perutusan disimpan.',
  commentSent: 'Komen anda telah dihantar dan akan disemak.',
} as const

/** Placeholder field error (SRS §8.2 "Server field errors"). */
export const FIELD_REQUIRED = 'Medan ini diperlukan.'

/** INFERRED generic placeholder for every other failed server rule (live copy not observed). */
export const FIELD_INVALID = 'Medan ini tidak sah.'

/**
 * Answers a refused M09 write: `NOT_FOUND` 404, `FORBIDDEN` 403, `VALIDATION_ERROR` 422 with the
 * message under `field`. Anything else is rethrown (a bug, not a refusal).
 */
export function refusal(error: unknown, field = 'form') {
  if (!(error instanceof M09Error)) throw error
  switch (error.code) {
    case 'NOT_FOUND':
      return notFound(error.message)
    case 'FORBIDDEN':
      return forbidden(error.message)
    case 'VALIDATION_ERROR':
      return validationError({ [error.field ?? field]: error.message }, error.message)
    default:
      return conflict(error.message)
  }
}

/** A query value as an integer id, or `undefined`. */
export function intOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value.trim())) return undefined
  const n = Number(value.trim())
  return Number.isSafeInteger(n) ? n : undefined
}

/** A string value (a malformed JSON body must answer 422, never crash a handler). */
export const isString = () => rule('string', (v) => (typeof v === 'string' ? null : FIELD_INVALID))
