import { describe, expect, it, vi } from 'vitest'

import type { ListResult } from '../envelope'
import {
  ApiClient,
  api,
  filenameFromContentDisposition,
  installTransport,
  isAuthPath,
  serializeQuery,
} from '../client'
import { ApiError, isApiError } from '../errors'
import { resetOfflineForTests, useOffline } from '../offline'
import type { Transport, TransportRequest, TransportResponse } from '../transport'
import { TransportNetworkError } from '../transport'

type Responder = (req: TransportRequest) => TransportResponse | Promise<TransportResponse>

/** Fake transport: records requests and answers with the given responder. */
function fakeTransport(responder: Responder) {
  const requests: TransportRequest[] = []
  const request = vi.fn(async (req: TransportRequest, signal?: AbortSignal) => {
    requests.push(req)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return responder(req)
  })
  const transport: Transport = { request }
  return { transport, request, requests }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return (): TransportResponse => ({ status, headers, body })
}

function client(
  responder: Responder,
  extra: { token?: string | null; onUnauthorized?: () => void } = {},
) {
  const fake = fakeTransport(responder)
  const c = new ApiClient({
    transport: fake.transport,
    getToken: () => extra.token ?? null,
    onUnauthorized: extra.onUnauthorized ?? null,
  })
  return { c, ...fake }
}

async function catchError(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (err) {
    if (err instanceof ApiError) return err
    throw err
  }
  throw new Error('expected the call to reject')
}

describe('ApiClient: success and envelope', () => {
  it('unwraps a single-resource envelope to data', async () => {
    const { c } = client(json(200, { data: { id: 7, name: 'Demo' } }))
    await expect(c.get<{ id: number; name: string }>('/api/me')).resolves.toEqual({
      id: 7,
      name: 'Demo',
    })
  })

  it('returns {data, meta} for a list, keeping from/to/counts and module aggregates', async () => {
    const meta = {
      page: 2,
      pageSize: 20,
      totalItems: 45,
      totalPages: 3,
      from: 21,
      to: 40,
      counts: { unread: 3, all: 45 },
      averageScore: 71.5,
    }
    const { c } = client(json(200, { data: [{ id: 1 }], meta }))
    const res: ListResult<{ id: number }, { averageScore: number }> = await c.list(
      '/api/me/notifications',
      { query: { page: 2 } },
    )
    expect(res).toEqual({ data: [{ id: 1 }], meta })
    expect(res.meta.counts?.unread).toBe(3)
    expect(res.meta.averageScore).toBe(71.5)
  })

  it('keeps null from/to of an empty (out-of-range) page', async () => {
    const meta = { page: 9, pageSize: 20, totalItems: 5, totalPages: 1, from: null, to: null }
    const { c } = client(json(200, { data: [], meta }))
    await expect(c.list('/api/x')).resolves.toEqual({ data: [], meta })
  })

  it('resolves undefined for 204 No Content', async () => {
    const { c } = client(json(204, null))
    await expect(c.delete('/api/items/1')).resolves.toBeUndefined()
  })

  it('with raw: true returns the body untouched (live-shaped bodies, extras beside data)', async () => {
    const { c: c1 } = client(json(200, { ok: true, message: 'Berjaya' }))
    await expect(c1.post('/api/x', { raw: true })).resolves.toEqual({
      ok: true,
      message: 'Berjaya',
    })

    const { c: c2 } = client(json(200, [1, 2, 3]))
    await expect(c2.get('/api/bare', { raw: true })).resolves.toEqual([1, 2, 3])

    const { c: c3 } = client(json(201, { data: { id: 1 }, status: 'Disimpan.' }))
    await expect(c3.post('/api/x', { raw: true })).resolves.toEqual({
      data: { id: 1 },
      status: 'Disimpan.',
    })
  })

  it('still maps errors to ApiError with raw: true', async () => {
    const { c } = client(json(404, { error: { code: 'NOT_FOUND', message: 'Tiada.' } }))
    const err = await catchError(c.get('/api/x', { raw: true }))
    expect(err.code).toBe('NOT_FOUND')
  })
})

