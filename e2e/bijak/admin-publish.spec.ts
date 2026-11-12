/**
 * Bijak SPM, Admin Pusat publishes a paper (objective C, UAT-C-01..C-19), against the mock.
 * Mock state lives in the tab's localStorage, so every test builds its own draft and moves between
 * screens inside one page (a second `loginAs` or a fresh context would start from the seeds).
 * Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell, navigateInApp } from '../support'
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

/**
 * Two Kontrak cases (src/modules/m28-bijak-spm/data/registry.ts):
 *  - Disahkan: Matematik Kertas 1 (registry.ts:279, `source: 'Disahkan'`, one "Objektif" section of 10). The mock raises no
 *    blueprint blocker for it (admin/builder/server/memory.ts:61-69, `bp.source === 'Disahkan'` -> no lines), so Terbitkan is a
 *    plain, enabled button.
 *  - Spec: Sains Kertas 2 (registry.ts:312, `source: 'Spec'`, Bahagian A take 3 and Bahagian B choose 1 of 2, take 2). It gets
 *    the overridable "belum Disahkan" blocker (memory.ts:61-69), so Terbitkan is disabled until the audited override. Matematik
 *    Kertas 2 (registry.ts:291) is Spec too but has three sections and 4 more questions; Sains Kertas 2 is the smallest Spec paper.
 */
interface PaperCase {
  subject: string
  kertas: string
  /** Fills every section to its blueprint count. */
  fill: (page: Page) => Promise<void>
  /** The list row summary after filling. */
  summary: RegExp
  empty: string
}

