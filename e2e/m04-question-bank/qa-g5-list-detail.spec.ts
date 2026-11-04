/**
 * M04 G5 QA specs (written by QA, gaps in the developer smoke): S1 list, S3 detail.
 * Covers AC-M04-01.x, 02.x, 03.x, 04.x, 05.x, 10.x, 11.x, 29.x, 30.x for the built screens.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  answerConfirm,
  applyFilters,
  clickRowDelete,
  isNarrow,
  listRows,
  openMoreFilters,
  openSubjectTable,
  pager,
  rowOf,
} from './list-helpers'
import {
  expectNoHorizontalScroll,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)
/** The row checkboxes of the current page (table rows or cards), excluding the header one. */
const rowChecks = (page: Page) => listRows(page).getByRole('checkbox')
const totalOf = async (page: Page): Promise<number> =>
  Number((await byId(page, 'questions-total').innerText()).replace(/[^0-9]/g, ''))

test.describe('QA G5 S1 list', { tag: [moduleTag(4), '@qa'] }, () => {
  test.setTimeout(150_000)
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions')
  })

  test('E2E-M04-01 header, shell title with page subtitle, sidebar active item (AC-01.1, 28.3)', async ({
    page,
  }) => {
    // v2 Portal Pentadbiran: the shell h1 is the page title; the page subtitle sits under it.
    await expect(page.getByRole('heading', { name: 'Pengurusan Soalan', level: 1 })).toBeVisible()
    await expect(byId(page, 'pentadbiran-subtitle')).toHaveText(
      'Urus bank soalan untuk platform PRESTASIPLUS',
    )
    await expect(page.getByText('Selamat datang, Admin')).toHaveCount(0)
    if (isDesktopShell(page)) {
      const active = byId(page, 'pentadbiran-nav').locator('[aria-current="page"]')
      await expect(active).toContainText('Bank Soalan')
    }
    await expect(byId(page, 'questions-summary')).toHaveAttribute(
      'aria-label',
      'Ringkasan Bank Soalan',
    )
  })

  test('E2E-M04-01 table columns, 20 rows, row content (AC-01.4, 01.5, 01.6)', async ({ page }) => {
    test.skip(isMobileWidth(page), 'below md the rows are cards (no column header)')
    const rows = listRows(page)
    await expect(rows.first()).toBeVisible()
    const heads = (
      await page.getByTestId('questions-table').locator('thead th').allInnerTexts()
    ).map((s) => s.trim().toUpperCase())
    // v2: "#" became "ID"; the last (actions) header is blank.
    expect(heads).toEqual(['', 'ID', 'SOALAN', 'SUBJEK', 'TAHAP', 'KESUKARAN', 'STATUS', ''])
    await expect(rows).toHaveCount(20)
    const first = rows.first()
    await expect(first.getByTestId('question-id')).toHaveText('564159')
    await expect(first.getByTestId('question-dskp')).toContainText('DSKP')
    await expect(first.getByTestId('question-compliance')).toHaveText(/^[A-Z ]+$/)
    await expect(first.getByTestId('question-source')).toContainText('Source:')
    // 5 star icons per row, 3 filled for the difficulty 3 of 564159.
    await expect(first.getByTestId('question-stars').locator('[data-filled]')).toHaveCount(5)
    await expect(first.getByTestId('question-stars').locator('[data-filled="true"]')).toHaveCount(3)
    await expect(first.getByTestId('question-status')).toHaveText('Diluluskan')
    await expect(first.getByTestId('question-active')).toHaveText(/^\s*(ACTIVE|INACTIVE)$/)
    // Text cut to 80 chars + "..." on every row that is longer.
    const texts = await byId(page, 'question-text').allInnerTexts()
    for (const t of texts) expect(t.replace(/\s+/g, ' ').trim().length).toBeLessThanOrEqual(84 + 40)
    // Every row carries its subject name (the v2 subject cell has no icon).
    const subjects = await rows.evaluateAll((els) =>
      els.map((el) => el.querySelectorAll('td')[3]?.textContent?.trim() ?? ''),
    )
    expect(subjects.filter((x) => x === '')).toEqual([])
  })

  test('E2E-M04-02 subject table: 7 teras + 24 elektif, Bahasa Cina 0 without "lulus", Bahasa Tamil values (AC-02.1, 02.2)', async ({
    page,
  }) => {
    // v2: the tile grid is a collapsible per-subject table (full names, sorted by total, group badge).
    await openSubjectTable(page)
    const tiles = byId(page, 'questions-tile')
    await expect(tiles).toHaveCount(31)
    const names = await tiles.evaluateAll((els) =>
      els.map((el) => (el.closest('tr') as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
    )
    const cina = names.find((n) => n.startsWith('Bahasa Cina'))
    expect(cina, 'Bahasa Cina row').toBeTruthy()
    expect(cina).toMatch(/\b0\b/)
    expect(cina).not.toContain('lulus')
    const tamil = names.find((n) => n.startsWith('Bahasa Tamil'))
    expect(tamil).toContain('15,718')
    expect(tamil).toContain('6,300')
    expect(tamil).toContain('lulus')
    // The group badge column is hidden below md (the per-subject table folds its columns).
    if (!isNarrow(page)) {
      expect(names.find((n) => n.startsWith('Bahasa Melayu'))).toContain('Teras')
      expect(tamil).toContain('Elektif')
    }
    await expect(byId(page, 'questions-group-teras')).toHaveCount(7)
    await expect(byId(page, 'questions-group-elektif')).toHaveCount(24)
    // The KPI strip carries the same group counts.
    await expect(byId(page, 'questions-kpis')).toContainText('Subjek Teras (7)')
    await expect(byId(page, 'questions-kpis')).toContainText('Subjek Elektif (24)')
    // Sum of subject totals equals the S1 total (AC-29.3).
    const totals = await byId(page, 'questions-tile-total').allInnerTexts()
    const sum = totals.reduce((a, s) => a + Number(s.replace(/[^0-9]/g, '')), 0)
    expect(sum).toBe(await totalOf(page))
  })

  test('E2E-M04-03 filter options (AC-03.1)', async ({ page }) => {
    await openMoreFilters(page)
    await expect(byId(page, 'questions-subject').locator('option')).toHaveCount(32)
    const opts = async (id: string) =>
      (await byId(page, id).locator('option').allInnerTexts()).map((s) => s.trim())
    const subject = await opts('questions-subject')
    expect(subject[0]).toBe('Semua Subjek')
    expect(subject).toHaveLength(32)
    // v2 / .cloud: secondary Tingkatan 1-5 only (no Darjah levels).
    expect(await opts('questions-level')).toEqual([
      'Semua Tahap',
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    expect(await opts('questions-difficulty')).toEqual([
      'Semua Kesukaran',
      '⭐ Sangat Mudah',
      '⭐⭐ Mudah',
      '⭐⭐⭐ Sederhana',
      '⭐⭐⭐⭐ Sukar',
      '⭐⭐⭐⭐⭐ Sangat Sukar',
    ])
    expect(await opts('questions-status')).toEqual([
      'Semua Status',
      'Draf',
      'Menunggu Semakan',
      'Diluluskan',
      'Ditolak',
      'Diarkibkan',
    ])
    expect(await opts('questions-dskp')).toEqual(['Semua DSKP', 'Ada DSKP Tag', 'Belum Ditag'])
    expect(await opts('questions-compliance')).toEqual([
      'Semua Compliance',
      'Verified',
      'Pending Mapping',
      'Quarantined',
      'Rejected',
      'Draft',
      'Tiada Source PDF',
      'AI Verified',
    ])
    expect(await opts('questions-source')).toEqual([
      'Semua Source',
      'Textbook',
      'DSKP',
      'Trial',
      'Skema',
    ])
    await expect(byId(page, 'questions-search')).toHaveAttribute('placeholder', 'Cari soalan...')
  })

  test('E2E-M04-03 combined filters are carried in the URL and kept in the controls (AC-03.2)', async ({
    page,
  }) => {
    await openMoreFilters(page)
    await byId(page, 'questions-subject').selectOption({ label: 'Sains' })
    await byId(page, 'questions-level').selectOption({ label: 'Tingkatan 5' })
    await byId(page, 'questions-status').selectOption({ label: 'Diluluskan' })
    await applyFilters(page)
    await expect(page).toHaveURL(/subject_id=4/)
    await expect(page).toHaveURL(/education_level_id=\d+/)
    await expect(page).toHaveURL(/status=approved/)
    await openMoreFilters(page)
    await expect(byId(page, 'questions-subject').locator('option:checked')).toHaveText('Sains')
    await expect(byId(page, 'questions-level').locator('option:checked')).toHaveText('Tingkatan 5')
    await expect(byId(page, 'questions-status').locator('option:checked')).toHaveText('Diluluskan')
    const subj = await listRows(page).evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).innerText),
    )
    expect(subj.length).toBeGreaterThan(0)
    for (const s of subj) {
      expect(s).toContain('Sains')
      expect(s).toContain('Tingkatan 5')
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M04-03 status=archived, compliance filters, ignored params, empty draft (AC-03.3, 03.4, 03.5)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/questions?status=archived')
    if (isNarrow(page)) {
      // Cards show the status as a labelled field, not the pill/ACTIVE badge testids.
      await expect(listRows(page).first()).toContainText('Arkib')
    } else {
      await expect(byId(page, 'question-status').first()).toHaveText('Arkib')
      await expect(byId(page, 'question-active').first()).toHaveText('INACTIVE')
    }

    await gotoApp('/admin/questions?compliance_filter=pending_mapping')
    // The compliance badge is a table-only element; cards (< md) do not render it.
    if (!isNarrow(page)) await expect(byId(page, 'question-compliance').first()).toHaveText('PENDING MAPPING')
    else await expect(listRows(page).first()).toBeVisible()

    await gotoApp('/admin/questions?compliance_filter=missing_source')
    await expect(listRows(page).first()).toBeVisible()
    await expect(byId(page, 'question-source-file')).toHaveCount(0)

    await gotoApp('/admin/questions?compliance_filter=verified_generated')
    if (!isNarrow(page)) await expect(byId(page, 'question-ai-verified').first()).toContainText('AI Verified')

    // type / question_type / sort are ignored.
    await gotoApp('/admin/questions?type=essay&question_type=essay&sort=id')
    if (!isNarrow(page)) await expect(byId(page, 'question-id').first()).toHaveText('564159')
    await expect(pager(page)).toBeVisible()

    await gotoApp('/admin/questions?status=draft&subject_id=31')
    await expect(byId(page, 'questions-empty')).toContainText('Tiada soalan dijumpai')
    await expect(byId(page, 'questions-empty-add')).toHaveAttribute(
      'href',
      '/admin/questions/create',
    )
    await expect(byId(page, 'questions-table')).toHaveCount(0)
  })

  test('E2E-M04-05 pager window, page 2 keeps status (AC-01.7, 30.2)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/questions?status=archived')
    const bar = pager(page)
    // v2 DsDataTable pager: a "from-to of total" summary, a page-size select and numbered pages.
    await expect(bar.getByRole('status')).toHaveText(/^Menunjukkan 1-20 daripada \d+ hasil$/)
    await expect(bar.getByRole('button', { name: 'Halaman 1', exact: true })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Halaman 2', exact: true })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Halaman seterusnya' })).toBeEnabled()
    await expect(bar.getByRole('button', { name: 'Halaman sebelumnya' })).toBeDisabled()
    const box = await bar.boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth(page) + 1)
    await bar.getByRole('button', { name: 'Halaman 2', exact: true }).click()
    await expect(page).toHaveURL(/status=archived/)
    await expect(page).toHaveURL(/page=2/)
    await expect(bar.getByRole('status')).toHaveText(/^Menunjukkan 21-40 daripada \d+ hasil$/)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M04-07 each bulk verb confirm text; cancel sends nothing (AC-04.4)', async ({
    page,
    mock,
  }) => {
    await rowChecks(page).nth(0).check()
    await rowChecks(page).nth(1).check()
    await rowChecks(page).nth(2).check()
    await expect(byId(page, 'questions-selected-count')).toHaveText('3')
    const opts = (await byId(page, 'questions-bulk-action').locator('option').allInnerTexts()).map(
      (s) => s.trim(),
    )
    expect(opts).toEqual(['Pilih Tindakan', 'Luluskan', 'Tolak', 'Arkibkan', 'Padam'])
    const before = (await mock.requests('/api/')).length
    const verbs: Array<[string, string]> = [
      ['approve', 'meluluskan'],
      ['reject', 'menolak'],
      ['archive', 'mengarkibkan'],
      ['delete', 'memadamkan'],
    ]
    for (const [value, verb] of verbs) {
      await byId(page, 'questions-bulk-action').selectOption(value)
      await byId(page, 'questions-bulk-submit').click()
      // The DS confirm dialog (useConfirm) replaced the native confirm().
      await answerConfirm(page, 'cancel', `Adakah anda pasti mahu ${verb} 3 soalan?`)
    }
    const after = await mock.requests('/api/')
    const writes = after.slice(before).filter((r) => r.method !== 'GET')
    expect(writes).toHaveLength(0)
    await expect(byId(page, 'questions-selected-count')).toHaveText('3')
  })

  test('E2E-M04-08 bulk Arkibkan on 2 rows and Padam on 1 row; filters kept (AC-04.5)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/questions?subject_id=4')
    await expect(byId(page, 'questions-total')).toBeVisible()
    const totalBefore = await totalOf(page)
    await rowChecks(page).nth(0).check()
    await rowChecks(page).nth(1).check()
    await byId(page, 'questions-bulk-action').selectOption('archive')
    await byId(page, 'questions-bulk-submit').click()
    await answerConfirm(page, 'ok')
    await expect(page).toHaveURL(/subject_id=4/)
    if (isNarrow(page)) {
      await expect(listRows(page).nth(0)).toContainText('Arkib')
      await expect(listRows(page).nth(1)).toContainText('Arkib')
    } else {
      await expect(byId(page, 'question-status').nth(0)).toHaveText('Arkib')
      await expect(byId(page, 'question-status').nth(1)).toHaveText('Arkib')
    }

    await rowChecks(page).nth(2).check()
    await byId(page, 'questions-bulk-action').selectOption('delete')
    // Cards (< md) do not render the id; the total drop below proves the delete there.
    const id = isNarrow(page) ? '' : (await byId(page, 'question-id').nth(2).innerText()).trim()
    await byId(page, 'questions-bulk-submit').click()
    await answerConfirm(page, 'ok')
    if (id) await expect(byId(page, 'question-id').getByText(id, { exact: true })).toHaveCount(0)
    await expect.poll(() => totalOf(page)).toBeLessThan(totalBefore)
    await expect(page).toHaveURL(/subject_id=4/)
  })

  test('E2E-M04-09 row view / edit navigation; delete cancel keeps the row (AC-05.1, 05.2)', async ({
    page,
  }) => {
    const first = listRows(page).first()
    const total = await totalOf(page)
    // Delete sits in the row "..." menu and asks through the DS confirm dialog.
    await clickRowDelete(first)
    await answerConfirm(page, 'cancel', 'Adakah anda pasti mahu memadamkan soalan ini?')
    // Cards do not render the id, so below md the first card stands in for row 564159.
    await expect(isNarrow(page) ? listRows(page).first() : rowOf(page, '564159')).toHaveCount(1)
    expect(await totalOf(page)).toBe(total)
    if (isNarrow(page)) {
      // Cards fold every action into the "..." menu (inline 0).
      await first.getByTestId('question-more').click()
      await expect(page.getByRole('menuitem', { name: 'Lihat' })).toHaveAttribute(
        'href',
        '/admin/questions/564159',
      )
      await page.getByRole('menuitem', { name: 'Edit' }).click()
    } else {
      await expect(first.getByTestId('question-view')).toHaveAttribute(
        'href',
        '/admin/questions/564159',
      )
      await expect(first.getByTestId('question-edit')).toHaveAttribute(
        'href',
        '/admin/questions/564159/edit',
      )
      await first.getByTestId('question-edit').click()
    }
    await expect(page).toHaveURL(/\/admin\/questions\/564159\/edit$/)
  })

  test('E2E-M04-10 create button opens S2 (AC-01.2)', async ({ page }) => {
    await expect(byId(page, 'questions-add')).toHaveAttribute('href', '/admin/questions/create')
  })
})

