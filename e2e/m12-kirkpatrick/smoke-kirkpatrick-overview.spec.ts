/**
 * M12 S1 `/admin/kirkpatrick`, S2 `.../reaction`, S3 `.../learning`, the `/guru/kirkpatrick` twins and the
 * `/admin-sekolah/kirkpatrick` mount at 375 / 768 / 1280 (M12-T2; SRS M12 §12: E2E-M12-03, 04, 07, 08, 09 (S1-S3
 * part), 13, 16-25, 27-30, 60 (S1-S3 part), 61, 65 (S1 part)). Accounts: admin 1 (`admin@demo.test`), guru 5
 * (`guru@demo.test`), school administrator 8 (`adminsekolah@demo.test`).
 *
 * T-C11 rewrite to the Pentadbiran / Pembelajaran shells: Admin Pusat is in Pentadbiran (`pentadbiran-*`), the
 * teacher and the school administrator in Pembelajaran (`pembelajaran-*`); the section tabs belong to the shell;
 * the tab title is "{Page} | PRESTASIPLUS"; accuracy is a whole number (XS-5: r1-development-plan.md:1378, 1535);
 * counts carry thousands separators; DS filter bar / data table / stat tiles replaced the kirk-* DOM.
 *
 * Figures are the observed anchors of SRS M12 §6.7 (DATA-M12-06) and the M12 mock repository (src/modules/
 * m12-kirkpatrick/mock/repository, constants in mock/data/constants.ts:15-48); accuracies are those anchors
 * rounded half away from zero (82.8 -> 83%).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
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
  columns,
  dsRows,
  expectErrorPage,
  expectHeader,
  expectStat,
  hrefs,
  isWide,
  openFilters,
  pagerSummary,
  showAllRows,
} from './kirk-helpers'

const ADMIN = 'admin@demo.test'
const GURU = 'guru@demo.test'
const SCHOOL_ADMIN = 'adminsekolah@demo.test'
const MODULE = { tag: [moduleTag(12)] }

test.use({ mockInit: { latency: 0 } })

const S1 = '/admin/kirkpatrick'
const S2 = '/admin/kirkpatrick/reaction'
const S3 = '/admin/kirkpatrick/learning'
const ALIAS = '/admin-sekolah/kirkpatrick'

const TITLES = {
  s1: ['Kirkpatrick', 'Model penilaian Kirkpatrick — 4 tahap keberkesanan'],
  // /guru mount: the page is headed "Kirkpatrick Evaluation" (V2 guru view, route overview.ts).
  s1Guru: ['Kirkpatrick Evaluation', 'Model penilaian Kirkpatrick — 4 tahap keberkesanan'],
  s2: ['T1: Reaksi', 'Kirkpatrick Tahap 1 — Kepuasan pengguna'],
  s3: ['T2: Pembelajaran', 'Kirkpatrick Tahap 2 — Peningkatan kemahiran'],
} as const

/** Labels of the section tabs the shell draws (src/shells/pentadbiran/menu.ts, V2 Kirkpatrick tab list + Rantaian Impak). */
const SECTION_TABS = [
  'Overview',
  'T1: Reaksi',
  'T2: Pembelajaran',
  'T3: Tingkah Laku',
  'T4: Hasil',
  'Rantaian Impak',
  'Intervensi',
] as const

async function registeredCount(page: Page): Promise<number> {
  const text = await page.getByTestId('kirk-kpi-registered').innerText()
  return Number(/^\s*([\d,]+)/.exec(text)![1]!.replace(/,/g, ''))
}

const level = (page: Page, id: string) => page.getByTestId(`kirk-level-${id}`)
const levelValue = (page: Page, id: string) => level(page, id).getByTestId('kirk-level-value')
const levelCaption = (page: Page, id: string) => level(page, id).getByTestId('kirk-level-caption')

async function expectLevels(
  page: Page,
  v: Record<'t4' | 't3' | 't2' | 't1', readonly [string, string]>,
) {
  for (const id of ['t4', 't3', 't2', 't1'] as const) {
    await expect(levelValue(page, id)).toHaveText(v[id][0], TEXT)
    await expect(levelCaption(page, id)).toHaveText(v[id][1], TEXT)
  }
}

const S1_PLATFORM = {
  t4: ['4.30', 'GPS Sekolah · 4,378 rekod headcount'],
  t3: ['946/4,158', 'Pelajar aktif · 20,991 sesi · 83% ketepatan'],
  t2: ['83%', 'Ketepatan · 306,133 soalan dijawab'],
  t1: ['4.6/5', 'Kepuasan purata · 336 respon'],
} as const

const S1_8080 = {
  t4: ['4.00', 'GPS Sekolah · 4,378 rekod headcount'],
  t3: ['53/184', 'Pelajar aktif · 1,002 sesi · 76% ketepatan'],
  t2: ['76%', 'Ketepatan · 15,007 soalan dijawab'],
  t1: ['4.6/5', 'Kepuasan purata · 336 respon'],
} as const

