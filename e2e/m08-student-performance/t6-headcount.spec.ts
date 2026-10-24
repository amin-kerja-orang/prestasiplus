/**
 * M08-T6 developer E2E (build-plan M08-T6; QA writes the final E2E-M08-* at G5): the Headcount screens
 * S12 `/headcount`, S13 `/headcount/dashboard`, S14 `/headcount/create`, S15 `/headcount/student/{id}`,
 * S22 `/headcount/{id}/summary`, S23 `/headcount/{id}`, the L-12 page shells, the CSV download #29 and the
 * access rules (§9, OD-R3), as the teacher (account 5), the demo admin and the Admin Sekolah (account 8)
 * at 375 / 768 / 1280, plus a pelajar (account 2) and a guest. Anchors: teacher 5 has 6 configs and 48
 * pupils (on 3 · off 3 · no data 42); config 213 (S22: Above 5, Atas Landasan 2, Below 8, Purata TOV 62.1,
 * Purata ETR 71.9); config 617 (30 entries).
 */

import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isMobileWidth,
  moduleTag,
  provisional,
} from '../support'

const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'
const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'

const header = (page: Page) => ({
  title: page.getByTestId('shell-user-title'),
  subtitle: page.getByTestId('shell-user-subtitle'),
})

async function expectForbidden(page: Page): Promise<void> {
  await expect(page.locator('[data-page=forbidden]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Akses Ditolak' })).toBeVisible()
  await expectTabTitle(page, FORBIDDEN_TITLE)
}

async function expectNotFound(page: Page): Promise<void> {
  await expect(page.locator('[data-page=not-found]')).toBeVisible()
  await expectTabTitle(page, NOT_FOUND_TITLE)
}

// ---------------------------------------------------------------------------------------------
// Teacher (account 5)
// ---------------------------------------------------------------------------------------------

