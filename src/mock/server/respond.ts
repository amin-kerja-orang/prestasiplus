/**
 * Responders (overview §6.4). Every handler answers with one of these, so the envelope and error
 * shapes of master SRS §7.2/§7.3 are produced in one place:
 *
 * | Responder | Status | Body |
 * |---|---|---|
 * | `ok(data, extra?)` | 200 | `{data, ...extra}` |
 * | `created(data, extra?)` | 201 | `{data, ...extra}` |
 * | `noContent()` | 204 | `null` |
 * | `list(items, meta, extra?)` | 200 | `{data: items, meta, ...extra}` |
 * | `paginate(...)`, `paged(...)`, `unpaged(...)` | 200 | list envelope, see `./paginate.ts` |
 * | `fail(status, code, message, fields?, extra?)` | status | `{error: {code, message, fields?, retryAfter?}}` |
 * | `raw(status, body, headers?)` | status | `body` untouched (live-shaped exceptions, `raw: true`) |
 * | `blob(blob, filename)` | 200 | the `Blob`, with `Content-Disposition` |
 *
 * `abort(...)` throws a `MockHttpError`; the server turns it into that error response after rolling
 * back the request's transaction. Use it deep inside repositories; prefer `return fail(...)` in
 * handlers.
 */

import type { BaseListMeta, ErrorPayload } from '@/api/envelope'
import { API_ERROR_CODES, type ApiErrorCode } from '@/api/errors'

import type { MockResponse } from './types'

/**
 * Default messages for the generic errors raised by the mock core itself (unknown route, auth
 * middleware, unexpected handler error). No live copy was observed for these: they are the Laravel
 * API defaults, like the M01 §5 validation copy. Pages show their own SRS copy for such cases.
 */
export const DEFAULT_ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthenticated.',
  FORBIDDEN: 'This action is unauthorized.',
  NOT_FOUND: 'Not Found.',
  SERVER_ERROR: 'Server Error',
  RATE_LIMITED: 'Too Many Attempts.',
  CONFLICT: 'Conflict.',
  VALIDATION_ERROR: 'The given data was invalid.',
} as const

/** Status of each known error code (used by `failNext(path, code)` and `fail` shortcuts). */
export const STATUS_FOR_CODE: Readonly<Record<string, number>> = {
  [API_ERROR_CODES.VALIDATION_ERROR]: 422,
  [API_ERROR_CODES.UNAUTHORIZED]: 401,
  [API_ERROR_CODES.FORBIDDEN]: 403,
  [API_ERROR_CODES.NOT_FOUND]: 404,
  [API_ERROR_CODES.CONFLICT]: 409,
  [API_ERROR_CODES.RATE_LIMITED]: 429,
  [API_ERROR_CODES.SERVER_ERROR]: 500,
}

const JSON_HEADERS = (): Record<string, string> => ({ 'content-type': 'application/json' })

function envelope(data: unknown, extra: Record<string, unknown> | undefined) {
  if (extra && 'data' in extra) throw new Error("mock responder: `extra` must not contain 'data'")
  return { data, ...extra }
}

export function ok(data: unknown, extra?: Record<string, unknown>): MockResponse {
  return { status: 200, headers: JSON_HEADERS(), body: envelope(data, extra) }
}

export function created(data: unknown, extra?: Record<string, unknown>): MockResponse {
  return { status: 201, headers: JSON_HEADERS(), body: envelope(data, extra) }
}

export function noContent(): MockResponse {
  return { status: 204, headers: {}, body: null }
}

/** A list envelope with an explicit `meta` (see `./paginate.ts` for computed meta). */
export function list<M extends BaseListMeta>(
  items: readonly unknown[],
  meta: M,
  extra?: Record<string, unknown>,
): MockResponse {
  if (extra && ('meta' in extra || 'data' in extra)) {
    throw new Error("mock responder: `extra` must not contain 'data' or 'meta'")
  }
  return { status: 200, headers: JSON_HEADERS(), body: { data: [...items], meta, ...extra } }
}

export interface FailExtra {
  /** Seconds, for `429 RATE_LIMITED`; also sent as the `Retry-After` header. */
  retryAfter?: number
  headers?: Record<string, string>
}

export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
  extra: FailExtra = {},
): MockResponse {
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new RangeError(`fail(): status must be 4xx or 5xx, got ${String(status)}`)
  }
  const error: ErrorPayload = { code, message }
  if (fields && Object.keys(fields).length > 0) error.fields = { ...fields }
  const headers = JSON_HEADERS()
  if (extra.retryAfter !== undefined) {
    error.retryAfter = extra.retryAfter
    headers['retry-after'] = String(extra.retryAfter)
  }
  for (const [name, value] of Object.entries(extra.headers ?? {}))
    headers[name.toLowerCase()] = value
  return { status, headers, body: { error } }
}

