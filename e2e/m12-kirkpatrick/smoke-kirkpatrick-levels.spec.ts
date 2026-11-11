/**
 * M12 S4 `.../behavior`, S5 `.../results`, S6 `.../chain`, S7 `.../interventions` and S8 `.../pelajar/{id}` on
 * `/admin/kirkpatrick`, the `/guru/kirkpatrick` twins and the `/admin-sekolah/kirkpatrick` mount at 375 / 768 / 1280
 * (M12-T3 / M12-T4; SRS M12 §12: E2E-M12-03 / 04 / 05 / 07 (S4-S8 part), 31-45, 46, 47-51, 52, 53, 55, 60 (S4-S8
 * part), 62-65). Accounts: admin 1 (`admin@demo.test`, Pentadbiran), guru 5 (`guru@demo.test`, Pembelajaran), school
 * administrator 8 (`adminsekolah@demo.test`, Pembelajaran; all seven screens under its own mount, FR-AS-11-1).
 * The teacher steps, the PDF target, the intervention save and the zero-answer S8 are INFERRED / PROPOSED (SRS §8.2,
 * §9), so those tests are `@provisional`. E2E-M12-54 (the M11 link into S8) is covered by the M11 specs.
 *
 * T-C11 rewrite to the current UI (see the header of smoke-kirkpatrick-overview.spec.ts): shell headers and section
 * tabs, "{Page} | PRESTASIPLUS", whole-number accuracy (XS-5), thousands separators, DS stat tiles / data tables (20 rows
 * per page, cards below 768) / chart, DS tile layout (2 below 768, 3 from 768, `cols` at 1280).
 *
 * Figures are the observed anchors of SRS M12 §6.7 and the M12 mock repository (src/modules/m12-kirkpatrick/mock/
 * repository, constants in mock/data/constants.ts:15-48), accuracies rounded half away from zero.
 */

import type { Locator, Page } from '@playwright/test'

import { ALESA_ON, ALESA_SKIP_REASON } from '../support/alesa'
import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'
import {
  TEXT,
  applyFilters,
  collectPages,
  columns,
  dsRows,
  expectErrorPage,
  expectHeader,
  expectStat,
  isWide,
  openFilters,
  pagerSummary,
  pickOption,
  selectOptions,
  showAllRows,
  spaGo,
  tableMatrix,
  texts,
} from './kirk-helpers'

const ADMIN = 'admin@demo.test'
const GURU = 'guru@demo.test'
const SCHOOL_ADMIN = 'adminsekolah@demo.test'
const MODULE = { tag: [moduleTag(12)] }

test.use({ mockInit: { latency: 0 } })

const BASE = '/admin/kirkpatrick'
const S4 = `${BASE}/behavior`
const S5 = `${BASE}/results`
const S6 = `${BASE}/chain`
const S7 = `${BASE}/interventions`
const S8 = (id: number | string) => `${BASE}/pelajar/${String(id)}`
const ALIAS = '/admin-sekolah/kirkpatrick'

const TITLES = {
  s4: ['T3: Tingkah Laku', 'Kirkpatrick Tahap 3 — Konsistensi penggunaan'],
  s5: ['T4: Hasil', 'Kirkpatrick Tahap 4 — Keputusan peperiksaan'],
  s6: ['Rantaian Impak', 'Rantaian impak Kirkpatrick — 4 tahap keberkesanan'],
  s7: ['Intervensi', 'Kirkpatrick — Cadangan & rekod intervensi'],
  // /guru mount: the page is headed "Intervensi Pelajar" (route interventions.ts).
  s7Guru: ['Intervensi Pelajar', 'Kirkpatrick — Cadangan & rekod intervensi'],
} as const

/** S5 renders 946 prediction rows from one response: wait for its content with a larger budget. */
const S5_READY = { timeout: 30_000 } as const

/** DS tile layout of a strip of `n` tiles with `max` per row at 1280 (src/ds/tile-layout.ts:70-79). */
const tileCols = (page: Page, n: number, max: number): number => {
  const w = viewportWidth(page)
  const rows = (cap: number) => {
    for (let c = Math.min(cap, n); c >= 1; c--) {
      const r = Math.ceil(n / c)
      if ([1, 2, 3, 4, 5, 6, 12].includes(lcmOf(rowSizes(n, r)))) return Math.max(...rowSizes(n, r))
    }
    return n
  }
  return w >= 1280 ? rows(max) : w >= 768 ? rows(Math.min(3, max)) : rows(2)
}
const rowSizes = (n: number, r: number): number[] => {
  const base = Math.floor(n / r)
  const extra = n % r
  return Array.from({ length: r }, (_, i) => base + (i < extra ? 1 : 0))
}
const gcdOf = (a: number, b: number): number => (b === 0 ? a : gcdOf(b, a % b))
const lcmOf = (xs: number[]): number => xs.reduce((a, b) => (a * b) / gcdOf(a, b), 1)

/** The active section tab of the Pentadbiran shell. */
const activeTab = (page: Page) =>
  page.getByTestId('pentadbiran-section-tabs').locator('a[data-active="true"]')

// ---------------------------------------------------------------------------------------------- S4

