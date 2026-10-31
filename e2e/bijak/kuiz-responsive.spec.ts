/**
 * Simulasi Kuiz (R1-F12) responsive smoke, mock build: /simulasi/kuiz (random, count 20), the paper
 * cover link "Kuiz kertas ini" and /simulasi/:paperId/kuiz with a D90 stimulus group. No horizontal
 * scroll (documentElement.scrollWidth <= innerWidth). Screenshots go to KUIZ_SHOTS when set.
 */
import { expect, test } from '../fixtures/test'

const SHOTS = process.env.KUIZ_SHOTS
const PAPER = 'mat-k1-2025-a'

async function fits(page: import('@playwright/test').Page, label: string): Promise<void> {
  await page.waitForTimeout(300)
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
  console.log(`KUIZ-WIDTH ${label} scrollWidth=${m.sw} innerWidth=${m.iw}`)
  expect(m.sw, label).toBeLessThanOrEqual(m.iw)
  if (SHOTS) {
    const w = m.iw
    await page.screenshot({ path: `${SHOTS}/${label}-${w}.png`, fullPage: true })
  }
}

test.describe('Simulasi Kuiz responsive', () => {
  test('random quiz, paper cover link and per-paper quiz with a group', async ({ page, loginAs, gotoApp }) => {
    await loginAs('pelajar2@demo.test')

    await gotoApp('/spm/bijak')
    await expect(page.getByTestId('kuiz-link')).toBeVisible()
    await fits(page, 'hub')

    await gotoApp('/simulasi/kuiz?count=20')
    await expect(page.getByTestId('kuiz-counter')).toBeVisible({ timeout: 20_000 })
    await fits(page, 'kuiz-random')
    await page.locator('[data-testid^="mcq-option-"] input').first().check({ force: true })
    await page.getByTestId('kuiz-semak').click()
    await expect(page.getByTestId('kuiz-verdict')).toBeVisible()
    await fits(page, 'kuiz-random-verdict')

    await gotoApp(`/spm/bijak/kertas/${PAPER}`)
    await expect(page.getByTestId('paper-kuiz-link')).toBeVisible({ timeout: 20_000 })
    await fits(page, 'cover')
    await page.getByTestId('paper-kuiz-link').click()
    await expect(page.getByTestId('paper-quiz-header')).toBeVisible({ timeout: 20_000 })
    expect(page.url()).toContain(`/simulasi/${PAPER}/kuiz`)
    await expect(page.getByTestId('stimulus-group').first()).toBeVisible()
    expect(await page.getByTestId('stimulus-group').count()).toBeGreaterThanOrEqual(1)
    await fits(page, 'paper-quiz-group')

    // H-C8: a paper whose stimulus is a wide table (Sejarah K2) still fits the viewport
    await gotoApp('/simulasi/sej-k2-2025-a/kuiz')
    await expect(page.getByTestId('paper-quiz-header')).toBeVisible({ timeout: 20_000 })
    // below 1024px each shared stimulus opens from its chip (bottom sheet); from lg it is the pinned pane. Open every chip
    // so any table of the page is on screen when the width is measured.
    for (const chip of await page.getByTestId('stimulus-chip').all()) {
      await chip.click()
      await page.keyboard.press('Escape')
    }
    console.log(`KUIZ-TABLES ${await page.locator('table').count()}`)
    await fits(page, 'paper-quiz-table')
  })
})
