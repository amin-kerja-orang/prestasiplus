/**
 * M08-T5 developer E2E (build-plan M08-T5; QA writes the final E2E-M08-* at G5): the Prestasi screens
 * S1 `/prestasi/sekolah`, S2 `/prestasi/tingkatan`, S3 `/prestasi/tingkatan/{t4|t5}`, S4 `/prestasi/kelas`,
 * S9 `/analisa-item/sekolah[/{id}]`, S10 `/analisa-item/kelas`, S11 `/analisa-item/kelas/{id}`, S21
 * `/laporan-mingguan` and the `/analisa-item` redirect, as the demo admin, pelajar (account 2) and Admin
 * Sekolah (account 8) at 375 / 768 / 1280: the §6.10 anchors visible on these screens, the 403 / 404 /
 * redirect behaviour, titles and no horizontal page scroll. Headcount figures (GPS, On Track / Below,
 * at-risk rows) are M08-T1b's and are not asserted here.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag } from '../support'

const FORBIDDEN_TITLE = 'Akses Ditolak | PRESTASIPLUS'
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

/** Header of the EXPECTED shell: Admin Pusat = Pentadbiran; pupil, teacher and school admin = Pembelajaran. */
const header = (page: Page, shell: 'pembelajaran' | 'pentadbiran') => ({
  title: page.locator(`[data-testid=${shell}-header] :is(h1, [data-testid=shell-title])`),
  subtitle: page.getByTestId(`${shell}-subtitle`),
})

/** The table row (or card) around an element carrying a row testid on its name cell. */
const rowOf = (page: Page, testid: string) =>
  page.getByTestId(testid).locator('xpath=ancestor::*[self::tr or self::li][1]')

/** The value of each tile of a DsStatRow, in order. */
const statValues = (page: Page) =>
  page.locator('[data-testid=stat-cards] li span.tabular:not([data-ds=stat-tile-delta])')

async function expectForbidden(page: Page): Promise<void> {
  await expect(page.locator('[data-page=forbidden]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Akses Ditolak' })).toBeVisible()
  await expectTabTitle(page, FORBIDDEN_TITLE)
}

async function expectNotFound(page: Page): Promise<void> {
  await expect(page.locator('[data-page=not-found]')).toBeVisible()
  await expectTabTitle(page, NOT_FOUND_TITLE)
}