test.describe('M12 S4 T3 Tingkah Laku (admin)', MODULE, () => {
  test('E2E-M12-03/04 S4 header, titles and the current section tab @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S4}?school_id=8080`)
    await expectHeader(page, 'pentadbiran', TITLES.s4)
    await expect(page.getByTestId('pentadbiran-header')).toBeVisible()
    await expect(activeTab(page)).toHaveText('T3: Tingkah Laku', TEXT)
    await expect(activeTab(page)).toHaveAttribute('href', S4)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-31 S4 filter, KPIs, apply 8080 and Reset @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    const kpi = (k: string) => page.getByTestId(`beh-kpi-${k}`)
    await expectStat(kpi('t4t5'), '4,158', 'Pelajar')
    await expectStat(kpi('active'), '946', 'Pernah Aktif')
    await expectStat(kpi('sessions'), '20,991', 'Jumlah Sesi')
    await expectStat(kpi('answers'), '306,133', 'Soalan Dijawab')
    await expectStat(kpi('accuracy'), '83%', 'Ketepatan')
    await expectStat(kpi('teachers'), '53.1%', 'Guru Aktif', '277/522')
    await openFilters(page)
    await expect(page.getByTestId('kirk-filter-state')).toHaveCount(0)
    await expect(page.locator('[data-testid="kirk-filter-school"] option')).toHaveCount(58)
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toHaveCount(0)
    await page.getByTestId('kirk-filter-school').selectOption('8080')
    await applyFilters(page)
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\/behavior\?school_id=8080(&state=)?$/)
    await expectStat(kpi('t4t5'), '184', 'Pelajar')
    await expectStat(kpi('active'), '53', 'Pernah Aktif')
    await expectStat(kpi('sessions'), '1,002', 'Jumlah Sesi')
    await expectStat(kpi('answers'), '15,007', 'Soalan Dijawab')
    await expectStat(kpi('accuracy'), '76%', 'Ketepatan')
    await expectStat(kpi('teachers'), '100%', 'Guru Aktif', '34/34')
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\/behavior$/)
    await expectStat(kpi('t4t5'), '4,158', 'Pelajar')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-31 KPI columns 2 / 3 / 3 and the select fits the filter card (DV-M12-07) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    await expect(page.getByTestId('beh-kpis').locator('> li')).toHaveCount(6)
    expect(await columns(page.getByTestId('beh-kpis').locator('> li'))).toBe(tileCols(page, 6, 3))
    await openFilters(page)
    const card = (await page
      .locator(isWide(page) ? '[data-testid="kirk-filter"]' : '[data-ds="filter-sheet"]')
      .boundingBox())!
    const select = page.getByRole('combobox', { name: 'Sekolah', exact: true })
    const box = (await select.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 0.5)
    expect(box.height).toBeGreaterThanOrEqual(36)
    if (!isDesktopShell(page)) {
      await expectTouchTarget(select)
      if (isWide(page)) await expectTouchTarget(page.getByRole('button', { name: 'Tapis', exact: true }))
    }
    await expectNoHorizontalScroll(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewportWidth(page),
    )
  })

  test('E2E-M12-32 S4 band tiles: default and 8080, targets, bar values, 5 columns @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    const tile = (k: string) => page.getByTestId(`beh-band-${k}`)
    const expected = [
      ['champion', '513', 'Champion', '>50 soalan', '12.3%'],
      ['konsisten', '259', 'Konsisten', '20-50 soalan', '6.2%'],
      ['berkembang', '169', 'Berkembang', '5-20 soalan', '4.1%'],
      ['minimum', '5', 'Minimum', '<5 soalan', '0.1%'],
      ['tidakTerlibat', '3,212', 'Tidak Terlibat', '0 soalan', '77.2%'],
    ] as const
    for (const [k, n, label, caption, p] of expected) {
      await expect(tile(k).getByTestId('band-count')).toHaveText(n)
      await expect(tile(k).getByTestId('band-label')).toHaveText(label)
      await expect(tile(k).getByTestId('band-caption')).toHaveText(caption)
      await expect(tile(k).getByTestId('band-pct')).toHaveText(p)
      await expect(tile(k)).toHaveAttribute('href', '/admin/monitoring')
      await expect(tile(k).getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        p.replace('%', ''),
      )
    }
    // 5 across from sm (640), 2 below with the last tile spanning both (BehaviorBands.vue).
    expect(await columns(page.locator('[data-testid^="beh-band-"]'))).toBe(
      viewportWidth(page) >= 640 ? 5 : 2,
    )
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S4}?school_id=8080`)
    await expect(tile('champion').getByTestId('band-count')).toHaveText('36')
    expect(await texts(page.getByTestId('band-count'))).toEqual(['36', '8', '9', '0', '131'])
    expect(await texts(page.getByTestId('band-pct'))).toEqual([
      '19.6%',
      '4.3%',
      '4.9%',
      '0%',
      '71.2%',
    ])
  })

  test('E2E-M12-34 S4 school table: 33 rows, first link, tahap split, 8080 and 940 rows @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    const table = page.getByTestId('beh-schools')
    if (isWide(page)) {
      await expect(table.locator('thead th')).toHaveText([
        '#',
        'Sekolah',
        'Pelajar',
        'Aktif',
        'Soalan',
        'Sesi',
        'Purata/Aktif',
        'Skor',
        'Tahap',
      ])
    }
    // 20 rows per page (BehaviorSchoolTable.vue): the pager holds the 33 schools.
    await expect(dsRows(table)).toHaveCount(20)
    await expect(pagerSummary(table)).toContainText('daripada 33 hasil')
    await showAllRows(page, table)
    const rows = dsRows(table)
    await expect(rows).toHaveCount(33)
    await expect(page.getByTestId('beh-school-link').first()).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/9681',
    )
    const tahap = await texts(page.getByTestId('cell-tahap'))
    const count = (t: string) => tahap.filter((x) => x === t).length
    expect([count('Champion'), count('Konsisten'), count('Berkembang'), count('Minimum')]).toEqual([
      8, 7, 2, 4,
    ])
    expect(count('Tidak Terlibat')).toBe(12)
    const active = await texts(page.getByTestId('cell-active'))
    expect(active.filter((a) => a === '0')).toHaveLength(9)
    expect(active.reduce((s, a) => s + Number(a), 0)).toBe(946)
    const answers = await texts(page.getByTestId('cell-answers'))
    expect(answers.reduce((s, a) => s + Number(a.replace(/,/g, '')), 0)).toBe(306_133)
    await expect(page.locator('[data-testid="cell-active"].text-dimmed')).toHaveCount(9)
    await expect(page.locator('[data-testid="cell-tahap"]').first()).toBeVisible()

    const cell = (row: Locator, id: string) => row.getByTestId(id)
    const r8080 = rows.filter({ has: page.locator('a[href$="/sekolah/8080"]') })
    await expect(cell(r8080, 'cell-students')).toHaveText('184')
    await expect(cell(r8080, 'cell-active')).toHaveText('53')
    await expect(cell(r8080, 'cell-answers')).toHaveText('15,007')
    await expect(cell(r8080, 'cell-sessions')).toHaveText('1,002')
    await expect(cell(r8080, 'cell-per-active')).toHaveText('283.2')
    await expect(cell(r8080, 'cell-score')).toHaveText('62.4')
    await expect(cell(r8080, 'cell-tahap')).toHaveText('Konsisten')
    const r940 = rows.filter({ has: page.locator('a[href$="/sekolah/940"]') })
    expect(await texts(r940.locator('[data-testid^="cell-"]'))).toEqual([
      '1',
      '0',
      '0',
      '1',
      '0',
      '2',
      'Tidak Terlibat',
    ])
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-34b S4 every school stays reachable at every width (the card keeps the school link) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // Below 768 DsDataTable draws a card per row with the plain-text title; BehaviorSchoolTable.vue fills only the
    // table cell slot (#name-cell), so the card has no link to /admin/monitoring/sekolah/{id}.
    await loginAs(ADMIN)
    await gotoApp(S4)
    await expect(dsRows(page.getByTestId('beh-schools')).first()).toBeVisible()
    await expect(page.getByTestId('beh-school-link')).toHaveCount(20)
  })

  test('E2E-M12-35 S4 heat map: 7 x 18, titles, ramp, 8080 zero cells, scroll at 375 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    const heat = page.getByTestId('beh-heat')
    await expect(heat).toContainText('Corak Masa Aktiviti')
    await expect(page.getByTestId('beh-heat-cell')).toHaveCount(126)
    const grid = page.getByTestId('beh-heat-table')
    await expect(grid.locator('span.text-center')).toHaveText(
      Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, '0')),
    )
    await expect(grid.locator('span.whitespace-nowrap')).toHaveText([
      'Isnin',
      'Selasa',
      'Rabu',
      'Khamis',
      'Jumaat',
      'Sabtu',
      'Ahad',
    ])
    const max = page.locator('[data-testid="beh-heat-cell"][title="Selasa 14:00 — 6253 soalan"]')
    const min = page.locator('[data-testid="beh-heat-cell"][title="Isnin 06:00 — 944 soalan"]')
    await expect(max).toHaveCount(1)
    await expect(min).toHaveCount(1)
    // heatClass (behavior-format.ts): the busiest cell takes the full ramp step, the quietest the lightest.
    await expect(max).toHaveClass(/(^|\s)bg-cat-1(\s|$)/)
    await expect(min).toHaveClass(/bg-cat-1\/20/)
    const size = (await min.boundingBox())!.width
    expect(size).toBe(viewportWidth(page) >= 640 ? 32 : 24)
    if (isMobileWidth(page)) {
      expect(
        await grid.evaluate((el) => el.scrollWidth > el.clientWidth),
        'the heat map scrolls inside its card',
      ).toBe(true)
    }
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S4}?school_id=8080`)
    const zero = page.locator('[data-testid="beh-heat-cell"][title$="— 0 soalan"]')
    await expect(zero).toHaveCount(43)
    await expect(zero.first()).toHaveClass(/bg-muted/)
    await expect(zero.first()).toHaveText('')
    await expect(page.locator('[data-testid="beh-heat-cell"][title$="— 736 soalan"]')).toHaveCount(
      1,
    )
  })

  test('E2E-M12-36 S4 alerts: 35 items in order, no buttons, absent for 8080, mood card @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    const items = page.getByTestId('beh-alert')
    await expect(items).toHaveCount(35)
    const text = await texts(page.getByTestId('beh-alert-text'))
    const kinds = await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
    expect(kinds).toEqual([
      ...Array<string>(22).fill('never'),
      'teacher',
      ...Array<string>(12).fill('good'),
    ])
    const never = text.slice(0, 22)
    for (const t of never) expect(t).toMatch(/: \d+ pelajar tidak pernah login langsung\.$/)
    expect(never.map((t) => Number(/: (\d+) pelajar/.exec(t)![1]))).toEqual([
      1, 4, 6, 8, 257, 205, 1, 759, 674, 1, 5, 148, 2, 1, 1, 16, 8, 7, 7, 8, 1, 6,
    ])
    expect(text[22]).toMatch(/: 2 guru telah login tetapi tiada pelajar yang menjawab soalan\.$/)
    const good = text.slice(23)
    for (const t of good) expect(t).toMatch(/: [\d.]+% pelajar aktif menjawab soalan\. Tahniah!$/)
    expect(good.map((t) => /: ([\d.]+%)/.exec(t)![1])).toEqual([
      '83.3%',
      '87.5%',
      '100%',
      '80%',
      '100%',
      '87.5%',
      '71.4%',
      '54.7%',
      '85.7%',
      '62.5%',
      '100%',
      '83.3%',
    ])
    // UAlert colours: error for "never" / "teacher", success for "good".
    await expect(items.first()).toHaveClass(/error/)
    await expect(items.last()).toHaveClass(/success/)
    await expect(page.getByTestId('beh-alerts').locator('button, a')).toHaveCount(0)

    const mood = page.getByTestId('beh-mood')
    await expect(mood).toContainText('Data Mood Belum Mencukupi')
    await expect(mood).toContainText(
      'Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi.',
    )
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S4}?school_id=8080`)
    await expectStat(page.getByTestId('beh-kpi-t4t5'), '184', 'Pelajar')
    await expect(page.getByTestId('beh-alerts')).toHaveCount(0)
    await expect(page.getByTestId('beh-mood')).toBeVisible()
  })

  test('E2E-M12-62 S4 alerts on filtered pages: 10220 teacher item only, 8298 red only @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S4}?school_id=10220`)
    await expect(page.getByTestId('beh-alert')).toHaveCount(1)
    await expect(page.getByTestId('beh-alert-text')).toContainText(
      ': 2 guru telah login tetapi tiada pelajar yang menjawab soalan.',
    )
    await spaGo(page, `${S4}?school_id=8298`)
    await expect(page.getByTestId('beh-alert')).toHaveCount(1)
    await expect(page.getByTestId('beh-alert-text')).toContainText(
      ': 2 pelajar tidak pernah login langsung.',
    )
    await expect(page.getByTestId('beh-alert')).toHaveClass(/error/)
  })

  test('E2E-M12-64 S4 school 9167: Pernah Aktif = row Aktif = 5, bands sum to 8, two alerts @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S4}?school_id=9167`)
    await expectStat(page.getByTestId('beh-kpi-active'), '5', 'Pernah Aktif')
    await expect(dsRows(page.getByTestId('beh-schools'))).toHaveCount(1)
    await expect(page.getByTestId('cell-active')).toHaveText('5')
    const answersKpi = (await page.getByTestId('beh-kpi-answers').innerText()).split('\n')[0]!.trim()
    await expect(page.getByTestId('cell-answers')).toHaveText(answersKpi)
    const bands = (await texts(page.getByTestId('band-count'))).map(Number)
    expect(bands.reduce((a, b) => a + b, 0)).toBe(8)
    const alerts = await texts(page.getByTestId('beh-alert-text'))
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toMatch(/: 8 pelajar tidak pernah login langsung\.$/)
    expect(alerts[1]).toMatch(/: 62\.5% pelajar aktif menjawab soalan\. Tahniah!$/)
  })
})

