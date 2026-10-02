/**
 * M04-T3 developer smoke (build-plan M04-T3; QA writes E2E-M04-* at G5): S1 question list
 * `/admin/questions` and S3 detail `/admin/questions/:id` as the demo admin at 375 / 768 / 1280 —
 * tiles and totals, a filter, the page 1 order, a bulk action, delete, the detail of 564159 and the
 * AI explanation (success and the failure branches).
 */

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  TAG,
} from '../support'

const PAGE_1_ORDER = ['564159', '564160', '564161', '564157', '564158']

test.describe('M04 S1 question list', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/questions')
  })

  test('tiles, total, page 1 order and no horizontal scroll', async ({ page }) => {
    await expectTabTitle(page, 'Pengurusan Soalan')
    await expect(page.getByRole('heading', { name: '📚 Pengurusan Soalan' })).toBeVisible()
    await expect(page.getByTestId('question-row')).toHaveCount(20)

    await expect(page.getByTestId('questions-total')).toHaveText('Jumlah: 465,278 soalan')
    await expect(page.getByTestId('questions-tile')).toHaveCount(31)
    await expect(page.getByTestId('questions-group-teras')).toHaveText('Subjek Teras')
    await expect(page.getByTestId('questions-group-elektif')).toHaveText('Subjek Elektif')
    const first = page.getByTestId('questions-tile').first()
    await expect(first).toContainText('Bahasa Melay...')

    const ids = await page.getByTestId('question-id').allInnerTexts()
    expect(ids.slice(0, 5).map((s) => s.trim())).toEqual(PAGE_1_ORDER)

    if (isMobileWidth(page)) {
      await expect(page.getByTestId('questions-pager').getByText('Next »')).toBeVisible()
      await expect(page.getByTestId('questions-add').locator('span:visible')).toHaveText('Tambah')
    } else {
      await expect(page.getByTestId('questions-pager')).toContainText(
        'Showing 1 to 20 of 465278 results',
      )
      await expect(page.getByTestId('questions-add').locator('span:visible')).toHaveText(
        'Tambah Soalan',
      )
    }

    // DV-M04-09: the table scrolls inside its card below the desktop width, "Soalan" keeps 240px.
    const scroll = await page.getByTestId('questions-table').evaluate((table) => {
      const scroller = table.closest('.overflow-x-auto') as HTMLElement
      const cell = table.querySelector('[data-testid="question-text"]')!.closest('td')!
      return {
        scrollWidth: scroller.scrollWidth,
        clientWidth: scroller.clientWidth,
        soalan: cell.getBoundingClientRect().width,
      }
    })
    if (isDesktopShell(page)) expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth)
    else expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth)
    expect(scroll.soalan).toBeGreaterThanOrEqual(240)

    // Touch targets: 44px below the desktop shell (the row icons shrink to 32px with a mouse).
    if (!isDesktopShell(page)) await expectTouchTarget(page.getByTestId('question-view').first())
    await expectNoHorizontalScroll(page)
  })

  test('a tile filters by subject and shows the clear link', async ({ page }) => {
    await page.getByTestId('questions-tile').nth(2).click()
    await expect(page).toHaveURL(/\/admin\/questions\?subject_id=3$/)
    await expect(page.getByTestId('questions-clear-subject')).toHaveText(
      'Padam filter subjek — tunjuk semua',
    )
    await expect(page.getByTestId('questions-tile').nth(2)).toHaveClass(/bg-indigo-50/)
    await expect(page.getByTestId('question-row').first()).toContainText('Matematik')
    await page.getByTestId('questions-clear-subject').click()
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await expectNoHorizontalScroll(page)
  })

  test('the level filter narrows the result, an unmatched search shows the empty state', async ({
    page,
  }) => {
    await page.getByTestId('questions-level').selectOption({ label: 'Darjah 1' })
    await page.getByTestId('questions-search-submit').click()
    await expect(page).toHaveURL(/education_level_id=1$/)
    await expect(page.getByTestId('question-row').first()).toContainText('Darjah 1')
    if (!isMobileWidth(page)) {
      await expect(page.getByTestId('questions-pager')).toContainText('of 14778 results')
    }

    await page.getByTestId('questions-search').fill('zzqxv')
    await page.getByTestId('questions-search-submit').click()
    await expect(page.getByTestId('questions-empty')).toContainText('Tiada soalan dijumpai')
    await expect(page.getByTestId('questions-empty-add')).toHaveText('Tambah Soalan Pertama')
    await expect(page.getByTestId('questions-table')).toHaveCount(0)
    await expect(page.getByTestId('questions-pager')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('bulk action: needs an action, asks to confirm, then flashes the API status', async ({
    page,
  }) => {
    const boxes = page.getByTestId('question-select')
    await boxes.nth(0).check()
    await boxes.nth(1).check()
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
    const dialog = acceptNextDialog(page, {
      type: 'confirm',
      message: 'Adakah anda pasti mahu mengarkibkan 2 soalan?',
    })
    await page.getByTestId('questions-bulk-submit').click()
    await dialog
    await expect(page.getByText('2 soalan berjaya dikemaskini.')).toBeVisible()
    await expect(page.getByTestId('questions-bulk-bar')).toHaveCount(0)
    await expect(
      page.getByTestId('question-row').first().getByTestId('question-status'),
    ).toHaveText('Arkib')
    await expectNoHorizontalScroll(page)
  })

  test('select all ticks the whole page', async ({ page }) => {
    await page.getByTestId('questions-select-all').check()
    await expect(page.getByTestId('questions-selected-count')).toHaveText('20')
    await page.getByTestId('questions-select-all').uncheck()
    await expect(page.getByTestId('questions-bulk-bar')).toHaveCount(0)
  })

  test('delete a row after the native confirm', async ({ page }) => {
    const second = page.getByTestId('question-row').nth(1)
    const id = (await second.getByTestId('question-id').innerText()).trim()
    const dialog = acceptNextDialog(page, {
      type: 'confirm',
      message: 'Adakah anda pasti mahu memadamkan soalan ini?',
    })
    await second.getByTestId('question-delete').click()
    await dialog
    await expect(page.getByText('Soalan berjaya dipadam.')).toBeVisible()
    await expect(page.locator(`[data-question-id="${id}"]`)).toHaveCount(0)
    await expect(page.getByTestId('questions-total')).toHaveText('Jumlah: 465,277 soalan')
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
    await expectTabTitle(page, 'Lihat Soalan')
    await expect(page.getByRole('heading', { name: '📝 Detail Soalan' })).toBeVisible()
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

  test('delete asks to confirm, then goes back to the list with the flash', async ({ page }) => {
    const dialog = acceptNextDialog(page, {
      type: 'confirm',
      message: 'Adakah anda pasti mahu memadamkan soalan ini?',
    })
    await page.getByTestId('question-delete').click()
    await dialog
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await expect(page.getByText('Soalan berjaya dipadam.')).toBeVisible()
    await expect(page.locator('[data-question-id="564159"]')).toHaveCount(0)
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