describe('ApiClient: request building', () => {
  it('sends method, path, serialised query, JSON body, accept and Bearer token', async () => {
    const { c, requests } = client(json(200, { data: null }), { token: 'tok-123' })
    await c.post('/api/items', {
      query: {
        subjectId: 5,
        active: true,
        tags: ['a', 'b'],
        empty: [],
        skip: null,
        gone: undefined,
      },
      body: { name: 'X' },
      headers: { 'X-Extra': '1' },
    })
    expect(requests[0]).toEqual({
      method: 'POST',
      url: '/api/items',
      query: { subjectId: '5', active: 'true', tags: ['a', 'b'] },
      body: { name: 'X' },
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer tok-123',
        'x-extra': '1',
      },
      responseType: 'json',
    })
  })

  it('omits Authorization without a token, and query/body when absent', async () => {
    const { c, requests } = client(json(200, { data: 1 }))
    await c.get('/api/public')
    expect(requests[0]).toEqual({
      method: 'GET',
      url: '/api/public',
      headers: { accept: 'application/json' },
      responseType: 'json',
    })
  })

  it('moves a query string in the URL into query (explicit query wins)', async () => {
    const { c, requests } = client(json(200, { data: 1 }))
    await c.get('/api/x?filter=unread&id=1&id=2&page=1', { query: { page: 3 } })
    expect(requests[0]?.url).toBe('/api/x')
    expect(requests[0]?.query).toEqual({ filter: 'unread', id: ['1', '2'], page: '3' })
  })

  it('sends FormData as multipart without a JSON content-type', async () => {
    const { c, requests } = client(json(201, { data: { id: 9 } }))
    const form = new FormData()
    form.append('file', new Blob(['a,b']), 'soalan.csv')
    await expect(c.multipart<{ id: number }>('/api/admin/questions/import', form)).resolves.toEqual(
      {
        id: 9,
      },
    )
    expect(requests[0]?.method).toBe('POST')
    expect(requests[0]?.body).toBe(form)
    expect(requests[0]?.headers['content-type']).toBeUndefined()

    await c.multipart('/api/x/1', form, { method: 'PUT' })
    expect(requests[1]?.method).toBe('PUT')
  })

  it('throws a plain Error when no transport is installed', async () => {
    const c = new ApiClient()
    expect(c.hasTransport).toBe(false)
    await expect(c.get('/api/me')).rejects.toThrow(/no transport installed/)
  })

  it('installTransport installs on the app-wide api instance', async () => {
    const { transport } = fakeTransport(json(200, { data: 'ok' }))
    installTransport(transport)
    expect(api.hasTransport).toBe(true)
    await expect(api.get('/api/ping')).resolves.toBe('ok')
    api.configure({ transport: null })
  })
})

