/**
 * M27-T5: S4 "Amaran Awal — Sekolah" `/amaran/sekolah` at 375 / 768 / 1280 (SRS M27 Part B v1.8 §24: E2E-M27-41 and
 * 42 (S4 part), 47 (S4 part), 70…76). The alias of M18 S22 for the school admin: the school comes from the session,
 * M18 #21 and #30 are called with it.
 *
 * Personas (URS §10.3): P1 azlan (school 900003, no pupil), P4 = the populated school's admin (user 1214, as the S0
 * spec). Oracle: the figures are compared with the page's own invariants and with the S0 "Amaran Awal" panel of the
 * same session (the same M18 owner call), never pinned.
 *
 * `@blocked-by M18`: only the steps that FOLLOW "Keberkesanan Intervensi", "Ringkasan Eksekutif" and the M18 route
 * `/amaran/sekolah/{id}` (pages deferred, DV-M27-23); the buttons themselves, their hrefs and the CSV are run.
 */

import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { createMockHandle, gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  provisional,
  viewportWidth,
} from '../support'

const MODULE = { tag: ['@m27'] }
const S4 = '/amaran/sekolah'
const TAB_TITLE = 'Amaran Awal — Sekolah | PRESTASIPLUS'
const AZLAN = 'azlan@demo.test'
/** Admin Sekolah of the populated school (P4; as the S0 and S1 specs). */
const POPULATED = 1214
const SCHOOL_P1 = 'SMK Demo Seri Putra'
const OWN_P1 = 900003

const FORBIDDEN_COPY =
  'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.'
const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'
const TILE_LABELS = ['Jumlah Pelajar', 'On Track', 'Perlu Perhatian', 'Berisiko Tinggi']
const COLUMNS = [
  '#',
  'Pelajar',
  'Tingkatan / Kelas',
  'Skor',
  'Status',
  'Ketepatan',
  'Penglibatan',
  'Penguasaan',
]
const STATUSES = ['On Track', 'Perlu Perhatian', 'Berisiko Tinggi']

test.use({ mockInit: { latency: 0 } })

/** Signs a non-canonical fixture user in (`loginAs` knows canonical accounts only). */
async function signIn(page: Page, who: string | number): Promise<void> {
  await gotoAppOn(page, '/login')
  await createMockHandle(page).setUser(who)
}

/** In-app navigation (no reload): keeps the mock state and the booted owner caches. */
async function spaGoto(page: Page, path: string): Promise<void> {
  await page.evaluate(async (p) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(t: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(p)
  }, path)
}

async function open(
  page: Page,
  gotoApp: (p: string) => Promise<void>,
  query = '',
): Promise<void> {
  await gotoApp(`${S4}${query}`)
  // the populated schools are computed from large owner datasets: allow the first answer time
  await expect(page.getByTestId('am-tiles')).toBeVisible({ timeout: 60_000 })
}

const num = (text: string): number => Number(text.replace(/[,%\s]/g, ''))

const tileValues = async (page: Page): Promise<number[]> =>
  (
    await page
      .getByTestId('am-tile-value')
      .evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()))
  ).map(num)

async function expectForbiddenPage(page: Page): Promise<void> {
  const root = page.locator('[data-page=forbidden]')
  await expect(root).toBeVisible()
  await expectTabTitle(page, FORBIDDEN_TITLE)
  await expect(root).toContainText('403')
  await expect(root).toContainText('Akses Ditolak')
  await expect(root).toContainText(FORBIDDEN_COPY)
  await expect(page.getByTestId('am-page')).toHaveCount(0)
}

test.describe('S4 access (E2E-M27-72)', MODULE, () => {
  test('E2E-M27-72 a guest on S4 goes to /login', async ({ page, gotoApp }) => {
    await gotoApp(S4)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('am-page')).toHaveCount(0)
  })

  for (const email of ['admin@demo.test', 'guru@demo.test', 'pelajar@demo.test']) {
    test(`E2E-M27-72 ${email} gets the 403 page with the exact copy on S4, no M18 call`, async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      await loginAs(email)
      await gotoApp(S4)
      await expectForbiddenPage(page)
      expect(page.url()).toContain(S4)
      expect(await mock.requests('/api/amaran/schools')).toHaveLength(0)
    })
  }
})

