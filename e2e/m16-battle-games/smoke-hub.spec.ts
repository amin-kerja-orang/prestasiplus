/**
 * M16 S6 `/permainan` Zona Permainan at 375 / 768 / 1280 (M16-T4a; SRS M16 v1.6 §12: E2E-M16-43, 44, 45).
 * Admin (grade Darjah 4, 6 Papan Bijak games, no battle) and pelajar2 (no data). The hub only links: the
 * room-game cards are followed here, the other targets (S1, S13+) are checked by their href.
 */

import type { Page } from '@playwright/test'

import { expect as baseExpect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
} from '../support'

const expect = baseExpect.configure({ timeout: 10_000 })

const ADMIN = 'admin@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const MODULE = { tag: [moduleTag(16)] }

test.use({ mockInit: { latency: 0 } })

/** The 18 cards in live order (discovery A.3): title, badge, button text, route. */
const CARDS: [string, string | null, string, string][] = [
  ['Papan Bijak', null, 'Main Sekarang', '/papan-bijak'],
  ['Battle Arena', '🔥 HOT', 'Battle!', '/battle'],
  ['Perang Fakta', '👥 MULTIPLAYER', 'Main!', '/perang-fakta'],
  ['Benteng Ilmu', '👥 MULTIPLAYER', 'Duel!', '/benteng-ilmu'],
  ['Perlumbaan Matematik', '👥 MULTIPLAYER', 'Lumba!', '/perlumbaan-matematik'],
  ['Kuiz Relay', '👥 MULTIPLAYER', 'Main!', '/kuiz-relay'],
  ['Teka Silang Kata', '👥 MULTIPLAYER', 'Main!', '/teka-silang-kata'],
  ['Betul atau Salah', '✅❌ BARU!', 'Mula', '/permainan/betul-salah'],
  ['Roda Nasib', '📅 HARIAN', 'Spin Sekarang!', '/permainan/roda-nasib'],
  ['Pertandingan Mingguan', '📅 MINGGUAN', 'Lihat Ranking', '/permainan/pertandingan'],
  ['Peta Pengembaraan', null, 'Jelajah', '/peta-belajar'],
  ['Uji Minda', '👨‍👩‍👧 IBU BAPA', 'Mula', '/permainan/uji-minda'],
  ['Cabaran Kilat', '⚡ BARU!', 'Mula!', '/permainan/cabaran-kilat'],
  ['Jutawan Ilmu', '💰 BARU!', 'Main!', '/permainan/jutawan'],
  ['Susun Jawapan', '🧩 BARU!', 'Susun!', '/permainan/susun-jawapan'],
  ['Tembak Jawapan', '🎯 BARU!', 'Tembak!', '/permainan/tembak-jawapan'],
  ['Sambung Kata', '🔗 BARU!', 'Mula!', '/permainan/sambung-kata'],
  ['Kad Memori', '🧠 HOT!', 'Main!', '/permainan/kad-memori'],
]

/** Client-side navigation (keeps the mock state, unlike a page load). */
async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(p: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(to)
  }, path)
}

const grid = (page: Page) => page.getByTestId('hub-grid')
const card = (page: Page, id: string) => page.getByTestId(`hub-card-${id}`)