export const unauthorized = (message: string = DEFAULT_ERROR_MESSAGES.UNAUTHORIZED) =>
  fail(401, API_ERROR_CODES.UNAUTHORIZED, message)
export const forbidden = (
  message: string = DEFAULT_ERROR_MESSAGES.FORBIDDEN,
  code?: ApiErrorCode,
) => fail(403, code ?? API_ERROR_CODES.FORBIDDEN, message)
export const notFound = (message: string = DEFAULT_ERROR_MESSAGES.NOT_FOUND) =>
  fail(404, API_ERROR_CODES.NOT_FOUND, message)
export const conflict = (message: string = DEFAULT_ERROR_MESSAGES.CONFLICT, code?: ApiErrorCode) =>
  fail(409, code ?? API_ERROR_CODES.CONFLICT, message)
export const serverError = (message: string = DEFAULT_ERROR_MESSAGES.SERVER_ERROR) =>
  fail(500, API_ERROR_CODES.SERVER_ERROR, message)
export const rateLimited = (
  retryAfter: number,
  message: string = DEFAULT_ERROR_MESSAGES.RATE_LIMITED,
) => fail(429, API_ERROR_CODES.RATE_LIMITED, message, undefined, { retryAfter })
/** `422 VALIDATION_ERROR`. `message` defaults to the Laravel summary of the first field message. */
export function validationError(fields: Record<string, string>, message?: string): MockResponse {
  return fail(422, API_ERROR_CODES.VALIDATION_ERROR, message ?? summarizeFields(fields), fields)
}

/** Laravel `ValidationException::summarize`: the first message, plus "(and N more error(s))". */
export function summarizeFields(fields: Record<string, string>): string {
  const messages = Object.values(fields)
  const [first] = messages
  if (first === undefined) return DEFAULT_ERROR_MESSAGES.VALIDATION_ERROR
  const more = messages.length - 1
  if (more === 0) return first
  return `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}

/** A body sent untouched (live-shaped exceptions: `{ok, message}`, bare arrays, …). */
export function raw(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): MockResponse {
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    throw new RangeError(`raw(): invalid status ${String(status)}`)
  }
  const out: Record<string, string> = body === null || body === undefined ? {} : JSON_HEADERS()
  for (const [name, value] of Object.entries(headers)) out[name.toLowerCase()] = value
  return { status, headers: out, body: body ?? null }
}

/** RFC 6266 `Content-Disposition` with an ASCII fallback and a UTF-8 `filename*`. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

/** A file download. */
export function blob(data: Blob, filename: string): MockResponse {
  return {
    status: 200,
    headers: {
      'content-type': data.type || 'application/octet-stream',
      'content-disposition': contentDisposition(filename),
    },
    body: data,
  }
}

/** Thrown by `abort(...)`; carries the response the server sends after rolling back. */
export class MockHttpError extends Error {
  override readonly name = 'MockHttpError'
  readonly response: MockResponse

  constructor(response: MockResponse) {
    const error = (response.body as { error?: { message?: unknown } } | null)?.error
    super(typeof error?.message === 'string' ? error.message : `HTTP ${String(response.status)}`)
    this.response = response
  }
}

/** Throws a `MockHttpError` for `response`, or for `fail(status, code, message, fields)`. */
export function abort(response: MockResponse): never
export function abort(
  status: number,
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
): never
export function abort(
  statusOrResponse: number | MockResponse,
  code?: ApiErrorCode,
  message?: string,
  fields?: Record<string, string>,
): never {
  if (typeof statusOrResponse === 'number') {
    throw new MockHttpError(fail(statusOrResponse, code ?? 'SERVER_ERROR', message ?? '', fields))
  }
  throw new MockHttpError(statusOrResponse)
}

export function isMockResponse(value: unknown): value is MockResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MockResponse).status === 'number' &&
    typeof (value as MockResponse).headers === 'object' &&
    (value as MockResponse).headers !== null &&
    'body' in value
  )
}

/**
 * A body as it would cross the network: a JSON clone (`Date`s become strings, `undefined` fields
 * disappear), `Blob`s unchanged, `null` for no body.
 */
export function cloneBody(body: unknown): unknown {
  if (body === undefined || body === null) return null
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body
  return JSON.parse(JSON.stringify(body)) as unknown
}

/** A copy of `r` whose body is cloned with `cloneBody`. */
export function cloneResponse(r: MockResponse): MockResponse {
  return { status: r.status, headers: { ...r.headers }, body: cloneBody(r.body) }
}
