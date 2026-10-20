import { describe, expect, it, vi } from 'vitest'

import { ApiClient, api, installTransport } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'
import { TransportNetworkError } from '@/api'

import { bijakServer } from '../server/client'
import { BijakError } from '../server/errors'
import { createHttpBijakServer, HttpBijakServer } from '../server/http'
import { BijakServer } from '../server/store'

const T0 = '2026-10-20T09:00:00.000+08:00'
const T0_MS = Date.parse(T0)
const T1 = '2026-10-20T09:30:00.000+08:00'
const T1_MS = Date.parse(T1)

type Handler = (req: TransportRequest) => TransportResponse | undefined

function ok(data: unknown, status = 200): TransportResponse {
  return { status, headers: {}, body: { data } }
}
function fail(
  status: number,
  code: string,
  message: string,
  extra: object = {},
): TransportResponse {
  return { status, headers: {}, body: { error: { code, message, ...extra } } }
}

/** Fake transport: `routes` maps "METHOD /path" to a response; unknown routes answer 500. */
function setup(routes: Record<string, TransportResponse | Handler> = {}) {
  const requests: TransportRequest[] = []
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      requests.push(req)
      const key = `${req.method} ${req.url}`
      if (key === 'GET /api/session' && !routes[key]) return Promise.resolve(ok({ csrf: 'csrf-1' }))
      const r = routes[key]
      if (!r) return Promise.resolve(fail(500, 'SERVER_ERROR', `unrouted ${key}`))
      const res = typeof r === 'function' ? r(req) : r
      return Promise.resolve(res ?? fail(500, 'SERVER_ERROR', 'no response'))
    }),
  }
  const client = new ApiClient({ transport })
  const clock = { t: 1_000_000 }
  const server = createHttpBijakServer({ client, now: () => clock.t })
  const last = () => requests[requests.length - 1]!
  const only = (method: string, url: string) =>
    requests.filter((r) => r.method === method && r.url === url)
  return { server, requests, last, only, clock, transport }
}

const META = {
  id: 'att-1',
  paperId: 'paper-1',
  paperKind: 'pilihan',
  title: 'Percubaan SPM Matematik Kertas 1 Set A',
  subject: 'MAT',
  kertas: 1,
  code: '1449/1',
  mode: 'exam',
  status: 'in_progress',
  startedAt: T0,
  deadline: T1,
  durationMin: 30,
  answers: { 'q-1': { answer: { choice: 'a' }, rev: 2, savedAt: T0 } },
  flags: ['q-1'],
  picks: {},
  position: 0,
  checked: [],
}
const VIEW = {
  serverNow: T1,
  attempt: META,
  sections: [
    {
      id: 's1',
      label: 'Objektif',
      rule: { type: 'all' },
      questionIds: ['q-1'],
      marks: 1,
      effectiveMarks: 1,
    },
  ],
  questions: [
    {
      id: 'q-1',
      number: 1,
      sectionId: 's1',
      topic: 'Indeks',
      formOrigin: 'T4',
      stem: 'Soalan',
      marks: 1,
      mcq: {
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
      },
    },
  ],
  groups: [],
  checks: [],
}
const QRESULT = {
  questionId: 'q-1',
  number: 1,
  sectionId: 's1',
  marks: 1,
  awarded: 1,
  counted: true,
  attempted: true,
  parts: [],
}