test.describe('M16 S6 hub', MODULE, () => {
  test('E2E-M16-43 S6 header, empty rooms, 18 cards in order, card and button navigate, 1/2/3 columns @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan')
    await expectTabTitle(page, 'Permainan — PRESTASIPLUS')
    await expect(page.getByTestId('shell-user-title').first()).toHaveText('Zona Permainan')
    await expect(page.getByTestId('shell-user-subtitle').first()).toHaveText(
      'Selamat datang kembali',
    )
    await expect(page.getByTestId('hub-h1')).toHaveText('🎮 Zona Permainan')
    await expect(page.getByTestId('hub-open-rooms-empty')).toContainText('🌙')
    await expect(page.getByTestId('hub-open-rooms-empty')).toContainText(
      'Tiada bilik terbuka buat masa ini.',
    )
    await expect(page.getByTestId('hub-open-rooms-empty')).toContainText(
      'Cipta bilik permainan dan jemput rakan-rakan!',
    )

    // 18 cards, in live order, with badge, button text and target.
    await expect(grid(page).locator('h3')).toHaveCount(18)
    expect(await grid(page).locator('h3').allTextContents()).toEqual(CARDS.map((c) => c[0]))
    const buttons = grid(page).getByTestId('hub-card-button')
    await expect(buttons).toHaveCount(18)
    expect((await buttons.allTextContents()).map((t) => t.trim())).toEqual(CARDS.map((c) => c[2]))
    expect(await buttons.evaluateAll((els) => els.map((a) => a.getAttribute('href')))).toEqual(
      CARDS.map((c) => c[3]),
    )
    expect(await grid(page).locator('[data-testid="hub-card-badge"]').allTextContents()).toEqual(
      CARDS.flatMap((c) => (c[1] === null ? [] : [c[1]])),
    )

    // Columns by width: 1 below sm, 2 at sm, 3 from lg.
    const width = page.viewportSize()!.width
    const lefts = await grid(page)
      .locator('h3')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
    const columns = new Set(lefts).size
    expect(columns).toBe(width >= 1024 ? 3 : width >= 640 ? 2 : 1)

    // Touch targets of the buttons (>= 44 px).
    await expectTouchTarget(buttons.first())
    await expectNoHorizontalScroll(page)

    // The whole card navigates (live onclick) ...
    await card(page, 'kuiz-relay').locator('p').click()
    await expect(page).toHaveURL(/\/kuiz-relay$/)
    await expect(page.getByTestId('lobby-h1')).toHaveText('🏃‍♂️ Kuiz Relay')
    // ... and so does the button, once.
    await page.goBack()
    await expect(page.getByTestId('hub-h1')).toBeVisible()
    await card(page, 'benteng-ilmu').getByTestId('hub-card-button').click()
    await expect(page).toHaveURL(/\/benteng-ilmu$/)
    await expect(page.getByTestId('lobby-h1')).toHaveText('🏰 Benteng Ilmu')
    await page.goBack()
    await expect(page.getByTestId('hub-h1')).toBeVisible()
    await card(page, 'papan-bijak').getByTestId('hub-card-button').click()
    await expect(page).toHaveURL(/\/papan-bijak$/)
    await expect(page.getByTestId('pb-h1')).toHaveText('🎲 Papan Bijak')
  })

  test('E2E-M16-44 S6 chips: admin (no Papan Bijak chip, Battle chip); pelajar2 (both chips) @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan')
    await expect(card(page, 'papan-bijak')).toBeVisible()
    await expect(card(page, 'papan-bijak')).not.toContainText('Belum main lagi')
    await expect(card(page, 'battle')).toContainText('🆕 Belum battle lagi')
  })

  test('S6 chips for pelajar2: both "Belum" chips (part of E2E-M16-44) @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/permainan')
    await expect(card(page, 'papan-bijak')).toContainText('🆕 Belum main lagi')
    await expect(card(page, 'battle')).toContainText('🆕 Belum battle lagi')
  })

  test(
    'E2E-M16-45 S6 fixture openRoom: the strip shows the room link to /papan-bijak/PB1234 @m16',
    provisional('the populated open-rooms strip is a PROPOSED layout (SRS §8.2)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/permainan')
      await mock.hook('m16Fixture', 'openRoom')
      await spaGo(page, '/dashboard')
      await spaGo(page, '/permainan')
      const chip = page.getByTestId('hub-open-room')
      await expect(chip).toHaveCount(1)
      await expect(chip).toHaveAttribute('href', '/papan-bijak/PB1234')
      await expect(chip).toContainText('Papan Bijak')
      await expect(chip).toContainText('PB1234')
      await expect(chip).toContainText('1/4')
      await expect(page.getByTestId('hub-open-rooms-empty')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test('S6 never scrolls the page sideways and keeps every text at 12 px or more @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan')
    await expect(grid(page).locator('h3')).toHaveCount(18)
    await expectNoHorizontalScroll(page)
    const small = await page.getByTestId('shell-user-main').evaluate((main) => {
      const bad: string[] = []
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = (n.nodeValue ?? '').trim()
        const parent = n.parentElement
        if (!text || !parent) continue
        const size = parseFloat(getComputedStyle(parent).fontSize)
        if (size < 12) bad.push(`${text.slice(0, 30)} (${String(size)}px)`)
      }
      return bad
    })
    expect(small).toEqual([])
  })
})
