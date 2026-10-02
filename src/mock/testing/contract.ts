/**
 * The browser-side contract of the test hooks (overview §6.13, ADR-0011): the shape of
 * `window.__MOCK_INIT__` and `window.__mock`, and the Playwright clock bridge.
 *
 * This file has **no imports**, so the Playwright code (`e2e/**`, `tsconfig.e2e.json`, no `@/`
 * alias) can `import type` it with a relative path. Every argument and return value is plain
 * JSON-able data (path patterns are strings), because Playwright passes them through
 * `page.evaluate`.
 */

/** Anything `new Date(x)` understands, as it survives `addInitScript` / `page.evaluate`. */
export type MockTimeInput = string | number

/**
 * `__MOCK_INIT__.session`: the argument(s) of the `setUser` hook (F-11), applied after boot and
 * before the first request. An e-mail or user id (`'student@…'`, `1`) is passed as
 * `setUser(session)`; an array is spread (`['student', 1]` → `setUser('student', 1)`).
 */
export type MockInitSession = string | number | readonly (string | number | boolean)[]

/** `window.__MOCK_INIT__`, set with `page.addInitScript` before the app boots. */
export interface MockInitData {
  /**
   * Start time. The e2e fixture never sends it when it installs the Playwright clock
   * (`clockMode: 'install'`, the app reads the browser clock); it is sent only with `'none'`.
   */
  now?: MockTimeInput | null
  /** Global latency in ms, or `{ [pathPattern]: ms }` (the key `'*'` sets the global value). */
  latency?: number | Readonly<Record<string, number>>
  /** Sampling seed base (`setRandomSeed`); never changes seed data. */
  seed?: number
  /** Seed overrides, keyed by the override names plugins declare. */
  overrides?: Readonly<Record<string, unknown>>
  /** Fast login through the `setUser` hook. */
  session?: MockInitSession | null
}

/** Fault spec as accepted by `failNext` (see `src/mock/faults.ts`). */
export type MockFaultSpec =
  /** An HTTP status, e.g. `500`. */
  | number
  /** An API error code (`'CONFLICT'`) or `'network'` (no response). */
  | string
  | { status: number; body: unknown; headers?: Record<string, string> }
  | {
      status: number
      code?: string
      message?: string
      fields?: Record<string, string>
      retryAfter?: number
    }

/** One entry of the request log (see `src/mock/request-log.ts`). */
export interface MockRequestRecord {
  seq: number
  at: number
  method: string
  path: string
  query: Record<string, string | string[]>
  body: unknown
  outcome: 'pending' | 'response' | 'network-error' | 'aborted'
  status: number | null
  faulted: boolean
}

export interface MockOutboxRecord {
  seq: number
  sentAt: number
  type: string
  to: string
  subject?: string
  data?: Record<string, unknown>
}

/** How `setNow` / `advanceTime` move time (overview §6.12). */
export type MockClockMode =
  /** development: the shared clock's offset moves. */
  | 'offset'
  /** e2e: the Playwright clock (`context.clock`) moves, through the bridge below. */
  | 'playwright'

/**
 * The name of the function the Playwright fixture exposes (`context.exposeFunction`) so that the
 * in-page `__mock.setNow` / `__mock.advanceTime` can drive `context.clock` in the e2e build.
 *
 * - `('setNow', epochMs)`: set the **browser** time (`Date.now`) to `epochMs`
 *   (`context.clock.setSystemTime(epochMs)`). The hook already subtracts the mock clock offset, so
 *   the mock's `now()` equals the requested time.
 * - `('advanceTime', ms)`: move time forward by `ms`, firing due timers
 *   (`context.clock.runFor(ms)`; `fastForward` if the test wants timers to fire at most once).
 */
export const PLAYWRIGHT_CLOCK_BINDING = '__mockPlaywrightClock'

export type PlaywrightClockBridge = (op: 'setNow' | 'advanceTime', value: number) => Promise<void>

/** The built-in part of `window.__mock` (overview §6.13). Module hooks are added by name. */
export interface MockTestHooksBase {
  /** `true` once the mock has booted, `__MOCK_INIT__` was applied and the hooks are installed. */
  readonly ready: true
  /** Build marker used by `scripts/check-demo-bundle.mjs`. */
  readonly sentinel: string
  readonly clockMode: MockClockMode
  /** Re-seed (optionally with overrides) and clear the diff, faults, request log and outbox. */
  reset(overrides?: Readonly<Record<string, unknown>>): Promise<void>
  /** Mock and UI time. See {@link MockClockMode}. */
  setNow(time: MockTimeInput): Promise<void>
  advanceTime(ms: number): Promise<void>
  /** Current mock time, epoch ms. */
  now(): number
  /** Global latency, or a per-path rule (`'/api/admin/*'`, `'GET /api/topics/:id'`). */
  setLatency(ms: number, pathPattern?: string): void
  /** Removes one per-path latency rule, or all of them. */
  clearLatency(pathPattern?: string): void
  /** The next matching request fails with `spec`. */
  failNext(pathPattern: string, spec: MockFaultSpec): void
  /** Alias of `failNext(pathPattern, 'network')`. */
  networkErrorNext(pathPattern: string): void
  /** Changes the sampling seed base only. */
  setRandomSeed(seedBase: number): void
  /** The newest request matching the pattern (or any request), or `null`. */
  lastRequest(pathPattern?: string): MockRequestRecord | null
  /** Every logged request matching the pattern, oldest first. */
  requests(pathPattern?: string): MockRequestRecord[]
  /** `config(key)` reads a fixture config value; `config(key, value)` sets it. */
  config(key: string, value?: unknown): unknown
  readonly outbox: {
    /** The token of the newest `password-reset` message to `email` (`data.token`), or `null`. */
    lastResetFor(email: string): string | null
    last(type: string, to?: string): MockOutboxRecord | null
    all(): MockOutboxRecord[]
  }
  /** Names of every hook on `window.__mock` (built-in and module hooks), sorted. */
  names(): string[]
  /** Fast login for a canonical account (F-11 core hook). */
  setUser(...args: (string | number | boolean)[]): Promise<unknown>
  /** Invalidates the current session server-side (M01 hook). */
  expireSession(...args: unknown[]): Promise<unknown>
}

/** `window.__mock`: the built-ins plus every module hook (always async from the page's view). */
export type MockTestHooks = MockTestHooksBase & {
  readonly [hook: string]: unknown
}

declare global {
  interface Window {
    __MOCK_INIT__?: MockInitData
    __mock?: MockTestHooks
    __mockPlaywrightClock?: PlaywrightClockBridge
  }
}
