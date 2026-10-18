/**
 * M04-T1: objective-question handlers (SRS v1.16 §7 #1–#8). All admin-only (`requireRole('admin')`:
 * a guest gets `401`, any other role `403`).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 1 | `GET /api/questions` | 20 per page, newest first (BR-M04-31), PKSK rows never included |
 * | 2 | `GET /api/questions/summary` | `total` = Q-ALL, one tile per M03 subject (Q-ALL, Q-APPROVED) |
 * | 3 | `POST /api/questions` | multipart or JSON; 201 `{data, status}`; 422 with `fields` |
 * | 4 | `GET /api/questions/:id` | PKSK rows included; 404 |
 * | 5 | `PUT /api/questions/:id` | 200 `{data, status}`; 404 (also a PKSK row); 422 |
 * | 6 | `DELETE /api/questions/:id` | permanent; 200 `{data: {deleted}, status}`; 404 (also a PKSK row) |
 * | 7 | `POST /api/questions/bulk-action` | `{data: {affected}, status}`; 422 |
 * | 8 | `POST /api/questions/:id/ai-explanation` | live-shaped `{ok, message}` (`ai-explanation.ts`) |
 *
 * Module-wide rules for the admin screens: an unknown id answers `404`; validation errors come in one
 * `422` (`fields` + a summary `message`); flashes are the API `status` only. INFERRED (SRS §7 says
 * `204` for #6): #6 answers 200 with `status`, so the screen shows the flash text from the API like
 * every other mutation. The handlers only shape requests and responses; the rules live in the
 * repository (`questions`) and `question-input.ts`.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import {
  created,
  int,
  notFound,
  ok,
  pageParams,
  paged,
  queryString,
  raw,
  requireRole,
  route,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import type { BulkAction as ApiBulkAction, QuestionSummary } from '../../api/questions'
import { questionsRepo as questions, type BulkAction } from '../repository/questions'
import type { AdminListFilter } from '../repository/rules'
import {
  AI_DEFAULT_LATENCY_MS,
  AI_FAIL_KEY,
  AI_HTML_BODY,
  AI_LATENCY_KEY,
  AI_MESSAGE_FAILED,
  AI_MESSAGE_KEPT,
  AI_MESSAGE_OK,
  cannedExplanation,
  variantOf,
} from './ai-explanation'
import { parseQuestionBody } from './question-input'
import { dskpStore } from './dskp-source'
import { nameMaps, tileIcon, toDetail, toQuestion, toRow } from './question-shape'

export const QUESTIONS_PAGE_SIZE = 20

/** UNVERIFIED COPY (§8). */
export const QUESTION_ADDED = 'Soalan berjaya ditambah.'
export const QUESTION_UPDATED = 'Soalan berjaya dikemaskini.'
export const QUESTION_DELETED = 'Soalan berjaya dipadam.'
export const bulkUpdated = (n: number): string => `${String(n)} soalan berjaya dikemaskini.`
/** The live script alert text, reused as the server message for a missing action. */
export const BULK_NO_ACTION = 'Sila pilih tindakan terlebih dahulu.'
/** INFERRED copy. */
export const BULK_NO_IDS = 'Sila pilih sekurang-kurangnya satu soalan.'
export const BULK_BAD_ACTION = 'Tindakan tidak sah.'
export const BULK_BAD_IDS = 'Senarai soalan tidak sah.'

const BULK_ACTIONS: readonly ApiBulkAction[] = [
  'approve',
  'reject',
  'archive',
  'delete',
  'pending_review',
]

const adminOnly = requireRole('admin')

function idOf(req: MockRequest): number {
  return req.params.id as number
}

/** `undefined` = no filter (absent or empty), `'invalid'` = a value that matches nothing. */
function idFilter(req: MockRequest, key: string): number | undefined | 'invalid' {
  const value = queryString(req.query, key)?.trim()
  if (value === undefined || value === '') return undefined
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : 'invalid'
}

