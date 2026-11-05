/**
 * S0-T12 part D, global error UI (R1, PRD 40 §X10.13). Runs only under playwright.http.config.ts
 * (real stack) at 375 / 768 / 1280.
 *
 * Covers what the stack shows without module changes:
 * - AC-ERR-2 / ERR-AUTH-01: a 401 lands on `/login?kembali=<page>`, the login page shows
 *   "Sesi anda telah tamat. Sila log masuk semula.", and after login the browser returns to the page.
 *   An unsafe `kembali` (`//host`) is ignored.
 * - AC-ERR-4 / ERR-NET-01 / ERR-NET-03: the offline banner (browser offline), no layout shift and no
 *   horizontal scroll at 375, then "Sambungan dipulihkan." for 3 s.
 *
 * Left for the owners of module save controls (no generic control exists in S0 / src/ds yet):
 * AC-ERR-5 (double submit) and AC-ERR-6 (stale draft dialog), and the draft restore half of AC-ERR-2.
 * AC-ERR-3 (429 countdown) needs the M01 login page to render DsLoadError; it is covered at unit
 * level by src/ds/__tests__/load-error-rate-limit.test.ts.
 */
import type { Page } from '@playwright/test'

import { account, expectNoHScroll } from '../api/helpers'
import { expect, gotoApi, test } from '../fixtures/api'

const EXPIRED = 'Sesi anda telah tamat. Sila log masuk semula.'
const OFFLINE = 'Anda sedang luar talian. Semak sambungan internet anda.'
const RESTORED = 'Sambungan dipulihkan.'

test.describe('401 return URL (AC-ERR-2, ERR-AUTH-01)', () => {
  test('@api AC-ERR-2 a 401 goes to /login?kembali= with the banner, and login returns to the page', async ({
    page,
  }) => {
    const { user, pass } = account('student')
    // Sign in first, then make the next protected API call answer 401 (session expired).
    await gotoApi(page, '/login')
    const form = page.getByTestId('login-form')
    await form.getByLabel('Alamat Email').fill(user)
    await form.getByLabel('Kata Laluan').fill(pass)
    await form.getByRole('button', { name: 'Log Masuk' }).click()
    await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 20_000 })

    let expired = false
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      if (expired || url.pathname.startsWith('/api/auth/') || route.request().method() !== 'GET') {
        return route.continue()
      }
      expired = true
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthenticated.' } }),
      })
    })

    // In-app navigation (no reload): a full page load would re-check the session at boot and send a
    // guest to `?redirect=`, which is the guard's path, not the 401-in-use path this AC covers.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/profile')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/\/login\?kembali=(%2F|\/)/, { timeout: 20_000 })
    // `kembali` is the page that was current when the 401 arrived; login must return exactly there.
    const kembali = new URL(page.url()).searchParams.get('kembali') ?? ''
    expect(kembali.startsWith('/') && !kembali.startsWith('//')).toBe(true)
    await expect(page.getByTestId('login-session-expired')).toHaveText(EXPIRED)
    await expectNoHScroll(page)

    await page.unroute('**/api/**')
    const again = page.getByTestId('login-form')
    await again.getByLabel('Alamat Email').fill(user)
    await again.getByLabel('Kata Laluan').fill(pass)
    await again.getByRole('button', { name: 'Log Masuk' }).click()
    await expect
      .poll(() => new URL(page.url()).pathname + new URL(page.url()).search, { timeout: 20_000 })
      .toBe(kembali)
  })

  test('@api AC-ERR-2 an unsafe kembali shows no banner and is not followed', async ({ page }) => {
    await gotoApi(page, '/login?kembali=%2F%2Fevil.example')
    await expect(page.getByTestId('login-form')).toBeVisible()
    await expect(page.getByTestId('login-session-expired')).toHaveCount(0)
  })
})

/** Signs the seed pupil in through the real form and waits until the app has left /login. */
async function signInPupil(page: Page): Promise<{ user: string; pass: string }> {
  const { user, pass } = account('student')
  await gotoApi(page, '/login')
  const form = page.getByTestId('login-form')
  await form.getByLabel('Alamat Email').fill(user)
  await form.getByLabel('Kata Laluan').fill(pass)
  await form.getByRole('button', { name: 'Log Masuk' }).click()
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 20_000 })
  return { user, pass }
}

