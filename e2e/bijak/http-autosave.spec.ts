/**
 * Bijak SPM autosave against the REAL API (http-mode build). Runs only when `BIJAK_API_BASE` is set
 * (the origin serving the VITE_API_MODE=http SPA with /api behind it; same approach as
 * playwright.http.config.ts of BE-32). Credentials come from the environment, never from the repo:
 *   BIJAK_STUDENT_USER, BIJAK_STUDENT_PASS
 * It does not import the mock fixtures (no `__mock`, no clock, no `loginAs`): plain
 * `@playwright/test`, UI login through the login form, navigation with `page.goto`.
 */
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE, PAPER_ID, pickOption, pressedOptions, startPaper } from './bijak-flow'

const USER = process.env.BIJAK_STUDENT_USER
const PASS = process.env.BIJAK_STUDENT_PASS

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE (integration stack)')
test.skip(!USER || !PASS, 'needs BIJAK_STUDENT_USER and BIJAK_STUDENT_PASS')

test.describe('Bijak SPM autosave over HTTP @bijak', () => {
  test('answer triggers PUT /api/bijak/attempts/:id/answers (2xx) and survives a reload from the server @bijak', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill(USER ?? '')
    await page.getByTestId('login-password').fill(PASS ?? '')
    await page.getByTestId('login-submit').click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'))

    await page.goto('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await startPaper(page, PAPER_ID)
    const attemptUrl = page.url()

    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' && /\/api\/bijak\/attempts\/[^/]+\/answers$/.test(r.url()),
    )
    await pickOption(page, 1)
    const res = await saved
    expect(res.status()).toBeGreaterThanOrEqual(200)
    expect(res.status()).toBeLessThan(300)
    await expect(page.getByTestId('save-status')).toHaveText('Disimpan')
    const before = await pressedOptions(page)
    expect(before).toContain('true')

    // Drop the device copy so the restored answer can only come from the server.
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('pp.bijak.local.')) localStorage.removeItem(k)
      }
    })
    await page.reload()
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    expect(page.url()).toBe(attemptUrl)
    await expect.poll(() => pressedOptions(page)).toEqual(before)
    await expectNoHorizontalScroll(page)
  })
})