// ---------------------------------------------------------------------------------------------- S5

test.describe('M12 S5 T4 Hasil (admin)', MODULE, () => {
  const kpi = (page: Page, k: string) => page.getByTestId(`res-kpi-${k}`)

  test('E2E-M12-03/04 S5 header, titles and the current section tab @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S5}?school_id=8080`)
    await expectHeader(page, 'pentadbiran', TITLES.s5)
    await expect(activeTab(page)).toHaveText('T4: Hasil', TEXT)
    await expect(activeTab(page)).toHaveAttribute('href', S5)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-37 S5 KPI cards: platform and 8080 @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    await expectStat(kpi(page, 'gps'), '4.30', 'GPS Headcount', '41 rekod · 2025')
    await expectStat(kpi(page, 'pass'), '96.7%', 'Kadar Lulus', '174/180 calon')
    await expectStat(kpi(page, 'gradeA'), '52', 'Pelajar Gred A', '28.9% daripada 180')
    await expectStat(kpi(page, 'accuracy'), '83%', 'Ketepatan Platform', '306,133 soalan')
    await expectStat(kpi(page, 'active'), '946', 'Pelajar Aktif', '22.8% daripada 4,158')
    await expectStat(kpi(page, 'records'), '4,378', 'Rekod Headcount', 'Data OTR')
    expect(await columns(page.getByTestId('res-kpis').locator('> li'))).toBe(tileCols(page, 6, 3))
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S5}?school_id=8080`)
    await expectStat(kpi(page, 'gps'), '4.00', 'GPS Headcount', '41 rekod · 2026')
    await expectStat(kpi(page, 'pass'), '100%', 'Kadar Lulus', '1/1 calon')
    await expectStat(kpi(page, 'gradeA'), '0', 'Pelajar Gred A', '0% daripada 1')
    await expectStat(kpi(page, 'accuracy'), '76%', 'Ketepatan Platform', '15,007 soalan')
    await expectStat(kpi(page, 'active'), '53', 'Pelajar Aktif', '28.8% daripada 184')
    await expectStat(kpi(page, 'records'), '4,378', 'Rekod Headcount', 'Data OTR')
  })

  test('E2E-M12-38 S5 Taburan Gred 2025 and 8080 2026 @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    const card = page.getByTestId('res-grades')
    const title = card.locator('[data-ds="chart-title"]')
    await expect(title).toHaveText('Taburan Gred (2025)', TEXT)
    await expect(card).toContainText('Berdasarkan 180 calon — sumber: Headcount OTR')
    // The chart is a canvas; its data table (sr-only) carries the label and the count of every grade.
    const rows = card.locator('[data-ds="chart-table"] tbody tr')
    await expect(rows).toHaveCount(10)
    const data = await rows.evaluateAll((els) =>
      els.map((r) => [...r.querySelectorAll('th, td')].map((c) => (c as HTMLElement).innerText.trim())),
    )
    expect(data).toEqual([
      ['A+ · 5.6%', '10'],
      ['A · 10%', '18'],
      ['A- · 13.3%', '24'],
      ['B+ · 17.8%', '32'],
      ['B · 17.8%', '32'],
      ['C+ · 14.4%', '26'],
      ['C · 11.7%', '21'],
      ['D · 6.1%', '11'],
      ['E · 2.8%', '5'],
      ['G · 0.6%', '1'],
    ])
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S5}?school_id=8080`)
    await expect(title).toHaveText('Taburan Gred (2026)', TEXT)
    await expect(card).toContainText('Berdasarkan 1 calon — sumber: Headcount OTR')
    const t8080 = await rows.evaluateAll((els) =>
      els.map((r) => [...r.querySelectorAll('th, td')].map((c) => (c as HTMLElement).innerText.trim())),
    )
    expect(t8080[3]).toEqual(['B+ · 100%', '1'])
    expect(t8080.filter((r) => r[1] === '0' && r[0]!.endsWith('· 0%'))).toHaveLength(9)
  })

  test('E2E-M12-39/40 S5 subject GPS and trend tables, platform rows in every scope @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    for (const scope of ['', '?school_id=8080']) {
      if (scope !== '') await spaGo(page, `${S5}${scope}`)
      const subj = page.getByTestId('res-subject-gps')
      await expect(subj.locator('h2').first()).toHaveText('GPS Mengikut Subjek (2026)', {
        ...TEXT,
        timeout: 30_000,
      })
      expect(await tableMatrix(page, subj, { dropIndex: true })).toEqual([
        ['Matematik', '2.50', 'A-', '30', '4.45'],
        ['Bahasa Melayu', '2.80', 'A-', '30', '4.00'],
        ['Sains', '2.90', 'A-', '30', '4.70'],
        ['Sejarah', '3.00', 'A-', '30', '4.50'],
        ['Bahasa Inggeris', '3.20', 'B+', '30', '4.30'],
      ])
      await expect(subj).toContainText('GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya.')
      if (isWide(page)) {
        const first = page.getByTestId('cell-subject').first()
        await expect(first).not.toHaveAttribute('title', /.+/)
        await expect(first.locator('a')).toHaveCount(0)
      }

      const trend = page.getByTestId('res-trend')
      await expect(trend.locator('h2').first()).toHaveText('Trend GPS (2022–2026)', TEXT)
      if (isWide(page)) {
        await expect(trend.locator('thead th')).toHaveText(
          ['Subjek', '2022', '2023', '2024', '2025', '2026', 'Trend'],
          TEXT,
        )
      }
      const matrix = await tableMatrix(page, trend)
      expect(matrix.map((r) => r.slice(0, 6))).toEqual([
        ['Keseluruhan', '5.20', '4.80', '4.50', '4.30', '-'],
        ['Bahasa Melayu', '4.80', '4.50', '4.20', '4.00', '2.80'],
        ['Bahasa Inggeris', '5.20', '4.90', '4.55', '4.30', '3.20'],
        ['Matematik', '5.50', '5.10', '4.75', '4.45', '2.50'],
        ['Sains', '5.80', '5.40', '5.00', '4.70', '2.90'],
        ['Sejarah', '5.60', '5.20', '4.80', '4.50', '3.00'],
        ['Pendidikan Islam', '4.20', '3.90', '3.65', '3.40', '-'],
      ])
      // BR-M12-20: GPS <= 4.00 success, above warning; a missing year is dimmed.
      const cells = page.getByTestId('res-trend-cell')
      await expect(cells.first()).toHaveClass(/text-warning/)
      await expect(cells.nth(4)).toHaveClass(/text-dimmed/)
      await expect(
        page.getByTestId('res-trend-row').nth(1).locator('xpath=ancestor::*[self::tr or self::li][1]').getByTestId('res-trend-cell').nth(3),
      ).toHaveClass(/text-success/)
      await expect(trend).toContainText(
        '↑ = GPS menurun (improving). Sumber: Headcount OTR & SPM sebenar.',
      )
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-41 S5 school table @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    const table = page.getByTestId('res-schools')
    await expect(pagerSummary(table)).toContainText('daripada 33 hasil', S5_READY)
    await showAllRows(page, table)
    const rows = dsRows(table)
    await expect(rows).toHaveCount(33)
    await expect(page.getByTestId('res-school-link').first()).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/9681',
    )
    const tahap = await texts(page.locator('[data-testid="res-schools"] [data-testid="cell-tahap"]'))
    const n = (t: string) => tahap.filter((x) => x === t).length
    expect([
      n('Champion'),
      n('Konsisten'),
      n('Berkembang'),
      n('Minimum'),
      n('Tidak Terlibat'),
    ]).toEqual([8, 7, 2, 4, 12])
    // A school without activity is dimmed (text-dimmed) and prints "-" for accuracy and answers.
    await expect(page.locator('[data-testid="res-school-link"][data-faded="true"]')).toHaveCount(9)
    const faded = rows
      .filter({ has: page.locator('[data-testid="res-school-link"][data-faded="true"]') })
      .first()
    await expect(faded.getByTestId('res-school-link')).toHaveClass(/text-dimmed/)
    await expect(faded.getByTestId('cell-accuracy')).toHaveText('-')
    await expect(faded.getByTestId('cell-answers')).toHaveText('-')
    const r940 = rows.filter({ has: page.locator('a[href$="/sekolah/940"]') })
    await expect(r940.getByTestId('cell-engagement')).toHaveText('2')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-41 S5 the 946 prediction rows @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    const card = page.getByTestId('res-predictions')
    await expect(pagerSummary(card)).toContainText('daripada 946 hasil', S5_READY)
    // 50 rows per page (ResultsPredictions.vue): walk the 19 pages.
    const preds = await collectPages(card, async (scope) =>
      scope.evaluate((root) => {
        const rows = [...root.querySelectorAll('[data-testid="pred-accuracy"]')]
        return rows.map((el) => {
          const row = el.closest('tr, li')!
          return {
            accText: (el as HTMLElement).innerText.trim(),
            grade: (row.querySelector('[data-testid="pred-grade"]') as HTMLElement).innerText.trim(),
            school: (row.querySelector('[data-testid="pred-school"]') as HTMLAnchorElement).getAttribute('href'),
          }
        })
      }),
    )
    expect(preds).toHaveLength(946)
    const acc = preds.map((p) => Number.parseFloat(p.accText))
    for (let i = 1; i < acc.length; i++) expect(acc[i]!).toBeLessThanOrEqual(acc[i - 1]!)
    const band = (gs: string[]) => preds.filter((p) => gs.includes(p.grade)).length
    expect([
      band(['A+', 'A', 'A-']),
      band(['B+', 'B']),
      band(['C+', 'C']),
      band(['D', 'E']),
      band(['G']),
    ]).toEqual([512, 206, 104, 95, 29])
    // The grade follows the accuracy (whole numbers are shown, so only values clear of a boundary are checked).
    for (const p of preds) {
      const v = Number.parseFloat(p.accText)
      if (v >= 91) expect(p.grade, `grade of ${p.accText}`).toBe('A+')
      else if (v >= 41 && v <= 49) expect(p.grade, `grade of ${p.accText}`).toBe('D')
      else if (v >= 31 && v <= 39) expect(p.grade, `grade of ${p.accText}`).toBe('E')
      else if (v <= 29) expect(p.grade, `grade of ${p.accText}`).toBe('G')
    }
    expect(preds.every((p) => p.school !== null)).toBe(true)
    await expect(card).toContainText(
      'Ramalan ini berdasarkan ketepatan menjawab soalan dalam platform sahaja. Ramalan penuh memerlukan lebih banyak data termasuk keputusan peperiksaan terdahulu.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-41/63 S5 school 8080: one school row, 53 predictions, students A and B link to 4664 / 4644 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S5}?school_id=8080`)
    await expect(dsRows(page.getByTestId('res-schools'))).toHaveCount(1, S5_READY)
    const card = page.getByTestId('res-predictions')
    await expect(pagerSummary(card)).toContainText('daripada 53 hasil')
    const rows = dsRows(card)
    await expect(rows).toHaveCount(50)
    const a = rows.nth(18)
    await expect(a.getByTestId('pred-student')).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/8080/pelajar/4664',
    )
    expect((await tableMatrix(page, card))[18]![3]).toBe('219')
    await expect(a.getByTestId('pred-accuracy')).toHaveText('73%')
    await expect(a.getByTestId('pred-grade')).toHaveText('A-')
    const b = rows.nth(49)
    await expect(b.getByTestId('pred-student')).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/8080/pelajar/4644',
    )
    expect((await tableMatrix(page, card))[49]![3]).toBe('70')
    await expect(b.getByTestId('pred-accuracy')).toHaveText('39%')
    await expect(b.getByTestId('pred-grade')).toHaveText('E')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-42 S5 ALESA: platform rows, tiles, counts, Cadangan, footer; 8080 own rows @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.skip(!ALESA_ON, ALESA_SKIP_REASON)
    await loginAs(ADMIN)
    await gotoApp(S5)
    const card = page.getByTestId('res-alesa')
    await expect(card).toContainText('Ramalan ALESA (Predictive Grade)')
    await expect(card).toContainText(
      'Berdasarkan ketepatan, konsistensi, trend mingguan, dan jumlah latihan pelajar',
    )
    await expect(page.getByTestId('tile-value')).toHaveText(['48', '2', '4'])
    expect(await columns(page.getByTestId('tile-value'))).toBe(3)
    await showAllRows(page, card)
    await expect(page.getByTestId('alesa-row')).toHaveCount(50)
    const grades = await texts(page.getByTestId('alesa-grade'))
    const count = (g: string) => grades.filter((x) => x === g).length
    expect(['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E'].map(count)).toEqual([
      6, 16, 9, 9, 3, 1, 2, 2, 2,
    ])
    const order = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E']
    expect(grades.map((g) => order.indexOf(g))).toEqual(
      [...grades.map((g) => order.indexOf(g))].sort((x, y) => x - y),
    )
    const conf = await texts(page.getByTestId('alesa-confidence'))
    expect(
      ['Rendah', 'Sederhana', 'Tinggi'].map((c) => conf.filter((x) => x === c).length),
    ).toEqual([38, 10, 2])
    const cad = await texts(page.getByTestId('alesa-cadangan'))
    expect(cad[0]).toBe(
      'Teruskan konsistensi latihan. Fokus pada topik yang masih lemah untuk capai kecemerlangan.',
    )
    expect(cad[cad.length - 1]).toBe(
      'Pelajar memerlukan intervensi segera. Cadangan: bimbingan guru dan program pemulihan.',
    )
    await expect(page.getByTestId('alesa-footer')).toHaveText(
      '48 pelajar dijangka lulus, 4 pelajar perlu intervensi segera. Ramalan ini berdasarkan formula berwajaran: Ketepatan (40%), Konsistensi (20%), Trend (20%), Volume (20%).',
      TEXT,
    )
    await expect(page.getByTestId('alesa-footer').locator('strong')).toHaveText(
      '48 pelajar dijangka lulus',
    )
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S5}?school_id=8080`)
    await expect(page.getByTestId('tile-value')).toHaveText(['47', '3', '3'])
    await showAllRows(page, card)
    await expect(page.getByTestId('alesa-row')).toHaveCount(50)
    const g8 = await texts(page.getByTestId('alesa-grade'))
    const c8 = (g: string) => g8.filter((x) => x === g).length
    expect(['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'E'].map(c8)).toEqual([3, 9, 11, 13, 7, 3, 1, 3])
    const names = await texts(page.getByTestId('alesa-name'))
    expect(names).not.toContain('Pelajar Demo 004664')
    const rowB = page.getByTestId('alesa-row').nth(46)
    await expect(rowB.getByTestId('alesa-name')).toHaveText('Pelajar Demo 004644')
    await expect(page.getByTestId('alesa-grade').nth(46)).toHaveText('C')
    await expect(page.getByTestId('alesa-cadangan').nth(46)).toHaveText(
      'Pelajar memerlukan intervensi segera. Cadangan: bimbingan guru dan program pemulihan.',
      TEXT,
    )
    await expect(page.getByTestId('alesa-footer')).toContainText(
      '47 pelajar dijangka lulus, 3 pelajar perlu intervensi segera.',
    )
  })

  test('E2E-M12-43 S5 ROI and insights: platform and 8080 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    await expect(page.getByTestId('roi-active')).toHaveText('946')
    await expect(page.getByTestId('roi-per-student')).toHaveText('323.6')
    await expect(page.getByTestId('roi-accuracy')).toHaveText('83%')
    await expect(page.getByTestId('roi-gps')).toHaveText('4.30')
    const roi = page.getByTestId('res-roi')
    await expect(roi).toContainText('ROI penuh akan dapat dikira apabila:')
    await expect(roi.locator('ol li')).toHaveText([
      '1. Keputusan peperiksaan sebenar (SPM/dalaman) diimport',
      '2. Data kos langganan platform dimasukkan',
      '3. Perbandingan prestasi pelajar aktif vs tidak aktif dapat dibuat',
    ])
    await expect(page.getByTestId('insight-row')).toHaveText(
      [
        'Hanya 946 daripada 4,158 pelajar (22.8%) menggunakan platform. Data perbandingan terhad kepada pelajar aktif sahaja.',
        'Purata ketepatan pelajar aktif dalam platform: 83%. Ini bersamaan anggaran gred A.',
        'GPS keseluruhan dari headcount (tahun 2025): 4.30. Trend menunjukkan peningkatan dari tahun ke tahun.',
      ],
      TEXT,
    )
    await expect(page.getByTestId('insight-disclaimer')).toHaveText(
      'Disclaimer: Data GPS Anggaran berdasarkan markah OTR headcount, bukan keputusan SPM sebenar.',
      TEXT,
    )
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S5}?school_id=8080`)
    await expect(page.getByTestId('roi-accuracy')).toHaveText('76%')
    await expect(page.getByTestId('insight-row')).toHaveText(
      [
        'Hanya 53 daripada 184 pelajar (28.8%) menggunakan platform. Data perbandingan terhad kepada pelajar aktif sahaja.',
        'Purata ketepatan pelajar aktif dalam platform: 76%. Ini bersamaan anggaran gred A-.',
        'GPS keseluruhan dari headcount (tahun 2026): 4.00. Trend menunjukkan peningkatan dari tahun ke tahun.',
      ],
      TEXT,
    )
  })

  test('E2E-M12-64 S5 school 9167: Pelajar Aktif = row Aktif = prediction rows = 5 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S5}?school_id=9167`)
    await expect(kpi(page, 'active')).toContainText('5', S5_READY)
    await expect(page.getByTestId('cell-active').first()).toHaveText('5')
    await expect(dsRows(page.getByTestId('res-predictions'))).toHaveCount(5)
  })

  test('E2E-M12-65 S5 school 9167 without SPM history @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S5}?school_id=9167`)
    await expect(kpi(page, 'active')).toContainText('5', S5_READY)
    const accuracyTile = (await kpi(page, 'accuracy').innerText()).split('\n').map((s) => s.trim()).filter(Boolean)
    await expectStat(kpi(page, 'gps'), '-', 'GPS Headcount', '41 rekod')
    await expectStat(kpi(page, 'pass'), '0%', 'Kadar Lulus', '0/0 calon')
    await expectStat(kpi(page, 'gradeA'), '0', 'Pelajar Gred A', '0% daripada 0')
    await expectStat(kpi(page, 'accuracy'), accuracyTile[0]!, 'Ketepatan Platform', accuracyTile[2]!)
    await expectStat(kpi(page, 'active'), '5', 'Pelajar Aktif', '62.5% daripada 8')
    await expectStat(kpi(page, 'records'), '4,378', 'Rekod Headcount', 'Data OTR')
    await expect(kpi(page, 'gps')).not.toContainText('·')
    await expect(page.getByTestId('res-grades')).toHaveCount(0)
    await expect(page.getByTestId('roi-gps')).toHaveText('-')
    await expect(page.getByTestId('insight-row')).toHaveCount(2)
    await expect(page.getByTestId('res-insights')).not.toContainText('GPS keseluruhan')
    await expect(page.getByTestId('insight-disclaimer')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('S5 school 8880 (D9): GPS with 150 candidates, no 0/0 calon and no grade distribution @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S5}?school_id=8880`)
    await expectStat(kpi(page, 'gps'), '2.88', 'GPS Headcount', '41 rekod · 2026')
    await expectStat(kpi(page, 'pass'), '-', 'Kadar Lulus', '150 calon')
    await expect(page.getByTestId('res-grades')).toHaveCount(0)
    await expect(page.getByTestId('res-kpis')).not.toContainText('0/0')
    await expectNoHorizontalScroll(page)
  })
})

