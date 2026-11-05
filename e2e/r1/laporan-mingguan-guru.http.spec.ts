/**
 * S6-T01 Laporan Mingguan Guru (R1-GUR-43): http mode only, real stack (`@api`). Runs in the three
 * projects of `playwright.http.config.ts` (375 / 768 / 1280). Needs `**\/r1/**` in its testMatch (S0-T06).
 * Tab title: every page title goes through `formatTabTitle`, so the route title
 * "Laporan Mingguan — PRESTASIPLUS" shows as "Laporan Mingguan | PRESTASIPLUS".
 */
import { account, expectNoHScroll } from '../api/helpers'
import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'

const PATH = '/guru/laporan-mingguan-kelas'

test.describe('Laporan Mingguan Guru @api', () => {
  test.beforeEach(async ({ page }) => {
    const guru = account('guru')
    await loginViaUi(page, guru.user, guru.pass)
    await gotoApi(page, PATH)
  })

  test('@api opens with title, heading, select and Cetak (>= 44 px), no horizontal scroll', async ({ page }) => {
    await expect(page).toHaveTitle('Laporan Mingguan | PRESTASIPLUS')
    await expect(page.getByRole('heading', { name: 'Laporan Mingguan', level: 1 })).toBeVisible()
    const toolbar = page.getByTestId('lm-toolbar')
    await expect(toolbar).toBeVisible()
    const select = page.getByTestId('lm-class')
    const cetak = page.getByRole('button', { name: 'Cetak' })
    await expect(cetak).toBeVisible()
    for (const el of [toolbar.locator('select, [role="combobox"]').first(), cetak]) {
      const box = await el.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await expect(select).toBeAttached()
    await expect(toolbar.getByText('Pilih Kelas')).toBeVisible()
    await expectNoHScroll(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('@api four tiles: 2 columns at 375, 4 across from 768', async ({ page }) => {
    const tiles = page.getByTestId('lm-tiles').locator('> *')
    await expect(tiles).toHaveCount(4)
    const xs = await tiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
    const columns = new Set(xs).size
    const width = page.viewportSize()?.width ?? 1280
    expect(columns).toBe(width < 768 ? 2 : 4)
  })

  test('@api toolbar stacks below 768 and sits in one row from 768', async ({ page }) => {
    const select = await page.getByTestId('lm-toolbar').locator('label').boundingBox()
    const cetak = await page.getByRole('button', { name: 'Cetak' }).boundingBox()
    const width = page.viewportSize()?.width ?? 1280
    if (width < 640) expect(cetak!.y).toBeGreaterThan(select!.y + select!.height - 1)
    else expect(Math.abs(cetak!.y + cetak!.height / 2 - (select!.y + select!.height / 2))).toBeLessThan(select!.height)
  })

  test('@api /guru/laporan-mingguan redirects to the -kelas page', async ({ page }) => {
    await gotoApi(page, '/guru/laporan-mingguan')
    await expect(page).toHaveURL(/\/guru\/laporan-mingguan-kelas$/)
    await expect(page.getByTestId('lm-toolbar')).toBeVisible()
  })

  test('@api print media hides the toolbar and shows the print title', async ({ page }) => {
    await expect(page.getByTestId('lm-toolbar')).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByTestId('lm-toolbar')).toBeHidden()
    const title = page.getByTestId('lm-print-title')
    await expect(title).toBeVisible()
    await expect(title).toHaveText(/^Laporan Mingguan — .+ \| \d{2} \w{3} – \d{2} \w{3} \d{4}$/)
  })
})
