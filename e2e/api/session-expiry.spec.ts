/**
 * @api 401 / session expiry against the REAL API (BE-32 AC3, slug `e2e-bijak`). Writes nothing.
 *
 * What the code does:
 * - src/api/client.ts: any 401 outside `/api/auth/*` calls `onUnauthorized` (session store clears the
 *   session and `replace('/login')`, plain, no message, FR-M01-14).
 * - src/app/router/guards.ts: a guest sent to a protected page gets `/login?redirect=<path>` (v2).
 * - Which of the two paths a reload takes depends on whether the SPA still holds `pp.auth` in
 *   localStorage, so both are covered. Assertions that rest on that reading are @provisional.
 * - POST /api/auth/logout answers 204 and clears the cookie (apps/api/src/modules/auth/auth.controller.ts).
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS).
 */

import { currentSession, expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { account, csrfOf, expectNoHScroll, sessionCookie } from './helpers'

const PROTECTED = '/spm/bijak'

test.describe('session expiry @api', () => {
  test.setTimeout(60_000)

  test('cookie deleted: API calls answer 401 and the app lands on /login without crashing @api @provisional', async ({
    page,
    context,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)
    const csrf = await csrfOf(page)

    await context.clearCookies({ name: 'pp_session' })
    expect(await sessionCookie(context)).toBeUndefined()

    // API level (real): reads and writes both refuse.
    expect((await page.request.get('/api/session')).status()).toBe(401)
    expect((await page.request.get('/api/bijak/papers')).status()).toBe(401)
    const write = await page.request.post('/api/bijak/attempts', {
      data: { paperId: '1', mode: 'latihan' },
      headers: { 'x-csrf-token': csrf },
    })
    expect(write.status(), 'POST without a session').toBe(401)

    // SPA: pp.auth is still in localStorage, so the protected page starts to render and its first
    // API call (the 401) sends the app to plain /login (401 policy).
    await page.goto(PROTECTED)
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
    await expect(page.getByTestId('login-form')).toBeVisible()
    await expectNoHScroll(page)
    expect(errors, 'uncaught page errors').toEqual([])
  })

  test('cookie and localStorage gone: the protected page redirects to /login (with the return path) @api @provisional', async ({
    page,
    context,
  }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)
    await context.clearCookies({ name: 'pp_session' })
    await page.evaluate(() => localStorage.clear())

    await page.goto(PROTECTED)
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
    // v2 guard remembers the page asked for. INFERRED: the exact query shape.
    const url = new URL(page.url())
    expect.soft(url.searchParams.get('redirect'), 'return path').toBe(PROTECTED)
    await expect(page.getByTestId('login-form')).toBeVisible()
    await expectNoHScroll(page)
  })

  test('a revoked (logged out) session cookie that is replayed is refused with 401 @api', async ({
    page,
    context,
  }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)
    const stale = await sessionCookie(context)
    expect(stale, 'pp_session cookie').toBeDefined()
    const csrf = (await currentSession(page)).csrf

    const out = await page.request.post('/api/auth/logout', { headers: { 'x-csrf-token': csrf } })
    expect(out.status(), 'POST /api/auth/logout').toBe(204)
    expect(await sessionCookie(context)).toBeUndefined()

    // Put the old cookie value back: the server must no longer know it.
    await context.addCookies([stale!])
    expect((await page.request.get('/api/session')).status()).toBe(401)

    await gotoApi(page, PROTECTED)
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
  })
})