// ---------------------------------------------------------------------------------------------- S6

test.describe('M12 S6 Rantaian Impak (admin)', MODULE, () => {
  test('E2E-M12-05/44 S6 header, cards, tones and values @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S6}?school_id=8080`)
    await expectHeader(page, 'pentadbiran', TITLES.s6)
    await expect(activeTab(page)).toHaveText('Rantaian Impak', TEXT)
    await expect(page.getByTestId('chain-back')).toHaveAttribute('href', BASE)
    await expect(page.getByTestId('chain-export')).toHaveText('Muat Turun Laporan')
    await expect(page.getByTestId('chain-export')).toHaveAttribute('href', `${BASE}/export-pdf`)
    await expect(page.getByTestId('chain-export')).toHaveAttribute('target', '_blank')
    await expectTouchTarget(page.getByTestId('chain-export'), 44)

    const v = (id: string) => page.getByTestId(id).getByTestId('chain-value')
    await expect(v('chain-t1')).toHaveText(['8.3/10', '4.6/5', '336'])
    await expect(v('chain-t2')).toHaveText(['83%', '306,133', '80.3%'])
    await expect(v('chain-t3')).toHaveText(['946/4,158 (22.8%)', '20,991'], TEXT)
    await expect(v('chain-t4')).toHaveText(['4.30', '0.1298', 'Lemah'])
    expect(await texts(page.getByTestId('chain-bands').locator('li'))).toEqual([
      'Champion 513',
      'Consistent 259',
      'Developing 169',
      'Minimal 5',
      'Disengaged 3,212',
    ])
    // success (green) for T1 / T2, warning (yellow) for T3 / T4.
    await expect(page.getByTestId('chain-t1')).toHaveAttribute('data-tone', 'success')
    await expect(page.getByTestId('chain-t2')).toHaveAttribute('data-tone', 'success')
    await expect(page.getByTestId('chain-t3')).toHaveAttribute('data-tone', 'warning')
    await expect(page.getByTestId('chain-t4')).toHaveAttribute('data-tone', 'warning')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-44b S6 four stages in a row with arrows from 768, stacked below (V2) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // V2 admin/kirkpatrick/chain.blade.php:26-27, 41-42: 4 columns and the arrows from 768 (C-63: the app switches at md,
    // ChainCards.vue), one column without arrows below 768.
    await loginAs(ADMIN)
    await gotoApp(S6)
    const cols = await columns(page.locator('[data-testid^="chain-t"]:not([data-testid="chain-tabs"])'))
    const arrows = page.getByTestId('chain-arrow')
    if (viewportWidth(page) >= 768) {
      expect(cols).toBe(4)
      await expect(arrows).toHaveCount(3)
      await expect(arrows.first()).toBeVisible()
    } else {
      expect(cols).toBe(1)
      await expect(arrows.first()).toBeHidden()
    }
  })

  test('E2E-M12-45 S6 correlation table, ALESA conclusion and Kesimpulan @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S6)
    const corr = page.getByTestId('chain-correlation')
    await expect(corr).toContainText('Analisis Korelasi: Penggunaan → Pencapaian')
    const matrix = await tableMatrix(page, corr)
    expect(matrix.map((r) => r.slice(0, 3))).toEqual([
      ['1-20 soalan', '215', '60%'],
      ['51-100 soalan', '149', '69%'],
      ['100+ soalan', '348', '75%'],
    ])
    if (isWide(page)) {
      const bars = page.getByTestId('corr-bar')
      await expect(bars.nth(0).locator('[class*="bg-warning"]')).not.toHaveCount(0)
      await expect(bars.nth(1).locator('[class*="bg-success"]')).not.toHaveCount(0)
      await expect(bars.nth(2).locator('[class*="bg-success"]')).not.toHaveCount(0)
    }
    if (ALESA_ON) {
      await expect(page.getByTestId('corr-conclusion')).toHaveText(
        'Kesimpulan ALESA: Pelajar yang menjawab 100+ soalan mencapai ketepatan 75%, berbanding 60% bagi pelajar dengan kurang 20 soalan (perbezaan +16%). Korelasi Pearson antara penggunaan dan ketepatan: r = 0.1298 (Lemah).',
        TEXT,
      )
    } else {
      await expect(page.getByTestId('corr-conclusion')).toHaveCount(0)
    }
    const box = page.getByTestId('chain-conclusion')
    await expect(box.locator('h2')).toHaveText('Kesimpulan Model Kirkpatrick')
    await expect(box).toContainText('Empat-empat tahap Kirkpatrick dipenuhi dalam Prestasi Plus.')
    await expect(box.locator('strong')).toHaveText([
      'Tahap 1 (Reaksi)',
      'Tahap 2 (Pembelajaran)',
      'Tahap 3 (Tingkah Laku)',
      'Tahap 4 (Hasil)',
    ])
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M12-46 "Muat Turun Laporan" opens the PDF target in a new tab @m12',
    provisional('SRS FR-M12-61: the PDF content is PROPOSED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp(S6)
      const popupPromise = page.waitForEvent('popup')
      await page.getByTestId('chain-export').click()
      const popup = await popupPromise
      await popup.waitForLoadState('domcontentloaded')
      // The tab starts at the target and is replaced by the PDF (an object URL, or a download without a viewer).
      await expect
        .poll(() => popup.url(), { timeout: 15_000 })
        .toMatch(/export-pdf$|^blob:|^about:blank$/)
      await popup.close()
    },
  )
})

