/**
 * @api Student landing page (AZ-20c / FE-14) against the REAL API. Read-only: nothing is written.
 *
 * `GET /api/dashboard` (packages/contract practice/reads, server practice/reads/overview) is served,
 * so a student signs in and lands on `/dashboard` (the server landingPath) in http mode. The page
 * (src/modules/m05-practice/pages/DashboardPage.vue) renders the greeting card and the main sections
 * from the real body. Runs at the three viewport projects of the config (375 / 768 / 1280).
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS).
 */

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, HOME } from './helpers'

test.describe('student dashboard @api', () => {
  test.setTimeout(90_000)

  test('murid: lands on /dashboard and the page renders from GET /api/dashboard @api', async ({
    page,
  }) => {
    const { user, pass } = account('student')
    const wait = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard') && r.request().method() === 'GET',
      { timeout: 60_000 },
    )
    await loginViaUi(page, user, pass)

    expect(new URL(page.url()).pathname).toBe(HOME.student)
    expect(HOME.student).toBe('/dashboard')
    expect((await wait).status(), 'GET /api/dashboard').toBe(200)

    await expect(page.getByTestId('dashboard-main')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('dashboard-error')).toHaveCount(0)
    await expect(page.getByTestId('dash-hero')).toContainText(/Selamat (Pagi|Tengah Hari|Petang|Malam), /)
    await expect(page.getByTestId('dash-quests')).toBeVisible()
    await expect(page.getByTestId('dash-badges-empty').or(page.getByTestId('dash-badge').first())).toBeVisible()

    await expectNoHScroll(page)
  })

  test('murid: a reload of /dashboard keeps the page and does not scroll sideways @api', async ({
    page,
  }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)
    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-main')).toBeVisible({ timeout: 30_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(overflow, 'scrollWidth <= innerWidth').toBe(true)
  })
})
