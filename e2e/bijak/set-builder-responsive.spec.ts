/**
 * Set Builder (R1-F08) and Semak Kertas at 375 / 768 / 1280: no horizontal page scroll, the D90
 * group flow by hand (add a group, Naik / Turun, Buang) and the Terbitkan disabled reason.
 * Mock only; needs the scope-on build: `npm run test:e2e:bijak`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE } from './bijak-flow'

test.skip(HTTP_MODE, 'mock-only')
test.skip(process.env.E2E_PROTOTYPE_SCOPE !== 'on', 'needs the scope-on build: playwright.bijak.config.mjs')

const SHOTS = process.env.SHOTS_DIR ?? 'test-results-bijak/shots'

async function noScroll(page: Page): Promise<void> {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
  expect(r.sw, `scrollWidth ${r.sw} > innerWidth ${r.iw}`).toBeLessThanOrEqual(r.iw)
  await expectNoHorizontalScroll(page)
}

/** The pane switch is shown below `lg` (1024 px). */
const narrow = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 1024

async function shot(page: Page, name: string): Promise<void> {
  const w = page.viewportSize()?.width ?? 0
  await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true })
}

test.describe('Set Builder responsive @bijak', () => {
  test('landing, builder with a stimulus group, Semak Kertas @bijak', async ({ page, loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/studio/sets')
    await expect(page.getByTestId('set-builder-page')).toBeVisible()
    await noScroll(page)
    await shot(page, 'landing')

    // Mula kosong: try every subject / kertas until the bank holds a stimulus group.
    const subjects = await page.getByTestId('blank-subject').locator('option').evaluateAll((o) =>
      (o as HTMLOptionElement[]).map((x) => x.value).filter(Boolean),
    )
    let found = false
    for (const code of subjects) {
      await page.getByTestId('blank-subject').selectOption(code)
      const kertas = await page.getByTestId('blank-kertas').locator('option').evaluateAll((o) =>
        (o as HTMLOptionElement[]).map((x) => x.value).filter(Boolean),
      )
      for (const k of kertas) {
        await page.getByTestId('blank-subject').selectOption(code)
        await page.getByTestId('blank-kertas').selectOption(k)
        await page.getByTestId('blank-submit').click()
        await expect(page.getByTestId('set-builder-editor')).toBeVisible()
        if (narrow(page)) await page.getByTestId('builder-pane-bank').click()
        await expect(page.locator('[data-testid=bank-list], [data-testid=bank-empty]')).toBeVisible()
        if (await page.locator('[data-testid^=pool-group-]').count()) {
          found = true
          break
        }
        // In-app back to the landing (a reload would reset the mock state).
        await page.getByRole('link', { name: 'Kembali' }).first().click()
        await expect(page.getByTestId('set-builder-page')).toBeVisible()
      }
      if (found) break
    }
    expect(found, 'a stimulus group in the bank').toBe(true)
    await noScroll(page)
    await shot(page, 'builder-bank')

    // Add the group (one click on the unit), then a single question after it.
    const group = page.locator('[data-testid^=pool-group-]').first()
    const gid = (await group.getAttribute('data-testid'))!.replace('pool-group-', '')
    await group.locator('[data-testid^=pool-add-]').click()
    await expect(page.locator('[data-testid^=pool-add-]').first()).toBeVisible()
    const single = page.locator('[data-testid^=pool-]:not([data-testid^=pool-group-]):not([data-testid=pool-stimulus]):not([data-testid=pool-reasons])').filter({ has: page.locator('[data-testid^=pool-add-]') }).first()
    if (await single.count()) await single.locator('[data-testid^=pool-add-]').click()

    if (narrow(page)) await page.getByTestId('builder-pane-set').click()
    const unit = page.getByTestId(`unit-group-${gid}`)
    await expect(unit).toHaveCount(1)
    await expect(unit.locator('[data-testid=set-stimulus]')).toHaveCount(1)
    await noScroll(page)
    await shot(page, 'builder-set')

    // Naik / Turun move the whole unit, Buang removes it whole.
    const firstId = (await unit.locator('[data-testid^=remove-]').getAttribute('data-testid'))!.replace('remove-', '')
    const down = page.getByTestId(`down-${firstId}`)
    if (await down.isEnabled()) await down.click()
    else await page.getByTestId(`up-${firstId}`).click()
    await expect(page.getByTestId(`unit-group-${gid}`)).toHaveCount(1)
    await expect(page.getByTestId('builder-publish')).toBeDisabled()
    await expect(page.getByTestId('builder-publish-reason')).toContainText('masalah')
    await noScroll(page)
    await shot(page, 'builder-publish-blocked')
    await page.getByTestId(`remove-${firstId}`).click()
    await expect(page.getByTestId(`unit-group-${gid}`)).toHaveCount(0)

    // Semak Kertas of the same paper.
    const id = new URL(page.url()).pathname.split('/')[4]!
    await page.getByTestId('builder-semak').click()
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    await expect(page.getByTestId('paper-review')).toBeVisible()
    await expect(page.getByTestId('paper-publish')).toBeDisabled()
    expect(new URL(page.url()).pathname).toContain(id)
    await noScroll(page)
    await shot(page, 'semak')
  })
})