test.describe('M12 S1-S3: admin', MODULE, () => {
  test('E2E-M12-04/07 header, tab title and Pentadbiran shell of S1, S2, S3 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const [path, titles] of [
      [S1, TITLES.s1],
      [S2, TITLES.s2],
      [S3, TITLES.s3],
    ] as const) {
      await gotoApp(path)
      await expectHeader(page, 'pentadbiran', titles)
      await expect(page.getByTestId('pentadbiran-header')).toBeVisible()
      if (isDesktopShell(page)) await expect(page.getByTestId('pentadbiran-sidebar')).toBeVisible()
      else await expect(page.getByTestId('pentadbiran-menu-button')).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })

  test('E2E-M12-03 section tabs of the shell: 7 links, current highlighted, unfiltered hrefs @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const [path, current] of [
      [S1, 'Overview'],
      [`${S2}?school_id=8080`, 'T1: Reaksi'],
      [`${S3}?school_id=8080`, 'T2: Pembelajaran'],
    ] as const) {
      await gotoApp(path)
      const strip = page.getByTestId('pentadbiran-section-tabs')
      const tabs = strip.locator('a')
      await expect(tabs).toHaveText([...SECTION_TABS], TEXT)
      expect(await hrefs(tabs)).toEqual([
        '/admin/kirkpatrick',
        '/admin/kirkpatrick/reaction',
        '/admin/kirkpatrick/learning',
        '/admin/kirkpatrick/behavior',
        '/admin/kirkpatrick/results',
        '/admin/kirkpatrick/chain',
        '/admin/kirkpatrick/interventions',
      ])
      const active = strip.locator('a[data-active="true"]')
      await expect(active).toHaveCount(1)
      await expect(active).toHaveText(current, TEXT)
      await expect(active).toHaveAttribute('aria-current', 'page')
      if (!isDesktopShell(page)) await expectTouchTarget(active)
      await expectNoHorizontalScroll(page)
    }
  })

  test('E2E-M12-03b one tab strip only: the page does not draw a second one under the shell strip @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // V2 has one tab bar per Kirkpatrick page (Filament KirkpatrickReaction.php:43-49). The shell strip
    // (PentadbiranLayout.vue:136-144) and the page strip (KirkpatrickTabs.vue, used by KirkpatrickReactionPage.vue:174)
    // are both drawn on S2-S5 and S7 -> two navigation bars with different labels ("T1: Reaksi" / "Tahap 1: Reaksi").
    await loginAs(ADMIN)
    for (const path of [S2, S3]) {
      await gotoApp(path)
      await expect(page.getByTestId('pentadbiran-section-tabs')).toBeVisible()
      await expect(page.getByTestId('kirk-tabs')).toHaveCount(0)
    }
  })

  test('E2E-M12-16/19 S1 filter: 58 school and 11 state options, Tapis, no Reset; selects fit the card @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await openFilters(page)
    await expect(page.locator('[data-testid="kirk-filter-school"] option')).toHaveCount(58)
    await expect(page.locator('[data-testid="kirk-filter-state"] option')).toHaveCount(11)
    await expect(page.locator('[data-testid="kirk-filter-school"] option').first()).toHaveText(
      'Semua Sekolah',
    )
    await expect(page.locator('[data-testid="kirk-filter-state"] option')).toHaveText([
      'Semua Negeri',
      'Johor',
      'Kedah',
      'Kelantan',
      'Kuala Lumpur',
      'Melaka',
      'Pahang',
      'Perak',
      'Sabah',
      'Selangor',
      'Terengganu',
    ])
    if (isWide(page)) {
      await expect(page.getByRole('button', { name: 'Tapis', exact: true })).toBeVisible()
    } else {
      await expect(
        page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna' }),
      ).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toHaveCount(0)

    const names = await page
      .locator('[data-testid="kirk-filter-school"] option:not([value=""])')
      .allTextContents()
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))

    const card = await page
      .locator(isWide(page) ? '[data-testid="kirk-filter"]' : '[data-ds="filter-sheet"]')
      .boundingBox()
    for (const name of ['Sekolah', 'Negeri']) {
      const select = page.getByRole('combobox', { name, exact: true })
      if (!isDesktopShell(page)) await expectTouchTarget(select)
      else await expect(select).toBeVisible()
      const box = await select.boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(card!.x + card!.width + 1)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-17 S1 school 8080: Tapis, URL, chip, Reset and the scoped values @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await expect(levelValue(page, 't4')).toHaveText('4.30', TEXT)
    await openFilters(page)
    await page.getByTestId('kirk-filter-school').selectOption('8080')
    await applyFilters(page)
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\?school_id=8080&state=$/)
    await expectLevels(page, S1_8080)
    const kpis = page.getByTestId('kirk-kpis')
    await expectStat(page.getByTestId('kirk-kpi-registered'), '184', 'Pelajar Berdaftar')
    await expectStat(page.getByTestId('kirk-kpi-answers'), '15,007', 'Soalan Dijawab')
    await expectStat(page.getByTestId('kirk-kpi-teachers'), '34/34', 'Guru Aktif')
    await expectStat(page.getByTestId('kirk-kpi-accuracy'), '76%', 'Ketepatan Keseluruhan')
    await expect(kpis).toBeVisible()
    await expect(page.getByTestId('kirk-band-count')).toHaveText(['36', '8', '9', '0', '131'])
    await expect(page.getByTestId('kirk-band-pct')).toHaveText([
      '19.6%',
      '4.3%',
      '4.9%',
      '0%',
      '71.2%',
    ])
    await expectNoHorizontalScroll(page)

    // The applied school is a removable chip with a Reset link; Reset goes back to the unfiltered page.
    await expect(page.locator('[data-ds="filter-bar"]')).toContainText('Sekolah:')
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick$/)
    await expect(levelValue(page, 't4')).toHaveText('4.30', TEXT)
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toHaveCount(0)
  })

  test('E2E-M12-18 S1 ?state=Kelantan: zero values, GPS stays 4.30 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S1}?state=Kelantan`)
    await expectLevels(page, {
      t4: ['4.30', 'GPS Sekolah · 4,378 rekod headcount'],
      t3: ['0/0', 'Pelajar aktif · 0 sesi · 0% ketepatan'],
      t2: ['0%', 'Ketepatan · 0 soalan dijawab'],
      t1: ['4.6/5', 'Kepuasan purata · 336 respon'],
    })
    await expect(page.getByTestId('kirk-comparison-subtitle')).toHaveText(
      'Tiada Data vs Tiada Data',
    )
    await expect(page.getByTestId('kirk-panel-range')).toHaveText(['-', '-'])
    await expect(page.getByTestId('kirk-summary')).toContainText(
      'Data tidak mencukupi untuk perbandingan.',
    )
    await expect(page.getByTestId('kirk-kpi-teachers')).toContainText('0/0')
    await expect(page.getByTestId('kirk-band-count')).toHaveText(['0', '0', '0', '0', '0'])
    await expect(page.getByTestId('kirk-band-pct')).toHaveText(['0%', '0%', '0%', '0%', '0%'])
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-20 S1 level cards: texts, targets and 1 / 2 / 4 columns @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await expectLevels(page, S1_PLATFORM)
    const cards = page.getByTestId('kirk-levels').locator('> a')
    await expect(cards).toHaveCount(4)
    // T1 to T4, the order of the Evaluation Flow (recorded layout decision, TRACKER 2026-10-30 item 2).
    expect(await hrefs(cards)).toEqual([
      '/admin/kirkpatrick/reaction',
      '/admin/kirkpatrick/learning',
      '/admin/kirkpatrick/behavior',
      '/admin/kirkpatrick/results',
    ])
    await expect(cards).toContainText([
      'Lihat detail',
      'Lihat detail',
      'Lihat detail',
      'Lihat detail',
    ])
    const w = viewportWidth(page)
    expect(await columns(cards)).toBe(w >= 1024 ? 4 : w >= 640 ? 2 : 1)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-21 S1 flow: circles from 640, vertical list below, pills with the scope @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    const mobile = isMobileWidth(page)
    const group = page.getByTestId(mobile ? 'kirk-flow-list' : 'kirk-flow-circles')
    await expect(group).toBeVisible()
    await expect(page.getByTestId(mobile ? 'kirk-flow-circles' : 'kirk-flow-list')).toBeHidden()
    await expect(page.getByTestId('kirk-flow')).toContainText(
      'Klik mana-mana tahap untuk lihat detail',
    )
    expect(await hrefs(group.locator('a'))).toEqual([
      '/admin/kirkpatrick/reaction',
      '/admin/kirkpatrick/learning',
      '/admin/kirkpatrick/behavior',
      '/admin/kirkpatrick/results',
    ])
    await expect(group.getByTestId('kirk-flow-pill')).toHaveText([
      '4.6/5',
      '83% ketepatan',
      '946 pelajar aktif',
      'GPS 4.30',
    ])
    if (!mobile) {
      await expect(group).toContainText('Kepuasan pengguna')
      await expect(group).toContainText('Peningkatan kemahiran')
      await expect(group).toContainText('Konsistensi penggunaan')
      await expect(group).toContainText('Keputusan peperiksaan')
    }
    await gotoApp(`${S1}?school_id=8080`)
    await expect(group.getByTestId('kirk-flow-pill')).toHaveText([
      '4.6/5',
      '76% ketepatan',
      '53 pelajar aktif',
      'GPS 4.00',
    ])
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-22 S1 comparison default: subtitle, ranges, values, green deltas @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await expect(page.getByTestId('kirk-comparison-subtitle')).toHaveText(
      'Januari 2026 vs September 2026',
    )
    await expect(page.getByTestId('kirk-panel-range')).toHaveText([
      '01 Jan 2026 - 31 Jan 2026',
      '01 Sep 2026 - 25 Sep 2026',
    ])
    const before = page.getByTestId('kirk-panel-before')
    const after = page.getByTestId('kirk-panel-after')
    await expect(before).toContainText('SEBELUM')
    await expect(after).toContainText('SELEPAS')
    await expect(before.getByTestId('kirk-panel-value')).toHaveText(['2', '33%', '3', '0'])
    await expect(after.getByTestId('kirk-panel-value')).toHaveText(['58', '87%', '13,968', '28'])
    await expect(before).toContainText('Pelajar Aktif')
    await expect(before).toContainText('Jumlah Jawapan')
    await expect(page.getByTestId('kirk-delta-value')).toHaveText([
      '+56',
      '+54%',
      '+13,965',
      '+28',
    ])
    for (const k of ['active', 'accuracy', 'answers', 'champions']) {
      await expect(page.getByTestId(`kirk-delta-${k}`)).toHaveAttribute('data-tone', 'up')
    }
    if (isMobileWidth(page)) {
      expect(await columns(page.getByTestId('kirk-deltas').locator('> div'))).toBe(2)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-22b S1 comparison Ringkasan sentence follows V2 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // V2 admin/kirkpatrick/overview.blade.php:240-246. The app prints the API sentences (OverviewComparison.vue:summary,
    // sentences from the M12 mock repository): "Peningkatan 53.7% dalam ketepatan jawapan. 56 pelajar baru mula aktif. ...".
    await loginAs(ADMIN)
    await gotoApp(S1)
    await expect(page.getByTestId('kirk-summary')).toHaveText(
      'Ringkasan: 56 pelajar baru mula aktif berbanding Januari. Ketepatan jawapan meningkat 53.7%. Jumlah jawapan bertambah 13,965. 28 pelajar naik ke tahap Champion.',
      TEXT,
    )
  })

  test('E2E-M12-22c S1 comparison panels sit side by side above 768 and stack at 768 and below (V2) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // V2 overview.blade.php:95-101: .kp-ba is two columns, one column at max-width 768. The app stacks them at every
    // width (OverviewComparison.vue: panels are flex-col siblings).
    await loginAs(ADMIN)
    await gotoApp(S1)
    const b = await page.getByTestId('kirk-panel-before').boundingBox()
    const a = await page.getByTestId('kirk-panel-after').boundingBox()
    if (viewportWidth(page) > 768) {
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
    } else {
      expect(a!.y).toBeGreaterThan(b!.y + b!.height - 2)
    }
  })

  test('E2E-M12-23 S1 comparison with ?school_id=8080 (red deltas, Penurunan) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S1}?school_id=8080`)
    await expect(page.getByTestId('kirk-comparison-subtitle')).toHaveText(
      'April 2026 vs September 2026',
    )
    await expect(page.getByTestId('kirk-panel-range')).toHaveText([
      '01 Apr 2026 - 30 Apr 2026',
      '01 Sep 2026 - 25 Sep 2026',
    ])
    await expect(page.getByTestId('kirk-panel-before').getByTestId('kirk-panel-value')).toHaveText([
      '12',
      '72%',
      '511',
      '3',
    ])
    await expect(page.getByTestId('kirk-panel-after').getByTestId('kirk-panel-value')).toHaveText([
      '1',
      '55%',
      '60',
      '1',
    ])
    await expect(page.getByTestId('kirk-delta-value')).toHaveText(['-11', '-17%', '-451', '-2'])
    await expect(page.getByTestId('kirk-delta-active')).toHaveAttribute('data-tone', 'down')
    await expect(page.getByTestId('kirk-summary')).toContainText(
      'Penurunan 16.6% dalam ketepatan jawapan. 11 pelajar kurang aktif berbanding sebelumnya.',
      TEXT,
    )
  })

  test('E2E-M12-24 S1 KPI links, engagement tiles (3,212 / 77.2%, sum 4,158) and the info card @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    const kpis = page.getByTestId('kirk-kpis')
    await expectStat(page.getByTestId('kirk-kpi-registered'), '4,158', 'Pelajar Berdaftar')
    await expectStat(page.getByTestId('kirk-kpi-answers'), '306,133', 'Soalan Dijawab')
    await expectStat(page.getByTestId('kirk-kpi-teachers'), '277/522', 'Guru Aktif')
    await expectStat(page.getByTestId('kirk-kpi-accuracy'), '83%', 'Ketepatan Keseluruhan')
    expect(await hrefs(kpis.locator('a'))).toEqual([
      '/admin/monitoring',
      '/admin/kirkpatrick/learning',
      '/admin/monitoring',
      '/admin/kirkpatrick/learning',
    ])
    const counts = page.getByTestId('kirk-band-count')
    await expect(counts).toHaveText(['513', '259', '169', '5', '3,212'])
    await expect(page.getByTestId('kirk-band-pct')).toHaveText([
      '12.3%',
      '6.2%',
      '4.1%',
      '0.1%',
      '77.2%',
    ])
    const sum = (await counts.allTextContents()).reduce((s, v) => s + Number(v.replace(/,/g, '')), 0)
    expect(sum).toBe(4158)
    await expect(page.getByTestId('kirk-bands')).toContainText('Taburan Engagement Pelajar')
    const tiles = page.getByTestId('kirk-bands').locator('a')
    expect(await hrefs(tiles)).toEqual(Array(5).fill('/admin/kirkpatrick/behavior'))
    // 5 across from sm (640), 2 below with the last tile spanning both (OverviewBands.vue).
    expect(await columns(tiles)).toBe(viewportWidth(page) >= 640 ? 5 : 2)

    // The info card is collapsed behind "Tentang Model Kirkpatrick" (recorded layout decision, TRACKER 2026-10-30).
    const info = page.getByTestId('kirk-info')
    const toggle = page.getByTestId('kirk-info-toggle')
    await expect(info).toBeHidden()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(info).toBeVisible()
    await expect(info).toContainText('Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan')
    await expect(info).toContainText(
      'Dashboard ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick (1959).',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-25 S2 cards, and the T1 figures ignore school_id and state @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    const cards = async () => {
      await expectStat(page.getByTestId('kirk-nps-student'), '8.4/10', 'NPS Pelajar')
      await expectStat(page.getByTestId('kirk-nps-teacher'), '6.5/10', 'NPS Guru')
      await expectStat(page.getByTestId('kirk-nps-admin'), '9.6/10', 'NPS Admin')
      await expect(page.getByTestId('kirk-satisfaction')).toContainText('Kepuasan Purata')
      await expect(page.getByTestId('kirk-satisfaction')).toContainText('4.6/5')
    }
    await gotoApp(S2)
    await cards()
    await expect(page.getByTestId('kirk-filter')).toHaveCount(0)

    // 2 x 2 below lg, 4 in a row from lg.
    expect(await columns(page.getByTestId('kirk-reaction-cards').locator('> *'))).toBe(
      isDesktopShell(page) ? 4 : 2,
    )
    await expectNoHorizontalScroll(page)

    await gotoApp(`${S2}?school_id=8080`)
    await cards()
    await gotoApp(`${S1}?state=Kelantan`)
    await expect(levelValue(page, 't1')).toHaveText('4.6/5', TEXT)
    await expect(levelCaption(page, 't1')).toHaveText('Kepuasan purata · 336 respon', TEXT)
  })

  test('E2E-M12-27 S3 KPI cards, Learning Gain card and 2 / 3 / 3 columns @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S3)
    await expectStat(page.getByTestId('kirk-kpi-answers'), '306,133', 'Soalan Dijawab')
    await expectStat(page.getByTestId('kirk-kpi-accuracy'), '83%', 'Ketepatan')
    await expectStat(page.getByTestId('kirk-kpi-score'), '80.3%', 'Skor Purata')
    await expectStat(page.getByTestId('kirk-kpi-sessions'), '20,991/20,991', 'Sesi Selesai')
    await expectStat(page.getByTestId('kirk-kpi-completion'), '100%', 'Kadar Penyelesaian')
    await expectStat(page.getByTestId('kirk-kpi-gain'), '-', 'Learning Gain', 'Perlu pre/post test')
    const gain = page.getByTestId('kirk-gain-card')
    await expect(gain).toContainText('Pre-Test / Post-Test belum dimulakan')
    await expect(gain).toContainText(
      "Hake's Normalized Learning Gain akan dikira secara automatik.",
    )
    await expect(gain).toContainText(
      'g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g<0.7 · Low: g<0.3',
      TEXT,
    )
    const w = viewportWidth(page)
    const kpis = page.getByTestId('kirk-learning-kpis').locator('> *')
    // DS tile layout (src/ds/tile-layout.ts:70-79): 6 tiles, at most 3 per row, 2 below md (768).
    expect(await columns(kpis)).toBe(w >= 768 ? 3 : 2)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-28 S3 ?school_id=8080: its KPIs, no form, 24 subject rows (11 / 10 / 3) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S3}?school_id=8080`)
    await expectStat(page.getByTestId('kirk-kpi-answers'), '15,007', 'Soalan Dijawab')
    await expectStat(page.getByTestId('kirk-kpi-accuracy'), '76%', 'Ketepatan')
    await expectStat(page.getByTestId('kirk-kpi-score'), '73.3%', 'Skor Purata')
    await expectStat(page.getByTestId('kirk-kpi-sessions'), '1,002/1,002', 'Sesi Selesai')
    await expectStat(page.getByTestId('kirk-kpi-completion'), '100%', 'Kadar Penyelesaian')
    await expect(page.getByTestId('kirk-learning-page').locator('form')).toHaveCount(0)
    const rows = page.getByTestId('kirk-subject-row')
    await expect(rows).toHaveCount(24)
    await expect(
      page.locator('[data-testid="kirk-subject-row"][data-status="Mastered"]'),
    ).toHaveCount(11)
    await expect(
      page.locator('[data-testid="kirk-subject-row"][data-status="Developing"]'),
    ).toHaveCount(10)
    await expect(
      page.locator('[data-testid="kirk-subject-row"][data-status="Beginning"]'),
    ).toHaveCount(3)
    // Tie order: exact accuracy descending, then name A-Z (the three 100% rows of school 8080).
    await expect(rows.nth(0)).toContainText('Bahasa Cina')
    await expect(rows.nth(0)).toContainText('100%')
    await expect(rows.nth(0)).toContainText('10 soalan')
    await expect(rows.nth(1)).toContainText('Reka Bentuk & Teknologi')
    await expect(rows.nth(2)).toContainText('Sains Komputer')
    const pcts = (await page.getByTestId('kirk-subject-pct').allTextContents()).map((v) =>
      parseFloat(v),
    )
    expect(pcts).toEqual([...pcts].sort((a, b) => b - a))
    const row = (name: string) => rows.filter({ hasText: name })
    await expect(row('Bahasa Arab')).toContainText('45%')
    await expect(row('Bahasa Arab')).toContainText('Beginning')
    await expect(row('Bahasa Arab')).toContainText('20 soalan')
    await expect(row('Matematik Tambahan')).toContainText('40%')
    await expect(row('Biologi')).toContainText('33%')
    await expect(row('Biologi')).toContainText('30 soalan')
    // Beginning = the error colour of the bar (UProgress colour "error").
    await expect(row('Biologi').getByTestId('kirk-subject-bar').locator('[class*="bg-error"]')).not.toHaveCount(0)
    await expect(dsRows(page.getByTestId('kirk-schools'))).toHaveCount(1)
    await expect(dsRows(page.getByTestId('kirk-schools'))).toContainText('184')
    await expect(dsRows(page.getByTestId('kirk-schools'))).toContainText('15,007')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-29 S3 subjects: 26 rows, descending, sum 306,133, 15 Mastered / 11 Developing, inert rows @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S3)
    const rows = page.getByTestId('kirk-subject-row')
    await expect(rows).toHaveCount(26)
    await expect(
      page.locator('[data-testid="kirk-subject-row"][data-status="Mastered"]'),
    ).toHaveCount(15)
    await expect(
      page.locator('[data-testid="kirk-subject-row"][data-status="Developing"]'),
    ).toHaveCount(11)
    const pct = (await page.getByTestId('kirk-subject-pct').allTextContents()).map((t) =>
      parseFloat(t),
    )
    expect(pct).toEqual([...pct].sort((a, b) => b - a))
    const counts = (await page.getByTestId('kirk-subject-count').allTextContents()).map((t) =>
      parseInt(t.replace(/,/g, ''), 10),
    )
    expect(counts.reduce((s, n) => s + n, 0)).toBe(306133)
    const row = (name: string) => rows.filter({ hasText: name })
    await expect(rows.first()).toContainText('Pendidikan Muzik')
    await expect(rows.first()).toContainText('100%')
    await expect(rows.first()).toContainText('20 soalan')
    await expect(row('Reka Bentuk & Teknologi')).toContainText('99%')
    await expect(row('Reka Bentuk & Teknologi')).toContainText('461 soalan')
    await expect(row('Ekonomi')).toContainText('79%')
    await expect(row('Ekonomi')).toContainText('Developing')
    await expect(row('Ekonomi')).toContainText('2,333 soalan')
    await expect(row('Sejarah')).toContainText('76%')
    await expect(row('Sejarah')).toContainText('57,695 soalan')
    await expect(rows.last()).toContainText('Fizik')
    await expect(rows.last()).toContainText('64%')
    await expect(rows.last()).toContainText('5,291 soalan')

    // DV-M12-05: no tooltip, default cursor, nothing happens.
    const first = rows.first()
    await expect(first).not.toHaveAttribute('title', /.+/)
    expect(await first.evaluate((e) => getComputedStyle(e).cursor)).toBe('auto')
    const url = page.url()
    await first.click()
    expect(page.url()).toBe(url)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-30 S3 school table: headers, 33 rows, first link 8880, 16 / 7 / 10 colours, scrolls in its card @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S3)
    const table = page.getByTestId('kirk-schools')
    if (isWide(page)) {
      await expect(table.locator('th')).toHaveText([
        '#',
        'Sekolah',
        'Pelajar',
        'Soalan',
        'Ketepatan',
        'Skor Purata',
        'Subjek',
      ])
    }
    // 20 rows per page (LearningSchools.vue PAGE_SIZES): the pager holds the 33 schools.
    await expect(dsRows(table)).toHaveCount(20)
    await expect(pagerSummary(table)).toContainText('daripada 33 hasil')
    await showAllRows(page, table)
    const rows = dsRows(table)
    await expect(rows).toHaveCount(33)
    const links = await hrefs(page.getByTestId('kirk-school-link'))
    expect(links[0]).toBe('/admin/monitoring/sekolah/8880')
    for (const id of [8106, 8107, 8098, 8228, 940]) {
      expect(links).toContain(`/admin/monitoring/sekolah/${String(id)}`)
    }
    await expect(page.locator('[data-testid="kirk-school-accuracy"].text-success')).toHaveCount(16)
    await expect(page.locator('[data-testid="kirk-school-accuracy"].text-warning')).toHaveCount(7)
    await expect(page.locator('[data-testid="kirk-school-accuracy"].text-error')).toHaveCount(10)
    await expect(page.getByTestId('kirk-school-accuracy')).toHaveCount(33)
    const r8080 = rows.filter({ has: page.locator('a[href$="/sekolah/8080"]') })
    // 184 pupils, 15,007 answers, 76%, 73.3%, 3 subjects.
    await expect(r8080).toHaveText(
      isWide(page)
        ? /184\s*15,007\s*76%\s*73\.3%\s*3/
        : /Pelajar\s*184\s*Soalan\s*15,007\s*Ketepatan\s*76%\s*Skor Purata\s*73\.3%\s*Subjek\s*3/,
    )
    // School 940 has one session without answers: 0 / 0% / 0% and Subjek 1.
    const r940 = rows.filter({ has: page.locator('a[href$="/sekolah/940"]') })
    await expect(r940).toHaveText(
      isWide(page)
        ? /0\s*0%\s*0%\s*1$/
        : /Pelajar\s*\d+\s*Soalan\s*0\s*Ketepatan\s*0%\s*Skor Purata\s*0%\s*Subjek\s*1$/,
    )
    // The table scrolls inside its card, never the page.
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-65 S1 school without SPM history (9167): "Belum Ada Data", pill "GPS -" @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S1}?school_id=9167`)
    await expect(levelValue(page, 't4')).toHaveText('Belum Ada Data', TEXT)
    await expect(levelCaption(page, 't4')).toHaveText('Import keputusan peperiksaan', TEXT)
    await expect(level(page, 't4')).not.toContainText('rekod headcount')
    const group = page.getByTestId(isMobileWidth(page) ? 'kirk-flow-list' : 'kirk-flow-circles')
    await expect(group.getByTestId('kirk-flow-pill').last()).toHaveText('GPS -')
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M12-61 S1 unknown school_id gives the zero state @m12',
    provisional('SRS BR-M12-01: an unknown school is INFERRED to be the zero state', [
      moduleTag(12),
    ]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp(`${S1}?school_id=99999999`)
      await expect(levelValue(page, 't3')).toHaveText('0/0', TEXT)
      await expect(levelCaption(page, 't2')).toHaveText('Ketepatan · 0 soalan dijawab', TEXT)
      await expect(page.getByTestId('kirk-comparison-subtitle')).toHaveText(
        'Tiada Data vs Tiada Data',
      )
      await expectNoHorizontalScroll(page)
    },
  )

  test('E2E-M12-08/15 admin on the /guru twins: same content, tabs and links follow the /guru mount @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    // The admin is always in Pentadbiran, whatever the mount (userShellFor / adminShellFor, layouts.ts:37-49).
    await loginAs(ADMIN)
    await gotoApp('/guru/kirkpatrick')
    await expectHeader(page, 'pentadbiran', TITLES.s1Guru)
    await expectLevels(page, S1_PLATFORM)
    await expect(level(page, 't2')).toHaveAttribute('href', '/guru/kirkpatrick/learning')
    await gotoApp('/guru/kirkpatrick/learning')
    await expectHeader(page, 'pentadbiran', TITLES.s3)
    const strip = page.getByTestId('pentadbiran-section-tabs')
    await expect(strip.locator('a[data-active="true"]')).toHaveText('T2: Pembelajaran', TEXT)
    await expect(strip.getByRole('link', { name: 'T1: Reaksi' })).toHaveAttribute(
      'href',
      '/guru/kirkpatrick/reaction',
    )
    await expect(page.getByTestId('kirk-subject-row')).toHaveCount(26)
    await gotoApp('/guru/kirkpatrick/reaction')
    await expectHeader(page, 'pentadbiran', TITLES.s2)
    await expectStat(page.getByTestId('kirk-nps-student'), '8.4/10', 'NPS Pelajar')
    await expectStat(page.getByTestId('kirk-nps-teacher'), '6.5/10', 'NPS Guru')
    await expectStat(page.getByTestId('kirk-nps-admin'), '9.6/10', 'NPS Admin')
    await expect(page.getByTestId('kirk-satisfaction')).toContainText('4.6/5')
    if (isDesktopShell(page)) {
      // FR-M12-04 / DV-M12-12: the Kirkpatrick row of the current view is active in the sidebar on the twin too.
      await expect(
        page.getByTestId('pentadbiran-sidebar').locator('a[aria-current="page"]'),
      ).toContainText('Kirkpatrick')
    }
  })

  test('E2E-M12-09 guest is sent to /login from S1, S2, S3 @m12', async ({ page, gotoApp }) => {
    for (const path of [S1, S2, S3, '/guru/kirkpatrick', ALIAS]) {
      await gotoApp(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('S1-S3 at 320 px: no page overflow, subject rows fit and the percentage labels stay visible @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await page.setViewportSize({ width: 320, height: 700 })
    for (const [path, ready] of [
      [S1, 'kirk-bands'],
      [S2, 'kirk-reaction-cards'],
      [S3, 'kirk-schools'],
      [`${S3}?school_id=8080`, 'kirk-schools'],
    ] as const) {
      await gotoApp(path)
      await expect(page.getByTestId(ready)).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
    await gotoApp(S3)
    await expect(page.getByTestId('kirk-subject-row')).toHaveCount(26)
    const overflowing = await page
      .getByTestId('kirk-subject-row')
      .evaluateAll((rows) =>
        rows.filter((r) => r.scrollWidth > r.clientWidth + 1).map((r) => r.textContent),
      )
    expect(overflowing).toEqual([])
    // The label of a full bar (100%) sits right of the bar, inside the page viewport and not on top of the bar.
    const label = await page.getByTestId('kirk-subject-pct').first().boundingBox()
    const bar = await page.getByTestId('kirk-subject-bar').first().boundingBox()
    expect(label!.x).toBeGreaterThanOrEqual(bar!.x + bar!.width - 1)
    expect(label!.x + label!.width).toBeLessThanOrEqual(320)
  })

  test('E2E-M12-60 S1-S3 responsive sweep: no page-level horizontal scroll, touch targets @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const [path, ready] of [
      [S1, 'kirk-bands'],
      [S2, 'kirk-reaction-cards'],
      [S3, 'kirk-schools'],
      [`${S1}?school_id=8080`, 'kirk-bands'],
      [`${S3}?school_id=8080`, 'kirk-schools'],
    ] as const) {
      await gotoApp(path)
      await expect(page.getByTestId(ready)).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
    await gotoApp(S1)
    await expect(page.getByTestId('kirk-bands')).toBeVisible()
    if (!isDesktopShell(page)) {
      // Touch projects: the filter button (below 768) or "Tapis" and both selects are >= 44 px.
      if (isWide(page)) {
        await expectTouchTarget(page.getByRole('button', { name: 'Tapis', exact: true }))
        await expectTouchTarget(page.getByRole('combobox', { name: 'Sekolah', exact: true }))
        await expectTouchTarget(page.getByRole('combobox', { name: 'Negeri', exact: true }))
      } else {
        await expectTouchTarget(page.locator('[data-ds="filter-open"]'))
        await openFilters(page)
        await expectTouchTarget(page.getByRole('combobox', { name: 'Sekolah', exact: true }))
        await expectTouchTarget(page.getByRole('combobox', { name: 'Negeri', exact: true }))
      }
    }
  })
})

