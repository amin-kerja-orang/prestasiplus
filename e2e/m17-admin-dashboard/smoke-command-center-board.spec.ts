/**
 * M17-T3b S2 Command Center LIVE and S3 Aktiviti Harian as the admin (SRS M17 §12: E2E-M17-23..43) and as the
 * Admin Sekolah alias, account 8 at SMK DEMO 900001 (E2E-M17-101..128). Every scenario runs at 375 / 768 / 1280.
 *
 * Owner gaps still open (computed values asserted, not tuned): S2 T3 "{n} aktif 30h" and the S3 login card /
 * "{n} GURU" depend on the M01 / M02 login seed (XR-M17-07) and M10 §6.2.1; they are asserted as "number + label".
 * The fixture schools "SMK Contoh A / B" of the SRS (E2E-M17-103, 104, 111, 112, 122-124) do not exist in the
 * seed: account 8's own school SMK DEMO is the school A, any other school is B.
 * E2E-M17-100 (new tab from the school-admin sidebar), 128 (API 403 on #5, covered by the T1b handler tests) and
 * 116 / 117 (school admin without a school, PPD / JPN) are not driven here.
 */

import type { Locator, Page } from '@playwright/test'

import { expect, gotoApp as gotoAppOn, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const MODULE = { tag: [moduleTag(17)] }
const ADMIN = 'admin@demo.test'
const SCHOOL_ADMIN = 'adminsekolah@demo.test'
const TEACHER = 'guru@demo.test'
const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'
const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'
const CC = '/admin/command-center'
const SA = '/admin-sekolah/command-center'
const LIVE = 'GET /api/admin/command-center/live-data'

test.use({ mockInit: { latency: 0 } })

const tid = (page: Page, id: string) => page.getByTestId(id)

async function openBoard(page: Page, gotoApp: (p: string) => Promise<void>, path: string) {
  await gotoApp(path)
  await expect(tid(page, 'cc-kpi-value').nth(2)).not.toHaveText('--')
  await expect(tid(page, 'cc-kpi-sub').nth(1)).toContainText('aktif menjawab')
  // the 800 ms counter animation has ended when two reads 1 s apart agree
  let last = ''
  await expect
    .poll(
      async () => {
        const now = (await tid(page, 'cc-kpi-value').allInnerTexts()).join('|')
        const same = now === last
        last = now
        return same
      },
      { intervals: [1000], timeout: 15_000 },
    )
    .toBe(true)
}

/** Distinct left edges (rounded): the number of columns a set of boxes forms. */
async function columnsOf(locators: Locator): Promise<number> {
  const xs = await locators.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().left)),
  )
  return new Set(xs).size
}

/** The smallest computed font size (px) of the visible text under the page root. */
async function minFontSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let min = Infinity
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue
      const el = n.parentElement
      if (!el) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      min = Math.min(min, parseFloat(style.fontSize))
    }
    return min
  })
}

/**
 * BUG-M17-CC-01: at 1280x800 "Aktiviti Hari Ini" shows all its lines ("Minggu ini" and the change line fully inside
 * the panel, nothing scrolled away) and "Live Feed" shows at least the two rows live shows.
 */
async function expectTodayAndFeedNotClipped(page: Page): Promise<void> {
  const today = tid(page, 'cc-panel-today')
  const box = await today.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, over: el.scrollHeight - el.clientHeight }
  })
  expect(box.over, 'Aktiviti Hari Ini is not clipped').toBeLessThanOrEqual(1)
  for (const id of ['cc-week', 'cc-change']) {
    const r = await tid(page, id).evaluate((el) => {
      const b = el.getBoundingClientRect()
      return { top: b.top, bottom: b.bottom }
    })
    expect(r.top, id + ' top inside the panel').toBeGreaterThanOrEqual(box.top)
    expect(r.bottom, id + ' bottom inside the panel').toBeLessThanOrEqual(box.bottom + 1)
  }
  const feed = tid(page, 'cc-panel-feed')
  const f = await feed.evaluate((el) => el.getBoundingClientRect().bottom)
  const rows = await tid(page, 'cc-feed-row').evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().bottom),
  )
  expect(
    rows.filter((b) => b <= f + 1).length,
    'Live Feed rows fully visible',
  ).toBeGreaterThanOrEqual(2)
}

async function expectNotFound(page: Page): Promise<void> {
  await expect(page.locator('[data-page=not-found]')).toBeVisible()
  await expectTabTitle(page, NOT_FOUND_TITLE)
}