describe('HttpBijakServer: reads', () => {
  it('lists papers, covers, contracts and history (history startedAt becomes epoch ms)', async () => {
    const paper = { id: 'paper-1', title: 'T', status: 'belum' }
    const { server, only } = setup({
      'GET /api/bijak/papers': ok([paper]),
      'GET /api/bijak/papers/paper-1': ok({ ...paper, sections: [] }),
      'GET /api/bijak/contracts': ok([{ subject: 'MAT', kertas: 1, source: 'Disahkan' }]),
      'GET /api/bijak/history': ok([
        { attemptId: 'att-1', startedAt: T0, durationSeconds: 5, score: 3, max: 4 },
      ]),
    })
    expect(await server.listPapers()).toEqual([paper])
    expect(await server.getCover(7, 'paper-1')).toMatchObject({ id: 'paper-1' })
    expect((await server.listContracts())[0]).toMatchObject({ subject: 'MAT' })
    const rows = await server.history()
    expect(rows[0]).toMatchObject({ attemptId: 'att-1', startedAt: T0_MS, score: 3 })
    expect(only('GET', '/api/bijak/papers')).toHaveLength(1)
  })

  it('subjects() is sync, returns a list that fills after the first call', async () => {
    const { server, only } = setup({
      'GET /api/bijak/subjects': ok([{ code: 'MAT', name: 'Matematik' }]),
    })
    const list = server.subjects()
    expect(list).toHaveLength(0)
    await vi.waitFor(() => expect(list).toHaveLength(1))
    expect(server.subjects()).toBe(list)
    expect(list[0]).toEqual({ code: 'MAT', name: 'Matematik' })
    expect(only('GET', '/api/bijak/subjects')).toHaveLength(1)
  })

  it('subjects() retries on the next call after a failure', async () => {
    let calls = 0
    const { server } = setup({
      'GET /api/bijak/subjects': () => {
        calls += 1
        return calls === 1 ? fail(500, 'SERVER_ERROR', 'x') : ok([{ code: 'SN', name: 'Sains' }])
      },
    })
    server.subjects()
    await vi.waitFor(() => expect(calls).toBe(1))
    await new Promise((r) => setTimeout(r, 10))
    const list = server.subjects()
    await vi.waitFor(() => expect(list).toHaveLength(1))
  })

  it('findInProgress returns the info or null', async () => {
    const info = { attemptId: 'att-1', title: 'T', mode: 'exam', elapsedSeconds: 5, fresh: true }
    const { server } = setup({
      'GET /api/bijak/papers/p1/in-progress': ok(info),
      'GET /api/bijak/papers/p2/in-progress': ok(null),
    })
    expect(await server.findInProgress(7, 'p1')).toEqual(info)
    expect(await server.findInProgress(7, 'p2')).toBeNull()
  })

  it('getAttemptView maps instants to epoch ms and learns the server clock', async () => {
    const { server, clock } = setup({ 'GET /api/bijak/attempts/att-1': ok(VIEW) })
    expect(server.serverNow()).toBe(clock.t) // before any view: local clock
    const view = await server.getAttemptView(7, 'att-1')
    expect(view.attempt).toMatchObject({
      id: 'att-1',
      userId: 0,
      startedAt: T0_MS,
      deadline: T1_MS,
      status: 'in_progress',
    })
    expect(view.attempt.answers['q-1']).toEqual({
      answer: { choice: 'a' },
      rev: 2,
      savedAt: T0_MS,
    })
    expect('submittedAt' in view.attempt).toBe(false)
    expect((view as unknown as { serverNow?: unknown }).serverNow).toBeUndefined()
    expect(view.questions[0]!.id).toBe('q-1')
    expect(server.serverNow()).toBe(T1_MS)
    clock.t += 2000
    expect(server.serverNow()).toBe(T1_MS + 2000)
  })

  it('a null deadline (latihan) stays null', async () => {
    const { server } = setup({
      'GET /api/bijak/attempts/att-1': ok({
        ...VIEW,
        attempt: { ...META, mode: 'latihan', deadline: null },
      }),
    })
    expect((await server.getAttemptView(7, 'att-1')).attempt.deadline).toBeNull()
  })

  it('getResult maps the attempt, the paper and submittedAt', async () => {
    const { server } = setup({
      'GET /api/bijak/attempts/att-1/result': ok({
        attempt: { ...META, status: 'submitted', submittedAt: T1, lateBySeconds: 3 },
        result: { score: 1, max: 1, percent: 100 },
        paper: VIEW,
      }),
    })
    const r = await server.getResult(7, 'att-1')
    expect(r.attempt).toMatchObject({ submittedAt: T1_MS, lateBySeconds: 3, startedAt: T0_MS })
    expect(r.paper.attempt.deadline).toBe(T1_MS)
    expect(r.result.score).toBe(1)
  })
})