test.describe('S4 header and sidebar (E2E-M27-41, 42; S4 part)', MODULE, () => {
  test('E2E-M27-41 P1: header title, school sub-line, tab title, no breadcrumb', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await expect(page.getByTestId('shell-user-title')).toHaveText('Amaran Awal — Sekolah')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(SCHOOL_P1)
    await expectTabTitle(page, TAB_TITLE)
    await expect(page.getByTestId('am-page')).not.toContainText('Dashboard Sekolah')
    await expect(page.getByTestId('am-page').getByRole('link', { name: /←/ })).toHaveCount(0)
  })

  test('E2E-M27-41 P1: a level adds " — Tingkatan {n}" to the sub-line', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp, '?tingkatan=T5')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
      `${SCHOOL_P1} — Tingkatan 5`,
    )
    await expectTabTitle(page, TAB_TITLE)
  })

  test('E2E-M27-42 at 1280 only "Amaran Awal" is active in the sidebar (also with ?tingkatan=), "Dashboard" is not', async ({
    page,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-42 runs at 1280 only')
    await signIn(page, AZLAN)
    await open(page, gotoApp, '?tingkatan=T4')
    const sidebar = page.getByTestId('shell-user-sidebar')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.locator('[data-nav-id="sa-amaran-awal"]')).toHaveClass(/\bactive\b/)
    await expect(sidebar.locator('[data-nav-id="sa-dashboard"]')).not.toHaveClass(/\bactive\b/)
    await expect(sidebar.locator('a.active')).toHaveCount(1)
  })

  test('E2E-M27-72 the sidebar item "Amaran Awal" opens /amaran/sekolah', async ({
    page,
    gotoApp,
  }) => {
    test.skip(!isDesktopShell(page), 'the drawer variant is shell-owned (E2E-M27-42b)')
    await signIn(page, AZLAN)
    await gotoApp('/admin-sekolah')
    await expect(page.getByTestId('sd-page')).toBeVisible({ timeout: 60_000 })
    const item = page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-amaran-awal"]')
    await expect(item).toHaveAttribute('href', S4)
    await item.click()
    await expect(page).toHaveURL(new RegExp(`${S4}$`))
    await expect(page.getByTestId('am-page')).toBeVisible({ timeout: 60_000 })
  })
})

