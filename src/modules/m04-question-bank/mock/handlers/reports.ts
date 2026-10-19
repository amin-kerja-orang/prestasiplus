/**
 * M04 question reports (SRS §7 #14–#17, BR-M04-11…16, FR-M04-69…82; build-plan M04-T6a/b/c).
 *
 * | # | Route | Notes |
 * |---|-------|-------|
 * | 14 | `GET /api/question-reports` | admin; `status` (default pending; `all`; unknown = empty list, `meta.activeTab` null); `meta.counts` |
 * | 15 | `POST /api/question-reports` | any logged-in user; 201 `{success, message}`; `reports.create` (report + deactivation in one transaction) |
 * | 16 | `PATCH /api/question-reports/:id` | admin; `{status, adminNotes?, reactivate?, forceDeactivate?}`; 404, 422 |
 * | 17 | `GET /api/question-reports/mine` | the caller's reports; the question block carries no text or answers |
 *
 * INFERRED: the 422 messages, the flash copy "Laporan berjaya dikemaskini." (SRS §8 UNVERIFIED), the
 * 404 for a report on an unknown question, a default `source` per variant, a 1,000-character cap on
 * `adminNotes`, and that #17 hides the question content from the student.
 */

import {
  int,
  notFound,
  ok,
  queryString,
  raw,
  requireAuth,
  route,
  unpaged,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type { ReportCounts, ReportQuestionView, ReportView, ReportSource } from '../../api/reports'
import {
  REPORT_COMMENT_MAX,
  REPORT_FILTERS,
  REPORT_NOTES_MAX,
  reasonLabel,
  reportCategory,
  type ReportDisplayStatus,
  type ReportStatus,
} from '../../lib/report-reasons'
import { reportsRepo } from '../repository/reports'
import { questionsRepo } from '../repository/questions'
import {
  MCQ_REASONS,
  REPORT_SOURCES,
  REPORT_SUCCESS_MESSAGE,
  STRUCTURED_REASONS,
} from '../repository/rules'
import { structuredRepo } from '../repository/structured'
import type { QuestionReport, ReportQuestionType } from '../repository/types'
import { adminOnly, bodyOf, nameLookup } from './workflow-common'

export const REPORT_UPDATED_TEXT = 'Laporan berjaya dikemaskini.'
export const REPORT_REASONS_MESSAGE = 'Sila pilih sekurang-kurangnya satu sebab laporan.'
export const REPORT_REASON_INVALID_MESSAGE = 'Sebab laporan tidak sah.'
export const REPORT_SOURCE_MESSAGE = 'Sumber laporan tidak sah.'
export const REPORT_TYPE_MESSAGE = 'Jenis soalan tidak sah.'
export const REPORT_QUESTION_MESSAGE = 'Sila pilih soalan.'
export const REPORT_REF_MESSAGE = 'Rujukan sesi atau bilik tidak sah.'
export const REPORT_REF_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/
export const REPORT_COMMENT_MESSAGE = 'Komen tidak boleh melebihi 500 aksara.'
export const REPORT_STATUS_MESSAGE = 'Status tidak sah.'
export const REPORT_NOTES_MESSAGE = 'Nota admin tidak boleh melebihi 1000 aksara.'

const UPDATE_STATUSES = ['fixed', 'dismissed', 'reviewed'] as const

function countsOf(rows: readonly QuestionReport[]): ReportCounts {
  const c: ReportCounts = { pending: 0, reviewed: 0, fixed: 0, dismissed: 0, all: rows.length }
  for (const r of rows) c[r.status] += 1
  return c
}

/** The question block of a report (FN-M04-3.2.10); `full` = S7, otherwise only existence (S13). */
function questionView(r: QuestionReport, full: boolean): ReportQuestionView {
  const base = { type: r.questionType, id: r.questionId }
  if (r.questionType === 'structured') {
    const q = structuredRepo.get(r.questionId)
    if (!q) return { exists: false, ...base }
    if (!full) return { exists: true, ...base }
    const names = nameLookup()
    return {
      exists: true,
      ...base,
      text: q.stimulus,
      subjectName: names.subject(q.subjectId)?.name ?? null,
      levelName: names.level(q.educationLevelId)?.name ?? null,
      complianceStatus: q.complianceStatus,
      isActive: q.isActive,
      practiceUrl: `/latihan-berstruktur/${String(q.id)}/jawab?scope=spm`,
    }
  }
  const q = questionsRepo.get(r.questionId)
  if (!q) return { exists: false, ...base }
  if (!full) return { exists: true, ...base }
  const names = nameLookup()
  const code = q.subjectId === null ? undefined : curriculum.subject(q.subjectId)?.code
  return {
    exists: true,
    ...base,
    text: q.questionText,
    options: q.options ? [...q.options] : [],
    correctAnswer: q.correctAnswer,
    subjectName: names.subject(q.subjectId)?.name ?? null,
    levelName: names.level(q.educationLevelId)?.name ?? null,
    complianceStatus: q.complianceStatus,
    isActive: q.isActive,
    practiceUrl: code ? `/spm/latih-tubi/${code}/quiz?question_id=${String(q.id)}&count=1` : null,
  }
}

function activeOf(r: QuestionReport): boolean {
  if (r.questionType === 'structured') return structuredRepo.get(r.questionId)?.isActive ?? false
  return questionsRepo.get(r.questionId)?.isActive ?? false
}

/** BR-M04-14: `fixed` + the question exists + it is inactive reads "Dikeluarkan". */
function displayStatus(r: QuestionReport, exists: boolean): ReportDisplayStatus {
  return r.status === 'fixed' && exists && !activeOf(r) ? 'removed' : r.status
}

function toView(r: QuestionReport, full: boolean): ReportView {
  const question = questionView(r, full)
  return {
    id: r.id,
    questionType: r.questionType,
    questionId: r.questionId,
    reasons: [...r.reasons],
    reasonLabels: r.reasons.map((x) => reasonLabel(r.questionType, x)),
    category: reportCategory(r.reasons),
    comment: r.comment,
    source: r.source,
    quizSessionId: r.quizSessionId,
    roomCode: r.roomCode,
    sourceSet: r.sourceSet,
    status: r.status,
    displayStatus: displayStatus(r, question.exists),
    adminNotes: r.adminNotes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    question,
    reporter: { id: r.reporterId, name: users.get(r.reporterId)?.name ?? null },
  }
}

function list(req: MockRequest): MockResponse {
  const given = queryString(req.query, 'status')
  const filter = given === undefined || given === '' ? 'pending' : given
  const known = (REPORT_FILTERS as readonly string[]).includes(filter)
  const all = reportsRepo.list()
  const rows = !known ? [] : filter === 'all' ? all : all.filter((r) => r.status === filter)
  return unpaged(
    rows.map((r) => toView(r, true)),
    { activeTab: known ? filter : null, counts: countsOf(all) },
  )
}

function booleanFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function create(req: MockRequest, ctx: MockContext): MockResponse {
  const b = bodyOf(req)
  const fields: Record<string, string> = {}

  const type: ReportQuestionType = b.questionType === 'structured' ? 'structured' : 'mcq'
  if (b.questionType !== undefined && b.questionType !== 'mcq' && b.questionType !== 'structured') {
    fields.questionType = REPORT_TYPE_MESSAGE
  }

  const questionId = b.questionId
  const idOk = typeof questionId === 'number' && Number.isSafeInteger(questionId) && questionId > 0
  if (!idOk) fields.questionId = REPORT_QUESTION_MESSAGE

  const reasons = Array.isArray(b.reasons)
    ? b.reasons.filter((x): x is string => typeof x === 'string')
    : []
  const allowed: readonly string[] = type === 'mcq' ? MCQ_REASONS : STRUCTURED_REASONS
  if (reasons.length === 0) fields.reasons = REPORT_REASONS_MESSAGE
  else if (reasons.some((x) => !allowed.includes(x))) fields.reasons = REPORT_REASON_INVALID_MESSAGE

  const source = b.source === undefined ? (type === 'mcq' ? 'spm' : 'structured_attempt') : b.source
  if (typeof source !== 'string' || !(REPORT_SOURCES as readonly string[]).includes(source)) {
    fields.source = REPORT_SOURCE_MESSAGE
  }

  const comment = typeof b.comment === 'string' ? b.comment : null
  if (comment !== null && comment.length > REPORT_COMMENT_MAX) {
    fields.comment = REPORT_COMMENT_MESSAGE
  }

  for (const key of ['quizSessionId', 'roomCode'] as const) {
    const v = b[key]
    if (
      v !== undefined &&
      v !== null &&
      v !== '' &&
      (typeof v !== 'string' || !REPORT_REF_PATTERN.test(v))
    ) {
      fields[key] = REPORT_REF_MESSAGE
    }
  }

  if (Object.keys(fields).length > 0) return validationError(fields)

  const id = questionId as number
  const exists = type === 'mcq' ? questionsRepo.exists(id) : structuredRepo.get(id) !== null
  if (!exists) return notFound()

  const quizSessionId = typeof b.quizSessionId === 'string' ? b.quizSessionId : null
  const roomCode = typeof b.roomCode === 'string' && b.roomCode !== '' ? b.roomCode : null
  const result = reportsRepo.create(
    {
      questionId: id,
      questionType: type,
      reasons,
      comment: comment === null || comment.trim() === '' ? null : comment,
      source: source as ReportSource,
      quizSessionId,
      roomCode,
    },
    req.session?.userId ?? 0,
    ctx.clock.now(),
  )
  return raw(201, { success: true, message: result.message ?? REPORT_SUCCESS_MESSAGE })
}

function update(req: MockRequest, ctx: MockContext): MockResponse {
  const id = req.params.id as number
  if (!reportsRepo.get(id)) return notFound()
  const b = bodyOf(req)
  const fields: Record<string, string> = {}
  const status = typeof b.status === 'string' ? b.status.trim() : ''
  if (!(UPDATE_STATUSES as readonly string[]).includes(status))
    fields.status = REPORT_STATUS_MESSAGE
  let adminNotes: string | null | undefined
  if (b.adminNotes !== undefined && b.adminNotes !== null) {
    if (typeof b.adminNotes !== 'string' || b.adminNotes.length > REPORT_NOTES_MAX) {
      fields.adminNotes = REPORT_NOTES_MESSAGE
    } else adminNotes = b.adminNotes.trim() === '' ? null : b.adminNotes
  } else if (b.adminNotes === null) adminNotes = null
  if (Object.keys(fields).length > 0) return validationError(fields)

  const row = reportsRepo.update(
    id,
    {
      status: status as Exclude<ReportStatus, 'pending'>,
      ...(adminNotes !== undefined ? { adminNotes } : {}),
      reactivate: booleanFlag(b.reactivate),
      forceDeactivate: booleanFlag(b.forceDeactivate),
    },
    ctx.clock.now(),
  )
  if (!row) return notFound()
  return ok(
    { id: row.id, status: row.status, adminNotes: row.adminNotes, updatedAt: row.updatedAt },
    { status: REPORT_UPDATED_TEXT },
  )
}

function mine(req: MockRequest): MockResponse {
  const rows = reportsRepo.mine(req.session?.userId ?? 0)
  return unpaged(
    rows.map((r) => toView(r, false)),
    { counts: countsOf(rows) },
  )
}

export const reportRoutes: RouteDef[] = [
  route('GET', '/api/question-reports', [adminOnly], (req) => list(req)),
  route('POST', '/api/question-reports', [requireAuth()], (req, ctx) => create(req, ctx)),
  route('GET', '/api/question-reports/mine', [requireAuth()], (req) => mine(req)),
  route('PATCH', '/api/question-reports/:id', [adminOnly], (req, ctx) => update(req, ctx), {
    params: { id: int() },
  }),
]