describe('HttpBijakServer: writes', () => {
  it('startAttempt posts paperId, mode and restart with the CSRF header', async () => {
    const { server, last, only } = setup({
      'POST /api/bijak/attempts': ok({ attemptId: 'att-9' }, 201),
    })
    expect(await server.startAttempt(7, 'paper-1', 'exam', { restart: true })).toEqual({
      attemptId: 'att-9',
    })
    expect(last().headers['x-csrf-token']).toBe('csrf-1')
    expect(last().body).toEqual({ paperId: 'paper-1', mode: 'exam', restart: true })
    await server.startAttempt(7, 'paper-1', 'latihan')
    expect(only('POST', '/api/bijak/attempts')[1]!.body).toEqual({
      paperId: 'paper-1',
      mode: 'latihan',
    })
    // the token is fetched once and cached
    expect(only('GET', '/api/session')).toHaveLength(1)
  })

  it('generatePaper: 201, NO_BLUEPRINT and SHORTAGE map to the GenerateOutcome', async () => {
    let res: TransportResponse = ok({ paperId: 'jana-1' }, 201)
    const { server, last } = setup({ 'POST /api/bijak/papers/generate': () => res })
    expect(await server.generatePaper(7, 'MAT', 2)).toEqual({ ok: true, paperId: 'jana-1' })
    expect(last().body).toEqual({ subject: 'MAT', kertas: 2 })
    expect(last().headers['x-csrf-token']).toBe('csrf-1')

    res = fail(422, 'NO_BLUEPRINT', 'Belum ada kontrak untuk subjek dan kertas ini')
    expect(await server.generatePaper(7, 'SN', 1)).toEqual({ ok: false, reason: 'no_blueprint' })

    const shortages = [{ section: 'Bahagian A', need: 5, have: 3 }]
    res = fail(422, 'SHORTAGE', 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.', {
      details: { shortages },
    })
    expect(await server.generatePaper(7, 'MAT', 1)).toEqual({
      ok: false,
      reason: 'shortage',
      shortages,
    })
  })

  it('generatePaper: a VALIDATION_ERROR is a bad_request', async () => {
    const { server } = setup({
      'POST /api/bijak/papers/generate': fail(422, 'VALIDATION_ERROR', 'Data tidak sah'),
    })
    await expect(server.generatePaper(7, '', 0)).rejects.toMatchObject({ code: 'bad_request' })
  })

  it('saveAnswers sends savedAt as ISO, flags/picks/position, and maps savedAt back', async () => {
    const { server, last } = setup({
      'PUT /api/bijak/attempts/att-1/answers': ok({ savedAt: T1, closed: true, regraded: true }),
    })
    const out = await server.saveAnswers(7, 'att-1', {
      changes: [{ partId: 'q-1', answer: { choice: 'b' }, rev: 3, savedAt: T0_MS }],
      flags: ['q-1'],
      picks: { s1: ['q-1'] },
      position: 2,
    })
    expect(out).toEqual({ savedAt: T1_MS, closed: true, regraded: true })
    expect(last().method).toBe('PUT')
    expect(last().headers['x-csrf-token']).toBe('csrf-1')
    expect(last().body).toEqual({
      changes: [
        { partId: 'q-1', answer: { choice: 'b' }, rev: 3, savedAt: new Date(T0_MS).toISOString() },
      ],
      flags: ['q-1'],
      picks: { s1: ['q-1'] },
      position: 2,
    })
  })

  it('submit sends the idempotency key in the body and the carried answers as ISO', async () => {
    const { server, last } = setup({
      'POST /api/bijak/attempts/att-1/submit': ok({ attemptId: 'att-1', late: 4 }),
    })
    const out = await server.submit(7, 'att-1', {
      idempotencyKey: 'att-1-hantar',
      changes: [],
      answers: { 'q-1': { answer: { choice: 'a' }, rev: 1, savedAt: T0_MS } },
      auto: true,
    })
    expect(out).toEqual({ attemptId: 'att-1', late: 4 })
    expect(last().headers['idempotency-key']).toBeUndefined()
    expect(last().body).toEqual({
      changes: [],
      idempotencyKey: 'att-1-hantar',
      answers: {
        'q-1': { answer: { choice: 'a' }, rev: 1, savedAt: new Date(T0_MS).toISOString() },
      },
      auto: true,
    })
  })

  it('abandon (204) resolves to undefined', async () => {
    const { server, last } = setup({
      'POST /api/bijak/attempts/att-1/abandon': { status: 204, headers: {}, body: null },
    })
    await expect(server.abandon(7, 'att-1')).resolves.toBeUndefined()
    expect(last().headers['x-csrf-token']).toBe('csrf-1')
  })

  it('checkQuestion posts to the question route (no body without a payload)', async () => {
    const { server, last } = setup({
      'POST /api/bijak/attempts/att-1/questions/q-1/check': ok(QRESULT),
    })
    expect(await server.checkQuestion(7, 'att-1', 'q-1')).toEqual(QRESULT)
    expect(last().body).toBeUndefined()
    expect(last().headers['x-csrf-token']).toBe('csrf-1')
  })
})