test.describe('S4 populated school (E2E-M27-47, 70, 71, 73)', MODULE, () => {
  test('E2E-M27-70 P4: pills, four tiles and the distribution equal the tally and the S0 panel', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)

    // pills in order, "Semua Tingkatan" active, on the alias
    await expect(page.locator('[data-testid^="am-pill-"]')).toHaveText([
      'Semua Tingkatan',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    const hrefs = { all: S4, T4: `${S4}?tingkatan=T4`, T5: `${S4}?tingkatan=T5` }
    for (const [k, href] of Object.entries(hrefs)) {
      await expect(page.getByTestId(`am-pill-${k}`)).toHaveAttribute('href', href)
      await expect(page.getByTestId(`am-pill-${k}`)).toHaveAttribute(
        'data-active',
        k === 'all' ? 'true' : 'false',
      )
    }

    // tiles in order; Jumlah = On Track + Perlu Perhatian + Berisiko Tinggi
    await expect(page.getByTestId('am-tile-label')).toHaveText(TILE_LABELS)
    const [total, green, yellow, red] = (await tileValues(page)) as [number, number, number, number]
    expect(total).toBeGreaterThan(0)
    expect(green + yellow + red).toBe(total)

    // distribution: legend counts, integer percent per segment
    const dist = page.getByTestId('am-distribution')
    await expect(dist).toContainText('Taburan Risiko Seluruh Sekolah')
    await expect(page.getByTestId('am-legend-green')).toHaveText(`Hijau: ${green}`)
    await expect(page.getByTestId('am-legend-yellow')).toHaveText(`Kuning: ${yellow}`)
    await expect(page.getByTestId('am-legend-red')).toHaveText(`Merah: ${red}`)
    for (const [key, n] of [['green', green], ['yellow', yellow], ['red', red]] as const) {
      const seg = page.getByTestId(`am-seg-${key}`)
      if (n === 0) await expect(seg).toHaveCount(0)
      else await expect(seg).toHaveText(`${Math.round((n / total) * 100)}%`)
    }

    // M18 #21 was asked for the session school, without a level
    const calls = await createMockHandle(page).requests('/api/amaran/schools/')
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.at(-1)?.query ?? {}).not.toHaveProperty('tingkatan')

    // E2E-M27-47 (S4 part): the same figures as the S0 "Amaran Awal" panel (AC-M27-33.3)
    await spaGoto(page, '/admin-sekolah')
    await expect(page.getByTestId('sd-risk-total')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('sd-risk-safe')).toHaveText(green.toLocaleString('en-US'))
    await expect(page.getByTestId('sd-risk-watch')).toHaveText(yellow.toLocaleString('en-US'))
    await expect(page.getByTestId('sd-risk-high')).toHaveText(red.toLocaleString('en-US'))
    await expect(page.getByTestId('sd-risk-total')).toContainText(total.toLocaleString('en-US'))
  })

  test('E2E-M27-71 P4: subject analysis rows and the risk list as M18 S22', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const [total] = await tileValues(page)

    // subject analysis: present only with data; rows "{w}/{m} pelajar lemah ({p}%)"
    const subjects = page.getByTestId('am-subjects')
    if ((await subjects.count()) > 0) {
      await expect(subjects).toContainText('Analisis Risiko Mengikut Subjek')
      const rows = await page
        .getByTestId('am-subject-weak')
        .evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()))
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) {
        const m = /^([\d,]+)\/([\d,]+) pelajar lemah \((\d+)%\)$/.exec(r)
        expect(m, `row "${r}"`).not.toBeNull()
        const w = num(m![1]!)
        const t = num(m![2]!)
        expect(Number(m![3])).toBe(Math.round((w / t) * 100))
      }
      await expect(page.getByTestId('am-subject-name')).toHaveCount(rows.length)
    }

    // risk list: heading, sub-line, eight columns, one row per pupil, score descending, ranks 1..n
    const list = page.getByTestId('am-pupils')
    await expect(list).toContainText('Senarai Pelajar Berisiko')
    await expect(list).toContainText('Disusun mengikut skor risiko tertinggi')
    await expect(page.locator('[data-testid="am-table"] th')).toHaveText(COLUMNS)
    const rows = page.getByTestId('am-pupil-row')
    await expect(rows).toHaveCount(total!)
    const ranks = (await page.getByTestId('am-rank').allTextContents()).map(num)
    expect(ranks).toEqual(ranks.map((_, i) => i + 1))
    const scores = (await page.getByTestId('am-score').allTextContents()).map(num)
    for (let i = 1; i < scores.length; i++) expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!)
    for (const s of await page.getByTestId('am-status').allTextContents()) {
      expect(STATUSES).toContain(s.trim())
    }
    // no personal data other than the name: no IC, e-mail or phone in the list
    await expect(list).not.toContainText(/@|\b\d{6}-\d{2}-\d{4}\b|\b01\d-?\d{7,8}\b/)
  })

  test('E2E-M27-71 P4: ?tingkatan=T4 activates the pill, adds the level to the sub-line and narrows the tally', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const [all] = await tileValues(page)
    await spaGoto(page, `${S4}?tingkatan=T4`)
    await expect(page.getByTestId('am-page')).toHaveAttribute('data-level', 'T4', {
      timeout: 60_000,
    })
    await expect(page.getByTestId('am-pill-T4')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('am-pill-all')).toHaveAttribute('data-active', 'false')
    await expect(page.getByTestId('shell-user-subtitle')).toContainText(' — Tingkatan 4')
    const [t4, g, y, r] = (await tileValues(page)) as [number, number, number, number]
    expect(t4).toBeLessThanOrEqual(all!)
    expect(g + y + r).toBe(t4)
    await expect(page.getByTestId('am-pupil-row')).toHaveCount(t4)
    const calls = await createMockHandle(page).requests('/api/amaran/schools/')
    expect(calls.at(-1)?.query).toMatchObject({ tingkatan: 'T4' })
  })

  test('E2E-M27-73 the three buttons: order, labels, icons and hrefs; the CSV link is a download link', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    const buttons = page.locator('[data-testid="am-actions"] > *')
    await expect(buttons).toHaveText([
      'Keberkesanan Intervensi',
      'Ringkasan Eksekutif',
      'Muat Turun CSV',
    ])
    await expect(buttons).toHaveCount(3)
    const ids = ['am-btn-keberkesanan', 'am-btn-ringkasan', 'am-btn-csv']
    const icons = ['fa-chart-pie', 'fa-file-alt', 'fa-download']
    const hrefs = [
      '/amaran/keberkesanan',
      `/amaran/ringkasan-eksekutif?scope=school&school_id=${OWN_P1}`,
      `/amaran/export/school/${OWN_P1}`,
    ]
    for (let i = 0; i < 3; i++) {
      const b = page.getByTestId(ids[i]!)
      await expect(b).toHaveAttribute('href', hrefs[i]!)
      await expect(b).toHaveAttribute('data-icon', icons[i]!)
      await expect(b.locator('svg')).toHaveCount(1)
      await expectTouchTarget(b)
    }
  })

  test(
    'E2E-M27-73 @blocked-by M18 following "Keberkesanan Intervensi" and "Ringkasan Eksekutif" opens the M18 pages',
    provisional('M18 PPD/JPN pages deferred (DV-M27-23)', MODULE.tag),
    async ({ page, gotoApp }) => {
      await signIn(page, AZLAN)
      await open(page, gotoApp)
      await page.getByTestId('am-btn-keberkesanan').click()
      await expect(page).toHaveURL(/\/amaran\/keberkesanan$/)
      await expect(page.locator('[data-page=not-found]')).toHaveCount(0)
      await spaGoto(page, S4)
      await page.getByTestId('am-btn-ringkasan').click()
      await expect(page).toHaveURL(
        new RegExp(`/amaran/ringkasan-eksekutif\\?scope=school&school_id=${OWN_P1}$`),
      )
      await expect(page.locator('[data-page=not-found]')).toHaveCount(0)
    },
  )
})