test.describe('M08 T6 teacher (account 5)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.describe.configure({ timeout: 150_000 })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs(5)
  })

  test('S12 lists the 6 own configs newest first and links each to S23', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount')
    await expect(page.getByTestId('headcount-list')).toBeVisible()
    await expectTabTitle(page, 'Headcount - PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Headcount')
    await expect(header(page).subtitle).toHaveText('Selamat datang kembali')
    await expect(page.getByTestId('headcount-hero').getByRole('heading')).toHaveText('Headcount')
    await expect(page.getByText('Penjejakan prestasi murid — TOV, OTR, AR & RS')).toBeVisible()
    await expect(page.getByTestId('hero-dashboard')).toHaveAttribute('href', '/headcount/dashboard')
    await expect(page.getByTestId('hero-create')).toHaveAttribute('href', '/headcount/create')

    const cards = page.locator('[data-testid^=headcount-card-]')
    await expect(cards).toHaveCount(6)
    // updatedAt order of §6.10: 504, 501, 502, 503, 505, 506.
    const ids = await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-testid')?.replace('headcount-card-', '')),
    )
    expect(ids).toEqual(['504', '501', '502', '503', '505', '506'])
    await expect(page.getByTestId('headcount-card-501')).toContainText('Kimia')
    await expect(page.getByTestId('headcount-card-501')).toContainText('Auto')
    await expect(page.getByTestId('headcount-card-501')).toContainText('3 OTR')
    await expect(page.getByTestId('headcount-card-501')).toContainText('8 murid')
    await expect(page.getByTestId('headcount-card-505')).toContainText('Manual')
    await expect(page.getByTestId('headcount-card-505')).toContainText('2025')
    await expect(page.getByTestId('headcount-card-506')).toContainText('2 OTR')
    await expectNoHorizontalScroll(page)

    await page.getByTestId('headcount-card-501').click()
    await expect(page.getByTestId('headcount-table-page')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/headcount/501')
  })

  test('S12 Persediaan Auto modal: texts, 11 checkboxes, disabled submit, ticks, closing', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount')
    await expect(page.getByTestId('headcount-list')).toBeVisible()
    const modal = page.getByTestId('auto-setup-modal')
    await expect(modal).toHaveCount(0)

    const button = page.getByTestId('hero-auto-setup')
    const fontSize = await button.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(fontSize).toBeGreaterThanOrEqual(12)
    await button.click()
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'Persediaan Auto Headcount' })).toBeVisible()
    await expect(modal).toContainText('Pilih tingkatan untuk auto-cipta headcount')
    await expect(modal.getByText('Darjah', { exact: true })).toBeVisible()
    await expect(modal.getByText('Tingkatan', { exact: true })).toBeVisible()
    await expect(modal.locator('input[type=checkbox]')).toHaveCount(11)
    const submit = page.getByTestId('auto-setup-submit')
    await expect(submit).toBeDisabled()
    await expect(submit).toHaveClass(/bg-slate-300/)
    await expect(submit).toHaveText('Persediaan Auto')

    await page.getByTestId('level-D5').click()
    await page.getByTestId('level-T2').click()
    await expect(page.getByTestId('level-D5')).toHaveClass(/bg-amber-50/)
    await expect(page.getByTestId('level-T2')).toHaveClass(/bg-blue-50/)
    await expect(submit).toBeEnabled()
    await expect(submit).toHaveClass(/bg-emerald-600/)
    await expect(submit).toHaveText('Persediaan Auto (2)')

    // Full width below 640px, the two buttons side by side at every width.
    const panel = await modal.boundingBox()
    const width = page.viewportSize()?.width ?? 0
    if (isMobileWidth(page)) expect(panel?.width ?? 0).toBeGreaterThanOrEqual(width - 40)
    const cancel = await page.getByTestId('auto-setup-cancel').boundingBox()
    const ok = await submit.boundingBox()
    expect(Math.abs((cancel?.y ?? 0) - (ok?.y ?? 99))).toBeLessThan(2)
    await expectNoHorizontalScroll(page)

    // "Batal" only hides; reopening clears the ticks.
    await page.getByTestId('auto-setup-cancel').click()
    await expect(modal).toHaveCount(0)
    await button.click()
    await expect(modal.locator('input[type=checkbox]:checked')).toHaveCount(0)
    await expect(submit).toBeDisabled()

    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
    await button.click()
    await page.getByTestId('cmp-modal-backdrop').click({ position: { x: 4, y: 4 } })
    await expect(modal).toHaveCount(0)
  })

  test(
    'S12 Persediaan Auto submit closes the modal and reloads the list',
    provisional('FR-M08-80: the Persediaan Auto result is INFERRED (UNVERIFIED L-4)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/headcount')
      await expect(page.getByTestId('headcount-list')).toBeVisible()
      await page.getByTestId('hero-auto-setup').click()
      await page.getByTestId('level-T5').click()
      await page.getByTestId('auto-setup-submit').click()
      await expect(page.getByTestId('auto-setup-modal')).toHaveCount(0)
      await expect(page.locator('[data-testid^=headcount-card-]').first()).toBeVisible()
      expect(await page.locator('[data-testid^=headcount-card-]').count()).toBeGreaterThanOrEqual(6)
      await expectNoHorizontalScroll(page)
    },
  )

  test('S13 stats 6 configs · 48 pupils · on 3 · off 3, 50%, filter by level, one chart each', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/dashboard')
    await expect(page.getByTestId('headcount-dashboard-page')).toBeVisible()
    await expect(page.getByTestId('stat-configs')).toHaveText('6')
    await expectTabTitle(page, 'Papan Pemuka Headcount - PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Papan Pemuka Headcount')
    await expect(page.getByText('Ringkasan prestasi semua kelas anda')).toBeVisible()
    await expect(page.getByTestId('hero-list')).toHaveAttribute('href', '/headcount')
    await expect(page.getByTestId('stat-students')).toHaveText('48')
    await expect(page.getByTestId('stat-on')).toHaveText('3')
    await expect(page.getByTestId('stat-off')).toHaveText('3')
    await expect(page.getByTestId('overall-pct')).toHaveText('50%')
    await expect(page.getByTestId('overall-pct')).toHaveClass(/text-amber-600/)
    await expect(page.getByTestId('legend')).toHaveText(
      /Atas Landasan: 3\s*Luar Landasan: 3\s*Tiada Data: 42/,
    )
    await expect(page.getByTestId('filter-all')).toHaveText('Semua (6)')
    await expect(page.getByTestId('filter-all')).toHaveClass(/bg-blue-600/)
    await expect(page.locator('[data-testid^=chart-card-]')).toHaveCount(6)
    await expect(page.getByTestId('headcount-chart-501')).toBeVisible()

    await page.getByTestId('filter-level-10').click()
    await expect(page.getByTestId('filter-level-10')).toHaveClass(/bg-blue-600/)
    await expect(page.getByTestId('filter-all')).toHaveClass(/bg-slate-100/)
    await expect(page.getByTestId('stat-configs')).toHaveText('1')
    await expect(page.getByTestId('stat-students')).toHaveText('8')
    await expect(page.locator('[data-testid^=chart-card-]')).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test('S14 form: fields, native validation, create, then the duplicate 409 keeps the values', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/create')
    await expect(page.getByTestId('create-form')).toBeVisible()
    await expectTabTitle(page, 'Buat Headcount Baru - PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Buat Headcount Baru')
    await expect(page.locator('[data-testid=headcount-create-page] h1')).toHaveText(
      'Buat Headcount Baru',
    )
    await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/headcount')
    await expect(page.getByLabel('Pilih Kelas')).toBeVisible()
    await expect(page.getByLabel('Pilih Subjek')).toBeVisible()
    await expect(page.getByLabel('Tingkatan', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Tahun Akademik')).toHaveValue('2026')
    await expect(page.getByLabel('Tahun Akademik')).toHaveAttribute('min', '2020')
    await expect(page.getByLabel('Tahun Akademik')).toHaveAttribute('max', '2100')
    await expect(page.locator('#classroom_id option').first()).toHaveText('— Pilih kelas —')
    await expect(page.locator('#subject_id option').first()).toHaveText('— Pilih subjek —')
    await expect(page.locator('#subject_id option')).toHaveCount(32)
    await expect(page.locator('#education_level_id option')).toHaveText([
      '— Pilih tingkatan —',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    await expect(page.locator('input[name=active_otrs]')).toHaveCount(4)
    await expect(page.locator('input[name=active_otrs][value="3"]')).toBeChecked()
    await expect(page.getByText('2 OTR', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Minimum 2 OTR · Lalai 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas.'),
    ).toBeVisible()
    await expect(page.getByTestId('mode-auto')).toHaveClass(/border-blue-500/)
    await expect(page.getByTestId('mode-auto')).toContainText('🤖 Auto')
    await expect(page.getByTestId('mode-manual')).toContainText('✍️ Manual')
    await expect(page.getByTestId('mode-manual')).not.toHaveClass(/border-blue-500/)
    await page.getByTestId('mode-manual').click()
    await expect(page.getByTestId('mode-manual')).toHaveClass(/border-blue-500/)
    await expect(page.getByTestId('mode-auto')).not.toHaveClass(/border-blue-500/)
    await page.getByTestId('mode-auto').click()
    await expect(
      page.getByText('Boleh ada 1 Auto + 1 Manual untuk kelas + subjek + tahun yang sama.'),
    ).toBeVisible()
    await expect(page.getByTestId('create-submit')).toHaveText('Cipta Headcount')
    await expectNoHorizontalScroll(page)

    // Native validation: an empty form sends nothing and stays here.
    await page.getByTestId('create-submit').click()
    expect(
      await page
        .locator('#classroom_id')
        .evaluate((el: HTMLSelectElement) => el.validity.valueMissing),
    ).toBe(true)
    expect(new URL(page.url()).pathname).toBe('/headcount/create')

    const fill = async () => {
      await page.locator('#classroom_id').selectOption({ index: 1 })
      await page.locator('#subject_id').selectOption({ index: 1 })
      await page.locator('#education_level_id').selectOption('10')
    }
    await fill()
    await page.getByTestId('create-submit').click()
    await expect(page.getByTestId('headcount-list')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/headcount')
    await expect(page.locator('[data-testid^=headcount-card-]')).toHaveCount(7)

    // The same Auto config again: 409 with the proposed copy, the values stay.
    await gotoApp('/headcount/create')
    await expect(page.getByTestId('create-form')).toBeVisible()
    await fill()
    const subject = await page.locator('#subject_id').inputValue()
    await page.getByTestId('create-submit').click()
    await expect(page.getByTestId('form-error')).toContainText(
      'Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.',
    )
    expect(new URL(page.url()).pathname).toBe('/headcount/create')
    await expect(page.locator('#subject_id')).toHaveValue(subject)
    await expect(page.locator('#education_level_id')).toHaveValue('10')
    await expectNoHorizontalScroll(page)

    // The Manual config of the same class + subject + year is allowed.
    await page.getByTestId('mode-manual').click()
    await page.getByTestId('create-submit').click()
    await expect(page.getByTestId('headcount-list')).toBeVisible()
    await expect(page.locator('[data-testid^=headcount-card-]')).toHaveCount(8)
  })

  test('S15 pupil 3001: five sections, the 2025 section with RS, chart, table and the prediction box', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/student/3001')
    await expect(page.getByTestId('headcount-student-page')).toBeVisible()
    await expectTabTitle(page, 'Headcount Murid Demo 01 - PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Headcount — Prestasi Individu')
    await expect(page.getByTestId('student-name')).toHaveText('Murid Demo 01')
    await expect(page.getByTestId('student-subtitle')).toContainText(
      'Headcount — Prestasi Individu · SMK DEMO',
    )
    await expect(page.locator('[data-testid^=section-]')).toHaveCount(5)

    const s = page.getByTestId('section-501')
    await expect(s.getByRole('heading', { name: 'Kimia' })).toBeVisible()
    await expect(s.getByTestId('status-pill')).toHaveText('Atas Landasan')
    await expect(s.getByTestId('status-pill')).toHaveClass(/bg-green-100/)
    await expect(s.getByTestId('chip-tov')).toContainText('TOV: 60.0% (B)')
    await expect(s.getByTestId('chip-etr')).toContainText('ETR: 75.0% (A-)')
    await expect(s.getByTestId('rs-badge')).toHaveCount(0)
    await expect(s.getByTestId('chip-trend')).toHaveText('Meningkat')
    await expect(s.getByTestId('chip-confidence')).toContainText('Keyakinan: Sederhana')
    await expect(s.getByTestId('row-otr-1')).toContainText('62')
    await expect(s.getByTestId('row-otr-1')).toHaveAttribute('data-tone', 'on')
    await expect(s.getByTestId('row-otr-1')).toHaveClass(/bg-green-50/)
    await expect(s.getByTestId('row-otr-3')).toHaveAttribute('data-tone', 'noAr')
    await expect(s.getByTestId('row-etr')).toContainText('ETR (Sasaran Akhir)')
    await expect(s.getByTestId('row-etr')).toContainText('Sasaran akhir')
    await expect(s.getByTestId('row-rs')).toHaveCount(0)
    await expect(s.getByTestId('prediction-box')).toHaveCount(0)

    const below = page.getByTestId('section-504')
    await expect(below.getByTestId('status-pill')).toHaveText('Bawah Sasaran')
    await expect(below.getByTestId('row-otr-1')).toHaveAttribute('data-tone', 'below')
    await expect(below.getByTestId('row-otr-1')).toHaveClass(/border-l-red-400/)

    const none = page.getByTestId('section-502')
    await expect(none.getByTestId('status-pill')).toHaveText('Belum Ada Data')
    await expect(none.getByTestId('chip-etr')).toContainText('ETR: —')

    const rs = page.getByTestId('section-505')
    await expect(rs.getByTestId('rs-badge')).toHaveText(/RS: 82\.0% \(A\)/)
    await expect(rs.getByTestId('chip-rs')).toHaveText(/RS:\s*82\.0% \(A\)/)
    await expect(rs.getByTestId('row-rs')).toContainText('RS (SPM Sebenar)')
    await expect(rs.getByTestId('chip-confidence')).toContainText('Keyakinan: Tinggi')
    await expect(rs.getByTestId('prediction-box')).toContainText('Ketepatan Ramalan ETR vs RS')
    await expect(rs.getByTestId('selisih')).toHaveText('Selisih: +2 markah')
    await expect(rs.getByTestId('verdict')).toHaveText('Ramalan Tepat')
    await expect(rs.getByTestId('prediction-box')).toHaveClass(/bg-green-50/)
    await expect(rs.getByTestId('prediction-box')).toContainText(
      'Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah.',
    )
    await expect(page.getByTestId('student-chart-505')).toBeVisible()
    const labels = await page.evaluate(
      () =>
        (window as unknown as { __charts?: Record<string, { data: { labels: string[] } }> })
          .__charts?.['student-chart-505']?.data.labels,
    )
    expect(labels).toEqual(['TOV', 'OTR1', 'OTR2', 'OTR3', 'ETR', 'RS'])
    await expectNoHorizontalScroll(page)
  })

  test('S15 a pupil name is the S23 link target; an unknown pupil is the 404 page', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/501')
    await expect(page.getByTestId('headcount-table-page')).toBeVisible()
    await page.getByRole('link', { name: 'Murid Demo 01' }).click()
    await expect(page.getByTestId('headcount-student-page')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/headcount/student/3001')
    await page.getByTestId('back-button').click()
    await expect(page.getByTestId('headcount-table-page')).toBeVisible()
    await gotoApp('/headcount/student/99999999')
    await expectNotFound(page)
  })

  test('S22 config 501: cards and the per-OTR distribution', async ({ page, gotoApp }) => {
    await gotoApp('/headcount/501/summary')
    await expect(page.getByTestId('headcount-summary-page')).toBeVisible()
    await expectTabTitle(page, 'Ringkasan Kelas - PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Ringkasan Kelas')
    await expect(page.getByTestId('summary-subtitle')).toContainText(
      'Kimia · 5 MARIKH - Kimia · Tingkatan 5 · 2026',
    )
    await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/headcount/501')
    await expect(page.getByTestId('card-students')).toHaveText('8')
    await expect(page.getByTestId('card-tov')).toHaveText('50.8')
    await expect(page.getByTestId('card-etr')).toHaveText('75')
    await expect(page.getByTestId('card-otrs')).toHaveText('3')
    await expect(page.getByTestId('full-table')).toHaveAttribute('href', '/headcount/501')
    await expect(page.getByTestId('export-csv')).toHaveAttribute('href', '/headcount/501/export')
    await expectNoHorizontalScroll(page)
  })

  test('S23 config 501: header, chips, actions, table, sort and the selection bar', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/501')
    await expect(page.getByTestId('headcount-table-page')).toBeVisible()
    await expectTabTitle(page, 'Headcount Kimia - PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Headcount Kimia')
    await expect(header(page).subtitle).toHaveText('Selamat datang kembali')
    await expect(page.locator('[data-testid=headcount-table-page] h1')).toHaveText('Kimia')
    await expect(page.getByTestId('status-pill')).toHaveText('Active')
    await expect(page.getByTestId('table-subtitle')).toContainText(
      '5 MARIKH - Kimia · Tingkatan 5 · 2026 · Guru: Guru Demo',
    )
    await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/headcount')
    await expect(page.getByTestId('chip-on')).toHaveText('Atas Landasan: 2 (25%)')
    await expect(page.getByTestId('chip-below')).toHaveText('Bawah: 2 (25%)')
    await expect(page.getByTestId('chip-empty')).toHaveText('Belum Diisi: 4')
    await expect(page.getByTestId('chip-total')).toHaveText('Jumlah: 8')

    await expect(page.getByTestId('action-edit')).toHaveAttribute('href', '/headcount/501/edit')
    await expect(page.getByTestId('action-summary')).toHaveAttribute(
      'href',
      '/headcount/501/summary',
    )
    await expect(page.getByTestId('action-unjuran')).toHaveAttribute(
      'href',
      '/headcount/501/unjuran',
    )
    await expect(page.getByTestId('action-settings')).toHaveAttribute(
      'href',
      '/headcount/501/settings',
    )
    await expect(page.getByTestId('action-export')).toHaveAttribute('href', '/headcount/501/export')

    // Ranking order: latest AR descending; A-Z by name.
    await expect(page.getByTestId('sort-ranking')).toHaveClass(/bg-blue-600/)
    const rows = page.locator('[data-testid^=row-]')
    await expect(rows).toHaveCount(8)
    await expect(rows.first()).toContainText('Murid Demo 01')
    await page.getByTestId('sort-name').click()
    await expect(page.getByTestId('sort-name')).toHaveClass(/bg-blue-600/)
    expect(new URL(page.url()).searchParams.get('sort')).toBe('name')
    await expect(rows.nth(1)).toContainText('Murid Demo 02')
    await gotoApp('/headcount/501?sort=zzz')
    await expect(page.getByTestId('sort-ranking')).toHaveClass(/bg-blue-600/)

    const average = page.getByTestId('average-row')
    await expect(average).toContainText('Purata Kelas')
    await expect(average).toContainText('50.8')
    await expect(average).toContainText('75')
    await expect(page.getByTestId('ar-3001-1')).toHaveAttribute('data-tone', 'above')
    await expect(page.getByTestId('ar-3004-1')).toHaveAttribute('data-tone', 'below')
    await expect(page.getByTestId('ar-3005-1')).toHaveAttribute('data-tone', 'na')

    // Select-all and the orange bar.
    await expect(page.getByTestId('selection-bar')).toHaveCount(0)
    await page.getByTestId('select-3005').check()
    await expect(page.getByTestId('selection-bar')).toContainText('1 murid dipilih')
    await page.getByTestId('select-all').check()
    await expect(page.getByTestId('selection-count')).toHaveText('8')
    await page.getByTestId('selection-cancel').click()
    await expect(page.getByTestId('selection-bar')).toHaveCount(0)
    await expect(page.getByTestId('select-3005')).not.toBeChecked()

    // The table scrolls inside its card, the page does not.
    await expectNoHorizontalScroll(page)
  })

  test('S23 "Gugurkan" and "Kembalikan" drop and restore a pupil', async ({ page, gotoApp }) => {
    await gotoApp('/headcount/501')
    await expect(page.getByTestId('chip-total')).toHaveText('Jumlah: 8')
    await page.getByTestId('select-3005').check()
    await page.getByTestId('drop-students').click()
    await expect(page.getByTestId('chip-total')).toHaveText('Jumlah: 7')
    await expect(page.getByTestId('row-3005')).toHaveAttribute('data-dropped', 'true')
    await expect(page.getByTestId('selection-bar')).toHaveCount(0)
    await page.getByTestId('select-3005').check()
    await page.getByTestId('restore-students').click()
    await expect(page.getByTestId('chip-total')).toHaveText('Jumlah: 8')
    await expect(page.getByTestId('row-3005')).toHaveAttribute('data-dropped', 'false')
  })

  test('S23 "Set Semula Data" modal closes without calling the API; "Ya, Set Semula" clears the marks', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/501')
    await expect(page.getByTestId('chip-on')).toHaveText('Atas Landasan: 2 (25%)')
    const modal = page.getByTestId('reset-modal')
    await page.getByTestId('action-reset').click()
    await expect(modal.getByRole('heading', { name: 'Set Semula Semua Data?' })).toBeVisible()
    await expect(modal).toContainText(
      'Semua markah murid akan dikosongkan — TOV, ETR, OTR, AR & RS.',
    )
    await expect(modal).toContainText('Yang kekal selamat:')
    await expect(modal).toContainText('Senarai murid (tidak dipadam)')
    await expect(modal).toContainText('Tetapan headcount (subjek, kelas, tahun)')
    await page.getByTestId('reset-cancel').click()
    await expect(modal).toHaveCount(0)
    await page.getByTestId('action-reset').click()
    await page.getByTestId('cmp-modal-backdrop').click({ position: { x: 4, y: 4 } })
    await expect(modal).toHaveCount(0)
    await expect(page.getByTestId('chip-on')).toHaveText('Atas Landasan: 2 (25%)')

    await page.getByTestId('action-reset').click()
    await expectNoHorizontalScroll(page)
    await page.getByTestId('reset-confirm').click()
    await expect(modal).toHaveCount(0)
    await expect(page.getByTestId('chip-on')).toHaveText('Atas Landasan: 0 (0%)')
    await expect(page.getByTestId('chip-empty')).toHaveText('Belum Diisi: 8')
    await expect(page.getByTestId('chip-total')).toHaveText('Jumlah: 8')
  })

  test('S23 "Padam" modal: copy, cancel, then "Ya, Padam" deletes and opens S12', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/501')
    await expect(page.getByTestId('headcount-table-page')).toBeVisible()
    const modal = page.getByTestId('delete-modal')
    await page.getByTestId('action-delete').click()
    await expect(modal.getByRole('heading', { name: 'Padam Headcount?' })).toBeVisible()
    await expect(modal).toContainText(
      'Anda pasti mahu padam headcount Kimia (5 MARIKH - Kimia, 2026)?',
    )
    await expect(modal).toContainText(
      'Semua data murid, TOV, ETR, OTR, AR & RS akan dipadam secara kekal.',
    )
    await page.getByTestId('delete-cancel').click()
    await expect(modal).toHaveCount(0)
    await expect(page.getByTestId('headcount-table-page')).toBeVisible()
    await page.getByTestId('action-delete').click()
    await page.getByTestId('delete-confirm').click()
    await expect(page.getByTestId('headcount-list')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/headcount')
    await expect(page.locator('[data-testid^=headcount-card-]')).toHaveCount(5)
    await gotoApp('/headcount/501')
    await expectNotFound(page)
  })

  test(
    'L-12 shells and the "Masukkan AR" dropdown: header and back link only',
    provisional('FR-M08-137: the L-12 pages are provisional shells (OQ-M08-13)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/headcount/501')
      await expect(page.getByTestId('headcount-table-page')).toBeVisible()
      await page.getByTestId('action-key-in').click()
      await expect(page.getByTestId('key-in-menu').getByRole('link')).toHaveText([
        'OTR1',
        'OTR2',
        'OTR3',
      ])
      await expect(page.getByTestId('key-in-2')).toHaveAttribute('href', '/headcount/501/results/2')
      await page.getByTestId('key-in-2').click()
      await expect(page.getByTestId('headcount-shell-page')).toBeVisible()
      expect(new URL(page.url()).pathname).toBe('/headcount/501/results/2')
      await expectTabTitle(page, 'Masukkan AR - PRESTASIPLUS')
      await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/headcount/501')
      await expectNoHorizontalScroll(page)

      for (const [path, title] of [
        ['edit', 'Edit TOV/ETR'],
        ['unjuran', 'Unjuran'],
        ['settings', 'Tetapan'],
      ] as const) {
        await gotoApp(`/headcount/501/${path}`)
        await expect(page.getByTestId('headcount-shell-page')).toBeVisible()
        await expect(header(page).title).toHaveText(title)
        await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/headcount/501')
      }
      await gotoApp('/headcount/501/results/9')
      await expectNotFound(page)
      await gotoApp('/headcount/213/edit')
      await expectForbidden(page)
    },
  )

  test(
    'CSV #29: "Eksport CSV" on S23 and S22 downloads the table with a BOM; the export URL downloads too',
    provisional('FR-M08-132: the CSV columns are UNVERIFIED (L-12)'),
    async ({ page, gotoApp }) => {
      await gotoApp('/headcount/501')
      await expect(page.getByTestId('headcount-table-page')).toBeVisible()
      const first = page.waitForEvent('download')
      await page.getByTestId('action-export').click()
      const download = await first
      expect(download.suggestedFilename()).toBe('headcount-501.csv')
      const text = readFileSync(await download.path(), 'utf8')
      expect(text.startsWith('﻿Bil,Nama,TOV (%),Gred TOV,OTR1 (%)')).toBe(true)
      expect(text).toContain('Murid Demo 01')
      expect(text).toContain('Purata Kelas')
      expect(new URL(page.url()).pathname).toBe('/headcount/501')

      await gotoApp('/headcount/501/summary')
      await expect(page.getByTestId('headcount-summary-page')).toBeVisible()
      const second = page.waitForEvent('download')
      await page.getByTestId('export-csv').click()
      expect((await second).suggestedFilename()).toBe('headcount-501.csv')

      const third = page.waitForEvent('download')
      await gotoApp('/headcount/501/export')
      expect((await third).suggestedFilename()).toBe('headcount-501.csv')
      await expect.poll(() => new URL(page.url()).pathname).toBe('/headcount/501')
    },
  )

  test("access: another teacher's config is the 403 page, an unknown id the 404 page", async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/213')
    await expectForbidden(page)
    await gotoApp('/headcount/213/summary')
    await expectForbidden(page)
    await gotoApp('/headcount/617')
    await expectForbidden(page)
    await gotoApp('/headcount/99999999')
    await expectNotFound(page)
    await gotoApp('/headcount/99999999/summary')
    await expectNotFound(page)
    await gotoApp('/headcount/abc')
    await expectNotFound(page)
  })
})

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