// ---------------------------------------------------------------------------------------------- S7

test.describe('M12 S7 Intervensi (admin)', MODULE, () => {
  const kpi = (page: Page, k: string) => page.getByTestId(`int-kpi-${k}`)

  test('E2E-M12-03/04/47 S7 header, section tab, zero KPIs and the empty list @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S7}?school_id=8080`)
    await expectHeader(page, 'pentadbiran', TITLES.s7)
    await expect(activeTab(page)).toHaveText('Intervensi', TEXT)
    await expectStat(kpi(page, 'total'), '0', 'Jumlah Intervensi')
    await expectStat(kpi(page, 'pending'), '0', 'Menunggu Semakan')
    await expectStat(kpi(page, 'up'), '0', 'Meningkat')
    await expectStat(kpi(page, 'down'), '0', 'Menurun')
    expect(await columns(page.getByTestId('int-kpis').locator('> li'))).toBe(tileCols(page, 4, 4))
    if (isMobileWidth(page)) {
      const ys = await page
        .getByTestId('int-kpis')
        .locator('> li')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().y)))
      expect(new Set(ys).size).toBe(2)
    }
    await expect(page.getByTestId('int-empty')).toHaveText(
      'Tiada intervensi direkodkan lagi.',
      TEXT,
    )
    await expect(page.getByText('Ambil Tindakan')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-48 S7 form panel: closed, toggles, fields, options, defaults, layout @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S7)
    const form = page.getByTestId('int-form')
    const toggle = page.getByTestId('int-form-toggle')
    await expect(toggle).toContainText('Rekod Intervensi Baru')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(form).toBeHidden()
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(36)
    await toggle.click()
    await expect(form).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(form.locator('label')).toHaveText([
      'Pelajar (ID)',
      'Jenis Amaran',
      'Tarikh Tindakan',
      'Penerangan Amaran',
      'Tindakan Diambil',
      'Ketepatan Sebelum (%)',
      'Mood Sebelum',
      'Ketepatan Selepas (%)',
      'Mood Selepas',
    ])
    await expect(page.getByTestId('int-student')).toHaveAttribute('placeholder', 'ID pelajar')
    await expect(page.getByTestId('int-type')).toContainText('Mood / Kesejahteraan')
    expect(await selectOptions(page, page.getByTestId('int-type'))).toEqual([
      'Mood / Kesejahteraan',
      'Tidak Aktif',
      'Prestasi Menurun',
    ])
    await expect(page.getByTestId('int-date')).toHaveValue('2026-09-25')
    await expect(page.getByTestId('int-desc')).toHaveAttribute(
      'placeholder',
      'Contoh: Pelajar tidak aktif selama 2 minggu',
    )
    await expect(page.getByTestId('int-action')).toHaveAttribute(
      'placeholder',
      'Contoh: Hubungi pelajar melalui guru kelas',
    )
    await expect(page.getByTestId('int-before')).toHaveAttribute('placeholder', '0.0')
    await expect(page.getByTestId('int-after')).toHaveAttribute(
      'placeholder',
      'Isi selepas semakan',
    )
    expect(await selectOptions(page, page.getByTestId('int-before-mood'))).toEqual([
      '-- Pilih --',
      'Gembira',
      'Okay',
      'Sedih',
      'Tertekan',
    ])
    await expect(page.getByTestId('int-submit')).toHaveText('Simpan Intervensi')
    await expectTouchTarget(page.getByTestId('int-submit'))

    const wide = viewportWidth(page) >= 768
    expect(
      await columns(
        page.locator('[data-testid="int-student"], [data-testid="int-type"], [data-testid="int-date"]'),
      ),
    ).toBe(wide ? 3 : 1)
    expect(
      await columns(
        page.locator(
          '[data-testid="int-before"], [data-testid="int-before-mood"], [data-testid="int-after"], [data-testid="int-after-mood"]',
        ),
      ),
    ).toBe(wide ? 4 : 2)
    await expectNoHorizontalScroll(page)

    await toggle.click()
    await expect(form).toBeHidden()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('E2E-M12-49 S7 submit with "Pelajar (ID)" empty is blocked by the native required check @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S7)
    await page.getByTestId('int-form-toggle').click()
    await page.getByTestId('int-desc').fill('Tidak aktif')
    await page.getByTestId('int-action').fill('Hubungi guru')
    await page.getByTestId('int-submit').click()
    const missing = await page
      .getByTestId('int-student')
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing)
    expect(missing).toBe(true)
    await expectStat(kpi(page, 'total'), '0', 'Jumlah Intervensi')
    await expect(page.getByTestId('int-empty')).toBeVisible()
    await expect(page.getByTestId('int-form')).toBeVisible()
  })

  test(
    'E2E-M12-50 S7 creating two interventions updates the KPIs and the list, newest first @m12',
    provisional('SRS FR-M12-74/76: the save and the list layout are INFERRED / PROPOSED', [
      moduleTag(12),
    ]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp(S7)
      const toggle = page.getByTestId('int-form-toggle')
      const list = page.getByTestId('int-list')
      await toggle.click()
      await page.getByTestId('int-student').fill('4664')
      await pickOption(page, page.getByTestId('int-type'), 'Tidak Aktif')
      await page.getByTestId('int-desc').fill('Tidak aktif dua minggu')
      await page.getByTestId('int-action').fill('Hubungi guru kelas')
      await page.getByTestId('int-before').fill('73.1')
      await page.getByTestId('int-submit').click()
      await expect(dsRows(list)).toHaveCount(1)
      await expect(page.getByTestId('int-form')).toBeHidden()
      await expectStat(kpi(page, 'total'), '1', 'Jumlah Intervensi')
      await expectStat(kpi(page, 'pending'), '1', 'Menunggu Semakan')
      await expect(page.getByTestId('int-row-status')).toHaveText(['Menunggu Semakan'])

      await toggle.click()
      await page.getByTestId('int-student').fill('4644')
      await page.getByTestId('int-desc').fill('Prestasi menurun')
      await page.getByTestId('int-action').fill('Bimbingan tambahan')
      await page.getByTestId('int-before').fill('40.0')
      await page.getByTestId('int-after').fill('55.5')
      await page.getByTestId('int-submit').click()
      await expect(dsRows(list)).toHaveCount(2)
      await expectStat(kpi(page, 'total'), '2', 'Jumlah Intervensi')
      await expectStat(kpi(page, 'pending'), '1', 'Menunggu Semakan')
      await expectStat(kpi(page, 'up'), '1', 'Meningkat')
      await expectStat(kpi(page, 'down'), '0', 'Menurun')
      await expect(page.getByTestId('int-row-status')).toHaveText(['Meningkat', 'Menunggu Semakan'])
      await expect(page.getByTestId('int-row-student').first()).toContainText('4644')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M12-51 S7 an unknown student id shows "Pelajar tidak dijumpai." and stores nothing @m12',
    provisional('SRS BR-M12-27: the check and its copy are PROPOSED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp(S7)
      await page.getByTestId('int-form-toggle').click()
      await page.getByTestId('int-student').fill('99999999')
      await page.getByTestId('int-desc').fill('Tidak aktif')
      await page.getByTestId('int-action').fill('Hubungi guru')
      await page.getByTestId('int-submit').click()
      await expect(page.getByTestId('int-student-error')).toHaveText('Pelajar tidak dijumpai.')
      await expect(page.getByTestId('int-form')).toBeVisible()
      await expect(page.getByTestId('int-student')).toHaveValue('99999999')
      await expectStat(kpi(page, 'total'), '0', 'Jumlah Intervensi')
      await expect(page.getByTestId('int-empty')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test('E2E-M12-11 GET /interventions/{id} and /interventions/create render the 404 page (DV-M12-11) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const path of [`${S7}/1`, `${S7}/create`]) {
      await gotoApp(path)
      await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
      await expectErrorPage(page, '404')
      await expect(page.getByText('405')).toHaveCount(0)
    }
  })
})

