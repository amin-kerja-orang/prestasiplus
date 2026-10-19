import { describe, expect, it, vi } from 'vitest'

import { buildUrl, createHttpTransport } from '../http-transport'
import { TransportNetworkError } from '../transport'

function fetchReturning(response: Response) {
  return vi.fn<typeof fetch>(() => Promise.resolve(response))
}

describe('HttpTransport', () => {
  it('builds the URL from base, path and query (repeated keys for arrays)', () => {
    expect(buildUrl('https://api.test/', '/api/x', { a: '1', b: ['2', '3'] })).toBe(
      'https://api.test/api/x?a=1&b=2&b=3',
    )
    expect(buildUrl('', '/api/x', undefined)).toBe('/api/x')
  })

  it('sends JSON and parses a JSON response with lower-case headers', async () => {
    const fetchMock = fetchReturning(
      new Response(JSON.stringify({ data: { id: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Trace': 't' },
      }),
    )
    const transport = createHttpTransport({ baseUrl: 'https://api.test', fetch: fetchMock })
    const res = await transport.request({
      method: 'POST',
      url: '/api/items',
      query: { page: '2' },
      body: { name: 'X' },
      headers: { accept: 'application/json', 'content-type': 'application/json' },
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { id: 1 } })
    expect(res.headers['x-trace']).toBe('t')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.test/api/items?page=2')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"name":"X"}')
  })

  it('resolves (does not throw) for an error status, with the parsed error body', async () => {
    const body = { error: { code: 'NOT_FOUND', message: 'Tiada.' } }
    const transport = createHttpTransport({
      fetch: fetchReturning(
        new Response(JSON.stringify(body), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })
    const res = await transport.request({ method: 'GET', url: '/api/x', headers: {} })
    expect(res).toMatchObject({ status: 404, body })
  })

  it('returns null for 204 and a Blob for a successful blob request', async () => {
    const t1 = createHttpTransport({ fetch: fetchReturning(new Response(null, { status: 204 })) })
    expect((await t1.request({ method: 'DELETE', url: '/api/x', headers: {} })).body).toBeNull()

    const t2 = createHttpTransport({
      fetch: fetchReturning(
        new Response('a,b', { status: 200, headers: { 'content-type': 'text/csv' } }),
      ),
    })
    const res = await t2.request({
      method: 'GET',
      url: '/api/x',
      headers: {},
      responseType: 'blob',
    })
    expect(res.body).toBeInstanceOf(Blob)
    expect(await (res.body as Blob).text()).toBe('a,b')
  })

  it('passes FormData through and drops the JSON content-type', async () => {
    const fetchMock = fetchReturning(new Response(null, { status: 204 }))
    const form = new FormData()
    form.append('a', '1')
    await createHttpTransport({ fetch: fetchMock }).request({
      method: 'POST',
      url: '/api/upload',
      body: form,
      headers: { 'content-type': 'application/json' },
    })
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.body).toBe(form)
    expect(init?.headers).toEqual({})
  })

  it('turns a fetch failure into TransportNetworkError and re-throws aborts', async () => {
    const failing = createHttpTransport({
      fetch: vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch'))),
    })
    await expect(
      failing.request({ method: 'GET', url: '/api/x', headers: {} }),
    ).rejects.toBeInstanceOf(TransportNetworkError)

    const abortError = new DOMException('Aborted', 'AbortError')
    const aborting = createHttpTransport({
      fetch: vi.fn<typeof fetch>(() => Promise.reject(abortError)),
    })
    await expect(aborting.request({ method: 'GET', url: '/api/x', headers: {} })).rejects.toBe(
      abortError,
    )
  })
})
