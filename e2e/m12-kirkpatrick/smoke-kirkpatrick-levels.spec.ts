/**
 * M12 S4 `.../behavior`, S5 `.../results`, S6 `.../chain`, S7 `.../interventions` and S8 `.../pelajar/{id}` on
 * `/admin/kirkpatrick` and the `/guru/kirkpatrick` twins at 375 / 768 / 1280 (M12-T3 / M12-T4; SRS M12 §12:
 * E2E-M12-03 / 04 / 05 / 07 (S4-S8 part), 31-45, 46, 47-51, 52, 53, 55, 60 (S4-S8 part), 62-65).
 * Accounts: admin 1 (`admin@demo.test`), guru 5 (`guru@demo.test`), school administrator 8
 * (`adminsekolah@demo.test`: redirected to its landing page on every S4-S8 route). The teacher steps, the PDF target, the intervention
 * save and the zero-answer S8 are INFERRED / PROPOSED (SRS §8.2, §9), so those tests are `@provisional`.
 * E2E-M12-54 (the M11 link into S8) is covered by the M11 specs; the M11 school page is not mounted under
 * `/admin/monitoring` before M17-T3a.
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

const TITLES = {
  s4: [
    'Tahap 3: Tingkah Laku — Kirkpatrick',
    'Tahap 3: Tingkah Laku',
    'Konsistensi penggunaan, engagement score, dan corak tingkah laku pelajar',
  ],
  s5: [
    'Tahap 4: Hasil — Kirkpatrick',
    'Tahap 4: Hasil',
    'Impak terhadap keputusan peperiksaan dan prestasi akademik',
  ],
  s7: [
    'Intervensi — Kirkpatrick',
    'Intervensi Pelajar',
    'Rekod tindakan intervensi berdasarkan amaran Kirkpatrick',
  ],
} as const

const TEXT = { useInnerText: true } as const

async function header(page: Page, [tab, title, subtitle]: readonly [string, string, string]) {
  await expectTabTitle(page, tab)
  await expect(page.getByTestId('shell-admin-title')).toHaveText(title)
  await expect(page.getByTestId('shell-admin-subtitle')).toHaveText(subtitle)
}

/** S5 renders 946 prediction rows from one response: wait for its content with a larger budget. */
const S5_READY = { timeout: 30_000 } as const
const TEXT_S5_READY = { useInnerText: true, timeout: 30_000 } as const

/** In-app navigation (no reload), so one boot serves several screens of a test. */
async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const app = document.querySelector('#app') as
      | (Element & {
          __vue_app__?: {
            config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
          }
        })
      | null
    await app!.__vue_app__!.config.globalProperties.$router.push(to)
  }, path)
}

/** The distinct left edges of `items` (columns of a grid). */
async function columns(items: Locator): Promise<number> {
  const xs = await items.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().x)),
  )
  return new Set(xs).size
}

const texts = (loc: Locator) =>
  loc.allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, ' ').trim()))
const stats = (page: Page) => page.locator('[data-testid="kirk-stat-value"]')
const captions = (page: Page) => page.locator('[data-testid="kirk-stat-caption"]')

/** Whether the table inside `card` scrolls in its own wrapper (wider than the card), not the page. */
async function scrollsInside(card: Locator): Promise<boolean> {
  return card
    .locator('.overflow-x-auto')
    .first()
    .evaluate((el) => el.scrollWidth > el.clientWidth)
}

async function expectTabs(page: Page, base: string, current: string) {
  const keys = ['overview', 'reaction', 'learning', 'behavior', 'results', 'interventions']
  const hrefs = [base, ...keys.slice(1).map((k) => `${base}/${k}`)]
  for (const [i, k] of keys.entries()) {
    const tab = page.getByTestId(`kirk-tab-${k}`)
    await expect(tab).toHaveAttribute('href', hrefs[i]!)
    await expect(tab).toHaveAttribute('data-active', k === current ? 'true' : 'false')
  }
  await expect(page.getByTestId('kirk-tabs').getByRole('link')).toHaveCount(6)
}

// ---------------------------------------------------------------------------------------------- S4

