/**
 * @api "Pratonton Kolam" of the Kontrak page over the REAL API: `GET /api/admin/blueprints/:subject/:kertas/pool` used to be 404
 * (declared in the contract and called by the FE, but no API route). Runs at 375 / 768 / 1280 (playwright.http.config.ts).
 */

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

test.describe('Kontrak Pratonton Kolam @api', () => {
  test.setTimeout(60_000)

  test('admin: the Kontrak list opens Pratonton Kolam and the pool preview loads from the API @api', async ({ page }) => {
    const { user, pass } = account('adminPusat')
    await loginViaUi(page, user, pass)

    await page.goto('/admin/spm/kontrak')
    const link = page.locator('[data-testid^="pool-"][data-testid*="-"]').filter({ hasNot: page.locator('[data-testid="pool-link"]') }).first()
    await expect(link).toBeVisible({ timeout: 20_000 })
    const loaded = page.waitForResponse((r) => /\/api\/admin\/blueprints\/[^/]+\/\d+\/pool/.test(r.url()))
    await link.click()
    const res = await loaded
    expect(res.status(), `GET ${res.url()}`).toBe(200)
    await expect(page.getByTestId('kontrak-pool')).toBeVisible()
    await expect(page.getByTestId('verdict').first()).toBeVisible()
    await expect(page.getByTestId('pool-reload')).toBeEnabled()
    await expectNoHScroll(page)
  })
})
