/**
 * M07-T2 E2E (SRS M07 §12): the student screens S1 hub, S2 dashboard, S3 domains, S4 history (DV-M07-01),
 * S4a domain practice and S4b full exam (provisional, L-2 / L-3) at 375 / 768 / 1280.
 *
 * Covered: E2E-M07-01..10, 40, 41 (user shell), 42 (guest part), 44 (S1-S4b) and 45 (reduced, see its
 * title). Not covered here (they need the admin screens S5-S8, M07-T3 / T4, deferred): E2E-M07-11..39,
 * the admin parts of 40..44 and the S7 step of E2E-M07-09.
 */

import type { Page } from '@playwright/test'

import { waitForApp } from '../fixtures/mock-handle'
import { expect, test as base } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

/**
 * `gotoApp` with a 60 s boot budget (the shared fixture allows 15 s; the mock boot of the full
 * module set takes longer on a loaded machine). Same behaviour otherwise.
 */
const test = base.extend<{ gotoApp: (path: string) => Promise<void> }>({
  gotoApp: async ({ page }, use) => {
    await use(async (path) => {
      await page.goto(path)
      await waitForApp(page, 60_000)
    })
  },
})

const TAB = 'PRESTASIPLUS - Platform Latih Tubi Nasional'
const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'

const B_CODES = [
  'PKSK_MATH',
  'PKSK_SCI',
  'PKSK_ENG',
  'PKSK_SEJ',
  'PKSK_GEO',
  'PKSK_BUDAYA',
  'PKSK_SUKAN',
  'PKSK_MERCU',
  'PKSK_ALAM',
  'PKSK_TECH',
  'PKSK_EKON',
  'PKSK_INOV',
  'PKSK_GLOBAL',
]

/** `pelajar@demo.test` T1 mastery (SRS §6.8, INFERRED seed). */
const PELAJAR_MASTERY: Record<string, number> = {
  PKSK_INSANIAH: 60,
  PKSK_MATH: 70,
  PKSK_SCI: 55,
  PKSK_ENG: 80,
  PKSK_SEJ: 40,
  PKSK_GEO: 65,
  PKSK_ESSAY: 50,
}

const title = (page: Page) => page.getByTestId('shell-user-title')
const subtitle = (page: Page) => page.getByTestId('shell-user-subtitle')

async function expectNotFound(page: Page): Promise<void> {
  await expect(page.locator('[data-page=not-found]')).toBeVisible()
  await expectTabTitle(page, NOT_FOUND_TITLE)
}

