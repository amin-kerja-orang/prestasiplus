/**
 * M08-T7 developer E2E (QA writes the final E2E-M08-* at G5): S5 `/prestasi/kelas/{id}`, S8
 * `/analitik/kelas` and the teacher variants of S4 `/prestasi/kelas`, S10 `/analisa-item/kelas` and S11
 * `/analisa-item/kelas/{id}`, as guru (account 5), the demo admin and pelajar (403 / 404) at 375 / 768 /
 * 1280: the §6.10 anchors of class 2001 (S5 8 · 42.6% · 11 · 68 · 6.1m · 6, block 0 / 1 / 7; S8 8 · 41.8% ·
 * 4 · 1) and the observed class 4 profiles, titles, selects and no horizontal page scroll.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag } from '../support'

const FORBIDDEN_TITLE = 'Akses Ditolak | PRESTASIPLUS'
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

const header = (page: Page) => ({
  title: page.locator('[data-testid=pembelajaran-header] :is(h1, [data-testid=shell-title])'),
  subtitle: page.getByTestId('pembelajaran-subtitle'),
})

/** The value of each tile of a DsStatRow, in order (the value span is the tabular number of the tile). */
const statValues = (page: Page) =>
  page.locator('[data-testid=stat-cards] li span.tabular:not([data-ds=stat-tile-delta])')

/** The risk badge of a pupil: the `student-row-{id}` testid sits on the name link, the badge in its table row. */
const riskBadge = (page: Page, userId: number) =>
  page.locator('[data-testid=student-table] tbody tr').filter({ has: page.getByTestId(`student-row-${userId}`) }).getByTestId('risk-badge')

/** The ranking table row of a pupil: `rank-row-{id}` sits on the name span inside the row. */
const rankRow = (page: Page, userId: number) =>
  page.locator('[data-testid=ranking-card] tbody tr').filter({ has: page.getByTestId(`rank-row-${userId}`) })

/** Items of a Nuxt UI select (opens the listbox, reads the options, closes it). */
async function selectItems(page: Page, testid: string): Promise<string[]> {
  await page.getByTestId(testid).click()
  const options = page.getByRole('option')
  await page.waitForTimeout(300)
  const texts = (await options.allTextContents()).map((t) => t.trim())
  await page.keyboard.press('Escape')
  return texts
}

