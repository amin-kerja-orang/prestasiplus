/**
 * M25 S1 `/buku-nota/heatmap` Heatmap Topik Lemah at 375 / 768 / 1280 (S10-T05; PRD R1-MUR-14, API-DSKP-08).
 * Mock mode. Accounts: admin (id 1: Bahasa Melayu and Sejarah blocks), pelajarmaju (id 4: Matematik, every
 * chapter grey), pelajar2 (id 3: empty; fixture `m25-bands` adds Matematik and Sains tiles).
 *
 * The mock is in-process and persists its diff across reloads, so a hook that writes (`loadFixture`) runs
 * after the first page load and S1 is then opened with a client-side navigation.
 */

import type { Locator, Page } from '@playwright/test'

import { expect as baseExpect, test } from '../fixtures/test'
import {
  actAs,
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  navigateInApp,
  provisional,
  viewportWidth,
} from '../support'

const expect = baseExpect.configure({ timeout: 40_000 })

const PATH = '/buku-nota/heatmap'
const API = '/api/buku-nota/heatmap'
const ADMIN = 'admin@demo.test'
const PELAJARMAJU = 'pelajarmaju@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const MODULE = { tag: [moduleTag(25)] }

test.use({ mockInit: { latency: 0 } })

const cells = (page: Page) => page.getByTestId('heatmap-cell')
const grids = (page: Page) => page.getByTestId('heatmap-grid')
const cell = (page: Page, chapterId: string) => page.locator(`[data-chapter-id="${chapterId}"]`)

/** Loads the app once (`/`), lets `prepare` write to the mock, then opens S1 client side. */
async function openS1(
  page: Page,
  gotoApp: (p: string) => Promise<void>,
  prepare?: () => Promise<void>,
): Promise<void> {
  await gotoApp('/')
  if (prepare) await prepare()
  await navigateInApp(page, PATH)
  await expect(page.getByTestId('heatmap-hero')).toBeVisible()
}

const columnsOf = (loc: Locator): Promise<number> =>
  loc.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length)

const spans = (loc: Locator): Promise<string[]> =>
  loc.locator('span').evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''))