test.describe('M07 student screens', { tag: [moduleTag(7)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  // Several tests reload the app 5-6 times (each boot of the full mock set is slow on a loaded machine).
  test.beforeEach(() => {
    test.setTimeout(600_000)
  })

  test('E2E-M07-01 Hub as admin: copy, colours, level cards, no price', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/pksk')
    await expect(page.getByRole('heading', { name: 'Persediaan Kemasukan', level: 1 })).toBeVisible()
    await expectTabTitle(page, TAB)
    await expect(title(page)).toHaveText('PKSK')
    await expect(subtitle(page)).toHaveText('Persediaan Kemasukan SBP / MRSM / SMKA')
    await expect(page.getByTestId('hub-title')).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(page.getByTestId('pksk-banner')).toContainText('SBP / MRSM / SMKA')
    await expect(page.getByTestId('pksk-banner')).toContainText(
      'Latih tubi soalan dan peperiksaan penuh untuk persediaan kemasukan sekolah berasrama penuh',
    )

    await expect(page.getByRole('heading', { name: 'Format Peperiksaan' })).toBeVisible()
    const tiles = [
      ['A', 'Kecerdasan Insaniah', '30 soalan', 'Pemberat: 20%', 'Nilai, akhlak & sahsiah', 'bg-blue-500'],
      ['B', 'Kecerdasan Intelek', '70 soalan', 'Pemberat: 70%', 'Kognitif & penaakulan', 'bg-purple-500'],
      ['C', 'Artikulasi Penulisan', '1 esei', 'Pemberat: 10%', 'Penulisan kreatif', 'bg-pink-500'],
    ] as const
    for (const [letter, name, count, weight, chip, circle] of tiles) {
      const tile = page.getByTestId(`format-${letter}`)
      await expect(tile.getByRole('heading', { name })).toBeVisible()
      await expect(tile).toContainText(count)
      await expect(tile).toContainText(weight)
      await expect(tile).toContainText(chip)
      await expect(tile.getByTestId('format-circle')).toHaveClass(new RegExp(circle))
    }

    await expect(page.getByRole('heading', { name: 'Pilih Tingkatan Anda' })).toBeVisible()
    for (const [lvl, name, text] of [
      ['T1', 'Tingkatan 1', 'Persediaan untuk kemasukan ke tingkatan 1 di SBP/MRSM/SMKA'],
      ['T4', 'Tingkatan 4', 'Persediaan untuk kemasukan ke tingkatan 4 di SBP/MRSM/SMKA'],
    ] as const) {
      const card = page.getByTestId(`level-card-${lvl}`)
      await expect(card.getByRole('heading', { name })).toBeVisible()
      await expect(card).toContainText(text)
      await expect(card.getByTestId('badge-aktif')).toHaveText('AKTIF')
      await expect(card).toHaveClass(/border-green-400/)
      await expect(card.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
        'href',
        `/pksk/level/${lvl}`,
      )
    }
    const main = page.locator('main')
    expect(await main.innerText()).not.toMatch(/RM\s?\d/)
    expect((await main.innerText()).toLowerCase()).not.toContain('harga')
    await expect(main.locator('a[href*="pricing"]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M07-02 Hub per user: access badges follow the grant',
    provisional('the locked state (no badge, no green border) is INFERRED only, L-1'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/pksk')
      await expect(page.getByTestId('badge-aktif')).toHaveCount(2)
      await page.getByTestId('start-T1').click()
      await expect(page).toHaveURL(/\/pksk\/level\/T1$/)
      await expect(title(page)).toHaveText('Dashboard PKSK - T1')
      await gotoApp('/pksk/level/T4')
      await expect(title(page)).toHaveText('Dashboard PKSK - T4')
    },
  )

  test(
    'E2E-M07-02b Hub without a grant: no badge, no green border, "Mula Latihan" present',
    provisional('the locked state is INFERRED only, L-1'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('pelajar2@demo.test')
      await gotoApp('/pksk')
      await expect(page.getByRole('heading', { name: 'Persediaan Kemasukan' })).toBeVisible()
      await expect(page.getByTestId('level-card-T1')).toBeVisible()
      await expect(page.getByTestId('badge-aktif')).toHaveCount(0)
      for (const lvl of ['T1', 'T4']) {
        await expect(page.getByTestId(`level-card-${lvl}`)).not.toHaveClass(/border-green-400/)
        await expect(page.getByTestId(`start-${lvl}`)).toHaveText('Mula Latihan')
      }
    },
  )

  for (const lvl of ['T1', 'T4'] as const) {
    test(`E2E-M07-03 Admin dashboard ${lvl}: header, back link, zero state, shortcuts`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('admin@demo.test')
      await gotoApp(`/pksk/level/${lvl}`)
      await expect(page.getByTestId('score')).toBeVisible()
      await expectTabTitle(page, TAB)
      await expect(title(page)).toHaveText(`Dashboard PKSK - ${lvl}`)
      await expect(subtitle(page)).toHaveText('Pantau kemajuan latihan anda')
      const back = page.getByTestId('back-link')
      await expect(back).toHaveText('Kembali ke PKSK')
      await expect(back).toHaveAttribute('href', '/pksk')
      const hero = page.getByTestId('readiness')
      await expect(hero).toContainText('Skor Kesediaan Anda')
      await expect(page.getByTestId('score')).toHaveText('0%')
      await expect(page.getByTestId('grade')).toHaveText('E')
      await expect(hero).toContainText('Teruskan usaha anda!')
      await expect(hero).toContainText('Jumlah Peperiksaan')
      await expect(page.getByTestId('exam-count')).toHaveText('0')
      await expect(hero).toContainText('Purata Bahagian B')
      await expect(page.getByTestId('avg-b')).toHaveText('0.0%')
      const cuts = [
        ['domains', 'Latih Tubi Domains', 'Fokus pada topik tertentu', 'domains'],
        ['exam', 'Peperiksaan Penuh', 'Simulasi peperiksaan sebenar', 'exam'],
        ['history', 'Sejarah', 'Lihat prestasi lepas', 'history'],
      ] as const
      for (const [key, heading, text, path] of cuts) {
        const c = page.getByTestId(`shortcut-${key}`)
        await expect(c).toContainText(heading)
        await expect(c).toContainText(text)
        await expect(c).toHaveAttribute('href', `/pksk/level/${lvl}/${path}`)
      }
      await expectNoHorizontalScroll(page)
    })
  }

  test(
    'E2E-M07-04 Dashboard values of pelajar (T1 55% C 2 59.7%, T4 zero)',
    provisional('non-zero readiness values and grade bands are INFERRED, L-3'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/pksk/level/T1')
      await expect(page.getByTestId('score')).toHaveText('55%')
      await expect(page.getByTestId('grade')).toHaveText('C')
      await expect(page.getByTestId('exam-count')).toHaveText('2')
      await expect(page.getByTestId('avg-b')).toHaveText('59.7%')
      await gotoApp('/pksk/level/T4')
      await expect(page.getByTestId('score')).toHaveText('0%')
      await expect(page.getByTestId('grade')).toHaveText('E')
      await expect(page.getByTestId('exam-count')).toHaveText('0')
      await expect(page.getByTestId('avg-b')).toHaveText('0.0%')
    },
  )

  test(
    'E2E-M07-05 Penguasaan Domain: 13 Bahagian B cards, icons, links, pelajar mastery',
    provisional('the pelajar mastery values are INFERRED seed values, BR-M07-12'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('pelajar@demo.test')
      for (const lvl of ['T1', 'T4']) {
        await gotoApp(`/pksk/level/${lvl}`)
        await expect(page.getByRole('heading', { name: 'Penguasaan Domain' })).toBeVisible()
        const cards = page.getByTestId('mastery-section').getByTestId('domain-card')
        await expect(cards).toHaveCount(13)
        expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-code')))).toEqual(
          B_CODES,
        )
        await expect(page.getByText('Kecerdasan Insaniah')).toHaveCount(0)
        await expect(page.getByText('Artikulasi Penulisan')).toHaveCount(0)
        for (let i = 0; i < 13; i++) {
          const card = cards.nth(i)
          const code = B_CODES[i] as string
          await expect(card.getByTestId('domain-icon').locator('svg')).toHaveCount(1)
          const link = card.getByTestId('practice-link')
          await expect(link).toHaveText('Latih Sekarang')
          await expect(link).toHaveAttribute('href', `/pksk/level/${lvl}/domain/${code}`)
          await expect(card.getByTestId('mastery-pct')).toHaveText(
            lvl === 'T1' ? `${String(PELAJAR_MASTERY[code] ?? 0)}%` : '0%',
          )
          if (lvl === 'T1') {
            await expect(card.getByTestId('mastery-bar')).toHaveAttribute(
              'style',
              new RegExp(`width: ${String(PELAJAR_MASTERY[code] ?? 0)}%`),
            )
          }
        }
        // the icon carries the domain colour
        await expect(
          cards.first().getByTestId('domain-icon'),
        ).toHaveCSS('color', 'rgb(59, 130, 246)')
      }
    },
  )

  for (const lvl of ['T1', 'T4'] as const) {
    test(`E2E-M07-06 Domains ${lvl}: sections, 1/13/1 cards, counts, mastery`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('admin@demo.test')
      await gotoApp(`/pksk/level/${lvl}/domains`)
      await expect(page.getByTestId('section-B')).toBeVisible()
      await expectTabTitle(page, TAB)
      await expect(title(page)).toHaveText(`Domain PKSK - ${lvl}`)
      await expect(subtitle(page)).toHaveText('Pilih domain untuk latih tubi')
      const back = page.getByTestId('back-link')
      await expect(back).toHaveText('Kembali ke Dashboard')
      await expect(back).toHaveAttribute('href', `/pksk/level/${lvl}`)

      const sections = [
        ['A', 'bg-blue-500', 'Kecerdasan Insaniah', 'Nilai, akhlak & sahsiah', 1],
        ['B', 'bg-purple-500', 'Kecerdasan Intelek', 'Kognitif & penaakulan', 13],
        ['C', 'bg-pink-500', 'Artikulasi Penulisan', 'Penulisan kreatif', 1],
      ] as const
      let total = 0
      for (const [b, badge, name, sub, n] of sections) {
        const s = page.getByTestId(`section-${b}`)
        await expect(s.getByTestId('section-badge')).toHaveClass(new RegExp(badge))
        await expect(s.getByRole('heading', { name, level: 2 })).toBeVisible()
        await expect(s).toContainText(sub)
        const cards = s.getByTestId('domain-card')
        await expect(cards).toHaveCount(n)
        for (let i = 0; i < n; i++) {
          const card = cards.nth(i)
          await expect(card).toHaveAttribute('href', new RegExp(`^/pksk/level/${lvl}/domain/PKSK_`))
          await expect(card.getByTestId('domain-icon').locator('svg')).toHaveCount(1)
          await expect(card.getByTestId('mastery-pct')).toHaveText('0%')
          total += Number(await card.getByTestId('question-count').innerText())
        }
      }
      expect(total).toBe(lvl === 'T1' ? 383 : 380)
      const sej = page.locator('[data-code=PKSK_SEJ]')
      await expect(sej.getByTestId('question-count')).toHaveText(lvl === 'T1' ? '27' : '24')
      await expectNoHorizontalScroll(page)
    })
  }

  test(
    'E2E-M07-06b Domains T1 as pelajar: mastery values',
    provisional('the pelajar mastery values are INFERRED seed values, BR-M07-12'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/pksk/level/T1/domains')
      await expect(page.getByTestId('section-B')).toBeVisible()
      for (const [code, pct] of Object.entries(PELAJAR_MASTERY)) {
        await expect(page.locator(`[data-code=${code}]`).getByTestId('mastery-pct')).toHaveText(
          `${String(pct)}%`,
        )
      }
    },
  )

  test('E2E-M07-07 History: from the dashboard, rows of pelajar, empty for T4', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/pksk/level/T1')
    await page.getByTestId('shortcut-history').click()
    await expect(page).toHaveURL(/\/pksk\/level\/T1\/history$/)
    await expect(page.getByTestId('history-table')).toBeVisible()
    await expect(page.getByText('Ralat Pelayan')).toHaveCount(0)
    await expectTabTitle(page, TAB)
    await expect(title(page)).toHaveText('Sejarah PKSK - T1')
    await expect(subtitle(page)).toHaveText('Lihat prestasi lepas')
    const back = page.getByTestId('back-link')
    await expect(back).toHaveText('Kembali ke Dashboard')
    await expect(back).toHaveAttribute('href', '/pksk/level/T1')
    await expect(page.locator('th')).toHaveText(['Tarikh', 'Skor', 'Gred'])
    const rows = page.getByTestId('history-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).locator('td')).toHaveText(['20/09/2026', '64%', 'C'])
    await expect(rows.nth(1).locator('td')).toHaveText(['10/09/2026', '46%', 'D'])
    await expect(page.getByTestId('history-table').locator('a, button, select, input')).toHaveCount(
      0,
    )
    await expectNoHorizontalScroll(page)

    await gotoApp('/pksk/level/T4/history')
    await expect(page.getByTestId('history-empty')).toHaveText('Tiada sejarah peperiksaan.')
    await expect(page.locator('table')).toHaveCount(0)
  })

  test('E2E-M07-07b History: empty for the admin', async ({ page, gotoApp, loginAs }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/pksk/level/T1/history')
    await expect(page.getByTestId('history-empty')).toHaveText('Tiada sejarah peperiksaan.')
    await expect(page.locator('table')).toHaveCount(0)
  })

  test(
    'E2E-M07-08 Provisional practice and exam flow (L-2 / L-3)',
    provisional('the practice and exam pages are UNVERIFIED neutral pages pending L-2 / L-3'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('admin@demo.test')
      await gotoApp('/pksk/level/T1')
      const matLink = page.locator('[data-code=PKSK_MATH]').getByTestId('practice-link')
      await matLink.click()
      await expect(page).toHaveURL(/\/pksk\/level\/T1\/domain\/PKSK_MATH$/)
      await expect(page.getByTestId('pksk-practice')).toHaveAttribute('data-provisional', 'L-2')
      await expect(page.getByTestId('practice-title')).toHaveText('Matematik')
      const items = page.getByTestId('pksk-item')
      expect(await items.count()).toBeGreaterThan(0)
      for (const item of await items.all()) {
        await expect(item.locator('input, textarea').first()).toBeVisible()
      }
      await page.getByTestId('practice-submit').click()
      await expect(page).toHaveURL(/\/pksk\/level\/T1\/domains$/)

      // The Matematik card of S3 opens the same page.
      await page.locator('[data-code=PKSK_MATH]').click()
      await expect(page).toHaveURL(/\/pksk\/level\/T1\/domain\/PKSK_MATH$/)
      await expect(page.getByTestId('practice-title')).toHaveText('Matematik')

      await gotoApp('/pksk/level/T1')
      await expect(page.getByTestId('exam-count')).toHaveText('0')
      await page.getByTestId('shortcut-exam').click()
      await expect(page).toHaveURL(/\/pksk\/level\/T1\/exam$/)
      await expect(page.getByTestId('pksk-exam')).toHaveAttribute('data-provisional', 'L-3')
      await expect(page.getByTestId('exam-title')).toHaveText('Peperiksaan Penuh')
      await expect(page.getByTestId('exam-section-A').getByTestId('pksk-item')).toHaveCount(30)
      await expect(page.getByTestId('exam-section-B').getByTestId('pksk-item')).toHaveCount(70)
      await expect(page.getByTestId('exam-section-C').getByTestId('pksk-item')).toHaveCount(1)
      await expect(page.getByTestId('exam-section-C').locator('textarea')).toHaveCount(1)
      await expect(
        page.getByTestId('exam-section-A').getByTestId('pksk-item').first().locator('input').first(),
      ).toBeVisible()
      await page.getByTestId('exam-submit').click()
      await expect(page).toHaveURL(/\/pksk\/level\/T1$/)
      await expect(page.getByTestId('exam-count')).toHaveText('1')

      await gotoApp('/pksk/level/T1/history')
      await expect(page.getByTestId('history-row')).toHaveCount(1)
    },
  )

  test(
    'E2E-M07-09 404 pages for an unknown level and an unknown domain code',
    provisional('the PKSK_XYZ step is INFERRED (FN-M07-1.5.4)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs('admin@demo.test')
      for (const path of [
        '/pksk/level/T9',
        '/pksk/level/ALL',
        '/pksk/level/T9/domains',
        '/pksk/level/T1/domain/PKSK_XYZ',
      ]) {
        await gotoApp(path)
        await expectNotFound(page)
        await expect(page.getByText('404', { exact: true })).toBeVisible()
        await expect(page.getByText('Halaman Tidak Dijumpai').first()).toBeVisible()
        await expect(page.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
        await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
          'href',
          '/practice',
        )
      }
    },
  )

  test(
    'E2E-M07-10 Level gate: no access redirects every level route to /pksk',
    provisional('the gate is INFERRED, L-1'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs('pelajar2@demo.test')
      for (const path of [
        '/pksk/level/T1',
        '/pksk/level/T1/domains',
        '/pksk/level/T1/history',
        '/pksk/level/T1/domain/PKSK_MATH',
        '/pksk/level/T1/exam',
      ]) {
        await gotoApp(path)
        await expect(page).toHaveURL(/\/pksk$/)
        await expect(page.getByRole('heading', { name: 'Persediaan Kemasukan' })).toBeVisible()
        await expect(page.getByRole('alert')).toHaveCount(0)
      }
      await gotoApp('/pksk/level/T1')
      await expect(page).toHaveURL(/\/pksk$/)
      expect((await mock.lastRequest('/api/pksk/levels/T1/dashboard'))?.status).toBe(403)
    },
  )

  test('E2E-M07-40 Admin without a grant opens both levels', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    for (const lvl of ['T1', 'T4']) {
      await gotoApp(`/pksk/level/${lvl}`)
      await expect(page).toHaveURL(new RegExp(`/pksk/level/${lvl}$`))
      await expect(title(page)).toHaveText(`Dashboard PKSK - ${lvl}`)
    }
  })

  test('E2E-M07-41 User shell: "PKSK" + "PRO" in the sidebar (>= 1024) or drawer', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/pksk')
    await expect(page.getByTestId('pksk-hub')).toBeVisible()
    let item
    if (isDesktopShell(page)) {
      item = page.getByTestId('shell-user-sidebar').locator('[data-nav-id="pksk"]')
    } else {
      await page.getByTestId('shell-user-hamburger').click()
      const drawer = page.getByTestId('shell-user-drawer')
      await expect(drawer).toHaveClass(/\bopen\b/)
      item = drawer.locator('[data-nav-id="pksk"]')
    }
    await expect(item).toContainText('PKSK')
    await expect(item).toContainText('PRO')
    await expect(item).toHaveAttribute('href', '/pksk')
  })

  test(
    'E2E-M07-42 Guest is sent to /login from every student route',
    provisional('the exam and domain-practice routes are INFERRED'),
    async ({ page, gotoApp }) => {
      for (const path of [
        '/pksk',
        '/pksk/level/T1',
        '/pksk/level/T1/domains',
        '/pksk/level/T4/history',
        '/pksk/level/T1/exam',
        '/pksk/level/T1/domain/PKSK_MATH',
      ]) {
        await gotoApp(path)
        await expect(page).toHaveURL(/\/login/)
      }
    },
  )

  test('E2E-M07-44 Responsive: no horizontal scroll, grids per width, text >= 12px (S1-S4b)', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    const w = viewportWidth(page)
    const cols = (sel: string) =>
      page
        .locator(sel)
        .evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size)
    const smallText = () =>
      page.locator('main').evaluate((main) => {
        const bad: string[] = []
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = (n.textContent ?? '').trim()
          const el = n.parentElement
          if (!text || !el) continue
          const size = parseFloat(getComputedStyle(el).fontSize)
          if (size < 12) bad.push(`${text.slice(0, 30)} (${String(size)}px)`)
        }
        return bad
      })

    const pages: [string, string][] = [
      ['/pksk', '[data-testid=pksk-hub]'],
      ['/pksk/level/T1', '[data-testid=pksk-dashboard] [data-testid=score]'],
      ['/pksk/level/T1/domains', '[data-testid=section-B]'],
      ['/pksk/level/T1/history', '[data-testid=history-table]'],
      ['/pksk/level/T1/domain/PKSK_MATH', '[data-testid=practice-title]'],
      ['/pksk/level/T1/exam', '[data-testid=exam-title]'],
    ]
    for (const [path, ready] of pages) {
      await gotoApp(path)
      await expect(page.locator(ready)).toBeVisible()
      if (path === '/pksk/level/T1/exam') await expect(page.getByTestId('exam-submit')).toBeVisible()
      await expectNoHorizontalScroll(page)
      expect(await smallText(), `${path} text below 12px`).toEqual([])
    }

    await gotoApp('/pksk')
    await expect(page.getByTestId('level-card-T1')).toBeVisible()
    expect(await cols('[data-testid^=format-][data-testid$=A], [data-testid=format-B], [data-testid=format-C]')).toBe(
      w >= 768 ? 3 : 1,
    )
    expect(await cols('[data-testid^=level-card-]')).toBe(w >= 768 ? 2 : 1)

    await gotoApp('/pksk/level/T1')
    await expect(page.getByTestId('mastery-section')).toBeVisible()
    expect(await cols('[data-testid=mastery-section] [data-testid=domain-card]')).toBe(
      w >= 1024 ? 3 : w >= 768 ? 2 : 1,
    )
    expect(await cols('[data-testid^=shortcut-]')).toBe(w >= 768 ? 3 : 1)

    await gotoApp('/pksk/level/T1/domains')
    await expect(page.getByTestId('section-B')).toBeVisible()
    expect(await cols('[data-testid=section-B] [data-testid=domain-card]')).toBe(
      w >= 1024 ? 3 : w >= 768 ? 2 : 1,
    )
  })

  test(
    'E2E-M07-45 Domain practice is recorded as one M05 session (reduced: request and history count)',
    provisional('pending L-2; the flagged options are not served to the browser (SEC-M07-07), so the all-correct check is covered by the M07-T1a mock tests'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/pksk/level/T1/domain/PKSK_MATH')
      await expect(page.getByTestId('practice-title')).toHaveText('Matematik')
      const items = page.getByTestId('pksk-item')
      const n = await items.count()
      expect(n).toBeGreaterThan(0)
      for (const item of await items.all()) await item.locator('input').first().check()
      await page.getByTestId('practice-submit').click()
      await expect(page).toHaveURL(/\/pksk\/level\/T1\/domains$/)
      const post = await mock.lastRequest('/api/pksk/levels/T1/domains/PKSK_MATH/practice-sessions')
      expect(post?.method).toBe('POST')
      expect(post?.status).toBe(201)
      expect((post?.body as { answers: unknown[] }).answers).toHaveLength(n)
      const pct = await page
        .locator('[data-code=PKSK_MATH]')
        .getByTestId('mastery-pct')
        .innerText()
      expect(pct).toMatch(/^\d{1,3}%$/)
    },
  )
})