test.describe('QA G5 S3 detail states', { tag: [moduleTag(4), '@qa'] }, () => {
  test.setTimeout(150_000)
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M04-21 S3 of 564159: header, shell title, options, DSKP lines, info rows (AC-10.1, 10.2, 10.4, 10.5)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/564159')
    await expect(page.getByRole('heading', { name: 'Detail Soalan', level: 1 })).toBeVisible()
    await expect(byId(page, 'question-subtitle')).toHaveText('Soalan #564159')
    await expect(byId(page, 'question-back')).toHaveAttribute('href', /\/admin\/questions/)
    await expect(byId(page, 'question-edit')).toContainText('Edit')
    await expect(byId(page, 'question-delete')).toContainText('Padam')
    const opts = byId(page, 'question-option')
    await expect(opts).toHaveCount(4)
    await expect(opts.nth(0)).toContainText('A')
    const label = byId(page, 'info-card').getByText('Subjek', { exact: true })
    await expect(label).toBeVisible()
    // v2: the label style is the DS overline token, not a forced uppercase transform.
    await expect(byId(page, 'info-card')).toContainText(/Tahap Pendidikan/i)
    await expect(byId(page, 'info-points')).toHaveText('1 mata')
    await expect(byId(page, 'info-language')).toBeVisible()
    await expect(byId(page, 'info-difficulty')).toContainText('(3/5)')
    const dskpLines = (await byId(page, 'info-dskp').allInnerTexts())
      .flatMap((t) => t.split(String.fromCharCode(10)))
      .filter((x) => x.trim())
    expect(dskpLines.length).toBeGreaterThanOrEqual(3)
    await expect(byId(page, 'explanation-card')).toBeVisible()
    await expect(byId(page, 'explanation-card')).toContainText('Penjelasan')
    await expectNoHorizontalScroll(page)
    // sidebar below main under 1024, beside it at 1280 (AC-30.4)
    const main = await byId(page, 'question-card').boundingBox()
    const side = await byId(page, 'info-card').boundingBox()
    if (isDesktopShell(page)) expect(side!.x).toBeGreaterThan(main!.x + main!.width - 4)
    else expect(side!.y).toBeGreaterThan(main!.y + main!.height - 4)
  })

  test('E2E-M04-22 S3 of archived 129114: Diarkibkan, no Penjelasan card, Belum ditag, delete cancel keeps, accept goes to S1 (AC-10.3)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/129114')
    await expect(byId(page, 'question-status')).toHaveText('Diarkibkan')
    await expect(byId(page, 'explanation-card')).toHaveCount(0)
    await expect(byId(page, 'info-dskp')).toContainText('Belum ditag')
    await expect(byId(page, 'info-difficulty')).toContainText('(1/5)')
    await byId(page, 'question-delete').click()
    await answerConfirm(page, 'cancel')
    await expect(page).toHaveURL(/\/admin\/questions\/129114$/)
    await byId(page, 'question-delete').click()
    await answerConfirm(page, 'ok')
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await expect(byId(page, 'question-id').getByText('129114', { exact: true })).toHaveCount(0)
  })

  test.describe('states profile', () => {
    test.use({
      mockInit: { latency: 0, overrides: { questionStore: { profile: 'states' } } },
    })

    test('E2E-M04-23 draft 570001 shows status buttons; approve sets Diluluskan; approved 564159 has none (AC-10.6)', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/questions/570001')
      await expect(byId(page, 'quick-actions')).toBeVisible()
      await expect(byId(page, 'status-approve')).toBeVisible()
      await byId(page, 'status-approve').click()
      await answerConfirm(page, 'ok', 'Adakah anda pasti mahu mengubah status soalan ini?')
      await expect(byId(page, 'question-status')).toHaveText('Diluluskan')
      await gotoApp('/admin/questions/564159')
      await expect(byId(page, 'quick-actions')).toHaveCount(0)
    })

    test('E2E-M04-15 non-MCQ types show their answer card on S3 (AC-10.7)', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      for (const id of ['570010', '570011', '570012', '570013']) {
        await gotoApp(`/admin/questions/${id}`)
        await expect(byId(page, 'answer-card')).toBeVisible()
        await expect(byId(page, 'options-card')).toHaveCount(0)
      }
    })

    test('E2E-M04-28 S4 of non-MCQ types pre-fills their own card, no MCQ required (AC-12.3)', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      const expectCard: Record<string, string> = {
        '570010': 'tf-card',
        '570011': 'short-card',
        '570012': 'short-card',
        '570013': 'essay-card',
      }
      for (const [id, card] of Object.entries(expectCard)) {
        await gotoApp(`/admin/questions/${id}/edit`)
        await expect(byId(page, card)).toBeVisible()
        await expect(byId(page, 'mcq-card')).toBeHidden()
        await expect(byId(page, 'q-option-0')).not.toHaveAttribute('required', /.*/)
      }
    })
  })

  test('E2E-M04-24 AI generate shows the loading line (AC-11.2)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/564159')
    await mock.config('m04.aiLatencyMs', 1500)
    await byId(page, 'ai-generate').click()
    await expect(byId(page, 'ai-loading')).toContainText(
      'Sedang menjana penjelasan... (anggaran 5-15 saat)',
    )
    await expect(byId(page, 'ai-content')).toBeVisible({ timeout: 10_000 })
  })

  test('E2E-M04-26 regenerate confirm text; cancel keeps; accept replaces (AC-11.5)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/570023')
    await mock.config('m04.aiLatencyMs', 0)
    const before = await byId(page, 'ai-content').innerText()
    await byId(page, 'ai-regenerate').click()
    await answerConfirm(page, 'cancel', 'Jana semula Penjelasan AI? Versi lama akan ditimpa.')
    expect(await byId(page, 'ai-content').innerText()).toBe(before)
    await byId(page, 'ai-regenerate').click()
    await answerConfirm(page, 'ok')
    await expect(byId(page, 'ai-content')).toBeVisible()
  })
})