async function expectForbidden(page: Page): Promise<void> {
  await expect(page.locator('[data-page=forbidden]')).toBeVisible()
  await expectTabTitle(page, FORBIDDEN_TITLE)
}

test.describe('S2 admin', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  test('E2E-M17-23 / 26 header, links, LIVE pill, MYT clock, footer, no shell', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await openBoard(page, gotoApp, CC)
    await expectTabTitle(page, 'PRESTASIPLUS COMMAND CENTER')
    await expect(tid(page, 'shell-admin-sidebar')).toHaveCount(0)
    await expect(tid(page, 'cc-title')).toHaveText('PrestasiPlus Command Center')
    await expect(tid(page, 'cc-s2-back')).toHaveText('← Dashboard')
    await expect(tid(page, 'cc-s2-back')).toHaveAttribute('href', '/admin')
    await expect(tid(page, 'cc-s2-daily')).toHaveText('📊 Aktiviti Harian')
    await expect(tid(page, 'cc-s2-daily')).toHaveAttribute('href', `${CC}/daily-activity`)
    await expect(tid(page, 'cc-live-badge')).toHaveText('LIVE')
    await expectTouchTarget(tid(page, 'cc-s2-back'))
    await expectTouchTarget(tid(page, 'cc-s2-daily'))
    await expect(tid(page, 'cc-clock')).toHaveText(/^15:40:\d\d$/)
    const first = await tid(page, 'cc-clock').innerText()
    await mock.advanceTime(5000)
    await expect(tid(page, 'cc-clock')).not.toHaveText(first)
    await expect(tid(page, 'cc-footer')).toHaveText(
      'Powered by ALESA AI · PrestasiPlus © 2026 · Dijana automatik · Data dikemaskini setiap 10 saat',
    )
  })

  test('E2E-M17-24 placeholders before the first response, then filled panels', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/')
    await mock.setLatency(60_000, LIVE)
    await page.evaluate((path) => {
      const el = document.querySelector('#app') as Element & {
        __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
      }
      el.__vue_app__.config.globalProperties.$router.push(path)
    }, CC)
    await expect(tid(page, 'cc-kpi-value')).toHaveText(['--', '--', '--', '--'])
    await expect(tid(page, 'cc-alesa')).toHaveText('Memuatkan wawasan...')
    await mock.clearLatency(LIVE)
    await mock.advanceTime(61_000)
    await expect(tid(page, 'cc-kpi-value').nth(3)).toHaveText('82.9%')
    await expect(tid(page, 'cc-alesa')).not.toHaveText('Memuatkan wawasan...')
  })

  test('E2E-M17-27 / 29 / 30 counters, Top Sekolah and Top Pelajar with links', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp, CC)
    await expect(tid(page, 'cc-kpi-value')).toHaveText(['9', '3,152', '477,743', '82.9%'])
    await expect(tid(page, 'cc-kpi-sub')).toHaveText([
      'langganan aktif',
      '1,563 aktif menjawab',
      'sepanjang masa',
      'keseluruhan platform',
    ])
    await expect(tid(page, 'cc-top-school-count')).toHaveText([
      '393 plj',
      '345 plj',
      '306 plj',
      '174 plj',
      '134 plj',
    ])
    await expect(tid(page, 'cc-top-school-link').first()).toHaveAttribute(
      'href',
      `${CC}/school/8082`,
    )
    await expect(tid(page, 'cc-top-pupil')).toHaveCount(5)
    await expect(tid(page, 'cc-medal')).toHaveText(['🥇', '🥈', '🥉', '⚬', '⚬'])
    await expect(tid(page, 'cc-top-pupil-link').first()).toHaveAttribute(
      'href',
      `${CC}/student/2022`,
    )
    await expect(tid(page, 'cc-top-pupil-stat').first()).toHaveText('452 jwb · 99.6%')
    await tid(page, 'cc-top-school-link').first().click()
    await expect(page).toHaveURL(new RegExp(`${CC}/school/8082$`))
  })

  test('E2E-M17-31 Live Feed: 10 rows, first 14:59, school cut to 15 characters with the full name in title', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp, CC)
    await expect(tid(page, 'cc-feed-row')).toHaveCount(10)
    await expect(tid(page, 'cc-feed-time').first()).toHaveText('14:59')
    const school = tid(page, 'cc-feed-school').first()
    await expect(school).toHaveText(/^.{15}$/)
    expect(((await school.getAttribute('title')) ?? '').length).toBeGreaterThan(15)
    await expect(school).toHaveAttribute('href', /\/admin\/command-center\/school\/\d+$/)
  })

  test('E2E-M17-33 / 34 / 36 Kirkpatrick, ALESA AI and "Aktiviti Hari Ini"', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp, CC)
    const kirk = tid(page, 'cc-kirk-text')
    await expect(kirk.nth(0)).toHaveText('★★★★★ 4.6/5')
    await expect(kirk.nth(1)).toHaveText('82.9% ketepatan')
    // T3 is the computed 30-day engaged count (the login / activity seed is an owner gap): number + label
    await expect(kirk.nth(2)).toHaveText(/^\d+ aktif 30h$/)
    await expect(kirk.nth(3)).toHaveText('GPS 2.880')
    const bars = await tid(page, 'cc-kirk-bar').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).style.width),
    )
    expect(parseFloat(bars[0] ?? '0')).toBeCloseTo(92, 0)
    expect(parseFloat(bars[1] ?? '0')).toBeCloseTo(82.9, 0)
    expect(parseFloat(bars[3] ?? '0')).toBeCloseTo(57.6, 0)
    await expect(tid(page, 'cc-alesa')).toHaveText(
      '"Platform menunjukkan penurunan 67% minggu ini. 3.6% pelajar terlibat aktif. ' +
        'Ketepatan purata 82.9% dengan 9 sekolah aktif. GPS keseluruhan: 2.88."',
    )
    await expect(tid(page, 'cc-today-bar')).toHaveText('340 soalan')
    await expect(tid(page, 'cc-week')).toHaveText('Minggu ini: 2,508')
    await expect(tid(page, 'cc-change')).toHaveText('▼ -67% vs minggu lepas')
    await expect(tid(page, 'cc-change')).toHaveClass(/text-rose-400/)
  })

  test('E2E-M17-37 / 38 / 39 Mood, Pembetulan and Engagement', async ({ page, gotoApp }) => {
    await openBoard(page, gotoApp, CC)
    await expect(tid(page, 'cc-mood-count')).toHaveText(['307', '280', '72', '91'])
    await expect(tid(page, 'cc-correction-value')).toHaveText(['899', '+0.0%', '0%'])
    await expect(page.getByText('Top Improvers')).toHaveCount(0)
    await expect(tid(page, 'cc-band-bar')).toHaveText(['29', '11', '43', '3', '2,229'])
    const widths = await tid(page, 'cc-band-bar').evaluateAll((els) =>
      els.map((e) => parseFloat((e as HTMLElement).style.width)),
    )
    expect(widths[4]).toBeCloseTo(100, 1)
    expect(widths[0]).toBeCloseTo((29 / 2229) * 100, 1)
  })

  test('E2E-M17-25 polling: the board re-requests live-data every 10 s and a failed poll keeps the values', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await openBoard(page, gotoApp, CC)
    const count = async () => (await mock.requests(LIVE)).length
    const before = await count()
    await mock.advanceTime(10_000)
    await expect.poll(count).toBeGreaterThan(before)
    await mock.failNext(LIVE, 500)
    const afterOk = await count()
    await mock.advanceTime(10_000)
    await expect.poll(count).toBeGreaterThan(afterOk)
    await expect(tid(page, 'cc-kpi-value').nth(2)).toHaveText('477,743')
    await expect(tid(page, 'cc-title')).toBeVisible()
  })

  test('E2E-M17-40 layout: 1 / 2 / 3 columns, no horizontal scroll, text >= 12 px, header clock visible', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp, CC)
    await expect(tid(page, 'cc-top-school')).toHaveCount(5)
    await expectNoHorizontalScroll(page)
    const w = viewportWidth(page)
    const columns = await columnsOf(page.locator('[data-testid^="cc-col-"]'))
    expect(columns).toBe(w >= 1280 ? 3 : w >= 768 ? 2 : 1)
    // live placement: column 2 = Aktiviti Hari Ini, Live Feed, Top Pelajar, Mood; column 3 = Pembetulan alone
    const ids = (col: string) =>
      page
        .locator(`[data-testid="${col}"] > section`)
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
    expect(await ids('cc-col-2')).toEqual([
      'cc-panel-today',
      'cc-panel-feed',
      'cc-panel-top-pupils',
      'cc-panel-mood',
    ])
    expect(await ids('cc-col-3')).toEqual(['cc-panel-correction'])
    if (w >= 1280) {
      await expectTodayAndFeedNotClipped(page)
      // nothing is clipped below the board: every column ends above the Engagement panel
      const top = await tid(page, 'cc-panel-engagement').evaluate(
        (e) => e.getBoundingClientRect().top,
      )
      const bottoms = await page
        .locator('[data-testid^="cc-col-"]')
        .evaluateAll((els) =>
          els.map((c) => Math.max(...[...c.children].map((k) => k.getBoundingClientRect().bottom))),
        )
      for (const b of bottoms) expect(b).toBeLessThanOrEqual(top + 1)
    }
    await expectNoColumnHoles(page)
    expect(await minFontSize(page)).toBeGreaterThanOrEqual(12)
    await expect(tid(page, 'cc-clock')).toBeInViewport()
    await expect(tid(page, 'cc-live-badge')).toBeInViewport()
    if (w >= 1280) {
      // the board fills the viewport; panels scroll inside themselves
      const doc = await page.evaluate(() => document.documentElement.scrollHeight)
      expect(doc).toBeLessThanOrEqual(800 + 1)
    } else {
      // every panel reachable by scrolling the page
      await tid(page, 'cc-panel-engagement').scrollIntoViewIfNeeded()
      await expect(tid(page, 'cc-footer')).toBeVisible()
    }
  })

  test('guest on the board goes to /login (E2E-M17-05)', async ({ newTab }) => {
    const tab = await newTab()
    await gotoAppOn(tab, CC)
    await expect(tab).toHaveURL(/\/login/)
  })
})

