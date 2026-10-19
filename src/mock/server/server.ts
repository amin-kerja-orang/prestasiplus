/**
 * The mock server: turns a transport request into a response (overview §6.4).
 *
 * Order for every request:
 * 1. route match (`METHOD /api/...`); no match → `404 NOT_FOUND`;
 * 2. `MockRequest` built (query merged, body cloned as JSON, multipart fields read);
 * 3. session: the Bearer token is resolved by the core's `SessionResolver`, in its own transaction
 *    (it may extend a sliding expiry);
 * 4. guards: global middleware (`use`), then the route's middleware, in order; the first response
 *    wins;
 * 5. handler;
 * 6. **write-through**: `await db.settled(seqs)` for **this request's own commits** (F-07
 *    persistence listeners) before answering, so a reload right after a save sees the saved value.
 *    A failed commit (`MockDbError` `COMMIT_FAILED`) answers `500 SERVER_ERROR`. The seqs are read
 *    from `db.lastSeq` around each synchronous write section (session, sync handler, and every
 *    `ctx.transaction` of an async handler), so concurrent requests never wait for each other.
 *
 * **Transactions.** A synchronous handler runs, together with its guards, inside one
 * `db.transaction`: if it throws, every write of the request is rolled back. A thrown `MockHttpError`
 * (`abort(...)`, `assertValid(...)`) becomes its response; any other error becomes
 * `500 SERVER_ERROR`. An `async function` handler (one that must await I/O such as reading a file) is
 * not wrapped, because transaction bodies are synchronous: it must group its writes in
 * `ctx.transaction(() => …)` after its awaits. Writes made any other way are not awaited, and the
 * dev build warns about them. A non-`async` handler that returns a promise is a bug: it is rolled
 * back and answered with 500.
 *
 * **Side effects follow the transaction.** Inside a write section, `ctx.outbox.send(...)` and
 * `ctx.emit(...)` are queued and delivered only when the section commits; a rollback drops them, so
 * a failed request sends no e-mail and announces nothing. Outside any section (an async handler
 * before its `ctx.transaction`) they are delivered at once.
 *
 * Responses are cloned through JSON (except `Blob` bodies), so the UI never holds references to
 * mock rows.
 */

import { API_ERROR_CODES } from '@/api/errors'
import type { TransportRequest } from '@/api/transport'
import type { Clock } from '@/lib/time'

import { bearerToken, noSessions, type SessionResolver } from '../auth/middleware'
import type { Db } from '../db/transaction'
import type { PrngRegistry } from '../determinism/prng'
import type { MockConfig } from './config'
import type { MockEvents } from './events'
import type { Outbox, OutboxMessageInput } from './outbox'
import { headersOf, parseBody, splitUrl } from './request'
import {
  cloneResponse,
  DEFAULT_ERROR_MESSAGES,
  fail,
  isMockResponse,
  MockHttpError,
} from './respond'
import { createRouter, type RouteDef, type Router } from './router'
import type {
  Handler,
  Middleware,
  MockContext,
  MockParams,
  MockRequest,
  MockResponse,
} from './types'

export type ServerWarn = (message: string) => void

export interface MockServerOptions {
  db: Db
  clock: Clock
  /** Sampling streams (`ctx.prng`). */
  prng: PrngRegistry
  config: MockConfig
  outbox: Outbox
  events: MockEvents
  routes: readonly RouteDef<MockParams>[]
  /** Global guards, run before every route's own middleware. */
  middleware?: readonly Middleware[]
  resolveSession?: SessionResolver | null
  /** Unexpected errors (500s). Default: `console.error`. */
  onError?: (error: unknown, req: { method: string; path: string }) => void
  /**
   * Developer warnings (untracked writes in async handlers). Default: `console.warn` in dev
   * builds, silent otherwise.
   */
  onWarn?: ServerWarn | null
}

export interface MockServer {
  readonly router: Router
  /**
   * The shared context (for hooks and tests): its outbox and emit deliver at once. Requests get a
   * copy that tracks their commits and queues side effects until commit.
   */
  readonly context: MockContext
  /** Adds a global guard (runs after the ones already added). */
  use(middleware: Middleware): void
  handle(req: TransportRequest): Promise<MockResponse>
}

// eslint-disable-next-line @typescript-eslint/require-await -- only its constructor is used
const AsyncFunction = (async () => undefined).constructor

/** `true` for `async function` / `async () =>` handlers (which are not wrapped in a transaction). */
export function isAsyncHandler(fn: unknown): boolean {
  return fn instanceof AsyncFunction
}

const defaultWarn: ServerWarn | null = import.meta.env.DEV
  ? (message) => console.warn(message)
  : null

