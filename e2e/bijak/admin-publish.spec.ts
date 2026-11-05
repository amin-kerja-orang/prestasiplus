/**
 * Bijak SPM, Admin Pusat publishes a paper (objective C, UAT-C-01..C-19), against the mock.
 * Mock state lives in the tab's localStorage, so every test builds its own draft and moves between
 * screens inside one page (a second `loginAs` or a fresh context would start from the seeds).
 * Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell } from '../support'
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

/** Admin Pusat -> the old Pembina Kertas menu entry -> the Set Builder it redirects to (FR-ADM-Q15.6; drawer below 1024 px). */
async function openPaperBuilder(page: Page, gotoApp: (p: string) => Promise<void>): Promise<void> {
  await gotoApp('/admin/command-center')
  if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
  const nav = page.locator('[data-testid=pentadbiran-nav]:visible')
  await nav.getByRole('link', { name: 'Pembina Kertas' }).click()
  await expect(page).toHaveURL(/\/admin\/studio\/sets$/)
  await expect(page.getByTestId('set-builder-page')).toBeVisible()
  await expectNoHorizontalScroll(page)
}

/**
 * Terbitkan on Semak Kertas for a complete draft whose Kontrak is not Disahkan (the mock follows R1-T34): the plain button is disabled
 * with the reason and the audited override ("Terbitkan walaupun tidak memenuhi kontrak") publishes it.
 */
async function publishWithOverride(page: Page): Promise<void> {
  await expect(page.getByTestId('paper-publish')).toBeDisabled()
  await expect(page.getByTestId('paper-publish')).toHaveAttribute('title', /^Betulkan \d+ masalah dahulu$/)
  await expect(page.getByTestId('publish-errors')).toBeVisible()
  // REQ-B-054: the server's reason is shown, not only a count, and the override sits right under it.
  await expect(page.getByTestId('publish-errors')).toContainText('belum Disahkan')
  await expect(page.getByTestId('publish-override')).toBeVisible()
  await page.getByTestId('override-tick').click()
  await page.getByTestId('override-reason').fill('Kontrak masih Spec, kertas ujian dalaman')
  await page.getByTestId('override-publish').click()
  await page.locator('[data-ds=confirm-ok]').click()
}

/** The draft id from the builder URL `/admin/studio/sets/:id/builder` or the Semak Kertas URL `/admin/spm/kertas/:id`. */
function paperIdOf(page: Page): string {
  const parts = new URL(page.url()).pathname.split('/')
  return parts[parts.length - 1] === 'builder' ? (parts[parts.length - 2] ?? '') : (parts[parts.length - 1] ?? '')
}

/** Builder or Semak Kertas -> the list (the back link, an in-app navigation that keeps the mock state). */
async function openListFromEditor(page: Page): Promise<void> {
  await page.locator('[data-ds=back-link]').first().click()
  await expect(page.getByTestId('set-builder-page')).toBeVisible()
}

/** Mula kosong for Matematik Kertas 1 (one "Objektif" section, 10 questions). */
async function createDraft(page: Page): Promise<void> {
  await page.getByTestId('blank-subject').selectOption({ label: 'Matematik' })
  await page.getByTestId('blank-kertas').selectOption({ label: 'Kertas 1' })
  await page.getByTestId('blank-title').fill(TITLE)
  await page.getByTestId('blank-submit').click()
  await expect(page.getByTestId('set-builder-editor')).toBeVisible()
  await expect(page.getByTestId('budget-check')).toContainText('Belum sepadan dengan blueprint')
  await expectNoHorizontalScroll(page)
}

/** Adds single questions from the bank until the section reads "Soalan 10 / 10". */
async function fillObjektif(page: Page): Promise<void> {
  const badges = page.getByTestId('section-0-badges')
  if (page.viewportSize()!.width < 1024) await page.getByTestId('builder-pane-bank').click()
  for (let i = 0; i < 10; i++) {
    await expect(badges).toContainText(`Soalan ${String(i)} / 10`)
    await page.locator('li[data-testid^=pool-]:not([data-testid^=pool-group-])').locator('[data-testid^=pool-add-]:not([disabled])').first().click()
  }
  await expect(badges).toContainText('Soalan 10 / 10')
  await expect(badges).toContainText('Markah 10 / 10')
  await expect(page.getByTestId('budget-check')).toContainText('Sepadan dengan blueprint')
  await expectNoHorizontalScroll(page)
}

/** Builder -> Semak Kertas Simulasi of the same paper. */
async function openSemak(page: Page): Promise<void> {
  await page.getByTestId('builder-semak').click()
  await expect(page.getByTestId('paper-editor-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Semak Kertas Simulasi' })).toBeVisible()
  await expectNoHorizontalScroll(page)
}