test.describe('S3 admin', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  const open = async (
    page: Page,
    gotoApp: (p: string) => Promise<void>,
    path = `${CC}/daily-activity`,
  ) => {
    await gotoApp(path)
    await expect(tid(page, 'cc-pulse-value').first()).not.toHaveText('-')
    await expect(tid(page, 'cc-school-row').first()).toBeVisible()
  }

  test('E2E-M17-41 header, links, clock, "Hari Ini" active, ?period=week ignored', async ({
    page,
    gotoApp,
  }) => {
    await open(page, gotoApp, `${CC}/daily-activity?period=week`)
    await expectTabTitle(page, 'AKTIVITI PLATFORM — PRESTASIPLUS')
    await expect(tid(page, 'shell-admin-sidebar')).toHaveCount(0)
    await expect(tid(page, 'cc-title')).toHaveText('⚡ AKTIVITI PLATFORM')
    await expect(tid(page, 'cc-s3-back')).toHaveText('◀ Command Center')
    await expect(tid(page, 'cc-s3-back')).toHaveAttribute('href', CC)
    // S8 is not built: the link is hidden rather than dead (DV-M17-45).
    await expect(tid(page, 'cc-s3-report')).toHaveCount(0)
    await expect(tid(page, 'cc-clock')).toHaveText(/^15:40:\d\d$/)
    await expect(tid(page, 'cc-tab')).toHaveText(['📅 Hari Ini', '📆 Minggu Ini', '🗓️ Bulan Ini'])
    await expect(page.locator('[data-testid=cc-tab][data-period=today]')).toHaveAttribute(
      'data-active',
      'true',
    )
    await expect(tid(page, 'cc-pulse-label')).toHaveText([
      'Sekolah Aktif',
      'Login Hari Ini',
      'Pelajar Aktif',
      'Soalan Dijawab',
      'Sesi Latihan',
      'Engagement',
    ])
  })

  test('E2E-M17-15..17 today: pulse cards, school rows, heatmap, panels', async ({
    page,
    gotoApp,
  }) => {
    await open(page, gotoApp)
    const values = tid(page, 'cc-pulse-value')
    await expect(values.nth(3)).toHaveText('340')
    await expect(tid(page, 'cc-pulse-sub').nth(2)).toHaveText('daripada 3,152')
    await expect(tid(page, 'cc-pulse-sub').nth(0)).toHaveText(/^daripada \d+$/)
    // login card: number + role line (the login seed is an owner gap, XR-M17-07)
    await expect(values.nth(1)).toHaveText(/^\d+$/)
    await expect(tid(page, 'cc-pulse-sub').nth(3)).toHaveText(/^Ketepatan: \d+(\.\d)?%$/)
    await expect(tid(page, 'cc-pulse-sub').nth(4)).toHaveText(/^Purata: \d+m \d+s$/)
    await expect(tid(page, 'cc-pulse-sub').nth(5)).toHaveText('Mood:0 Badge:0 Misi:0')
    const rows = tid(page, 'cc-school-row')
    expect(await rows.count()).toBeGreaterThan(0)
    await expect(tid(page, 'cc-school-name').first()).toHaveText(/^1\. \S/)
    await expect(tid(page, 'cc-heat-cell')).toHaveCount(24)
    const hot = page.locator('[data-testid=cc-heat-cell]:not([data-count="0"])').first()
    await expect(hot).toHaveAttribute('title', /^\d+:00 — \d+ soalan$/)
    await expect(tid(page, 'cc-panel-schools')).toBeVisible()
    await expect(tid(page, 'cc-subject').first()).toBeVisible()
    await expect(tid(page, 'cc-daily-top-row').first()).toBeVisible()
    await expect(tid(page, 'cc-panel-daily-mood')).toContainText('Tiada data')
    await expect(tid(page, 'cc-panel-badges')).toContainText('Tiada badge baru')
  })

  test('E2E-M17-18 / 19 tabs: week and month request the period, label per tab, heatmap on today only', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await open(page, gotoApp)
    await page.locator('[data-testid=cc-tab][data-period=week]').click()
    await expect(tid(page, 'cc-pulse-label').nth(1)).toHaveText('Login Minggu Ini')
    await expect(tid(page, 'cc-pulse-value').nth(3)).toHaveText('2,508')
    await expect(tid(page, 'cc-panel-heatmap')).toHaveCount(0)
    const last = await mock.lastRequest('GET /api/command-center/daily-activity')
    expect(last?.query).toMatchObject({ period: 'week' })
    await page.locator('[data-testid=cc-tab][data-period=month]').click()
    await expect(tid(page, 'cc-pulse-label').nth(1)).toHaveText('Login Bulan Ini')
    await expect(tid(page, 'cc-pulse-value').nth(3)).toHaveText('20,206') // E2E-M17-97: computed at the project clock; live 20,351 includes post-clock answers
    await page.locator('[data-testid=cc-tab][data-period=today]').click()
    await expect(tid(page, 'cc-panel-heatmap')).toBeVisible()
    await expect(tid(page, 'cc-pulse-value').nth(3)).toHaveText('340')
  })

  test('E2E-M17-16 school drill: toggle, sections, links, "Lihat penuh →", closed by a tab click', async ({
    page,
    gotoApp,
  }) => {
    await open(page, gotoApp)
    await page.locator('[data-testid=cc-tab][data-period=month]').click()
    await expect(tid(page, 'cc-pulse-label').nth(1)).toHaveText('Login Bulan Ini')
    const row = tid(page, 'cc-school-row').first()
    await row.click()
    await expect(tid(page, 'cc-drill')).toBeVisible()
    await expect(tid(page, 'cc-drill-teachers')).toContainText(/Guru Aktif \(\d+\)/)
    await expect(tid(page, 'cc-drill-students')).toContainText(/Pelajar \(\d+\)/)
    const full = tid(page, 'cc-drill-full')
    await expect(full).toHaveText('Lihat penuh →')
    await expect(full).toHaveAttribute('href', /\/admin\/command-center\/school\/\d+$/)
    await expect(tid(page, 'cc-drill-teacher').first().getByRole('link')).toHaveAttribute(
      'href',
      /\/admin\/command-center\/school\/\d+\/teacher\/\d+$/,
    )
    await expectNoHorizontalScroll(page)
    await row.click()
    await expect(tid(page, 'cc-drill')).toHaveCount(0)
    await row.click()
    await expect(tid(page, 'cc-drill')).toBeVisible()
    await page.locator('[data-testid=cc-tab][data-period=week]').click()
    await expect(tid(page, 'cc-drill')).toHaveCount(0)
  })

  test('E2E-M17-42 the 30 s reload keeps the period and the open drill', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await open(page, gotoApp)
    await page.locator('[data-testid=cc-tab][data-period=week]').click()
    await expect(tid(page, 'cc-pulse-label').nth(1)).toHaveText('Login Minggu Ini')
    await tid(page, 'cc-school-row').first().click()
    await expect(tid(page, 'cc-drill')).toBeVisible()
    const path = 'GET /api/command-center/daily-activity'
    const before = (await mock.requests(path)).length
    await mock.advanceTime(30_000)
    await expect.poll(async () => (await mock.requests(path)).length).toBeGreaterThan(before)
    expect((await mock.lastRequest(path))?.query).toMatchObject({ period: 'week' })
    await expect(tid(page, 'cc-drill')).toBeVisible()
    await expect(tid(page, 'cc-pulse-label').nth(1)).toHaveText('Login Minggu Ini')
  })

  test(
    'E2E-M17-43 failures: "Gagal memuatkan" in the lists and "Gagal" in the drill',
    provisional('SOURCE-DERIVED copy, not observed on live'),
    async ({ page, gotoApp, mock }) => {
      await open(page, gotoApp)
      await mock.failNext('GET /api/command-center/daily-activity/school/:id', 500)
      await tid(page, 'cc-school-row').first().click()
      await expect(tid(page, 'cc-drill-error')).toHaveText('Gagal')
      await mock.failNext('GET /api/command-center/daily-activity', 500)
      await page.locator('[data-testid=cc-tab][data-period=week]').click()
      await expect(tid(page, 'daily-error').first()).toHaveText('Gagal memuatkan')
    },
  )

  test('E2E-M17-102 layout: no horizontal scroll, columns, text >= 12 px, touch targets', async ({
    page,
    gotoApp,
  }) => {
    await open(page, gotoApp)
    await expectNoHorizontalScroll(page)
    expect(await minFontSize(page)).toBeGreaterThanOrEqual(12)
    const w = viewportWidth(page)
    const cards = await columnsOf(tid(page, 'cc-pulse-label').locator('xpath=..'))
    expect(cards).toBe(w >= 1280 ? 6 : w >= 768 ? 3 : 2)
    for (const t of await tid(page, 'cc-tab').all()) await expectTouchTarget(t)
    await expectTouchTarget(tid(page, 'cc-s3-back'))
    await page.locator('[data-testid=cc-tab][data-period=month]').click()
    await tid(page, 'cc-school-row').first().click()
    await expect(tid(page, 'cc-drill')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

test.describe('S2 / S3 Admin Sekolah alias (account 8, SMK DEMO)', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(SCHOOL_ADMIN)
  })

  test('E2E-M17-103 / 106 school copy, no "keseluruhan platform", no "Top Sekolah"', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp, SA)
    await expectTabTitle(page, 'PRESTASIPLUS COMMAND CENTER')
    await expect(tid(page, 'shell-user-sidebar')).toHaveCount(0)
    await expect(tid(page, 'cc-s2-subtitle')).toHaveText('Pemantauan langsung sekolah anda')
    await expect(tid(page, 'cc-kpi-sub').nth(3)).toHaveText('sekolah anda')
    await expect(page.getByText('keseluruhan platform')).toHaveCount(0)
    await expect(tid(page, 'cc-panel-top-schools')).toHaveCount(0)
    await expect(page.getByText('Top Sekolah')).toHaveCount(0)
    // computed from the seed (SMK DEMO): school figures, never the platform's 3,152 / 477,743
    const values = await tid(page, 'cc-kpi-value').allInnerTexts()
    expect(values[1]).not.toBe('3,152')
    expect(values[2]).not.toBe('477,743')
    await expect(tid(page, 'cc-alesa')).toContainText('Sekolah anda menunjukkan')
    await expect(page.getByText('Platform menunjukkan')).toHaveCount(0)
  })

  test('E2E-M17-104 / 105 / 108 / 109 own school only: no other school name, stable after the poll, ?schoolId ignored', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await openBoard(page, gotoApp, `${SA}?schoolId=8082&school_id=8082`)
    const before = await tid(page, 'cc-kpi-value').allInnerTexts()
    const body = await page.locator('body').innerText()
    expect(body).not.toContain('ENGKU HUSAIN')
    expect(body).not.toContain('BANDAR RINCHING')
    const feedSchools = await tid(page, 'cc-feed-school').allInnerTexts()
    for (const s of feedSchools) expect('SMK DEMO'.startsWith(s) || s === 'SMK DEMO').toBe(true)
    const count = async () => (await mock.requests(LIVE)).length
    const n = await count()
    await mock.advanceTime(10_000)
    await expect.poll(count).toBeGreaterThan(n)
    await expect.poll(async () => tid(page, 'cc-kpi-value').allInnerTexts()).toEqual(before)
    expect(await page.locator('body').innerText()).not.toContain('ENGKU HUSAIN')
  })

  test('E2E-M17-110 a failed poll keeps the previous values', async ({ page, gotoApp, mock }) => {
    await openBoard(page, gotoApp, SA)
    const before = await tid(page, 'cc-kpi-value').allInnerTexts()
    await mock.failNext(LIVE, 500)
    await mock.advanceTime(10_000)
    await expect(tid(page, 'cc-title')).toBeVisible()
    expect(await tid(page, 'cc-kpi-value').allInnerTexts()).toEqual(before)
  })

  test(
    'E2E-M17-106 / 113 panels leave no hole; "Pembetulan" zeros; "Engagement" shows the 7 days',
    provisional('INFERRED / PROPOSED: Pembetulan zeros, 7-day Engagement'),
    async ({ page, gotoApp }) => {
      await openBoard(page, gotoApp, SA)
      await expect(tid(page, 'cc-correction-value')).toHaveText(['0', '+0.0%', '0%'])
      await expect(tid(page, 'cc-day')).toHaveCount(7)
      const labels = await tid(page, 'cc-day-label').allInnerTexts()
      expect(labels).toHaveLength(7)
      for (const l of labels) expect(l).toMatch(/^(Isn|Sel|Rab|Kha|Jum|Sab|Ahd)$/)
      const heights = await tid(page, 'cc-day-bar').evaluateAll((els) =>
        els.map((e) => parseFloat((e as HTMLElement).style.height)),
      )
      expect(Math.max(...heights)).toBeCloseTo(100, 1)
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(4)
      await expect(tid(page, 'cc-engagement-bands')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
      expect(await minFontSize(page)).toBeGreaterThanOrEqual(12)
      const w = viewportWidth(page)
      if (w >= 1280) await expectTodayAndFeedNotClipped(page)
      expect(await columnsOf(page.locator('[data-testid^="cc-col-"]'))).toBe(
        w >= 1280 ? 3 : w >= 768 ? 2 : 1,
      )
      if (w >= 1280) {
        // no column ends in a hole: the last panel of each column reaches the column's bottom
        const gaps = await page.locator('[data-testid^="cc-col-"]').evaluateAll((cols) =>
          cols.map((c) => {
            const last = c.lastElementChild?.getBoundingClientRect().bottom ?? 0
            return Math.abs(c.getBoundingClientRect().bottom - last)
          }),
        )
        for (const g of gaps) expect(g).toBeLessThanOrEqual(2)
      }
      await expectNoColumnHoles(page)
    },
  )

  test(
    'E2E-M17-121 / 126 header links, feed school link and pupil link stay inside the alias prefix',
    provisional('INFERRED / PROPOSED: alias drill paths and header targets'),
    async ({ page, gotoApp }) => {
      await openBoard(page, gotoApp, SA)
      await expect(tid(page, 'cc-s2-back')).toHaveAttribute('href', '/admin-sekolah')
      await expect(tid(page, 'cc-s2-daily')).toHaveAttribute('href', `${SA}/daily-activity`)
      const link = tid(page, 'cc-feed-school').first()
      await expect(link).toHaveAttribute('href', /^\/admin-sekolah\/command-center\/school\/\d+$/)
      await expect(tid(page, 'cc-top-pupil-link').first()).toHaveAttribute(
        'href',
        /^\/admin-sekolah\/command-center\/student\/\d+$/,
      )
      await link.click()
      await expect(page).toHaveURL(/\/admin-sekolah\/command-center\/school\/\d+$/)
      await expect(tid(page, 'cc-back')).toHaveAttribute('href', SA)
      await expect(tid(page, 'cc-teacher-row').first()).toBeVisible()
    },
  )

  test(
    'E2E-M17-122 / 124 / 125 a school or pupil outside the school, and a non-numeric id, answer the 404 page',
    provisional('INFERRED / PROPOSED: 404 rule for objects outside the school'),
    async ({ page, gotoApp }) => {
      await gotoApp(`${SA}/school/8082`)
      await expectNotFound(page)
      await gotoApp(`${SA}/student/2022`)
      await expectNotFound(page)
      await gotoApp(`${SA}/classroom/370`)
      await expectNotFound(page)
      await gotoApp(`${SA}/school/abc`)
      await expectNotFound(page)
      await gotoApp(`${SA}/student/999999999`)
      await expectNotFound(page)
    },
  )

  test(
    'E2E-M17-127 S3 alias: title, tabs, own school only, "daripada 1", no school list',
    provisional('INFERRED / PROPOSED: S3 alias path and header composition'),
    async ({ page, gotoApp }) => {
      await gotoApp(`${SA}/daily-activity`)
      await expect(tid(page, 'cc-pulse-value').first()).not.toHaveText('-')
      await expectTabTitle(page, 'AKTIVITI SEKOLAH — PRESTASIPLUS')
      await expect(tid(page, 'cc-title')).toHaveText('⚡ AKTIVITI SEKOLAH')
      await expect(tid(page, 'cc-s3-back')).toHaveAttribute('href', SA)
      await expect(tid(page, 'cc-s3-report')).toHaveCount(0)
      await expect(tid(page, 'cc-pulse-sub').nth(0)).toHaveText('daripada 1')
      await expect(tid(page, 'cc-panel-schools')).toHaveCount(0)
      await expect(page.getByText('😴 Tiada aktiviti')).toHaveCount(0)
      await page.locator('[data-testid=cc-tab][data-period=week]').click()
      await expect(tid(page, 'cc-pulse-label').nth(1)).toHaveText('Login Minggu Ini')
      await expect(tid(page, 'cc-pulse-sub').nth(0)).toHaveText(/^daripada 1$/)
      const body = await page.locator('body').innerText()
      expect(body).not.toContain('ENGKU HUSAIN')
      expect(body).not.toContain('AKTIVITI PLATFORM')
      await expectNoHorizontalScroll(page)
      expect(await minFontSize(page)).toBeGreaterThanOrEqual(12)
    },
  )

  test(
    'E2E-M17-126 the S2 link "📊 Aktiviti Harian" opens the S3 alias and "◀ Command Center" returns',
    provisional('INFERRED / PROPOSED: S3 alias path and header targets'),
    async ({ page, gotoApp }) => {
      await openBoard(page, gotoApp, SA)
      await tid(page, 'cc-s2-daily').click()
      await expect(page).toHaveURL(new RegExp(`${SA}/daily-activity$`))
      await expect(tid(page, 'cc-title')).toHaveText('⚡ AKTIVITI SEKOLAH')
      await tid(page, 'cc-s3-back').click()
      await expect(page).toHaveURL(new RegExp(`${SA}$`))
    },
  )
})