test.describe('QA G5 guards and nav', { tag: [moduleTag(4), '@qa'] }, () => {
  test.setTimeout(150_000)
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M04-56 guest is redirected to /login (AC-29.1)', async ({ page, gotoApp }) => {
    for (const path of [
      '/admin/questions',
      '/admin/questions/create',
      '/admin/questions/564159',
      '/admin/questions/import',
      '/admin/questions/quality',
      '/admin/structured-questions',
      '/admin/question-submissions',
      '/admin/soalan-gambar',
      '/admin/master-notes',
    ]) {
      await gotoApp(path)
      await expect(page, path).toHaveURL(/\/login/)
    }
  })

  test('E2E-M04-56 a pelajar opening an admin M04 route sees Akses Ditolak in place (AC-29.2, FR-X2-4)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/admin/questions')
    await expect(page.getByRole('heading', { level: 1, name: 'Akses Ditolak' })).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/questions/)
    await expect(page.getByTestId('questions-page')).toHaveCount(0)
  })

  test('E2E-M04-54 admin shell nav: group items and hrefs; menu drawer below 1024 (AC-28.1, 28.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions')
    // Portal Pentadbiran menu (v2): one sidebar, a drawer behind the menu button below lg.
    const expected: Array<[string, string]> = [
      ['Bank Soalan', '/admin/questions'],
      ['Import & Semakan', '/admin/spm/soalan/ekstrak'],
      ['Kualiti Soalan', '/admin/questions/quality'],
      ['Laporan Soalan', '/admin/question-reports'],
    ]
    if (!isDesktopShell(page)) await byId(page, 'pentadbiran-menu-button').click()
    const nav = page.locator('[data-testid="pentadbiran-nav"]:visible')
    await expect(nav).toBeVisible()
    for (const [label, href] of expected) {
      await expect(nav.locator(`a[href="${href}"]`).first(), label).toContainText(label)
    }
    await expect(nav.locator('a[href="/admin/questions"]').first()).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test.fixme('E2E-M04-54 admin menu links Soalan Berstruktur and Kertas Soalan Guru (AC-28.1)', async () => {
    // FIXME: the v2 Portal Pentadbiran menu no longer lists /admin/structured-questions and
    // /admin/question-submissions (routes still open by URL); needs a product decision, not a spec change.
  })

  test('E2E-M04-54 page titles of S5, S5h, S6, S8, S9, S10, S11 and their subtitles (AC-28.3)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    // [path, h1, subtitle under the title or null]
    const pairs: Array<[string, string, string | null]> = [
      ['/admin/questions/create', 'Tambah Soalan Baru', 'Isi maklumat di bawah untuk menambah soalan baharu'],
      ['/admin/questions/564159/edit', 'Edit Soalan', 'Kemaskini maklumat soalan #564159'],
      ['/admin/questions/import', 'Import Soalan Secara Pukal', null],
      ['/admin/questions/quality', 'Dashboard Kualiti Soalan', null],
      ['/admin/structured-questions', 'Soalan Berstruktur', 'Semua soalan berstruktur SPM dalam sistem'],
      ['/admin/question-submissions', 'Kertas Soalan Guru', null],
      ['/admin/soalan-gambar', 'Soalan Perlu Gambar Rajah', null],
    ]
    for (const [path, title, sub] of pairs) {
      await gotoApp(path)
      await expect(page.getByRole('heading', { level: 1 }), path).toHaveText(title)
      if (sub) await expect(byId(page, 'pentadbiran-subtitle'), path).toHaveText(sub)
      else await expect(byId(page, 'pentadbiran-subtitle'), path).toHaveCount(0)
    }
  })
})
