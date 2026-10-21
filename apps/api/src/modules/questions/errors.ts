import { QUESTION_WORKFLOW_STATUS_LABELS, type QuestionStatus } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/** 404 for any question the caller may not know about (missing, not theirs, not published): no oracle. */
export const questionNotFound = (): ApiError => ApiError.of('NOT_FOUND')

/**
 * 409 CONFLICT for a (from, to) pair outside `QUESTION_WORKFLOW_TRANSITIONS`. BE-09 owns the BM copy;
 * BE-10 reuses this function so the message is identical on every path.
 */
export const TRANSITION_CONFLICT_MESSAGE = (from: QuestionStatus, to: QuestionStatus): string =>
  `Perubahan status daripada ${QUESTION_WORKFLOW_STATUS_LABELS[from]} kepada ${QUESTION_WORKFLOW_STATUS_LABELS[to]} tidak dibenarkan.`

export const transitionConflict = (from: QuestionStatus, to: QuestionStatus): ApiError =>
  ApiError.of('CONFLICT', { message: TRANSITION_CONFLICT_MESSAGE(from, to), details: { from, to } })

/** 422 on the publish tag rule (D9): `fields` keys subjectId, educationLevelId, unitId, spIds, tp. */
export const PUBLISH_TAG_MESSAGES = {
  subjectId: 'Sila pilih subjek.',
  educationLevelId: 'Sila pilih tahap pendidikan.',
  unitId: 'Sila pilih unit DSKP.',
  spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.',
  tp: 'Sila pilih tahap penguasaan (TP).',
} as const

/** BM copy of a skipped id in `POST /questions/bulk-action` when the question does not exist. */
export const QUESTION_NOT_FOUND_MESSAGE = 'Soalan tidak dijumpai.'

/** One question the bulk action did not apply, with the text the admin sees for it. */
export interface BulkFailure {
  id: string
  code: string
  message: string
  fields: Record<string, string>
}

/** Maps a per-id error of the bulk action to its `failed` entry; `null` means the error is not a skip (re-throw it). */
export const bulkFailureOf = (id: string, e: unknown): BulkFailure | null => {
  if (!(e instanceof ApiError)) return null
  if (e.code === 'NOT_FOUND') return { id, code: 'NOT_FOUND', message: QUESTION_NOT_FOUND_MESSAGE, fields: {} }
  if (e.code === 'CONFLICT') return { id, code: 'CONFLICT', message: e.message, fields: {} }
  if (e.code === 'VALIDATION_ERROR') {
    const fields = e.fields ?? {}
    const distinct = [...new Set(Object.values(fields))]
    return { id, code: 'VALIDATION_ERROR', message: distinct.length > 0 ? distinct.join(' ') : e.message, fields }
  }
  return null
}
