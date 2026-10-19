import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiClient } from '@/api/client'
import { ApiError } from '@/api/errors'
import { TransportNetworkError } from '@/api/transport'

import { createFaults, resolveFaultSpec } from '../../faults'
import { createLatency, defaultSleep, latencyFromEnv, type Sleep } from '../../latency'
import { createRequestLog, snapshotBody } from '../../request-log'
import { blob as blobResponse } from '../respond'
import { route } from '../router'
import { createMockServer } from '../server'
import { MockTransport } from '../transport'
import { bootTest, type Note } from './helpers'

afterEach(() => {
  vi.useRealTimers()
})

function recordingSleep() {
  const waits: number[] = []
  const sleep: Sleep = (ms) => {
    waits.push(ms)
    return Promise.resolve()
  }
  return { waits, sleep }
}

async function clientFor(options: Parameters<typeof bootTest>[0] = {}, token = 'tok-student') {
  const t = await bootTest(options)
  const onUnauthorized = vi.fn()
  const api = new ApiClient({
    transport: t.runtime.transport,
    getToken: () => token,
    onUnauthorized,
  })
  return { ...t, api, onUnauthorized }
}

describe('latency', () => {
  it('env default is 400 ms; invalid values fall back', () => {
    expect(latencyFromEnv(undefined)).toBe(400)
    expect(latencyFromEnv('')).toBe(400)
    expect(latencyFromEnv('abc')).toBe(400)
    expect(latencyFromEnv('-5')).toBe(400)
    expect(latencyFromEnv('0')).toBe(0)
    expect(latencyFromEnv('250')).toBe(250)
  })

  it('global and per-path values; the latest matching rule wins; clear()', () => {
    const l = createLatency({ defaultMs: 400 })
    l.set(300, '/api/admin/*')
    l.set(1500, 'GET /api/admin/spm/walkthrough/:id')
    expect(l.for('GET', '/api/me')).toBe(400)
    expect(l.for('GET', '/api/admin/users')).toBe(300)
    expect(l.for('GET', '/api/admin/spm/walkthrough/3')).toBe(1500)
    expect(l.for('POST', '/api/admin/spm/walkthrough/3')).toBe(300)
    l.set(50)
    expect(l.for('GET', '/api/me')).toBe(50)
    l.set(10, '/api/admin/*') // replaces the old rule, now the latest
    expect(l.for('GET', '/api/admin/spm/walkthrough/3')).toBe(10)
    l.clear('/api/admin/*')
    expect(l.for('GET', '/api/admin/users')).toBe(50)
    l.clear()
    expect(l.rules()).toEqual([])
    expect(() => l.set(-1)).toThrow(RangeError)
  })

  it('the transport waits the latency of each request', async () => {
    const { waits, sleep } = recordingSleep()
    const { api, runtime } = await clientFor({ latencyMs: 400, sleep })
    runtime.latency.set(300, '/api/notes/:id')
    await api.get('/api/notes')
    await api.get('/api/notes/1')
    expect(waits).toEqual([400, 300])
  })

  it('an abort during latency rejects and the handler never runs', async () => {
    vi.useFakeTimers()
    const { runtime, notes } = await bootTest({ latencyMs: 400, sleep: defaultSleep })
    const controller = new AbortController()
    const pending = runtime.transport.request(
      {
        method: 'POST',
        url: '/api/notes',
        headers: { authorization: 'Bearer tok-student' },
        body: { text: 'never' },
      },
      controller.signal,
    )
    const settled = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await settled
    await vi.advanceTimersByTimeAsync(1000)
    expect(notes.size).toBe(3)
    expect(runtime.log.last('/api/notes')?.outcome).toBe('aborted')
  })

  it('init.latency sets global and per-path values', async () => {
    const { runtime } = await bootTest({ init: { latency: { '*': 5, '/api/notes/:id': 7 } } })
    expect(runtime.latency.for('GET', '/api/notes')).toBe(5)
    expect(runtime.latency.for('GET', '/api/notes/1')).toBe(7)
  })
})

