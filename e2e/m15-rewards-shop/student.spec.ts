/**
 * M15 S5 `/gamification/rewards`, S6 `/gamification/mystery-box`, S7 `/cabutan` at 375 / 768 / 1280
 * (M15-T2; SRS M15 §12 scenarios 04 (S5-S7 part), 05, 07, 08 (probed sub-paths), 41-49, 54 and 55
 * (S5-S7 part)). Titles carry "SRS §12 #nn" and no E2E ids (developer smoke, as the M10 specs).
 * Accounts: the admin (wallet 256 syiling / 0 tokens, SRS §6.8) and `pelajar@demo.test`.
 * Scenarios that need an unobserved state or an M14 hook (`setWallet`, `getWallet`, `ledger`,
 * `createDraw`) are `@provisional`; run them once M15-T1 and the M14 hooks are merged.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

import { expectAdminHeader, expectLearnerHeader, textContrast } from './helpers'

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(15)] }

/** Leaves the screen and opens it again in-app (no reload), so the page re-reads state set by a page-memory hook. */
async function spaReopen(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const app = document.querySelector('#app') as
      | (Element & {
          __vue_app__?: {
            config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
          }
        })
      | null
    const router = app!.__vue_app__!.config.globalProperties.$router
    await router.push('/gamification/rewards')
    await router.push(to)
  }, path)
}

// These tests boot the app up to seven times and one boot may take the 15 s budget of `gotoApp`, so
// the default 30 s only fits an idle machine. A longer limit, not a retry.
test.describe.configure({ timeout: 90_000 })

test.use({ mockInit: { latency: 0 } })

/** Smallest text size among the text nodes inside `main` (DV-M15-13). */
async function minTextSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    let min = Infinity
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim() || !n.parentElement) continue
      const style = getComputedStyle(n.parentElement)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      min = Math.min(min, parseFloat(style.fontSize))
    }
    return min
  })
}

test.describe('M15 S5 Kedai Hadiah', MODULE, () => {
  test('SRS §12 #41 admin: hero, tile "0", empty state, h1 size, query ignored @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/gamification/rewards')
    await expectTabTitle(page, 'Kedai Hadiah | PRESTASIPLUS')
    await expectAdminHeader(page, 'Kedai Hadiah', 'Selamat datang kembali')
    const h1 = page.getByTestId('shop-title')
    await expect(h1).toHaveText('🎁 Kedai Hadiah')
    await expect(page.getByText('Tebus token anda untuk hadiah menarik!')).toBeVisible()
    await expect(page.getByTestId('shop-balance-value')).toHaveText('0')
    await expect(page.getByTestId('shop-balance')).toContainText('Baki Token 🎫')
    const empty = page.getByTestId('shop-empty')
    await expect(empty.getByRole('heading', { name: 'Tiada Hadiah Tersedia' })).toBeVisible()
    await expect(empty).toContainText('Hadiah akan ditambah tidak lama lagi. Tunggu ya!')
    // `text-title` is 24px at every width for staff; the hero is a plain card (B06, 79b5fa2dc).
    const size = await h1.evaluate((el) => getComputedStyle(el).fontSize)
    expect(size).toBe('24px')
    expect(await textContrast(h1)).toBeGreaterThanOrEqual(4.5)
    await expectNoHorizontalScroll(page)

    await gotoApp('/gamification/rewards?category=gaming')
    await expect(page.getByTestId('shop-empty')).toBeVisible()
    await expect(page.getByTestId('shop-balance-value')).toHaveText('0')
  })

  test(
    'SRS §12 #42 tile follows the wallet; an active reward does not populate the shop @m15',
    provisional('needs the M14 hook setWallet and the M15 hook m15SetReward (M15-T1)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/gamification/rewards')
      await mock.hook('setWallet', 1, { tokens: 50 })
      await mock.hook('m15SetReward', 1, { isActive: true })
      await gotoApp('/gamification/rewards')
      await expect(page.getByTestId('shop-balance-value')).toHaveText('50')
      await expect(page.getByTestId('shop-empty')).toBeVisible()
      await expect(page.locator('main button')).toHaveCount(0)
    },
  )

  test('SRS §12 #54 S5 no horizontal scroll, text >= 12px @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/gamification/rewards')
    await expect(page.getByTestId('shop-empty')).toBeVisible()
    await expectNoHorizontalScroll(page)
    expect(await minTextSize(page)).toBeGreaterThanOrEqual(12)
  })
})

