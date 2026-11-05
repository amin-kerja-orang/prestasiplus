/**
 * `ApiError` and error codes (master SRS §7.3; overview §6.2).
 *
 * Any non-2xx response of a normal client call becomes an `ApiError`. The `code` is taken from the
 * `{ error: { code } }` body; module codes (e.g. `ACCOUNT_INACTIVE`, `TRIAL_EXHAUSTED`,
 * `NO_WRONG_QUESTIONS`) pass through unchanged. When a body carries no code, it
 * is derived from the status (`codeForStatus`). `NETWORK_ERROR` is client-only: no response at all.
 */

import { isErrorBody } from './envelope'
import { isHttpMode } from './mode'
import type { HttpMethod } from './transport'

export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  SERVER_ERROR: 'SERVER_ERROR',
  /** 429 with `retryAfter` seconds (M01 BR-23, M01 SRS Q2). */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Client-only: the transport produced no response (status 0). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** 400 (a malformed body is answered 422 by the server; a raw 400 is a developer error). */
  BAD_REQUEST: 'BAD_REQUEST',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  /** 504, also used with `NETWORK_ERROR` subtype `TIMEOUT` for the client's own timer. */
  TIMEOUT: 'TIMEOUT',
} as const

export type KnownApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

/** A known code, or a module-specific code carried in `error.code`. */
export type ApiErrorCode = KnownApiErrorCode | (string & {})

/** Status → code, used only when an error body has no `error.code`. */
export function codeForStatus(status: number): KnownApiErrorCode {
  switch (status) {
    case 0:
      return API_ERROR_CODES.NETWORK_ERROR
    case 400:
      return API_ERROR_CODES.BAD_REQUEST
    case 422:
      return API_ERROR_CODES.VALIDATION_ERROR
    case 401:
      return API_ERROR_CODES.UNAUTHORIZED
    case 403:
      return API_ERROR_CODES.FORBIDDEN
    case 404:
      return API_ERROR_CODES.NOT_FOUND
    case 409:
      return API_ERROR_CODES.CONFLICT
    case 413:
      return API_ERROR_CODES.PAYLOAD_TOO_LARGE
    case 415:
      return API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE
    case 429:
      return API_ERROR_CODES.RATE_LIMITED
    case 502:
      return API_ERROR_CODES.BAD_GATEWAY
    case 503:
      return API_ERROR_CODES.SERVICE_UNAVAILABLE
    case 504:
      return API_ERROR_CODES.TIMEOUT
    default:
      return API_ERROR_CODES.SERVER_ERROR
  }
}

export interface ApiErrorInit {
  status: number
  code: ApiErrorCode
  message: string
  fields?: Record<string, string>
  retryAfter?: number
  body?: unknown
  method?: HttpMethod
  url?: string
  cause?: unknown
  /** Server correlation id (`error.requestId`, else the `x-request-id` header). */
  requestId?: string
  /** The body's `error.details`, untouched. */
  details?: unknown
  /** `'TIMEOUT'` on a `NETWORK_ERROR` raised by the client's own timer (ERR-NET-02). */
  subtype?: 'TIMEOUT'
}

export class ApiError extends Error {
  override readonly name = 'ApiError'
  /** HTTP status; `0` for `NETWORK_ERROR`. */
  readonly status: number
  readonly code: ApiErrorCode
  /** Field name → BM message, for `VALIDATION_ERROR`. */
  readonly fields: Record<string, string> | undefined
  /** Seconds until a retry is allowed, for `RATE_LIMITED`. */
  readonly retryAfter: number | undefined
  /** The untouched response body (`undefined` for `NETWORK_ERROR`). */
  readonly body: unknown
  readonly method: HttpMethod | undefined
  readonly url: string | undefined
  readonly requestId: string | undefined
  readonly details: unknown
  readonly subtype: 'TIMEOUT' | undefined

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause })
    this.status = init.status
    this.code = init.code
    this.fields = init.fields
    this.retryAfter = init.retryAfter
    this.body = init.body
    this.method = init.method
    this.url = init.url
    this.requestId = init.requestId
    this.details = init.details
    this.subtype = init.subtype
  }
}

/** `true` when `err` is an `ApiError`, optionally with one of the given codes. */
export function isApiError(err: unknown, ...codes: ApiErrorCode[]): err is ApiError {
  return err instanceof ApiError && (codes.length === 0 || codes.includes(err.code))
}

/** From several load errors: a `RATE_LIMITED` one if any, else the first non-null (so the countdown shows). */
export function preferRateLimited(...errors: unknown[]): unknown {
  const present = errors.filter((e) => e !== null && e !== undefined)
  return present.find((e) => isApiError(e, API_ERROR_CODES.RATE_LIMITED)) ?? present[0] ?? null
}

/** Parses a `Retry-After` header given in seconds (the HTTP-date form is not used by the API). */
export function parseRetryAfterHeader(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return undefined
  return Number(trimmed)
}

function readFields(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const fields: Record<string, string> = {}
  for (const [key, message] of Object.entries(value as Record<string, unknown>)) {
    if (typeof message === 'string') fields[key] = message
    // Laravel-style arrays: keep the first message, as the live error lists show one per field.
    else if (Array.isArray(message) && typeof message[0] === 'string') fields[key] = message[0]
  }
  return fields
}

/** BM copy for a rate-limited response (ERR-RATE-01); the backend's 429 envelope may carry English. */
export const RATE_LIMITED_MESSAGE_BM = 'Terlalu banyak percubaan. Sila cuba sebentar lagi.'

/** ERR-NET-01 (banner text): no response at all. */
export const NETWORK_ERROR_MESSAGE_BM = 'Anda sedang luar talian. Semak sambungan internet anda.'
/** ERR-NET-02 / ERR-SYS-04: the client timer or a 504. */
export const TIMEOUT_MESSAGE_BM = 'Permintaan mengambil masa terlalu lama. Cuba lagi.'

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Builds the `ApiError` for a non-2xx response. */
export function errorFromResponse(res: {
  status: number
  headers: Record<string, string>
  body: unknown
  method?: HttpMethod
  url?: string
}): ApiError {
  const headerRetry = parseRetryAfterHeader(res.headers['retry-after'])
  // body `retryAfter`, then the header; the "else 30 s" display rule lives in DsLoadError, not here.
  const headerRequestId = readString(res.headers['x-request-id'])
  const base = { status: res.status, body: res.body, method: res.method, url: res.url }

  if (isErrorBody(res.body)) {
    const { code, message, fields, retryAfter } = res.body.error
    const extra = res.body.error as { requestId?: unknown; details?: unknown }
    return new ApiError({
      ...base,
      code,
      requestId: readString(extra.requestId) ?? headerRequestId,
      details: extra.details,
      // Http mode only (mock unchanged): map by code/status, never by the English text.
      message:
        isHttpMode() && (code === API_ERROR_CODES.RATE_LIMITED || res.status === 429)
          ? RATE_LIMITED_MESSAGE_BM
          : message,
      fields: readFields(fields),
      retryAfter: typeof retryAfter === 'number' ? retryAfter : headerRetry,
    })
  }

  // No master-SRS error body: derive the code from the status. The message stays the developer
  // marker `HTTP <status>`: module helpers test for it (/^HTTP \d+$/) and show their own SRS copy.
  return new ApiError({
    ...base,
    code: codeForStatus(res.status),
    message: `HTTP ${res.status}`,
    requestId: headerRequestId,
    retryAfter: headerRetry,
  })
}