test.describe('M12 S4 T3 Tingkah Laku (admin)', MODULE, () => {
  test('E2E-M12-03/04 S4 header, titles, tab strip and unfiltered tab links @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S4}?school_id=8080`)
    await header(page, TITLES.s4)
    await expect(page.getByTestId('shell-admin-header')).toBeVisible()
    await expectTabs(page, BASE, 'behavior')
    await expect(page.getByTestId('kirk-tab-behavior')).toHaveClass(/bg-indigo-600/)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-31 S4 filter, KPIs, apply 8080 and Reset @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    await expect(page.getByTestId('kirk-filter-apply')).toHaveText('Tapis')
    await expect(page.getByTestId('kirk-filter-state')).toHaveCount(0)
    await expect(page.getByTestId('kirk-filter-reset')).toHaveCount(0)
    await expect(stats(page)).toHaveText(['4,158', '946', '20991', '306,133', '82.8%', '53.1%'])
    await expect(captions(page)).toHaveText(['277/522'])
    await expect(page.locator('[data-testid="kirk-stat-label"]')).toHaveText([
      'Pelajar T4/T5',
      'Pernah Aktif',
      'Jumlah Sesi',
      'Soalan Dijawab',
      'Ketepatan',
      'Guru Aktif',
    ])
    await expect(page.locator('[data-testid="kirk-filter-school"] option')).toHaveCount(58)

    await page.getByTestId('kirk-filter-school').selectOption('8080')
    await page.getByTestId('kirk-filter-apply').click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\/behavior\?school_id=8080$/)
    await expect(stats(page)).toHaveText(['184', '53', '1002', '15,007', '75.6%', '100%'])
    await expect(captions(page)).toHaveText(['34/34'])
    await expect(page.getByTestId('kirk-filter-school')).toHaveValue('8080')
    const reset = page.getByTestId('kirk-filter-reset')
    await expect(reset).toHaveAttribute('href', S4)
    await reset.click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\/behavior$/)
    await expect(stats(page).first()).toHaveText('4,158')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-31 KPI columns 2 / 3 / 6 and the select fits the card (DV-M12-07) @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    await expect(stats(page)).toHaveCount(6)
    const cols = await columns(page.getByTestId('kirk-stat'))
    expect(cols).toBe(isMobileWidth(page) ? 2 : isDesktopShell(page) ? 6 : 3)
    const card = (await page.getByTestId('kirk-filter').boundingBox())!
    const select = page.getByTestId('kirk-filter-school')
    const box = (await select.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 0.5)
    expect(box.height).toBeGreaterThanOrEqual(36)
    await expectTouchTarget(page.getByTestId('kirk-filter-apply'))
    await expectNoHorizontalScroll(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewportWidth(page),
    )
  })

  test('E2E-M12-32 S4 band tiles: default and 8080, targets, bar widths, 5 columns @m12', async ({
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
      ['tidakTerlibat', '3212', 'Tidak Terlibat', '0 soalan', '77.2%'],
    ] as const
    for (const [k, n, label, caption, p] of expected) {
      await expect(tile(k).getByTestId('band-count')).toHaveText(n)
      await expect(tile(k).getByTestId('band-label')).toHaveText(label)
      await expect(tile(k).getByTestId('band-caption')).toHaveText(caption)
      await expect(tile(k).getByTestId('band-pct')).toHaveText(p)
      await expect(tile(k)).toHaveAttribute('href', '/admin/monitoring')
      await expect(tile(k).getByTestId('band-bar')).toHaveAttribute(
        'style',
        new RegExp(`width: ${p.replace('%', '')}%`),
      )
    }
    expect(await columns(page.locator('[data-testid^="beh-band-"]'))).toBe(5)
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

  test('E2E-M12-34 S4 school table: 33 rows, first link, tahap split, 8080 and 940 rows, scroll @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    const rows = page.getByTestId('beh-school-row')
    await expect(rows).toHaveCount(33)
    await expect(page.locator('[data-testid="beh-schools"] thead th')).toHaveText([
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
    await expect(page.locator('[data-testid="cell-active"].text-slate-300')).toHaveCount(9)
    await expect(page.locator('[data-testid="cell-tahap"].text-white').first()).toBeVisible()

    const cells = (row: Locator) => texts(row.locator('td').filter({ hasNot: page.locator('a') }))
    const r8080 = rows.filter({ has: page.locator('a[href$="/sekolah/8080"]') })
    expect((await cells(r8080)).slice(1)).toEqual(
      ['184', '53', '15,007', '1002', '283.2', '62.4', 'Konsisten'].slice(
        0,
        (await cells(r8080)).length - 1,
      ),
    )
    const r940 = rows.filter({ has: page.locator('a[href$="/sekolah/940"]') })
    const t940 = (await texts(r940.locator('td'))).slice(2)
    expect(t940).toEqual(['1', '0', '0', '1', '0', '2', 'Tidak Terlibat'])
    if (isMobileWidth(page)) expect(await scrollsInside(page.getByTestId('beh-schools'))).toBe(true)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-35 S4 heat map: 7 x 18, titles, alpha, 8080 zero cells, scroll at 375 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S4)
    const heat = page.getByTestId('beh-heat')
    await expect(heat.locator('tbody tr')).toHaveCount(7)
    await expect(page.getByTestId('beh-heat-cell')).toHaveCount(126)
    await expect(heat.locator('thead th').nth(1)).toHaveText('06')
    await expect(heat.locator('thead th').last()).toHaveText('23')
    await expect(heat.locator('tbody th')).toHaveText([
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
    await expect(max).toHaveCSS('background-color', 'rgb(99, 102, 241)')
    await expect(min).toHaveCSS('background-color', 'rgba(99, 102, 241, 0.15)')
    const size = (await min.boundingBox())!.width
    expect(size).toBe(isMobileWidth(page) ? 20 : 24)
    if (isMobileWidth(page)) expect(await scrollsInside(heat)).toBe(true)
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S4}?school_id=8080`)
    const zero = page.locator('[data-testid="beh-heat-cell"][title$="— 0 soalan"]')
    await expect(zero).toHaveCount(43)
    await expect(zero.first()).toHaveCSS('background-color', 'rgb(241, 245, 249)')
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
    await expect(items.first()).toHaveClass(/bg-red-50/)
    await expect(items.last()).toHaveClass(/bg-green-50/)
    await expect(page.getByTestId('beh-alerts').locator('button, a')).toHaveCount(0)

    const mood = page.getByTestId('beh-mood')
    await expect(mood).toContainText('💭')
    await expect(mood).toContainText('Data Mood Belum Mencukupi')
    await expect(mood).toContainText(
      'Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi.',
    )
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S4}?school_id=8080`)
    await expect(stats(page).first()).toHaveText('184')
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
    await expect(page.getByTestId('beh-alert')).toHaveClass(/bg-red-50/)
  })

  test('E2E-M12-64 S4 school 9167: Pernah Aktif = row Aktif = 5, bands sum to 8, two alerts @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S4}?school_id=9167`)
    await expect(stats(page).nth(1)).toHaveText('5')
    await expect(page.getByTestId('beh-school-row')).toHaveCount(1)
    await expect(page.getByTestId('cell-active')).toHaveText('5')
    const answersKpi = (await stats(page).nth(3).innerText()).trim()
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
  test('E2E-M12-03/04 S5 header, titles and tab strip @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S5}?school_id=8080`)
    await header(page, TITLES.s5)
    await expectTabs(page, BASE, 'results')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-37 S5 KPI cards: platform and 8080 @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    await expect(page.locator('[data-testid="kirk-stat-label"]')).toHaveText([
      'GPS Headcount',
      'Kadar Lulus',
      'Pelajar Gred A',
      'Ketepatan Platform',
      'Pelajar Aktif',
      'Rekod Headcount',
    ])
    await expect(stats(page)).toHaveText(['4.30', '96.7%', '52', '82.8%', '946', '4378'])
    await expect(captions(page)).toHaveText([
      '41 rekod · 2025',
      '174/180 calon',
      '28.9% daripada 180',
      '306,133 soalan',
      '22.8% daripada 4,158',
      'Data OTR',
    ])
    const cols = await columns(page.getByTestId('kirk-stat'))
    expect(cols).toBe(isMobileWidth(page) ? 2 : isDesktopShell(page) ? 6 : 3)
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S5}?school_id=8080`)
    await expect(stats(page)).toHaveText(['4.00', '100%', '0', '75.6%', '53', '4378'])
    await expect(captions(page)).toHaveText([
      '41 rekod · 2026',
      '1/1 calon',
      '0% daripada 1',
      '15,007 soalan',
      '28.8% daripada 184',
      'Data OTR',
    ])
  })

  test('E2E-M12-38 S5 Taburan Gred 2025 and 8080 2026 @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    const card = page.getByTestId('res-grades')
    await expect(card.locator('h2')).toHaveText('Taburan Gred (2025)', TEXT)
    await expect(card).toContainText('Berdasarkan 180 calon — sumber: Headcount OTR')
    const rows = page.getByTestId('res-grade-row')
    await expect(rows).toHaveCount(10)
    const titles = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('title')))
    expect(titles).toEqual([
      'A+: 10 pelajar (5.6%)',
      'A: 18 pelajar (10%)',
      'A-: 24 pelajar (13.3%)',
      'B+: 32 pelajar (17.8%)',
      'B: 32 pelajar (17.8%)',
      'C+: 26 pelajar (14.4%)',
      'C: 21 pelajar (11.7%)',
      'D: 11 pelajar (6.1%)',
      'E: 5 pelajar (2.8%)',
      'G: 1 pelajar (0.6%)',
    ])
    await expect(page.getByTestId('res-grade-bar').nth(3)).toHaveAttribute('style', /width: 100%/)
    await expect(page.getByTestId('res-grade-bar').nth(4)).toHaveAttribute('style', /width: 100%/)
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S5}?school_id=8080`)
    await expect(card.locator('h2')).toHaveText('Taburan Gred (2026)', TEXT)
    await expect(card).toContainText('Berdasarkan 1 calon — sumber: Headcount OTR')
    const t8080 = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('title')))
    expect(t8080[3]).toBe('B+: 1 pelajar (100%)')
    expect(t8080.filter((t) => t!.endsWith(': 0 pelajar (0%)'))).toHaveLength(9)
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
      await expect(subj.locator('h2')).toHaveText('GPS Mengikut Subjek (2026)', TEXT_S5_READY)
      await expect(page.getByTestId('cell-subject')).toHaveText([
        'Matematik',
        'Bahasa Melayu',
        'Sains',
        'Sejarah',
        'Bahasa Inggeris',
      ])
      await expect(page.getByTestId('cell-gps')).toHaveText([
        '2.50',
        '2.80',
        '2.90',
        '3.00',
        '3.20',
      ])
      await expect(page.getByTestId('cell-grade')).toHaveText(['A-', 'A-', 'A-', 'A-', 'B+'])
      await expect(page.getByTestId('cell-candidates')).toHaveText(['30', '30', '30', '30', '30'])
      await expect(page.getByTestId('cell-trend')).toHaveText([
        '4.45',
        '4.00',
        '4.70',
        '4.50',
        '4.30',
      ])
      await expect(subj).toContainText(
        'GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya.',
      )
      const first = page.getByTestId('cell-subject').first()
      await expect(first).toHaveCSS('cursor', 'default')
      await expect(first).not.toHaveAttribute('title', /.+/)
      await expect(first.locator('a')).toHaveCount(0)

      const trend = page.getByTestId('res-trend')
      await expect(trend.locator('h2')).toHaveText('Trend GPS (2022–2026)', TEXT)
      await expect(trend.locator('thead th')).toHaveText(
        ['Subjek', '2022', '2023', '2024', '2025', '2026', 'Trend'],
        TEXT,
      )
      const rows = await trend
        .locator('tbody tr')
        .evaluateAll((els) =>
          els.map((r) =>
            [...r.querySelectorAll('td')].map((c) => (c as HTMLElement).innerText.trim()),
          ),
        )
      expect(rows.map((r) => r.slice(0, 6))).toEqual([
        ['Keseluruhan', '5.20', '4.80', '4.50', '4.30', '-'],
        ['Bahasa Melayu', '4.80', '4.50', '4.20', '4.00', '2.80'],
        ['Bahasa Inggeris', '5.20', '4.90', '4.55', '4.30', '3.20'],
        ['Matematik', '5.50', '5.10', '4.75', '4.45', '2.50'],
        ['Sains', '5.80', '5.40', '5.00', '4.70', '2.90'],
        ['Sejarah', '5.60', '5.20', '4.80', '4.50', '3.00'],
        ['Pendidikan Islam', '4.20', '3.90', '3.65', '3.40', '-'],
      ])
      const cells = page.getByTestId('res-trend-cell')
      await expect(cells.first()).toHaveClass(/text-amber-600/)
      await expect(cells.nth(4)).toHaveClass(/text-slate-300/)
      await expect(
        page.getByTestId('res-trend-row').nth(1).getByTestId('res-trend-cell').nth(3),
      ).toHaveClass(/text-green-600/)
      await expect(trend).toContainText(
        '= GPS menurun (improving). Sumber: Headcount OTR & SPM sebenar.',
      )
    }
    if (isMobileWidth(page)) {
      expect(await scrollsInside(page.getByTestId('res-subject-gps'))).toBe(true)
      expect(await scrollsInside(page.getByTestId('res-trend'))).toBe(true)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-41 S5 school table and the 946 prediction rows @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S5)
    const schools = page.getByTestId('res-school-row')
    await expect(schools).toHaveCount(33, S5_READY)
    await expect(page.getByTestId('res-school-link').first()).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/9681',
    )
    const tahap = await texts(
      page.locator('[data-testid="res-school-row"] [data-testid="cell-tahap"]'),
    )
    const n = (t: string) => tahap.filter((x) => x === t).length
    expect([
      n('Champion'),
      n('Konsisten'),
      n('Berkembang'),
      n('Minimum'),
      n('Tidak Terlibat'),
    ]).toEqual([8, 7, 2, 4, 12])
    await expect(page.locator('[data-testid="res-school-row"][data-faded="true"]')).toHaveCount(9)
    const faded = page.locator('[data-testid="res-school-row"][data-faded="true"]').first()
    await expect(faded).toHaveClass(/opacity-50/)
    await expect(faded.getByTestId('cell-accuracy')).toHaveText('-')
    await expect(faded.getByTestId('cell-answers')).toHaveText('-')
    const r940 = schools.filter({ has: page.locator('a[href$="/sekolah/940"]') })
    await expect(r940.getByTestId('cell-engagement')).toHaveText('2')

    const preds = await page.getByTestId('res-pred-row').evaluateAll((els) =>
      els.map((r) => ({
        acc: Number.parseFloat(
          (r.querySelector('[data-testid="pred-accuracy"]') as HTMLElement).innerText,
        ),
        accText: (r.querySelector('[data-testid="pred-accuracy"]') as HTMLElement).innerText.trim(),
        grade: (r.querySelector('[data-testid="pred-grade"]') as HTMLElement).innerText.trim(),
        school: (r.querySelector('[data-testid="pred-school"]') as HTMLAnchorElement).getAttribute(
          'href',
        ),
      })),
    )
    expect(preds).toHaveLength(946)
    for (let i = 1; i < preds.length; i++)
      expect(preds[i]!.acc).toBeLessThanOrEqual(preds[i - 1]!.acc)
    const band = (gs: string[]) => preds.filter((p) => gs.includes(p.grade)).length
    expect([
      band(['A+', 'A', 'A-']),
      band(['B+', 'B']),
      band(['C+', 'C']),
      band(['D', 'E']),
      band(['G']),
    ]).toEqual([512, 206, 104, 95, 29])
    const gradeAt = (acc: string) => preds.find((p) => p.accText === acc)?.grade
    for (const [acc, grade] of [
      ['90%', 'A+'],
      ['89.9%', 'A'],
      ['70%', 'A-'],
      ['49.6%', 'D'],
      ['39.5%', 'E'],
      ['29.4%', 'G'],
    ] as const) {
      const g = gradeAt(acc)
      if (g !== undefined) expect(g, `grade of ${acc}`).toBe(grade)
    }
    await expect(page.getByTestId('res-predictions')).toContainText(
      'Ramalan ini berdasarkan ketepatan menjawab soalan dalam platform sahaja. Ramalan penuh memerlukan lebih banyak data termasuk keputusan peperiksaan terdahulu.',
    )
    if (isMobileWidth(page)) {
      expect(await scrollsInside(page.getByTestId('res-schools'))).toBe(true)
      expect(await scrollsInside(page.getByTestId('res-predictions'))).toBe(true)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-41/63 S5 school 8080: one school row, 53 predictions, students A and B link to 4664 / 4644 @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S5}?school_id=8080`)
    await expect(page.getByTestId('res-school-row')).toHaveCount(1)
    const rows = page.getByTestId('res-pred-row')
    await expect(rows).toHaveCount(53)
    const a = rows.nth(18)
    await expect(a.getByTestId('pred-student')).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/8080/pelajar/4664',
    )
    expect(await texts(a.locator('td').nth(3))).toEqual(['219'])
    await expect(a.getByTestId('pred-accuracy')).toHaveText('73.1%')
    await expect(a.getByTestId('pred-grade')).toHaveText('A-')
    const b = rows.nth(49)
    await expect(b.getByTestId('pred-student')).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/8080/pelajar/4644',
    )
    expect(await texts(b.locator('td').nth(3))).toEqual(['70'])
    await expect(b.getByTestId('pred-accuracy')).toHaveText('38.6%')
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
    await expect(card.getByTestId('alesa-icon')).toBeVisible()
    await expect(card).toContainText('Ramalan ALESA (Predictive Grade)')
    await expect(card).toContainText(
      'Berdasarkan ketepatan, konsistensi, trend mingguan, dan jumlah latihan pelajar',
    )
    await expect(page.getByTestId('tile-value')).toHaveText(['48', '2', '4'])
    expect(await columns(page.getByTestId('tile-value'))).toBe(3)
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
    if (isMobileWidth(page)) expect(await scrollsInside(card)).toBe(true)
    await expectNoHorizontalScroll(page)

    await spaGo(page, `${S5}?school_id=8080`)
    await expect(page.getByTestId('tile-value')).toHaveText(['47', '3', '3'])
    await expect(page.getByTestId('alesa-row')).toHaveCount(50)
    const g8 = await texts(page.getByTestId('alesa-grade'))
    const c8 = (g: string) => g8.filter((x) => x === g).length
    expect(['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'E'].map(c8)).toEqual([3, 9, 11, 13, 7, 3, 1, 3])
    const names = await texts(page.getByTestId('alesa-name'))
    expect(names).not.toContain('Pelajar Demo 004664')
    const rowB = page.getByTestId('alesa-row').nth(46)
    await expect(rowB.getByTestId('alesa-name')).toHaveText('Pelajar Demo 004644')
    await expect(rowB.getByTestId('alesa-grade')).toHaveText('C')
    await expect(rowB.getByTestId('alesa-cadangan')).toHaveText(
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
    await expect(page.getByTestId('roi-accuracy')).toHaveText('82.8%')
    await expect(page.getByTestId('roi-gps')).toHaveText('4.30')
    const roi = page.getByTestId('res-roi')
    await expect(roi).toContainText('ROI penuh akan dapat dikira apabila:')
    await expect(roi.locator('ol li')).toHaveText([
      'Keputusan peperiksaan sebenar (SPM/dalaman) diimport',
      'Data kos langganan platform dimasukkan',
      'Perbandingan prestasi pelajar aktif vs tidak aktif dapat dibuat',
    ])
    await expect(page.getByTestId('insight-row')).toHaveText(
      [
        'Hanya 946 daripada 4158 pelajar T4/T5 (22.8%) menggunakan platform. Data perbandingan terhad kepada pelajar aktif sahaja.',
        'Purata ketepatan pelajar aktif dalam platform: 82.8%. Ini bersamaan anggaran gred A.',
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
    await expect(page.getByTestId('roi-accuracy')).toHaveText('75.6%')
    await expect(page.getByTestId('insight-row')).toHaveText(
      [
        'Hanya 53 daripada 184 pelajar T4/T5 (28.8%) menggunakan platform. Data perbandingan terhad kepada pelajar aktif sahaja.',
        'Purata ketepatan pelajar aktif dalam platform: 75.6%. Ini bersamaan anggaran gred A-.',
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
    await expect(stats(page).nth(4)).toHaveText('5')
    await expect(page.getByTestId('cell-active').first()).toHaveText('5')
    await expect(page.getByTestId('res-pred-row')).toHaveCount(5)
  })

  test('E2E-M12-65 S5 school 9167 without SPM history @m12', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S5}?school_id=9167`)
    await expect(stats(page)).toHaveText([
      '-',
      '0%',
      '0',
      await stats(page).nth(3).innerText(),
      '5',
      '4378',
    ])
    await expect(captions(page)).toHaveText([
      '41 rekod',
      '0/0 calon',
      '0% daripada 0',
      await captions(page).nth(3).innerText(),
      '62.5% daripada 8',
      'Data OTR',
    ])
    await expect(captions(page).first()).not.toContainText('·')
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
    await expect(stats(page).first()).toHaveText('2.88')
    await expect(captions(page).first()).toHaveText('41 rekod · 2026')
    await expect(stats(page).nth(1)).toHaveText('-')
    await expect(captions(page).nth(1)).toHaveText('150 calon')
    await expect(page.getByTestId('res-grades')).toHaveCount(0)
    await expect(page.getByTestId('res-kpis')).not.toContainText('0/0')
    await expectNoHorizontalScroll(page)
  })
})

