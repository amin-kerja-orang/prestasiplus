/**
 * Bijak SPM, Admin Pusat publishes a paper (objective C, UAT-C-01..C-19), against the mock.
 * Mock state lives in the tab's localStorage, so every test builds its own draft and moves between
 * screens inside one page (a second `loginAs` or a fresh context would start from the seeds).
 * Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell, isMobileWidth } from '../support'
import { HTTP_MODE } from './bijak-flow'

test.skip(
  HTTP_MODE,
  'mock-only (loginAs init-script session, __mock boot, local mock server): not run when BIJAK_API_BASE is set',
)
test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

const TITLE = 'Kertas UAT Terbit'

/** Admin Pusat -> Pembina Kertas through the Pentadbiran menu (drawer below 1024 px). */
async function openPaperBuilder(page: Page, gotoApp: (p: string) => Promise<void>): Promise<void> {
  await gotoApp('/admin/command-center')
  if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
  const nav = page.locator('[data-testid=pentadbiran-nav]:visible')
  await nav.getByRole('link', { name: 'Pembina Kertas' }).click()
  await expect(page.getByTestId('papers-page')).toBeVisible()
  await expectNoHorizontalScroll(page)
}

/** Kertas Baharu -> Cipta Kertas for Matematik Kertas 1 (one "Objektif" section, 10 questions). */
async function createDraft(page: Page): Promise<void> {
  await page.getByTestId('paper-new').click()
  await expect(page.getByTestId('paper-new-page')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await page.getByTestId('new-subject').selectOption({ label: 'Matematik' })
  await page.getByTestId('new-kertas').selectOption({ index: 1 })
  await page.getByTestId('new-title').fill(TITLE)
  await expect(page.getByTestId('blueprint-summary')).toBeVisible()
  await page.getByRole('button', { name: 'Cipta Kertas' }).click()
  await expect(page.getByTestId('paper-editor-page')).toBeVisible()
  await expect(page.getByTestId('budget-check')).toContainText('Belum sepadan dengan blueprint')
  await expectNoHorizontalScroll(page)
}

/** Adds the first picker candidate until the section reads "Soalan 10 / 10". */
async function fillObjektif(page: Page): Promise<void> {
  const badges = page.getByTestId('section-0-badges')
  for (let i = 0; i < 10; i++) {
    await page.getByTestId('add-0').click()
    await expect(page.getByTestId('picker')).toBeVisible()
    if (i === 0) await expectNoHorizontalScroll(page)
    await page.locator('[data-testid^=pick-add-]').first().click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('picker')).toBeHidden()
  }
  await expect(badges).toContainText('Soalan 10 / 10')
  await expect(badges).toContainText('Markah 10 / 10')
  await expect(page.getByTestId('budget-check')).toContainText('Sepadan dengan blueprint')
}

test.describe('Bijak SPM Admin Pusat terbit kertas @bijak', () => {
  test('menu, draft, assemble, save, preview, Terbitkan, visible to a student, Tarik balik @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await expect(page.getByTestId('papers-table')).toBeVisible()
    await createDraft(page)
    await fillObjektif(page)

    await page.getByTestId('paper-save').click()
    await expect(page.getByTestId('paper-save')).toBeDisabled()

    await page.getByTestId('paper-preview').click()
    await expect(page.getByTestId('student-preview')).toBeVisible()
    await expect(page.getByTestId('student-preview')).not.toContainText('Skema')
    await expectNoHorizontalScroll(page)
    await page.keyboard.press('Escape')

    await page.getByTestId('paper-publish').click()
    // Published: editing controls give way to the student link and "Tarik balik".
    await expect(page.getByTestId('paper-unpublish')).toBeVisible()
    await expect(page.getByTestId('paper-view-student')).toBeVisible()
    await expect(page.getByTestId('paper-publish')).toHaveCount(0)
    await expect(page.getByTestId('paper-title')).toBeDisabled()
    await expectNoHorizontalScroll(page)

    // The student hub (same tab, SPA navigation) lists it.
    await page.getByTestId('paper-view-student').click()
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.goBack()

    // Tarik balik: back to Draf, gone from the student hub.
    await page.getByTestId('paper-unpublish').click()
    await expect(page.getByTestId('paper-publish')).toBeVisible()
    await page.evaluate(() => {
      window.history.pushState({}, '', '/spm/bijak')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE)).toHaveCount(0)
  })

  test('Terbitkan on an empty draft is refused with the gap list @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page)
    await page.getByTestId('paper-publish').click()
    await expect(page.getByTestId('publish-errors')).toContainText(
      'Kertas belum boleh diterbitkan: selesaikan',
    )
    await expect(page.getByTestId('publish-errors')).toContainText('perkara di atas.')
    await expect(page.getByTestId('budget-issues')).toBeVisible()
    // Still a draft: the publish control stays, no unpublish control.
    await expect(page.getByTestId('paper-publish')).toBeVisible()
    await expect(page.getByTestId('paper-unpublish')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    // The student hub does not list the draft.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/spm/bijak')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE)).toHaveCount(0)
  })

  test('a draft can be deleted from the list @bijak', async ({ page, loginAs, gotoApp }) => {
    test.fixme(
      isMobileWidth(page),
      'APP: below 640 px the papers list renders card rows with no Buka / Padam kertas / status (UAT-C-02, C-15)',
    )
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page)
    await page.getByRole('link', { name: 'Pembina Kertas' }).first().click()
    await expect(page.getByTestId('papers-table')).toContainText(TITLE)
    await page.getByRole('button', { name: 'Padam kertas' }).first().click()
    await expect(page.getByTestId('papers-table')).not.toContainText(TITLE)
    await expectNoHorizontalScroll(page)
  })

  test.fixme('C-11 paper-level answer-key and US-26 gates re-checked at Terbitkan @bijak', () => {
    // Not built: publishPaper only compares the blueprint and requires every question Terbit; the
    // answer-key gate runs when a question is approved to Terbit (UAT-C-11).
  })

  test.fixme('C-16 Salin untuk sunting and Digantikan versioning (AC-27.2) @bijak', () => {
    // Not built: the editor of a published paper offers "Tarik balik" only (UAT-C-16).
  })
})