test.describe('M08 T5 admin', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  test('S1 /prestasi replaces to /prestasi/sekolah; platform figures and level cards', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi')
    await expect(page.getByTestId('prestasi-sekolah-page')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/prestasi/sekolah')
    await expectTabTitle(page, 'Dashboard Sekolah | PRESTASIPLUS')
    await expect(header(page, 'pentadbiran').title).toHaveText('Dashboard Sekolah')
    await expect(header(page, 'pentadbiran').subtitle).toHaveText('Selamat datang kembali')

    await expect(page.getByTestId('header-summary')).toHaveText(
      'Ringkasan prestasi keseluruhan · 750 kelas · 4533 murid',
    )
    await expect(statValues(page)).toHaveText([
      '4533',
      '551',
      '750',
      '27',
      '32122',
      '478,499',
      '79.8%',
    ])

    // DV-M08-05: the level cards equal the S2 / S3 aggregate.
    await expect(page.getByTestId('level-card-t4')).toContainText('63.9%')
    await expect(page.getByTestId('level-card-t4')).toContainText('13 kelas')
    await expect(page.getByTestId('level-card-t4')).toContainText('149 murid')
    await expect(page.getByTestId('level-card-t4')).toContainText('11 sesi latihan')
    await expect(page.getByTestId('level-card-t5')).toContainText('79.7%')
    await expect(page.getByTestId('level-card-t5')).toContainText('645 kelas')
    await expect(page.getByTestId('level-card-t5')).toContainText('3911 murid')

    // Headcount figures of M08-T1b: "—" and 0 until they exist, never an invented number.
    await expect(page.getByTestId('trend-row-2022')).toContainText('5.20')
    await expect(page.getByTestId('trend-row-2025')).toContainText('▼ 0.20')
    await expect(page.getByTestId('trend-row-2026')).toContainText('Semasa')
    await expect(page.getByTestId('gps-trend-chart')).toBeVisible()
    await expect(page.getByTestId('quick-nav').getByRole('link')).toHaveCount(4)

    await expectNoHorizontalScroll(page)
  })

  test('S1 teacher box scrolls inside itself and links go to S2, S4 and S9', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/sekolah')
    await expect(page.getByTestId('teachers-list')).toBeVisible()
    const box = await page.getByTestId('teachers-list').evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      max: getComputedStyle(el).maxHeight,
    }))
    expect(box.overflowY).toBe('auto')
    expect(box.max).toBe('384px')
    await expect(page.getByTestId('quick-nav').getByRole('link').nth(3)).toHaveAttribute(
      'href',
      // The id-less S9 is the viewer's own school and refuses the admin, so the admin's link goes to S10 (PrestasiSekolahPage.vue:55-56, SW5-15).
      '/analisa-item/kelas',
    )
    await page.getByRole('link', { name: 'Tingkatan', exact: true }).first().click()
    await expect(page.getByTestId('tingkatan-pilih-page')).toBeVisible()
  })

  test('S2 two level cards', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/tingkatan')
    await expect(page.getByTestId('level-link-t4')).toBeVisible()
    await expectTabTitle(page, 'Dashboard Tingkatan | PRESTASIPLUS')
    await expect(header(page, 'pentadbiran').title).toHaveText('Dashboard Tingkatan')
    await expect(header(page, 'pentadbiran').subtitle).toHaveText(
      'Pilih tingkatan untuk lihat prestasi keseluruhan',
    )
    await expect(page.getByTestId('level-link-t4')).toContainText('Tingkatan 4')
    await expect(page.getByTestId('level-link-t4')).toContainText('13 kelas | 149 murid')
    await expect(page.getByTestId('level-link-t5')).toContainText('645 kelas | 3911 murid')
    await expectNoHorizontalScroll(page)
    await page.getByTestId('level-link-t4').click()
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
  })

  test('S3 T4: cards, 13 class rows without a link on school classes, top students', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/tingkatan/t4')
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
    await expectTabTitle(page, 'Tingkatan 4 | PRESTASIPLUS')
    await expect(header(page, 'pentadbiran').title).toHaveText('Tingkatan 4')
    await expect(header(page, 'pentadbiran').subtitle).toHaveText('Dashboard Prestasi Tingkatan')
    await expect(page.getByTestId('level-summary')).toHaveText(
      'Dashboard Prestasi Tingkatan · 13 kelas · 5 subjek',
    )
    await expect(page.getByTestId('stat-kelas')).toContainText('13')
    await expect(page.getByTestId('stat-murid')).toContainText('149')
    await expect(page.getByTestId('stat-ketepatan')).toContainText('63.9%')
    await expect(page.getByTestId('stat-sesi')).toContainText('11')

    await expect(page.locator('[data-testid^=class-row-]')).toHaveCount(13)
    await expect(rowOf(page, 'class-row-5')).toContainText('4 Cemerlang - BM')
    await expect(rowOf(page, 'class-row-5')).toContainText('53')
    await expect(rowOf(page, 'class-row-5')).toContainText('51%')
    await expect(rowOf(page, 'class-row-6')).toContainText('82%')
    await expect(rowOf(page, 'class-row-516')).toContainText('4 Simulasi')
    await expect(rowOf(page, 'class-row-516')).toContainText('Tiada Subjek')
    // Removed: the 'Kelas Sekolah' last row without a link; TingkatanPage.vue no longer renders a school-class row, every class row has 'Lihat'.
    await expect(rowOf(page, 'class-row-516').getByRole('link')).toHaveCount(1)

    await expect(page.getByTestId('top-students')).toContainText('3 sesi · 30 soalan')
    await expect(page.getByTestId('top-students')).toContainText('93%')
    await expect(page.getByTestId('top-students')).toContainText('4 sesi · 60 soalan')
    await expect(page.getByTestId('top-students')).toContainText('64%')

    // The class table scrolls inside its card, not the page.
    await expectNoHorizontalScroll(page)
  })

  test('S3 T5 and the T4 / T5 pills', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/tingkatan/t5')
    await expect(page.getByTestId('stat-murid')).toContainText('3911')
    await expect(page.getByTestId('stat-ketepatan')).toContainText('79.7%')
    await expect(page.getByTestId('pill-t5')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('pill-t4')).toHaveAttribute('data-active', 'false')
    await page.getByTestId('pill-t4').click()
    await expect(page.getByTestId('stat-murid')).toContainText('149')
    await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/prestasi/tingkatan')
    await expectNoHorizontalScroll(page)
  })

  test('S3 an unknown level code is the 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/tingkatan/t9')
    await expectNotFound(page)
  })

  test('S4 the admin owns no class: the observed empty state', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas')
    await expect(page.getByTestId('kelas-empty')).toBeVisible()
    await expectTabTitle(page, 'Prestasi Kelas | PRESTASIPLUS')
    await expect(header(page, 'pentadbiran').title).toHaveText('Prestasi Kelas')
    await expect(page.getByTestId('kelas-empty')).toContainText('Anda belum mempunyai kelas aktif.')
    await expect(page.getByTestId('kelas-empty')).toContainText(
      'Cipta kelas terlebih dahulu untuk mula memantau prestasi murid.',
    )
    await expect(page.getByTestId('kelas-create')).toHaveAttribute('href', '/guru/kelas/cipta')
    await expectNoHorizontalScroll(page)
  })

  test('/analisa-item redirects the admin to S10 with the first three observed cards', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item')
    await expect(page.getByTestId('analisa-item-kelas-pilih-page')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/analisa-item/kelas')
    await expectTabTitle(page, 'Analisa Item | PRESTASIPLUS')
    await expect(header(page, 'pentadbiran').title).toHaveText('Analisa Item')
    await expect(header(page, 'pentadbiran').subtitle).toHaveText(
      'Analisis tahap kesukaran dan diskriminasi soalan mengikut kelas',
    )
    // The page title 'Pilih Kelas untuk Analisis' is now the shell header text 'Analisa Item' asserted above.
    await expect(page.getByTestId('class-grid')).toBeVisible()

    const cards = page.getByTestId('class-grid').locator('> a')
    await expect(cards.nth(0)).toContainText('5 CYBER')
    await expect(cards.nth(0)).toContainText('JOV330')
    await expect(cards.nth(0)).toContainText('1 pelajar')
    await expect(cards.nth(1)).toContainText('sains rumah tangga')
    await expect(cards.nth(1)).toContainText('0VV295')
    await expect(cards.nth(2)).toContainText('Chaos Academy')
    await expect(cards.nth(2)).toContainText('PVZ601')
    // Status shown as the DS badge 'Aktif' (ClassPickCard.vue, D28-D32), not the V2 tooltip dot (analisa-item-kelas.blade.php:43).
    await expect(cards.nth(0).getByText('Aktif', { exact: true })).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test('S11 class 2001: summary, hardest first, row detail, search, sort, discrimination', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/kelas/2001')
    await expect(page.getByTestId('analisa-item-kelas-page')).toBeVisible()
    await expect(page.getByTestId('class-name')).toHaveText('5 MARIKH - Kimia')
    await expect(page.getByTestId('class-students')).toHaveText('8')
    await expect(page.getByTestId('class-questions')).toHaveText('8')

    await expect(page.getByTestId('summary-mudah')).toContainText('1')
    await expect(page.getByTestId('summary-mudah')).toContainText('13% daripada soalan')
    await expect(page.getByTestId('summary-sederhana')).toContainText('50% daripada soalan')
    await expect(page.getByTestId('summary-sukar')).toContainText('38% daripada soalan')

    const rows = page.locator('[data-testid^=difficulty-row-]')
    await expect(rows).toHaveCount(8)
    // Q4 25.0% / 0.75 Sukar is the hardest after the two 0.88 rows.
    const q4 = rowOf(page, 'difficulty-row-700004')
    const q4Toggle = page.getByTestId('difficulty-toggle-700004')
    await expect(q4).toContainText('25%')
    await expect(q4).toContainText('0.75')
    await expect(q4).toContainText('Sukar')
    await q4Toggle.click()
    await expect(page.getByTestId('difficulty-detail-700004')).toContainText('Jawapan Betul')
    await expect(page.getByTestId('difficulty-detail-700004')).toContainText('Pelajar Yang Salah')
    await q4Toggle.click()
    await expect(page.getByTestId('difficulty-detail-700004')).toHaveCount(0)

    await page.getByTestId('difficulty-search').fill('siri homolog')
    await expect(rows).toHaveCount(2)
    await page.getByTestId('difficulty-search').fill('tiada padanan')
    await expect(rows).toHaveCount(0)
    await page.getByTestId('difficulty-search').fill('')
    await page.getByTestId('difficulty-sort').click()
    await page.getByRole('option', { name: 'Paling Mudah Dahulu', exact: true }).click()
    await expect(rows.first().locator('xpath=ancestor::*[self::tr or self::li][1]')).toContainText('Mudah')

    await page.getByTestId('tab-discrimination').click()
    await expect(page.getByTestId('discrimination-guide')).toContainText(
      'Panduan Indeks Diskriminasi',
    )
    await expect(page.getByTestId('discrimination-table')).toBeVisible()
    // §6.10: D of Q1, Q7 and Q8 = 1.00, Q5 = -0.50 (two decimals, lib/prestasi/item-analysis.ts index2).
    await expect(rowOf(page, 'discrimination-row-700001')).toContainText('1.00')
    await expect(rowOf(page, 'discrimination-row-700005')).toContainText('-0.50')

    await expect(page.getByTestId('switch-2001')).toHaveAttribute('data-active', 'true')
    await expectNoHorizontalScroll(page)
  })

  test('S11 class 6 has no answers', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas/6')
    await expect(page.getByTestId('difficulty-empty')).toContainText('Tiada Data Lagi')
    await expect(page.getByTestId('summary-pct')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('S11 class 2002 has too few students for discrimination', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas/2002')
    await page.getByTestId('tab-discrimination').click()
    await expect(page.getByTestId('discrimination-insufficient')).toContainText(
      'Data Tidak Mencukupi',
    )
    await expectNoHorizontalScroll(page)
  })

  test('S11 an unknown class id is the 403 page', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas/99999999')
    await expectForbidden(page)
  })

  test('S9 id-less (own school) is the 403 page for the admin, who has no school (SW5-15, DV-M08-50)', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/sekolah')
    await expectForbidden(page)
    await expectNoHorizontalScroll(page)
  })

  test('S9 /8880 shows the observed template: 59 pupils, 10,194 answers, 71.7%, subject rows', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah/8880')
    await expect(page.getByTestId('school-card')).toBeVisible()
    await expect(page.getByTestId('school-name')).toContainText('KLUANG')
    await expect(page.getByTestId('school-card')).toContainText('JEB2037')
    await expect(page.getByTestId('school-card')).toContainText('PPD KLUANG • Johor')
    await expect(page.getByTestId('school-students')).toHaveText('59')
    await expect(page.getByTestId('school-answers')).toHaveText('10,194')
    await expect(page.getByTestId('stat-pelajar')).toContainText('59')
    await expect(page.getByTestId('stat-soalan')).toContainText('10,194')
    await expect(page.getByTestId('stat-ketepatan')).toContainText('71.7%')
    await expect(page.getByTestId('diff-mudah')).toContainText('0')
    await expect(page.getByTestId('diff-sukar')).toContainText('20')

    const subjects = page.getByTestId('subject-table').locator('tbody tr')
    await expect(subjects.first()).toContainText('Sains')
    await expect(subjects.first()).toContainText('29')
    await expect(subjects.first()).toContainText('1,094')
    await expect(subjects.first()).toContainText('71%')
    await expect(subjects.first()).toContainText('539')
    await expect(subjects.last()).toContainText('Matematik')
    await expect(subjects.last()).toContainText('614')

    // GPS comes from M08-T1b: "—" until it exists, never 0.
    await expect(page.getByTestId('school-gps-card')).toContainText('Berdasarkan')
    // The Prestasi 360 school link is rendered only when /sekolah/{id}/prestasi exists (AnalisaItemSekolahPage.vue:320); it is not an R1 route.
    await expect(page.getByRole('link', { name: 'Prestasi 360' })).toHaveCount(0)

    // Question list: 20 cards, client-side filter, toggle.
    await expect(page.getByTestId('question-list').locator('> li')).toHaveCount(20)
    await expect(page.getByTestId('filter-all')).toContainText('Semua (20)')
    // BUG-05: the subject pills are alphabetical, as live.
    await expect(page.getByTestId('question-filters').locator('button')).toHaveText([
      'Semua (20)',
      'Bahasa Melayu (13)',
      'Sains (6)',
      'Sejarah (1)',
    ])
    await expectNoHorizontalScroll(page)
  })

  test('S9 /8880?tingkatan=T4 keeps the observed 76.3% and the level subtitle; an unknown value filters nothing', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah/8880?tingkatan=T4')
    await expect(page.getByTestId('stat-pelajar')).toBeVisible()
    await expect(header(page, 'pentadbiran').subtitle).toContainText('— Tingkatan 4')
    await expect(page.getByRole('link', { name: 'Tingkatan 4' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('stat-ketepatan')).toContainText('76.3%')
    await expectNoHorizontalScroll(page)
    await gotoApp('/analisa-item/sekolah/8880?tingkatan=T9')
    await expect(page.getByTestId('stat-ketepatan')).toContainText('71.7%')
    await expect(page.getByRole('link', { name: 'Semua' })).not.toHaveAttribute('aria-current', 'page')
  })

  test('S9 an unknown school id shows the by-id empty state, not a 404', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah/999999')
    await expect(page.getByTestId('school-empty')).toBeVisible()
    await expect(page.getByTestId('school-empty')).toContainText('Tiada Data Pelajar')
    await expect(page.getByTestId('school-empty')).toContainText('menjawab soalan.')
    await expect(page.getByTestId('school-empty')).not.toContainText('soalan latihan')
    await expect(page.getByTestId('school-card')).toHaveCount(0)
    await expect(page.locator('[data-page=not-found]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('S9 /8765 shows the observed constants and the question filter pills work', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah/8765')
    await expect(page.getByTestId('stat-ketepatan')).toContainText('83.8%')
    await expect(page.getByTestId('diff-mudah')).toContainText('5')
    await expect(page.getByTestId('diff-sukar')).toContainText('1')
    const all = page.getByTestId('filter-all')
    await expect(all).toContainText('Semua (6)')
    const cards = page.getByTestId('question-list').locator('> li')
    await expect(cards).toHaveCount(6)
    const pills = page.getByTestId('question-filters').locator('button')
    await pills.nth(1).click()
    expect(await cards.count()).toBeLessThan(6)
    await all.click()
    await expect(cards).toHaveCount(6)
    const first = cards.first()
    await first.locator('button').first().click()
    await expect(first.getByText('Jawapan Betul')).toBeVisible()
    await first.locator('button').first().click()
    await expect(first.getByText('Jawapan Betul')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('S21 /laporan-mingguan is the 403 page for the admin, with any query', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/laporan-mingguan?week=2026-09-21')
    await expectForbidden(page)
    await expect(page.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
    await expect(page.getByRole('link', { name: 'Log Masuk' })).toHaveAttribute('href', '/login')
    await expectNoHorizontalScroll(page)
  })

  test('paths that do not exist are the 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/pelajar')
    await expectNotFound(page)
    await gotoApp('/analisa-item/12345')
    await expectNotFound(page)
  })
})