export function createMockServer(options: MockServerOptions): MockServer {
  const { db, outbox, events } = options
  const router = createRouter(options.routes)
  const globalMiddleware: Middleware[] = [...(options.middleware ?? [])]
  const resolveSession = options.resolveSession ?? noSessions
  const onError =
    options.onError ??
    ((error: unknown, req: { method: string; path: string }) =>
      console.error(`mock: ${req.method} ${req.path} failed`, error))
  const onWarn = options.onWarn === undefined ? defaultWarn : options.onWarn

  const context: MockContext = Object.freeze({
    db,
    clock: options.clock,
    prng: options.prng,
    config: options.config,
    outbox,
    emit: events.emit,
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  })

  /**
   * Seqs committed by any tracked section while an async handler is in flight. An async handler's
   * commit that is in none of these sections was written outside `ctx.transaction` (dev warning).
   */
  const claimed = new Set<number>()
  let asyncInFlight = 0

  const serverError = () =>
    fail(500, API_ERROR_CODES.SERVER_ERROR, DEFAULT_ERROR_MESSAGES.SERVER_ERROR)

  /** Per-request state: the commit seqs this request produced and its queued side effects. */
  function requestScope() {
    const seqs: number[] = []
    const queue: (() => void)[] = []
    let depth = 0

    const deliver = (effect: () => void) => {
      if (depth > 0) queue.push(effect)
      else effect()
    }

    /**
     * Runs a synchronous write section: records the commits it made and delivers its queued side
     * effects only if it completes (nested sections join the outer one).
     */
    const track = <T>(fn: () => T): T => {
      const before = db.lastSeq
      const mark = queue.length
      depth++
      let result: T
      try {
        result = fn()
      } catch (err) {
        queue.length = mark
        throw err
      } finally {
        depth--
        for (let s = before + 1; s <= db.lastSeq; s++) {
          seqs.push(s)
          if (asyncInFlight > 0) claimed.add(s)
        }
      }
      if (depth === 0) for (const effect of queue.splice(0)) effect()
      return result
    }

    const ctx: MockContext = Object.freeze({
      ...context,
      outbox: { send: (message: OutboxMessageInput) => deliver(() => void outbox.send(message)) },
      emit: (event: string, payload?: unknown) => deliver(() => events.emit(event, payload)),
      transaction: <T>(fn: () => T): T => track(() => db.transaction(fn)),
    })
    return { seqs, track, ctx }
  }

  function runGuards(
    req: MockRequest,
    route: RouteDef<MockParams>,
    ctx: MockContext,
  ): MockResponse | undefined {
    for (const guard of globalMiddleware) {
      const res = guard(req, ctx)
      if (res) return res
    }
    for (const guard of route.middleware) {
      const res = guard(req, ctx)
      if (res) return res
    }
    return undefined
  }

  function checkResponse(value: unknown): MockResponse {
    if (!isMockResponse(value)) {
      throw new Error('mock handler did not return a responder result (ok/fail/…)')
    }
    return value
  }

  async function runAsync(
    req: MockRequest,
    route: RouteDef<MockParams>,
    handler: Handler,
    scope: ReturnType<typeof requestScope>,
  ): Promise<MockResponse> {
    const start = db.lastSeq
    asyncInFlight++
    try {
      const denied = runGuards(req, route, scope.ctx)
      return denied ?? checkResponse(await handler(req, scope.ctx))
    } finally {
      const untracked: number[] = []
      for (let s = start + 1; s <= db.lastSeq; s++) if (!claimed.has(s)) untracked.push(s)
      asyncInFlight--
      if (asyncInFlight === 0) claimed.clear()
      if (untracked.length > 0 && onWarn) {
        onWarn(
          `mock: ${req.method} ${req.path} (async handler) committed #${untracked.join(', #')} outside ctx.transaction(); ` +
            'those writes are not awaited (write-through) and their outbox/emit are not transactional',
        )
      }
    }
  }

  async function dispatch(
    req: MockRequest,
    route: RouteDef<MockParams>,
    scope: ReturnType<typeof requestScope>,
  ): Promise<MockResponse> {
    const handler = route.handler as Handler
    if (isAsyncHandler(handler)) return runAsync(req, route, handler, scope)
    return scope.track(() =>
      db.transaction(() => {
        const denied = runGuards(req, route, scope.ctx)
        if (denied) return denied
        // A returned promise makes db.transaction roll back with ASYNC_TRANSACTION (→ 500).
        return handler(req, scope.ctx) as MockResponse
      }),
    )
  }

  async function handle(treq: TransportRequest): Promise<MockResponse> {
    const { path, query } = splitUrl(treq.url, treq.query)
    const where = { method: treq.method, path }
    const match = router.match(treq.method, path)
    if (!match) return fail(404, API_ERROR_CODES.NOT_FOUND, DEFAULT_ERROR_MESSAGES.NOT_FOUND)

    const scope = requestScope()
    let response: MockResponse
    try {
      const headers = headersOf(treq)
      const { body, formData } = parseBody(treq.body)
      const token = bearerToken(headers)
      const base: Omit<MockRequest, 'session'> = {
        method: treq.method,
        path,
        params: match.params,
        query,
        body,
        formData,
        headers,
        token,
      }
      const session =
        token === null
          ? null
          : scope.track(() => db.transaction(() => resolveSession(token, base, scope.ctx)))
      response = cloneResponse(
        checkResponse(await dispatch({ ...base, session }, match.route, scope)),
      )
    } catch (err) {
      if (err instanceof MockHttpError) {
        response = cloneResponse(err.response)
      } else {
        onError(err, where)
        response = serverError()
      }
    }

    if (scope.seqs.length > 0) {
      try {
        await db.settled(scope.seqs)
      } catch (err) {
        // `COMMIT_FAILED`: the change is in memory but was not stored.
        onError(err, where)
        return serverError()
      }
    }
    return response
  }

  return {
    router,
    context,
    use(middleware) {
      globalMiddleware.push(middleware)
    },
    handle,
  }
}