// ---------------------------------------------------------------------------------------------- S8

test.describe('M12 S8 student detail (admin)', MODULE, () => {
  test('E2E-M12-05/52 S8 student A: header, summary, tiles, Head Count, platform bars, stacking @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S8(4664))
    await expectTabTitle(page, 'Kirkpatrick — Pelajar Demo 004664 | PRESTASIPLUS')
    await expect(page.getByTestId('pentadbiran-header').locator('h1')).toHaveText(
      'Kirkpatrick — Pelajar Demo 004664',
    )
    await expect(page.getByTestId('pentadbiran-subtitle')).toHaveCount(0)
    await expect(page.getByTestId('pel-name')).toHaveText('Pelajar Demo 004664')
    await expect(page.getByTestId('pel-school')).toContainText('· Tingkatan 5')
    const back = page.getByTestId('pel-back')
    await expect(back).toHaveText('Kembali ke Tahap 3', TEXT)
    await expect(back).toHaveAttribute('href', S4)
    const alesa = page.getByTestId('pel-alesa')
    if (ALESA_ON) {
      await expect(alesa).toContainText('AI')
      await expect(alesa).toContainText('ALESA — Analisis Tingkah Laku Kirkpatrick')
      await expect(page.getByTestId('pel-paragraph')).toHaveText(
        'Penggunaan Prestasi Plus oleh Pelajar Demo 004664 masih pada tahap minimum dengan hanya 4 hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi. Ketepatan jawapan pada 73.1% menunjukkan pemahaman yang baik. Subjek terkuat: Sejarah (78.9%).',
      )
    } else {
      await expect(alesa).toContainText('Ringkasan Pelajar')
      await expect(page.getByTestId('pel-paragraph')).toHaveCount(0)
    }
    await expect(page.getByTestId('pel-tile-answers')).toContainText('219')
    await expect(page.getByTestId('pel-tile-accuracy')).toContainText('73%')
    await expect(page.getByTestId('pel-tile-konsistensi')).toContainText('22.5')
    await expect(page.getByTestId('pel-tile-streak')).toContainText('1d')
    await expect(page.getByTestId('pel-strength')).toHaveText(
      'Terkuat: Sejarah (79%) · Perlu perhatian: Matematik (17%)',
      TEXT,
    )
    await expect(page.getByTestId('pel-hc-heading')).toHaveText('2026 — Head Count')
    expect(await texts(page.getByTestId('pel-hc-row'))).toEqual([
      'Bahasa Inggeris -',
      'Bahasa Melayu -',
      'Matematik -',
      'Pendidikan Islam TOV:78.00',
      'Pendidikan Jasmani & Kesihatan -',
      'Pendidikan Moral -',
      'Perniagaan -',
      'Pertanian -',
      'Prinsip Perakaunan -',
      'Sains -',
      'Sains Komputer -',
      'Sejarah -',
    ])
    await expect(page.getByTestId('pel-plat-value')).toHaveText(['79% (190)', '39% (23)', '17% (6)'])
    // barColor (pelajar-format.ts): >= 70 success, 50-69 warning, below error.
    const bar = page.getByTestId('pel-plat-bar')
    await expect(bar.nth(0).locator('[class*="bg-success"]')).not.toHaveCount(0)
    await expect(bar.nth(1).locator('[class*="bg-error"]')).not.toHaveCount(0)
    await expect(bar.nth(2).locator('[class*="bg-error"]')).not.toHaveCount(0)

    const name = (await page.getByTestId('pel-name').boundingBox())!
    const link = (await back.boundingBox())!
    if (isMobileWidth(page)) expect(link.y).toBeGreaterThanOrEqual(name.y + name.height - 1)
    else expect(link.y).toBeLessThan(name.y + name.height)
    const tiles = page.locator('[data-testid^="pel-tile-"]')
    expect(await columns(tiles)).toBe(isMobileWidth(page) ? 2 : 4)
    const cards = page.locator('[data-testid="pel-headcount"], [data-testid="pel-platform"]')
    expect(await columns(cards)).toBe(viewportWidth(page) >= 768 ? 2 : 1)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-53 S8 student B: no accuracy sentence, Head Count and warning / error bars @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S8(4644))
    if (ALESA_ON) {
      await expect(page.getByTestId('pel-paragraph')).toHaveText(
        'Penggunaan Prestasi Plus oleh Pelajar Demo 004644 masih pada tahap minimum dengan hanya 3 hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi. Subjek terkuat: Bahasa Melayu (60.0%).',
      )
    } else {
      await expect(page.getByTestId('pel-paragraph')).toHaveCount(0)
    }
    await expect(page.getByTestId('pel-tile-answers')).toContainText('70')
    await expect(page.getByTestId('pel-tile-accuracy')).toContainText('39%')
    await expect(page.getByTestId('pel-tile-konsistensi')).toContainText('21.1')
    await expect(page.getByTestId('pel-strength')).toHaveText(
      'Terkuat: Bahasa Melayu (60%) · Perlu perhatian: Sejarah (0%)',
      TEXT,
    )
    expect(await texts(page.getByTestId('pel-hc-row'))).toEqual([
      'Bahasa Inggeris TOV:20.00',
      'Bahasa Melayu TOV:60.00',
      'Matematik TOV:40.00',
      'Pendidikan Islam TOV:55.00',
      'Pendidikan Jasmani & Kesihatan -',
      'Pendidikan Moral -',
      'Pertanian -',
      'Sains TOV:33.33',
      'Sains Rumah Tangga -',
      'Sains Sukan TOV:37.00',
      'Sejarah -',
    ])
    await expect(page.getByTestId('pel-plat-value')).toHaveText([
      '60% (5)',
      '55% (20)',
      '40% (15)',
      '33% (15)',
      '20% (10)',
      '0% (5)',
    ])
    const bars = page.getByTestId('pel-plat-bar')
    await expect(bars.nth(0).locator('[class*="bg-warning"]')).not.toHaveCount(0)
    await expect(bars.nth(1).locator('[class*="bg-warning"]')).not.toHaveCount(0)
    for (const i of [2, 3, 4, 5]) {
      await expect(bars.nth(i).locator('[class*="bg-error"]')).not.toHaveCount(0)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-12/63 S8 with an id that is not an accessible student (5571, 5551, 99999999) renders the 403 page for the admin @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // SRS M12 FR-M12-17 / FR-M12-78: the admin gets the 403 page for these ids (mock/handlers/students.ts:21). D-T02-2
    // (404 instead of 403, r1-development-plan.md:1633) covers the school admin and the teacher only.
    await loginAs(ADMIN)
    for (const id of [5571, 5551, 99_999_999]) {
      await gotoApp(S8(id))
      await expectTabTitle(page, 'Akses Ditolak | PRESTASIPLUS')
      await expectErrorPage(page, '403')
      await expect(page).toHaveURL(new RegExp(`${S8(id)}$`))
      await expect(page.getByTestId('pel-name')).toHaveCount(0)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-10 S8 with a non-numeric id renders the 404 page @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S8('abc'))
    await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
    await expectErrorPage(page, '404')
  })

  test(
    'E2E-M12-55 S8 of a T4/T5 student without answers shows 0 / 0% / 0 / 0d and an empty platform card @m12',
    provisional('SRS FN-M12-9.5.1: the zero state is INFERRED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp(`${S5}?school_id=8080`)
      const card = page.getByTestId('res-predictions')
      await expect(pagerSummary(card)).toContainText('daripada 53 hasil', S5_READY)
      const ids = await collectPages(card, async (scope) =>
        scope
          .locator('[data-testid="pred-student"]')
          .evaluateAll((els) => els.map((e) => Number(e.getAttribute('href')!.split('/').pop()))),
      )
      expect(ids).toHaveLength(53)
      const active = new Set(ids)
      let found = false
      for (let id = 4601; id <= 4640 && !found; id++) {
        if (active.has(id)) continue
        await spaGo(page, S8(id))
        const outcome = await Promise.race([
          page
            .getByTestId('pel-name')
            .waitFor({ timeout: 8000 })
            .then(() => 'page'),
          page
            .locator('[data-ds="error-page"]')
            .waitFor({ timeout: 8000 })
            .then(() => 'denied'),
        ]).catch(() => 'none')
        if (outcome !== 'page') continue
        found = true
        await expect(page.getByTestId('pel-tile-answers')).toContainText('0')
        await expect(page.getByTestId('pel-tile-accuracy')).toContainText('0%')
        await expect(page.getByTestId('pel-tile-streak')).toContainText('0d')
        await expect(page.getByTestId('pel-plat-row')).toHaveCount(0)
        await expect(page.getByTestId('pel-strength')).toHaveCount(0)
        await expectNoHorizontalScroll(page)
      }
      expect(found, 'a T4/T5 student of school 8080 without answers').toBe(true)
    },
  )
})