test.describe('Bijak SPM Admin Pusat terbit kertas @bijak', () => {
  test('menu, draft, assemble, preview, Terbitkan, visible to a student, Sembunyikan @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page)
    await fillObjektif(page)
    await openSemak(page)

    await page.getByTestId('paper-preview').click()
    await expect(page.getByTestId('student-preview')).toBeVisible()
    await expect(page.getByTestId('student-preview')).not.toContainText('Skema')
    await expectNoHorizontalScroll(page)
    await page.keyboard.press('Escape')

    await publishWithOverride(page) // confirm = V2 native-paper confirm (R8)
    // Published: the student link and "Sembunyikan" take over.
    await expect(page.getByTestId('paper-unpublish')).toBeVisible()
    await expect(page.getByTestId('paper-view-student')).toBeVisible()
    await expect(page.getByTestId('paper-publish')).toHaveCount(0)
    await expect(page.getByTestId('meta-title')).toBeDisabled()
    await expectNoHorizontalScroll(page)

    // The student hub (same tab, SPA navigation) lists it.
    await page.getByTestId('paper-view-student').click()
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.goBack()

    // Sembunyikan: back to Draf, gone from the student hub.
    await page.getByTestId('paper-unpublish').click()
    // AC-07.7: the V2 confirm comes first.
    await expect(page.locator('[data-ds=confirm-ok]')).toBeVisible()
    await expect(page.locator('[data-ds=confirm-message]').filter({ hasText: 'Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya.' })).toBeVisible()
    await page.locator('[data-ds=confirm-ok]').click()
    await expect(page.getByTestId('paper-publish')).toBeVisible()
    await page.evaluate(() => {
      window.history.pushState({}, '', '/spm/bijak')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE)).toHaveCount(0)
  })

  test('Set Builder publishes too: the override on a Spec Kontrak, then Tarik balik ke draf @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page)
    await fillObjektif(page)
    await expect(page.getByTestId('builder-publish')).toBeDisabled()
    await page.getByTestId('override-tick').click()
    await page.getByTestId('override-reason').fill('Kontrak masih Spec, kertas ujian dalaman')
    await page.getByTestId('override-publish').click()
    await expect(page.getByTestId('builder-locked')).toBeVisible()
    await expect(page.getByTestId('builder-view-student')).toBeVisible()
    await expect(page.getByTestId('builder-withdraw')).toContainText('Tarik balik ke draf')
    await expectNoHorizontalScroll(page)
    await page.getByTestId('builder-withdraw').click()
    await page.locator('[data-ds=confirm-ok]').click()
    await expect(page.getByTestId('builder-publish-bar')).toBeVisible()
  })

  test('Terbitkan on an empty draft is refused with the gap list @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page)
    await openSemak(page)
    // R1-F09: Terbitkan is disabled while the check fails, and the reason is shown as text.
    await expect(page.getByTestId('paper-publish')).toBeDisabled()
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

  test('a draft can be deleted from the list, after the confirm @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page)
    const id = paperIdOf(page)
    await openListFromEditor(page)
    await expect(page.getByTestId('sets-list')).toContainText(TITLE)
    await expectNoHorizontalScroll(page)
    await page.getByTestId(`set-delete-${id}`).click()
    await expect(page.locator('[data-ds=confirm-message]').filter({ hasText: 'Set draf akan dipadam. Tindakan ini tidak boleh dibatalkan.' })).toBeVisible()
    await page.locator('[data-ds=confirm-ok]').click()
    await expect(page.getByTestId(`set-${id}`)).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('C-02 the one list shows status, Dilihat murid and actions; a published set is not deleted @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page)
    const id = paperIdOf(page)
    await openListFromEditor(page)
    await expectNoHorizontalScroll(page)

    const row = page.getByTestId(`set-${id}`)
    await expect(row).toContainText(TITLE)
    await expect(row).toContainText('Draf')
    await expect(row).toContainText('Matematik · Kertas 1 · 0 soalan · 0 markah')
    await expect(page.getByTestId(`set-scope-${id}`)).toContainText('Dilihat murid: Tingkatan')
    await expect(page.getByTestId(`set-contract-${id}`)).toBeVisible()
    await expect(page.getByTestId(`set-delete-${id}`)).toBeVisible()

    // Publish it from the builder and Semak Kertas, then look at the list again.
    await page.getByTestId(`set-open-${id}`).click()
    await expect(page.getByTestId('set-builder-editor')).toBeVisible()
    await fillObjektif(page)
    await openSemak(page)
    await publishWithOverride(page)
    await expect(page.getByTestId('paper-unpublish')).toBeVisible()
    await openListFromEditor(page)
    await expectNoHorizontalScroll(page)
    await expect(row).toContainText('Matematik · Kertas 1 · 10 soalan · 10 markah')
    await page.getByTestId(`set-delete-${id}`).click()
    await expect(page.getByText('Tarik balik set ini ke draf dahulu.').first()).toBeVisible()
    await expect(row).toBeVisible()
  })

  test.fixme('C-11 paper-level answer-key and US-26 gates re-checked at Terbitkan @bijak', () => {
    // Not built: publishPaper only compares the blueprint and requires every question Terbit; the
    // answer-key gate runs when a question is approved to Terbit (UAT-C-11).
  })

  test.fixme('C-16 Salin untuk sunting and Digantikan versioning (AC-27.2) @bijak', () => {
    // Not built: the editor of a published paper offers "Tarik balik" only (UAT-C-16).
  })
})