test.describe('alias refusals', MODULE, () => {
  test('E2E-M17-115 the platform admin on the alias gets the 403 page', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(SA)
    await expectForbidden(page)
    await gotoApp(`${SA}/daily-activity`)
    await expectForbidden(page)
  })

  test(
    'E2E-M17-119 a teacher on the alias gets the 403 page',
    provisional('INFERRED refusal page for teacher'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(TEACHER)
      await gotoApp(SA)
      await expectForbidden(page)
    },
  )

  test('E2E-M17-118 a guest on the alias is sent to /login', async ({ page, gotoApp }) => {
    await gotoApp(SA)
    await expect(page).toHaveURL(/\/login/)
  })

  test('the school admin on /admin/command-center is not admitted (E2E-M17-06 pattern)', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(SCHOOL_ADMIN)
    await gotoApp(CC)
    await expect(tid(page, 'cc-s2')).toHaveCount(0)
  })
})

/**
 * No column ends in a hole (DV-M17-54): columns that share a row (same top) end together, and the last row reaches
 * the bottom of the `cc-panels` grid. At 375 every column is its own row, at 768 cols 1-2 share a row and col 3
 * spans the next one, at 1280 all three share one.
 */
async function expectNoColumnHoles(page: Page): Promise<void> {
  const holes = await page.locator('[data-testid^="cc-col-"]').evaluateAll((cols) => {
    const grid = document.querySelector('[data-testid="cc-panels"]')!.getBoundingClientRect().bottom
    const boxes = cols.map((c) => ({
      top: Math.round(c.getBoundingClientRect().top),
      bottom: c.lastElementChild?.getBoundingClientRect().bottom ?? 0,
    }))
    const rowBottom = (top: number) =>
      Math.max(...boxes.filter((b) => b.top === top).map((b) => b.bottom))
    const lastRow = Math.max(...boxes.map((b) => b.top))
    return [
      ...boxes.map((b) => Math.abs(rowBottom(b.top) - b.bottom)),
      Math.abs(grid - rowBottom(lastRow)),
    ]
  })
  for (const h of holes) expect(h).toBeLessThanOrEqual(2)
}
