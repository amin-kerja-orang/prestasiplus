/**
 * Self-checks of the F-22 fixtures: `__MOCK_INIT__`, the Playwright clock bridge, `loginAs` and the
 * `mock` wrapper. If these fail, every module spec is suspect.
 */

import { DEFAULT_NOW, expect, gotoApp, reloadApp, test } from '../fixtures/test'
import { navigateInApp, TAG } from '../support'

const T0 = Date.parse(DEFAULT_NOW)
/** Time flows naturally after `clock.install`; allow for test runtime. */
const SLACK_MS = 30_000

test.describe('harness', { tag: [TAG.smoke] }, () => {
  test('mock boots with the hooks installed', async ({ page, mock }) => {
    await gotoApp(page, '/')
    await mock.ready()
    const names = await mock.names()
    for (const name of ['reset', 'setNow', 'advanceTime', 'failNext', 'setUser', 'outbox']) {
      expect(names).toContain(name)
    }
    expect(await page.evaluate(() => window.__mock?.clockMode)).toBe('playwright')
  })

  test('clock starts at the project default and follows setNow / advanceTime', async ({
    page,
    mock,
  }) => {
    await gotoApp(page, '/')
    const start = await mock.now()
    expect(start).toBeGreaterThanOrEqual(T0)
    expect(start).toBeLessThan(T0 + SLACK_MS)
    // Browser time and mock time are the same clock (passthrough, offset 0).
    const browserNow = await page.evaluate(() => Date.now())
    expect(Math.abs(browserNow - (await mock.now()))).toBeLessThan(SLACK_MS)

    const target = Date.parse('2026-10-01T08:00:00+08:00')
    await mock.setNow('2026-10-01T08:00:00+08:00')
    const afterSet = await mock.now()
    expect(afterSet).toBeGreaterThanOrEqual(target)
    expect(afterSet).toBeLessThan(target + SLACK_MS)

    await mock.advanceTime(2 * 60 * 60 * 1000)
    const afterAdvance = await mock.now()
    expect(afterAdvance - afterSet).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000)

    // A reload keeps the advanced time (no pre-boot `now` resets it).
    await reloadApp(page)
    expect(await mock.now()).toBeGreaterThanOrEqual(afterAdvance)
  })

  test('loginAs logs in through __MOCK_INIT__.session with no login request', async ({
    page,
    loginAs,
    mock,
  }) => {
    const account = await loginAs('student')
    expect(account.email).toBe('pelajar@demo.test')
    await gotoApp(page, '/')
    await mock.ready()
    expect(await page.evaluate(() => window.__MOCK_INIT__?.session)).toBe('pelajar@demo.test')
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pp.auth') ?? 'null'))
    expect(stored?.user?.email).toBe('pelajar@demo.test')
    expect(stored?.remember).toBe(false)
    expect(await mock.requests('POST /api/auth/login')).toHaveLength(0)
    await expect(page).toHaveURL('/dashboard')
  })

  test('loginAs after the first load reloads into the session', async ({ page, loginAs }) => {
    await gotoApp(page, '/')
    await expect(page).toHaveURL('/login')
    await loginAs('guru@demo.test', { remember: true })
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pp.auth') ?? 'null'))
    expect(stored?.user?.email).toBe('guru@demo.test')
    expect(stored?.remember).toBe(true)
  })

  test('failNext and the request log reach the page', async ({ page, loginAs, mock }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp(page, '/')
    await mock.ready()
    // `status` is null while the request is pending (e2e latency 400 ms).
    await expect.poll(async () => (await mock.lastRequest('GET /api/me'))?.status).toBe(200)

    // Every navigation refreshes the user in the background (FR-M01-52).
    await mock.failNext('GET /api/me', 500)
    await navigateInApp(page, '/tiada-halaman')
    await expect
      .poll(async () => {
        const last = await mock.lastRequest('GET /api/me')
        return last && { status: last.status, faulted: last.faulted }
      })
      .toEqual({ status: 500, faulted: true })
  })

  test.describe('mockInit option', () => {
    test.use({ mockInit: { latency: 0, seed: 7 } })

    test('is written to __MOCK_INIT__ (now stays with the Playwright clock)', async ({
      page,
      mock,
    }) => {
      await gotoApp(page, '/')
      await mock.ready()
      expect(await page.evaluate(() => window.__MOCK_INIT__)).toEqual({ latency: 0, seed: 7 })
      expect(await mock.now()).toBeGreaterThanOrEqual(T0)
    })
  })
})