test.describe('M15 S6 Kotak Misteri', MODULE, () => {
  const ODDS = [
    ['10 syiling', '40%'],
    ['25 syiling', '25%'],
    ['60 syiling', '15%'],
    ['1 token', '10%'],
    ['150 syiling', '6%'],
    ['3 token', '3%'],
    ['500 syiling — jackpot!', '1%'],
  ]
  const DISCLAIMER =
    'Purata ganjaran lebih rendah daripada kos kotak — main untuk keseronokan, bukan untuk mengumpul syiling.'

  test('SRS §12 #43 admin: one card with cost, balance, the odds table, the disclaimer and the empty history @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/gamification/mystery-box')
    await expectTabTitle(page, 'Kotak Misteri | PRESTASIPLUS')
    await expectAdminHeader(page, 'Kotak Misteri', 'Selamat datang kembali')
    await expect(page.getByTestId('box-title')).toHaveText('📦 Kotak Misteri')
    await expect(
      page.getByText('Buka kotak & menang ganjaran rawak — nasib baik menanti!'),
    ).toBeVisible()
    await expect(page.getByTestId('box-hero')).toHaveCount(1)
    await expect(page.getByTestId('box-cost')).toHaveText('Kos satu kotak 50 syiling')
    await expect(page.getByTestId('box-chip')).toContainText('Baki syiling anda:')
    await expect(page.getByRole('heading', { name: 'Peluang ganjaran' })).toBeVisible()
    const rows = page.getByTestId('box-odds-table').locator('tbody tr')
    await expect(rows).toHaveCount(7)
    for (const [i, [prize, chance]] of ODDS.entries()) {
      await expect(rows.nth(i)).toContainText(prize as string)
      await expect(rows.nth(i)).toContainText(chance as string)
    }
    await expect(page.getByTestId('box-disclaimer')).toHaveText(DISCLAIMER)
    await expect(page.getByRole('heading', { name: 'Kotak yang telah dibuka' })).toBeVisible()
    await expect(page.getByTestId('box-history-empty')).toHaveText(
      'Anda belum membuka sebarang kotak.',
    )
    await expectNoHorizontalScroll(page)
    expect(await minTextSize(page)).toBeGreaterThanOrEqual(12)
  })

  test('SRS §12 #54 AC-GM-23.7 the page never scrolls sideways; at 375 the odds table scrolls inside its card @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/gamification/mystery-box')
    await expect(page.getByTestId('box-odds-table')).toBeVisible()
    await expectNoHorizontalScroll(page)
    const scroll = page.getByTestId('box-odds-scroll')
    const [scrollWidth, clientWidth] = await scroll.evaluate((el) => [el.scrollWidth, el.clientWidth])
    if (viewportWidth(page) < 640) expect(scrollWidth).toBeGreaterThan(clientWidth)
    else expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    await expectTouchTarget(page.getByTestId('box-btn'))
  })

  test(
    'SRS §12 #44 AC-GM-23.4 40 syiling: the short text and Kumpul syiling show, the open button is disabled @m15',
    provisional('needs the M14 hook setWallet'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/gamification/mystery-box') // the hooks need a booted page (window.__mock)
      await mock.hook('setWallet', 1, { syiling: 40 })
      await gotoApp('/gamification/mystery-box')
      await expect(page.getByTestId('box-short')).toHaveText(
        'Anda perlu 10 syiling lagi untuk membuka kotak.',
      )
      const collect = page.getByTestId('box-collect')
      await expect(collect).toHaveText('Kumpul syiling')
      await expect(collect).toHaveAttribute('href', '/practice')
      await expectTouchTarget(collect)
      await expect(page.getByTestId('box-btn')).toBeDisabled()
      expect(await mock.lastRequest('/api/gamification/mystery-boxes/*/open')).toBeNull()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §12 #45 AC-GM-23.1 open at 80 syiling: confirm with Batal focused, then 30 + prize and the history @m15',
    provisional('needs the M14 hooks setWallet, getWallet and ledger'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/gamification/mystery-box') // the hooks need a booted page (window.__mock)
      await mock.hook('setWallet', 1, { syiling: 80 })
      await gotoApp('/gamification/mystery-box')
      // The next-prize override lives in the page, so it is set after the reload.
      await mock.hook('m15MysteryNext', { label: '25 syiling' })
      await page.getByTestId('box-btn').click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText('Buka kotak?')
      await expect(page.getByTestId('box-confirm-body')).toHaveText(
        '50 syiling akan ditolak daripada baki anda (80 syiling).',
      )
      await expect(page.getByTestId('box-confirm-cancel')).toBeFocused()
      await expectTouchTarget(page.getByTestId('box-confirm-cancel'))
      // `DsDialog`: a bottom sheet below `sm`, a modal from `sm`.
      const width = viewportWidth(page)
      const height = page.viewportSize()!.height
      if (width < 640) {
        await expect
          .poll(async () => {
            const box = (await dialog.boundingBox())!
            return Math.round(box.width) === width && Math.round(box.y + box.height) === height
          })
          .toBe(true)
      }
      // Batal sends nothing.
      await page.getByTestId('box-confirm-cancel').click()
      expect(await mock.lastRequest('/api/gamification/mystery-boxes/*/open')).toBeNull()
      await page.getByTestId('box-btn').click()
      await page.getByTestId('box-confirm-ok').click()
      const result = page.getByTestId('box-result')
      await expect(result).toBeVisible()
      await expect(page.getByTestId('box-result-name')).toHaveText('Tahniah! Anda dapat 25 syiling.')
      await expect(page.getByTestId('box-result-reward')).toHaveText('+25 🪙')
      await expectNoHorizontalScroll(page)
      const wallet = await mock.hook<{ currentSyiling: number; tokenBalance: number; xp: number }>(
        'getWallet',
        1,
      )
      expect(wallet.currentSyiling).toBe(55)
      const ledger = await mock.hook<{ description: string; amount: number }[]>('ledger', 1)
      expect(ledger.map((l) => [l.description, l.amount])).toEqual(
        expect.arrayContaining([
          ['Kotak Misteri: Kotak Misteri', -50],
          ['Kotak Misteri: 25 syiling', 25],
        ]),
      )
      await page.getByTestId('box-result-close').click()
      await expect(result).toHaveCount(0)
      const row = page.getByTestId('box-history-row').first()
      await expect(row).toContainText('Kotak Misteri: 25 syiling')
      await expect(row).toContainText('25/09 15:40')
      await expect(page.getByTestId('box-history-empty')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §12 #46 N5 every prize at stock 0: the notice shows and the open button is disabled @m15',
    provisional('needs the M15 hook m15SetMysteryBox'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/gamification/mystery-box') // the hooks need a booted page (window.__mock)
      await mock.hook('setWallet', 1, { syiling: 80 })
      await gotoApp('/gamification/mystery-box')
      // The box state lives in the page (like the next-prize override), so it is set after the last reload and the
      // screen is re-opened in-app.
      await mock.hook('m15SetMysteryBox', {
        stocks: Object.fromEntries(ODDS.map(([prize]) => [prize, 0])),
      })
      await spaReopen(page, '/gamification/mystery-box')
      await expect(page.getByTestId('box-unavailable')).toHaveText(
        'Kotak tidak tersedia buat masa ini.',
      )
      await expect(page.getByTestId('box-btn')).toBeDisabled()
      await expect(page.getByTestId('box-disclaimer')).toHaveText(DISCLAIMER)
      expect(await mock.lastRequest('/api/gamification/mystery-boxes/*/open')).toBeNull()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §12 #47 AC-GM-23.3 the daily limit shows its text and disables the button @m15',
    provisional('needs the M14 hook setWallet and the M15 hook m15SetMysteryBox'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/gamification/mystery-box') // the hooks need a booted page (window.__mock)
      await mock.hook('setWallet', 1, { syiling: 500 })
      await gotoApp('/gamification/mystery-box')
      await mock.hook('m15SetMysteryBox', { dailyMax: 1 })
      await spaReopen(page, '/gamification/mystery-box')
      await page.getByTestId('box-btn').click()
      await page.getByTestId('box-confirm-ok').click()
      await page.getByTestId('box-result-close').click()
      await expect(page.getByTestId('box-daily')).toHaveText(
        'Had kotak hari ini telah dicapai. Cuba lagi esok.',
      )
      await expect(page.getByTestId('box-btn')).toBeDisabled()
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M15 S7 Cabutan Bertuah', MODULE, () => {
  test('SRS §12 #47 admin: header, tile "256", "Cabutan Dibuka" and the empty box @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cabutan')
    await expectTabTitle(page, 'Cabutan Bertuah | PRESTASIPLUS')
    await expectAdminHeader(page, 'Cabutan Bertuah', 'Selamat datang kembali')
    await expect(page.getByTestId('cabutan-title')).toHaveText('🎟️ Cabutan Bertuah')
    await expect(
      page.getByText('Guna syiling untuk beli tiket & menangi hadiah hebat!'),
    ).toBeVisible()
    await expect(page.getByTestId('cabutan-tile')).toContainText('Syiling anda')
    // No ALL CAPS (v2-design-language 3.3 rule 4); the coin is an image in `DsRewardChip` (B06, 79b5fa2dc).
    expect(
      await page
        .getByTestId('cabutan-tile')
        .getByText('Syiling anda')
        .evaluate((el) => getComputedStyle(el).textTransform),
    ).toBe('none')
    await expect(page.getByTestId('cabutan-balance')).toHaveText('256')
    await expect(page.getByTestId('cabutan-balance').locator('img')).toHaveAttribute(
      'data-art',
      'coin',
    )
    // `exact`: the empty state title is a heading too and also contains "cabutan dibuka".
    await expect(page.getByRole('heading', { name: 'Cabutan Dibuka', exact: true })).toBeVisible()
    await expect(page.getByTestId('cabutan-empty')).toHaveText(
      'Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈',
    )
    await expect(page.getByTestId('cabutan-list')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    expect(await minTextSize(page)).toBeGreaterThanOrEqual(12)
  })

  test(
    'SRS §12 #48 fixture draw: card content, the empty box is gone @m15',
    provisional('the draw card is PROPOSED; needs the M14 hook createDraw'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/cabutan')
      await mock.hook('createDraw', {
        title: 'Cabutan Demo',
        description: 'Cabutan ujian.',
        ticketCostSyiling: 50,
        maxTicketsPerStudent: 10,
        prizePool: [
          { label: 'Baucar Topup RM50', value_sen: 5000, qty: 1 },
          { label: 'Baucar RM5', value_sen: 500, qty: 10 },
        ],
        closesAt: '2026-09-30',
        openNow: true,
      })
      await gotoApp('/cabutan')
      const card = page.getByTestId('draw-1')
      await expect(card).toContainText('Cabutan Demo')
      await expect(card).toContainText('Cabutan ujian.')
      await expect(card.getByTestId('draw-price')).toHaveText('Harga tiket: 50')
      await expect(card.getByTestId('draw-owned')).toHaveText('Tiket anda: 0 / 10')
      await expect(card.getByTestId('draw-counter')).toHaveText('0/10')
      await expect(card.getByTestId('draw-closes')).toHaveText('Tutup: 30/09/2026')
      await expect(card.getByTestId('draw-prize')).toHaveText([
        'Baucar Topup RM50 × 1',
        'Baucar RM5 × 10',
      ])
      await expect(card.getByTestId('draw-buy')).toHaveText('🎟️ Beli Tiket')
      await expect(page.getByTestId('cabutan-empty')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §12 #49 buy a ticket: tile 206, "Tiket anda: 1 / 10", ledger row; limits and clock @m15',
    provisional('the ticket flow is PROPOSED; needs M15-T1 handlers and the M14 hooks'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/cabutan')
      await mock.hook('createDraw', {
        title: 'Cabutan Demo',
        description: 'Cabutan ujian.',
        ticketCostSyiling: 50,
        maxTicketsPerStudent: 10,
        prizePool: [],
        closesAt: '2026-09-30',
        openNow: true,
      })
      await gotoApp('/cabutan')
      await page.getByTestId('draw-buy').click()
      // B-056a: the confirm dialog opens on "Batal"; the ticket is bought only after "Beli Tiket".
      await expect(page.getByTestId('draw-confirm-body')).toHaveText(
        '50 syiling akan ditolak daripada baki anda (256 syiling).',
      )
      await expect(page.getByTestId('draw-confirm-cancel')).toBeFocused()
      await page.getByTestId('draw-confirm-buy').click()
      await expect(page.getByTestId('cabutan-balance')).toHaveText('206')
      await expect(page.getByTestId('draw-owned')).toHaveText('Tiket anda: 1 / 10')
      await expect(page.getByTestId('draw-counter')).toHaveText('1/10')
      const ledger = await mock.hook<{ type: string; description: string; amount: number }[]>(
        'ledger',
        1,
      )
      expect(ledger[0]).toMatchObject({ description: 'Tiket Cabutan: Cabutan Demo' })
      expect(Math.abs(ledger[0]!.amount)).toBe(50)
      await gotoApp('/gamification/mystery-box') // the hooks need a booted page (window.__mock)
      await mock.hook('setWallet', 1, { syiling: 40 })
      await gotoApp('/cabutan')
      await expect(page.getByTestId('draw-buy')).toBeDisabled()
      await gotoApp('/gamification/mystery-box') // the hooks need a booted page (window.__mock)
      await mock.hook('setWallet', 1, { syiling: 1000 })
      await mock.setNow('2026-10-01T08:00:00+08:00')
      await gotoApp('/cabutan')
      await expect(page.getByTestId('cabutan-empty')).toBeVisible()
    },
  )
})

test.describe('M15 student pages: access and 404', MODULE, () => {
  test(
    'SRS §12 #05 guest goes to /login on S5, S6, S7 @m15',
    provisional('guest redirect is INFERRED (FR-M15-07)'),
    async ({ page, gotoApp }) => {
      for (const path of ['/gamification/rewards', '/gamification/mystery-box', '/cabutan']) {
        await gotoApp(path)
        await expect(page).toHaveURL(/\/login/)
      }
    },
  )

  test(
    'SRS §12 #07 pelajar opens S5-S7 in the user shell @m15',
    provisional('student access is INFERRED (FR-M15-09)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJAR)
      for (const [path, title] of [
        ['/gamification/rewards', 'Kedai Hadiah'],
        ['/gamification/mystery-box', 'Kotak Misteri'],
        ['/cabutan', 'Cabutan Bertuah'],
      ] as const) {
        await gotoApp(path)
        await expect(page).toHaveURL(new RegExp(path))
        await expectLearnerHeader(page, title)
      }
    },
  )

  test('SRS §12 #08 the probed sub-paths render the global 404 page @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const path of [
      '/gamification/rewards/1',
      '/gamification/rewards/history',
      '/gamification/redemptions',
      '/gamification/mystery-box/1',
      '/gamification/mystery-box/history',
      '/cabutan/1',
      '/cabutan/sejarah',
    ]) {
      await gotoApp(path)
      await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
      await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
        'href',
        '/practice',
      )
    }
  })
})
