// @vitest-environment node
import { fileURLToPath } from 'node:url'

import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  PKSK_SHARED_COMPONENT_SCHEMAS,
  PKSK_DOMAIN_CODES,
  PkskDomainSchema,
  PkskGradeSchema,
} from '../shared'
import {
  PKSK_STUDENT_MESSAGES,
  PkskAccessSchema,
  PkskAnswersRequestSchema,
  PkskDashboardSchema,
  PkskDomainSectionsSchema,
  PkskExamAttemptSchema,
  PkskExamSchema,
  PkskPracticeResultSchema,
  PkskPracticeSchema,
  pkskStudentFieldsOf,
} from '../student'
import { PKSK_STUDENT_COMPONENT_SCHEMAS, registerPkskStudentPaths } from '../student-paths'
import { ErrorBodySchema } from '../../common/error'
import { z } from '../../zod'

/**
 * The mock is loaded with a computed path so that `tsc -p packages/contract` (no `@/` alias) never
 * follows it; Vitest resolves it through the root Vite config. The payloads below are the output of
 * the real mock handlers, not hand-written fixtures.
 */
const root = fileURLToPath(new URL('../../../../../src/modules/m07-pksk/', import.meta.url))
const load = (rel: string): Promise<Record<string, unknown>> =>
  import(/* @vite-ignore */ `${root}${rel}`) as Promise<Record<string, unknown>>

interface Answer {
  status: number
  body: Record<string, unknown>
}
type Call = (method: string, url: string, userId: number | null, body?: unknown) => Promise<Answer>

let call: Call
let ids: { admin: number; pelajar: number; noAccess: number; maju: number; ibubapa: number }
let questionsStore: { pkskGet: (id: number) => { questionType: string; pkskOptions?: { isCorrect: boolean }[] } | undefined }

/** The mock sends numeric ids (UD-1: strings on the wire): stringify every `id` and `questionId`. */
function wire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(wire)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        (k === 'id' || k === 'questionId') && typeof v === 'number' ? String(v) : wire(v),
      ]),
    )
  }
  return value
}