/** Admin Pusat -> the old Pembina Kertas URL (S0-T07: no sidebar entry any more) -> the Set Builder it redirects to (FR-ADM-Q15.6). */
async function openPaperBuilder(page: Page, gotoApp: (p: string) => Promise<void>): Promise<void> {
  await gotoApp('/admin/spm/kertas')
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

/** Mula kosong for a subject and kertas (default Matematik Kertas 1: one "Objektif" section, 10 questions). */
async function createDraft(page: Page, subject = 'Matematik', kertas = 'Kertas 1'): Promise<void> {
  await page.getByTestId('blank-subject').selectOption({ label: subject })
  await page.getByTestId('blank-kertas').selectOption({ label: kertas })
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

/**
 * Sains Kertas 2 (Spec): Bahagian A 3 and Bahagian B 2 questions (registry.ts `take`). The bank destination select picks the
 * Bahagian; a section reads "Soalan n / take" until it is full. Marks are checked by the blueprint line at the end.
 */
async function fillSn2(page: Page): Promise<void> {
  if (page.viewportSize()!.width < 1024) await page.getByTestId('builder-pane-bank').click()
  for (const [si, take] of [3, 2].entries()) {
    await page.getByTestId('bank-dest').selectOption({ index: si })
    const badges = page.getByTestId(`section-${String(si)}-badges`)
    for (let i = 0; i < take; i++) {
      await expect(badges).toContainText(`Soalan ${String(i)} / ${String(take)}`)
      await page.locator('li[data-testid^=pool-]:not([data-testid^=pool-group-])').locator('[data-testid^=pool-add-]:not([disabled])').first().click()
    }
    await expect(badges).toContainText(`Soalan ${String(take)} / ${String(take)}`)
  }
  await expect(page.getByTestId('budget-check')).toContainText('Sepadan dengan blueprint')
  await expectNoHorizontalScroll(page)
}

const MAT_K1: PaperCase = {
  subject: 'Matematik',
  kertas: 'Kertas 1',
  fill: fillObjektif,
  summary: /Matematik · Kertas 1 · 10 soalan · 10 markah/,
  empty: 'Matematik · Kertas 1 · 0 soalan · 0 markah',
}
const SN_K2: PaperCase = {
  subject: 'Sains',
  kertas: 'Kertas 2',
  fill: fillSn2,
  summary: /Sains · Kertas 2 · 5 soalan · \d+ markah/,
  empty: 'Sains · Kertas 2 · 0 soalan · 0 markah',
}

/** Terbitkan on Semak Kertas for a Disahkan Kontrak: enabled, no blocker, no override offered, confirm only. */
async function publishPlain(page: Page): Promise<void> {
  await expect(page.getByTestId('paper-publish')).toBeEnabled()
  await expect(page.getByTestId('publish-errors')).toHaveCount(0)
  await expect(page.getByTestId('publish-override')).toHaveCount(0)
  await page.getByTestId('paper-publish').click()
  await page.locator('[data-ds=confirm-ok]').click()
}

/** Admin shell account menu -> "Masuk Mod Pelajar" (same steps as admin-mod-pelajar.spec.ts:19-26); stays in the tab. */
async function enterModPelajarFromMenu(page: Page): Promise<void> {
  // Below 1024 px the account menu sits inside the sidebar drawer.
  if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
  await page.locator('[data-testid=pentadbiran-account]:visible').click()
  await page.getByRole('menuitem', { name: 'Masuk Mod Pelajar' }).click()
  await expect(page.getByTestId('mod-pelajar-banner')).toBeVisible()
}

/** Builder -> Semak Kertas Simulasi of the same paper. */
async function openSemak(page: Page): Promise<void> {
  await page.getByTestId('builder-semak').click()
  await expect(page.getByTestId('paper-editor-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Semak Kertas Simulasi' })).toBeVisible()
  await expectNoHorizontalScroll(page)
}

test.describe('Bijak SPM Admin Pusat terbit kertas @bijak', () => {
  test('menu, draft, assemble, preview, plain Terbitkan on the Disahkan Matematik Kertas 1, visible to a student, Sembunyikan @bijak', async ({
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

    await publishPlain(page) // confirm = V2 native-paper confirm (R8)
    // Published: the student link and "Sembunyikan" take over.
    await expect(page.getByTestId('paper-unpublish')).toBeVisible()
    await expect(page.getByTestId('paper-view-student')).toBeVisible()
    await expect(page.getByTestId('paper-publish')).toHaveCount(0)
    await expect(page.getByTestId('meta-title')).toBeDisabled()
    await expectNoHorizontalScroll(page)

    // The student hub (same tab, SPA navigation) lists it. "Lihat di Bijak SPM" enters Mod Pelajar first (C-52,
    // e124669fd, admin/builder/lib/use-view-in-bijak.ts), so the admin session is parked until "Keluar Mod Pelajar"
    // and a plain goBack() to the admin page would be a 403 for the student.
    const id = paperIdOf(page)
    await page.getByTestId('paper-view-student').click()
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.getByTestId('mod-pelajar-leave').click() // pattern of admin-mod-pelajar.spec.ts:54
    await expect(page).toHaveURL(/\/admin\/command-center/)
    await navigateInApp(page, `/admin/spm/kertas/${id}`)
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    await expect(page.getByTestId('paper-unpublish')).toBeVisible()

    // Sembunyikan: back to Draf, gone from the student hub.
    await page.getByTestId('paper-unpublish').click()
    // AC-07.7: the V2 confirm comes first.
    await expect(page.locator('[data-ds=confirm-ok]')).toBeVisible()
    await expect(page.locator('[data-ds=confirm-message]').filter({ hasText: 'Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya.' })).toBeVisible()
    await page.locator('[data-ds=confirm-ok]').click()
    await expect(page.getByTestId('paper-publish')).toBeVisible()
    // A draft offers no "Lihat di Bijak SPM" (paper-view-student is only on a published paper), so enter Mod Pelajar
    // explicitly from the account menu, as admin-mod-pelajar.spec.ts does, instead of relying on the route guard
    // (C-52, e124669fd), then check the hub and leave again.
    await enterModPelajarFromMenu(page)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/spm/bijak')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE)).toHaveCount(0)
    await page.getByTestId('mod-pelajar-leave').click()
    await expect(page).toHaveURL(/\/admin\/command-center/)
  })

  test('Semak Kertas: the override on a Spec Kontrak (Sains Kertas 2), visible to a student, Sembunyikan @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page, SN_K2.subject, SN_K2.kertas)
    await SN_K2.fill(page)
    await openSemak(page)

    // Blocked first (the plain button is disabled with the reason), then the audited override publishes.
    await publishWithOverride(page)
    await expect(page.getByTestId('paper-unpublish')).toBeVisible()
    await expect(page.getByTestId('paper-view-student')).toBeVisible()
    await expect(page.getByTestId('paper-publish')).toHaveCount(0)
    await expect(page.getByTestId('meta-title')).toBeDisabled()
    await expectNoHorizontalScroll(page)

    // The student hub (same tab, SPA navigation) lists it. "Lihat di Bijak SPM" enters Mod Pelajar first (C-52,
    // e124669fd, admin/builder/lib/use-view-in-bijak.ts), so the admin session is parked until "Keluar Mod Pelajar"
    // and a plain goBack() to the admin page would be a 403 for the student.
    const id = paperIdOf(page)
    await page.getByTestId('paper-view-student').click()
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.getByTestId('mod-pelajar-leave').click() // pattern of admin-mod-pelajar.spec.ts:54
    await expect(page).toHaveURL(/\/admin\/command-center/)
    await navigateInApp(page, `/admin/spm/kertas/${id}`)
    await expect(page.getByTestId('paper-editor-page')).toBeVisible()
    await expect(page.getByTestId('paper-unpublish')).toBeVisible()

    // Sembunyikan: back to Draf, gone from the student hub.
    await page.getByTestId('paper-unpublish').click()
    // AC-07.7: the V2 confirm comes first.
    await expect(page.locator('[data-ds=confirm-ok]')).toBeVisible()
    await expect(page.locator('[data-ds=confirm-message]').filter({ hasText: 'Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya.' })).toBeVisible()
    await page.locator('[data-ds=confirm-ok]').click()
    await expect(page.getByTestId('paper-publish')).toBeVisible()
    // A draft offers no "Lihat di Bijak SPM" (paper-view-student is only on a published paper), so enter Mod Pelajar
    // explicitly from the account menu, as admin-mod-pelajar.spec.ts does, instead of relying on the route guard
    // (C-52, e124669fd), then check the hub and leave again.
    await enterModPelajarFromMenu(page)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/spm/bijak')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByText(TITLE)).toHaveCount(0)
    await page.getByTestId('mod-pelajar-leave').click()
    await expect(page).toHaveURL(/\/admin\/command-center/)
  })

  test('Set Builder publishes too: plain Terbitkan on the Disahkan Matematik Kertas 1, then Tarik balik ke draf @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page)
    await fillObjektif(page)
    await expect(page.getByTestId('builder-publish')).toBeEnabled()
    await expect(page.getByTestId('builder-publish-blockers')).toHaveCount(0)
    await expect(page.getByTestId('publish-override')).toHaveCount(0)
    await page.getByTestId('builder-publish').click()
    await expect(page.getByTestId('builder-locked')).toBeVisible()
    await expect(page.getByTestId('builder-view-student')).toBeVisible()
    await expect(page.getByTestId('builder-withdraw')).toContainText('Tarik balik ke draf')
    await expectNoHorizontalScroll(page)
    await page.getByTestId('builder-withdraw').click()
    await page.locator('[data-ds=confirm-ok]').click()
    await expect(page.getByTestId('builder-publish-bar')).toBeVisible()
  })

  test('Set Builder publishes too: the override on a Spec Kontrak (Sains Kertas 2), then Tarik balik ke draf @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await openPaperBuilder(page, gotoApp)
    await createDraft(page, SN_K2.subject, SN_K2.kertas)
    await SN_K2.fill(page)
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

  for (const [name, kase, publish] of [
    ['Disahkan Matematik Kertas 1, plain Terbitkan', MAT_K1, publishPlain],
    ['Spec Sains Kertas 2, override', SN_K2, publishWithOverride],
  ] as const) {
    test(`C-02 the one list shows status, Dilihat murid and actions; a published set is not deleted (${name}) @bijak`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs('admin@demo.test')
      await openPaperBuilder(page, gotoApp)
      await createDraft(page, kase.subject, kase.kertas)
      const id = paperIdOf(page)
      await openListFromEditor(page)
      await expectNoHorizontalScroll(page)

      const row = page.getByTestId(`set-${id}`)
      await expect(row).toContainText(TITLE)
      await expect(row).toContainText('Draf')
      await expect(row).toContainText(kase.empty)
      await expect(page.getByTestId(`set-scope-${id}`)).toContainText('Dilihat murid: Tingkatan')
      await expect(page.getByTestId(`set-contract-${id}`)).toBeVisible()
      await expect(page.getByTestId(`set-delete-${id}`)).toBeVisible()

      // Publish it from the builder and Semak Kertas, then look at the list again.
      await page.getByTestId(`set-open-${id}`).click()
      await expect(page.getByTestId('set-builder-editor')).toBeVisible()
      await kase.fill(page)
      await openSemak(page)
      await publish(page)
      await expect(page.getByTestId('paper-unpublish')).toBeVisible()
      await openListFromEditor(page)
      await expectNoHorizontalScroll(page)
      await expect(row).toContainText(kase.summary)
      await page.getByTestId(`set-delete-${id}`).click()
      await expect(page.getByText('Tarik balik set ini ke draf dahulu.').first()).toBeVisible()
      await expect(row).toBeVisible()
    })
  }

  test.fixme('C-11 paper-level answer-key and US-26 gates re-checked at Terbitkan @bijak', () => {
    // Not built: publishPaper only compares the blueprint and requires every question Terbit; the
    // answer-key gate runs when a question is approved to Terbit (UAT-C-11).
  })

  test.fixme('C-16 Salin untuk sunting and Digantikan versioning (AC-27.2) @bijak', () => {
    // Not built: the editor of a published paper offers "Tarik balik" only (UAT-C-16).
  })
})
