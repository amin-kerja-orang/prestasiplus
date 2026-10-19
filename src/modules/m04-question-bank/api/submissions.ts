/**
 * M04 question-paper endpoints (SRS §7 #20–#22; build-plan M04-T2): S10 "Kertas Soalan Guru" list,
 * status update and file download. Every call needs an admin session. UI tasks read this file and do
 * not change it (build-plan §S.3 rule 5).
 */

import { api, type BlobResult, type ListResult } from '@/api'

export type SubmissionStatus = 'pending' | 'processing' | 'done' | 'rejected'

export interface SubmissionFile {
  /** 0-based; the `:index` of #22. */
  index: number
  name: string
  size: number
  mime: string
}

/** DATA-M04-05 with the teacher (name, e-mail and school from M01 / M02). */
export interface QuestionSubmission {
  id: number
  teacherId: number
  subjectText: string
  levelCode: string | null
  year: number
  paperType: string
  authorCredit: string
  note: string | null
  files: SubmissionFile[]
  status: SubmissionStatus
  adminNotes: string | null
  createdAt: string
  teacher: { id: number; name: string | null; email: string | null; school: string | null }
}

/** `meta.counts` of #20: over every paper, whatever the filter. */
export interface SubmissionCounts extends Record<string, number> {
  all: number
  pending: number
  processing: number
  done: number
  rejected: number
}

export interface SubmissionListMeta {
  counts: SubmissionCounts
}

/** #21 body. `adminNotes` (≤ 1000) replaces the stored note when given (`''` clears it). */
export interface SubmissionStatusInput {
  status: SubmissionStatus
  adminNotes?: string | null
}

/** #21 result: the paper plus the flash text "Status kertas soalan berjaya dikemaskini.". */
export interface SubmissionMutation {
  data: QuestionSubmission
  status: string
}

/** #20 `GET /api/question-submissions`: id descending, not paged. An unknown status is an empty list. */
export function fetchQuestionSubmissions(
  query: { status?: string | null; signal?: AbortSignal } = {},
): Promise<ListResult<QuestionSubmission, SubmissionListMeta>> {
  return api.list<QuestionSubmission, SubmissionListMeta>('/api/question-submissions', {
    query: { status: query.status ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #21 `PATCH /api/question-submissions/:id/status` (404; 422 with `fields`). */
export function updateSubmissionStatus(
  id: number,
  input: SubmissionStatusInput,
): Promise<SubmissionMutation> {
  return api.patch<SubmissionMutation>(`/api/question-submissions/${String(id)}/status`, {
    body: input,
    raw: true,
  })
}

/** #22 `GET /api/question-submissions/:id/files/:index`: a placeholder text file with the file name. */
export function downloadSubmissionFile(id: number, index: number): Promise<BlobResult> {
  return api.blob(`/api/question-submissions/${String(id)}/files/${String(index)}`)
}
