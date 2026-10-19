/**
 * SRS M06 v1.4 §7 #12-#17: mock exams and the simulated walkthrough (D4, no external calls).
 * Only the owner opens a mock (BR-M06-26: others get 404). Answers are stored in the MockItem rows only
 * (§6.5): no M05 session, answer, queue, mastery or wallet write.
 */

import {
  conflict,
  created,
  notFound,
  ok,
  raw,
  requireAuth,
  route,
  validationError,
  int,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { toIsoMyt } from '@/lib/time'
import { defaultSleep } from '@/mock/latency'

import type { MockAnswerInput } from '../../api/types'
import {
  CANNED_WALKTHROUGH,
  MOCK_SUBJECTS,
  WALKTHROUGH_LATENCY_MS,
  WALKTHROUGH_SUBJECTS,
} from '../data/config'
import { spmRepo } from '../repository/spm'
import { userIdOf } from './spm'

const auth = requireAuth()
const ID = { params: { id: int() } }
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Test hook state (§6.11 `setWalkthroughLatency`); reset on every seed. */
let walkthroughLatencyMs = WALKTHROUGH_LATENCY_MS
export const setWalkthroughLatency = (ms: number): void => {
  if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`invalid latency ${String(ms)}`)
  walkthroughLatencyMs = ms
}
export const resetWalkthroughLatency = (): void => {
  walkthroughLatencyMs = WALKTHROUGH_LATENCY_MS
}

/** The caller's own mock, or a 404 response. */
function ownMock(req: MockRequest) {
  const m = spmRepo.mock(Number(req.params.id))
  return m && m.userId === userIdOf(req) ? m : null
}

function body(req: MockRequest): Record<string, unknown> {
  return typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {}
}

function parseAnswers(value: unknown, maxNo: number): MockAnswerInput[] | null {
  if (!Array.isArray(value)) return null
  const out: MockAnswerInput[] = []
  for (const a of value as unknown[]) {
    if (typeof a !== 'object' || a === null) return null
    const { no, answer } = a as { no?: unknown; answer?: unknown }
    if (typeof no !== 'number' || !Number.isInteger(no) || no < 1 || no > maxNo) return null
    if (answer !== undefined && answer !== null && typeof answer !== 'string') return null
    out.push({ no, answer: typeof answer === 'string' ? answer.slice(0, 5000) : '' })
  }
  return out
}

/** #17 (BR-M06-28). The live-shaped body `{ok, walkthrough|error}` is sent untouched. */
async function solve(req: MockRequest): Promise<MockResponse> {
  const b = body(req)
  const subject = typeof b.subject === 'string' ? b.subject : ''
  if (!WALKTHROUGH_SUBJECTS.includes(subject)) {
    return validationError({ subject: 'Sila pilih subjek.' })
  }
  const text = typeof b.question_text === 'string' ? b.question_text.trim() : ''
  const image = b.image
  const hasImage = image instanceof Blob && image.size > 0
  if (hasImage && (!image.type.startsWith('image/') || image.size > MAX_IMAGE_BYTES)) {
    return raw(200, { ok: false, error: 'Gambar tidak sah.' })
  }
  if (text === '' && !hasImage) {
    return raw(200, {
      ok: false,
      error: 'Sila masukkan soalan atau muat naik gambar soalan.',
    })
  }
  await defaultSleep(walkthroughLatencyMs)
  const first = text === '' ? '(gambar)' : text.slice(0, 80)
  const canned = CANNED_WALKTHROUGH[subject] ?? CANNED_WALKTHROUGH.default
  return raw(200, { ok: true, walkthrough: `Soalan: ${first}\n\n${canned}` })
}

export const mockRoutes: RouteDef[] = [
  route('GET', '/api/spm-mocks', [auth], (req) => ok(spmRepo.mocksOf(userIdOf(req)))),

  route('POST', '/api/spm-mocks', [auth], (req, ctx) => {
    const b = body(req)
    const subject = typeof b.subject === 'string' ? b.subject : ''
    if (!(subject in MOCK_SUBJECTS)) return validationError({ subject: 'Sila pilih subjek.' })
    const paper = b.paperNumber === undefined || b.paperNumber === null ? 1 : Number(b.paperNumber)
    if (paper !== 1 && paper !== 2) {
      return validationError({ paperNumber: 'Paper mesti 1 atau 2.' })
    }
    const row = spmRepo.createMock(
      userIdOf(req),
      subject,
      paper,
      toIsoMyt(ctx.clock.now()),
      ctx.prng.stream('m06.mock'),
    )
    return created({ id: row.id })
  }),

  route(
    'GET',
    '/api/spm-mocks/:id',
    [auth],
    (req) => {
      if (!ownMock(req)) return notFound()
      const view = spmRepo.mockView(Number(req.params.id))
      return view ? ok(view) : notFound()
    },
    ID,
  ),

  route(
    'POST',
    '/api/spm-mocks/:id/submit',
    [auth],
    (req, ctx) => {
      const m = ownMock(req)
      if (!m) return notFound()
      if (m.status === 'submitted') return conflict('Mock ini sudah dihantar.')
      const answers = parseAnswers(body(req).answers, m.items.length)
      if (answers === null) return validationError({ answers: 'Jawapan tidak sah.' })
      return ok(spmRepo.submitMock(m.id, answers, toIsoMyt(ctx.clock.now())))
    },
    ID,
  ),

  route(
    'GET',
    '/api/spm-mocks/:id/result',
    [auth],
    (req) => {
      const m = ownMock(req)
      if (!m) return notFound()
      if (m.status !== 'submitted') return conflict('Mock belum dihantar.', 'NOT_SUBMITTED')
      const r = spmRepo.mockResult(m.id)
      return r ? ok(r) : notFound()
    },
    ID,
  ),

  route('POST', '/api/spm-walkthrough/solve', [auth], solve),
]
