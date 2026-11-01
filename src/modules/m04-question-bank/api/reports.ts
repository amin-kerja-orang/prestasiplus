/**
 * M04 question-report endpoints (SRS §7 #14–#17; build-plan M04-T6a/b/c): S7 admin triage (#14, #16),
 * the S14 modal's create (#15) and S13 "my reports" (#17). UI tasks read this file and do not change
 * it (build-plan §S.3 rule 5).
 *
 * #15 resolves to the live-shaped `{success, message}`; #16 to `{data, status}` (`status` = the flash
 * text). An unknown report id rejects with a 404 `ApiError`; #15 rejects 422 (`fields`) for a bad
 * reason / source / comment and 404 for an unknown question.
 */

import { api, type ListResult } from '@/api'

import type {
  ReportCategory,
  ReportDisplayStatus,
  ReportFilter,
  ReportStatus,
} from '../lib/report-reasons'

export type { ReportCategory, ReportDisplayStatus, ReportFilter, ReportStatus }

export type ReportQuestionType = 'mcq' | 'structured'
export type ReportSource =
  | 'spm'
  | 'structured_attempt'
  | 'latihan'
  | 'revision'
  | 'teacher_databank'
  | 'quiz'
  | 'papan_bijak'

/** The question a report points to. S13 gets only `exists`, `type` and `id` (no answers, no text). */
export interface ReportQuestionView {
  exists: boolean
  type: ReportQuestionType
  id: number
  /** MCQ text, or the structured stimulus. */
  text?: string
  options?: string[]
  correctAnswer?: number | null
  subjectName?: string | null
  levelName?: string | null
  complianceStatus?: string
  isActive?: boolean
  /** Lifecycle status when the server sends it (request to team A); `archived` hides "Arkib". */
  status?: string
  /** "Buka Soalan Sama" (FN-M04-3.2.17); `null` when the question is gone or the subject has no code. */
  practiceUrl?: string | null
}

/** #14 / #17 row: the report plus the derived display fields. */
export interface ReportView {
  id: number
  questionType: ReportQuestionType
  questionId: number
  reasons: string[]
  reasonLabels: string[]
  category: ReportCategory
  comment: string | null
  source: ReportSource
  quizSessionId: string | null
  roomCode: string | null
  sourceSet: string | null
  status: ReportStatus
  displayStatus: ReportDisplayStatus
  adminNotes: string | null
  createdAt: string
  updatedAt: string
  question: ReportQuestionView
  reporter: { id: number; name: string | null }
}

export interface ReportCounts extends Record<string, number> {
  pending: number
  reviewed: number
  fixed: number
  dismissed: number
  all: number
}

/** #14 meta: `activeTab` is `null` for an unknown `status`. */
export interface ReportListMeta {
  activeTab: ReportFilter | null
  counts: ReportCounts
}

export interface MyReportListMeta {
  counts: ReportCounts
}

/** #15 body. */
export interface ReportInput {
  questionId: number
  questionType?: ReportQuestionType
  reasons: string[]
  comment?: string | null
  quizSessionId?: string | null
  source?: ReportSource
}

export interface ReportCreated {
  success: true
  message: string
}

/** #16 body. */
export interface ReportUpdateInput {
  status: Exclude<ReportStatus, 'pending'>
  adminNotes?: string | null
  reactivate?: boolean
  forceDeactivate?: boolean
  /** R1-B17 "Arkib": archive the question through the lifecycle (status archived), applied last. */
  archive?: boolean
}

export interface ReportUpdated {
  data: {
    id: number
    status: ReportStatus
    adminNotes: string | null
    updatedAt: string
    /** H-A13: after "Arkib", the published papers that place the question, and the BM warning about them. */
    warning?: string
    papers?: { id: string; title: string }[]
  }
  status: string
}

/** #14 `GET /api/question-reports?status=` (admin; newest first, not paged; unknown status = empty list). */
export function fetchQuestionReports(
  query: { status?: string | null; signal?: AbortSignal } = {},
): Promise<ListResult<ReportView, ReportListMeta>> {
  return api.list<ReportView, ReportListMeta>('/api/question-reports', {
    query: { status: query.status ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #15 `POST /api/question-reports` (any logged-in user). */
export function createQuestionReport(input: ReportInput): Promise<ReportCreated> {
  return api.post<ReportCreated>('/api/question-reports', { body: input, raw: true })
}

/** #16 `PATCH /api/question-reports/:id` (admin; 404, 422). */
export function updateQuestionReport(id: number, input: ReportUpdateInput): Promise<ReportUpdated> {
  return api.patch<ReportUpdated>(`/api/question-reports/${String(id)}`, {
    body: input,
    raw: true,
  })
}

/** #17 `GET /api/question-reports/mine` (the caller's reports, newest first). */
export function fetchMyReports(
  query: { signal?: AbortSignal } = {},
): Promise<ListResult<ReportView, MyReportListMeta>> {
  return api.list<ReportView, MyReportListMeta>('/api/question-reports/mine', {
    ...(query.signal ? { signal: query.signal } : {}),
  })
}