function textFilter(req: MockRequest, key: string): string | undefined {
  const value = queryString(req.query, key)?.trim()
  return value === undefined || value === '' ? undefined : value
}

/** #1: filters BR-M04-04…07. Unknown parameters are ignored; unknown values match nothing. */
function list(req: MockRequest): MockResponse {
  const pageReq = pageParams(req.query, { pageSize: QUESTIONS_PAGE_SIZE, maxPageSize: 100 })
  const subjectId = idFilter(req, 'subjectId')
  const educationLevelId = idFilter(req, 'educationLevelId')
  const difficultyLevel = idFilter(req, 'difficultyLevel')
  if (subjectId === 'invalid' || educationLevelId === 'invalid' || difficultyLevel === 'invalid') {
    return paged({ rows: [], total: 0 }, pageReq)
  }
  const status = textFilter(req, 'status')
  const dskpFilter = textFilter(req, 'dskpFilter')
  const complianceFilter = textFilter(req, 'complianceFilter')
  const sourceFilter = textFilter(req, 'sourceFilter')
  const search = textFilter(req, 'search')
  const filter: AdminListFilter & { page: number; pageSize: number } = {
    ...(subjectId === undefined ? {} : { subjectId }),
    ...(educationLevelId === undefined ? {} : { educationLevelId }),
    ...(difficultyLevel === undefined ? {} : { difficultyLevel }),
    ...(status === undefined ? {} : { status }),
    ...(dskpFilter === undefined ? {} : { dskpFilter }),
    ...(complianceFilter === undefined ? {} : { complianceFilter }),
    ...(sourceFilter === undefined ? {} : { sourceFilter }),
    ...(search === undefined ? {} : { search }),
    page: pageReq.page,
    pageSize: pageReq.pageSize,
  }
  const result = questions.adminList(filter)
  const names = nameMaps()
  return paged({ rows: result.rows.map((q) => toRow(q, names)), total: result.total }, pageReq)
}

/** #2: the S1 "Jumlah" and the tiles (M03 subjects in id order; Q-ALL and Q-APPROVED per subject). */
function summary(): MockResponse {
  const subjects = curriculum
    .subjects({ active: true })
    .sort((a, b) => a.id - b.id)
    .map((s) => ({
      id: s.id,
      name: s.name,
      icon: tileIcon(s.id),
      group: s.isCore ? ('teras' as const) : ('elektif' as const),
      total: questions.count('Q-ALL', s.id),
      approved: questions.count('Q-APPROVED', s.id),
    }))
  const data: QuestionSummary = { total: questions.count('Q-ALL'), subjects }
  return ok(data)
}

async function detail(req: MockRequest): Promise<MockResponse> {
  const row = questions.get(idOf(req))
  if (!row) return notFound()
  return ok(toDetail(row, nameMaps(), await dskpStore()))
}

async function create(req: MockRequest, ctx: MockContext): Promise<MockResponse> {
  const parsed = parseQuestionBody(req.body, null, await dskpStore())
  if (!parsed.ok) return validationError(parsed.fields)
  const row = ctx.transaction(() =>
    questions.create(parsed.input, { createdBy: req.session?.userId ?? 0, now: ctx.clock.now() }),
  )
  return created(toQuestion(row), { status: QUESTION_ADDED })
}

async function update(req: MockRequest, ctx: MockContext): Promise<MockResponse> {
  const id = idOf(req)
  const current = questions.get(id)
  // PKSK rows belong to M07 (BR-M04-33): not editable here.
  if (!current || current.pkskDomainId !== null) return notFound()
  const parsed = parseQuestionBody(req.body, current, await dskpStore())
  if (!parsed.ok) return validationError(parsed.fields)
  const row = ctx.transaction(() => questions.update(id, parsed.input, ctx.clock.now()))
  return ok(toQuestion(row), { status: QUESTION_UPDATED })
}

