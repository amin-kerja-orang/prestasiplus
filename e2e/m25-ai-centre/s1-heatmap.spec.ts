/**
 * M25 S1 `/buku-nota/heatmap` Peta Haba Topik Lemah at 375 / 768 / 1280 (M25-T2; SRS M25 v1.2 §12:
 * E2E-M25-01 to 30). Accounts: admin (id 1, 6 cells, 116 / 45), pelajarmaju (id 4, 3 cells), pelajar2
 * (id 3, empty; fixtures `m25-bands` / `m25-ties`). Tests marked provisional assert INFERRED or PROPOSED
 * behaviour or non-admin accounts (SRS §12 list: 01, 03, 04, 06, 14, 15, 17, 20, 21, 24, 25, 26, 29).
 *
 * The mock is in-process and persists its diff across reloads, so a hook that writes (`loadFixture`,
 * `addAnswer`) runs after the first page load and S1 is then opened with a client-side navigation.
 * E2E-M25-18 never names one Duta record: it reads the slug of the shown card (BR-M25-09).
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
const DUTA_API = '/api/duta/recommendations'
const ADMIN = 'admin@demo.test'
const PELAJARMAJU = 'pelajarmaju@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const MODULE = { tag: [moduleTag(25)] }
const SLUGS = ['cikgu-demo-matematik', 'cikgu-demo-bahasa', 'cikgu-demo-sains']
const DUTA: Record<string, { name: string; initials: string; tagline: string; pills: string[] }> = {
  'cikgu-demo-matematik': {
    name: 'Cikgu Demo Matematik',
    initials: 'CM',
    tagline: 'Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita.',
    pills: ['🥇 Duta Bintang', '📚 Matematik', '📍 Johor', '⭐ 4.92'],
  },
  'cikgu-demo-bahasa': {
    name: 'Cikgu Demo Bahasa',
    initials: 'CB',
    tagline: 'Pakar Bahasa Melayu SPM · 15 tahun mengajar Kertas 2.',
    pills: ['🥇 Duta Bintang', '📚 Bahasa Melayu', '📍 Johor', '⭐ 4.88'],
  },
  'cikgu-demo-sains': {
    name: 'Cikgu Demo Sains',
    initials: 'CS',
    tagline: 'Pakar Sains SPM · Jurulatih eksperimen sekolah.',
    pills: ['🥇 Duta Bintang', '📚 Sains', '📍 Selangor', '⭐ 4.80'],
  },
}

const RED = { bg: 'rgb(254, 226, 226)', border: 'rgb(252, 165, 165)' }
const AMBER = { bg: 'rgb(254, 243, 199)', border: 'rgb(252, 211, 77)' }
const GREEN = { bg: 'rgb(209, 250, 229)', border: 'rgb(110, 231, 183)' }

/** The admin's six cells in order: name, attempts, percent, band colours. */
const ADMIN_CELLS: readonly [string, string, string, typeof RED][] = [
  ['Kemahiran Bahasa Tingkatan 4', '5 cuba · 0% betul', 'red', RED],
  ['Kemahiran Bahasa Tingkatan 5', '38 cuba · 32% betul', 'red', RED],
  ['Kemahiran Mendengar dan Bertutur', '18 cuba · 44% betul', 'red', RED],
  ['Kemahiran Membaca', '5 cuba · 60% betul', 'amber', AMBER],
  ['Kemahiran Menulis', '10 cuba · 80% betul', 'green', GREEN],
  ['Sejarah Tingkatan 5 KSSM', '40 cuba · 35% betul', 'red', RED],
]

test.use({ mockInit: { latency: 0 } })

const cells = (page: Page) => page.getByTestId('heatmap-cell')
const card = (page: Page) => page.getByTestId('cikgu-card')

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

/**
 * The shown cells read from the DOM (the e2e build exposes no API client, and a raw `fetch` of `/api`
 * is not served by the mock). `correct` is `round(attempts x percent / 100)`, exact for these seeds.
 * The API statuses (401 guest, 403 other roles) are covered by `__tests__/heatmap.test.ts`.
 */