async function pickItem(page: Page, testid: string, label: string): Promise<void> {
  await page.getByTestId(testid).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

test.describe('M08 T7 guru', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('guru@demo.test')
  })

  test('S4 lists the two own classes and opens S5', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas')
    await expect(page.getByTestId('kelas-list')).toBeVisible()
    await expectTabTitle(page, 'Prestasi Kelas | PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Prestasi Kelas')
    await expect(page.locator('[data-testid^=class-card-]')).toHaveCount(2)
    await expect(page.getByTestId('class-card-2001')).toContainText('5 MARIKH - Kimia')
    await expect(page.getByTestId('class-card-2001')).toContainText('8 pelajar')
    await expectNoHorizontalScroll(page)
    await page.getByTestId('class-card-2001').click()
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/prestasi/kelas/2001')
  })

  test('S5 class 2001: header, 6 stats, headcount block, attention and ranking anchors', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/kelas/2001')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    await expectTabTitle(page, '5 MARIKH - Kimia — Dashboard Kelas | PRESTASIPLUS')
    await expect(header(page).title).toHaveText('5 MARIKH - Kimia')
    // FR-M08-31: "{sekolah} · {subjek} · {tahun} · Kod: {joinCode}" (C-47). Two nodes carry class-sub (page subtitle and the shell line): the first is the in-page one.
    await expect(header(page).subtitle).toContainText('· Kimia · 2026')
    await expect(page.getByTestId('class-sub').first()).toContainText('· Kimia · 2026 · Kod: DMO101')
    await expect(page.getByTestId('class-code')).toHaveText('DMO101')
    await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/prestasi/kelas')

    // V2 shows whole percents on the class card and the student rows (TeacherController.php:817, :75, :749).
    await expect(statValues(page)).toHaveText(['8', '43%', '11', '68', '6.1m', '6'])

    await expect(page.getByTestId('hc-on')).toHaveText(/^0\s*On Track \/ Above$/)
    await expect(page.getByTestId('hc-below')).toHaveText(/^1\s*Below Target$/)
    await expect(page.getByTestId('hc-none')).toHaveText(/^7\s*Tiada Data$/)
    await expect(page.getByTestId('hc-tov')).toHaveText('Purata TOV: 50%')
    await expect(page.getByTestId('hc-etr')).toHaveText('Purata ETR: 65%')
    await expect(page.getByTestId('hc-full')).toHaveAttribute('href', '/headcount/504/summary')

    await expect(page.getByTestId('attention-count')).toHaveText('(6)')
    await expect(page.locator('[data-testid^=attention-3]')).toHaveCount(6)
    await expect(page.getByTestId('attention-3008')).toContainText('1 sesi · 13% ketepatan')
    await expect(page.getByTestId('attention-3008')).toHaveAttribute('href', '/prestasi/3008')

    await expect(page.getByTestId('class-trend-chart')).toBeVisible()
    await expect(page.locator('[data-testid^=rank-row-]')).toHaveCount(8)
    await expect(rankRow(page, 3001)).toContainText('89%')
    await expect(rankRow(page, 3001).getByTestId('rank-badge')).toHaveText('Below')
    await expect(rankRow(page, 3002).getByTestId('rank-badge')).toHaveText('N/A')
    await expect(rankRow(page, 3008)).toContainText('13%')
    await expectNoHorizontalScroll(page)
  })

  test('S5 the class select switches class', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas/2001')
    await expect(page.getByTestId('switch-class')).toBeVisible()
    await pickItem(page, 'switch-class', '5 MARIKH - Sejarah')
    await expect(page).toHaveURL(/\/prestasi\/kelas\/2002$/)
    await expect(page.getByTestId('class-name')).toHaveText('5 MARIKH - Sejarah')
    await expect(page.getByTestId('stat-sesi')).toContainText('3')
  })

  test('S5 a class of another teacher and an unknown class are the 404 page', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/kelas/228')
    await expect(page.locator('[data-page=not-found]')).toBeVisible()
    await expectTabTitle(page, NOT_FOUND_TITLE)
    await gotoApp('/prestasi/kelas/99999999')
    await expect(page.locator('[data-page=not-found]')).toBeVisible()
  })

  test('S8 class 2001 / Kimia: cards 8 · 42.6% · 7 · 1 and the risk badges', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analitik/kelas?classroom_id=2001&subject_id=10')
    await expect(page.getByTestId('analitik-kelas-page')).toBeVisible()
    await expectTabTitle(page, 'Analitik Kelas | PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Analitik Kelas')
    await expect(header(page).subtitle).toHaveText(
      'Pantau prestasi pelajar dan kenal pasti yang memerlukan perhatian',
    )
    await expect(page.getByTestId('sum-pelajar')).toContainText('8')
    await expect(page.getByTestId('sum-ketepatan')).toContainText('42.6%')
    await expect(page.getByTestId('sum-berisiko')).toContainText('7')
    await expect(page.getByTestId('sum-baik')).toContainText('1')
    await expect(page.locator('[data-testid^=student-row-]')).toHaveCount(8)
    await expect(riskBadge(page, 3007)).toHaveText(
      'Kritikal',
    )
    await expect(riskBadge(page, 3004)).toHaveText(
      'Kritikal',
    )
    await expect(riskBadge(page, 3001)).toHaveText(
      'Rendah',
    )
    await expectNoHorizontalScroll(page)
  })

  test('S8 the risk select submits on change and keeps the URL filters', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analitik/kelas?classroom_id=2001&subject_id=10')
    // V2 "Semua Kelas" + the two own classes.
    expect(await selectItems(page, 'filter-kelas')).toEqual([
      'Semua Kelas',
      '5 MARIKH - Kimia',
      '5 MARIKH - Sejarah',
    ])
    await pickItem(page, 'filter-risiko', 'Kritikal')
    await expect(page.locator('[data-testid^=student-row-]')).toHaveCount(6)
    const q = new URL(page.url()).searchParams
    expect(q.get('classroom_id')).toBe('2001')
    expect(q.get('subject_id')).toBe('10')
    expect(q.get('risk_level')).toBe('critical')
  })

  test('S8 without parameters shows the first own class', async ({ page, gotoApp }) => {
    await gotoApp('/analitik/kelas')
    await expect(page.getByTestId('student-table')).toBeVisible()
  })

  test('S8 a class of another teacher is the 403 page', async ({ page, gotoApp }) => {
    await gotoApp('/analitik/kelas?classroom_id=4')
    await expect(page.locator('[data-page=forbidden]')).toBeVisible()
    await expectTabTitle(page, FORBIDDEN_TITLE)
  })

  test('S10 and S11 teacher variants: own classes only; another class is 403', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item')
    await expect(page.getByTestId('analisa-item-kelas-pilih-page')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/analisa-item/kelas')
    await expectTabTitle(page, 'Analisa Item | PRESTASIPLUS')
    await expect(page.getByTestId('class-grid').locator('> a')).toHaveCount(2)
    await expectNoHorizontalScroll(page)
    await page.getByTestId('class-card-2001').click()
    await expect(page.getByTestId('analisa-item-kelas-page')).toBeVisible()
    await expect(page.getByTestId('class-name')).toHaveText('5 MARIKH - Kimia')
    await expect(page.locator('[data-testid^=switch-2]')).toHaveCount(2)
    await expectNoHorizontalScroll(page)
    await gotoApp('/analisa-item/kelas/228')
    await expect(page.locator('[data-page=forbidden]')).toBeVisible()
  })
})

