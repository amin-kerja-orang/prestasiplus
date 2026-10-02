/**
 * M13 routes (SRS M13 v1.1 §7 #1–#10; #11 is M10's `GET /api/guru/classes`, #12 is M03's
 * `GET /api/subjects`). Guards: **S** = any logged-in user, **T** = `teacher` or `admin`
 * (guest 401, other roles 403, BR-M13-02). Records are returned to their owner only; a foreign or
 * unknown id is a plain 404 (FR-M13-48, SEC-M13-07).
 *
 * #1 answers the live body untouched (SQ-M13-01): 200 `{thread_id, reply, tier, turns_remaining,
 * tool_hops, tokens}`, 422 `{}` (blank), 429 `{quota_exhausted: true}`, 401 `{}`. It waits
 * `m13.aiLatencyMs` (default 1,500, BR-M13-22; tests set 0 through `config.set`) as does #3.
 */

import {
  created,
  int,
  notFound,
  ok,
  pageParams,
  paged,
  raw,
  requireRole,
  route,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type Middleware,
  type RouteDef,
} from '@/mock/define'

import { AI_LATENCY_MS, PAGE_SIZE } from '../../api/settings'
import type { EssayListItem, PbdQueueItem, RphCreateRequest, RphListItem } from '../../api/types'
import { cikguRepo } from '../repository/cikgu'

/** `ctx.config` key of the AI latency (ms). */
export const AI_LATENCY_KEY = 'm13.aiLatencyMs'

const teacherOnly = requireRole('teacher', 'admin')

/** S guard for #1: a guest gets the live-shaped `401 {}`. */
const chatSession: Middleware = (req) => (req.session ? undefined : raw(401, {}))

const viewer = (req: MockRequest): { userId: number; role: string } => {
  if (!req.session) throw new Error('a guard must run before this handler')
  return { userId: req.session.userId, role: req.session.role }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function aiWait(ctx: MockContext): Promise<void> {
  const wait = ctx.config.get<number>(AI_LATENCY_KEY, AI_LATENCY_MS)
  if (wait > 0) await sleep(wait)
}

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

export const m13Routes: RouteDef[] = [
  // #1 POST /api/cikgu/send
  route('POST', '/api/cikgu/send', [chatSession], async (req, ctx): Promise<MockResponse> => {
    const { userId, role } = viewer(req)
    const body = asRecord(req.body)
    const message = body.message
    if (typeof message !== 'string' || message.trim() === '') return raw(422, {})
    const threadId = typeof body.thread_id === 'string' ? body.thread_id : null
    await aiWait(ctx)
    const out = cikguRepo.send({ userId, role, message, threadId, now: ctx.clock.now() })
    if (out.kind === 'blank') return raw(422, {})
    if (out.kind === 'quota') return raw(429, { quota_exhausted: true })
    return raw(200, out.body)
  }),

  // #2 GET /api/cikgu/rph
  route('GET', '/api/cikgu/rph', [teacherOnly], (req) => {
    const page = pageParams(req.query, { pageSize: PAGE_SIZE })
    const r = cikguRepo.rphList(viewer(req).userId, page.page)
    const rows: RphListItem[] = r.rows.map((x) => ({
      id: x.id,
      lessonDate: x.lessonDate,
      subjectName: x.subjectName,
      level: x.level,
      tajuk: x.tajuk,
      status: x.status,
    }))
    return paged({ rows, total: r.total }, page)
  }),

  // #3 POST /api/cikgu/rph
  route('POST', '/api/cikgu/rph', [teacherOnly], async (req, ctx): Promise<MockResponse> => {
    const body = asRecord(req.body) as unknown as RphCreateRequest
    await aiWait(ctx)
    const res = cikguRepo.rphCreate(viewer(req).userId, body, ctx.clock.now())
    if (!res.ok) return validationError(res.fields)
    return created(res.rph)
  }),

  // #4 GET /api/cikgu/rph/:id
  route(
    'GET',
    '/api/cikgu/rph/:id',
    [teacherOnly],
    (req) => {
      const rph = cikguRepo.rphGet(viewer(req).userId, Number(req.params.id))
      return rph ? ok(rph) : notFound()
    },
    { params: { id: int() } },
  ),

  // #5 GET /api/cikgu/essays
  route('GET', '/api/cikgu/essays', [teacherOnly], (req) => {
    const page = pageParams(req.query, { pageSize: PAGE_SIZE })
    const r = cikguRepo.essayList(viewer(req).userId, page.page)
    const rows: EssayListItem[] = r.rows.map((e) => ({
      id: e.id,
      studentName: e.studentName,
      subjectName: e.subjectName,
      rubricKey: e.rubricKey,
      essayTitle: e.essayTitle,
      marks: e.marks,
      maxMarks: e.maxMarks,
      createdAt: e.createdAt,
    }))
    return paged({ rows, total: r.total }, page)
  }),

  // #6 GET /api/cikgu/essays/:id
  route(
    'GET',
    '/api/cikgu/essays/:id',
    [teacherOnly],
    (req) => {
      const e = cikguRepo.essayGet(viewer(req).userId, Number(req.params.id))
      return e ? ok(e) : notFound()
    },
    { params: { id: int() } },
  ),

  // #7 GET /api/cikgu/pbd
  route('GET', '/api/cikgu/pbd', [teacherOnly], (req) => {
    const page = pageParams(req.query, { pageSize: PAGE_SIZE })
    const r = cikguRepo.pbdQueue(viewer(req).userId, page.page)
    const rows: PbdQueueItem[] = r.rows.map((t) => ({
      id: t.id,
      studentId: t.studentId,
      studentName: t.studentName,
      classroomId: t.classroomId,
      sp: t.sp,
      skor: t.skor,
      tp: t.tp,
    }))
    return paged({ rows, total: r.total }, page)
  }),

  // #8 POST /api/cikgu/pbd/rollup
  route('POST', '/api/cikgu/pbd/rollup', [teacherOnly], (req, ctx) => {
    const raw_ = asRecord(req.body).classroomId
    const classroomId =
      typeof raw_ === 'number' && Number.isInteger(raw_)
        ? raw_
        : typeof raw_ === 'string' && /^\d+$/.test(raw_.trim())
          ? Number(raw_)
          : null
    const data = cikguRepo.rollup(viewer(req).userId, classroomId, ctx.clock.now())
    return ok(data)
  }),

  // #9 POST /api/cikgu/pbd/bulk-approve
  route('POST', '/api/cikgu/pbd/bulk-approve', [teacherOnly], (req, ctx) => {
    const ids = asRecord(req.body).ids
    const list = Array.isArray(ids)
      ? ids
          .map((v: unknown) => (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v))
          .filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
      : []
    const approved = cikguRepo.approve(viewer(req).userId, list, ctx.clock.now())
    return ok({ approved })
  }),

  // #10 GET /api/cikgu/pbd/export.csv
  route('GET', '/api/cikgu/pbd/export.csv', [teacherOnly], (req) => ({
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="pbd-approved.csv"',
    },
    body: new Blob([cikguRepo.exportCsv(viewer(req).userId)], { type: 'text/csv; charset=utf-8' }),
  })),
]