test.describe('M08 T6 admin', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.describe.configure({ timeout: 150_000 })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  test('S12 owns no config: the empty state; S13 empty; S14 has no class', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount')
    await expect(page.getByTestId('headcount-empty')).toBeVisible()
    await expect(page.getByTestId('headcount-empty')).toContainText('Belum ada headcount.')
    await expect(page.getByTestId('headcount-create-now')).toHaveAttribute(
      'href',
      '/headcount/create',
    )
    await expect(page.getByTestId('headcount-create-now')).toHaveText('Buat Sekarang')
    await expectNoHorizontalScroll(page)

    await gotoApp('/headcount/dashboard')
    await expect(page.getByTestId('dashboard-empty')).toContainText('Belum ada headcount.')
    await expect(page.getByTestId('filter-all')).toHaveText('Semua (0)')
    await expect(page.getByTestId('stat-configs')).toHaveText('0')
    await expect(page.getByTestId('overall-card')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await gotoApp('/headcount/create')
    await expect(page.getByTestId('create-form')).toBeVisible()
    await expect(page.locator('#classroom_id option')).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test('S22 config 213: 15 pupils, TOV 62.1, ETR 71.9, OTR3 Above 5 · Atas Landasan 2 · Below 8', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/213/summary')
    await expect(page.getByTestId('headcount-summary-page')).toBeVisible()
    await expect(page.getByTestId('summary-subtitle')).toContainText(
      'Sejarah · 4 Simulasi · Tingkatan 4 · 2026',
    )
    await expect(page.getByTestId('card-students')).toHaveText('15')
    await expect(page.getByTestId('card-tov')).toHaveText('62.1')
    await expect(page.getByTestId('card-etr')).toHaveText('71.9')
    await expect(page.getByTestId('card-otrs')).toHaveText('3')
    await expect(page.getByTestId('otr-1')).toContainText('N/A: 15')
    await expect(page.getByTestId('otr-2')).toContainText('N/A: 15')
    const otr3 = page.getByTestId('otr-3')
    await expect(otr3).toContainText('Above: 5')
    await expect(otr3).toContainText('Atas Landasan: 2')
    await expect(otr3).toContainText('Bawah: 8')
    await expect(otr3).toContainText('N/A: 0')
    await expect(otr3.locator('[title="Above: 5"]')).toHaveCount(1)
    await expect(otr3.locator('[title^="N/A"]')).toHaveCount(0)
    await expect(page.getByTestId('legend')).toHaveText(
      /Melebihi Sasaran\s*Atas Landasan \(±2%\)\s*Bawah Sasaran\s*Belum Diisi/,
    )
    await expectNoHorizontalScroll(page)
  })

  test('S23 config 213: 7 Atas Landasan / 8 Below, 15 rows and the class averages', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/213')
    await expect(page.getByTestId('headcount-table-page')).toBeVisible()
    await expectTabTitle(page, 'Headcount Sejarah - PRESTASIPLUS')
    await expect(page.getByTestId('table-subtitle')).toContainText(
      '4 Simulasi · Tingkatan 4 · 2026 · Guru: Guru Demo KL-01',
    )
    await expect(page.getByTestId('chip-on')).toHaveText('Atas Landasan: 7 (47%)')
    await expect(page.getByTestId('chip-below')).toHaveText('Bawah: 8 (53%)')
    await expect(page.getByTestId('chip-empty')).toHaveText('Belum Diisi: 0')
    await expect(page.getByTestId('chip-total')).toHaveText('Jumlah: 15')
    await expect(page.locator('[data-testid^=row-]')).toHaveCount(15)
    const average = page.getByTestId('average-row')
    for (const v of ['62.1', '67.1', '72.1', '77.1', '71.9']) await expect(average).toContainText(v)
    await expectNoHorizontalScroll(page)
  })

  test('S23 config 617 lists 30 pupils without any AR', async ({ page, gotoApp }) => {
    await gotoApp('/headcount/617')
    await expect(page.getByTestId('headcount-table-page')).toBeVisible()
    await expect(page.getByTestId('chip-total')).toHaveText('Jumlah: 30')
    await expect(page.getByTestId('chip-empty')).toHaveText('Belum Diisi: 30')
    await expect(page.locator('[data-testid^=row-]')).toHaveCount(30)
    await expectNoHorizontalScroll(page)
  })

  test('S15 pupil 3201: the RS badge, the Menurun trend and the "+0.4" prediction', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/student/3201')
    await expect(page.getByTestId('headcount-student-page')).toBeVisible()
    const s = page.getByTestId('section-213')
    await expect(s.getByRole('heading', { name: 'Sejarah' })).toBeVisible()
    await expect(s.getByTestId('rs-badge')).toHaveText(/RS: 56\.4% \(C\+\)/)
    await expect(s.getByTestId('chip-trend')).toHaveText('Menurun')
    await expect(s.getByTestId('row-rs')).toContainText('Direkod: 13 Apr 2026')
    await expect(s.getByTestId('selisih')).toHaveText('Selisih: +0.4 markah')
    await expect(s.getByTestId('verdict')).toHaveText('Ramalan Tepat')
    await expectNoHorizontalScroll(page)
  })
})

