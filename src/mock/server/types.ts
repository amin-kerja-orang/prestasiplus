/**
 * Core types of the mock server (overview §6.4).
 *
 * - `MockRequest` is what a handler sees: `{method, path, params, query, body, formData, headers,
 *   session, token}`.
 * - `MockContext` (`ctx`) is `{db, clock, prng, config, outbox, emit, transaction}`. `prng` is the
 *   **sampling** registry (`setRandomSeed(n)` moves it); seeds use a separate, fixed registry.
 * - `MockResponse` has the same shape as a `TransportResponse`: `{status, headers, body}`. Build it
 *   with the responders in `./respond.ts`, never by hand.
 * - `Middleware` is a guard: it returns a response to stop the chain, or nothing to continue.
 *
 * Handlers are pure functions of `(request, db, clock, prng)` (overview §6.4), which is what makes
 * seeds and E2E runs deterministic.
 */

import type { HttpMethod } from '@/api/transport'
import type { Clock } from '@/lib/time'

import type { MockSession } from '../auth/middleware'
import type { Db } from '../db/transaction'
import type { PrngRegistry } from '../determinism/prng'
import type { MockConfig } from './config'
import type { MockEmit } from './events'
import type { OutboxWriter } from './outbox'

export type { HttpMethod }

/** Parsed query: plain strings, or repeated values (`ids=1&ids=2` → `['1', '2']`). */
export type MockQuery = Readonly<Record<string, string | readonly string[]>>

/** Route params after parsing (`int()` params are numbers). */
export type MockParams = Readonly<Record<string, string | number>>

export interface MockRequest<P extends MockParams = MockParams> {
  method: HttpMethod
  /** Path without query string and without a trailing slash, e.g. `/api/topics/12`. */
  path: string
  params: P
  query: MockQuery
  /**
   * The request body as the server would receive it: a JSON value cloned through JSON (so `Date`s
   * are strings and `undefined` fields are gone), a `Blob`, or, for multipart requests, a plain
   * object of the form fields (repeated keys become arrays; files stay `File`/`Blob`).
   * `undefined` when the request has no body.
   */
  body: unknown
  /** The original `FormData` for multipart requests, otherwise `null`. */
  formData: FormData | null
  /** Request headers, lower-case names. */
  headers: Readonly<Record<string, string>>
  /** Bearer token from `authorization`, or `null`. */
  token: string | null
  /** The session resolved from the token (see `src/mock/auth/middleware.ts`), or `null`. */
  session: MockSession | null
}

export interface MockResponse {
  status: number
  /** Lower-case header names. */
  headers: Record<string, string>
  /** JSON value, a `Blob` for downloads, or `null` (204). */
  body: unknown
}

export interface MockContext {
  db: Db
  clock: Clock
  /** Sampling streams (quiz selection, shuffles). `setRandomSeed(n)` changes their base. */
  prng: PrngRegistry
  config: MockConfig
  /** Queued until the request's transaction commits (dropped on rollback). */
  outbox: OutboxWriter
  /** Queued until the request's transaction commits (dropped on rollback). */
  emit: MockEmit
  /** `db.transaction(fn)`: synchronous, all or nothing. */
  transaction<T>(fn: () => T): T
}

export type Handler<P extends MockParams = MockParams> = (
  req: MockRequest<P>,
  ctx: MockContext,
) => MockResponse | Promise<MockResponse>

/**
 * A synchronous guard. Returns a response to answer the request immediately (e.g. `401`), or
 * `undefined` to pass the request on. Guards may read `ctx.db` but should not write.
 */
export type Middleware = (req: MockRequest, ctx: MockContext) => MockResponse | undefined