test.describe('M08 T7 admin', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  test('S5 class 4: zeros, every member inactive, no headcount block, empty trend, empty select', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/kelas/4')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    await expect(page.getByTestId('class-sub').first()).toContainText('Bahasa Melayu · 2026')
    await expect(page.getByTestId('class-sub').first()).toContainText('Kod: KCC904')
    await expect(page.getByTestId('class-code')).toHaveText('KCC904')
    await expect(statValues(page)).toHaveText(['58', '0%', '0', '0', '0m', '0'])
    await expect(page.getByTestId('attention-count')).toHaveText('(58)')
    await expect(page.getByTestId('trend-empty')).toContainText(
      'Belum ada aktiviti dalam 30 hari terakhir.',
    )
    await expect(page.getByTestId('headcount-block')).toHaveCount(0)
    expect(await selectItems(page, 'switch-class')).toEqual([])
    // 25 rows per page (DsDataTable pager); the pager holds the 58 members.
    await expect(page.locator('[data-testid^=rank-row-]')).toHaveCount(25)
    await expect(page.getByTestId('ranking-card').locator('[data-ds=data-table-pager]')).toContainText('daripada 58 hasil')
    await expectNoHorizontalScroll(page)
  })

  test('S5 class 516 without subject: header without subject and the block of config 213 (7 / 8 / 0)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/kelas/516')
    await expect(page.getByTestId('class-name')).toHaveText('4 Simulasi')
    // FR-M08-03: "{school} · {year}" for a class without subject.
    await expect(page.getByTestId('class-sub').first()).toContainText('SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG · 2026 · Kod: DEMO-4S')
    await expect(page.getByTestId('class-code')).toHaveText('DEMO-4S')
    await expect(page.getByTestId('hc-on')).toHaveText(/^7\s*On Track \/ Above$/)
    await expect(page.getByTestId('hc-below')).toHaveText(/^8\s*Below Target$/)
    await expect(page.getByTestId('hc-none')).toHaveText(/^0\s*Tiada Data$/)
    await expect(page.getByTestId('hc-tov')).toHaveText('Purata TOV: 62.1%')
    await expect(page.getByTestId('hc-etr')).toHaveText('Purata ETR: 71.9%')
    await expect(page.getByTestId('hc-full')).toHaveAttribute('href', '/headcount/213/summary')
    await expectNoHorizontalScroll(page)
  })

  test('S5 class 228: 93 · 77.6% · 1618 · 34882 · 10.4m · 2', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas/228')
    await expect(statValues(page)).toHaveText(['93', '78%', '1618', '34882', '10.4m', '2'])
    await expectNoHorizontalScroll(page)
  })

  test('S5 class 228 opens for the admin without horizontal scroll', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas/228')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    await expect(page.getByTestId('stat-murid')).toContainText('93')
    await expectNoHorizontalScroll(page)
  })

  test('S5 a school class (sc-419) is the 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas/sc-419')
    await expect(page.locator('[data-page=not-found]')).toBeVisible()
  })

  test('S8 class 4: the select has no options for the admin; 51 pupils, none started, no accuracy, no risk', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analitik/kelas?classroom_id=4&subject_id=1')
    await expect(page.getByTestId('student-table')).toBeVisible()
    // V2 "Semua Kelas" / "Semua Subjek" lead each select; the admin has no own classes.
    expect(await selectItems(page, 'filter-kelas')).toEqual(['Semua Kelas'])
    expect(await selectItems(page, 'filter-subjek')).toHaveLength(32)
    await expect(page.getByTestId('sum-pelajar')).toContainText('51')
    await expect(page.getByTestId('sum-ketepatan')).toContainText('—')
    await expect(page.getByTestId('sum-berisiko')).toContainText('0')
    await expect(page.getByTestId('sum-baik')).toContainText('0')
    await expect(page.locator('[data-testid^=student-row-]')).toHaveCount(25)
    await expect(page.getByTestId('student-table').locator('[data-ds=data-table-pager]')).toContainText('daripada 51 hasil')
    // A risk filter never lists Belum Bermula pupils.
    await pickItem(page, 'filter-risiko', 'Rendah')
    await expect(page.locator('[data-testid^=student-row-]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('S8 an unknown class id shows the empty state', async ({ page, gotoApp }) => {
    await gotoApp('/analitik/kelas?classroom_id=99999999')
    await expect(page.getByTestId('analitik-empty')).toBeVisible()
  })

  test('S8 without a class: the empty state', async ({ page, gotoApp }) => {
    await gotoApp('/analitik/kelas')
    // V2 analitik-kelas: "Tiada pelajar sepadan dengan tapisan ini."
    await expect(page.getByTestId('analitik-empty')).toContainText(
      'Tiada pelajar sepadan dengan tapisan ini.',
    )
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M08 T7 pelajar', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('pelajar@demo.test')
  })

  for (const path of ['/analitik/kelas', '/analisa-item/kelas', '/analisa-item/kelas/2001']) {
    test(`${path} is the 403 page`, async ({ page, gotoApp }) => {
      await gotoApp(path)
      await expect(page.locator('[data-page=forbidden]')).toBeVisible()
      await expectTabTitle(page, FORBIDDEN_TITLE)
    })
  }

  test('S5 is the 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas/2001')
    await expect(page.locator('[data-page=not-found]')).toBeVisible()
  })

  test('S4 is the in-place 403 page (a pupil owns no class)', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas')
    await expect(page).toHaveURL(/\/prestasi\/kelas$/)
    await expect(page.locator('[data-ds="error-page"][data-code="403"]')).toBeVisible()
  })
})
