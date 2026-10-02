/**
 * The project's Playwright `test` (overview §12.2, build-plan F-22). Every spec imports `test` and
 * `expect` from here, never from `@playwright/test` directly:
 *
 * ```ts
 * import { expect, test } from '../fixtures/test'
 *
 * test.use({ mockInit: { latency: 0 } })
 *
 * test('E2E-M08-01 Dashboard … @m08', async ({ page, gotoApp, loginAs, mock }) => {
 *   await loginAs('pelajar@demo.test')   // before the first goto: no login request is made
 *   await gotoApp('/dashboard')
 *   await mock.advanceTime(60_000)
 * })
 * ```
 *
 * Fixtures:
 * - `mockInit` (option): `{ now?, latency?, seed?, overrides? }`, written to `window.__MOCK_INIT__`
 *   with `addInitScript`. `now` defaults to {@link DEFAULT_NOW}.
 * - `clockMode` (option): `'install'` (default) or `'none'`; see `mock-page.ts`.
 * - `clock`: the Playwright clock, installed at `mockInit.now` (context-wide).
 * - `loginAs(who)`: fast login through `__MOCK_INIT__.session` (the core `setUser` hook at boot).
 *   Once per page: a second call throws (init scripts cannot be removed).
 * - `gotoApp(path)`: `page.goto` + wait for the app boot with its own 15 s budget. Use it (or
 *   `gotoApp(page, path)` for other pages) for every URL navigation, never bare `page.goto`.
 * - `mock`: typed wrapper around `window.__mock` (waits for `__mock.ready`).
 * - `newTab()`: a second page in the same context, wired the same way (no session): for cross-tab
 *   tests (F-07).
 *
 * Each test gets a fresh context, so fresh IndexedDB and `localStorage`: fresh seeds (ADR-0011).
 */

import { test as base, expect, type Clock, type Page } from '@playwright/test'

import {
  canonicalAccount,
  CANONICAL_ACCOUNTS,
  type CanonicalAccount,
  type CanonicalRole,
} from '../../src/mock/core-data/accounts.ts'
import { createMockHandle, gotoApp, reloadApp, type MockHandle } from './mock-handle'
import {
  addInitSession,
  DEFAULT_NOW,
  hasLoadedApp,
  wireMockPage,
  type ClockMode,
  type MockInitOption,
} from './mock-page'

/** A canonical account by role (the first one of that role), e-mail or id. */
export type LoginTarget = CanonicalRole | string | number

export interface LoginOptions {
  /** "Ingat saya": a remember-me session (+5 years). Default `false` (120 min sliding). */
  remember?: boolean
}

export interface MockFixtures {
  mockInit: MockInitOption
  clockMode: ClockMode
  clock: Clock
  mock: MockHandle
  loginAs: (who: LoginTarget, options?: LoginOptions) => Promise<CanonicalAccount>
  newTab: () => Promise<Page>
  /** `page.goto(path)` + wait for the app boot (15 s budget). Use it for every URL navigation. */
  gotoApp: (path: string) => Promise<void>
}

const ROLES = new Set<string>(CANONICAL_ACCOUNTS.map((a) => a.role))

/** Resolves a role, e-mail or id to its canonical account (throws for anything else). */
export function resolveAccount(who: LoginTarget): CanonicalAccount {
  const account =
    typeof who === 'string' && ROLES.has(who)
      ? CANONICAL_ACCOUNTS.find((a) => a.role === who)
      : canonicalAccount(who)
  if (!account) throw new Error(`loginAs: no canonical account ${JSON.stringify(who)}`)
  return account
}

export const test = base.extend<MockFixtures & { _mockWiring: void }>({
  mockInit: [{ now: DEFAULT_NOW }, { option: true }],
  clockMode: ['install', { option: true }],

  _mockWiring: [
    async ({ page, mockInit, clockMode }, use) => {
      await wireMockPage(page, { mockInit: { now: DEFAULT_NOW, ...mockInit }, clockMode })
      await use()
    },
    { auto: true },
  ],

  clock: async ({ page }, use) => {
    await use(page.context().clock)
  },

  mock: async ({ page }, use) => {
    await use(createMockHandle(page))
  },

  loginAs: async ({ page }, use) => {
    await use(async (who, options = {}) => {
      const account = resolveAccount(who)
      const session = options.remember ? [account.email, true] : account.email
      await addInitSession(page, session)
      if (hasLoadedApp(page)) {
        // Already on a page: reload, so the app boots again with `__MOCK_INIT__.session`.
        await reloadApp(page)
      }
      return account
    })
  },

  gotoApp: async ({ page }, use) => {
    await use((path) => gotoApp(page, path))
  },

  newTab: async ({ page, mockInit, clockMode }, use) => {
    const opened: Page[] = []
    await use(async () => {
      const tab = await page.context().newPage()
      opened.push(tab)
      await wireMockPage(tab, { mockInit: { now: DEFAULT_NOW, ...mockInit }, clockMode })
      return tab
    })
    await Promise.all(opened.map((tab) => tab.close()))
  },
})

export { expect }
export {
  APP_BOOT_TIMEOUT_MS,
  createMockHandle,
  gotoApp,
  reloadApp,
  waitForApp,
  type MockHandle,
} from './mock-handle'
export { DEFAULT_NOW, type ClockMode, type MockInitOption } from './mock-page'
export { CANONICAL_ACCOUNTS, DEMO_PASSWORD } from '../../src/mock/core-data/accounts.ts'
