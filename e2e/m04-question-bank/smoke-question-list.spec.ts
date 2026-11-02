/**
 * M04-T3 developer smoke (build-plan M04-T3; QA writes E2E-M04-* at G5): S1 question list
 * `/admin/questions` and S3 detail `/admin/questions/:id` as the demo admin at 375 / 768 / 1280 —
 * tiles and totals, a filter, the page 1 order, a bulk action, delete, the detail of 564159 and the
 * AI explanation (success and the failure branches).
 */

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  TAG,
} from '../support'

import {
  answerConfirm,
  applyFilters,
  clickRowDelete,
  listRows,
  openFilters,
  openSubjectTable,
  pager,
} from './list-helpers'

const PAGE_1_ORDER = ['564159', '564160', '564161', '564157', '564158']

test.describe('M04 S1 question list', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/questions')
  })

  test('KPIs, total, page 1 order and no horizontal scroll', async ({ page }) => {
    await expectTabTitle(page, 'Pengurusan Soalan | PRESTASIPLUS')
    await expect(page.getByRole('heading', { name: 'Pengurusan Soalan', level: 1 })).toBeVisible()
    await expect(listRows(page)).toHaveCount(20)

    // v2: a KPI strip replaces the tile grid; the per-subject table is collapsed until opened.
    await expect(page.getByTestId('questions-total')).toHaveText('Jumlah: 268,777 soalan')
    await expect(page.getByTestId('questions-kpis')).toContainText('Jumlah soalan')
    await expect(page.getByTestId('questions-kpis')).toContainText('Subjek Teras (7)')
    await expect(page.getByTestId('questions-kpis')).toContainText('Subjek Elektif (24)')
    await expect(page.getByTestId('questions-tile')).toHaveCount(0)
    await openSubjectTable(page)
    await expect(page.getByTestId('questions-tile')).toHaveCount(31)
    await expect(page.getByTestId('questions-group-teras')).toHaveCount(7)
    await expect(page.getByTestId('questions-group-elektif')).toHaveCount(24)
    await expect(page.getByTestId('questions-group-teras').first()).toHaveText('Teras')

    if (isMobileWidth(page)) {
      // Below md the rows are cards (no ID column).
      await expect(page.getByTestId('questions-add').locator('span:visible')).toHaveText('Tambah')
    } else {
      const ids = await page.getByTestId('question-id').allInnerTexts()
      expect(ids.slice(0, 5).map((s) => s.trim())).toEqual(PAGE_1_ORDER)
      await expect(pager(page)).toContainText('Menunjukkan 1-20 daripada 268777 hasil')
      await expect(page.getByTestId('questions-add').locator('span:visible')).toHaveText(
        'Tambah Soalan',
      )
      // v2 fixed layout (xl) fits the columns to the width; "Soalan" stays the widest text column (> 200px).
      const soalan = await page
        .getByTestId('question-text')
        .first()
        .evaluate((el) => el.closest('td')!.getBoundingClientRect().width)
      expect(soalan).toBeGreaterThanOrEqual(200)
      if (isDesktopShell(page)) {
        // From xl the table fits its container (no inner scroll).
        const fits = await page.getByTestId('questions-table').evaluate((root) => {
          const table = root.querySelector('table')!
          return table.scrollWidth <= table.parentElement!.clientWidth + 1
        })
        if ((page.viewportSize()?.width ?? 0) >= 1280) expect(fits).toBe(true)
      }
      // Touch targets: 44px below the desktop shell (the row icons shrink to 32px with a mouse).
      if (!isDesktopShell(page)) await expectTouchTarget(page.getByTestId('question-view').first())
    }
    await expectNoHorizontalScroll(page)
  })

  test('a subject row filters by subject and shows the clear link', async ({ page }) => {
    await openSubjectTable(page)
    await page
      .getByTestId('questions-tile')
      .filter({ has: page.getByRole('link', { name: 'Matematik', exact: true }) })
      .getByRole('link')
      .click()
    await expect(page).toHaveURL(/\/admin\/questions\?subject_id=\d+$/)
    await expect(page.getByTestId('questions-clear-subject')).toHaveText(
      'Padam filter subjek — tunjuk semua',
    )
    await openSubjectTable(page)
    await expect(page.locator('[data-testid="questions-tile"][aria-current="true"]')).toHaveCount(1)
    await expect(listRows(page).first()).toContainText('Matematik')
    await page.getByTestId('questions-clear-subject').click()
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await expectNoHorizontalScroll(page)
  })

  test('the level filter narrows the result, an unmatched search shows the empty state', async ({
    page,
  }) => {
    await openFilters(page)
    await page.getByTestId('questions-level').selectOption({ label: 'Tingkatan 5' })
    await applyFilters(page)
    await expect(page).toHaveURL(/education_level_id=\d+$/)
    await expect(listRows(page).first()).toContainText('Tingkatan 5')
    if (!isMobileWidth(page)) {
      const shown = await pager(page).getByRole('status').innerText()
      const filtered = Number(/daripada (\d+) hasil/.exec(shown)?.[1])
      expect(filtered).toBeGreaterThan(0)
      expect(filtered).toBeLessThan(268777)
    }

    await openFilters(page)
    await page.getByTestId('questions-search').fill('zzqxv')
    await applyFilters(page)
    await expect(page.getByTestId('questions-empty')).toContainText('Tiada soalan dijumpai')
    await expect(page.getByTestId('questions-empty-add')).toHaveText('Tambah Soalan Pertama')
    await expect(page.getByTestId('questions-table')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('Luluskan Hasil Tapisan / Arkib Semua: menu below sm, disabled without a filter, no scroll', async ({
    page,
  }) => {
    if (isMobileWidth(page)) {
      await expect(page.getByTestId('questions-approve-filter')).toBeHidden()
      await expectTouchTarget(page.getByTestId('questions-more-actions'))
      await page.getByTestId('questions-more-actions').click()
      // No filter: only "Arkib Semua" is listed.
      await expect(page.getByRole('menuitem', { name: 'Arkib Semua' })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Luluskan Hasil Tapisan' })).toHaveCount(0)
      await page.keyboard.press('Escape')
    } else {
      await expect(page.getByTestId('questions-more-actions')).toBeHidden()
      await expect(page.getByTestId('questions-approve-filter')).toBeDisabled()
      await expect(page.getByTestId('questions-approve-filter-hint')).toContainText(
        'Sila pilih sekurang-kurangnya satu penapis',
      )
      await expectTouchTarget(page.getByTestId('questions-archive-all'))
    }
    await expectNoHorizontalScroll(page)

    // With a filter the menu also lists "Luluskan Hasil Tapisan".
    await page.evaluate(async () => {
      type RouterLike = { push(to: string): Promise<unknown> }
      const el = document.querySelector('#app') as Element & {
        __vue_app__: { config: { globalProperties: { $router: RouterLike } } }
      }
      await el.__vue_app__.config.globalProperties.$router.push('/admin/questions?status=pending_review')
    })
    await expect(page).toHaveURL(/status=pending_review$/)
    if (isMobileWidth(page)) {
      await page.getByTestId('questions-more-actions').click()
      await expect(page.getByRole('menuitem', { name: 'Luluskan Hasil Tapisan' })).toBeVisible()
      await page.keyboard.press('Escape')
    } else {
      await expect(page.getByTestId('questions-approve-filter')).toBeEnabled()
    }
    await expectNoHorizontalScroll(page)
  })

  test('Arkib Semua: dry run, confirm with the count, then the result banner', async ({ page }) => {
    if (isMobileWidth(page)) {
      await page.getByTestId('questions-more-actions').click()
      await page.getByRole('menuitem', { name: 'Arkib Semua' }).click()
    } else {
      await page.getByTestId('questions-archive-all').click()
    }
    // The DS confirm dialog: the V2 text, then the dry-run count line.
    const message = (await page.locator('[data-ds="confirm-message"]').textContent()) ?? ''
    expect(message).toContain('ARKIB SEMUA soalan?')
    expect(message).toMatch(/\d+ daripada \d+ soalan sepadan akan diarkibkan\./)
    await page.locator('[data-ds="confirm-ok"]').click()
    await expect(page.getByTestId('bulk-filter-success')).toContainText('Berjaya arkib 500 soalan.')
    await expect(page.getByTestId('bulk-filter-note').filter({ hasText: 'Baki' })).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test('bulk action: needs an action, asks to confirm, then flashes the API status', async ({
    page,
  }) => {
    const boxes = page.locator('[data-testid="questions-table"] [role="checkbox"]')
    // index 0 is the header checkbox on a table; cards have none.
    const offset = isMobileWidth(page) ? 0 : 1
    await boxes.nth(offset).check()
    await boxes.nth(offset + 1).check()
    await expect(page.getByTestId('questions-selected-count')).toHaveText('2')
    await expect(page.getByTestId('questions-bulk-bar')).toContainText('soalan dipilih')

    // No action: the native required bubble blocks the submit (no dialog, nothing sent).
    await page.getByTestId('questions-bulk-submit').click()
    const missing = await page
      .getByTestId('questions-bulk-action')
      .evaluate((el) => (el as HTMLSelectElement).validity.valueMissing)
    expect(missing).toBe(true)
    await expect(page.getByTestId('questions-bulk-bar')).toBeVisible()

    await page.getByTestId('questions-bulk-action').selectOption('archive')
    await page.getByTestId('questions-bulk-submit').click()
    await answerConfirm(page, 'ok', 'Adakah anda pasti mahu mengarkibkan 2 soalan?')
    await expect(page.getByText('2 soalan berjaya dikemaskini.')).toBeVisible()
    await expect(page.getByTestId('questions-bulk-bar')).toHaveCount(0)
    if (!isMobileWidth(page)) {
      await expect(listRows(page).first().getByTestId('question-status')).toHaveText('Arkib')
    }
    await expectNoHorizontalScroll(page)
  })

  test('select all ticks the whole page', async ({ page }) => {
    test.skip(isMobileWidth(page), 'cards below md have no select-all checkbox')
    await page.locator('thead [role="checkbox"]').check()
    await expect(page.getByTestId('questions-selected-count')).toHaveText('20')
    await page.locator('thead [role="checkbox"]').uncheck()
    await expect(page.getByTestId('questions-bulk-bar')).toHaveCount(0)
  })

  test('delete a row after the confirm dialog', async ({ page }) => {
    const second = listRows(page).nth(1)
    const id = isMobileWidth(page)
      ? null
      : (await second.getByTestId('question-id').innerText()).trim()
    await clickRowDelete(second)
    await answerConfirm(page, 'ok', 'Adakah anda pasti mahu memadamkan soalan ini?')
    await expect(page.getByText('Soalan berjaya dipadam.')).toBeVisible()
    if (id) await expect(page.getByTestId('question-id').getByText(id, { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('questions-total')).toHaveText('Jumlah: 268,776 soalan')
  })
})

test.describe('M04 S3 question detail', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp, mock }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/questions/564159')
    await mock.config('m04.aiLatencyMs', 0)
  })

  test('the detail of 564159: cards, options, DSKP chain and the empty AI card', async ({
    page,
  }) => {
    await expectTabTitle(page, 'Detail Soalan | PRESTASIPLUS')
    await expect(page.getByRole('heading', { name: 'Detail Soalan', level: 1 })).toBeVisible()
    await expect(page.getByTestId('question-subtitle')).toHaveText('Soalan #564159')
    await expect(page.getByTestId('question-status')).toHaveText('Diluluskan')
    await expect(page.getByTestId('question-option')).toHaveCount(4)
    await expect(page.locator('[data-testid="question-option"][data-correct="true"]')).toHaveCount(
      1,
    )
    await expect(page.getByTestId('question-correct-label')).toHaveText('Jawapan Betul')
    await expect(page.getByTestId('info-subject')).toHaveText('Sains')
    await expect(page.getByTestId('info-level')).toHaveText('Tingkatan 5')
    await expect(page.getByTestId('info-dskp')).toContainText('T5SN.B9.1')
    await expect(page.getByTestId('info-created')).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
    await expect(page.getByTestId('usage-new')).toContainText('Soalan Baharu')
    await expect(page.getByTestId('ai-empty')).toHaveText(
      'Belum ada Penjelasan AI untuk soalan ini. Klik butang untuk jana.',
    )
    await expect(page.getByTestId('ai-generate')).toHaveText('Jana Penjelasan AI')
    await expectTouchTarget(page.getByTestId('ai-generate'))
    await expectTouchTarget(page.getByTestId('question-delete'))
    await expectNoHorizontalScroll(page)
  })

  test('AI explanation: success shows the text and a regenerate button', async ({ page }) => {
    await page.getByTestId('ai-generate').click()
    await expect(page.getByTestId('ai-content')).toContainText('Penjelasan')
    await expect(page.getByTestId('ai-content').locator('table')).toBeVisible()
    await expect(page.getByTestId('ai-regenerate')).toHaveText('Jana Semula')
    await expectNoHorizontalScroll(page)
  })

  test('AI explanation: a failure shows the message beside the empty state', async ({
    page,
    mock,
  }) => {
    await mock.config('m04.aiFailNext', 'message')
    await page.getByTestId('ai-generate').click()
    await expect(page.getByTestId('ai-error')).toHaveText(
      'Perkhidmatan AI tidak tersedia buat masa ini.',
    )
    await expect(page.getByTestId('ai-empty')).toBeVisible()

    // "no message" -> "HTTP 500"; a retry then succeeds and the error is gone.
    await mock.config('m04.aiFailNext', 'no-message')
    await page.getByTestId('ai-generate').click()
    await expect(page.getByTestId('ai-error')).toHaveText('HTTP 500')
    await page.getByTestId('ai-generate').click()
    await expect(page.getByTestId('ai-content')).toBeVisible()
    await expect(page.getByTestId('ai-error')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('AI explanation: a non-JSON reply shows the parse error text', async ({ page, mock }) => {
    await mock.config('m04.aiFailNext', 'non-json')
    await page.getByTestId('ai-generate').click()
    await expect(page.getByTestId('ai-error')).toContainText('is not valid JSON')
  })

  test('delete asks to confirm (DS dialog), then goes back to the list with the flash', async ({ page }) => {
    await page.getByTestId('question-delete').click()
    await answerConfirm(page, 'ok', 'Adakah anda pasti mahu memadamkan soalan ini?')
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await expect(page.getByText('Soalan berjaya dipadam.')).toBeVisible()
    await expect(page.getByTestId('question-id').getByText('564159', { exact: true })).toHaveCount(0)
  })
})

test.describe('M04 S3 unknown id', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('an unknown id shows the standard 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/questions/99999999')
    // The tab title of a page-set 404 is not asserted: the shared router sets it only for a guard outcome (same for M02).
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman Tidak Dijumpai', exact: true }),
    ).toBeVisible()
    await expect(page.getByTestId('question-error')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})