describe('ApiClient: errors', () => {
  it('maps 422 VALIDATION_ERROR with fields', async () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Sila lengkapkan semua medan wajib.',
        fields: { email: 'Format e-mel tidak sah.' },
      },
    }
    const { c } = client(json(422, body))
    const err = await catchError(c.post('/api/auth/register', { body: {} }))
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Sila lengkapkan semua medan wajib.',
      fields: { email: 'Format e-mel tidak sah.' },
      retryAfter: undefined,
      body,
      method: 'POST',
      url: '/api/auth/register',
    })
  })

  it('keeps module codes (e.g. 403 ACCOUNT_INACTIVE) unchanged', async () => {
    const { c } = client(
      json(403, { error: { code: 'ACCOUNT_INACTIVE', message: 'Tidak aktif.' } }),
    )
    const err = await catchError(c.post('/api/auth/login'))
    expect(err.code).toBe('ACCOUNT_INACTIVE')
    expect(isApiError(err, 'ACCOUNT_INACTIVE')).toBe(true)
    expect(isApiError(err, 'FORBIDDEN')).toBe(false)
  })

  it('maps 5xx SERVER_ERROR', async () => {
    const { c } = client(json(500, { error: { code: 'SERVER_ERROR', message: 'Ralat pelayan.' } }))
    const err = await catchError(c.get('/api/x'))
    expect(err).toMatchObject({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' })
  })

  it('derives the code from the status when the body has no error object', async () => {
    const cases: [number, string][] = [
      [400, 'BAD_REQUEST'],
      [422, 'VALIDATION_ERROR'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [429, 'RATE_LIMITED'],
      [503, 'SERVICE_UNAVAILABLE'],
      [418, 'SERVER_ERROR'],
    ]
    for (const [status, code] of cases) {
      const { c } = client(json(status, null))
      const err = await catchError(c.post('/api/x'))
      expect(err.code).toBe(code)
      expect(err.status).toBe(status)
    }
  })

  it('maps 429 RATE_LIMITED with error.retryAfter', async () => {
    const { c } = client(
      json(429, {
        error: { code: 'RATE_LIMITED', message: 'Terlalu banyak cubaan.', retryAfter: 60 },
      }),
    )
    const err = await catchError(c.post('/api/auth/login'))
    expect(err).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 60 })
  })

  it('shows BM copy for an English 429 envelope in http mode, keeping retryAfter', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    try {
      const { c } = client(
        json(429, {
          error: { code: 'RATE_LIMITED', message: 'Too Many Attempts.', retryAfter: 30 },
        }),
      )
      const err = await catchError(c.post('/api/auth/login'))
      expect(err.message).toBe('Terlalu banyak percubaan. Sila cuba sebentar lagi.')
      expect(err.retryAfter).toBe(30)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('falls back to the Retry-After header for retryAfter', async () => {
    const { c } = client(
      json(429, { error: { code: 'RATE_LIMITED', message: 'x' } }, { 'Retry-After': '42' }),
    )
    const err = await catchError(c.post('/api/auth/login'))
    expect(err.retryAfter).toBe(42)
  })

  it('leaves retryAfter undefined for a 429 with neither body retryAfter nor a header (the UI applies its own 30 s)', async () => {
    const withBody = client(json(429, { error: { code: 'RATE_LIMITED', message: 'x' } }))
    expect((await catchError(withBody.c.post('/api/auth/login'))).retryAfter).toBeUndefined()
    const noBody = client(json(429, { oops: true }))
    expect((await catchError(noBody.c.post('/api/auth/login'))).retryAfter).toBeUndefined()
  })

  it('keeps the first message of Laravel-style array fields', async () => {
    const { c } = client(
      json(422, {
        error: { code: 'VALIDATION_ERROR', message: 'x', fields: { name: ['A', 'B'] } },
      }),
    )
    const err = await catchError(c.post('/api/x'))
    expect(err.fields).toEqual({ name: 'A' })
  })

  it('maps a transport rejection to NETWORK_ERROR (status 0)', async () => {
    const { c } = client(() => {
      throw new TransportNetworkError('Failed to fetch')
    })
    const err = await catchError(c.post('/api/x'))
    expect(err).toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Anda sedang luar talian. Semak sambungan internet anda.',
    })
    expect(err.cause).toBeInstanceOf(TransportNetworkError)
  })

  it('re-throws aborts unchanged', async () => {
    const { c } = client(json(200, { data: 1 }))
    const controller = new AbortController()
    controller.abort()
    await expect(c.get('/api/x', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

describe('ApiClient: 401 policy', () => {
  const unauthorized = json(401, { error: { code: 'UNAUTHORIZED', message: 'Sesi tamat.' } })

  it.each(['/api/auth/refresh', '/api/auth/login', '/api/auth/logout'])(
    'a 401 on %s does not run the 401 hook (no kembali redirect) and aborts nothing',
    async (path) => {
      const onUnauthorized = vi.fn()
      const slow = new Promise<TransportResponse>(() => {})
      const request = vi.fn((req: TransportRequest, signal?: AbortSignal) => {
        if (req.url === '/api/slow') {
          return new Promise<TransportResponse>((_, reject) =>
            signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))),
          )
        }
        void slow
        return Promise.resolve({
          status: 401,
          headers: {},
          body: { error: { code: 'UNAUTHORIZED', message: 'x' } },
        })
      })
      const c = new ApiClient({
        transport: { request },
        getToken: () => 't',
        onUnauthorized,
      })
      const pending = c.get('/api/slow')
      const err = await catchError(c.post(path))
      expect(err.status).toBe(401)
      expect(onUnauthorized).not.toHaveBeenCalled()
      let settled = false
      void pending.catch(() => (settled = true))
      await Promise.resolve()
      expect(settled).toBe(false)
    },
  )

  it('a 401 on a protected call aborts the other in-flight calls once; later calls are not affected (FR-ERR-7)', async () => {
    const request = vi.fn((req: TransportRequest, signal?: AbortSignal) => {
      if (req.url === '/api/slow') {
        return new Promise<TransportResponse>((_, reject) =>
          signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))),
        )
      }
      if (req.url === '/api/expired') {
        return Promise.resolve({
          status: 401,
          headers: {},
          body: { error: { code: 'UNAUTHORIZED', message: 'x' } },
        })
      }
      return Promise.resolve({ status: 200, headers: {}, body: { data: 1 } })
    })
    const c = new ApiClient({
      transport: { request },
      getToken: () => 't',
      onUnauthorized: vi.fn(),
    })
    const slow = c.get('/api/slow')
    const login = c.post('/api/auth/login')
    await catchError(c.get('/api/expired'))
    await expect(slow).rejects.toMatchObject({ name: 'AbortError' })
    await expect(login).resolves.toBe(1)
    await expect(c.get('/api/later')).resolves.toBe(1)
  })

  it('calls onUnauthorized before the call rejects with UNAUTHORIZED', async () => {
    const order: string[] = []
    const onUnauthorized = vi.fn(() => {
      order.push('hook')
    })
    const { c } = client(unauthorized, { token: 'expired', onUnauthorized })
    const err = await catchError(c.get('/api/me/notifications/unread-count'))
    order.push('rejected')
    expect(err.code).toBe('UNAUTHORIZED')
    expect(onUnauthorized).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/me/notifications/unread-count',
      status: 401,
    })
    expect(order).toEqual(['hook', 'rejected'])
  })

  it('does not call the hook for /api/auth/* calls', async () => {
    const onUnauthorized = vi.fn()
    const { c } = client(unauthorized, { onUnauthorized })
    await catchError(c.post('/api/auth/login'))
    await catchError(c.post('/api/auth'))
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(isAuthPath('/api/authors')).toBe(false)
  })

  it('does not call the hook for 403', async () => {
    const onUnauthorized = vi.fn()
    const { c } = client(json(403, { error: { code: 'FORBIDDEN', message: 'x' } }), {
      onUnauthorized,
    })
    await catchError(c.get('/api/admin/x'))
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('a throwing or rejecting hook does not replace the ApiError', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { c: c1 } = client(unauthorized, {
      onUnauthorized: () => {
        throw new Error('boom')
      },
    })
    expect((await catchError(c1.get('/api/x'))).code).toBe('UNAUTHORIZED')

    const c2 = new ApiClient({
      transport: fakeTransport(unauthorized).transport,
      onUnauthorized: () => Promise.reject(new Error('async boom')),
    })
    expect((await catchError(c2.get('/api/x'))).code).toBe('UNAUTHORIZED')
    await Promise.resolve()
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('ApiClient.raw (M13 XR-M13-05 raw-body exception)', () => {
  it('returns {status, headers, body} without unwrapping data', async () => {
    const body = { data: { reply: 'Hai' }, meta: { page: 1 } }
    const { c } = client(json(200, body, { 'X-Trace': 'a' }))
    await expect(c.raw('POST', '/api/cikgu/send', { message: 'Hai' })).resolves.toEqual({
      status: 200,
      headers: { 'x-trace': 'a' },
      body,
    })
  })

  it('returns the live-shaped error body instead of throwing ApiError', async () => {
    const live = { success: false, error: 'Had harian telah dicapai.' }
    const { c } = client(json(429, live))
    await expect(c.raw('POST', '/api/cikgu/send', { message: 'x' })).resolves.toEqual({
      status: 429,
      headers: {},
      body: live,
    })
  })

  it('sends through the transport with the auth header and JSON body', async () => {
    const { c, requests, request } = client(json(200, { ok: true }), { token: 'tok' })
    await c.raw('POST', '/api/cikgu/send', { message: 'Hai', session_id: 3 }, { query: { v: 1 } })
    expect(request).toHaveBeenCalledTimes(1)
    expect(requests[0]).toEqual({
      method: 'POST',
      url: '/api/cikgu/send',
      query: { v: '1' },
      body: { message: 'Hai', session_id: 3 },
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer tok',
      },
      responseType: 'json',
    })
  })

  it('keeps the 401 policy and still resolves with the 401 body', async () => {
    const onUnauthorized = vi.fn()
    const body = { message: 'Unauthenticated.' }
    const { c } = client(json(401, body), { onUnauthorized })
    await expect(c.raw('POST', '/api/cikgu/send', {})).resolves.toEqual({
      status: 401,
      headers: {},
      body,
    })
    expect(onUnauthorized).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/cikgu/send',
      status: 401,
    })
  })

  it('rejects with NETWORK_ERROR when there is no response', async () => {
    const { c } = client(() => Promise.reject(new TransportNetworkError()))
    const err = await catchError(c.raw('POST', '/api/cikgu/send', {}))
    expect(err.code).toBe('NETWORK_ERROR')
  })
})

