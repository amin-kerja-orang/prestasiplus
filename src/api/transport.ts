/**
 * Transport contract (overview §6.1, ADR-0004).
 *
 * The `ApiClient` builds a `TransportRequest` and hands it to whichever `Transport` was installed at
 * boot (`src/app/bootstrap.ts`, selected by `VITE_API_MODE`):
 * - `MockTransport` (mock core, F-06): dispatches in-process to the mock router and applies
 *   latency, fault injection and the request log;
 * - `HttpTransport` (`./http-transport.ts`): `fetch` to the real backend (backend phase).
 *
 * A transport never throws for an HTTP error status: it resolves with the status and body, and the
 * client decides what an error is. It rejects only when no response exists at all (network failure,
 * abort). Mock network faults should reject with `TransportNetworkError`.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Query parameters after serialisation: plain strings, or repeated values. */
export type TransportQuery = Record<string, string | string[]>

/** How the caller wants a successful body: parsed JSON (default) or a binary `Blob` download. */
export type ResponseType = 'json' | 'blob'

export interface TransportRequest {
  method: HttpMethod
  /** Path starting with `/api/...`. It carries no query string; the query goes in `query`. */
  url: string
  query?: TransportQuery
  /** JSON-serialisable value, or `FormData` for multipart. `undefined` means no body. */
  body?: unknown
  /** Request headers, lower-case names (e.g. `authorization`, `accept`). */
  headers: Record<string, string>
  /** Defaults to `'json'`. Error responses are always parsed as JSON where possible. */
  responseType?: ResponseType
}

export interface TransportResponse {
  status: number
  /** Response headers, lower-case names (e.g. `retry-after`, `content-disposition`). */
  headers: Record<string, string>
  /** Parsed JSON value, a `Blob` for downloads, or `null` for an empty body (204). */
  body: unknown
}

export interface Transport {
  request(req: TransportRequest, signal?: AbortSignal): Promise<TransportResponse>
}

/**
 * Thrown (rejected) by a transport when the request produced no HTTP response. The client maps any
 * such rejection to `ApiError` with code `NETWORK_ERROR`, except aborts, which are re-thrown.
 */
export class TransportNetworkError extends Error {
  override readonly name = 'TransportNetworkError'

  constructor(message = 'Sambungan terputus. Semak internet anda dan cuba semula.', options?: { cause?: unknown }) {
    super(message, options)
  }
}