/** In-app navigation (no reload), as in the AC-ERR-2 test above. */
async function goInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test.describe('save controls (AC-ERR-5, AC-ERR-2 draft)', () => {
  test('@api AC-ERR-5 a double click on Simpan Profil sends one PUT /api/me and shows Menyimpan...', async ({
    page,
  }) => {
    await signInPupil(page)
    await goInApp(page, '/profile/edit')
    const phone = page.getByTestId('profile-phone-input')
    await expect(phone).toBeVisible({ timeout: 20_000 })

    // Slow the save down so the pending label can be seen. The value is re-sent unchanged, so the
    // shared seed account is not altered.
    const puts: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'PUT' && new URL(req.url()).pathname === '/api/me') puts.push(req.url())
    })
    await page.route('**/api/me', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      await new Promise((resolve) => setTimeout(resolve, 800))
      return route.continue()
    })
    await phone.fill(await phone.inputValue())
    const save = page.getByTestId('profile-save')
    await save.dblclick()
    await expect(save).toHaveText('Menyimpan...')
    await expect(save).toHaveAttribute('aria-busy', 'true')
    await expect(save).toBeDisabled()
    await expectNoHScroll(page)
    await expect(save).toHaveText('Simpan Profil', { timeout: 20_000 })
    expect(puts, 'PUT /api/me requests for one double click').toHaveLength(1)
  })

  test('@api AC-ERR-2 an unsaved profile edit survives a 401 and is restored after login with the notice', async ({
    page,
  }) => {
    const { user, pass } = await signInPupil(page)
    await goInApp(page, '/profile/edit')
    const name = page.getByTestId('profile-name-input')
    await expect(name).toBeVisible({ timeout: 20_000 })
    const edited = 'Suntingan Ujian E2E'
    await name.fill(edited)
    await page.waitForTimeout(800) // the draft debounce is 500 ms

    let expired = false
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      if (expired || url.pathname.startsWith('/api/auth/') || route.request().method() !== 'GET') {
        return route.continue()
      }
      expired = true
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthenticated.' } }),
      })
    })
    // Same page with a query: a navigation that makes the app refresh /api/me, which answers 401.
    await goInApp(page, '/profile/edit?sesi=1')
    await expect(page).toHaveURL(/\/login\?kembali=(%2F|\/)profile(%2F|\/)edit/, { timeout: 20_000 })
    await expect(page.getByTestId('login-session-expired')).toHaveText(EXPIRED)
    await expectNoHScroll(page)

    await page.unroute('**/api/**')
    const again = page.getByTestId('login-form')
    await again.getByLabel('Alamat Email').fill(user)
    await again.getByLabel('Kata Laluan').fill(pass)
    await again.getByRole('button', { name: 'Log Masuk' }).click()
    await expect(page).toHaveURL(/\/profile\/edit/, { timeout: 20_000 })
    await expect(page.getByTestId('draft-restored-notice')).toHaveText(
      'Terdapat kerja yang belum disimpan daripada sesi sebelum ini.',
    )
    await expect(page.getByTestId('profile-name-input')).toHaveValue(edited)
    await expectNoHScroll(page)
  })
})

test.describe('offline banner (AC-ERR-4, ERR-NET-01, ERR-NET-03)', () => {
  test('@api AC-ERR-4 shows within 10 s, no layout shift, no horizontal scroll, then recovers for 3 s', async ({
    page,
    context,
  }) => {
    await gotoApi(page, '/login')
    const anchor = page.getByTestId('login-form')
    await expect(anchor).toBeVisible()
    const before = await anchor.boundingBox()

    await context.setOffline(true)
    const banner = page.getByTestId('offline-banner')
    await expect(banner).toContainText(OFFLINE, { timeout: 10_000 })
    await expect(banner).toHaveAttribute('role', 'status')
    const during = await anchor.boundingBox()
    expect(during?.y, 'page content does not move under the banner').toBe(before?.y)
    await expectNoHScroll(page)

    await context.setOffline(false)
    await expect(banner).toContainText(RESTORED, { timeout: 10_000 })
    await expect(banner).not.toContainText(RESTORED, { timeout: 6_000 })
    await expect(banner).toHaveText('')
  })
})
