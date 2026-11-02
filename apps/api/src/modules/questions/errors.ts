import { QUESTION_MESSAGES, QUESTION_WORKFLOW_STATUS_LABELS, type QuestionBulkFailure, type QuestionBulkSkipped, type QuestionStatus } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/** 404 for any question the caller may not know about (missing, not theirs, not published): no oracle. */
export const questionNotFound = (): ApiError => ApiError.of('NOT_FOUND')

/**
 * 409 CONFLICT for a (from, to) pair outside `QUESTION_WORKFLOW_TRANSITIONS`. V2 wording (Studio flash, A03; discovery section 3.1):
 * "Peralihan '{from}' -> '{to}' tidak dibenarkan." with the BM status labels (Draf, Semakan, Diterbitkan, Diarkib). BE-09 owns the copy;
 * BE-10 reuses this function so the message is identical on every path.
 */
export const TRANSITION_CONFLICT_MESSAGE = (from: QuestionStatus, to: QuestionStatus): string =>
  `Peralihan '${QUESTION_WORKFLOW_STATUS_LABELS[from]}' -> '${QUESTION_WORKFLOW_STATUS_LABELS[to]}' tidak dibenarkan.`

/**
 * Signal (not an HTTP error) from `setStatus` under `skipIfAlready`: the question is already in the target status. The bulk action turns it
 * into the `skipped[]` no-op entry of R1E2E-10; nothing was written (the transaction is rolled back).
 */
export class AlreadyInStatusError extends Error {
  constructor(readonly status: QuestionStatus) {
    super(`already ${status}`)
  }
}

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

/** BM copy of a skipped id in `POST /questions/bulk-action` when the question does not exist (contract copy). */
export const QUESTION_NOT_FOUND_MESSAGE = QUESTION_MESSAGES.notFound

/** One question the bulk action did not apply, with the text the admin sees for it (contract `QuestionBulkFailure`). */
export type BulkFailure = QuestionBulkFailure

/** One row a bulk Terbitkan left as it was because it is already Diterbitkan (contract `QuestionBulkSkipped`). */
export type BulkSkipped = QuestionBulkSkipped
export const alreadyApprovedSkip = (id: string): BulkSkipped => ({ id, reason: QUESTION_MESSAGES.bulkAlreadyApproved })

/** The `failed` entry of an id that does not exist. */
export const notFoundFailure = (id: string): BulkFailure => ({ id, code: 'NOT_FOUND', message: QUESTION_NOT_FOUND_MESSAGE, fields: {} })


/** Maps a per-id error of the bulk action to its `failed` entry; `null` means the error is not a skip (re-throw it). */
export const bulkFailureOf = (id: string, e: unknown): BulkFailure | null => {
  if (!(e instanceof ApiError)) return null
  if (e.code === 'NOT_FOUND') return notFoundFailure(id)
  if (e.code === 'CONFLICT') return { id, code: 'CONFLICT', message: e.message, fields: {} }
  if (e.code === 'VALIDATION_ERROR') {
    const fields = e.fields ?? {}
    const distinct = [...new Set(Object.values(fields))]
    return { id, code: 'VALIDATION_ERROR', message: distinct.length > 0 ? distinct.join(' ') : e.message, fields }
  }
  return null
}
