/**
 * M12 S1 `/admin/kirkpatrick`, S2 `.../reaction`, S3 `.../learning`, the `/guru/kirkpatrick` twins and the
 * `/admin-sekolah/kirkpatrick` alias at 375 / 768 / 1280 (M12-T2; SRS M12 §12: E2E-M12-03, 04, 07, 08, 09 (S1-S3
 * part), 13, 16-25, 27-30, 60 (S1-S3 part), 61, 65 (S1 part)). Accounts: admin 1 (`admin@demo.test`), guru 5
 * (`guru@demo.test`), school administrator 8 (`adminsekolah@demo.test`).
 *
 * Teacher, alias and "link prefix follows the mount" steps are INFERRED / PROPOSED (SRS §9, build-plan v1.12
 * R.1.3), so those tests are `@provisional`. E2E-M12-26 (feedback via S10) belongs to M12-T5.
 */

import type { Locator, Page } from '@playwright/test'

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

const ADMIN = 'admin@demo.test'
const GURU = 'guru@demo.test'
const SCHOOL_ADMIN = 'adminsekolah@demo.test'
const MODULE = { tag: [moduleTag(12)] }

test.use({ mockInit: { latency: 0 } })

const S1 = '/admin/kirkpatrick'
const S2 = '/admin/kirkpatrick/reaction'
const S3 = '/admin/kirkpatrick/learning'

const TITLES = {
  s1: [
    'Papan Pemuka Penilaian Kirkpatrick',
    'Penilaian Kirkpatrick',
    'Analisis Keberkesanan Platform — Model Penilaian 4 Tahap',
  ],
  s2: [
    'Tahap 1: Reaksi — Kirkpatrick',
    'Tahap 1: Reaksi',
    'Kepuasan dan persepsi pengguna terhadap platform',
  ],
  s3: [
    'Tahap 2: Pembelajaran — Kirkpatrick',
    'Tahap 2: Pembelajaran',
    'Peningkatan pengetahuan, kemahiran, dan kefahaman pelajar',
  ],
} as const

const TEXT = { useInnerText: true } as const

async function header(page: Page, [tab, title, subtitle]: readonly [string, string, string]) {
  await expectTabTitle(page, tab)
  await expect(page.getByTestId('shell-admin-title')).toHaveText(title)
  await expect(page.getByTestId('shell-admin-subtitle')).toHaveText(subtitle)
}

/** The distinct left edges of `items` (columns of a grid). */
async function columns(items: Locator): Promise<number> {
  const xs = await items.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().x)),
  )
  return new Set(xs).size
}

async function registeredCount(page: Page): Promise<number> {
  const text = await page
    .getByTestId('kirk-kpi-registered')
    .getByTestId('kirk-stat-value')
    .innerText()
  return Number(text.replace(/,/g, ''))
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
  t4: ['4.30', 'GPS Sekolah · 4378 rekod headcount'],
  t3: ['946/4158', 'Pelajar aktif · 20991 sesi · 82.8% ketepatan'],
  t2: ['82.8%', 'Ketepatan · 306,133 soalan dijawab'],
  t1: ['4.6/5', 'Kepuasan purata · 336 respon'],
} as const