describe('fault injection (failNext)', () => {
  it('resolves every spec form', () => {
    expect(resolveFaultSpec(500)).toMatchObject({
      kind: 'response',
      response: { status: 500, body: { error: { code: 'SERVER_ERROR', message: 'Server Error' } } },
    })
    expect(resolveFaultSpec(404)).toMatchObject({
      response: { status: 404, body: { error: { code: 'NOT_FOUND' } } },
    })
    expect(resolveFaultSpec('CONFLICT')).toMatchObject({
      response: { status: 409, body: { error: { code: 'CONFLICT' } } },
    })
    expect(resolveFaultSpec('RATE_LIMITED')).toMatchObject({ response: { status: 429 } })
    expect(resolveFaultSpec('network')).toEqual({ kind: 'network' })
    expect(resolveFaultSpec({ status: 200, body: { ok: false, message: 'x' } })).toMatchObject({
      response: { status: 200, body: { ok: false, message: 'x' } },
    })
    expect(
      resolveFaultSpec({ status: 402, code: 'TRIAL_EXHAUSTED', message: 'Had percubaan.' }),
    ).toMatchObject({
      response: {
        status: 402,
        body: { error: { code: 'TRIAL_EXHAUSTED', message: 'Had percubaan.' } },
      },
    })
    expect(resolveFaultSpec({ status: 429, retryAfter: 30 })).toMatchObject({
      response: { headers: { 'retry-after': '30' }, body: { error: { retryAfter: 30 } } },
    })
    expect(() => resolveFaultSpec('NOPE_CODE')).toThrow(/unknown code/)
  })

  it('the next matching call fails once, without reaching the handler', async () => {
    const { api, runtime, notes } = await clientFor({})
    runtime.faults.failNext('POST /api/notes', 500)
    await expect(api.post('/api/notes', { body: { text: 'x' } })).rejects.toMatchObject({
      status: 500,
      code: 'SERVER_ERROR',
    })
    expect(notes.size).toBe(3)
    // Consumed: the next call succeeds.
    await expect(api.post('/api/notes', { body: { text: 'x' } })).resolves.toMatchObject({ id: 4 })
    expect(runtime.faults.pending()).toBe(0)
  })

  it("'network' / networkErrorNext reject the transport → NETWORK_ERROR", async () => {
    const { api, runtime } = await clientFor({})
    runtime.faults.networkErrorNext('/api/notes')
    await expect(
      runtime.transport.request({ method: 'GET', url: '/api/notes', headers: {} }),
    ).rejects.toBeInstanceOf(TransportNetworkError)
    runtime.faults.failNext('/api/notes', 'network')
    const err = (await api.get('/api/notes').catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
    expect(runtime.log.last('/api/notes')).toMatchObject({
      outcome: 'network-error',
      faulted: true,
    })
  })

  it('faults queue in order and only match their pattern', () => {
    const f = createFaults()
    f.failNext('/api/a', 500)
    f.failNext('/api/*', 404)
    f.failNext('/api/a', 409)
    expect(f.take('GET', '/api/b')).toMatchObject({ response: { status: 404 } })
    expect(f.take('GET', '/api/a')).toMatchObject({ response: { status: 500 } })
    expect(f.take('GET', '/api/a')).toMatchObject({ response: { status: 409 } })
    expect(f.take('GET', '/api/a')).toBeNull()
    expect(() => f.failNext('/api/a', 'TYPO')).toThrow()
    expect(f.pending()).toBe(0)
  })

  it('a {status, body} fault body is cloned (set time and answer time)', async () => {
    const { runtime } = await bootTest()
    const body = { ok: false, items: [1] }
    runtime.faults.failNext('/api/notes', { status: 500, body })
    body.items.push(2)
    const res = await runtime.transport.request({ method: 'GET', url: '/api/notes', headers: {} })
    expect(res.body).toEqual({ ok: false, items: [1] })
    expect(res.body).not.toBe(body)
  })

  it('a {status, body} fault reaches api.raw untouched', async () => {
    const { api, runtime } = await clientFor({})
    runtime.faults.failNext('/api/notes', { status: 422, body: { ok: false, error: 'bad' } })
    await expect(api.raw('GET', '/api/notes')).resolves.toMatchObject({
      status: 422,
      body: { ok: false, error: 'bad' },
    })
  })
})

describe('request log', () => {
  it('records method, path, query and body; lastRequest by pattern', async () => {
    const { api, runtime } = await clientFor({})
    await api.post('/api/notes', { body: { text: 'first' } })
    await api.get('/api/notes', { query: { page: 2, ids: [1, 2] } })
    await api.post('/api/notes', { body: { text: 'second' } })
    expect(runtime.log.last('POST /api/notes')).toMatchObject({
      method: 'POST',
      path: '/api/notes',
      body: { text: 'second' },
      outcome: 'response',
      status: 201,
      faulted: false,
    })
    expect(runtime.log.last('GET /api/notes')?.query).toEqual({ page: '2', ids: ['1', '2'] })
    expect(runtime.log.entries('POST /api/notes')).toHaveLength(2)
    expect(runtime.log.last('/api/other')).toBeUndefined()
  })

  it('keeps the last N entries', () => {
    const log = createRequestLog(2)
    for (const path of ['/api/1', '/api/2', '/api/3']) {
      log.record({ at: 0, method: 'GET', path, query: {}, body: null })
    }
    expect(log.entries().map((e) => e.path)).toEqual(['/api/2', '/api/3'])
    expect(() => createRequestLog(0)).toThrow()
  })

  it('snapshots FormData and Blob bodies as JSON-able values', () => {
    const form = new FormData()
    form.append('name', 'x')
    form.append('file', new File(['abcd'], 'a.png', { type: 'image/png' }))
    expect(snapshotBody(form)).toEqual({
      name: 'x',
      file: { name: 'a.png', size: 4, type: 'image/png' },
    })
    expect(snapshotBody(new Blob(['ab'], { type: 'text/plain' }))).toEqual({
      size: 2,
      type: 'text/plain',
    })
    expect(snapshotBody(undefined)).toBeNull()
  })
})

describe('sample plugin end to end through ApiClient', () => {
  it('list, single, create, validation error and 401 policy', async () => {
    const { api, onUnauthorized } = await clientFor({})

    const page1 = await api.list<Note>('/api/notes')
    expect(page1.data.map((n) => n.id)).toEqual([1, 3])
    expect(page1.meta).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 2,
      totalPages: 1,
      from: 1,
      to: 2,
    })
    const beyond = await api.list<Note>('/api/notes', { query: { page: 5 } })
    expect(beyond).toMatchObject({ data: [], meta: { page: 5, from: null, to: null } })

    await expect(api.get<Note>('/api/notes/1')).resolves.toMatchObject({ id: 1, text: 'hello' })
    await expect(api.post<Note>('/api/notes', { body: { text: 'new' } })).resolves.toMatchObject({
      id: 4,
      userId: 1,
      text: 'new',
    })

    const invalid = (await api
      .post('/api/notes', { body: { text: 'x'.repeat(21) } })
      .catch((e: unknown) => e)) as ApiError
    expect(invalid).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'The text field must not be greater than 20 characters.',
      fields: { text: 'The text field must not be greater than 20 characters.' },
    })

    const notMine = (await api.get('/api/notes/2').catch((e: unknown) => e)) as ApiError
    expect(notMine).toMatchObject({ status: 404, code: 'NOT_FOUND' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('an unknown token → 401 → the client calls onUnauthorized', async () => {
    const { api, onUnauthorized } = await clientFor({}, 'expired-token')
    await expect(api.get('/api/notes')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('blob downloads keep the Blob and the file name', async () => {
    const { runtime } = await bootTest()
    const server = createMockServer({
      db: runtime.db,
      clock: runtime.clock,
      prng: runtime.prng,
      config: runtime.config,
      outbox: runtime.outbox,
      events: runtime.events,
      routes: [
        route('GET', '/api/template', () => blobResponse(new Blob(['a,b;']), 'templat.csv')),
      ],
    })
    const transport = new MockTransport({
      server,
      latency: runtime.latency,
      faults: runtime.faults,
      log: runtime.log,
      clock: runtime.clock,
    })
    const { blob, filename } = await new ApiClient({ transport }).blob('/api/template')
    expect(filename).toBe('templat.csv')
    expect(await blob.text()).toBe('a,b;')
  })
})
