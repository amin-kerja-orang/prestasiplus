/**
 * @api specs for auth + session (BE-03, V2-T31): real login form, cookie flags, a reload that keeps
 * the session, the CSRF rule, logout, and the role switch. Run against the stack:
 *   npm run stack:up && npm run test:e2e:http -- --grep @api
 * The accounts are the BE-07 seed (`pelajar@demo.test` student, `guruadmin@demo.test` teacher +
 * school admin), password `Demo1234`.
 */

import { API_PASSWORD, currentSession, expect, gotoApi, loginViaUi, test } from '../fixtures/api'

test.describe('auth and session @api', () => {
  // bcrypt on the real API makes a login take several seconds on a busy machine.
  test.setTimeout(60_000)

  test('login: bad password shows the server message and stays on /login @api', async ({ page }) => {
    await gotoApi(page, '/login')
    const form = page.getByTestId('login-form')
    await form.getByLabel('Alamat Email').fill('pelajar@demo.test')
    await form.getByLabel('Kata Laluan').fill('SalahSalah1')
    await form.getByRole('button', { name: 'Log Masuk' }).click()
    // A failed login is held back on purpose (timing floor), so allow for it.
    await expect(page.getByTestId('login-alert')).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('login: student signs in, cookie is HttpOnly + SameSite=Lax, reload keeps the session @api', async ({
    page,
    context,
  }) => {
    await loginViaUi(page, 'pelajar@demo.test')

    const cookie = (await context.cookies()).find((c) => c.name === 'pp_session')
    expect(cookie, 'pp_session cookie').toBeDefined()
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
    expect(await page.evaluate(() => document.cookie)).not.toContain('pp_session')

    const session = await currentSession(page)
    expect(session.active.role).toBe('student')
    const landing = new URL(page.url()).pathname
    expect(landing).toBe(session.landingPath)

    await page.reload()
    await expect(page).not.toHaveURL(/\/login/)
    expect(new URL(page.url()).pathname).toBe(landing)
  })

  test('the app restores the session from the cookie when localStorage is empty @api', async ({
    page,
  }) => {
    await loginViaUi(page, 'pelajar@demo.test')
    const landing = new URL(page.url()).pathname
    await page.evaluate(() => localStorage.removeItem('pp.auth'))
    await page.goto(landing)
    await expect(page).not.toHaveURL(/\/login/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('pp.auth') !== null)).toBe(true)
  })

  test('a write without the CSRF header is refused, with it the role switch works @api', async ({
    page,
  }) => {
    // API login, not the form: this account starts as school_admin, whose `/admin` landing page is not
    // reachable for that role in the SPA yet (frontend gap, see the T31 report). The SPA then picks the
    // cookie session up on its own (T7).
    const login = await page.request.post('/api/auth/login', {
      data: { identifier: 'guruadmin@demo.test', password: API_PASSWORD },
    })
    expect(login.status()).toBe(200)
    await gotoApi(page, '/login')
    const session = await currentSession(page)
    expect(session.roles.map((r) => r.role).sort()).toEqual(['school_admin', 'teacher'])
    const first = session.active.role
    const other = first === 'teacher' ? 'school_admin' : 'teacher'

    const noCsrf = await page.request.post('/api/session/role', { data: { role: other } })
    expect(noCsrf.status()).toBe(403)

    const switched = await page.request.post('/api/session/role', {
      data: { role: other },
      headers: { 'x-csrf-token': session.csrf },
    })
    expect(switched.status()).toBe(200)
    expect((await currentSession(page)).active.role).toBe(other)

    // The app follows the server: after a reload it rebuilds pp.auth from GET /api/session.
    await page.reload()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (JSON.parse(localStorage.getItem('pp.auth') ?? 'null') as { user?: { role?: string } } | null)
              ?.user?.role ?? null,
        ),
      )
      .toBe(other)
  })

  test('logout from the app ends the cookie session @api', async ({ page }) => {
    await loginViaUi(page, 'pelajar@demo.test')
    await page.goto('/logout')
    await expect(page).toHaveURL(/\/login/)
    const res = await page.request.get('/api/session')
    expect(res.status()).toBe(401)
  })
})
