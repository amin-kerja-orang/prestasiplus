/**
 * Kandungan SPM hub and its lanes (mock build): no horizontal scroll (scrollWidth <= innerWidth) at the project viewport.
 * Screenshots go to KUIZ_SHOTS when set.
 */
import { expect, test } from '../fixtures/test'

const SHOTS = process.env.KUIZ_SHOTS

async function fits(page: import('@playwright/test').Page, label: string): Promise<void> {
  await page.waitForTimeout(300)
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
  console.log(`KAND-WIDTH ${label} scrollWidth=${m.sw} innerWidth=${m.iw}`)
  expect(m.sw, label).toBeLessThanOrEqual(m.iw)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-${m.iw}.png`, fullPage: true })
}

test('Kandungan SPM hub and lanes fit the viewport', async ({ page, loginAs, gotoApp }) => {
  await loginAs('admin@demo.test')
  await gotoApp('/admin/spm')
  await expect(page.getByTestId('kandungan-cards')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('kandungan-card-databank')).toBeVisible()
  await expect(page.getByTestId('kandungan-card-tracking-a')).toHaveCount(0)
  await fits(page, 'kandungan-hub')

  await gotoApp('/admin/spm/databank')
  await expect(page.getByTestId('lane-databank')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('lane-filter')).toBeVisible()
  await fits(page, 'kandungan-databank')

  await gotoApp('/admin/spm/simulasi')
  await expect(page.getByTestId('lane-simulasi')).toBeVisible({ timeout: 30_000 })
  await fits(page, 'kandungan-simulasi')
})