beforeAll(async () => {
  const helpers = (await load('__tests__/mock/helpers.ts')) as {
    MemoryStorage: new () => unknown
    bootPksk: () => Promise<{ runtime: unknown }>
    call: (...args: unknown[]) => Promise<Answer>
    ADMIN: number
    PELAJAR: number
    PELAJAR2: number
    MAJU: number
    IBUBAPA: number
  }
  const m04 = (await import(
    /* @vite-ignore */ `${fileURLToPath(new URL('../../../../../src/modules/m04-question-bank/mock', import.meta.url))}`
  )) as { questions: typeof questionsStore }
  questionsStore = m04.questions
  vi.stubGlobal('localStorage', new helpers.MemoryStorage())
  const { runtime } = await helpers.bootPksk()
  call = (method, url, userId, body) => helpers.call(runtime, method, url, userId, body)
  ids = {
    admin: helpers.ADMIN,
    pelajar: helpers.PELAJAR,
    noAccess: helpers.PELAJAR2,
    maju: helpers.MAJU,
    ibubapa: helpers.IBUBAPA,
  }
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

/** The answer that the key marks correct (the test reads the store; a client can never). */
function correctAnswer(questionId: number) {
  const q = questionsStore.pkskGet(questionId)
  if (!q) throw new Error(`no PKSK question ${String(questionId)}`)
  if (q.questionType === 'essay') return { questionId, text: 'x'.repeat(60) }
  return { questionId, optionIndex: (q.pkskOptions ?? []).findIndex((o) => o.isCorrect) }
}

const data = (r: Answer) => wire(r.body.data)

describe('student responses produced by the mock parse', () => {
  it('M07-01 access', async () => {
    const r = await call('GET', '/api/pksk/me/access', ids.pelajar)
    expect(r.status).toBe(200)
    expect(PkskAccessSchema.parse(r.body.data)).toEqual({ T1: true, T4: true })
    const none = await call('GET', '/api/pksk/me/access', ids.noAccess)
    expect(PkskAccessSchema.parse(none.body.data)).toEqual({ T1: false, T4: false })
  })

  it('M07-02 the 15 domains', async () => {
    const r = await call('GET', '/api/pksk-domains', ids.noAccess)
    const parsed = z.array(PkskDomainSchema).parse(data(r))
    expect(parsed).toHaveLength(15)
    expect(parsed.map((d) => d.code)).toEqual([...PKSK_DOMAIN_CODES])
  })

  it('M07-03 dashboard', async () => {
    const r = await call('GET', '/api/pksk/levels/T1/dashboard', ids.pelajar)
    expect(r.status).toBe(200)
    const d = PkskDashboardSchema.parse(data(r))
    expect(d.readiness).toEqual({ scorePct: 55, grade: 'C' })
    expect(d.domains).toHaveLength(13)
  })

  it('M07-04 sections', async () => {
    const r = await call('GET', '/api/pksk/levels/T4/domains', ids.pelajar)
    const s = PkskDomainSectionsSchema.parse(data(r))
    expect(s.map((x) => x.bahagian)).toEqual(['A', 'B', 'C'])
  })

  it('M07-05 practice set carries no correctness flag', async () => {
    const r = await call('GET', '/api/pksk/levels/T1/domains/PKSK_MATH', ids.pelajar)
    expect(r.status).toBe(200)
    const p = PkskPracticeSchema.parse(data(r))
    expect(p.questions.length).toBeGreaterThan(0)
    expect(JSON.stringify(r.body)).not.toMatch(/isCorrect/)
    const essay = await call('GET', '/api/pksk/levels/T1/domains/PKSK_ESSAY', ids.pelajar)
    const e = PkskPracticeSchema.parse(data(essay))
    expect(e.questions.every((q) => q.options.length === 0)).toBe(true)
  })

  it('M07-06 attempts', async () => {
    const r = await call('GET', '/api/pksk/levels/T1/exam-attempts', ids.pelajar)
    const list = z.array(PkskExamAttemptSchema).parse(data(r))
    expect(list).toHaveLength(2)
  })

  it('M07-08 exam', async () => {
    const r = await call('GET', '/api/pksk/levels/T1/exam', ids.maju)
    const e = PkskExamSchema.parse(data(r))
    expect(e.sections.map((s) => [s.bahagian, s.weightPct])).toEqual([
      ['A', 20],
      ['B', 70],
      ['C', 10],
    ])
    expect(JSON.stringify(r.body)).not.toMatch(/isCorrect/)
  })

  it('M07-07 practice submit: 201 body parses and the request body of the same shape is accepted', async () => {
    const set = await call('GET', '/api/pksk/levels/T1/domains/PKSK_MATH', ids.ibubapa)
    const served = (set.body.data as { questions: { id: number }[] }).questions
    const answers = served.map((q) => correctAnswer(q.id))
    const body = { answers }
    expect(PkskAnswersRequestSchema.safeParse(wire(body)).success).toBe(true)
    const r = await call('POST', '/api/pksk/levels/T1/domains/PKSK_MATH/practice-sessions', ids.ibubapa, body)
    expect(r.status).toBe(201)
    // Deviation: the mock session id is not a uuid (v2 uses the M05 uuid, PracticeSessionIdSchema).
    const mockData = data(r) as { sessionId: string }
    expect(typeof mockData.sessionId).toBe('string')
    const res = PkskPracticeResultSchema.parse({ ...mockData, sessionId: '0b8f7c64-2f0e-4c58-9a57-5f5d6f6f1a10' })
    expect(res.masteryPct).toBe(100)
  })

  it('M07-09 exam submit: 201 body parses', async () => {
    const exam = await call('GET', '/api/pksk/levels/T1/exam', ids.maju)
    const sections = (exam.body.data as { sections: { questions: { id: number }[] }[] }).sections
    const answers = sections.flatMap((s) => s.questions.map((q) => correctAnswer(q.id)))
    const r = await call('POST', '/api/pksk/levels/T1/exam-attempts', ids.maju, { answers })
    expect(r.status).toBe(201)
    const attempt = PkskExamAttemptSchema.parse(data(r))
    expect(PkskGradeSchema.safeParse(attempt.grade).success).toBe(true)
  })
})

describe('mock errors match the documented error body', () => {
  const cases: [string, string, number | null, number, string, string][] = [
    ['GET', '/api/pksk/me/access', null, 401, 'UNAUTHORIZED', PKSK_STUDENT_MESSAGES.unauthenticated],
    ['GET', '/api/pksk/levels/T9/dashboard', 4, 404, 'NOT_FOUND', PKSK_STUDENT_MESSAGES.notFound],
    ['GET', '/api/pksk/levels/t1/exam', 4, 404, 'NOT_FOUND', PKSK_STUDENT_MESSAGES.notFound],
    ['GET', '/api/pksk/levels/T1/domains/NOPE', 4, 404, 'NOT_FOUND', PKSK_STUDENT_MESSAGES.notFound],
  ]
  it.each(cases)('%s %s as user %s -> %i', async (method, url, user, status, code, message) => {
    const r = await call(method, url, user)
    expect(r.status).toBe(status)
    const e = ErrorBodySchema.parse(r.body)
    expect(e.error.code).toBe(code)
    expect(e.error.message).toBe(message)
  })

  it('403 without access (level 404 is checked first)', async () => {
    const r = await call('GET', '/api/pksk/levels/T1/dashboard', ids.noAccess)
    expect(r.status).toBe(403)
    expect(ErrorBodySchema.parse(r.body).error).toMatchObject({
      code: 'FORBIDDEN',
      message: PKSK_STUDENT_MESSAGES.forbidden,
    })
    expect((await call('GET', '/api/pksk/levels/T9/dashboard', ids.noAccess)).status).toBe(404)
  })

  it('422 "Jawapan tidak sah." on fields.answers for the mock refusals', async () => {
    const url = '/api/pksk/levels/T1/domains/PKSK_MATH/practice-sessions'
    for (const body of [{ answers: [] }, {}, { answers: [{ questionId: 1 }, { questionId: 1 }] }, { answers: [{ questionId: 999999 }] }]) {
      const r = await call('POST', url, ids.ibubapa, body)
      expect(r.status).toBe(422)
      const e = ErrorBodySchema.parse(r.body).error
      expect(e.message).toBe(PKSK_STUDENT_MESSAGES.answers)
      expect(e.fields).toEqual({ answers: PKSK_STUDENT_MESSAGES.answers })
    }
  })
})

describe('request schema', () => {
  const MSG = 'Jawapan tidak sah.'
  const reject = (body: unknown) => {
    const r = PkskAnswersRequestSchema.safeParse(body)
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.issues.every((i) => i.message === MSG)).toBe(true)
    expect(pkskStudentFieldsOf(r.error)).toEqual({ answers: MSG })
  }

  it('accepts the mock shapes (optionIndex and text may be absent or null)', () => {
    expect(
      PkskAnswersRequestSchema.safeParse({
        answers: [{ questionId: '1', optionIndex: 2 }, { questionId: '2', text: 'esei', optionIndex: null }, { questionId: '3', text: null }],
      }).success,
    ).toBe(true)
  })

  it.each([
    ['not an object', 'x'],
    ['missing answers', {}],
    ['empty list', { answers: [] }],
    ['not an array', { answers: 'x' }],
    ['missing questionId', { answers: [{ optionIndex: 1 }] }],
    ['numeric questionId (mock sends numbers, contract is a string)', { answers: [{ questionId: 1 }] }],
    ['non-decimal questionId', { answers: [{ questionId: 'abc' }] }],
    ['duplicate questionId', { answers: [{ questionId: '1' }, { questionId: '1' }] }],
    ['fractional optionIndex', { answers: [{ questionId: '1', optionIndex: 1.5 }] }],
    ['string optionIndex', { answers: [{ questionId: '1', optionIndex: '1' }] }],
    ['numeric text', { answers: [{ questionId: '1', text: 5 }] }],
    ['unknown key on an answer (D57 strict)', { answers: [{ questionId: '1', isCorrect: true }] }],
    ['unknown key on the body (D57 strict)', { answers: [{ questionId: '1' }], extra: 1 }],
    ['more than 101 answers', { answers: Array.from({ length: 102 }, (_, i) => ({ questionId: String(i + 1) })) }],
    ['text over the cap', { answers: [{ questionId: '1', text: 'x'.repeat(10_001) }] }],
  ])('rejects %s with the mock message under fields.answers', (_name, body) => reject(body))
})

describe('OpenAPI', () => {
  it('registers all 9 paths and the components', () => {
    const registry = new OpenAPIRegistry()
    for (const [name, schema] of Object.entries({
      ...PKSK_SHARED_COMPONENT_SCHEMAS,
      ...PKSK_STUDENT_COMPONENT_SCHEMAS,
    })) {
      registry.register(name, schema)
    }
    registerPkskStudentPaths(registry)
    const doc = new OpenApiGeneratorV31(registry.definitions).generateDocument({
      openapi: '3.1.0',
      info: { title: 't', version: '0' },
    })
    const paths = doc.paths ?? {}
    const expected: [string, string][] = [
      ['/pksk/me/access', 'get'],
      ['/pksk-domains', 'get'],
      ['/pksk/levels/{level}/dashboard', 'get'],
      ['/pksk/levels/{level}/domains', 'get'],
      ['/pksk/levels/{level}/domains/{code}', 'get'],
      ['/pksk/levels/{level}/exam-attempts', 'get'],
      ['/pksk/levels/{level}/domains/{code}/practice-sessions', 'post'],
      ['/pksk/levels/{level}/exam', 'get'],
      ['/pksk/levels/{level}/exam-attempts', 'post'],
    ]
    for (const [path, method] of expected) {
      expect(Object.keys(paths[path] ?? {}), `${method} ${path}`).toContain(method)
    }
    const components = Object.keys(doc.components?.schemas ?? {})
    for (const name of [...Object.keys(PKSK_SHARED_COMPONENT_SCHEMAS), ...Object.keys(PKSK_STUDENT_COMPONENT_SCHEMAS)]) {
      expect(components, name).toContain(name)
    }
    const post = paths['/pksk/levels/{level}/exam-attempts']?.post
    expect(Object.keys(post?.responses ?? {})).toEqual(expect.arrayContaining(['201', '401', '403', '404', '422', '429']))
    expect(components.some((c) => c.startsWith('PkskAdmin'))).toBe(false)
  })
})
