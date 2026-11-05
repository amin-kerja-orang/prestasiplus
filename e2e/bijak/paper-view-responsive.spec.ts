/**
 * S8-T05 part 2: the shared PaperView on the cover, the admin QuestionPreview ("Pratonton sebagai
 * pelajar") and the StudentViewDrawer at 375 / 768 / 1280: no horizontal page scroll, section and
 * question text visible, and the indent step (24 px in the admin preview).
 * Mock only; needs the scope-on build: `npm run test:e2e:bijak`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE, PAPER_ID } from './bijak-flow'

test.skip(HTTP_MODE, 'mock-only')
test.skip(process.env.E2E_PROTOTYPE_SCOPE !== 'on', 'needs the scope-on build: playwright.bijak.config.mjs')

async function noScroll(page: Page): Promise<void> {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
  expect(r.sw, `scrollWidth ${r.sw} > innerWidth ${r.iw}`).toBeLessThanOrEqual(r.iw)
  await expectNoHorizontalScroll(page)
}

/** Every indent spacer of the given root is exactly `px` wide. */
async function indentWidths(page: Page, rootTestId: string): Promise<number[]> {
  return page
    .getByTestId(rootTestId)
    .locator('[data-testid="paper-indent"]')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
}

test.describe('PaperView surfaces responsive @bijak', () => {
  test('cover: section lines visible, tight list, no page scroll @bijak', async ({ page, loginAs, gotoApp }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp(`/spm/bijak/kertas/${PAPER_ID}`)
    await expect(page.getByTestId('bijak-cover')).toBeVisible()
    const list = page.getByTestId('cover-sections')
    await expect(list).toBeVisible()
    const items = list.locator('> li')
    expect(await items.count()).toBeGreaterThan(0)
    await expect(items.first()).toBeVisible()
    await expect(items.first()).toContainText(/\[\d+ markah\] · \d+ soalan/)
    await noScroll(page)
  })

  test('admin preview (24 px indent) and student view drawer @bijak', async ({ page, loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    // S0-T07: Pembina Kertas has no sidebar entry (Set Builder replaces it in the menu); open it by URL.
    await gotoApp('/admin/spm/kertas')
    await expect(page.getByTestId('papers-page')).toBeVisible()
    await page.getByTestId('paper-new').click()
    await page.getByTestId('new-subject').selectOption({ label: 'Matematik' })
    await page.getByTestId('new-kertas').selectOption({ index: 1 })
    await page.getByTestId('new-title').fill('Kertas Paparan')
    await page.getByRole('button', { name: 'Cipta Kertas' }).click()
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()

    await page.getByTestId('add-0').click()
    await expect(page.getByTestId('picker')).toBeVisible()
    await page.locator('[data-testid^=pick-add-]').first().click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('picker')).toBeHidden()

    // Admin QuestionPreview: question header visible; any part indent step is 24 px.
    await page.getByTestId('paper-preview').click()
    const preview = page.getByTestId('student-preview')
    await expect(preview).toBeVisible()
    await expect(preview.getByText('Soalan 1').first()).toBeVisible()
    await expect(preview.getByText(/\[\d+ markah\]/).first()).toBeVisible()
    for (const w of await indentWidths(page, 'student-preview')) expect(w).toBe(24)
    await noScroll(page)
    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()

    // StudentViewDrawer needs the saved paper.
    await page.getByTestId('paper-save').click()
    await expect(page.getByTestId('paper-student-view')).toBeEnabled()
    await page.getByTestId('paper-student-view').click()
    const view = page.getByTestId('student-view')
    await expect(view).toBeVisible()
    await expect(view.getByText('Soalan 1').first()).toBeVisible()
    await expect(view.getByText(/\[\d+ markah\]/).first()).toBeVisible()
    await noScroll(page)
  })
})