test.describe('M12 S1-S3: guru (provisional, SRS §9 Q-M12-1)', MODULE, () => {
  test(
    'E2E-M12-14 guru 5 opens /guru/kirkpatrick, S2 and S3 with the platform figures and the /guru links @m12',
    provisional('SRS §9: the teacher view is INFERRED (Q-M12-1)', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/kirkpatrick')
      await expectHeader(page, 'pembelajaran', TITLES.s1Guru)
      await expect(page.getByTestId('pentadbiran-header')).toHaveCount(0)
      await expectLevels(page, S1_PLATFORM)
      await expect(level(page, 't3')).toHaveAttribute('href', '/guru/kirkpatrick/behavior')
      await expect(page.getByTestId('kirk-kpi-registered').getByRole('link')).toHaveAttribute(
        'href',
        '/guru/monitoring',
      )
      await expectNoHorizontalScroll(page)

      await gotoApp('/guru/kirkpatrick/reaction')
      await expectHeader(page, 'pembelajaran', TITLES.s2)
      await expectStat(page.getByTestId('kirk-nps-student'), '8.4/10', 'NPS Pelajar')
      await expectStat(page.getByTestId('kirk-nps-teacher'), '6.5/10', 'NPS Guru')
      await expectStat(page.getByTestId('kirk-nps-admin'), '9.6/10', 'NPS Admin')
      await expect(page.getByTestId('kirk-satisfaction')).toContainText('4.6/5')
      await page
        .getByTestId('pembelajaran-section-tabs')
        .getByRole('link', { name: 'T2: Pembelajaran' })
        .click()
      await expect(page).toHaveURL(/\/guru\/kirkpatrick\/learning$/)
      await expectHeader(page, 'pembelajaran', TITLES.s3)
      await expect(page.getByTestId('kirk-subject-row')).toHaveCount(26)
      await expect(pagerSummary(page.getByTestId('kirk-schools'))).toContainText('daripada 33 hasil')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'guru on the /admin/kirkpatrick target (guru scenario step) gets the in-place 403 page @m12',
    provisional('SRS §9: the non-admin rule on /admin/* is INFERRED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      await expectErrorPage(page, '403')
      await expect(page).toHaveURL(/\/admin\/kirkpatrick$/)
      await expect(page.getByTestId('kirk-overview-page')).toHaveCount(0)
    },
  )
})

test.describe(
  'M12 S1 mount /admin-sekolah/kirkpatrick: school administrator 8 (provisional)',
  MODULE,
  () => {
    test(
      'the mount renders S1 in Pembelajaran with the own school only and links under its own prefix @m12',
      provisional('build-plan v1.12 R.1.3 / G4 F6: the alias and its scope are INFERRED', [
        moduleTag(12),
      ]),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(SCHOOL_ADMIN)
        await gotoApp(ALIAS)
        await expectHeader(page, 'pembelajaran', TITLES.s1)
        await expect(page.getByTestId('kirk-overview-page')).toBeVisible()
        await expect(page.getByTestId('pentadbiran-header')).toHaveCount(0)

        // Data forced to the own school (FR-AS-11-2): account 8 belongs to SMK DEMO (900001, src/mock/core-data/
        // accounts.ts:27,169), shown as a locked label; no school / state selects.
        await expect(page.getByTestId('kirk-school-label')).toContainText('SMK DEMO')
        await expect(page.getByTestId('kirk-filter-school')).toHaveCount(0)
        const registered = await registeredCount(page)
        expect(registered).toBeGreaterThan(0)
        expect(registered).toBeLessThan(4158)
        // Active students and sessions stay 0 (no M05 sessions for the fixture school).
        await expect(levelValue(page, 't3')).toHaveText(
          `0/${registered.toLocaleString('en-US')}`,
          TEXT,
        )
        await expect(levelCaption(page, 't3')).toHaveText(
          'Pelajar aktif · 0 sesi · 0% ketepatan',
          TEXT,
        )
        await expect(levelValue(page, 't2')).toHaveText('0%', TEXT)
        await expect(page.getByTestId('kirk-comparison-subtitle')).toHaveText(
          'Tiada Data vs Tiada Data',
        )
        await expect(levelValue(page, 't1')).toHaveText('4.6/5', TEXT)
        await expect(page.getByTestId('kirk-band-count')).toHaveCount(5)

        // All seven screens exist under the mount (FR-AS-11-1): every detail link stays on it, none on /admin/.
        const links = await hrefs(page.getByTestId('kirk-overview-page').locator('a'))
        expect(links.filter((h) => (h ?? '').startsWith('/admin/'))).toEqual([])
        expect(links.filter((h) => (h ?? '').startsWith(ALIAS)).length).toBeGreaterThan(0)
        expect(await hrefs(page.getByTestId('kirk-levels').locator('> a'))).toEqual([
          `${ALIAS}/reaction`,
          `${ALIAS}/learning`,
          `${ALIAS}/behavior`,
          `${ALIAS}/results`,
        ])
        await expectNoHorizontalScroll(page)
      },
    )

    test(
      'the mount keeps the own school when a platform school is requested @m12',
      provisional('G4 F6: the scope forcing is INFERRED', [moduleTag(12)]),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(SCHOOL_ADMIN)
        await gotoApp(ALIAS)
        const own = await registeredCount(page)
        await gotoApp(`${ALIAS}?school_id=8080`)
        // The handler ignores the requested school (8080 has 184 students): still the own school.
        expect(await registeredCount(page)).toBe(own)
        expect(own).not.toBe(184)
        await expect(levelValue(page, 't3')).toHaveText(`0/${own.toLocaleString('en-US')}`, TEXT)
        await expectNoHorizontalScroll(page)
      },
    )

    test(
      'S2 and S3 exist under the mount for the school administrator; the /admin paths are 403 @m12',
      provisional('FR-AS-11-1: the school administrator reaches all seven screens', [moduleTag(12)]),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(SCHOOL_ADMIN)
        await gotoApp(`${ALIAS}/reaction`)
        await expect(page.getByTestId('kirk-reaction-page')).toBeVisible()
        await expectHeader(page, 'pembelajaran', TITLES.s2)
        await gotoApp(`${ALIAS}/learning`)
        await expect(page.getByTestId('kirk-learning-page')).toBeVisible()
        await expectHeader(page, 'pembelajaran', TITLES.s3)
        for (const path of [S1, S2, S3]) {
          await gotoApp(path)
          await expectErrorPage(page, '403')
          await expect(page).toHaveURL(new RegExp(`${path}$`))
          await expect(page.getByTestId('kirk-overview-page')).toHaveCount(0)
        }
      },
    )

    test(
      'the mount is refused for the admin (in-place 403) @m12',
      provisional('INFERRED role guard of the mount', [moduleTag(12)]),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(ADMIN)
        await gotoApp(ALIAS)
        await expectErrorPage(page, '403')
        await expect(page).toHaveURL(/\/admin-sekolah\/kirkpatrick$/)
        await expect(page.getByTestId('kirk-overview-page')).toHaveCount(0)
      },
    )
  },
)
