/**
 * ApiClient (overview §6.2, ADR-0004).
 *
 * Typed module API functions (`src/modules/<slug>/api`) call the shared `api` instance. It builds
 * the request (Bearer token, query serialisation, JSON or multipart body), sends it through the
 * installed `Transport`, and then:
 * - **unwraps the envelope** (default): a list `{data, meta}` resolves to `{data, meta}`; a single
 *   `{data}` resolves to `data`; an empty body (204) resolves to `undefined`; any other 2xx body is
 *   returned unchanged;
 * - with the option `raw: true`, resolves to the 2xx body untouched (live-shaped bodies the SRS
 *   keeps on purpose, e.g. `{ok, message}` or bare arrays, or a `{data, ...extras}` envelope whose
 *   extras the page needs). Errors are still mapped to `ApiError`;
 * - maps every non-2xx status to `ApiError` (`./errors.ts`) and a missing response to
 *   `NETWORK_ERROR`. Aborts (`AbortSignal`) are re-thrown unchanged;
 * - applies the **401 policy** (FR-M01-14): any 401 outside `/api/auth/*` calls the injected
 *   `onUnauthorized` hook (the session store clears the session and does `replace('/login')`)
 *   before the call settles. `/api/auth/*` pages handle their own 401s.
 *
 * **Exception: `api.raw(method, url, body?)`** (M13 XR-M13-05 / SQ-M13-01). Sends through the same
 * transport (so MockTransport still applies auth, latency and fault injection), keeps the Bearer
 * token and the 401 policy, but resolves to `{status, headers, body}` for **every** HTTP status: no
 * `{data}` unwrap and no `ApiError` mapping. Only a missing response still rejects (`NETWORK_ERROR`
 * `ApiError`, or the abort error). It exists so `POST /api/cikgu/send` can replicate the live body
 * (no envelope, snake_case, `error` as a string). Use it only where an SRS documents the exception.
 *
 * Latency, fault injection and the request log belong to the transport (MockTransport, F-06), not to
 * this client, so they apply identically to every method here.
 */

import type { ListResult } from './envelope'
import { isEnvelope, isListEnvelope } from './envelope'
import {
  API_ERROR_CODES,
  ApiError,
  NETWORK_ERROR_MESSAGE_BM,
  TIMEOUT_MESSAGE_BM,
  errorFromResponse,
  parseRetryAfterHeader,
} from './errors'
import { reportNetworkError, reportNetworkOk } from './offline'
import type {
  HttpMethod,
  ResponseType,
  Transport,
  TransportQuery,
  TransportRequest,
  TransportResponse,
} from './transport'

type QueryScalar = string | number | boolean
/** `null`/`undefined` values and empty arrays are left out of the query. */
export type QueryValue = QueryScalar | null | undefined | readonly QueryScalar[]
/** Query params with the SRS camelCase API names (module `api/` functions map live snake_case). */
export type QueryParams = Record<string, QueryValue>

export interface RequestOptions {
  query?: QueryParams
  /** JSON-serialisable value, or `FormData` for multipart. */
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Resolve to the 2xx body untouched (no envelope unwrap). Errors are still `ApiError`. */
  raw?: boolean
  /** `'blob'` for downloads; prefer `api.blob()`, which also returns the file name. */
  responseType?: ResponseType
  /**
   * Client timeout in ms (X10.3.4). Default: 30 s JSON, 60 s multipart/Blob upload, 125 s blob
   * download. Pass `IMPORT_TIMEOUT_MS` for import calls. A caller `signal` always wins.
   */
  timeoutMs?: number
}

export type GetOptions = Omit<RequestOptions, 'body'>

export interface RawRequestOptions {
  query?: QueryParams
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
}

/** X10.3.4 client timeouts (ms). */
export const JSON_TIMEOUT_MS = 30_000
/** Uploads: `fetch` gives no upload progress, so this is an overall timer, not a no-progress timer. */
export const UPLOAD_TIMEOUT_MS = 60_000
/** Export / blob download and import calls (120 s plus 5 s margin). */
export const IMPORT_TIMEOUT_MS = 125_000
export const BLOB_TIMEOUT_MS = 125_000