test.describe('M25 S1 Heatmap Topik Lemah', MODULE, () => {
  test(
    'E2E-M25-01 student menu: href /buku-nota/heatmap and active item; the admin sidebar has no entry @m25',
    provisional('student shell item is INFERRED (OQ-M25-01)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJARMAJU)
      await gotoApp(PATH)
      // Pembelajaran shell: sidebar from lg, the "Lagi" sheet below it.
      if (!isDesktopShell(page)) {
        await page.getByTestId('pembelajaran-bottom-nav').locator('[data-nav-id="tab-lagi"]').click()
      }
      const menu = page.getByTestId(
        isDesktopShell(page) ? 'pembelajaran-nav' : 'pembelajaran-lagi-nav',
      )
      const item = menu.getByRole('link', { name: 'Heatmap Topik Lemah' })
      await expect(item).toHaveAttribute('href', '/buku-nota/heatmap')
      await expect(item).not.toHaveAttribute('href', '/heatmap-topik-lemah')
      // AC-M25-01.5: the entry is the highlighted item while S1 is open.
      await expect(item).toHaveAttribute('aria-current', 'page')
    },
  )

  test('E2E-M25-01 the admin menu has no Heatmap Topik Lemah entry @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    // Portal Pentadbiran: sidebar from lg, the same menu in the drawer below it.
    if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
    const nav = page.getByTestId('pentadbiran-nav')
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link').first()).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Heatmap Topik Lemah' })).toHaveCount(0)
  })

  test('E2E-M25-02 header, tab title, user shell, no hidden partial text, no tab bar, filter, form or back link @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(page.getByTestId('heatmap-hero')).toBeVisible()
    await expectTabTitle(page, 'Heatmap Topik Lemah | PRESTASIPLUS')
    // Admin Pusat sits in the Portal Pentadbiran (D30): the navbar prints the page title as the h1.
    const header = page.getByTestId('pentadbiran-header')
    await expect(header).toBeVisible()
    await expect(header.getByRole('heading', { level: 1 })).toHaveText('Heatmap Topik Lemah')
    await expect(header.getByRole('heading', { level: 1 })).not.toHaveText('Dashboard')
    await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText('Topik mana anda kuat, mana lemah — dalam satu paparan')
    for (const t of ['LIVE:', 'MAIN', 'DAFTAR']) {
      await expect(page.getByText(t, { exact: true })).toHaveCount(0)
    }
    const main = page.getByTestId('heatmap-page')
    await expect(main.locator('form, input, select, textarea, button, [role=tablist]')).toHaveCount(
      0,
    )
    await expect(main.getByRole('link', { name: /kembali/i })).toHaveCount(0)
  })

  test(
    'E2E-M25-03 guest goes to /login (the API 401 is covered by heatmap.test.ts) @m25',
    provisional('guest behaviour is INFERRED'),
    async ({ page, gotoApp }) => {
      await gotoApp(PATH)
      await expect(page).toHaveURL(/\/login/)
    },
  )

  test('E2E-M25-04 admin and pelajarmaju open S1 with a block per practised subject @m25', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, ADMIN, PATH)
    await expect(page.getByTestId('heatmap-subject')).toHaveCount(2)
    await expect(page.locator('h2')).toHaveText(['Bahasa Melayu', 'Sejarah'])
    await actAs(page, mock, gotoApp, PELAJARMAJU, PATH)
    await expect(page.getByTestId('heatmap-hero')).toBeVisible()
    await expect(page.locator('h2')).toHaveText(['Matematik'])
  })

  for (const who of [
    'guru@demo.test',
    'ibubapa@demo.test',
    'penaja@demo.test',
    'adminsekolah@demo.test',
    'ppd@demo.test',
    'jpn@demo.test',
  ]) {
    test(
      `E2E-M25-04 ${who.split('@')[0]!} gets the 403 page in place (the API 403 is covered by heatmap.test.ts) @m25`,
      provisional(
        'the 403 page and the API 403 are the rebuild contract (SERVER gate, INFERRED)',
      ),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(who)
        await gotoApp(PATH)
        await expect(page.locator('[data-ds="error-page"][data-code="403"]')).toBeVisible()
        await expect(page.getByRole('heading', { level: 1, name: 'Akses Ditolak' })).toBeVisible()
        await expect(page.getByTestId('heatmap-page')).toHaveCount(0)
        await expect(page.getByTestId('heatmap-hero')).toHaveCount(0)
      },
    )
  }

  test('E2E-M25-05 /heatmap-topik-lemah renders the global 404 page @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/heatmap-topik-lemah')
    await expect(page.getByText('404', { exact: true })).toBeVisible()
    await expect(page.locator('[data-ds="error-page"][data-code="404"]')).toBeVisible()
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
    await expect(
      page.getByText(
        'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
      ),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
    // M01 DV-02: the rebuild's "Mula Latihan" goes to /practice (live /latih-tubi is itself a 404).
    await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
      'href',
      '/practice',
    )
    await expect(page.getByTestId('heatmap-hero')).toHaveCount(0)
  })

  test(
    'E2E-M25-06 latency shows the loading state first; a fault shows the error and no partial tile @m25',
    provisional('loading and error copy are INFERRED (M01 convention)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/')
      await mock.setLatency(4000)
      await navigateInApp(page, PATH)
      await expect(page.getByTestId('heatmap-loading')).toBeVisible()
      await expect(cells(page)).toHaveCount(0)
      await expect(page.getByTestId('heatmap-hero')).toBeVisible()
      await expect(page.getByTestId('heatmap-subject')).toHaveCount(2)

      await mock.setLatency(0)
      await navigateInApp(page, '/')
      await mock.failNext(API, 500)
      await navigateInApp(page, PATH)
      await expect(page.getByTestId('heatmap-error')).toBeVisible()
      await expect(cells(page)).toHaveCount(0)
      await expect(page.getByTestId('heatmap-hero')).toHaveCount(0)
    },
  )

  test('E2E-M25-07 admin: tiles with figures, a grey "Belum cuba" tile for every untried chapter, Bab order @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(page.getByTestId('heatmap-subject')).toHaveCount(2)
    // Bahasa Melayu 58 chapters + Sejarah 28 (Tingkatan 1-5), two tried in BM and one in Sejarah.
    await expect(cells(page)).toHaveCount(86)
    await expect(cells(page).and(page.locator('[data-band="belum-cuba"]'))).toHaveCount(83)
    const bab4 = cell(page, '87')
    await expect(bab4).toHaveAttribute('data-band', 'red')
    expect(await spans(bab4)).toEqual(['Kemahiran Bahasa Tingkatan 4', '5 cuba · 0% betul'])
    const bab5 = cell(page, '413')
    await expect(bab5).toHaveAttribute('data-band', 'red')
    expect(await spans(bab5)).toEqual(['Kemahiran Bahasa Tingkatan 5', '38 cuba · 32% betul'])
    const sej = cell(page, '382')
    expect(await spans(sej)).toEqual(['Sejarah Tingkatan 5 KSSM', '40 cuba · 35% betul'])
    const grey = cells(page).and(page.locator('[data-band="belum-cuba"]')).first()
    expect(await spans(grey)).toEqual([expect.any(String), 'Belum cuba'])
    // Bab 99 is last of its block; the first tile is Bab 1.
    const bm = page.getByTestId('heatmap-subject').first().getByTestId('heatmap-cell')
    await expect(bm.last()).toHaveAttribute('data-chapter-id', '413')
    await expect(bm.first()).toHaveAttribute('data-chapter-id', '28')
  })

  test(
    'E2E-M25-08 pelajarmaju: Matematik is listed and every chapter is grey @m25',
    provisional('non-admin account; the seed is the fictitious M05 record'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJARMAJU)
      await gotoApp(PATH)
      await expect(page.locator('h2')).toHaveText(['Matematik'])
      await expect(cells(page)).toHaveCount(62)
      await expect(cells(page).and(page.locator('[data-band="belum-cuba"]'))).toHaveCount(62)
    },
  )

  test('E2E-M25-09 fixture m25-bands: no minimum, whole-percent bands (79.5 reads 80% and is green) @m25', async ({
    page,
    gotoApp,
    mock,
    loginAs,
  }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp, () => mock.hook('loadFixture', 'm25-bands').then(() => undefined))
    await expect(page.locator('h2')).toHaveText(['Matematik', 'Sains'])
    const expected: [string, string, string][] = [
      ['91', '10 cuba · 40% betul', 'red'],
      ['92', '10 cuba · 50% betul', 'amber'],
      ['220', '100 cuba · 79% betul', 'amber'],
      ['228', '200 cuba · 80% betul', 'green'],
      ['322', '10 cuba · 80% betul', 'green'],
    ]
    for (const [id, text, band] of expected) {
      await expect(cell(page, id)).toHaveAttribute('data-band', band)
      expect((await spans(cell(page, id)))[1]).toBe(text)
    }
  })

  test('E2E-M25-10 an empty heatmap shows the empty state "Belum ada data heatmap lagi." and no tile @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp(PATH)
    await expect(page.getByTestId('heatmap-hero')).toBeVisible()
    await expect(cells(page)).toHaveCount(0)
    await expect(page.getByTestId('heatmap-subject')).toHaveCount(0)
    const empty = page.getByTestId('heatmap-empty')
    await expect(empty).toContainText('Belum ada data heatmap lagi.')
    await expect(empty).toContainText(
      'Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini.',
    )
    const button = page.getByTestId('heatmap-empty-button')
    await expect(button).toHaveText('Mula Latih Tubi')
    await expect(button).toHaveAttribute('href', '/practice')
  })

  test('E2E-M25-11 legend: four pills in order, the last is "Belum cuba" @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(page.getByTestId('heatmap-legend').locator('li')).toHaveText([
      'Lemah (< 50%)',
      'Sederhana (50-79%)',
      'Mantap (≥ 80%)',
      'Belum cuba',
    ])
  })

  test('E2E-M25-12 AC-MUR-14-4: 1 column at 375, auto-fill tracks of at least 12 rem (192 px), legend wraps, no horizontal scroll, tiles at least 44 px @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(86)
    await expectNoHorizontalScroll(page)
    const width = viewportWidth(page)
    const grid = grids(page).first()
    const cols = await columnsOf(grid)
    if (width <= 375) expect(cols).toBe(1)
    else expect(cols).toBeGreaterThanOrEqual(2)
    // Every track is at least 12 rem (192 px) wide, except a single column narrower than 200 px.
    const tracks = await grid.evaluate((el) =>
      getComputedStyle(el)
        .gridTemplateColumns.split(' ')
        .map((v) => Number.parseFloat(v)),
    )
    if (tracks.length > 1) for (const t of tracks) expect(t).toBeGreaterThanOrEqual(192 - 0.5)
    if (width >= 1280) expect(cols).toBeGreaterThanOrEqual(3)
    const tops = await page
      .getByTestId('heatmap-legend')
      .locator('li')
      .evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size)
    if (width <= 375) expect(tops).toBeGreaterThan(1)
    const heights = await cells(page).evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    )
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44)
    const small = await page.getByTestId('heatmap-page').evaluate((root) => {
      const bad: string[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim()
        if (!text || /^\p{Extended_Pictographic}+$/u.test(text)) continue
        const el = node.parentElement
        if (!el) continue
        const size = Number.parseFloat(getComputedStyle(el).fontSize)
        if (size < 12) bad.push(`${text.slice(0, 30)} (${String(size)}px)`)
      }
      return bad
    })
    expect(small).toEqual([])
  })

  test('E2E-M25-13 a tile is a plain link to its subject chapter page (Q-1), no title or ARIA; a click starts no session @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(86)
    const bm = cell(page, '87')
    const sej = cell(page, '382')
    await expect(bm).toHaveAttribute('href', '/practice/chapter/BM')
    await expect(sej).toHaveAttribute('href', '/practice/chapter/SEJ')
    for (const c of [bm, sej]) {
      await expect(c).not.toHaveAttribute('title', /.*/)
      await expect(c).not.toHaveAttribute('aria-label', /.*/)
    }
    await bm.click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/practice/chapter/BM')
  })

  test('E2E-M25-14 the Cikgu Pakar block is hidden in R1 (FR-MUR-14-2) @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(86)
    await expect(page.getByTestId('cikgu-pakar')).toHaveCount(0)
    await expect(page.getByText('Cikgu Pakar')).toHaveCount(0)
  })

  test('E2E-M25-15 the view issues only #1 and no AI, chat or external request @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/')
    const seen: string[] = []
    page.on('request', (r) => {
      const url = new URL(r.url())
      if (url.pathname.startsWith('/api/') || url.origin !== new URL(page.url()).origin)
        seen.push(url.origin + url.pathname)
    })
    await navigateInApp(page, PATH)
    await expect(cells(page)).toHaveCount(86)
    expect(seen.filter((u) => /duta|ai|chat/i.test(u))).toEqual([])
  })

  test(
    'E2E-M25-16 a user_id / userId query is ignored @m25',
    provisional('SEC-M25-01 is INFERRED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJARMAJU)
      await gotoApp(`${PATH}?userId=1&user_id=1`)
      await expect(page.locator('h2')).toHaveText(['Matematik'])
    },
  )
})