// ---------------------------------------------------------------------------------- twins and roles

test.describe('M12 S4-S8: the /guru twins', MODULE, () => {
  test('E2E-M12-07/15 admin on the /guru twins: same content, links follow the /guru mount @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // The admin is in Pentadbiran whatever the mount (layouts.ts:37-49).
    await loginAs(ADMIN)
    await gotoApp('/guru/kirkpatrick/behavior')
    await expectHeader(page, 'pentadbiran', TITLES.s4)
    await expect(page.getByTestId('pentadbiran-header')).toBeVisible()
    await expectStat(page.getByTestId('beh-kpi-t4t5'), '4,158', 'Pelajar')
    await expectStat(page.getByTestId('beh-kpi-active'), '946', 'Pernah Aktif')
    await expectStat(page.getByTestId('beh-kpi-sessions'), '20,991', 'Jumlah Sesi')
    await expectStat(page.getByTestId('beh-kpi-answers'), '306,133', 'Soalan Dijawab')
    await expectStat(page.getByTestId('beh-kpi-accuracy'), '83%', 'Ketepatan')
    await expectStat(page.getByTestId('beh-kpi-teachers'), '53.1%', 'Guru Aktif', '277/522')
    await expect(
      page.getByTestId('pentadbiran-section-tabs').getByRole('link', { name: 'T4: Hasil' }),
    ).toHaveAttribute('href', '/guru/kirkpatrick/results')
    await expect(page.getByTestId('beh-band-champion')).toHaveAttribute('href', '/guru/monitoring')
    await expect(page.getByTestId('beh-school-link').first()).toHaveAttribute(
      'href',
      '/guru/monitoring/sekolah/9681',
    )
    await expectNoHorizontalScroll(page)

    await spaGo(page, '/guru/kirkpatrick/results')
    await expectHeader(page, 'pentadbiran', TITLES.s5)
    await expectStat(
      page.getByTestId('res-kpi-gps'),
      '4.30',
      'GPS Headcount',
      '41 rekod · 2025',
    )
    await expectStat(page.getByTestId('res-kpi-records'), '4,378', 'Rekod Headcount', 'Data OTR')
    await spaGo(page, '/guru/kirkpatrick/chain')
    await expect(page.getByTestId('pentadbiran-header').locator('h1')).toHaveText(
      'Rantaian Impak T1 → T4',
    )
    await expect(page.getByTestId('chain-back')).toHaveAttribute('href', '/guru/kirkpatrick')
    await spaGo(page, '/guru/kirkpatrick/interventions')
    await expectHeader(page, 'pentadbiran', TITLES.s7Guru)
    await spaGo(page, '/guru/kirkpatrick/pelajar/4664')
    await expect(page.getByTestId('pel-name')).toHaveText('Pelajar Demo 004664')
    await expect(page.getByTestId('pel-back')).toHaveAttribute('href', '/guru/kirkpatrick/behavior')
  })

  test('E2E-M12-08 /guru/kirkpatrick/behavior marks the Kirkpatrick row active in the sidebar @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.skip(!isDesktopShell(page), 'the sidebar is the drawer below 1024 px (covered by M12-T2)')
    await loginAs(ADMIN)
    await gotoApp('/guru/kirkpatrick/behavior')
    await expect(dsRows(page.getByTestId('beh-schools')).first()).toBeVisible()
    // One row "Kirkpatrick" stands for the seven pages (menu.ts:111); the current page is the active section tab.
    await expect(page.getByTestId('pentadbiran-nav').locator('[aria-current="page"]')).toContainText(
      'Kirkpatrick',
    )
    await expect(activeTab(page)).toHaveText('T3: Tingkah Laku', TEXT)
  })

  test(
    'guru 5 on /guru S4-S8 sees the platform figures in the Pembelajaran shell @m12',
    provisional('SRS §9 Q-M12-1: the teacher view is INFERRED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/kirkpatrick/behavior')
      await expectHeader(page, 'pembelajaran', TITLES.s4)
      await expect(page.getByTestId('pentadbiran-header')).toHaveCount(0)
      await expectStat(page.getByTestId('beh-kpi-t4t5'), '4,158', 'Pelajar')
      await expectStat(page.getByTestId('beh-kpi-answers'), '306,133', 'Soalan Dijawab')
      await expectNoHorizontalScroll(page)

      await spaGo(page, '/guru/kirkpatrick/results')
      await expectHeader(page, 'pembelajaran', TITLES.s5)
      await expectStat(
        page.getByTestId('res-kpi-gps'),
        '4.30',
        'GPS Headcount',
        '41 rekod · 2025',
      )
      await expect(pagerSummary(page.getByTestId('res-predictions'))).toContainText(
        'daripada 946 hasil',
        S5_READY,
      )

      await spaGo(page, '/guru/kirkpatrick/chain')
      await expect(page.getByTestId('chain-t1').getByTestId('chain-value')).toHaveText([
        '8.3/10',
        '4.6/5',
        '336',
      ])

      await spaGo(page, '/guru/kirkpatrick/interventions')
      await expectHeader(page, 'pembelajaran', TITLES.s7Guru)
      await expectStat(page.getByTestId('int-kpi-total'), '0', 'Jumlah Intervensi')
      // C-57: only the Admin Pusat form is cut to the three V2 types; the guru mount keeps "Lain-lain".
      await page.getByTestId('int-form-toggle').click()
      expect(await selectOptions(page, page.getByTestId('int-type'))).toEqual([
        'Mood / Kesejahteraan',
        'Tidak Aktif',
        'Prestasi Menurun',
        'Lain-lain',
      ])

      // S6-T02 / D-T02-2: S8 is scoped to the viewer's school (mock/handlers/common.ts:87-90). Student A (4664) is outside
      // the school of guru 5 -> the 404 page; pupil 3001 of the same school renders.
      await spaGo(page, '/guru/kirkpatrick/pelajar/4664')
      await expectErrorPage(page, '404')
      await expect(page.getByTestId('pel-name')).toHaveCount(0)
      await spaGo(page, '/guru/kirkpatrick/pelajar/3001')
      await expect(page.getByTestId('pel-name')).toHaveText('Murid Demo 01')
      await expect(page.getByTestId('pel-tile-answers')).toContainText('0')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'guru 5 following an /admin/kirkpatrick target gets the in-place 403 page @m12',
    provisional('SRS §9: the non-admin rule on /admin/* is INFERRED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      for (const path of [S4, S5, S6, S7, S8(4664)]) {
        await gotoApp(path)
        await expectErrorPage(page, '403')
        await expect(page).toHaveURL(new RegExp(`${path}$`))
        await expect(page.getByTestId('kirk-behavior')).toHaveCount(0)
        await expect(page.getByTestId('kirk-results')).toHaveCount(0)
      }
    },
  )

  test(
    'school administrator 8: all seven screens under /admin-sekolah/kirkpatrick, the other mounts are 403 @m12',
    provisional('FR-AS-11-1 / G4 decision F6: the school administrator reaches every screen of its own mount', [
      moduleTag(12),
    ]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(SCHOOL_ADMIN)
      for (const [path, id] of [
        ['behavior', 'kirk-behavior'],
        ['results', 'kirk-results'],
        ['chain', 'kirk-chain'],
        ['interventions', 'kirk-interventions'],
        ['pelajar/3001', 'kirk-pelajar'],
      ] as const) {
        await gotoApp(`${ALIAS}/${path}`)
        await expect(page.getByTestId('pembelajaran-header')).toBeVisible()
        await expect(page.getByTestId(id)).toBeVisible()
        await expect(page.locator('[data-ds="error-page"]')).toHaveCount(0)
      }
      // S6-T02 / D-T02-2: a pupil of another school (Student A, 4664) is the 404 page on the own mount.
      await gotoApp(`${ALIAS}/pelajar/4664`)
      await expectErrorPage(page, '404')
      await expect(page.getByTestId('kirk-pelajar')).toHaveCount(0)
      for (const prefix of ['/guru/kirkpatrick', '/admin/kirkpatrick']) {
        for (const path of ['behavior', 'results', 'chain', 'interventions', 'pelajar/4664']) {
          await gotoApp(`${prefix}/${path}`)
          await expectErrorPage(page, '403')
          await expect(page).toHaveURL(new RegExp(`${prefix}/${path}$`))
          for (const id of [
            'kirk-behavior',
            'kirk-results',
            'kirk-chain',
            'kirk-interventions',
            'kirk-pelajar',
          ]) {
            await expect(page.getByTestId(id)).toHaveCount(0)
          }
        }
      }
    },
  )
})