test.describe('S4 CSV and scope (E2E-M27-74, 75)', MODULE, () => {
  test('E2E-M27-74 P4: "Muat Turun CSV" downloads amaran-sekolah-{id}-{yyyymmdd}.csv with the pupils of the school', async ({
    page,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-74 runs at 1280 only')
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const [total] = await tileValues(page)
    const download = page.waitForEvent('download')
    await page.getByTestId('am-btn-csv').click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^amaran-sekolah-\d+-\d{8}\.csv$/)
    const calls = await createMockHandle(page).requests('/api/amaran/export/school/')
    expect(calls).toHaveLength(1)
    const text = readFileSync((await file.path())!, 'utf8').replace(/^﻿/, '')
    const lines = text.split(/\r?\n/).filter((l) => l !== '')
    // header + one row per pupil of the own school; no IC, e-mail or phone column
    expect(lines.length - 1).toBe(total)
    expect(lines[0]).not.toMatch(/\bIC\b|e-?mel|email|telefon|phone/i)
    expect(page.url()).toContain(S4)
  })

  test(
    'E2E-M27-75 @blocked-by M18 P1 opening /amaran/sekolah/900001 (a foreign school) gets M18\'s 403',
    provisional(
      'the M18 page route /amaran/sekolah/{id} is deferred; the endpoint refusal is covered by the M18 handler tests (amaran-endpoints.test.ts)',
      MODULE.tag,
    ),
    async ({ page, gotoApp }) => {
      await signIn(page, AZLAN)
      await gotoApp('/amaran/sekolah/900001')
      await expectTabTitle(page, FORBIDDEN_TITLE)
      await expect(page.getByTestId('am-page')).toHaveCount(0)
    },
  )
})