test.describe('M08 T5 pelajar (account 2)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs(2)
  })

  test('S1 /prestasi stays the pupil own Prestasi 360 (FR-MUR-4-13); there is no school view for a pelajar', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi')
    await expect(page.getByTestId('prestasi360-page')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/prestasi')
    await gotoApp('/prestasi/sekolah')
    await expectForbidden(page)
    await expectNoHorizontalScroll(page)
  })

  test('S4 is the 403 page for a pelajar (PRESTASI_CLASS_ROLES excludes the pupil, FR-MUR-4-2)', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas')
    await expectForbidden(page)
  })

  test('S10 and S11 are the 403 page', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas')
    await expectForbidden(page)
    await gotoApp('/analisa-item/kelas/2001')
    await expectForbidden(page)
    await expectNoHorizontalScroll(page)
  })

  test('S21 is the 403 page', async ({ page, gotoApp }) => {
    await gotoApp('/laporan-mingguan')
    await expectForbidden(page)
  })

  test('S9 own school and another school are both the 403 page for a pelajar (ANALISA_SEKOLAH_OWN_ROLES excludes the pupil)', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/sekolah')
    await expectForbidden(page)
    await gotoApp('/analisa-item/sekolah/8880')
    await expectForbidden(page)
    await expectNoHorizontalScroll(page)
  })

  test('/analisa-item stays on the pelajar own Analisa Item page (analisa-item.ts: the pupil is not redirected)', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item')
    await expect(page.getByTestId('analisa-item-murid-page')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/analisa-item')
  })
})