/** X10.3.4 automatic retry: at most 2 retries, after about 1 s and 3 s (each with 20 % jitter). */
const RETRY_DELAYS_MS = [1000, 3000] as const
const RETRY_JITTER = 0.2
/** A 429 is retried only when its `retryAfter` is at most this many seconds. */
const MAX_RETRY_AFTER_S = 10

/** What `api.raw()` resolves to, for any HTTP status. */
export interface RawResponse<B = unknown> {
  status: number
  headers: Record<string, string>
  body: B
}

export interface BlobResult {
  blob: Blob
  /** From `Content-Disposition`; `null` when the response names no file. */
  filename: string | null
}

export interface UnauthorizedContext {
  method: HttpMethod
  url: string
  status: number
}

export type UnauthorizedHandler = (ctx: UnauthorizedContext) => void | Promise<void>

export interface ApiClientConfig {
  /** Installed by `src/app/bootstrap.ts` (MockTransport or HttpTransport). */
  transport: Transport | null
  /** Current session token (session store). `null`/`undefined`/empty = no `Authorization` header. */
  getToken: () => string | null | undefined
  /** 401 policy hook (session store). */
  onUnauthorized: UnauthorizedHandler | null
}

const AUTH_PATH = /^\/api\/auth(?:\/|$)/

/** `true` for `/api/auth/*` paths, whose pages handle 401 themselves (no global redirect). */
export function isAuthPath(url: string): boolean {
  return AUTH_PATH.test(url)
}

/** Serialises query params: drops `null`/`undefined`/empty arrays, stringifies scalars. */
export function serializeQuery(query: QueryParams | undefined): TransportQuery {
  const out: TransportQuery = {}
  if (!query) return out
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      const items = (value as readonly QueryScalar[]).map((item) => String(item))
      if (items.length > 0) out[key] = items
    } else {
      out[key] = String(value)
    }
  }
  return out
}

/** Splits `'/api/x?a=1&a=2'` into a clean path and its query (repeated keys become arrays). */
function splitUrl(url: string): { path: string; query: TransportQuery } {
  const index = url.indexOf('?')
  if (index === -1) return { path: url, query: {} }
  const query: TransportQuery = {}
  for (const [key, value] of new URLSearchParams(url.slice(index + 1))) {
    const existing = query[key]
    if (existing === undefined) query[key] = value
    else query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
  }
  return { path: url.slice(0, index), query }
}

/** Reads the file name from a `Content-Disposition` header (`filename*=UTF-8''…` wins). */
export function filenameFromContentDisposition(value: string | undefined): string | null {
  if (!value) return null
  const extended = /filename\*\s*=\s*(?:utf-8|iso-8859-1)?'[^']*'([^;]+)/i.exec(value)
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // Malformed percent-encoding: fall back to the plain parameter.
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(value)
  const name = (plain?.[1] ?? plain?.[2] ?? '').trim()
  return name === '' ? null : name
}

function isBinaryBody(body: unknown): boolean {
  return (
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof Blob !== 'undefined' && body instanceof Blob)
  )
}

function isAbort(err: unknown, signal: AbortSignal | undefined): boolean {
  return (
    signal?.aborted === true ||
    (typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError')
  )
}

function jittered(ms: number): number {
  return Math.round(ms * (1 + (Math.random() * 2 - 1) * RETRY_JITTER))
}

/** Resolves after `ms`; rejects with an `AbortError` as soon as `signal` aborts. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Seconds to wait before retrying `res`, or `null` when it must not be retried. */
function retryWaitMs(res: TransportResponse, attempt: number): number | null {
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return jittered(RETRY_DELAYS_MS[attempt] as number)
  }
  if (res.status === 429) {
    const body = res.body as { error?: { retryAfter?: unknown } } | null
    const fromBody = body?.error?.retryAfter
    const seconds =
      typeof fromBody === 'number' ? fromBody : parseRetryAfterHeader(res.headers['retry-after'])
    if (seconds !== undefined && seconds <= MAX_RETRY_AFTER_S) return seconds * 1000
  }
  return null
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300
}