// ---------------------------------------------------------------------------------------------- S6

test.describe('M12 S6 Rantaian Impak (admin)', MODULE, () => {
  test('E2E-M12-05/44 S6 header, no tab strip, cards, colours and layout @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S6}?school_id=8080`)
    await expectTabTitle(page, 'Kirkpatrick Impact Chain')
    await expect(page.getByTestId('shell-admin-title')).toHaveText('Rantaian Impak')
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveCount(0)
    await expect(page.getByTestId('kirk-tabs')).toHaveCount(0)
    await expect(page.getByTestId('kirk-chain').locator('h1')).toHaveText(
      'Model Kirkpatrick — Rantaian Impak',
    )
    await expect(page.getByTestId('chain-back')).toHaveAttribute('href', BASE)
    await expect(page.getByTestId('chain-export')).toHaveText('Muat Turun Laporan')
    await expect(page.getByTestId('chain-export')).toHaveAttribute('href', `${BASE}/export-pdf`)
    await expect(page.getByTestId('chain-export')).toHaveAttribute('target', '_blank')
    await expectTouchTarget(page.getByTestId('chain-export'), 44)

    const v = (id: string) => page.getByTestId(id).getByTestId('chain-value')
    await expect(v('chain-t1')).toHaveText(['8.3/10', '4.6/5', '336'])
    await expect(v('chain-t2')).toHaveText(['82.8%', '306,133', '80.3%'])
    await expect(v('chain-t3')).toHaveText(['946/4158 (22.8%)', '20,991'], TEXT)
    await expect(v('chain-t4')).toHaveText(['4.30', '0.1298', 'Lemah'])
    expect(await texts(page.getByTestId('chain-bands').locator('li'))).toEqual([
      'Champion 513',
      'Consistent 259',
      'Developing 169',
      'Minimal 5',
      'Disengaged 3212',
    ])
    await expect(page.getByTestId('chain-t1')).toHaveClass(/border-green-300/)
    await expect(page.getByTestId('chain-t2')).toHaveClass(/border-green-300/)
    await expect(page.getByTestId('chain-t3')).toHaveClass(/border-yellow-300/)
    await expect(page.getByTestId('chain-t4')).toHaveClass(/border-yellow-300/)

    const cols = await columns(page.locator('section[data-testid^="chain-t"]'))
    const arrows = page.getByTestId('chain-arrow')
    if (viewportWidth(page) >= 768) {
      expect(cols).toBe(4)
      await expect(arrows).toHaveCount(3)
      await expect(arrows.first()).toBeVisible()
    } else {
      expect(cols).toBe(1)
      await expect(arrows.first()).toBeHidden()
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-45 S6 correlation table, ALESA conclusion and gradient text @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S6)
    const rows = page.getByTestId('corr-row')
    await expect(rows).toHaveCount(3)
    expect(await texts(rows)).toEqual([
      '1-20 soalan 215 59.7%',
      '51-100 soalan 149 68.7%',
      '100+ soalan 348 75.2%',
    ])
    const bars = page.getByTestId('corr-bar')
    await expect(bars.nth(0)).toHaveClass(/bg-yellow-500/)
    await expect(bars.nth(1)).toHaveClass(/bg-green-500/)
    await expect(bars.nth(2)).toHaveClass(/bg-green-500/)
    if (ALESA_ON) {
      await expect(page.getByTestId('corr-conclusion')).toHaveText(
        'Kesimpulan ALESA: Pelajar yang menjawab 100+ soalan mencapai ketepatan 75.2%, berbanding 59.7% bagi pelajar dengan kurang 20 soalan (perbezaan +15.5%). Korelasi Pearson antara penggunaan dan ketepatan: r = 0.1298 (Lemah).',
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
  test('E2E-M12-03/04/47 S7 header, tab strip, zero KPIs and the empty list @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S7}?school_id=8080`)
    await header(page, TITLES.s7)
    await expectTabs(page, BASE, 'interventions')
    await expect(page.locator('[data-testid="kirk-stat-label"]')).toHaveText([
      'Jumlah Intervensi',
      'Menunggu Semakan',
      'Meningkat',
      'Menurun',
    ])
    await expect(stats(page)).toHaveText(['0', '0', '0', '0'])
    expect(await columns(page.getByTestId('kirk-stat'))).toBe(isMobileWidth(page) ? 2 : 4)
    if (isMobileWidth(page)) {
      const ys = await page
        .getByTestId('kirk-stat')
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
    await expect(form).toBeHidden()
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(36)
    await toggle.click()
    await expect(form).toBeVisible()
    await expect(page.getByTestId('int-form-chevron')).toHaveClass(/rotate-180/)
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
    await expect(page.getByTestId('int-type')).toHaveValue('mood')
    await expect(page.getByTestId('int-type').locator('option')).toHaveText([
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
    await expect(page.getByTestId('int-before-mood').locator('option')).toHaveText([
      '-- Pilih --',
      'Gembira',
      'Okay',
      'Sedih',
      'Tertekan',
    ])
    await expect(page.getByTestId('int-submit')).toHaveText('Simpan Intervensi')
    await expectTouchTarget(page.getByTestId('int-submit'))

    expect(await columns(page.locator('#int-student, #int-type, #int-date'))).toBe(
      viewportWidth(page) >= 768 ? 3 : 1,
    )
    expect(
      await columns(page.locator('#int-before, #int-before-mood, #int-after, #int-after-mood')),
    ).toBe(viewportWidth(page) >= 768 ? 4 : 2)
    await expectNoHorizontalScroll(page)

    await toggle.click()
    await expect(form).toBeHidden()
    await expect(page.getByTestId('int-form-chevron')).not.toHaveClass(/rotate-180/)
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
    await expect(stats(page).first()).toHaveText('0')
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
      await toggle.click()
      await page.getByTestId('int-student').fill('4664')
      await page.getByTestId('int-type').selectOption('inactive')
      await page.getByTestId('int-desc').fill('Tidak aktif dua minggu')
      await page.getByTestId('int-action').fill('Hubungi guru kelas')
      await page.getByTestId('int-before').fill('73.1')
      await page.getByTestId('int-submit').click()
      await expect(page.getByTestId('int-row')).toHaveCount(1)
      await expect(page.getByTestId('int-form')).toBeHidden()
      await expect(stats(page)).toHaveText(['1', '1', '0', '0'])
      await expect(page.getByTestId('int-row-status')).toHaveText(['Menunggu Semakan'])

      await toggle.click()
      await page.getByTestId('int-student').fill('4644')
      await page.getByTestId('int-desc').fill('Prestasi menurun')
      await page.getByTestId('int-action').fill('Bimbingan tambahan')
      await page.getByTestId('int-before').fill('40.0')
      await page.getByTestId('int-after').fill('55.5')
      await page.getByTestId('int-submit').click()
      await expect(page.getByTestId('int-row')).toHaveCount(2)
      await expect(stats(page)).toHaveText(['2', '1', '1', '0'])
      await expect(page.getByTestId('int-row-status')).toHaveText(['Meningkat', 'Menunggu Semakan'])
      await expect(page.getByTestId('int-row-student').first()).toContainText('4644')
      if (isMobileWidth(page)) expect(await scrollsInside(page.getByTestId('int-list'))).toBe(true)
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
      await expect(stats(page)).toHaveText(['0', '0', '0', '0'])
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
      await expect(page.getByText('405')).toHaveCount(0)
    }
  })
})

// ---------------------------------------------------------------------------------------------- S8

test.describe('M12 S8 student detail (admin)', MODULE, () => {
  test('E2E-M12-05/52 S8 student A: header, ALESA, tiles, Head Count, platform bars, stacking @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S8(4664))
    await expectTabTitle(page, 'Kirkpatrick — Pelajar Demo 004664')
    await expect(page.getByTestId('shell-admin-title')).toHaveText(
      'Kirkpatrick — Pelajar Demo 004664',
    )
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveCount(0)
    await expect(page.getByTestId('pel-name')).toHaveText('Pelajar Demo 004664')
    await expect(page.getByTestId('pel-school')).toContainText('· Tingkatan 5')
    const back = page.getByTestId('pel-back')
    await expect(back).toHaveText('← Kembali ke Tahap 3')
    await expect(back).toHaveAttribute('href', S4)
    const alesa = page.getByTestId('pel-alesa')
    if (ALESA_ON) {
      await expect(alesa).toContainText('AI')
      await expect(alesa).toContainText('ALESA — Analisis Tingkah Laku Kirkpatrick')
    } else {
      await expect(alesa).toContainText('Ringkasan Pelajar')
    }
    if (ALESA_ON) {
      await expect(page.getByTestId('pel-paragraph')).toHaveText(
        'Penggunaan Prestasi Plus oleh Pelajar Demo 004664 masih pada tahap minimum dengan hanya 4 hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi. Ketepatan jawapan pada 73.1% menunjukkan pemahaman yang baik. Subjek terkuat: Sejarah (78.9%).',
      )
    } else {
      await expect(page.getByTestId('pel-paragraph')).toHaveCount(0)
    }
    await expect(page.getByTestId('pel-tile-answers')).toContainText('219')
    await expect(page.getByTestId('pel-tile-accuracy')).toContainText('73.1%')
    await expect(page.getByTestId('pel-tile-konsistensi')).toContainText('22.5')
    await expect(page.getByTestId('pel-tile-streak')).toContainText('1d')
    await expect(page.getByTestId('pel-strength')).toHaveText(
      'Terkuat: Sejarah (78.9%) · Perlu perhatian: Matematik (16.7%)',
      TEXT,
    )
    await expect(page.getByTestId('pel-hc-heading')).toHaveText('2026 — Head Count')
    const hc = await texts(page.getByTestId('pel-hc-row'))
    expect(hc).toEqual([
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
    await expect(page.getByTestId('pel-plat-value')).toHaveText([
      '78.9% (190)',
      '39.1% (23)',
      '16.7% (6)',
    ])
    const bar = page.getByTestId('pel-plat-bar')
    await expect(bar.nth(0)).toHaveClass(/bg-green-500/)
    await expect(bar.nth(1)).toHaveClass(/bg-red-400/)
    await expect(bar.nth(2)).toHaveClass(/bg-red-400/)

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

  test('E2E-M12-53 S8 student B: no accuracy sentence, Head Count and yellow / red bars @m12', async ({
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
    await expect(page.getByTestId('pel-tile-accuracy')).toContainText('38.6%')
    await expect(page.getByTestId('pel-tile-konsistensi')).toContainText('21.1')
    await expect(page.getByTestId('pel-strength')).toHaveText(
      'Terkuat: Bahasa Melayu (60.0%) · Perlu perhatian: Sejarah (0.0%)',
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
      '60.0% (5)',
      '55.0% (20)',
      '40.0% (15)',
      '33.3% (15)',
      '20.0% (10)',
      '0.0% (5)',
    ])
    const bars = page.getByTestId('pel-plat-bar')
    await expect(bars.nth(0)).toHaveClass(/bg-yellow-500/)
    await expect(bars.nth(1)).toHaveClass(/bg-yellow-500/)
    for (const i of [2, 3, 4, 5]) await expect(bars.nth(i)).toHaveClass(/bg-red-400/)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M12-12/63 S8 with an id that is not a user (5571, 5551, 99999999) renders the 403 page @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const id of [5571, 5551, 99_999_999]) {
      await gotoApp(S8(id))
      await expectTabTitle(page, 'Akses Ditolak | PRESTASIPLUS')
      await expect(
        page.getByText('Anda tidak mempunyai kebenaran untuk mengakses halaman ini.'),
      ).toBeVisible()
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
  })

  test(
    'E2E-M12-55 S8 of a T4/T5 student without answers shows 0 / 0% / 0 / 0d and an empty platform card @m12',
    provisional('SRS FN-M12-9.5.1: the zero state is INFERRED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp(`${S5}?school_id=8080`)
      await expect(page.getByTestId('res-pred-row')).toHaveCount(53)
      const active = new Set(
        await page
          .getByTestId('pred-student')
          .evaluateAll((els) => els.map((e) => Number(e.getAttribute('href')!.split('/').pop()))),
      )
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
            .getByText('Akses Ditolak')
            .first()
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
    await loginAs(ADMIN)
    await gotoApp('/guru/kirkpatrick/behavior')
    await header(page, TITLES.s4)
    await expect(page.getByTestId('shell-admin-header')).toBeVisible()
    await expect(stats(page)).toHaveText(['4,158', '946', '20991', '306,133', '82.8%', '53.1%'])
    await expect(page.getByTestId('kirk-tab-results')).toHaveAttribute(
      'href',
      '/guru/kirkpatrick/results',
    )
    await expect(page.getByTestId('beh-band-champion')).toHaveAttribute('href', '/guru/monitoring')
    await expect(page.getByTestId('beh-school-link').first()).toHaveAttribute(
      'href',
      '/guru/monitoring/sekolah/9681',
    )
    await expectNoHorizontalScroll(page)

    await spaGo(page, '/guru/kirkpatrick/results')
    await header(page, TITLES.s5)
    await expect(stats(page)).toHaveText(['4.30', '96.7%', '52', '82.8%', '946', '4378'])
    await spaGo(page, '/guru/kirkpatrick/chain')
    await expect(page.getByTestId('shell-admin-title')).toHaveText('Rantaian Impak')
    await expect(page.getByTestId('chain-back')).toHaveAttribute('href', '/guru/kirkpatrick')
    await spaGo(page, '/guru/kirkpatrick/interventions')
    await header(page, TITLES.s7)
    await spaGo(page, '/guru/kirkpatrick/pelajar/4664')
    await expect(page.getByTestId('pel-name')).toHaveText('Pelajar Demo 004664')
    await expect(page.getByTestId('pel-back')).toHaveAttribute('href', '/guru/kirkpatrick/behavior')
  })

  test('E2E-M12-08 /guru/kirkpatrick/behavior marks "T3: Tingkah Laku" active in the sidebar @m12', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.skip(!isDesktopShell(page), 'the sidebar is the drawer below 1024 px (covered by M12-T2)')
    await loginAs(ADMIN)
    await gotoApp('/guru/kirkpatrick/behavior')
    await expect(page.getByTestId('beh-school-row').first()).toBeVisible()
    await expect(page.getByTestId('shell-admin-nav').locator('.active')).toHaveText(
      'T3: Tingkah Laku',
    )
  })

  test(
    'guru 5 on /guru S4-S8 sees the platform figures in the admin shell @m12',
    provisional('SRS §9 Q-M12-1: the teacher view is INFERRED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/kirkpatrick/behavior')
      await header(page, TITLES.s4)
      await expect(page.getByTestId('shell-admin-header')).toBeVisible()
      await expect(stats(page)).toHaveText(['4,158', '946', '20991', '306,133', '82.8%', '53.1%'])
      await expectNoHorizontalScroll(page)

      await spaGo(page, '/guru/kirkpatrick/results')
      await header(page, TITLES.s5)
      await expect(stats(page)).toHaveText(['4.30', '96.7%', '52', '82.8%', '946', '4378'])
      await expect(page.getByTestId('res-pred-row')).toHaveCount(946)

      await spaGo(page, '/guru/kirkpatrick/chain')
      await expect(page.getByTestId('chain-t1').getByTestId('chain-value')).toHaveText([
        '8.3/10',
        '4.6/5',
        '336',
      ])

      await spaGo(page, '/guru/kirkpatrick/interventions')
      await header(page, TITLES.s7)
      await expect(stats(page)).toHaveText(['0', '0', '0', '0'])

      await spaGo(page, '/guru/kirkpatrick/pelajar/4664')
      await expect(page.getByTestId('pel-name')).toHaveText('Pelajar Demo 004664')
      await expect(page.getByTestId('pel-tile-answers')).toContainText('219')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'guru 5 following an /admin/kirkpatrick target goes to the landing page @m12',
    provisional('SRS §9: the non-admin rule on /admin/* is INFERRED', [moduleTag(12)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      for (const path of [S4, S5, S6, S7, S8(4664)]) {
        await gotoApp(path)
        await expect(page).not.toHaveURL(/\/admin\/kirkpatrick/)
        await expect(page.getByTestId('kirk-behavior')).toHaveCount(0)
        await expect(page.getByTestId('kirk-results')).toHaveCount(0)
      }
    },
  )

  test(
    'school administrator 8 on S4-S8 (both prefixes) is redirected to its landing page @m12',
    provisional('G4 decision F6: S1 is the only Kirkpatrick screen of the school administrator', [
      moduleTag(12),
    ]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(SCHOOL_ADMIN)
      for (const prefix of ['/guru/kirkpatrick', '/admin/kirkpatrick']) {
        for (const path of ['behavior', 'results', 'chain', 'interventions', 'pelajar/4664']) {
          await gotoApp(`${prefix}/${path}`)
          await expect(page).not.toHaveURL(/\/kirkpatrick\//)
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
