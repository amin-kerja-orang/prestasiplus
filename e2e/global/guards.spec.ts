/**
 * Global smoke: route guards (overview §5.4; F-13; build-plan F-22).
 *
 * Current behaviour with no module routes built:
 * - a guest on `/` or on any `access: 'auth'` route goes to `/login` (no query, no message);
 *   `/login` is not built yet (M01), so it renders the 404 page;
 * - a logged-in user on `/` goes to their landing path (`/dashboard` for a student, not built yet
 *   (M08) → 404), and on a route whose `roles` exclude them goes to the landing path
 *   (`onForbidden: 'landing'`, BR-07) or sees the in-place 403 page with the URL unchanged
 *   (`onForbidden: '403'`);
 * - `/logout` clears the session and goes to `/login`.
 *
 * The redirect tests assert the URL only, so they stay green when M01 and M08 build `/login` and
 * `/dashboard`. The client-side redirect tests start on another URL (`/tiada-halaman`), so a blocked
 * navigation (which would stay there) cannot pass as a redirect.
 *
 * Auth and role routes are probe routes (`e2e/support/probe-route.ts`) until modules add real ones.
 */

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  navigateInApp,
  openProbeRoute,
  provisional,
  TAG,
} from '../support'

const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'
const START = '/tiada-halaman'
const PROBE_REASON = 'probe route until M08/M01'

test.describe('guards', { tag: [TAG.smoke] }, () => {
  test('guest on / goes to /login', async ({ page, gotoApp }) => {
    await gotoApp('/')
    await expect(page).toHaveURL('/login')
  })

  test(
    'guest on an auth route goes to /login with no query (probe route)',
    provisional(PROBE_REASON),
    async ({ page, gotoApp }) => {
      await gotoApp(START)
      await expect(page).toHaveURL(START)
      await openProbeRoute(page, { path: '/__e2e/auth-only', layout: 'user', access: 'auth' })
      await expect(page).toHaveURL('/login')
      await expect(page.locator('[data-layout="user"]')).toHaveCount(0)
    },
  )

  test('logged-in user on / goes to the landing path', async ({ page, gotoApp, loginAs }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/')
    await expect(page).toHaveURL('/dashboard')
  })

  test(
    'role mismatch redirects to the landing path (probe route)',
    provisional(PROBE_REASON),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp(START)
      await expect(page).toHaveURL(START)
      await openProbeRoute(page, {
        path: '/__e2e/admin-only',
        layout: 'admin',
        access: 'auth',
        roles: ['admin'],
        onForbidden: 'landing',
      })
      await expect(page).toHaveURL('/dashboard')
      await expect(page.locator('[data-layout="admin"]')).toHaveCount(0)
    },
  )

  test(
    'role mismatch with onForbidden 403 renders the 403 page in place (probe route)',
    provisional(PROBE_REASON),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp(START)
      await openProbeRoute(page, {
        path: '/__e2e/teacher-only',
        layout: 'user',
        access: 'auth',
        roles: ['teacher'],
        onForbidden: '403',
      })
      await expect(page).toHaveURL('/__e2e/teacher-only')
      await expectTabTitle(page, FORBIDDEN_TITLE)
      const main = page.getByRole('main')
      await expect(main.getByText('403', { exact: true })).toBeVisible()
      await expect(main.getByText('🚫', { exact: true })).toBeVisible()
      await expect(main.getByRole('heading', { level: 1, name: 'Akses Ditolak' })).toBeVisible()
      await expect(
        main.getByText(
          'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.',
          { exact: true },
        ),
      ).toBeVisible()
      await expect(main.getByRole('link', { name: 'Halaman Utama', exact: true })).toHaveAttribute(
        'href',
        '/',
      )
      await expect(main.getByRole('link', { name: 'Log Masuk', exact: true })).toHaveAttribute(
        'href',
        '/login',
      )
      await expect(page.locator('[data-layout="user"]')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test('/logout clears the session and goes to /login', async ({ page, gotoApp, loginAs }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp(START)
    expect(await page.evaluate(() => localStorage.getItem('pp.auth'))).not.toBeNull()

    // Client-side, as the shell's "Log Keluar" link does (a full page load would log in again
    // from __MOCK_INIT__.session).
    await navigateInApp(page, '/logout')
    await expect(page).toHaveURL('/login')
    expect(await page.evaluate(() => localStorage.getItem('pp.auth'))).toBeNull()
  })
})