describe('ApiClient.blob', () => {
  it('returns the Blob and the file name', async () => {
    const file = new Blob(['a,b\n1,2'], { type: 'text/csv' })
    const { c, requests } = client(
      json(200, file, { 'Content-Disposition': 'attachment; filename="templat-soalan.csv"' }),
    )
    const res = await c.blob('/api/admin/questions/template')
    expect(res.blob).toBe(file)
    expect(res.filename).toBe('templat-soalan.csv')
    expect(requests[0]?.responseType).toBe('blob')
  })

  it('maps an error response to ApiError', async () => {
    const { c } = client(json(403, { error: { code: 'FORBIDDEN', message: 'x' } }))
    expect((await catchError(c.blob('/api/x'))).code).toBe('FORBIDDEN')
  })

  it('parses Content-Disposition variants', () => {
    expect(filenameFromContentDisposition(undefined)).toBeNull()
    expect(filenameFromContentDisposition('inline')).toBeNull()
    expect(filenameFromContentDisposition('attachment; filename=invois.pdf')).toBe('invois.pdf')
    expect(
      filenameFromContentDisposition(
        `attachment; filename="fallback.pdf"; filename*=UTF-8''invois%20%231.pdf`,
      ),
    ).toBe('invois #1.pdf')
  })
})