async function shown(page: Page): Promise<{ chapterId: number; attempts: number; correct: number }[]> {
  return cells(page).evaluateAll((els) =>
    els.map((e) => {
      const m = /^([\d,]+) cuba · (\d+)% betul$/.exec(e.querySelectorAll('span')[1]?.textContent ?? '')
      const attempts = Number((m?.[1] ?? '0').replace(/,/g, ''))
      return {
        chapterId: Number(e.getAttribute('data-chapter-id')),
        attempts,
        correct: Math.round((attempts * Number(m?.[2] ?? '0')) / 100),
      }
    }),
  )
}

const sum = (rows: { attempts: number; correct: number }[], key: 'attempts' | 'correct') =>
  rows.reduce((n, r) => n + r[key], 0)

const style = (loc: Locator, prop: string): Promise<string> =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

const columnsOf = (loc: Locator): Promise<number> =>
  loc.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length)

async function slugOf(page: Page): Promise<string> {
  const slug = await card(page).getAttribute('data-slug')
  expect(SLUGS).toContain(slug)
  return slug as string
}

test.describe('M25 S1 Peta Haba Topik Lemah', MODULE, () => {
  test('E2E-M25-01 student menu: href /buku-nota/heatmap and active item; the admin sidebar has no entry @m25', provisional('student shell item is INFERRED (OQ-M25-01)'), async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp(PATH)
    const menu = isDesktopShell(page)
      ? page.getByTestId('shell-user-sidebar')
      : page.getByTestId('shell-user-drawer')
    if (!isDesktopShell(page)) await page.getByTestId('shell-user-hamburger').click()
    const item = menu.getByRole('link', { name: 'Peta Haba Topik Lemah' })
    await expect(item).toHaveAttribute('href', '/buku-nota/heatmap')
    await expect(item).not.toHaveAttribute('href', '/heatmap-topik-lemah')
    // AC-M25-01.5: the entry is the highlighted item while S1 is open.
    await expect(item).toHaveClass(/\bactive\b/)
  })

  test('E2E-M25-01 the admin menu has no Peta Haba Topik Lemah entry @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    if (isDesktopShell(page)) {
      await expect(
        page.getByTestId('shell-user-sidebar').getByRole('link', { name: 'Peta Haba Topik Lemah' }),
      ).toHaveCount(0)
    } else {
      await page.getByTestId('shell-user-hamburger').click()
      await expect(page.getByTestId('shell-user-drawer')).toBeVisible()
      await expect(
        page.getByTestId('shell-user-drawer').getByRole('link', { name: 'Peta Haba Topik Lemah' }),
      ).toHaveCount(0)
    }
  })

  test('E2E-M25-02 header, tab title, user shell, no hidden partial text, no tab bar, filter, form or back link @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(page.getByTestId('heatmap-hero')).toBeVisible()
    await expectTabTitle(page, 'Peta Haba Topik Lemah')
    await expect(page.getByTestId('shell-user-title').first()).toHaveText('Peta Haba Topik Lemah')
    await expect(page.getByTestId('shell-user-title').first()).not.toHaveText('Dashboard')
    if (isDesktopShell(page)) {
      await expect(page.getByTestId('shell-user-subtitle')).toHaveText('Selamat datang kembali')
    }
    await expect(page.getByTestId('shell-user-header')).toBeVisible()
    for (const t of ['LIVE:', 'MAIN', 'DAFTAR']) {
      await expect(page.getByText(t, { exact: true })).toHaveCount(0)
    }
    const main = page.getByTestId('heatmap-page')
    await expect(main.locator('form, input, select, textarea, button, [role=tablist]')).toHaveCount(0)
    await expect(main.getByRole('link', { name: /kembali/i })).toHaveCount(0)
  })

  test('E2E-M25-03 guest goes to /login (the API 401 is covered by heatmap.test.ts) @m25', provisional('guest behaviour is INFERRED'), async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(PATH)
    await expect(page).toHaveURL(/\/login/)
  })

  test('E2E-M25-04 admin and pelajarmaju open S1 with their cells @m25', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, ADMIN, PATH)
    await expect(cells(page)).toHaveCount(6)
    await actAs(page, mock, gotoApp, PELAJARMAJU, PATH)
    await expect(page.getByTestId('heatmap-hero')).toBeVisible()
    await expect(cells(page)).toHaveCount(3)
  })

  for (const who of [
    'guru@demo.test',
    'ibubapa@demo.test',
    'penaja@demo.test',
    'adminsekolah@demo.test',
    'ppd@demo.test',
    'jpn@demo.test',
  ]) {
    test(`E2E-M25-04 ${who.split('@')[0]!} is redirected to its home (the API 403 is covered by heatmap.test.ts) @m25`, provisional('the redirect target and the API 403 are the rebuild contract (SERVER gate, INFERRED)'), async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(who)
      await gotoApp(PATH)
      await expect.poll(() => new URL(page.url()).pathname).not.toBe(PATH)
      await expect(page.getByTestId('heatmap-page')).toHaveCount(0)
      await expect(page.getByTestId('heatmap-hero')).toHaveCount(0)
    })
  }

  test('E2E-M25-05 /heatmap-topik-lemah renders the global 404 page @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/heatmap-topik-lemah')
    await expect(page.getByText('404', { exact: true })).toBeVisible()
    await expect(page.getByText('🔍')).toBeVisible()
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

  test('E2E-M25-06 latency shows the loading state first; a fault shows the error and no partial cell @m25', provisional('loading and error copy are INFERRED (M01 convention)'), async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/')
    await mock.setLatency(4000)
    await navigateInApp(page, PATH)
    await expect(page.getByTestId('heatmap-loading')).toBeVisible()
    await expect(cells(page)).toHaveCount(0)
    await expect(page.getByTestId('heatmap-hero')).toBeVisible()
    await expect(cells(page)).toHaveCount(6)

    await mock.setLatency(0)
    await navigateInApp(page, '/')
    await mock.failNext(API, 500)
    await navigateInApp(page, PATH)
    await expect(page.getByTestId('heatmap-error')).toBeVisible()
    await expect(cells(page)).toHaveCount(0)
    await expect(page.getByTestId('heatmap-hero')).toHaveCount(0)
  })

  test('E2E-M25-07 each subject grid has 1 / 3 / 4 columns; the card is at most 920 px, the column at most 1200 px @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(6)
    const width = viewportWidth(page)
    const expected = width >= 1280 ? 4 : width >= 768 ? 3 : 1
    const grids = page.getByTestId('heatmap-grid')
    await expect(grids).toHaveCount(2)
    expect(await columnsOf(grids.nth(0))).toBe(expected)
    expect(await columnsOf(grids.nth(1))).toBe(expected)
    const block = page.getByTestId('cikgu-pakar')
    await expect(block).toBeVisible()
    const box = (await block.boundingBox())!
    const col = (await page.getByTestId('heatmap-page').boundingBox())!
    expect(box.width).toBeLessThanOrEqual(920)
    expect(col.width).toBeLessThanOrEqual(1200)
    if (width >= 1280) {
      // centred in the content column
      const left = box.x - col.x
      const right = col.x + col.width - (box.x + box.width)
      expect(Math.abs(left - right)).toBeLessThanOrEqual(2)
    }
  })

  test('E2E-M25-08 no horizontal scroll, the legend wraps at 375, no text under 12 px, cells at least 44 px @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(6)
    await expectNoHorizontalScroll(page)
    const tops = await page
      .getByTestId('heatmap-legend')
      .locator('li')
      .evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size)
    if (viewportWidth(page) <= 375) expect(tops).toBeGreaterThan(1)
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
    const heights = await cells(page).evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    )
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44)
  })

  test('E2E-M25-09 cell and card hover, no title or ARIA, h2 subject names and h4 card name @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    const cell = cells(page).first()
    await expect(cell).toBeVisible()
    expect(await style(cell, 'cursor')).toBe('pointer')
    await cell.hover()
    await expect.poll(() => style(cell, 'transform')).toBe('matrix(1, 0, 0, 1, 0, -2)')
    expect(await style(cell, 'box-shadow')).toContain('rgba(0, 0, 0, 0.1) 0px 4px 8px')

    const c = card(page)
    await c.hover()
    await expect.poll(() => style(c, 'border-top-color')).toBe('rgb(192, 38, 211)')
    await expect.poll(() => style(c, 'transform')).toBe('matrix(1, 0, 0, 1, 0, -2)')
    expect(await style(c, 'box-shadow')).toContain('rgba(192, 38, 211, 0.12) 0px 12px 24px')

    const attrs = await page
      .locator('[data-testid=heatmap-cell], [data-testid=cikgu-card]')
      .evaluateAll((els) =>
        els.flatMap((e) => e.getAttributeNames().filter((n) => n === 'title' || n.startsWith('aria-'))),
      )
    expect(attrs).toEqual([])
    await expect(page.locator('h2')).toHaveText(['Bahasa Melayu', 'Sejarah'])
    await expect(page.locator('h4')).toHaveCount(1)
  })

  test('E2E-M25-10 hero: h1, paragraph, red gradient and white text @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    const hero = page.getByTestId('heatmap-hero')
    await expect(hero.locator('h1')).toHaveText('Peta Haba Topik Lemah')
    await expect(hero.locator('p')).toHaveText(
      'Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar.',
    )
    const bg = await style(hero, 'background-image')
    expect(bg).toContain('linear-gradient')
    expect(bg).toContain('rgb(185, 28, 28)')
    expect(bg).toContain('rgb(220, 38, 38)')
    expect(await style(hero, 'color')).toBe('rgb(255, 255, 255)')
    expect(await style(hero.locator('h1'), 'color')).toBe('rgb(255, 255, 255)')
    expect(await style(hero.locator('p'), 'color')).toBe('rgb(255, 255, 255)')
    expect(await style(hero, 'border-top-left-radius')).toBe('12px')
  })

  test('E2E-M25-11 legend: four pills in order with their colours on white @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    const pills = page.getByTestId('heatmap-legend').locator('li')
    await expect(pills).toHaveText(['Lemah (< 50%)', 'Sederhana (50-79%)', 'Mantap (≥ 80%)', 'Belum cuba'])
    const colours = [
      ['rgb(185, 28, 28)', 'rgb(252, 165, 165)'],
      ['rgb(146, 64, 14)', 'rgb(252, 211, 77)'],
      ['rgb(4, 120, 87)', 'rgb(110, 231, 183)'],
      ['rgb(71, 85, 105)', 'rgb(203, 213, 225)'],
    ]
    for (const [i, [text, border]] of colours.entries()) {
      const pill = pills.nth(i)
      expect(await style(pill, 'color')).toBe(text)
      expect(await style(pill, 'border-top-color')).toBe(border)
      expect(await style(pill, 'border-top-width')).toBe('2px')
      expect(await style(pill, 'background-color')).toBe('rgb(255, 255, 255)')
    }
  })

  test('E2E-M25-12 blocks Bahasa Melayu then Sejarah; the six cells with exact texts and 12 px figures @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(page.locator('h2')).toHaveText(['Bahasa Melayu', 'Sejarah'])
    await expect(cells(page)).toHaveCount(6)
    for (const [i, [name, figures]] of ADMIN_CELLS.entries()) {
      const cell = cells(page).nth(i)
      await expect(cell.locator('span').nth(0)).toHaveText(name)
      const line = cell.locator('span').nth(1)
      await expect(line).toHaveText(figures)
      expect(await style(line, 'font-size')).toBe('12px')
      expect(await style(line, 'color')).toBe('rgb(71, 85, 105)')
      expect(await cell.evaluate((e) => e.tagName)).toBe('A')
    }
    const grids = page.getByTestId('heatmap-grid')
    await expect(grids.nth(0).getByTestId('heatmap-cell')).toHaveCount(5)
    await expect(grids.nth(1).getByTestId('heatmap-cell')).toHaveCount(1)
  })

  test('E2E-M25-13 cell colours by band @m25', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(6)
    for (const [i, [, , band, colours]] of ADMIN_CELLS.entries()) {
      const cell = cells(page).nth(i)
      await expect(cell).toHaveAttribute('data-band', band)
      expect(await style(cell, 'background-color')).toBe(colours.bg)
      expect(await style(cell, 'border-top-color')).toBe(colours.border)
    }
  })

  test('E2E-M25-14 pelajarmaju: one block Matematik with three cells @m25', provisional('non-admin account; the seed is the fictitious M05 record'), async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp(PATH)
    await expect(page.locator('h2')).toHaveText(['Matematik'])
    await expect(cells(page)).toHaveCount(3)
    const expected: [string, string, string, string][] = [
      ['143', 'Sukatan dan Geometri', '7 cuba · 43% betul', 'red'],
      ['136', 'Pecahan', '7 cuba · 57% betul', 'amber'],
      ['1', 'Nombor Bulat hingga 100', '23 cuba · 83% betul', 'green'],
    ]
    for (const [i, [id, name, figures, band]] of expected.entries()) {
      const cell = cells(page).nth(i)
      await expect(cell).toHaveAttribute('data-chapter-id', id)
      await expect(cell.locator('span').nth(0)).toHaveText(name)
      await expect(cell.locator('span').nth(1)).toHaveText(figures)
      await expect(cell).toHaveAttribute('data-band', band)
    }
  })

  test('E2E-M25-15 fixture m25-ties: equal accuracy sorts by name @m25', provisional('tie order is INFERRED (BR-M25-04)'), async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp, () => mock.hook('loadFixture', 'm25-ties').then(() => undefined))
    await expect(cells(page)).toHaveCount(3)
    await expect(cells(page).locator('span:first-child')).toHaveText([
      'Aspek Tatabahasa D3',
      'Kemahiran Membaca D3',
      'Kemahiran Menulis D3',
    ])
    const bands = await cells(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-band')))
    expect(bands).toEqual(['amber', 'amber', 'amber'])
    const ids = await cells(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-chapter-id')))
    expect(ids).toEqual(['14', '12', '13'])
  })

  test('E2E-M25-16 all six cells link to /practice/chapter; a click opens Soalan Mengikut Bab and starts no session @m25', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(6)
    const hrefs = await cells(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(hrefs).toEqual(Array<string>(6).fill('/practice/chapter'))
    await cells(page).filter({ hasText: 'Kemahiran Menulis' }).click()
    await expect(page).toHaveURL(/\/practice\/chapter$/)
    await expect(page.getByTestId('shell-user-title').first()).toHaveText('Soalan Mengikut Bab')
    const posts = (await mock.requests('/api/practice/sessions')).filter((r) => r.method === 'POST')
    expect(posts).toHaveLength(0)
  })

  test('E2E-M25-17 pelajar2: hero, four pills and the empty-state block; the admin has no gray cell @m25', provisional('the empty-state copy is the SERVER template (D24)'), async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, PELAJAR2, PATH)
    await expect(page.getByTestId('heatmap-hero')).toBeVisible()
    await expect(page.getByTestId('heatmap-legend').locator('li')).toHaveCount(4)
    await expect(page.locator('h2')).toHaveCount(0)
    await expect(cells(page)).toHaveCount(0)
    await expect(page.locator('[data-band=gray]')).toHaveCount(0)
    await expect(page.getByTestId('heatmap-error')).toHaveCount(0)
    const empty = page.getByTestId('heatmap-empty')
    await expect(empty).toContainText('Belum ada data peta haba.')
    await expect(empty).toContainText(
      'Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini.',
    )
    const button = page.getByTestId('heatmap-empty-button')
    await expect(button).toHaveText('Mula Latih Tubi')
    await expect(button).toHaveAttribute('href', '/practice')
    await expectNoHorizontalScroll(page)
    // B-2 re-test: a click lands on /practice, not on the global 404.
    await button.click()
    await expect(page).toHaveURL(/\/practice$/)
    await expect(page.getByText('Halaman Tidak Dijumpai')).toHaveCount(0)

    await actAs(page, mock, gotoApp, ADMIN, PATH)
    await expect(page.getByTestId('heatmap-legend').locator('li').nth(3)).toHaveText('Belum cuba')
    await expect(page.locator('[data-band=gray]')).toHaveCount(0)
    await expect(page.getByTestId('heatmap-empty')).toHaveCount(0)
  })

  for (const seed of [1, 5, 11]) {
    test(`E2E-M25-18 Cikgu Pakar block above the hero with one card of the set (seed ${String(seed)}) @m25`, async ({
      page,
      gotoApp,
      loginAs,
      mock,
    }) => {
      await loginAs(ADMIN)
      await openS1(page, gotoApp, () => mock.setRandomSeed(seed))
      const block = page.getByTestId('cikgu-pakar')
      await expect(block).toBeVisible()
      await expect(block).toContainText('🌟 Cikgu Pakar Untuk Topik Lemah')
      expect(await style(block.locator('p').first(), 'text-transform')).toBe('uppercase')
      await expect(card(page)).toHaveCount(1)
      const slug = await slugOf(page)
      const row = DUTA[slug]!
      await expect(card(page)).toHaveAttribute('href', `/bilik-duta/${slug}`)
      await expect(page.getByTestId('cikgu-avatar')).toHaveText(row.initials)
      await expect(page.locator('h4')).toHaveText(row.name)
      await expect(page.getByTestId('cikgu-tagline')).toHaveText(row.tagline)
      await expect(page.getByTestId('cikgu-pills').locator('span')).toHaveText(row.pills)
      // DOM order: block, hero, subject blocks.
      const order = await page
        .locator('[data-testid=cikgu-pakar], [data-testid=heatmap-hero], [data-testid=heatmap-subject]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
      expect(order).toEqual(['cikgu-pakar', 'heatmap-hero', 'heatmap-subject', 'heatmap-subject'])
    })
  }

  test('E2E-M25-18 the same seed after mock.reset() gives the same card (AC-M25-08.6) @m25', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    const slugs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      await gotoApp('/')
      await mock.reset()
      await gotoApp('/')
      await mock.setRandomSeed(7)
      await navigateInApp(page, PATH)
      await expect(card(page)).toBeVisible()
      slugs.push(await slugOf(page))
    }
    expect(slugs[1]).toBe(slugs[0])
  })

  test('E2E-M25-19 avatar 56 px round gradient with gold ring; every pill at least 12 px @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    const av = page.getByTestId('cikgu-avatar')
    await expect(av).toBeVisible()
    const box = (await av.boundingBox())!
    expect(Math.round(box.width)).toBe(56)
    expect(Math.round(box.height)).toBe(56)
    expect(await style(av, 'border-top-left-radius')).toBe('50%')
    const bg = await style(av, 'background-image')
    expect(bg).toContain('linear-gradient')
    expect(bg).toContain('rgb(67, 56, 202)')
    expect(bg).toContain('rgb(192, 38, 211)')
    expect(await style(av, 'color')).toBe('rgb(255, 255, 255)')
    expect(await style(av, 'font-weight')).toBe('700')
    expect(await style(av, 'box-shadow')).toContain('rgb(251, 191, 36) 0px 0px 0px 2px')
    const sizes = await page
      .getByTestId('cikgu-pills')
      .locator('span')
      .evaluateAll((els) => els.map((e) => Number.parseFloat(getComputedStyle(e).fontSize)))
    expect(sizes).toHaveLength(4)
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(12)
  })

  test('E2E-M25-20 a failed #2 hides only the Cikgu Pakar block @m25', provisional('absence on failure is INFERRED (FR-M25-25)'), async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/')
    await mock.failNext(DUTA_API, 500)
    await navigateInApp(page, PATH)
    await expect(page.getByTestId('heatmap-hero')).toBeVisible()
    await expect(cells(page)).toHaveCount(6)
    await expect(page.getByTestId('cikgu-pakar')).toHaveCount(0)
  })

  test('E2E-M25-21 clicking the card opens /bilik-duta/{slug} (global 404 while M24 is not built) @m25', provisional('the M24 page is not built'), async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(card(page)).toBeVisible()
    const slug = await slugOf(page)
    await card(page).click()
    await expect(page).toHaveURL(new RegExp(`/bilik-duta/${slug}$`))
  })

  test('E2E-M25-22 admin: six cells, attempts 116, correct 45; the D2 chapter is in no cell @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(6)
    const topics = await shown(page)
    expect(topics).toHaveLength(6)
    expect(sum(topics, 'attempts')).toBe(116)
    expect(sum(topics, 'correct')).toBe(45)
    expect(topics.map((t) => t.chapterId)).not.toContain(4)
    await expect(page.getByText('Kemahiran Mendengar dan Bertutur D2')).toHaveCount(0)
    // The hidden answers (3 / 1) are asserted by `heatmap.hiddenForUser(1)` in __tests__/heatmap.test.ts.
  })

  test('E2E-M25-23 the three Darjah 1 cells equal the M05 chapter list (Sejarah is M05 S8/S12, not built) @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(6)
    // M25's figures, then the same chapters on M05's "Soalan Mengikut Bab" lists (client-side navigation).
    const wanted: [number, string, string][] = [
      [382, '40 cuba · 35% betul', '35'],
      [35, '18 cuba · 44% betul', '44.4'],
      [36, '5 cuba · 60% betul', '60'],
      [2, '10 cuba · 80% betul', '80'],
    ]
    for (const [id, text] of wanted) {
      await expect(page.locator(`[data-chapter-id="${String(id)}"]`)).toContainText(text)
    }
    await navigateInApp(page, '/practice/chapter/BM?level=1')
    for (const [id, , score] of wanted.slice(1)) {
      await expect(page.getByTestId(`chapter-stats-${String(id)}`)).toContainText(`${score}%`)
    }
    // Sejarah Tingkatan 5 KSSM (40 · 14 · 35 %) is M05 S8 / S12 data (not built yet, M05-T6): M05's
    // "Soalan Mengikut Bab" lists only Darjah levels, so that half stays on the M25 side (above).
  })

  test('E2E-M25-24 D2 chapter appears only at 5 attempts, between Membaca and Menulis, attempts 121 @m25', provisional('the minimum-5 rule is INFERRED (DV-M25-06)'), async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    // 600034 is a D2 Bab 1 (chapter 4) anchor question.
    const add = (isCorrect: boolean) =>
      mock.hook('addAnswer', { userId: 1, questionId: 600034, isCorrect })
    await openS1(page, gotoApp, async () => {
      await add(true)
      await add(true)
    })
    await expect(cells(page)).toHaveCount(6)
    await expect(page.locator('[data-chapter-id="4"]')).toHaveCount(0)
    await navigateInApp(page, '/')
    await add(true)
    await navigateInApp(page, PATH)
    await expect(cells(page)).toHaveCount(7)
    const d2 = page.locator('[data-chapter-id="4"]')
    await expect(d2).toContainText('Kemahiran Mendengar dan Bertutur D2')
    await expect(d2).toContainText('5 cuba · 80% betul')
    await expect(d2).toHaveAttribute('data-band', 'green')
    const names = await cells(page).evaluateAll((els) =>
      els.slice(0, 6).map((e) => e.getAttribute('data-chapter-id')),
    )
    // between Membaca (36) and Menulis (2)
    expect(names.indexOf('4')).toBe(names.indexOf('36') + 1)
    expect(names.indexOf('2')).toBe(names.indexOf('4') + 1)
    expect(sum(await shown(page), 'attempts')).toBe(121)
  })

  /**
   * SRS E2E-M25-25 adds the wrong answer to BM T4 Bab 1 (chapter 87), but the M04 seed has no question in
   * chapter 87 yet (XR-M25-03 anchors not applied; the admin's A5 answers carry the chapter on the answer),
   * so `mock.addAnswer` cannot target it. The same recompute rule (BR-M25-11) is asserted on BM D1 Bab 2
   * "Kemahiran Membaca" (chapter 36, 5 · 3 = 60 %, anchor question 600019): one wrong answer gives
   * "6 cuba · 50% betul" and the displayed attempts 117.
   */
  test('E2E-M25-25 one more wrong answer is shown after the next load: attempts 117 (chapter 36 stands in for 87) @m25', provisional('recompute behaviour is INFERRED (BR-M25-11); chapter 87 has no M04 question'), async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openS1(page, gotoApp, async () => {
      await mock.hook('addAnswer', { userId: 1, questionId: 600019, isCorrect: false })
    })
    const cell = page.locator('[data-chapter-id="36"]')
    await expect(cell).toContainText('6 cuba · 50% betul')
    await expect(cell).toHaveAttribute('data-band', 'amber')
    expect(sum(await shown(page), 'attempts')).toBe(117)
  })

  test('E2E-M25-26 fixture m25-bands: five cells in band order @m25', provisional('band edges are INFERRED (BR-M25-03)'), async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp, () => mock.hook('loadFixture', 'm25-bands').then(() => undefined))
    await expect(cells(page)).toHaveCount(5)
    await expect(cells(page).locator('span:nth-child(2)')).toHaveText([
      '10 cuba · 40% betul',
      '10 cuba · 50% betul',
      '100 cuba · 79% betul',
      '200 cuba · 80% betul',
      '10 cuba · 80% betul',
    ])
    const bands = await cells(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-band')))
    expect(bands).toEqual(['red', 'amber', 'amber', 'green', 'green'])
  })

  test('E2E-M25-27 M08 S6 of the admin still reads "Tiada topik lemah!" while S1 shows four red cells @m25', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/prestasi/1')
    await expect(page.getByTestId('weak-empty')).toContainText('Tiada topik lemah! Teruskan usaha.')
    await navigateInApp(page, PATH)
    await expect(cells(page)).toHaveCount(6)
    await expect(page.locator('[data-band=red]')).toHaveCount(4)
  })

  test('E2E-M25-28 the view issues only #1 and #2, once each, and no AI, chat or external request @m25', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    const external: string[] = []
    page.on('request', (r) => {
      const u = new URL(r.url())
      if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) {
        external.push(r.url())
      }
    })
    await loginAs(ADMIN)
    await gotoApp(PATH)
    await expect(cells(page)).toHaveCount(6)
    for (let i = 0; i < 3; i += 1) await cells(page).nth(i).hover()
    await card(page).hover()
    const all = await mock.requests()
    const paths = all.map((r) => r.path)
    expect(paths.filter((p) => p === API)).toHaveLength(1)
    expect(paths.filter((p) => p === DUTA_API)).toHaveLength(1)
    const other = paths.filter((p) => p !== API && p !== DUTA_API)
    for (const p of other) {
      expect(p, `shell request ${p}`).not.toMatch(/\/(ai|generate|chatbot\/message|chat\/send|nota)/i)
    }
    expect(external).toEqual([])
    const main = page.getByTestId('heatmap-page')
    await expect(main.locator('button')).toHaveCount(0)
    await expect(main.getByText(/jana|generate|chat|cipta nota/i)).toHaveCount(0)
  })

  test('E2E-M25-29 a user_id / userId query is ignored @m25', provisional('SEC-M25-01 is INFERRED'), async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${PATH}?user_id=3`)
    await expect(cells(page)).toHaveCount(6)
    await gotoApp(`${PATH}?userId=3`)
    await expect(cells(page)).toHaveCount(6)
  })

  test('E2E-M25-30 no M25 store: users 1, 4 and 3 give 6, 3 and 0 cells; opening S1 twice changes nothing @m25', async ({
    page,
    gotoApp,
    mock,
  }) => {
    test.slow()
    await gotoApp('/login')
    await mock.reset()
    const counts: Record<string, number> = {}
    for (const [who, expected] of [
      [ADMIN, 6],
      [PELAJARMAJU, 3],
      [PELAJAR2, 0],
    ] as const) {
      await actAs(page, mock, gotoApp, who, PATH)
      await expect(page.getByTestId('heatmap-hero')).toBeVisible()
      await expect(cells(page)).toHaveCount(expected)
      const first = await shown(page)
      // opening S1 a second time (client side) gives the same cells
      await navigateInApp(page, '/')
      await navigateInApp(page, PATH)
      await expect(page.getByTestId('heatmap-hero')).toBeVisible()
      expect(await shown(page)).toEqual(first)
      counts[who] = first.length
    }
    expect(counts).toEqual({ [ADMIN]: 6, [PELAJARMAJU]: 3, [PELAJAR2]: 0 })
    const stores = (await mock.names()).filter((n) => /heatmap/i.test(n))
    expect(stores).toEqual([])
  })
})
