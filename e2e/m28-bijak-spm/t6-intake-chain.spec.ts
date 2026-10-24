/**
 * M28 Bijak SPM, UAT task T6: the manual question intake chain end to end, at 375 / 768 / 1280.
 *
 * Chain: Tulis Soalan Manual -> editor (Simpan draf, Hantar untuk semakan) -> Baris Gilir Semakan
 * (Lulus & Terbit) -> Bank Soalan SPM (Diterbitkan) -> paper builder (add from the bank, Terbitkan)
 * -> student Bijak SPM (cover count, the question inside the attempt).
 *
 * Also the two UAT regressions fixed with this chain:
 * - A-KS16: the manual editor lives at /admin/spm/soalan/manual/:batchId and the menu keeps
 *   "Tulis Soalan Manual" active (it used to land on the Senarai Ekstrak URL); "Simpan draf" flashes.
 * - A-KS15: a review-queue filter that matches nothing says "Tiada soalan dijumpai".
 *
 * These tests carry no SRS E2E ids (M28 has no SRS section 12); the module tag is written by hand
 * because `moduleTag()` stops at M26. The student step uses the real attempt screen (no API probe).
 */

import type { Page } from '@playwright/test'

import { waitForApp } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { actAs, expectNoHorizontalScroll, isDesktopShell, viewportWidth } from '../support'

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const SEED_PAPER = 'kp-seed-1'
const STEM = 'Soalan rantaian UAT T6: nyatakan hasil tambah empat dan lima.'

const MODULE = { tag: ['@m28'] }
const tid = (page: Page, id: string) => page.getByTestId(id)

test.describe.configure({ timeout: 240_000 })
test.use({ mockInit: { latency: 0 } })

/**
 * Every page load of these specs: the full-profile mock boot is slow on a loaded machine and replays
 * saved changes after a write, so it gets a 60 s budget instead of the 15 s of `gotoApp`.
 */
async function reopen(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForApp(page, 60_000)
}

/** Opens Tulis Soalan Manual, fills the declaration and starts the editor. */
async function startManual(page: Page, navigate = true): Promise<void> {
  if (navigate) await reopen(page, '/admin/spm/soalan/manual')
  await expect(tid(page, 'intake-manual-page')).toBeVisible()
  await page.locator('#in-subject').selectOption({ label: 'Matematik' })
  await page.locator('#in-kertas').selectOption({ label: 'Kertas 2' })
  await page.locator('#in-source').fill('Percubaan SPM Negeri')
  // The first real option (the select starts on the blank "Pilih").
  await page.locator('#in-copy').selectOption({ index: 1 })
  await expectNoHorizontalScroll(page)
  await tid(page, 'manual-start').click()
  await expect(tid(page, 'question-editor')).toBeVisible()
}

/** Fills the short-answer question: 2 marks, a 2 + 0 point scheme of two points, unit and SP. */
async function fillQuestion(page: Page): Promise<void> {
  await tid(page, 'q-type').selectOption('short')
  await tid(page, 'q-marks').fill('2')
  await tid(page, 'q-stem').fill(STEM)
  await tid(page, 'scheme-add-point').click()
  await tid(page, 'scheme-add-point').click()
  await expect(tid(page, 'scheme-point')).toHaveCount(2)
  for (const n of [1, 2]) {
    await page.getByLabel(`Penerangan mata ${String(n)}`).fill(`Mata ${String(n)}`)
  }
  await expect(tid(page, 'scheme-total')).toContainText('2')
  await tid(page, 'q-unit').selectOption({ index: 1 })
  await tid(page, 'q-sp').fill('3.1')
  // The SP input commits on change (blur).
  await tid(page, 'q-sp').blur()
}

/** DsDataTable renders a table from 768 px and a card list below it. */
const TABLE_MIN_WIDTH = 768
const tableLayout = (page: Page): boolean => viewportWidth(page) >= TABLE_MIN_WIDTH

/** A row of a DsDataTable (table row or card) that holds `text`. */
function listRow(page: Page, table: string, text: string) {
  return tid(page, table)
    .locator(tableLayout(page) ? 'tr' : 'li')
    .filter({ hasText: text })
}

/** DsFilterBar shows its fields inline from 768 px; below that they sit in a "Penapis" bottom sheet. */
const FILTER_INLINE_MIN_WIDTH = 768

/** Runs `choose` on the filter fields (opening the sheet when needed) and applies the filter. */
async function applyFilter(page: Page, choose: () => Promise<void>): Promise<void> {
  const inline = viewportWidth(page) >= FILTER_INLINE_MIN_WIDTH
  if (!inline) await page.locator('[data-ds="filter-open"]').click()
  await choose()
  if (inline) await page.locator('[data-ds="filter-bar"] button[type="submit"]').click()
  else await page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna' }).click()
}

