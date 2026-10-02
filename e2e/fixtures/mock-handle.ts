/**
 * Typed wrapper around `window.__mock` (overview §6.13). Every call first waits for
 * `__mock.ready`, then runs in the page with `page.evaluate`, so arguments and results must be
 * JSON-able (path patterns are strings).
 *
 * Module hooks (registered by module plugins, e.g. `pushNotification`, `setProgress`) are called
 * with `mock.hook(name, ...args)`.
 */

import type { Page } from '@playwright/test'

import type {
  MockFaultSpec,
  MockOutboxRecord,
  MockRequestRecord,
  MockTimeInput,
} from '../../src/mock/testing/contract.ts'

export interface MockHandle {
  /** Waits until the app booted the mock and installed `window.__mock`. */
  ready(): Promise<void>
  /** Calls a module hook (or any hook by name). Resolves after the hook's writes are stored. */
  hook<T = unknown>(name: string, ...args: unknown[]): Promise<T>
  /** Names of every hook on `window.__mock`, sorted. */
  names(): Promise<string[]>
  reset(overrides?: Record<string, unknown>): Promise<void>
  /** Moves the Playwright clock (e2e build) so that mock time equals `time`. */
  setNow(time: MockTimeInput): Promise<void>
  /** Runs the Playwright clock forward by `ms`, firing due timers. */
  advanceTime(ms: number): Promise<void>
  now(): Promise<number>
  setLatency(ms: number, pathPattern?: string): Promise<void>
  clearLatency(pathPattern?: string): Promise<void>
  failNext(pathPattern: string, spec: MockFaultSpec): Promise<void>
  networkErrorNext(pathPattern: string): Promise<void>
  setRandomSeed(seedBase: number): Promise<void>
  lastRequest(pathPattern?: string): Promise<MockRequestRecord | null>
  requests(pathPattern?: string): Promise<MockRequestRecord[]>
  config(key: string, ...value: [unknown?]): Promise<unknown>
  readonly outbox: {
    lastResetFor(email: string): Promise<string | null>
    last(type: string, to?: string): Promise<MockOutboxRecord | null>
    all(): Promise<MockOutboxRecord[]>
  }
  /** Fast login for a canonical account (core hook, writes `pp.auth`). Reload to apply it. */
  setUser(...args: (string | number | boolean)[]): Promise<unknown>
  /** M01 hook; throws until M01-T1 registers it. */
  expireSession(): Promise<unknown>
}

/** Boot budget of {@link waitForApp}: mock boot alone takes ~1.5 s, up to ~6 s under full load. */
export const APP_BOOT_TIMEOUT_MS = 15_000

export async function waitForMock(page: Page, timeout = APP_BOOT_TIMEOUT_MS): Promise<void> {
  await page.waitForFunction(() => window.__mock?.ready === true, null, { timeout })
}

/**
 * Waits until the app has booted: `__mock.ready`, the Vue app mounted on `#app`, and the router's
 * initial navigation (with its guard redirects) finished.
 */
export async function waitForApp(page: Page, timeout = APP_BOOT_TIMEOUT_MS): Promise<void> {
  await waitForMock(page, timeout)
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#app') as (Element & { __vue_app__?: unknown }) | null
      return Boolean(el?.__vue_app__)
    },
    null,
    { timeout },
  )
  await page.evaluate(async () => {
    type RouterLike = { isReady(): Promise<void> }
    const el = document.querySelector('#app') as Element & {
      __vue_app__: { config: { globalProperties: { $router: RouterLike } } }
    }
    await el.__vue_app__.config.globalProperties.$router.isReady()
  })
}

/**
 * `page.goto(path)` for the app: loads the page, then waits for the boot ({@link waitForApp}) with
 * its own {@link APP_BOOT_TIMEOUT_MS} budget, so the first assertion keeps the 5 s default. Use it
 * for every app navigation by URL (including the first one).
 */
export async function gotoApp(
  page: Page,
  path: string,
  options: Parameters<Page['goto']>[1] = {},
): Promise<void> {
  await page.goto(path, options)
  await waitForApp(page)
}

/** `page.reload()` for the app, with the same boot wait as {@link gotoApp}. */
export async function reloadApp(page: Page): Promise<void> {
  await page.reload()
  await waitForApp(page)
}

export function createMockHandle(page: Page): MockHandle {
  const call = async <T>(name: string, args: unknown[]): Promise<T> => {
    await waitForMock(page)
    return page.evaluate(
      async ([hookName, hookArgs]) => {
        const hooks = window.__mock as unknown as Record<string, unknown>
        const fn = hooks[hookName]
        if (typeof fn !== 'function') throw new Error(`window.__mock.${hookName} is not a hook`)
        return (await (fn as (...a: unknown[]) => unknown)(...hookArgs)) as T
      },
      [name, args] as const,
    ) as Promise<T>
  }

  const outbox = async <T>(name: 'lastResetFor' | 'last' | 'all', args: unknown[]): Promise<T> => {
    await waitForMock(page)
    return page.evaluate(
      ([method, methodArgs]) => {
        const box = window.__mock!.outbox as unknown as Record<string, (...a: unknown[]) => unknown>
        return box[method]!(...methodArgs) as T
      },
      [name, args] as const,
    ) as Promise<T>
  }

  return {
    ready: () => waitForMock(page),
    hook: <T>(name: string, ...args: unknown[]) => call<T>(name, args),
    names: () => call('names', []),
    reset: (overrides) => call('reset', overrides === undefined ? [] : [overrides]),
    setNow: (time) => call('setNow', [time]),
    advanceTime: (ms) => call('advanceTime', [ms]),
    now: () => call('now', []),
    setLatency: (ms, pathPattern) =>
      call('setLatency', pathPattern === undefined ? [ms] : [ms, pathPattern]),
    clearLatency: (pathPattern) =>
      call('clearLatency', pathPattern === undefined ? [] : [pathPattern]),
    failNext: (pathPattern, spec) => call('failNext', [pathPattern, spec]),
    networkErrorNext: (pathPattern) => call('networkErrorNext', [pathPattern]),
    setRandomSeed: (seedBase) => call('setRandomSeed', [seedBase]),
    lastRequest: (pathPattern) =>
      call('lastRequest', pathPattern === undefined ? [] : [pathPattern]),
    requests: (pathPattern) => call('requests', pathPattern === undefined ? [] : [pathPattern]),
    config: (key, ...value) => call('config', [key, ...value]),
    outbox: {
      lastResetFor: (email) => outbox('lastResetFor', [email]),
      last: (type, to) => outbox('last', to === undefined ? [type] : [type, to]),
      all: () => outbox('all', []),
    },
    setUser: (...args) => call('setUser', args),
    expireSession: () => call('expireSession', []),
  }
}