test.describe('M08 T5 Admin Sekolah (account 8)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs(8)
  })

  // 10 pupils of SMK Demo = 3001-3008 (the members of 2001 / 2002) + accounts 2 and 4 (src/mock/core-data/accounts.ts:109, :129).
  test('S1 own school: 2 kelas · 10 murid · 1 guru', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi')
    await expect(page.getByTestId('prestasi-sekolah-page')).toBeVisible()
    await expect(page.getByTestId('header-summary')).toHaveText(
      'Ringkasan prestasi keseluruhan · 2 kelas · 10 murid',
    )
    const values = statValues(page)
    await expect(values.nth(0)).toHaveText('10')
    await expect(values.nth(1)).toHaveText('1')
    await expect(values.nth(2)).toHaveText('2')
    await expect(page.getByTestId('teachers-list').locator('> li')).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test('S2 and S3 are scoped to the own school', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/tingkatan')
    await expect(page.getByTestId('level-link-t5')).toContainText('2 kelas | 8 murid')
    await expect(page.getByTestId('level-link-t4')).toContainText('0 kelas | 0 murid')
    await gotoApp('/prestasi/tingkatan/t5')
    await expect(page.locator('[data-testid^=class-row-]')).toHaveCount(2)
    await expectNoHorizontalScroll(page)
  })

  test('/analisa-item redirects to S9 with the own school (10 pupils)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item')
    await expect(page.getByTestId('school-card')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/analisa-item/sekolah')
    await expect(page.getByTestId('school-students')).toHaveText('10')
    await expect(header(page, 'pembelajaran').title).toHaveText('Analisa Item — Sekolah')
    await expectNoHorizontalScroll(page)
  })

  test('S10 and S11 are the 403 page for the school admin', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas')
    await expectForbidden(page)
    await gotoApp('/analisa-item/kelas/2001')
    await expectForbidden(page)
  })

  test('S9 of another school is the 403 page', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/sekolah/8880')
    await expectForbidden(page)
  })

  test('S21 is the 403 page', async ({ page, gotoApp }) => {
    await gotoApp('/laporan-mingguan')
    await expectForbidden(page)
  })
})

test.describe('M08 T5 guest', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const path of [
    '/prestasi',
    '/prestasi/tingkatan',
    '/prestasi/kelas',
    '/analisa-item',
    '/analisa-item/sekolah',
    '/analisa-item/kelas',
    '/laporan-mingguan',
  ]) {
    test(`${path} goes to /login without a session`, async ({ page, gotoApp }) => {
      await gotoApp(path)
      await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    })
  }
})
