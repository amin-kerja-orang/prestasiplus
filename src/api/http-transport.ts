/**
 * HttpTransport (overview §6.1, ADR-0004): `fetch` to the real REST backend.
 *
 * Unused in this prototype (`VITE_API_MODE=mock`); `bootstrap.ts` installs it when the backend
 * phase sets `VITE_API_MODE=http`. It sends the same `TransportRequest` the mock receives:
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
  credentials?: RequestCredentials
}

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
      // The browser sets the multipart boundary itself.
      if (req.body instanceof FormData) delete headers['content-type']

      const init: RequestInit = { method: req.method, headers }
      const body = encodeBody(req.body)
      if (body !== undefined) init.body = body
      if (signal) init.signal = signal
      if (options.credentials) init.credentials = options.credentials

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
      return { status: res.status, headers: responseHeaders, body: await decodeBody(res, req) }
    },
  }
}