test.describe('S4 school without pupils (E2E-M27-76)', MODULE, () => {
  test(
    'E2E-M27-76 P1 (no pupil): zeros, a bar without segments, no subject card, no rows; ?tingkatan=T4 activates the pill',
    provisional('PROPOSED empty state (FR-M27-79)', MODULE.tag),
    async ({ page, gotoApp }) => {
      await signIn(page, AZLAN)
      await open(page, gotoApp)
      expect(await tileValues(page)).toEqual([0, 0, 0, 0])
      await expect(page.getByTestId('am-legend-green')).toHaveText('Hijau: 0')
      await expect(page.getByTestId('am-legend-yellow')).toHaveText('Kuning: 0')
      await expect(page.getByTestId('am-legend-red')).toHaveText('Merah: 0')
      await expect(page.locator('[data-testid^="am-seg-"]')).toHaveCount(0)
      await expect(page.getByTestId('am-subjects')).toHaveCount(0)
      await expect(page.getByTestId('am-pupil-row')).toHaveCount(0)
      await expect(page.getByTestId('am-error')).toHaveCount(0)
      await expect(page.locator('[data-testid="am-table"] th')).toHaveText(COLUMNS)

      await page.getByTestId('am-pill-T4').click()
      await expect(page).toHaveURL(/\/amaran\/sekolah\?tingkatan=T4$/)
      await expect(page.getByTestId('am-pill-T4')).toHaveAttribute('data-active', 'true')
      await expect(page.getByTestId('am-pill-all')).toHaveAttribute('data-active', 'false')
      expect(await tileValues(page)).toEqual([0, 0, 0, 0])
    },
  )
})

test.describe('S4 responsive (§22; E2E-M27-70/71/73 at 375, 768, 1280)', MODULE, () => {
  test('P4: no page overflow; pills wrap; tiles 2 per row below md; buttons stack below sm; the table scrolls inside its card', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    await expect(page.getByTestId('am-pupil-row').first()).toBeVisible()
    await expectNoHorizontalScroll(page)

    const width = viewportWidth(page)
    const box = async (id: string) => (await page.getByTestId(id).boundingBox())!

    // pills stay inside the viewport and are 44 px high
    for (const k of ['all', 'T4', 'T5']) {
      const b = page.getByTestId(`am-pill-${k}`)
      await expectTouchTarget(b)
      const bb = (await b.boundingBox())!
      expect(bb.x + bb.width).toBeLessThanOrEqual(width + 0.5)
    }

    // tiles: 2 per row below md (768), 4 from md
    const tiles = [
      await box('am-tile-total'),
      await box('am-tile-green'),
      await box('am-tile-yellow'),
      await box('am-tile-red'),
    ]
    if (width < 768) {
      expect(tiles[1]!.y).toBeCloseTo(tiles[0]!.y, 0)
      expect(tiles[2]!.y).toBeGreaterThan(tiles[0]!.y + 10)
      expect(tiles[3]!.y).toBeCloseTo(tiles[2]!.y, 0)
    } else {
      expect(new Set(tiles.map((t) => Math.round(t.y))).size).toBe(1)
    }

    // buttons: stacked below sm (640), one row from sm; right-aligned from sm
    const bs = [
      await box('am-btn-keberkesanan'),
      await box('am-btn-ringkasan'),
      await box('am-btn-csv'),
    ]
    for (const id of ['am-btn-keberkesanan', 'am-btn-ringkasan', 'am-btn-csv']) {
      await expectTouchTarget(page.getByTestId(id))
    }
    if (width < 640) {
      expect(bs[1]!.y).toBeGreaterThan(bs[0]!.y + 20)
      expect(bs[2]!.y).toBeGreaterThan(bs[1]!.y + 20)
    } else {
      const right = Math.max(...bs.map((b) => b.x + b.width))
      const actions = await box('am-actions')
      expect(right).toBeGreaterThan(actions.x + actions.width - 4)
    }

    // the risk table scrolls inside its card at 375 and 768 (min width 860), never the page
    const scroll = await page
      .getByTestId('am-table')
      .evaluate((t) => {
        const scroller = t.closest('.overflow-x-auto') as HTMLElement
        return { sw: scroller.scrollWidth, cw: scroller.clientWidth }
      })
    if (width < 900) expect(scroll.sw).toBeGreaterThan(scroll.cw)
    await expectNoHorizontalScroll(page)
  })

  test('P1: the empty school fits at every width', async ({ page, gotoApp }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp, '?tingkatan=T5')
    await expectNoHorizontalScroll(page)
  })
})
