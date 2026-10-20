/**
 * Bijak SPM autosave against the REAL API (http-mode build). Runs only when `BIJAK_API_BASE` is set
 * (the origin serving the VITE_API_MODE=http SPA with /api behind it; same approach as
 * playwright.http.config.ts of BE-32). Credentials come from the environment, never from the repo:
 *   BIJAK_STUDENT_USER, BIJAK_STUDENT_PASS
 * It does not import the mock fixtures (no `__mock`, no clock, no `loginAs`): plain
 * `@playwright/test`, UI login through the login form, navigation with `page.goto`.
 */
import { expect, test } from '@playwright/test'

import {
  expectNoHorizontalScrollHttp,
  HTTP_MODE,
  PAPER_ID,
  pickOption,
  pressedOptions,
  startPaper,
} from './bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from './http-creds'

const { user: USER, pass: PASS } = demoCreds('student')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!USER || !PASS, NEEDS_PASSWORD)

test.describe('Bijak SPM autosave over HTTP @bijak @api', () => {
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
    await expectNoHorizontalScrollHttp(page)
    // The mock paper id does not exist on a real stack: use BIJAK_PAPER_ID or the hub's first paper.
    const firstOpen = page.locator('[data-testid^=open-]').first()
    await expect(firstOpen).toBeVisible()
    const firstId = (await firstOpen.getAttribute('data-testid'))?.slice('open-'.length)
    await startPaper(page, process.env.BIJAK_PAPER_ID ?? firstId ?? PAPER_ID)
    const attemptUrl = page.url()

    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' && /\/api\/bijak\/attempts\/[^/]+\/answers$/.test(r.url()),
    )
    // A resumed attempt (same account, earlier run) may already have an answer; tapping a pressed
    // option clears it, so pick one that is not pressed.
    const pressedNow = await pressedOptions(page)
    await pickOption(page, Math.max(0, pressedNow.indexOf('false')))
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
    await expectNoHorizontalScrollHttp(page)
  })
})
