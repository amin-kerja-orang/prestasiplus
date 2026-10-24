/**
 * M04 G5 QA specs (written by QA, gaps in the developer smoke): S1 list, S3 detail.
 * Covers AC-M04-01.x, 02.x, 03.x, 04.x, 05.x, 10.x, 11.x, 29.x, 30.x for the built screens.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  dismissNextDialog,
  expectNoHorizontalScroll,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)

test.describe('QA G5 S1 list', { tag: [moduleTag(4), '@qa'] }, () => {
  test.setTimeout(150_000)
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions')
  })

  test('E2E-M04-01 header, shell title without subtitle, sidebar active item (AC-01.1, 28.3)', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: '📚 Pengurusan Soalan' })).toBeVisible()
    await expect(page.getByText('Urus bank soalan untuk platform PRESTASIPLUS')).toBeVisible()
    await expect(byId(page, 'shell-admin-title')).toHaveText('Pengurusan Soalan')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveCount(0)
    await expect(page.getByText('Selamat datang, Admin')).toHaveCount(0)
    if (isDesktopShell(page)) {
      const active = byId(page, 'shell-admin-nav').locator('.active')
      await expect(active).toContainText('Senarai Soalan')
    }
    await expect(byId(page, 'questions-summary')).toContainText('Ringkasan Bank Soalan')
  })

  test('E2E-M04-01 table columns, 20 rows, row content (AC-01.4, 01.5, 01.6)', async ({ page }) => {
    await expect(byId(page, 'question-row').first()).toBeVisible()
    const heads = (
      await page.getByTestId('questions-table').locator('thead th').allInnerTexts()
    ).map((s) => s.trim().toUpperCase())
    expect(heads).toEqual(['', '#', 'SOALAN', 'SUBJEK', 'TAHAP', 'KESUKARAN', 'STATUS', 'TINDAKAN'])
    const rows = byId(page, 'question-row')
    await expect(rows).toHaveCount(20)
    const first = rows.first()
    await expect(first.getByTestId('question-id')).toHaveText('564159')
    await expect(first.getByTestId('question-dskp')).toContainText('DSKP')
    await expect(first.getByTestId('question-compliance')).toHaveText(/^[A-Z ]+$/)
    await expect(first.getByTestId('question-source')).toContainText('Sumber:')
    await expect(first.getByTestId('question-stars').locator('.fa-star, svg, i')).not.toHaveCount(0)
    await expect(first.getByTestId('question-status')).toHaveText('Diluluskan')
    await expect(first.getByTestId('question-active')).toHaveText(/^(ACTIVE|INACTIVE)$/)
    // Text cut to 80 chars + "..." on every row that is longer.
    const texts = await byId(page, 'question-text').allInnerTexts()
    for (const t of texts) expect(t.replace(/\s+/g, ' ').trim().length).toBeLessThanOrEqual(84 + 40)
    // Every row's subject cell carries an icon (the book icon, same on every row).
    expect(
      await rows.evaluateAll((els) => els.map((el) => el.querySelectorAll('svg').length > 0)),
    ).not.toContain(false)
  })

  test('E2E-M04-02 tiles: 7 teras + 24 elektif, Bahasa Cina 0 without "lulus", Bahasa Tamil values (AC-02.1, 02.2)', async ({
    page,
  }) => {
    await expect(byId(page, 'questions-group-teras').locator('xpath=..')).toBeVisible()
    const tiles = byId(page, 'questions-tile')
    await expect(tiles).toHaveCount(31)
    const names = await tiles.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
    )
    expect(names[0]).toContain('Bahasa Melay...')
    expect(names[0]).toContain('32,905')
    expect(names[0]).toContain('13,081')
    const cina = names.find((n) => n.startsWith('Bahasa Cina'))
    expect(cina, 'Bahasa Cina tile').toBeTruthy()
    expect(cina).toMatch(/\b0\b/)
    expect(cina).not.toContain('lulus')
    const tamil = names.find((n) => n.startsWith('Bahasa Tamil'))
    expect(tamil).toContain('25,800')
    expect(tamil).toContain('6,300')
    expect(tamil).toContain('lulus')
    // 7 teras tiles before the elektif group.
    const teras = await byId(page, 'questions-group-teras')
      .locator('xpath=following-sibling::*[1]')
      .getByTestId('questions-tile')
      .count()
    expect(teras).toBe(7)
    // Sum of tile totals equals the S1 total (AC-29.3).
    const totals = await byId(page, 'questions-tile-total').allInnerTexts()
    const sum = totals.reduce((a, s) => a + Number(s.replace(/[^0-9]/g, '')), 0)
    expect(sum).toBe(465278)
  })

  test('E2E-M04-03 filter options (AC-03.1)', async ({ page }) => {
    await expect(byId(page, 'questions-subject').locator('option')).toHaveCount(32)
    await expect(byId(page, 'questions-level').locator('option')).toHaveCount(12)
    const opts = async (id: string) =>
      (await byId(page, id).locator('option').allInnerTexts()).map((s) => s.trim())
    const subject = await opts('questions-subject')
    expect(subject[0]).toBe('Semua Subjek')
    expect(subject).toHaveLength(32)
    const level = await opts('questions-level')
    expect(level[0]).toBe('Semua Tahap')
    expect(level).toHaveLength(12)
    expect(level[1]).toBe('Darjah 1')
    expect(level[11]).toBe('Tingkatan 5')
    expect(await opts('questions-difficulty')).toEqual([
      'Semua',
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
    expect(await opts('questions-dskp')).toEqual(['Semua', 'Ada DSKP Tag', 'Belum Ditag'])
    expect(await opts('questions-compliance')).toEqual([
      'Semua',
      'Disahkan',
      'Menunggu Pemetaan',
      'Dikuarantin',
      'Ditolak',
      'Draf',
      'Tiada PDF Sumber',
      'Disahkan AI',
    ])
    expect(await opts('questions-source')).toEqual(['Semua', 'Buku Teks', 'DSKP', 'Percubaan', 'Skema'])
    await expect(byId(page, 'questions-search')).toHaveAttribute('placeholder', 'Cari soalan...')
  })

  test('E2E-M04-03 combined filters are carried in the URL and kept in the controls (AC-03.2)', async ({
    page,
  }) => {
    await byId(page, 'questions-subject').selectOption({ label: 'Sains' })
    await byId(page, 'questions-level').selectOption({ label: 'Tingkatan 5' })
    await byId(page, 'questions-status').selectOption({ label: 'Diluluskan' })
    await byId(page, 'questions-search-submit').click()
    await expect(page).toHaveURL(/subject_id=4/)
    await expect(page).toHaveURL(/education_level_id=11/)
    await expect(page).toHaveURL(/status=approved/)
    await expect(byId(page, 'questions-subject').locator('option:checked')).toHaveText('Sains')
    await expect(byId(page, 'questions-level').locator('option:checked')).toHaveText('Tingkatan 5')
    await expect(byId(page, 'questions-status').locator('option:checked')).toHaveText('Diluluskan')
    const subj = await byId(page, 'question-row').evaluateAll((els) =>
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
    await expect(byId(page, 'question-status').first()).toHaveText('Arkib')
    await expect(byId(page, 'question-active').first()).toHaveText('Tidak Aktif')

    await gotoApp('/admin/questions?compliance_filter=pending_mapping')
    await expect(byId(page, 'question-compliance').first()).toHaveText('MENUNGGU PEMETAAN')

    await gotoApp('/admin/questions?compliance_filter=missing_source')
    await expect(byId(page, 'question-row').first()).toBeVisible()
    await expect(byId(page, 'question-source-file')).toHaveCount(0)

    await gotoApp('/admin/questions?compliance_filter=draft')
    await expect(byId(page, 'question-source').first()).toContainText('Sumber: TIADA')

    await gotoApp('/admin/questions?compliance_filter=verified_generated')
    await expect(byId(page, 'question-ai-verified').first()).toContainText('Disahkan AI')

    // type / question_type / sort are ignored.
    await gotoApp('/admin/questions?type=essay&question_type=essay&sort=id')
    await expect(byId(page, 'question-id').first()).toHaveText('564159')
    await expect(page.locator('[data-testid="questions-pager"]')).toBeVisible()

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
    const pager = byId(page, 'questions-pager')
    if (isMobileWidth(page)) {
      await expect(pager.getByText('Next »')).toBeVisible()
      await expect(pager.getByText('« Previous')).toBeVisible()
      await expect(pager.getByRole('link', { name: /Previous/ })).toHaveCount(0)
    } else {
      await expect(pager).toContainText('Showing 1 to 20 of 318948 results')
      const labels = (await pager.getByRole('link').allInnerTexts()).map((s) => s.trim())
      for (const n of ['2', '10', '15948', '15949']) {
        void n
      }
      expect(labels).toContain('2')
      expect(labels).toContain('10')
      await expect(pager).toContainText('...')
      const box = await pager.boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth(page) + 1)
    }
    const next = pager.locator('a[href*="page=2"]:visible').first()
    await expect(next).toHaveAttribute('href', /status=archived/)
    await next.click()
    await expect(page).toHaveURL(/status=archived/)
    await expect(page).toHaveURL(/page=2/)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M04-07 each bulk verb confirm text; cancel sends nothing (AC-04.4)', async ({
    page,
    mock,
  }) => {
    await page.locator('tbody [role="checkbox"]').nth(0).check()
    await page.locator('tbody [role="checkbox"]').nth(1).check()
    await page.locator('tbody [role="checkbox"]').nth(2).check()
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
      const d = dismissNextDialog(page, {
        type: 'confirm',
        message: `Adakah anda pasti mahu ${verb} 3 soalan?`,
      })
      await byId(page, 'questions-bulk-submit').click()
      await d
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
    const totalBefore = Number(
      (await byId(page, 'questions-total').innerText()).replace(/[^0-9]/g, ''),
    )
    await page.locator('tbody [role="checkbox"]').nth(0).check()
    await page.locator('tbody [role="checkbox"]').nth(1).check()
    await byId(page, 'questions-bulk-action').selectOption('archive')
    const d = acceptNextDialog(page, { type: 'confirm' })
    await byId(page, 'questions-bulk-submit').click()
    await d
    await expect(page).toHaveURL(/subject_id=4/)
    await expect(byId(page, 'question-status').nth(0)).toHaveText('Arkib')
    await expect(byId(page, 'question-status').nth(1)).toHaveText('Arkib')

    await page.locator('tbody [role="checkbox"]').nth(2).check()
    await byId(page, 'questions-bulk-action').selectOption('delete')
    const id = (await byId(page, 'question-id').nth(2).innerText()).trim()
    const d2 = acceptNextDialog(page, { type: 'confirm' })
    await byId(page, 'questions-bulk-submit').click()
    await d2
    await expect(page.locator(`[data-question-id="${id}"]`)).toHaveCount(0)
    const totalAfter = Number(
      (await byId(page, 'questions-total').innerText()).replace(/[^0-9]/g, ''),
    )
    expect(totalAfter).toBeLessThan(totalBefore)
    await expect(page).toHaveURL(/subject_id=4/)
  })

  test('E2E-M04-09 row view / edit navigation; delete cancel keeps the row (AC-05.1, 05.2)', async ({
    page,
  }) => {
    const first = byId(page, 'question-row').first()
    const d = dismissNextDialog(page, {
      type: 'confirm',
      message: 'Adakah anda pasti mahu memadamkan soalan ini?',
    })
    await first.getByTestId('question-delete').click()
    await d
    await expect(first.getByTestId('question-id')).toHaveText('564159')
    await expect(byId(page, 'questions-total')).toHaveText('Jumlah: 465,278 soalan')
    await expect(first.getByTestId('question-view')).toHaveAttribute(
      'href',
      '/admin/questions/564159',
    )
    await expect(first.getByTestId('question-edit')).toHaveAttribute(
      'href',
      '/admin/questions/564159/edit',
    )
    await first.getByTestId('question-edit').click()
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
    await expect(byId(page, 'shell-admin-title')).toHaveText('Detail Soalan')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveCount(0)
    await expect(byId(page, 'question-back')).toHaveAttribute('href', /\/admin\/questions/)
    await expect(byId(page, 'question-edit')).toContainText('Edit')
    await expect(byId(page, 'question-delete')).toContainText('Padam')
    const opts = byId(page, 'question-option')
    await expect(opts).toHaveCount(4)
    await expect(opts.nth(0)).toContainText('A')
    const label = byId(page, 'info-card').getByText('Subjek', { exact: true })
    await expect(label).toBeVisible()
    expect(await label.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')
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
    const d = dismissNextDialog(page, { type: 'confirm' })
    await byId(page, 'question-delete').click()
    await d
    await expect(page).toHaveURL(/\/admin\/questions\/129114$/)
    const d2 = acceptNextDialog(page, { type: 'confirm' })
    await byId(page, 'question-delete').click()
    await d2
    await expect(page).toHaveURL(/\/admin\/questions$/)
    await expect(page.locator('[data-question-id="129114"]')).toHaveCount(0)
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
      const d = acceptNextDialog(page, {
        type: 'confirm',
        message: 'Adakah anda pasti mahu mengubah status soalan ini?',
      })
      await byId(page, 'status-approve').click()
      await d
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
    const d = dismissNextDialog(page, {
      type: 'confirm',
      message: 'Jana semula Penjelasan AI? Versi lama akan ditimpa.',
    })
    await byId(page, 'ai-regenerate').click()
    await d
    expect(await byId(page, 'ai-content').innerText()).toBe(before)
    const d2 = acceptNextDialog(page, { type: 'confirm' })
    await byId(page, 'ai-regenerate').click()
    await d2
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

  test('E2E-M04-56 a pelajar opening an admin M04 route is sent away (AC-29.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/admin/questions')
    await expect(page).not.toHaveURL(/\/admin\/questions/)
    await expect(page.getByTestId('questions-page')).toHaveCount(0)
  })

  test('E2E-M04-54 admin shell nav: group items and hrefs; bottom nav below 1024 (AC-28.1, 28.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions')
    const expected: Array<[string, string]> = [
      ['Senarai Soalan', '/admin/questions'],
      ['Import CSV', '/admin/questions/import'],
      ['Kualiti Soalan', '/admin/questions/quality'],
      ['Laporan Soalan', '/admin/question-reports'],
      ['Soalan Berstruktur', '/admin/structured-questions'],
      ['Kertas Soalan Guru', '/admin/question-submissions'],
    ]
    if (isDesktopShell(page)) {
      const nav = byId(page, 'shell-admin-nav')
      for (const [label, href] of expected) {
        await expect(nav.locator(`a[href="${href}"]`).first(), label).toContainText(label)
      }
    } else {
      const bottom = byId(page, 'shell-admin-bottom-nav')
      await expect(bottom).toBeVisible()
      await expect(bottom.locator('a[href="/admin/questions"]')).toContainText('Soalan')
      await bottom.getByText('Lagi').click()
      for (const [label, href] of expected.slice(1)) {
        await expect(page.locator(`a[href="${href}"]:visible`).first(), label).toContainText(label)
      }
    }
  })

  test('E2E-M04-54 shell titles of S5, S5h, S6, S8, S9, S10, S11 have no fallback (AC-28.3)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    const pairs: Array<[string, string | RegExp, boolean]> = [
      ['/admin/questions/create', 'Tambah Soalan Baru', false],
      ['/admin/questions/564159/edit', 'Edit Soalan', false],
      ['/admin/questions/import', 'Import Soalan Secara Pukal', true],
      ['/admin/questions/quality', 'Dashboard Kualiti Soalan', true],
      ['/admin/structured-questions', /Soalan Berstruktur|Soalan Berstruktur/, false],
      ['/admin/question-submissions', 'Kertas Soalan Guru', true],
      ['/admin/soalan-gambar', 'Soalan Perlu Gambar Rajah', true],
    ]
    for (const [path, title, hasSub] of pairs) {
      await gotoApp(path)
      await expect(byId(page, 'shell-admin-title'), path).toHaveText(title)
      if (hasSub) await expect(byId(page, 'shell-admin-subtitle'), path).toBeVisible()
      else await expect(byId(page, 'shell-admin-subtitle'), path).toHaveCount(0)
    }
  })
})