function unwrap(body: unknown): unknown {
  if (isListEnvelope(body)) return { data: body.data, meta: body.meta }
  if (isEnvelope(body)) return body.data
  return body ?? undefined
}

export class ApiClient {
  private config: ApiClientConfig

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { transport: null, getToken: () => null, onUnauthorized: null, ...config }
  }

  /** Installs or replaces the transport, token provider and/or 401 hook. */
  configure(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config }
  }

  get hasTransport(): boolean {
    return this.config.transport !== null
  }

  get<T>(url: string, options?: GetOptions): Promise<T> {
    return this.request<T>('GET', url, options)
  }

  post<T>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', url, options)
  }

  put<T>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', url, options)
  }

  patch<T>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', url, options)
  }

  delete<T = void>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', url, options)
  }

  /** `GET` of a list endpoint, typed as `{data: T[], meta: ListMeta<X>}`. */
  list<T, X extends object = Record<never, never>>(
    url: string,
    options?: Omit<GetOptions, 'raw' | 'responseType'>,
  ): Promise<ListResult<T, X>> {
    return this.request<ListResult<T, X>>('GET', url, options)
  }

  /** Multipart upload: sends `form` as the body (the transport sets the boundary). */
  multipart<T>(
    url: string,
    form: FormData,
    options?: Omit<RequestOptions, 'body' | 'responseType'> & {
      method?: 'POST' | 'PUT' | 'PATCH'
    },
  ): Promise<T> {
    const { method = 'POST', ...rest } = options ?? {}
    return this.request<T>(method, url, { ...rest, body: form })
  }

  /** Download: resolves to the `Blob` and the file name from `Content-Disposition`. */
  async blob(
    url: string,
    options?: Omit<RequestOptions, 'raw' | 'responseType'> & { method?: HttpMethod },
  ): Promise<BlobResult> {
    const { method = 'GET', ...rest } = options ?? {}
    const res = await this.send(method, url, rest, 'blob')
    if (!isSuccess(res.status)) throw errorFromResponse({ ...res, method, url })
    const blob =
      res.body instanceof Blob
        ? res.body
        : new Blob([typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? '')])
    return { blob, filename: filenameFromContentDisposition(res.headers['content-disposition']) }
  }

  /**
   * Raw-body exception (M13 XR-M13-05 / SQ-M13-01): resolves to `{status, headers, body}` for any
   * HTTP status, without envelope unwrap or `ApiError` mapping. Auth header, transport behaviour
   * (latency, faults) and the 401 policy still apply. Rejects only on network failure or abort.
   */
  async raw<B = unknown>(
    method: HttpMethod,
    url: string,
    body?: unknown,
    options?: RawRequestOptions,
  ): Promise<RawResponse<B>> {
    const res = await this.send(method, url, { ...options, body }, 'json')
    return { status: res.status, headers: res.headers, body: res.body as B }
  }

  /** Generic call used by the verb methods. */
  async request<T>(method: HttpMethod, url: string, options: RequestOptions = {}): Promise<T> {
    const res = await this.send(method, url, options, options.responseType ?? 'json')
    if (!isSuccess(res.status)) throw errorFromResponse({ ...res, method, url })
    if (options.responseType === 'blob' || options.raw === true) return res.body as T
    return unwrap(res.body) as T
  }

  /** Builds the request, calls the transport, maps network failures, applies the 401 policy. */
  private async send(
    method: HttpMethod,
    url: string,
    options: Omit<RequestOptions, 'raw' | 'responseType'>,
    responseType: ResponseType,
  ): Promise<TransportResponse> {
    const { transport, getToken } = this.config
    if (!transport) {
      throw new Error('ApiClient: no transport installed (src/app/bootstrap.ts installs one).')
    }

    const { path, query: urlQuery } = splitUrl(url)
    const query = { ...urlQuery, ...serializeQuery(options.query) }

    const headers: Record<string, string> = { accept: 'application/json' }
    if (options.body !== undefined && !isBinaryBody(options.body)) {
      headers['content-type'] = 'application/json'
    }
    const token = getToken()
    if (token) headers.authorization = `Bearer ${token}`
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      headers[name.toLowerCase()] = value
    }

    const req: TransportRequest = { method, url: path, headers, responseType }
    if (Object.keys(query).length > 0) req.query = query
    if (options.body !== undefined) req.body = options.body

    const timeoutMs =
      options.timeoutMs ??
      (responseType === 'blob'
        ? BLOB_TIMEOUT_MS
        : isBinaryBody(options.body)
          ? UPLOAD_TIMEOUT_MS
          : JSON_TIMEOUT_MS)
    // Automatic retry: idempotent reads only (X10.3.4); writes are never retried here.
    const retryable = method === 'GET' || (method as string) === 'HEAD'

    let res: TransportResponse | undefined
    for (let attempt = 0; ; attempt++) {
      let failure: ApiError | undefined
      try {
        res = await this.attempt(transport, req, options.signal, timeoutMs, method, path)
      } catch (err) {
        if (!(err instanceof ApiError)) throw err
        failure = err
      }
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        const wait = failure
          ? jittered(RETRY_DELAYS_MS[attempt] as number)
          : retryWaitMs(res as TransportResponse, attempt)
        if (wait !== null) {
          await sleep(wait, options.signal)
          continue
        }
      }
      if (failure) throw failure
      break
    }

    if (!res) throw new Error('ApiClient: no response (unreachable)')
    const normalised: TransportResponse = {
      status: res.status,
      headers: lowerCaseKeys(res.headers),
      body: res.body ?? null,
    }
    if (normalised.status === 401 && !isAuthPath(path)) {
      this.notifyUnauthorized({ method, url: path, status: normalised.status })
    }
    return normalised
  }

  /** One transport call with the client timer composed with the caller's signal (caller wins). */
  private async attempt(
    transport: Transport,
    req: TransportRequest,
    callerSignal: AbortSignal | undefined,
    timeoutMs: number,
    method: HttpMethod,
    path: string,
  ): Promise<TransportResponse> {
    const controller = new AbortController()
    let timedOut = false
    const onCallerAbort = () => controller.abort()
    if (callerSignal?.aborted) controller.abort()
    else callerSignal?.addEventListener('abort', onCallerAbort, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    try {
      const response = await transport.request(req, controller.signal)
      reportNetworkOk()
      return response
    } catch (err) {
      if (callerSignal?.aborted) throw err
      if (timedOut) {
        reportNetworkError()
        throw new ApiError({
          status: 0,
          code: API_ERROR_CODES.NETWORK_ERROR,
          subtype: 'TIMEOUT',
          message: TIMEOUT_MESSAGE_BM,
          method,
          url: path,
          cause: err,
        })
      }
      if (isAbort(err, undefined)) throw err
      reportNetworkError()
      throw new ApiError({
        status: 0,
        code: API_ERROR_CODES.NETWORK_ERROR,
        message: NETWORK_ERROR_MESSAGE_BM,
        method,
        url: path,
        cause: err,
      })
    } finally {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', onCallerAbort)
    }
  }

  private notifyUnauthorized(ctx: UnauthorizedContext): void {
    const handler = this.config.onUnauthorized
    if (!handler) return
    try {
      const result = handler(ctx)
      if (result instanceof Promise) {
        result.catch((err: unknown) => console.error('ApiClient: onUnauthorized failed', err))
      }
    } catch (err) {
      console.error('ApiClient: onUnauthorized failed', err)
    }
  }
}

function lowerCaseKeys(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers ?? {})) out[name.toLowerCase()] = value
  return out
}

/** The app-wide client. `bootstrap.ts` installs the transport; the session store the token/401 hook. */
export const api = new ApiClient()

/** Installs the transport on the app-wide client (called once by `src/app/bootstrap.ts`). */
export function installTransport(transport: Transport): void {
  api.configure({ transport })
}