function remove(req: MockRequest): MockResponse {
  const id = idOf(req)
  const current = questions.get(id)
  if (!current || current.pkskDomainId !== null) return notFound()
  questions.remove(id)
  return ok({ deleted: 1 }, { status: QUESTION_DELETED })
}

function bulk(req: MockRequest, ctx: MockContext): MockResponse {
  const body =
    typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {}
  const fields: Record<string, string> = {}
  const action = typeof body.action === 'string' ? body.action.trim() : ''
  if (action === '') fields.action = BULK_NO_ACTION
  else if (!(BULK_ACTIONS as readonly string[]).includes(action)) fields.action = BULK_BAD_ACTION
  let ids: number[] = []
  if (body.ids === undefined || (Array.isArray(body.ids) && body.ids.length === 0)) {
    fields.ids = BULK_NO_IDS
  } else if (
    !Array.isArray(body.ids) ||
    !body.ids.every((v) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0)
  ) {
    fields.ids = BULK_BAD_IDS
  } else {
    ids = body.ids as number[]
  }
  if (Object.keys(fields).length > 0) return validationError(fields)
  const affected = questions.bulkAction(action as BulkAction, ids, ctx.clock.now())
  return ok({ affected }, { status: bulkUpdated(affected) })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * #8: success HTTP 200 `{ok: true, message}`; the failure branches of FR-M04-46 are reachable through
 * `m04.aiFailNext` (see `ai-explanation.ts`) or the fault injector. Without `force=1` an existing
 * explanation is returned unchanged (BR-M04-24). An unknown id and a PKSK row answer the standard 404.
 */
async function aiExplanation(req: MockRequest, ctx: MockContext): Promise<MockResponse> {
  const id = idOf(req)
  const current = questions.get(id)
  if (!current || current.pkskDomainId !== null) return notFound()

  const wait = ctx.config.get<number>(AI_LATENCY_KEY, AI_DEFAULT_LATENCY_MS)
  if (wait > 0) await sleep(wait)

  const failure = ctx.config.get<string | undefined>(AI_FAIL_KEY)
  if (failure !== undefined) {
    ctx.config.set(AI_FAIL_KEY, undefined)
    if (failure === 'message') return raw(500, { ok: false, message: AI_MESSAGE_FAILED })
    if (failure === 'no-message') return raw(500, { ok: false })
    if (failure === 'ok-false') return raw(200, { ok: false })
    if (failure === 'non-json') return raw(500, AI_HTML_BODY, { 'content-type': 'text/html' })
  }

  const force = queryString(req.query, 'force') === '1'
  // Read again after the wait: another request may have stored one meanwhile.
  const latest = questions.get(id) ?? current
  if (latest.aiExplanation !== null && !force) {
    return raw(200, { ok: true, message: AI_MESSAGE_KEPT })
  }
  const previous = latest.aiExplanation ? variantOf(latest.aiExplanation.markdown) : -2
  const variant = previous >= 0 ? previous + 1 : id % 3
  ctx.transaction(() =>
    questions.setAiExplanation(id, cannedExplanation(latest, variant), ctx.clock.now()),
  )
  return raw(200, { ok: true, message: AI_MESSAGE_OK })
}

export const questionRoutes: RouteDef[] = [
  route('GET', '/api/questions', [adminOnly], list),
  // Static segments first: `summary` and `bulk-action` are not ids.
  route('GET', '/api/questions/summary', [adminOnly], summary),
  route('POST', '/api/questions/bulk-action', [adminOnly], bulk),
  route('POST', '/api/questions', [adminOnly], create),
  route('GET', '/api/questions/:id', [adminOnly], detail, { params: { id: int() } }),
  route('PUT', '/api/questions/:id', [adminOnly], update, { params: { id: int() } }),
  route('DELETE', '/api/questions/:id', [adminOnly], remove, { params: { id: int() } }),
  route('POST', '/api/questions/:id/ai-explanation', [adminOnly], aiExplanation, {
    params: { id: int() },
  }),
]