describe('serializeQuery', () => {
  it('drops empty values and stringifies scalars', () => {
    expect(serializeQuery(undefined)).toEqual({})
    expect(serializeQuery({ a: 0, b: false, c: '', d: null, e: [1, 2] })).toEqual({
      a: '0',
      b: 'false',
      c: '',
      e: ['1', '2'],
    })
  })
})

describe('ApiError: requestId, details and generic codes (S0-T12 part B)', () => {
  it('takes requestId and details from the error body', async () => {
    const { c } = client(
      json(
        500,
        { error: { code: 'SERVER_ERROR', message: 'x', requestId: 'req-body', details: { a: 1 } } },
        { 'x-request-id': 'req-header' },
      ),
    )
    const err = await catchError(c.post('/api/x'))
    expect(err.requestId).toBe('req-body')
    expect(err.details).toEqual({ a: 1 })
  })

  it('falls back to the x-request-id header, with and without an envelope', async () => {
    const withBody = client(
      json(409, { error: { code: 'CONFLICT', message: 'x' } }, { 'X-Request-Id': 'req-h' }),
    )
    expect((await catchError(withBody.c.post('/api/x'))).requestId).toBe('req-h')
    const bare = client(json(502, null, { 'x-request-id': 'req-b' }))
    expect((await catchError(bare.c.post('/api/x'))).requestId).toBe('req-b')
  })

  it.each([
    [400, 'BAD_REQUEST'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [422, 'VALIDATION_ERROR'],
    [500, 'SERVER_ERROR'],
    [502, 'BAD_GATEWAY'],
    [503, 'SERVICE_UNAVAILABLE'],
    [504, 'TIMEOUT'],
  ])(
    'maps a bodiless %i to %s and keeps the `HTTP <status>` marker for module copy',
    async (status, code) => {
      const { c } = client(json(status, null))
      const err = await catchError(c.post('/api/x'))
      expect(err).toMatchObject({ status, code, message: `HTTP ${status}` })
    },
  )
})

describe('ApiClient: timeout, abort and GET retry (S0-T12 part B)', () => {
  const NET = 'Anda sedang luar talian. Semak sambungan internet anda.'

  /** A transport that never answers until it is aborted. */
  function hangingAbortable() {
    const request = vi.fn(
      (_req: TransportRequest, signal?: AbortSignal) =>
        new Promise<TransportResponse>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    return { transport: { request } as Transport, request }
  }

  it('maps a transport failure to NETWORK_ERROR with the ERR-NET-01 text', async () => {
    const { c } = client(() => {
      throw new TransportNetworkError()
    })
    expect(await catchError(c.post('/api/x'))).toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: NET,
    })
  })

  it('feeds the offline state: two NETWORK_ERRORs mean offline, a response ends it (AC-ERR-4)', async () => {
    resetOfflineForTests()
    let fail = true
    const { c } = client(() => {
      if (fail) throw new TransportNetworkError()
      return { status: 200, headers: {}, body: { data: 1 } }
    })
    const { status } = useOffline()
    await catchError(c.post('/api/x'))
    expect(status.value).toBe('online')
    await catchError(c.post('/api/x'))
    expect(status.value).toBe('offline')
    fail = false
    await c.post('/api/x')
    expect(status.value).toBe('restored')
    resetOfflineForTests()
  })

  it('times out a JSON call at 30 s as NETWORK_ERROR subtype TIMEOUT', async () => {
    vi.useFakeTimers()
    try {
      const fake = hangingAbortable()
      const c = new ApiClient({ transport: fake.transport })
      const p = catchError(c.post('/api/x', { body: { a: 1 } }))
      await vi.advanceTimersByTimeAsync(29_999)
      expect(fake.request).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(await p).toMatchObject({
        status: 0,
        code: 'NETWORK_ERROR',
        subtype: 'TIMEOUT',
        message: 'Permintaan mengambil masa terlalu lama. Cuba lagi.',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses 60 s for multipart, 125 s for blob and an explicit timeoutMs', async () => {
    vi.useFakeTimers()
    try {
      const fake = hangingAbortable()
      const c = new ApiClient({ transport: fake.transport })
      let settled = false
      const up = catchError(c.multipart('/api/x', new FormData()))
      void up.then(() => (settled = true))
      await vi.advanceTimersByTimeAsync(59_999)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect((await up).subtype).toBe('TIMEOUT')

      settled = false
      const dl = catchError(c.blob('/api/x', { method: 'POST' }))
      void dl.then(() => (settled = true))
      await vi.advanceTimersByTimeAsync(124_999)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect((await dl).subtype).toBe('TIMEOUT')

      const imp = catchError(c.post('/api/x', { timeoutMs: 125_000 }))
      await vi.advanceTimersByTimeAsync(125_000)
      expect((await imp).subtype).toBe('TIMEOUT')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a caller abort an abort: not a timeout, not retried', async () => {
    const fake = hangingAbortable()
    const c = new ApiClient({ transport: fake.transport })
    const ctrl = new AbortController()
    const p = c.get('/api/x', { signal: ctrl.signal })
    ctrl.abort()
    const err: unknown = await p.catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ name: 'AbortError' })
    expect(fake.request).toHaveBeenCalledTimes(1)
  })

  it('retries a GET 503 twice (about 1 s, then 3 s) and then fails', async () => {
    vi.useFakeTimers()
    try {
      const { c, request } = client(json(503, null))
      const p = catchError(c.get('/api/x'))
      await vi.advanceTimersByTimeAsync(0)
      expect(request).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1200)
      expect(request).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(3600)
      expect(request).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(10_000)
      expect(request).toHaveBeenCalledTimes(3)
      expect(await p).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries a GET network failure and then succeeds', async () => {
    vi.useFakeTimers()
    try {
      let n = 0
      const { c, request } = client(() => {
        if (++n === 1) throw new TransportNetworkError()
        return { status: 200, headers: {}, body: { data: 5 } }
      })
      const p = c.get('/api/x')
      await vi.advanceTimersByTimeAsync(1200)
      await expect(p).resolves.toBe(5)
      expect(request).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never retries POST, PUT, PATCH or DELETE', async () => {
    for (const verb of ['post', 'put', 'patch', 'delete'] as const) {
      const { c, request } = client(json(503, null))
      await catchError(c[verb]('/api/x'))
      expect(request).toHaveBeenCalledTimes(1)
    }
  })

  it('does not retry a 500 or a 4xx GET', async () => {
    for (const status of [500, 404, 409]) {
      const { c, request } = client(json(status, null))
      await catchError(c.get('/api/x'))
      expect(request).toHaveBeenCalledTimes(1)
    }
  })

  it('retries a GET 429 with retryAfter 5 once, after 5 s', async () => {
    vi.useFakeTimers()
    try {
      let n = 0
      const { c, request } = client(() =>
        ++n === 1
          ? {
              status: 429,
              headers: {},
              body: { error: { code: 'RATE_LIMITED', message: 'x', retryAfter: 5 } },
            }
          : { status: 200, headers: {}, body: { data: 'ok' } },
      )
      const p = c.get('/api/x')
      await vi.advanceTimersByTimeAsync(4999)
      expect(request).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      await expect(p).resolves.toBe('ok')
      expect(request).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry a GET 429 with retryAfter 30 (body or header)', async () => {
    const body = client(
      json(429, { error: { code: 'RATE_LIMITED', message: 'x', retryAfter: 30 } }),
    )
    expect((await catchError(body.c.get('/api/x'))).retryAfter).toBe(30)
    expect(body.request).toHaveBeenCalledTimes(1)
    const header = client(json(429, null, { 'retry-after': '30' }))
    await catchError(header.c.get('/api/x'))
    expect(header.request).toHaveBeenCalledTimes(1)
  })

  it('applies 20 % jitter to the first retry delay (800 to 1200 ms)', async () => {
    vi.useFakeTimers()
    const rnd = vi.spyOn(Math, 'random')
    try {
      for (const [r, delay] of [
        [0, 800],
        [0.5, 1000],
        [1, 1200],
      ] as const) {
        rnd.mockReturnValue(r)
        const { c, request } = client(json(503, null))
        const p = catchError(c.get('/api/x'))
        await vi.advanceTimersByTimeAsync(delay - 1)
        expect(request).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(1)
        expect(request).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(10_000)
        await p
      }
    } finally {
      rnd.mockRestore()
      vi.useRealTimers()
    }
  })

  it('stops retrying when the caller aborts during the wait', async () => {
    vi.useFakeTimers()
    try {
      const { c, request } = client(json(503, null))
      const ctrl = new AbortController()
      const p = c.get('/api/x', { signal: ctrl.signal })
      const assertion = expect(p).rejects.toMatchObject({ name: 'AbortError' })
      await vi.advanceTimersByTimeAsync(0)
      ctrl.abort()
      await assertion
      await vi.advanceTimersByTimeAsync(10_000)
      expect(request).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
