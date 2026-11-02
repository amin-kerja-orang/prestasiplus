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
      [400, 'VALIDATION_ERROR'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [429, 'RATE_LIMITED'],
      [503, 'SERVER_ERROR'],
    ]
    for (const [status, code] of cases) {
      const { c } = client(json(status, null))
      const err = await catchError(c.get('/api/x'))
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
      expect(err.message).toBe('Terlalu banyak percubaan. Cuba sebentar lagi.')
      expect(err.retryAfter).toBe(30)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.each([
    ['login', 'Terlalu banyak percubaan. Sila cuba sebentar lagi.'],
    ['IC reset', 'Terlalu banyak percubaan. Sila cuba lagi dalam 15 minit.'],
  ])('keeps the server BM 429 message in http mode (%s)', async (_label, message) => {
    vi.stubEnv('VITE_API_MODE', 'http')
    try {
      const { c } = client(json(429, { error: { code: 'RATE_LIMITED', message, retryAfter: 900 } }))
      const err = await catchError(c.post('/api/auth/login'))
      expect(err.message).toBe(message)
      expect(err.retryAfter).toBe(900)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['English default, other case', 'too many requests'],
  ])('falls back to the BM copy for a 429 message that is %s in http mode', async (_l, message) => {
    vi.stubEnv('VITE_API_MODE', 'http')
    try {
      const { c } = client(json(429, { error: { code: 'RATE_LIMITED', message } }))
      const err = await catchError(c.post('/api/auth/login'))
      expect(err.message).toBe('Terlalu banyak percubaan. Cuba sebentar lagi.')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('leaves the 429 message untouched in mock mode', async () => {
    const { c } = client(
      json(429, { error: { code: 'RATE_LIMITED', message: 'Too Many Attempts.', retryAfter: 30 } }),
    )
    const err = await catchError(c.post('/api/auth/login'))
    expect(err.message).toBe('Too Many Attempts.')
  })

  it('falls back to the Retry-After header for retryAfter', async () => {
    const { c } = client(
      json(429, { error: { code: 'RATE_LIMITED', message: 'x' } }, { 'Retry-After': '42' }),
    )
    const err = await catchError(c.post('/api/auth/login'))
    expect(err.retryAfter).toBe(42)
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
    const err = await catchError(c.get('/api/x'))
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' })
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