test.describe('M12 S1-S3: admin', MODULE, () => {
  test('E2E-M12-04/07 header, tab title and admin shell of S1, S2, S3 @m12', async ({
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
      await header(page, titles)
      await expect(page.getByTestId('shell-admin-header')).toBeVisible()
      if (isDesktopShell(page)) await expect(page.getByTestId('shell-admin-sidebar')).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })

  test('E2E-M12-03 tab strip on S2 and S3 (6 tabs, current highlighted, unfiltered links), none on S1 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await expect(page.getByTestId('kirk-overview-page')).toBeVisible()
    await expect(page.getByTestId('kirk-tabs')).toHaveCount(0)

    for (const [path, current] of [
      [`${S2}?school_id=8080`, 'reaction'],
      [`${S3}?school_id=8080`, 'learning'],
    ] as const) {
      await gotoApp(path)
      const tabs = page.getByTestId('kirk-tabs').locator('a')
      await expect(tabs).toHaveText(
        [
          'Gambaran Keseluruhan',
          'T1: Reaksi',
          'T2: Pembelajaran',
          'T3: Tingkah Laku',
          'T4: Hasil',
          'Intervensi',
        ],
        TEXT,
      )
      await expect(tabs).toHaveCount(6)
      await expect(
        tabs.evaluateAll((els) => els.map((e) => e.getAttribute('href'))),
      ).resolves.toEqual([
        '/admin/kirkpatrick',
        '/admin/kirkpatrick/reaction',
        '/admin/kirkpatrick/learning',
        '/admin/kirkpatrick/behavior',
        '/admin/kirkpatrick/results',
        '/admin/kirkpatrick/interventions',
      ])
      const active = page.getByTestId(`kirk-tab-${current}`)
      await expect(active).toHaveAttribute('data-active', 'true')
      await expect(active).toHaveClass(/bg-indigo-600/)
      await expect(page.locator('[data-testid="kirk-tabs"] [data-active="true"]')).toHaveCount(1)
      await expectTouchTarget(active)
      await expectNoHorizontalScroll(page)
    }
  })

  test('E2E-M12-16/19 S1 filter: 58 school and 11 state options, Tapis, no Reset; selects fit the card @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
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
    await expect(page.getByTestId('kirk-filter-apply')).toHaveText('Tapis')
    await expect(page.getByTestId('kirk-filter-reset')).toHaveCount(0)

    const names = await page
      .locator('[data-testid="kirk-filter-school"] option:not([value=""])')
      .allTextContents()
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))

    const card = await page.getByTestId('kirk-filter').boundingBox()
    for (const id of ['kirk-filter-school', 'kirk-filter-state']) {
      const select = page.getByTestId(id)
      // DV-M12-07: 44 px below lg, the live 36 px from lg.
      await expectTouchTarget(select, isDesktopShell(page) ? 36 : 44)
      const box = await select.boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(card!.x + card!.width + 1)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-17 S1 school 8080: Tapis, URL, Reset and the scoped values @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await expect(levelValue(page, 't4')).toHaveText('4.30', TEXT)
    await page.getByTestId('kirk-filter-school').selectOption('8080')
    await page.getByTestId('kirk-filter-apply').click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\?school_id=8080&state=$/)
    await expect(page.getByTestId('kirk-filter-school')).toHaveValue('8080')
    await expectLevels(page, {
      t4: ['4.00', 'GPS Sekolah · 4378 rekod headcount'],
      t3: ['53/184', 'Pelajar aktif · 1002 sesi · 75.6% ketepatan'],
      t2: ['75.6%', 'Ketepatan · 15,007 soalan dijawab'],
      t1: ['4.6/5', 'Kepuasan purata · 336 respon'],
    })
    const kpis = page.getByTestId('kirk-kpis')
    await expect(kpis).toContainText('184', TEXT)
    await expect(kpis).toContainText('15,007', TEXT)
    await expect(kpis).toContainText('34/34', TEXT)
    await expect(kpis).toContainText('75.6%', TEXT)
    await expect(page.getByTestId('kirk-band-count')).toHaveText(['36', '8', '9', '0', '131'])
    await expect(page.getByTestId('kirk-band-pct')).toHaveText([
      '19.6%',
      '4.3%',
      '4.9%',
      '0%',
      '71.2%',
    ])
    await expectNoHorizontalScroll(page)

    await expect(page.getByTestId('kirk-filter-reset')).toHaveAttribute('href', S1)
    await page.getByTestId('kirk-filter-reset').click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick$/)
    await expect(levelValue(page, 't4')).toHaveText('4.30', TEXT)
    await expect(page.getByTestId('kirk-filter-reset')).toHaveCount(0)
  })

  test('E2E-M12-18 S1 ?state=Kelantan: zero values, GPS stays 4.30 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S1}?state=Kelantan`)
    await expectLevels(page, {
      t4: ['4.30', 'GPS Sekolah · 4378 rekod headcount'],
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
    await expect(page.getByTestId('kirk-kpis')).toContainText('0/0', TEXT)
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
    const cards = page.getByTestId('kirk-levels').locator('a')
    await expect(cards).toHaveCount(4)
    expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([
      '/admin/kirkpatrick/results',
      '/admin/kirkpatrick/behavior',
      '/admin/kirkpatrick/learning',
      '/admin/kirkpatrick/reaction',
    ])
    await expect(cards).toContainText([
      'Lihat butiran',
      'Lihat butiran',
      'Lihat butiran',
      'Lihat butiran',
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
      'Klik mana-mana tahap untuk lihat butiran',
    )
    const links = group.locator('a')
    expect(await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([
      '/admin/kirkpatrick/reaction',
      '/admin/kirkpatrick/learning',
      '/admin/kirkpatrick/behavior',
      '/admin/kirkpatrick/results',
    ])
    await expect(group.getByTestId('kirk-flow-pill')).toHaveText([
      '4.6/5',
      '82.8% ketepatan',
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
      '75.6% ketepatan',
      '53 pelajar aktif',
      'GPS 4.00',
    ])
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-22 S1 comparison default: subtitle, ranges, values, green deltas, Ringkasan, stacking @m12', async ({
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
    await expect(before.getByTestId('kirk-panel-value')).toHaveText(['2', '33.3%', '3', '0'])
    await expect(after.getByTestId('kirk-panel-value')).toHaveText(['58', '87%', '13,968', '28'])
    await expect(before).toContainText('Pelajar Aktif')
    await expect(before).toContainText('Jumlah Jawapan')
    await expect(page.getByTestId('kirk-delta-value')).toHaveText([
      '+56',
      '+53.7%',
      '+13965',
      '+28',
    ])
    for (const k of ['active', 'accuracy', 'answers', 'champions']) {
      await expect(page.getByTestId(`kirk-delta-${k}`)).toHaveAttribute('data-tone', 'up')
    }
    await expect(page.getByTestId('kirk-summary')).toHaveText(
      'Ringkasan: Peningkatan 53.7% dalam ketepatan jawapan. 56 pelajar baru mula aktif. Jumlah jawapan meningkat 465500%. 28 pelajar naik ke tahap Juara.',
      TEXT,
    )
    const b = await before.boundingBox()
    const a = await after.boundingBox()
    if (viewportWidth(page) >= 768) {
      // md and up: side by side; below md: stacked.
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
    } else {
      expect(a!.y).toBeGreaterThan(b!.y + b!.height - 2)
      expect(await columns(page.getByTestId('kirk-deltas').locator('> div'))).toBe(2)
    }
    await expectNoHorizontalScroll(page)
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
      '71.6%',
      '511',
      '3',
    ])
    await expect(page.getByTestId('kirk-panel-after').getByTestId('kirk-panel-value')).toHaveText([
      '1',
      '55%',
      '60',
      '1',
    ])
    await expect(page.getByTestId('kirk-delta-value')).toHaveText(['-11', '-16.6%', '-451', '-2'])
    await expect(page.getByTestId('kirk-delta-active')).toHaveAttribute('data-tone', 'down')
    await expect(page.getByTestId('kirk-summary')).toContainText(
      'Penurunan 16.6% dalam ketepatan jawapan. 11 pelajar kurang aktif berbanding sebelumnya.',
      TEXT,
    )
  })

  test('E2E-M12-24 S1 KPI links, engagement tiles (3212 / 77.2%, sum 4,158) and the info card @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    const kpis = page.getByTestId('kirk-kpis')
    await expect(kpis.locator('[data-testid="kirk-stat-label"]')).toHaveText([
      'Pelajar Berdaftar (T4/T5)',
      'Soalan Dijawab',
      'Guru Aktif',
      'Ketepatan Keseluruhan',
    ])
    await expect(kpis.locator('[data-testid="kirk-stat-value"]')).toHaveText([
      '4,158',
      '306,133',
      '277',
      '82.8%',
    ])
    await expect(kpis.getByTestId('kirk-stat-suffix')).toHaveText('/522')
    expect(
      await kpis.locator('a').evaluateAll((els) => els.map((e) => e.getAttribute('href'))),
    ).toEqual([
      '/admin/monitoring',
      '/admin/kirkpatrick/learning',
      '/admin/monitoring',
      '/admin/kirkpatrick/learning',
    ])
    const counts = page.getByTestId('kirk-band-count')
    await expect(counts).toHaveText(['513', '259', '169', '5', '3212'])
    await expect(page.getByTestId('kirk-band-pct')).toHaveText([
      '12.3%',
      '6.2%',
      '4.1%',
      '0.1%',
      '77.2%',
    ])
    const sum = (await counts.allTextContents()).reduce((s, v) => s + Number(v), 0)
    expect(sum).toBe(4158)
    await expect(page.getByTestId('kirk-bands')).toContainText('Taburan Penglibatan Pelajar')
    const tiles = page.getByTestId('kirk-bands').locator('a')
    expect(await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual(
      Array(5).fill('/admin/kirkpatrick/behavior'),
    )
    expect(await columns(tiles)).toBe(5)
    const info = page.getByTestId('kirk-info')
    await expect(info).toContainText('Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan')
    await expect(info).toContainText(
      'Papan pemuka ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick (1959).',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-25 S2 cards, and the T1 figures ignore school_id and state @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S2)
    await expect(page.locator('[data-testid="kirk-stat-label"]')).toHaveText([
      'NPS Pelajar',
      'NPS Guru',
      'NPS Admin',
      'Kepuasan Purata',
    ])
    await expect(page.locator('[data-testid="kirk-stat-value"]')).toHaveText([
      '8.4/10',
      '6.5/10',
      '9.6/10',
      '4.6/5',
    ])
    await expect(page.getByTestId('kirk-filter')).toHaveCount(0)
    await expect(page.getByTestId('kirk-reaction-page')).not.toContainText('respon')

    // 2 x 2 below lg, 4 in a row from lg.
    const cards = page.getByTestId('kirk-reaction-cards').locator('> *')
    expect(await columns(cards)).toBe(isDesktopShell(page) ? 4 : 2)
    await expectNoHorizontalScroll(page)

    await gotoApp(`${S2}?school_id=8080`)
    await expect(page.locator('[data-testid="kirk-stat-value"]')).toHaveText([
      '8.4/10',
      '6.5/10',
      '9.6/10',
      '4.6/5',
    ])
    await gotoApp(`${S1}?state=Kelantan`)
    await expect(levelValue(page, 't1')).toHaveText('4.6/5', TEXT)
    await expect(levelCaption(page, 't1')).toHaveText('Kepuasan purata · 336 respon', TEXT)
  })

  test('E2E-M12-27 S3 KPI cards, Peningkatan Pembelajaran card and 2 / 3 / 6 columns @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S3)
    await expect(page.locator('[data-testid="kirk-stat-label"]')).toHaveText([
      'Soalan Dijawab',
      'Ketepatan',
      'Skor Purata',
      'Sesi Selesai',
      'Kadar Penyelesaian',
      'Peningkatan Pembelajaran',
    ])
    await expect(page.locator('[data-testid="kirk-stat-value"]')).toHaveText([
      '306,133',
      '82.8%',
      '80.3%',
      '20991',
      '100%',
      '-',
    ])
    await expect(page.getByTestId('kirk-kpi-sessions').getByTestId('kirk-stat-suffix')).toHaveText(
      '/20991',
    )
    await expect(page.getByTestId('kirk-kpi-gain')).toContainText('Perlu pre/post test')
    const gain = page.getByTestId('kirk-gain-card')
    await expect(gain).toContainText('Pra-Ujian / Pasca-Ujian belum dimulakan')
    await expect(gain).toContainText(
      "Peningkatan Pembelajaran Ternormal Hake akan dikira secara automatik.",
    )
    await expect(gain).toContainText(
      'g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g<0.7 · Low: g<0.3',
      TEXT,
    )
    const w = viewportWidth(page)
    const kpis = page.getByTestId('kirk-learning-kpis').locator('> *')
    expect(await columns(kpis)).toBe(w >= 1024 ? 6 : w >= 640 ? 3 : 2)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-28 S3 ?school_id=8080: its KPIs, no form, 24 subject rows (11 / 10 / 3) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S3}?school_id=8080`)
    await expect(page.locator('[data-testid="kirk-stat-value"]')).toHaveText([
      '15,007',
      '75.6%',
      '73.3%',
      '1002',
      '100%',
      '-',
    ])
    await expect(page.getByTestId('kirk-kpi-sessions').getByTestId('kirk-stat-suffix')).toHaveText(
      '/1002',
    )
    await expect(page.locator('form')).toHaveCount(0)
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
    // Tie order: exact accuracy descending, then name A-Z (the three 100.0% rows of school 8080).
    await expect(rows.nth(0)).toContainText('Bahasa Cina')
    await expect(rows.nth(0)).toContainText('100.0%')
    await expect(rows.nth(0)).toContainText('10 soalan')
    await expect(rows.nth(1)).toContainText('Reka Bentuk & Teknologi')
    await expect(rows.nth(2)).toContainText('Sains Komputer')
    const pcts = (await page.getByTestId('kirk-subject-pct').allTextContents()).map((v) =>
      parseFloat(v),
    )
    expect(pcts).toEqual([...pcts].sort((a, b) => b - a))
    await expect(rows.filter({ hasText: 'Bahasa Cina' })).toContainText('100.0%')
    await expect(rows.filter({ hasText: 'Bahasa Cina' })).toContainText('10 soalan')
    const row = (name: string) => rows.filter({ hasText: name })
    await expect(row('Bahasa Arab')).toContainText('45.0%')
    await expect(row('Bahasa Arab')).toContainText('Permulaan')
    await expect(row('Bahasa Arab')).toContainText('20 soalan')
    await expect(row('Matematik Tambahan')).toContainText('40.0%')
    await expect(row('Biologi')).toContainText('33.3%')
    await expect(row('Biologi')).toContainText('30 soalan')
    await expect(row('Biologi').getByTestId('kirk-subject-bar')).toHaveClass(/bg-red-500/)
    await expect(page.getByTestId('kirk-school-row')).toHaveCount(1)
    await expect(page.getByTestId('kirk-school-row')).toContainText('184')
    await expect(page.getByTestId('kirk-school-row')).toContainText('15,007')
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
      parseInt(t, 10),
    )
    expect(counts.reduce((s, n) => s + n, 0)).toBe(306133)
    const row = (name: string) => rows.filter({ hasText: name })
    await expect(rows.first()).toContainText('Pendidikan Muzik')
    await expect(rows.first()).toContainText('100.0%')
    await expect(rows.first()).toContainText('20 soalan')
    await expect(row('Reka Bentuk & Teknologi')).toContainText('99.3%')
    await expect(row('Reka Bentuk & Teknologi')).toContainText('461 soalan')
    await expect(row('Ekonomi')).toContainText('79.1%')
    await expect(row('Ekonomi')).toContainText('Berkembang')
    await expect(row('Ekonomi')).toContainText('2333 soalan')
    await expect(row('Sejarah')).toContainText('76.3%')
    await expect(row('Sejarah')).toContainText('57695 soalan')
    await expect(rows.last()).toContainText('Fizik')
    await expect(rows.last()).toContainText('63.9%')
    await expect(rows.last()).toContainText('5291 soalan')

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
    await expect(table.locator('th')).toHaveText([
      '#',
      'Sekolah',
      'Pelajar',
      'Soalan',
      'Ketepatan',
      'Skor Purata',
      'Subjek',
    ])
    const rows = page.getByTestId('kirk-school-row')
    await expect(rows).toHaveCount(33)
    const hrefs = await page
      .getByTestId('kirk-school-link')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(hrefs[0]).toBe('/admin/monitoring/sekolah/8880')
    for (const id of [8106, 8107, 8098, 8228, 940]) {
      expect(hrefs).toContain(`/admin/monitoring/sekolah/${String(id)}`)
    }
    const acc = page.getByTestId('kirk-school-accuracy')
    await expect(page.locator('[data-testid="kirk-school-accuracy"].text-green-600')).toHaveCount(
      16,
    )
    await expect(page.locator('[data-testid="kirk-school-accuracy"].text-amber-600')).toHaveCount(7)
    await expect(page.locator('[data-testid="kirk-school-accuracy"].text-red-600')).toHaveCount(10)
    await expect(acc).toHaveCount(33)
    const r8080 = rows.filter({ has: page.locator('a[href$="/sekolah/8080"]') })
    await expect(r8080).toHaveText(/184\s*15,007\s*75\.6%\s*73\.3%\s*3/)
    // School 940 has one session without answers: 0 / 0% / 0% and Subjek 1.
    const r940 = rows.filter({ has: page.locator('a[href$="/sekolah/940"]') })
    await expect(r940).toHaveText(/0\s*0%\s*0%\s*1$/)
    // The table scrolls inside its card, never the page.
    const scroller = page.getByTestId('kirk-schools-scroller')
    await expect(scroller).toHaveCSS('overflow-x', 'auto')
    if (isMobileWidth(page)) {
      expect(await scroller.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true)
    }
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
    await loginAs(ADMIN)
    await gotoApp('/guru/kirkpatrick')
    await header(page, TITLES.s1)
    await expectLevels(page, S1_PLATFORM)
    await expect(page.getByTestId('kirk-level-t2')).toHaveAttribute(
      'href',
      '/guru/kirkpatrick/learning',
    )
    await gotoApp('/guru/kirkpatrick/learning')
    await header(page, TITLES.s3)
    await expect(page.getByTestId('kirk-tab-learning')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('kirk-tab-reaction')).toHaveAttribute(
      'href',
      '/guru/kirkpatrick/reaction',
    )
    await expect(page.getByTestId('kirk-subject-row')).toHaveCount(26)
    await gotoApp('/guru/kirkpatrick/reaction')
    await header(page, TITLES.s2)
    await expect(page.locator('[data-testid="kirk-stat-value"]')).toHaveText([
      '8.4/10',
      '6.5/10',
      '9.6/10',
      '4.6/5',
    ])
    if (isDesktopShell(page)) {
      // FR-M12-04 / DV-M12-12: the item of the current view is active in the sidebar on the twin too.
      await expect(page.getByTestId('shell-admin-sidebar').locator('a.active')).toContainText(
        'T1: Reaksi',
      )
    }
  })

  test('E2E-M12-09 guest is sent to /login from S1, S2, S3 @m12', async ({ page, gotoApp }) => {
    for (const path of [S1, S2, S3, '/guru/kirkpatrick', '/admin-sekolah/kirkpatrick']) {
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
      [S1, 'kirk-info'],
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
    // The label of a full bar (100.0%) lies inside the bar and the page viewport.
    const label = await page.getByTestId('kirk-subject-pct').first().boundingBox()
    const bar = await page.getByTestId('kirk-subject-bar').first().boundingBox()
    expect(label!.x).toBeGreaterThanOrEqual(bar!.x - 1)
    expect(label!.x + label!.width).toBeLessThanOrEqual(bar!.x + bar!.width + 1)
    expect(label!.x + label!.width).toBeLessThanOrEqual(320)
  })

  test('E2E-M12-60 S1-S3 responsive sweep: no page-level horizontal scroll, touch targets @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const [path, ready] of [
      [S1, 'kirk-info'],
      [S2, 'kirk-reaction-cards'],
      [S3, 'kirk-schools'],
      [`${S1}?school_id=8080`, 'kirk-info'],
      [`${S3}?school_id=8080`, 'kirk-schools'],
    ] as const) {
      await gotoApp(path)
      await expect(page.getByTestId(ready)).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
    await gotoApp(S1)
    await expect(page.getByTestId('kirk-info')).toBeVisible()
    await expectTouchTarget(page.getByTestId('kirk-filter-apply'))
    // DV-M12-07: selects are 44 px below lg and the live 36 px from lg.
    const selectMin = isDesktopShell(page) ? 36 : 44
    await expectTouchTarget(page.getByTestId('kirk-filter-school'), selectMin)
    await expectTouchTarget(page.getByTestId('kirk-filter-state'), selectMin)
  })
})

test.describe('M12 S1-S3: guru (provisional, SRS §9 Q-M12-1)', MODULE, () => {
  test(
    'E2E-M12-14 guru 5 opens /guru/kirkpatrick, S2 and S3 with the platform figures and the /guru links @m12',
    provisional('SRS §9: the teacher view is INFERRED (Q-M12-1)', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/kirkpatrick')
      await header(page, TITLES.s1)
      await expect(page.getByTestId('shell-admin-header')).toBeVisible()
      await expectLevels(page, S1_PLATFORM)
      await expect(page.getByTestId('kirk-level-t3')).toHaveAttribute(
        'href',
        '/guru/kirkpatrick/behavior',
      )
      await expect(page.getByTestId('kirk-kpi-registered')).toHaveAttribute(
        'href',
        '/guru/monitoring',
      )
      await expectNoHorizontalScroll(page)

      await gotoApp('/guru/kirkpatrick/reaction')
      await header(page, TITLES.s2)
      await expect(page.locator('[data-testid="kirk-stat-value"]')).toHaveText([
        '8.4/10',
        '6.5/10',
        '9.6/10',
        '4.6/5',
      ])
      await page.getByTestId('kirk-tab-learning').click()
      await expect(page).toHaveURL(/\/guru\/kirkpatrick\/learning$/)
      await header(page, TITLES.s3)
      await expect(page.getByTestId('kirk-subject-row')).toHaveCount(26)
      await expect(page.getByTestId('kirk-school-row')).toHaveCount(33)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'guru on the /admin/kirkpatrick target (guru scenario step) goes to the landing page @m12',
    provisional('SRS §9: the non-admin rule on /admin/* is INFERRED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      await expect(page).not.toHaveURL(/\/admin\/kirkpatrick/)
      await expect(page.getByTestId('kirk-overview-page')).toHaveCount(0)
    },
  )
})

test.describe(
  'M12 S1 alias /admin-sekolah/kirkpatrick: school administrator 8 (provisional)',
  MODULE,
  () => {
    const ALIAS = '/admin-sekolah/kirkpatrick'

    test(
      'alias renders S1 in the user shell with the own school only and no dead detail links @m12',
      provisional('build-plan v1.12 R.1.3 / G4 F6: the alias and its scope are INFERRED', [
        moduleTag(12),
      ]),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(SCHOOL_ADMIN)
        await gotoApp(ALIAS)
        await expectTabTitle(page, TITLES.s1[0])
        await expect(page.getByTestId('shell-user-title')).toHaveText(TITLES.s1[1])
        await expect(page.getByTestId('shell-user-subtitle')).toHaveText(TITLES.s1[2])
        await expect(page.getByTestId('kirk-overview-page')).toBeVisible()
        await expect(page.getByTestId('shell-admin-header')).toHaveCount(0)

        // Data forced to the own school: account 8 belongs to SMK DEMO (900001, a fixture school). Its population
        // counts (T4/T5, teachers) show; active students and sessions stay 0 (no M05 sessions for the fixture).
        await expect(page.locator('[data-testid="kirk-filter-school"] option')).toHaveCount(2)
        const registered = await registeredCount(page)
        expect(registered).toBeGreaterThan(0)
        expect(registered).toBeLessThan(4158)
        await expect(levelValue(page, 't3')).toHaveText(`0/${String(registered)}`, TEXT)
        await expect(levelCaption(page, 't3')).toHaveText(
          'Pelajar aktif · 0 sesi · 0% ketepatan',
          TEXT,
        )
        await expect(levelValue(page, 't2')).toHaveText('0%', TEXT)
        await expect(page.getByTestId('kirk-comparison-subtitle')).toHaveText(
          'Tiada Data vs Tiada Data',
        )
        await expect(levelValue(page, 't1')).toHaveText('4.6/5', TEXT)
        await expect(page.getByTestId('kirk-comparison-subtitle')).toBeVisible()
        await expect(page.getByTestId('kirk-band-count')).toHaveCount(5)

        // S2/S3 answer 403 for this role: nothing links to them, and none of the level pages exist on the alias.
        const hrefs = await page
          .getByTestId('kirk-overview-page')
          .locator('a')
          .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
        expect(hrefs.filter((h) => h.startsWith(ALIAS))).toEqual([])
        expect(hrefs.filter((h) => h.startsWith('/admin/'))).toEqual([])
        await expect(page.getByTestId('kirk-overview-page')).not.toContainText('Lihat butiran')
        await expectNoHorizontalScroll(page)
      },
    )

    test(
      'alias filter keeps the own school when a platform school is requested @m12',
      provisional('G4 F6: the scope forcing is INFERRED', [moduleTag(12)]),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(SCHOOL_ADMIN)
        await gotoApp(ALIAS)
        const own = await registeredCount(page)
        await gotoApp(`${ALIAS}?school_id=8080`)
        // The handler ignores the requested school (8080 has 184 students): still the own school.
        expect(await registeredCount(page)).toBe(own)
        expect(own).not.toBe(184)
        await expect(levelValue(page, 't3')).toHaveText(`0/${String(own)}`, TEXT)
        await expectNoHorizontalScroll(page)
      },
    )

    test(
      'alias: S2 and S3 paths are not routes for the school administrator @m12',
      provisional('the alias is S1 only', [moduleTag(12)]),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(SCHOOL_ADMIN)
        for (const path of [`${ALIAS}/reaction`, `${ALIAS}/learning`, S1, S2, S3]) {
          await gotoApp(path)
          await expect(page.getByTestId('kirk-reaction-page')).toHaveCount(0)
          await expect(page.getByTestId('kirk-learning-page')).toHaveCount(0)
          await expect(page.getByTestId('kirk-overview-page')).toHaveCount(0)
        }
      },
    )

    test(
      'alias is refused for the admin (landing redirect) @m12',
      provisional('INFERRED role guard of the alias', [moduleTag(12)]),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(ADMIN)
        await gotoApp(ALIAS)
        await expect(page.getByTestId('kirk-overview-page')).toHaveCount(0)
        await expect(page).not.toHaveURL(/admin-sekolah\/kirkpatrick/)
      },
    )
  },
)
