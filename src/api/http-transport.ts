/**
 * HttpTransport (overview §6.1, ADR-0004): `fetch` to the real REST backend.
 *
 * `bootstrap.ts` installs it when `VITE_API_MODE=http` (cookie session + CSRF header, V2-T31). It sends the same `TransportRequest` the mock receives:
 * - URL = `baseUrl` + path + query (repeated keys for array values);
 * - body: `FormData`/`Blob`/string as-is, anything else as JSON;
 * - response: JSON (or text) for errors and `responseType: 'json'`, a `Blob` for a successful
 *   `responseType: 'blob'`, `null` for an empty body;
 * - a `fetch` rejection becomes `TransportNetworkError`, except aborts, which are re-thrown.
 */

import type { Transport, TransportQuery, TransportRequest, TransportResponse } from './transport'
import { TransportNetworkError } from './transport'

export interface HttpTransportOptions {
  /** Prefix for every path, e.g. `https://api.example.test`. Defaults to `''` (same origin). */
  baseUrl?: string
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Default `'include'`: the real API session is the HttpOnly `pp_session` cookie (V2-T31 T1). */
  credentials?: RequestCredentials
  /**
   * CSRF token for the cookie session (V2-T31 T2). When it returns a value, every non-safe request
   * (not GET/HEAD/OPTIONS) carries it as `x-csrf-token`; the API answers 403 `CSRF_INVALID` otherwise.
   */
  csrfToken?: () => string | null | undefined
  /**
   * Default `true`. Set `false` for the cookie-session API: the client's `Authorization: Bearer`
   * header (a mock-era placeholder token) is then not sent.
   */
  sendAuthorization?: boolean
  /** Called with the `x-request-id` of every response that has one (V2-T31 T4). */
  onRequestId?: (info: { requestId: string; method: string; url: string; status: number }) => void
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function buildUrl(baseUrl: string, path: string, query: TransportQuery | undefined): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item)
    else params.append(key, value)
  }
  const qs = params.toString()
  return `${baseUrl.replace(/\/+$/, '')}${path}${qs ? `?${qs}` : ''}`
}

function encodeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined
  if (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    typeof body === 'string'
  ) {
    return body
  }
  return JSON.stringify(body)
}

async function decodeBody(res: Response, req: TransportRequest): Promise<unknown> {
  if (res.status === 204 || res.status === 205) return null
  if (res.ok && req.responseType === 'blob') return res.blob()
  const text = await res.text()
  if (text === '') return null
  if ((res.headers.get('content-type') ?? '').includes('json')) {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }
  return text
}

export function createHttpTransport(options: HttpTransportOptions = {}): Transport {
  const baseUrl = options.baseUrl ?? ''
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init))

  return {
    async request(req: TransportRequest, signal?: AbortSignal): Promise<TransportResponse> {
      const headers = { ...req.headers }
      if (options.sendAuthorization === false) {
        for (const name of Object.keys(headers)) {
          if (name.toLowerCase() === 'authorization') delete headers[name]
        }
      }
      if (!SAFE_METHODS.has(req.method)) {
        const csrf = options.csrfToken?.()
        if (csrf) headers['x-csrf-token'] = csrf
      }
      // The browser sets the multipart boundary itself.
      if (req.body instanceof FormData) delete headers['content-type']

      const init: RequestInit = { method: req.method, headers }
      const body = encodeBody(req.body)
      if (body !== undefined) init.body = body
      if (signal) init.signal = signal
      init.credentials = options.credentials ?? 'include'

      let res: Response
      try {
        res = await doFetch(buildUrl(baseUrl, req.url, req.query), init)
      } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) throw err
        throw new TransportNetworkError(err instanceof Error ? err.message : undefined, {
          cause: err,
        })
      }

      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, name) => {
        responseHeaders[name.toLowerCase()] = value
      })
      const requestId = responseHeaders['x-request-id']
      if (requestId) {
        options.onRequestId?.({ requestId, method: req.method, url: req.url, status: res.status })
      }
      return { status: res.status, headers: responseHeaders, body: await decodeBody(res, req) }
    },
  }
}
