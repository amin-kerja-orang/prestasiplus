/**
 * Mock wiring of a Playwright page (overview §6.13 "Wiring as built", §12.2; ADR-0011 Amendment 2).
 *
 * - `window.__MOCK_INIT__` is written with `page.addInitScript`, so it exists before the app script
 *   runs on every load of that page (reloads included).
 * - The Playwright clock is installed on the **context** at `mockInit.now` (default
 *   {@link DEFAULT_NOW}). The e2e build uses the `passthrough` clock policy (mock time = `Date.now`),
 *   so the fixture does **not** pass `now` to `__MOCK_INIT__` when it installs the clock: a reload
 *   after `advanceTime` must keep the advanced time, and a pre-boot `now` would reset it.
 * - `PLAYWRIGHT_CLOCK_BINDING` is exposed on the context and drives the context clock:
 *   `'setNow'` → `clock.setSystemTime(epochMs)`, `'advanceTime'` → `clock.runFor(ms)`.
 *
 * Types come from `src/mock/testing/contract.ts` by relative path (it has no imports).
 */

import type { BrowserContext, Page } from '@playwright/test'

import {
  PLAYWRIGHT_CLOCK_BINDING,
  type MockInitData,
  type MockInitSession,
  type PlaywrightClockBridge,
} from '../../src/mock/testing/contract.ts'

/** Project clock default (overview §12.2): 2026-09-25 15:40 MYT. */
export const DEFAULT_NOW = '2026-09-25T15:40:00+08:00'

/** `__MOCK_INIT__` as the fixtures accept it. `session` is set through `loginAs`. */
export type MockInitOption = Omit<MockInitData, 'session'>

/**
 * - `'install'` (default): install the Playwright clock at `mockInit.now` and wire the bridge.
 * - `'none'`: real time; `mockInit.now`, if set, goes to `__MOCK_INIT__.now` (mock offset only;
 *   `__mock.setNow` / `advanceTime` then throw, because there is no clock to drive).
 */
export type ClockMode = 'install' | 'none'

export interface MockPageOptions {
  mockInit?: MockInitOption
  clockMode?: ClockMode
}

const wiredContexts = new WeakSet<BrowserContext>()

function toEpochMs(time: MockInitData['now']): number {
  const ms = typeof time === 'number' ? time : Date.parse(time ?? DEFAULT_NOW)
  if (!Number.isFinite(ms)) throw new RangeError(`mockInit.now: invalid time ${String(time)}`)
  return ms
}

/**
 * Installs the clock and the clock bridge on `context` once. Later calls (a second tab) are no-ops,
 * because the clock and the exposed function are context-wide.
 */
export async function wireMockContext(
  context: BrowserContext,
  { mockInit = {}, clockMode = 'install' }: MockPageOptions = {},
): Promise<void> {
  if (wiredContexts.has(context)) return
  wiredContexts.add(context)
  if (clockMode === 'none') return

  await context.clock.install({ time: toEpochMs(mockInit.now) })
  const bridge: PlaywrightClockBridge = async (op, value) => {
    if (op === 'setNow') await context.clock.setSystemTime(value)
    else if (op === 'advanceTime') await context.clock.runFor(value)
    else throw new Error(`${PLAYWRIGHT_CLOCK_BINDING}: unknown op ${String(op)}`)
  }
  await context.exposeFunction(PLAYWRIGHT_CLOCK_BINDING, bridge)
}

/** The `__MOCK_INIT__` value written for a page (without the session). */
export function initFor({ mockInit = {}, clockMode = 'install' }: MockPageOptions): MockInitData {
  const { now, ...rest } = mockInit
  // With the clock installed, time comes from `Date.now` (passthrough); see the file header.
  return clockMode === 'install' || now === undefined || now === null ? rest : { ...rest, now }
}

/**
 * Wires one page: the context clock (once) and the `__MOCK_INIT__` init script.
 *
 * Init scripts **merge** into `window.__MOCK_INIT__` instead of overwriting it, so their order does
 * not matter: this base script only fills keys no other script has set.
 */
export async function wireMockPage(page: Page, options: MockPageOptions = {}): Promise<void> {
  await wireMockContext(page.context(), options)
  await page.addInitScript((init: MockInitData) => {
    window.__MOCK_INIT__ = { ...init, ...(window.__MOCK_INIT__ ?? {}) }
  }, initFor(options))
}

const pagesWithSession = new WeakSet<Page>()

/**
 * Adds `session` to `__MOCK_INIT__` for every later load of `page` (merged into the value, like the
 * base script). The core `setUser` hook then logs in at boot: no login request is made.
 *
 * Init scripts cannot be removed, so a page takes **one** session: a second call throws. To test
 * another account, use a new page or context (`newTab()`, `browser.newContext()`), or switch
 * inside the page with `mock.setUser(...)` followed by a client-side navigation.
 */
export async function addInitSession(page: Page, session: MockInitSession): Promise<void> {
  if (pagesWithSession.has(page)) {
    throw new Error(
      'loginAs: this page already has a session. Call loginAs once per page; use a new page for ' +
        'another account, or mock.setUser(...) to switch inside the page.',
    )
  }
  pagesWithSession.add(page)
  await page.addInitScript((value: MockInitSession) => {
    window.__MOCK_INIT__ = { ...(window.__MOCK_INIT__ ?? {}), session: value }
  }, session)
}

/** `true` once the page has loaded a document from the app (not `about:blank`). */
export function hasLoadedApp(page: Page): boolean {
  return page.url() !== 'about:blank' && page.url() !== ''
}
