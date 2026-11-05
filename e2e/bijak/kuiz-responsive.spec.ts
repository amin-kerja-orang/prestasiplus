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
    // FR-X6-6: below 1024px the first group's sheet is open when the page appears, and only that one (it is modal, so a
    // second would stack on it). A tap outside closes it and gives the chips back. From lg it is the pinned pane, no sheet.
    const width = page.viewportSize()!.width
    const sheets = page.locator('[role="dialog"][data-state="open"]')
    await expect(sheets).toHaveCount(width < 1024 ? 1 : 0)
    if (width < 1024) {
      // The sheet ignores a tap while it is still sliding in; a pupil taps after it has settled.
      await sheets.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
      await page.mouse.click(width / 2, 4)
      await expect(sheets).toHaveCount(0)
    }
    // Open the chip that holds the table, assert the table is on screen, and measure the width WHILE it is open.
    const chips = page.getByTestId('stimulus-chip')
    for (let i = 0; i < (await chips.count()); i += 1) {
      await chips.nth(i).click()
      if ((await page.locator('table:visible').count()) > 0) break
      await page.keyboard.press('Escape')
    }
    await expect(page.locator('table:visible').first()).toBeVisible()
    expect(await page.locator('table:visible').count()).toBeGreaterThanOrEqual(1)
    await fits(page, 'paper-quiz-table')
  })
})
