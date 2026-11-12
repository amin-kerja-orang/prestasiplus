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
    // KS-09 is retired (PRD 30-admin-pusat.md section 3.3): /admin/spm/kertas redirects to the Set Builder
    // (routes/admin-papers.ts:52-53). Same entry and Mula kosong selectors as admin-publish.spec.ts:24-100.
    await gotoApp('/admin/spm/kertas')
    await expect(page).toHaveURL(/\/admin\/studio\/sets$/)
    await expect(page.getByTestId('set-builder-page')).toBeVisible()
    await page.getByTestId('blank-subject').selectOption({ label: 'Matematik' })
    await page.getByTestId('blank-kertas').selectOption({ label: 'Kertas 1' })
    await page.getByTestId('blank-title').fill('Kertas Paparan')
    await page.getByTestId('blank-submit').click()
    await expect(page.getByTestId('set-builder-editor')).toBeVisible()

    // One single question from the bank is enough for the preview (below lg the bank is its own pane).
    if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByTestId('builder-pane-bank').click()
    await page
      .locator('li[data-testid^=pool-]:not([data-testid^=pool-group-])')
      .locator('[data-testid^=pool-add-]:not([disabled])')
      .first()
      .click()
    await expect(page.getByTestId('section-0-badges')).toContainText('Soalan 1 /')

    // StudentViewDrawer from the builder (builder-student-view, SetBuilderPage.vue:428).
    await page.getByTestId('builder-student-view').click()
    const builderView = page.getByTestId('student-view')
    await expect(builderView).toBeVisible()
    await expect(builderView.getByText('Soalan 1').first()).toBeVisible()
    await expect(builderView.getByText(/\[\d+ markah\]/).first()).toBeVisible()
    await noScroll(page)
    await page.keyboard.press('Escape')
    await expect(builderView).toBeHidden()

    // Semak Kertas Simulasi: the admin QuestionPreview ("Pratonton sebagai pelajar"), any part indent step is 24 px.
    await page.getByTestId('builder-semak').click()
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    await page.getByTestId('paper-preview').click()
    const preview = page.getByTestId('student-preview')
    await expect(preview).toBeVisible()
    await expect(preview.getByText('Soalan 1').first()).toBeVisible()
    await expect(preview.getByText(/\[\d+ markah\]/).first()).toBeVisible()
    for (const w of await indentWidths(page, 'student-preview')) expect(w).toBe(24)
    await noScroll(page)
    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()

    // The saved-paper student view on Semak Kertas (paper-student-view, PaperEditorPage.vue:344). The old
    // "Simpan" click (paper-save) no longer exists: the Set Builder saves as it goes.
    await expect(page.getByTestId('paper-student-view')).toBeEnabled()
    await page.getByTestId('paper-student-view').click()
    const view = page.getByTestId('student-view')
    await expect(view).toBeVisible()
    await expect(view.getByText('Soalan 1').first()).toBeVisible()
    await expect(view.getByText(/\[\d+ markah\]/).first()).toBeVisible()
    await noScroll(page)
  })
})
