/**
 * @api AM sweep http-mode fixes (slug `am-sweep-http-23oct`), against the REAL API. Read-only.
 *
 * SW3-01: Guru on `/guru/analisis-item` picks a subject; the page reloads (URL gets `subject_id`) and the
 *   select keeps showing the chosen option. The API sends option ids as strings, the query id is a number;
 *   a strict `===` compare used to snap the select back to "Semua Subjek".
 * SW3-02: Admin on `/analisa-item/sekolah/1` has no "Prestasi 360" link to `/sekolah/1/prestasi` (that
 *   route does not exist) and no global 404 page.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_GURU_PASS / BIJAK_ADMIN_PUSAT_PASS).
 */

import type { Page } from '@playwright/test'

import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

/** Below `md` the filter selects sit in a bottom sheet behind the "Penapis" button (DsFilterBar). */
async function showFilters(page: Page): Promise<void> {
  const open = page.locator('[data-ds=filter-open]')
  const select = page.getByTestId('filter-subject')
  await expect(open.or(select).first()).toBeVisible({ timeout: 20_000 })
  if (await open.isVisible()) {
    if (!(await select.isVisible())) await open.click()
  }
  await expect(select).toBeVisible()
}

test.describe('sweep AM http-mode fixes @api', () => {
  test.setTimeout(60_000)

  test('guru keeps the chosen subject selected on Analisis Item @api', async ({ page }) => {
    const { user, pass } = account('guru')
    await loginViaUi(page, user, pass)
    await gotoApi(page, '/guru/analisis-item')

    await showFilters(page)
    const select = page.getByTestId('filter-subject')
    const options = select.locator('option')
    // The poc seed gives the demo teacher subject options; no skip, so a regression cannot hide.
    expect(await options.count()).toBeGreaterThan(1)

    const value = (await options.nth(1).getAttribute('value')) ?? ''
    const label = ((await options.nth(1).textContent()) ?? '').trim()
    expect(value).not.toBe('')

    const reload = page.waitForResponse(
      (r) => r.url().includes('/api/teacher/item-analysis') && r.url().includes(`subjectId=${value}`),
      { timeout: 20_000 },
    )
    await select.selectOption(value)
    expect((await reload).status()).toBe(200)

    await expect(page).toHaveURL(new RegExp(`subject_id=${value}(&|$)`))
    // The page reloaded with the new query; on mobile the sheet may have closed with it.
    await showFilters(page)
    await expect(page.getByTestId('filter-subject')).toHaveValue(value)
    await expect(
      page.getByTestId('filter-subject').locator('option:checked'),
    ).toHaveText(label)
    await expectNoHScroll(page)
  })

  test('admin has no dead "Prestasi 360" link on Analisa Item Sekolah @api', async ({ page }) => {
    const { user, pass } = account('adminPusat')
    await loginViaUi(page, user, pass)
    await gotoApi(page, '/analisa-item/sekolah/1')

    await expect(page.getByTestId('school-gps-card')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('a[href="/sekolah/1/prestasi"]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Prestasi 360' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toHaveCount(0)
    await expectNoHScroll(page)
  })
})
