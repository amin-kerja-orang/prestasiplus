/**
 * Studio search with no match. HTTP: GET /api/questions?search=<random> -> 200, empty `data`, `meta.totalItems` 0.
 * UI: /admin/studio?search=<random> shows the empty panel (`studio-empty`) with the exact BM copy "Tiada soalan dijumpai."
 * (StudioListPage.vue:659, shown when a filter is active; without a filter the copy is "Belum ada soalan.") and the
 * "Set Semula" button (`studio-empty-reset`). No horizontal page scroll at 375 / 768 / 1280.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_ADMIN_PUSAT_PASS).
 */
import { account, expectNoHScroll } from '../api/helpers'
import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'

test.describe('Studio search empty state @api', () => {
  test.setTimeout(90_000)

  test('a nonexistent search returns an empty list over HTTP and shows "Tiada soalan dijumpai." in the Studio @api', async ({ page }) => {
    const admin = account('adminPusat')
    await loginViaUi(page, admin.user, admin.pass)
    const needle = `zzqx${String(Date.now())}nonexistent`

    const res = await page.request.get(`/api/questions?search=${encodeURIComponent(needle)}`)
    expect(res.status(), 'GET /api/questions?search=').toBe(200)
    const body = (await res.json()) as { data: unknown[]; meta: { totalItems: number } }
    expect(body.data).toEqual([])
    expect(body.meta.totalItems).toBe(0)

    await gotoApi(page, `/admin/studio?search=${encodeURIComponent(needle)}`)
    const empty = page.getByTestId('studio-empty')
    await expect(empty).toBeVisible({ timeout: 20_000 })
    await expect(empty).toContainText('Tiada soalan dijumpai.')
    await expect(page.getByTestId('studio-empty-reset')).toBeVisible()
    await expectNoHScroll(page)
  })
})
