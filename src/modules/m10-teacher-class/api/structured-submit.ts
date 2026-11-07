/**
 * Teacher submission of a structured question (R1-GUR-44b, S6-T17; API-GUR-17 structured variant, ADD-13):
 * `POST /api/guru/intake/structured` (201), `PUT /api/guru/intake/structured/:id` (200, the full body) and
 * `DELETE /api/guru/intake/structured/:id` (200 `{removed: 1}`). A 409 means the admin already accepted the
 * item; its server message is shown as it is. The edit form preloads from `GET /api/guru/structured-questions/:id`
 * (API-GUR-26, an own submission carries `form`).
 *
 * The optional stimulus image is uploaded first (`POST /api/files?purpose=question_image`, jpg/png/webp
 * up to 2 MB) and its token goes in the body as `stimulusImageId`. Mock mode has no file store: a
 * `blob:mock/` reference stands in for the token (D22).
 */

import { api, isHttpMode, uploadQuestionImage } from '@/api'

import type { CognitiveLevel, StructuredSubmitBody } from '../lib/structured-form'

/** The submission as the create and update answer (`GuruStructuredDetail`; only what the form reads). */
export interface StructuredSubmission {
  id: string
  status: 'approved' | 'review' | 'rejected'
  editable: boolean
  totalMarks: number
}

/** The own submission as the edit form needs it (`GuruStructuredDetail` of API-GUR-26 with `form`). */
export interface StructuredSubmissionDetail extends StructuredSubmission {
  stimulus: string
  stimulusImage: string | null
  subQuestions: {
    partLabel: string
    questionText: string
    marks: number
    cognitiveLevel: CognitiveLevel | null
    modelAnswer: string
  }[]
  source: 'question' | 'submission'
  form: {
    subjectId: number | string
    educationLevelId: number | string
    chapterId: number | string | null
    spIds: (number | string)[]
    tp: number | null
    cognitiveLevel: CognitiveLevel | null
    difficultyLevel: number
    stimulusImageId: string | null
    rejectionReason: string | null
  } | null
}

export const STRUCTURED_SUBMIT_API = '/api/guru/intake/structured'
export const STRUCTURED_READ_API = '/api/guru/structured-questions'

/** The field key an image refusal is shown under (the form maps `stimulusImageId` to it as well). */
export const STIMULUS_IMAGE_FIELD = 'stimulusImage'

/** The token of the stimulus image: a real upload in http mode, a `blob:mock/` reference in mock mode. */
export async function uploadStimulusImage(file: File): Promise<string> {
  if (isHttpMode()) return uploadQuestionImage(file, STIMULUS_IMAGE_FIELD)
  return `blob:mock/${file.name}`.slice(0, 64)
}

/** `POST /api/guru/intake/structured`. */
export function createStructuredSubmission(
  body: StructuredSubmitBody,
): Promise<StructuredSubmission> {
  return api.post<StructuredSubmission>(STRUCTURED_SUBMIT_API, { body })
}

/** `PUT /api/guru/intake/structured/:id` (404 when not own, 409 when no longer editable, 422). */
export function updateStructuredSubmission(
  id: string,
  body: StructuredSubmitBody,
): Promise<StructuredSubmission> {
  return api.put<StructuredSubmission>(`${STRUCTURED_SUBMIT_API}/${encodeURIComponent(id)}`, {
    body,
  })
}

/** `DELETE /api/guru/intake/structured/:id` (404 when not own, 409 when no longer editable). */
export function deleteStructuredSubmission(id: string): Promise<{ removed: 1 }> {
  return api.delete<{ removed: 1 }>(`${STRUCTURED_SUBMIT_API}/${encodeURIComponent(id)}`)
}

/** `GET /api/guru/structured-questions/:id` for the edit screen (404 for another teacher's id). */
export function fetchStructuredSubmission(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<StructuredSubmissionDetail> {
  return api.get<StructuredSubmissionDetail>(
    `${STRUCTURED_READ_API}/${encodeURIComponent(id)}`,
    options.signal ? { signal: options.signal } : {},
  )
}