/** The active entry of the admin menu (opens the drawer below the desktop shell). */
async function activeMenuLabel(page: Page): Promise<string> {
  if (!isDesktopShell(page)) await tid(page, 'pentadbiran-menu-button').click()
  const active = page.locator('[data-testid="pentadbiran-nav"] a[aria-current="page"]:visible')
  await expect(active).toHaveCount(1)
  const label = (await active.innerText()).trim()
  if (!isDesktopShell(page)) await page.keyboard.press('Escape')
  return label
}

test.describe('M28 T6 manual intake', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  test('A-KS16 the manual editor keeps its own URL, and Simpan draf flashes', async ({ page }) => {
    await startManual(page)

    // Own route (was /admin/spm/soalan/ekstrak/:id) and the same editor page.
    await expect(page).toHaveURL(/\/admin\/spm\/soalan\/manual\/[^/]+$/)
    expect(page.url()).not.toContain('/ekstrak/')
    await expect(page).toHaveTitle('Tulis Soalan Manual - Admin PRESTASIPLUS')
    await expect(tid(page, 'intake-review-page')).toBeVisible()
    await expect(tid(page, 'manual-badge')).toHaveText('Manual')

    // A reload of the deep link opens the same editor.
    await reopen(page, new URL(page.url()).pathname)
    await expect(tid(page, 'question-editor')).toBeVisible()
    await expect(tid(page, 'manual-badge')).toHaveText('Manual')

    // Simpan draf flashes "Draf disimpan." (autosave stays silent).
    await tid(page, 'q-stem').fill(STEM)
    await tid(page, 'save-draft').click()
    await expect(page.getByText('Draf disimpan.')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('A-KS16 the menu keeps "Tulis Soalan Manual" active on the manual editor (Portal Pentadbiran)', async ({
    page,
  }) => {
    test.skip(
      process.env.E2E_PROTOTYPE_SCOPE !== 'on',
      'the Pentadbiran menu exists only in the scope-on build: playwright.bijak.config.mjs',
    )
    await startManual(page)
    await expect(page).toHaveURL(/\/admin\/spm\/soalan\/manual\/[^/]+$/)
    expect(await activeMenuLabel(page)).toBe('Tulis Soalan Manual')

    // An extracted batch keeps the Senarai Ekstrak URL and menu item.
    await reopen(page, '/admin/spm/soalan/ekstrak/ek-demo-1')
    await expect(tid(page, 'intake-review-page')).toBeVisible()
    expect(await activeMenuLabel(page)).toBe('Senarai Ekstrak')
  })

  test('A-KS15 a filter that matches nothing says "Tiada soalan dijumpai", reset restores the queue', async ({
    page,
  }) => {
    await reopen(page, '/admin/spm/semakan')
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await expect(tid(page, 'queue-table')).toBeVisible()

    // Sejarah has nothing waiting in the queue.
    await applyFilter(page, () =>
      tid(page, 'queue-subject')
        .selectOption({ label: 'Sejarah' })
        .then(() => undefined),
    )
    await expect(tid(page, 'queue-table')).toContainText('Tiada soalan dijumpai')
    await expect(tid(page, 'queue-table')).toContainText('Cuba ubah atau set semula penapis.')
    await expect(tid(page, 'queue-table')).not.toContainText('Baris gilir kosong')
    await expect(tid(page, 'queue-table')).not.toContainText('Tiada soalan menunggu semakan.')
    await expectNoHorizontalScroll(page)

    // Reset: the filtered empty state is gone.
    await page
      .locator('[data-ds="filter-bar"]')
      .getByRole('button', { name: 'Set Semula' })
      .first()
      .click()
    await expect(tid(page, 'queue-table')).not.toContainText('Tiada soalan dijumpai')
  })
})

test.describe('M28 T6 manual question chain', MODULE, () => {
  test('manual -> review -> Lulus & Terbit -> bank -> paper -> publish -> student attempt', async ({
    page,
    mock,
  }) => {
    // Two roles in one page: no `loginAs` (its init-script session would win over `actAs`).
    await reopen(page, '/login')
    await actAs(page, mock, (p) => reopen(page, p), ADMIN, '/admin/spm/soalan/manual')

    // 1. Manual declaration, then the editor on the manual route.
    await startManual(page, false)
    await expect(page).toHaveURL(/\/admin\/spm\/soalan\/manual\/[^/]+$/)

    // 2. The question, the draft flash, the review submission.
    await fillQuestion(page)
    await expectNoHorizontalScroll(page)
    await tid(page, 'save-draft').click()
    await expect(page.getByText('Draf disimpan.')).toBeVisible()
    await expect(tid(page, 'submit-review')).toBeEnabled()
    await tid(page, 'submit-review').click()
    await expect(tid(page, 'submitted-note')).toBeVisible()

    // 3. The review queue: open the item and publish it.
    await tid(page, 'goto-queue').click()
    await expect(tid(page, 'queue-table')).toBeVisible()
    const queueRow = listRow(page, 'queue-table', 'Soalan rantaian UAT T6')
    await expect(queueRow).toHaveCount(1)
    // Table (>= 768): the "Semak" link. Cards (< 768): the card title opens the item.
    if (tableLayout(page)) await queueRow.getByRole('link', { name: 'Semak' }).click()
    else await queueRow.getByRole('button', { name: /Soalan rantaian UAT T6/ }).click()
    await expect(tid(page, 'review-item-page')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await tid(page, 'action-publish').click()
    await expect(page).toHaveURL(/\/admin\/spm\/semakan$/)
    // It left the queue.
    await expect(tid(page, 'queue-table')).toBeVisible()
    await expect(listRow(page, 'queue-table', 'Soalan rantaian UAT T6')).toHaveCount(0)

    // 4. The bank lists it as Diterbitkan.
    await reopen(page, '/admin/spm/soalan')
    await expect(tid(page, 'bank-table')).toBeVisible()
    await tid(page, 'bank-search').fill('Soalan rantaian UAT T6')
    await tid(page, 'bank-search').press('Enter')
    const bankRow = listRow(page, 'bank-table', 'Soalan rantaian UAT T6')
    await expect(bankRow).toHaveCount(1)
    // The status badge is in the table row only; the preview drawer shows it at every width.
    await bankRow.getByText('Soalan rantaian UAT T6').first().click()
    await expect(tid(page, 'bank-drawer')).toContainText('Diterbitkan')
    await expectNoHorizontalScroll(page)
    await page.keyboard.press('Escape')

    // 5. The seed paper: add the question from the bank, check the budget, publish.
    await reopen(page, '/admin/spm/kertas')
    await expect(tid(page, 'papers-table')).toBeVisible()
    // Table (>= 768): the "Buka" link. Cards (< 768): the card title opens the paper.
    if (tableLayout(page)) await tid(page, `paper-open-${SEED_PAPER}`).click()
    else await listRow(page, 'papers-table', 'Set B (draf)').getByRole('button').first().click()
    await expect(tid(page, 'paper-editor-page')).toBeVisible()
    await tid(page, 'add-0').click()
    await expect(tid(page, 'picker')).toBeVisible()
    await tid(page, 'picker-search').fill('Soalan rantaian UAT T6')
    await page.locator('[data-testid^="pick-add-"]').first().click()
    await page.keyboard.press('Escape')
    await expect(tid(page, 'picker')).toHaveCount(0)
    await expect(tid(page, 'budget-check')).toContainText('Sepadan dengan blueprint')
    await expectNoHorizontalScroll(page)
    await tid(page, 'paper-publish').click()
    await expect(tid(page, 'publish-errors')).toHaveCount(0)
    await expect(tid(page, 'paper-view-student')).toHaveText('Lihat di Bijak SPM')

    // 6. The student hub lists the paper (6 questions now) and the attempt reaches the new one.
    await actAs(page, mock, (p) => reopen(page, p), PELAJAR, '/spm/bijak')
    await expect(tid(page, 'bijak-hub')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await tid(page, `open-${SEED_PAPER}`).click()
    await expect(tid(page, 'bijak-cover')).toBeVisible()
    await expect(tid(page, 'cover-hero')).toContainText('6 soalan')
    await page.locator('[data-ds=hero-cta]').click()
    await expect(tid(page, 'attempt-shell')).toBeVisible()

    // Walk the six questions; wait for each heading before reading it, so none is skipped.
    let seen = false
    for (let n = 1; n <= 6 && !seen; n++) {
      await expect(tid(page, 'question-heading')).toHaveText(
        new RegExp(`^\\s*Soalan ${String(n)}\\b`),
      )
      seen = (await tid(page, 'attempt-shell').innerText()).includes('Soalan rantaian UAT T6')
      if (!seen && n < 6) await tid(page, 'next').click()
    }
    expect(seen, 'the published manual question is reachable inside the attempt').toBe(true)
    await expectNoHorizontalScroll(page)
  })
})