describe('HttpBijakServer: errors', () => {
  const view = (res: TransportResponse) => setup({ 'GET /api/bijak/attempts/att-1': res }).server
  const code = async (p: Promise<unknown>) => {
    try {
      await p
    } catch (e) {
      return e
    }
    throw new Error('expected rejection')
  }

  it('404 is not_found with the body message', async () => {
    const e = await code(
      view(fail(404, 'NOT_FOUND', 'Percubaan tidak ditemui')).getAttemptView(7, 'att-1'),
    )
    expect(e).toBeInstanceOf(BijakError)
    expect(e).toMatchObject({ code: 'not_found', message: 'Percubaan tidak ditemui' })
  })

  it('404 without a body falls back to a BM message', async () => {
    const e = await code(view({ status: 404, headers: {}, body: null }).getAttemptView(7, 'att-1'))
    expect(e).toMatchObject({ code: 'not_found', message: 'Tidak ditemui' })
  })

  it('403 is forbidden', async () => {
    const e = await code(view(fail(403, 'FORBIDDEN', 'Akses ditolak')).getAttemptView(7, 'att-1'))
    expect(e).toMatchObject({ code: 'forbidden', message: 'Akses ditolak' })
  })

  it('401 is rethrown as the ApiError (the api client runs the global 401 policy)', async () => {
    const onUnauthorized = vi.fn()
    const transport: Transport = {
      request: () => Promise.resolve(fail(401, 'UNAUTHORIZED', 'Sila log masuk')),
    }
    const client = new ApiClient({ transport, onUnauthorized })
    const server = new HttpBijakServer({ client, getCsrf: () => Promise.resolve('x') })
    const e = await code(server.history())
    expect(e).toMatchObject({ name: 'ApiError', status: 401, code: 'UNAUTHORIZED' })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('409 NOT_SUBMITTED on the result is not_submitted', async () => {
    const { server } = setup({
      'GET /api/bijak/attempts/att-1/result': fail(
        409,
        'NOT_SUBMITTED',
        'Skema hanya didedahkan selepas Hantar',
      ),
    })
    const e = await code(server.getResult(7, 'att-1'))
    expect(e).toMatchObject({
      code: 'not_submitted',
      message: 'Skema hanya didedahkan selepas Hantar',
    })
  })

  it('409 CONFLICT on a check of a closed attempt is bad_request like the mock', async () => {
    const { server } = setup({
      'POST /api/bijak/attempts/att-1/questions/q-1/check': fail(
        409,
        'CONFLICT',
        'Percubaan sudah tamat',
      ),
    })
    const e = await code(server.checkQuestion(7, 'att-1', 'q-1'))
    expect(e).toMatchObject({ code: 'bad_request', message: 'Percubaan sudah tamat' })
  })

  it('403 on a check in exam mode is forbidden with the scheme message', async () => {
    const { server } = setup({
      'POST /api/bijak/attempts/att-1/questions/q-1/check': fail(
        403,
        'FORBIDDEN',
        'Skema hanya didedahkan selepas Hantar',
      ),
    })
    expect(await code(server.checkQuestion(7, 'att-1', 'q-1'))).toMatchObject({
      code: 'forbidden',
      message: 'Skema hanya didedahkan selepas Hantar',
    })
  })

  it('422 VALIDATION_ERROR is bad_request', async () => {
    const { server } = setup({
      'PUT /api/bijak/attempts/att-1/answers': fail(422, 'VALIDATION_ERROR', 'Data tidak sah', {
        fields: { changes: 'Wajib' },
      }),
    })
    const e = await code(server.saveAnswers(7, 'att-1', { changes: [] }))
    expect(e).toMatchObject({ code: 'bad_request' })
  })

  it('a 500 is rethrown as the ApiError (the autosave shows "Gagal simpan")', async () => {
    const { server } = setup({
      'PUT /api/bijak/attempts/att-1/answers': fail(500, 'SERVER_ERROR', 'Ralat'),
    })
    const e = await code(server.saveAnswers(7, 'att-1', { changes: [] }))
    expect(e).toMatchObject({ name: 'ApiError', status: 500 })
    expect((e as { code?: string }).code).not.toBe('offline')
  })

  it('a network error is offline "Luar talian"', async () => {
    const transport: Transport = {
      request: () => Promise.reject(new TransportNetworkError('down')),
    }
    const client = new ApiClient({ transport })
    const server = new HttpBijakServer({ client, getCsrf: () => Promise.resolve('x') })
    for (const call of [
      () => server.getAttemptView(7, 'att-1'),
      () => server.saveAnswers(7, 'att-1', { changes: [] }),
      () => server.generatePaper(7, 'MAT', 1),
    ]) {
      expect(await code(call())).toMatchObject({ code: 'offline', message: 'Luar talian' })
    }
  })

  it('a network error while fetching the CSRF token is offline too', async () => {
    const transport: Transport = {
      request: () => Promise.reject(new TransportNetworkError('down')),
    }
    const server = new HttpBijakServer({ client: new ApiClient({ transport }) })
    expect(await code(server.abandon(7, 'att-1'))).toMatchObject({ code: 'offline' })
  })
})

describe('HttpBijakServer: CSRF', () => {
  it('no CSRF header on GET and no session fetch for reads', async () => {
    const { server, requests } = setup({ 'GET /api/bijak/history': ok([]) })
    await server.history()
    expect(requests).toHaveLength(1)
    expect(requests[0]!.headers['x-csrf-token']).toBeUndefined()
  })

  it('refreshes the token once after 403 CSRF_INVALID and retries once', async () => {
    let session = 0
    let posts = 0
    const { server, only } = setup({
      'GET /api/session': () => ok({ csrf: `csrf-${++session}` }),
      'POST /api/bijak/attempts/att-1/submit': (req) => {
        posts += 1
        return req.headers['x-csrf-token'] === 'csrf-2'
          ? ok({ attemptId: 'att-1', late: 0 })
          : fail(403, 'CSRF_INVALID', 'Token CSRF tidak sah')
      },
    })
    const out = await server.submit(7, 'att-1', { idempotencyKey: 'k', changes: [] })
    expect(out).toEqual({ attemptId: 'att-1', late: 0 })
    expect(posts).toBe(2)
    expect(only('GET', '/api/session')).toHaveLength(2)
    // the refreshed token is now the cached one
    await server.submit(7, 'att-1', { idempotencyKey: 'k', changes: [] })
    expect(only('GET', '/api/session')).toHaveLength(2)
  })

  it('does not retry twice: a second CSRF_INVALID surfaces as forbidden', async () => {
    let posts = 0
    const { server } = setup({
      'POST /api/bijak/attempts/att-1/abandon': () => {
        posts += 1
        return fail(403, 'CSRF_INVALID', 'Token CSRF tidak sah')
      },
    })
    await expect(server.abandon(7, 'att-1')).rejects.toMatchObject({ code: 'forbidden' })
    expect(posts).toBe(2)
  })

  it('a plain 403 FORBIDDEN is not retried', async () => {
    let posts = 0
    const { server } = setup({
      'POST /api/bijak/attempts/att-1/abandon': () => {
        posts += 1
        return fail(403, 'FORBIDDEN', 'Akses ditolak')
      },
    })
    await expect(server.abandon(7, 'att-1')).rejects.toMatchObject({ code: 'forbidden' })
    expect(posts).toBe(1)
  })

  it('uses an injected getCsrf', async () => {
    const getCsrf = vi.fn(() => Promise.resolve('injected'))
    const requests: TransportRequest[] = []
    const transport: Transport = {
      request: (req) => {
        requests.push(req)
        return Promise.resolve(ok({ attemptId: 'a' }, 201))
      },
    }
    const server = new HttpBijakServer({ client: new ApiClient({ transport }), getCsrf })
    await server.startAttempt(7, 'p', 'exam')
    expect(getCsrf).toHaveBeenCalledWith(false)
    expect(requests[0]!.headers['x-csrf-token']).toBe('injected')
  })

  it('a failed session fetch is not cached', async () => {
    let n = 0
    const { server, only } = setup({
      'GET /api/session': () => (++n === 1 ? fail(500, 'SERVER_ERROR', 'x') : ok({ csrf: 'c2' })),
      'POST /api/bijak/attempts/att-1/abandon': { status: 204, headers: {}, body: null },
    })
    await expect(server.abandon(7, 'att-1')).rejects.toBeDefined()
    await expect(server.abandon(7, 'att-1')).resolves.toBeUndefined()
    expect(only('GET', '/api/session')).toHaveLength(2)
  })
})

describe('bijakServer()', () => {
  it('returns the in-browser mock outside http mode', () => {
    expect(bijakServer()).toBeInstanceOf(BijakServer)
  })

  it('the default HttpBijakServer sends through the shared api client', async () => {
    const request = vi.fn(() => Promise.resolve(ok([])))
    installTransport({ request })
    try {
      await new HttpBijakServer().history()
      expect(request).toHaveBeenCalledOnce()
    } finally {
      api.configure({ transport: null })
    }
  })
})