// ---------------------------------------------------------------------------------------------
// Admin Sekolah (account 8)
// ---------------------------------------------------------------------------------------------

test.describe('M08 T6 Admin Sekolah (account 8)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.describe.configure({ timeout: 150_000 })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs(8)
  })

  test(
    'S12 is the own-school admin view: the empty state with "Buat Sekarang"',
    provisional('OD-R3: the school admin view of S12 is INFERRED'),
    async ({ page, gotoApp }) => {
      await gotoApp('/headcount')
      await expect(page.getByTestId('headcount-empty')).toContainText('Belum ada headcount.')
      await expect(page.getByTestId('headcount-create-now')).toBeVisible()
      await expectTabTitle(page, 'Headcount - PRESTASIPLUS')
      await expectNoHorizontalScroll(page)
      await gotoApp('/headcount/dashboard')
      await expect(page.getByTestId('dashboard-empty')).toBeVisible()
      await gotoApp('/headcount/create')
      await expect(page.getByTestId('create-form')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'a config and a pupil of the own school open; those of another school are the 403 page',
    provisional('OD-R3: the school admin scope is INFERRED'),
    async ({ page, gotoApp }) => {
      await gotoApp('/headcount/501')
      await expect(page.getByTestId('chip-total')).toHaveText('Jumlah: 8')
      await expectNoHorizontalScroll(page)
      await gotoApp('/headcount/501/summary')
      await expect(page.getByTestId('card-students')).toHaveText('8')
      await gotoApp('/headcount/student/3001')
      await expect(page.getByTestId('student-name')).toHaveText('Murid Demo 01')
      await gotoApp('/headcount/213')
      await expectForbidden(page)
      await gotoApp('/headcount/213/summary')
      await expectForbidden(page)
      await gotoApp('/headcount/617')
      await expectForbidden(page)
      await gotoApp('/headcount/student/3201')
      await expectForbidden(page)
      await gotoApp('/headcount/99999999')
      await expectNotFound(page)
    },
  )
})

// ---------------------------------------------------------------------------------------------
// Pelajar and guest
// ---------------------------------------------------------------------------------------------

test.describe('M08 T6 pelajar (account 2)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.describe.configure({ timeout: 150_000 })

  test(
    'every headcount page is the standalone 403 page',
    provisional('FR-M08-08 / OD-R3: the pelajar 403 is PROPOSED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(2)
      for (const path of [
        '/headcount',
        '/headcount/dashboard',
        '/headcount/create',
        '/headcount/501',
        '/headcount/student/3001',
      ]) {
        await gotoApp(path)
        await expectForbidden(page)
        await expectNoHorizontalScroll(page)
      }
    },
  )
})

test.describe('M08 T6 guest', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.describe.configure({ timeout: 150_000 })

  for (const path of ['/headcount', '/headcount/dashboard', '/headcount/501']) {
    test(`${path} goes to /login without a session`, async ({ page, gotoApp }) => {
      await gotoApp(path)
      await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    })
  }
})
