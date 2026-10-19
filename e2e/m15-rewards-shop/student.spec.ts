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
  isDesktopShell,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(15)] }
const SUBTITLE = 'Selamat datang kembali'

test.use({ mockInit: { latency: 0 } })

async function expectHeader(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(SUBTITLE)
}

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
    await expectTabTitle(page, 'Kedai Hadiah')
    await expectHeader(page, 'Kedai Hadiah')
    const h1 = page.getByTestId('shop-title')
    await expect(h1).toHaveText('🎁 Kedai Hadiah')
    await expect(page.getByText('Tebus token anda untuk hadiah menarik!')).toBeVisible()
    await expect(page.getByTestId('shop-balance-value')).toHaveText('0')
    await expect(page.getByTestId('shop-balance')).toContainText('Baki Token 🎫')
    const empty = page.getByTestId('shop-empty')
    await expect(empty.getByRole('heading', { name: 'Tiada Hadiah Tersedia' })).toBeVisible()
    await expect(empty).toContainText('Hadiah akan ditambah tidak lama lagi. Tunggu ya!')
    // h1: 14px below 640, 24px from 640 (FN-M15-5.1.1).
    const size = await h1.evaluate((el) => getComputedStyle(el).fontSize)
    expect(size).toBe(viewportWidth(page) < 640 ? '14px' : '24px')
    expect(await h1.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)')
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
  const BOXES = [
    { id: 1, name: 'Kotak Gangsa', cost: 2, coins: '1-20', xp: '1-10', ribbon: null },
    { id: 2, name: 'Kotak Perak', cost: 5, coins: '10-50', xp: '5-25', ribbon: 'RARE' },
    { id: 3, name: 'Kotak Emas', cost: 10, coins: '25-150', xp: '10-50', ribbon: 'EPIC' },
    { id: 4, name: 'Kotak Legenda', cost: 25, coins: '100-500', xp: '25-100', ribbon: 'LEGENDARY' },
  ]

  test('SRS §12 #43 admin: hero, chip, four locked boxes, nothing sent on click @m15', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/gamification/mystery-box')
    await expectTabTitle(page, 'Kotak Misteri — PRESTASIPLUS')
    await expectHeader(page, 'Kotak Misteri')
    await expect(page.getByTestId('box-title')).toHaveText('📦 Kotak Misteri')
    await expect(
      page.getByText('Buka kotak & menang ganjaran rawak — nasib baik menanti!'),
    ).toBeVisible()
    await expect(page.getByTestId('box-chip')).toHaveText('🎫 Token Anda: 0')
    await expect(page.getByTestId('box-grid').locator('form')).toHaveCount(4)
    for (const b of BOXES) {
      const card = page.getByTestId(`box-${String(b.id)}`)
      await expect(card).toContainText(b.name)
      await expect(card).toContainText(`${String(b.cost)} Token`)
      await expect(card).toContainText(b.coins)
      await expect(card).toContainText(`${b.xp} XP`)
      if (b.ribbon) {
        const ribbon = page.getByTestId(`box-${String(b.id)}-ribbon`)
        await expect(ribbon).toBeVisible()
        expect(await ribbon.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')
      } else {
        await expect(page.getByTestId(`box-${String(b.id)}-ribbon`)).toHaveCount(0)
      }
      const btn = page.getByTestId(`box-${String(b.id)}-btn`)
      await expect(btn).toBeDisabled()
      await expect(btn).toHaveText('🔒 Token Tidak Cukup')
      expect(await btn.evaluate((el) => getComputedStyle(el).cursor)).toBe('not-allowed')
    }
    await page.getByTestId('box-1').click({ force: true })
    expect(await mock.lastRequest('/api/gamification/mystery-boxes/*/open')).toBeNull()
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #54 S6 grid is 1 / 3 / 4 columns, no horizontal scroll, text >= 12px @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/gamification/mystery-box')
    await expect(page.getByTestId('box-1')).toBeVisible()
    const tops = await page
      .getByTestId('box-grid')
      .locator('form')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
    const firstRow = tops.filter((t) => t === tops[0]).length
    const width = viewportWidth(page)
    expect(firstRow).toBe(width < 640 ? 1 : isDesktopShell(page) ? 4 : 3)
    await expectNoHorizontalScroll(page)
    expect(await minTextSize(page)).toBeGreaterThanOrEqual(12)
  })

  test(
    'SRS §12 #44 5 tokens: boxes 1-2 open, 3-4 locked; 25 tokens: all open @m15',
    provisional('the enabled state and "Buka Kotak" are PROPOSED; needs the M14 hook setWallet'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/gamification/mystery-box')
      await mock.hook('setWallet', 1, { tokens: 5 })
      await gotoApp('/gamification/mystery-box')
      await expect(page.getByTestId('box-1-btn')).toHaveText('Buka Kotak')
      await expect(page.getByTestId('box-2-btn')).toHaveText('Buka Kotak')
      await expect(page.getByTestId('box-3-btn')).toHaveText('🔒 Token Tidak Cukup')
      await expect(page.getByTestId('box-4-btn')).toBeDisabled()
      await mock.hook('setWallet', 1, { tokens: 25 })
      await gotoApp('/gamification/mystery-box')
      for (const id of [1, 2, 3, 4]) {
        await expect(page.getByTestId(`box-${String(id)}-btn`)).toBeEnabled()
        await expectTouchTarget(page.getByTestId(`box-${String(id)}-btn`))
      }
    },
  )

  test(
    'SRS §12 #45 open box 1: result modal, chip 3, wallet and ledger @m15',
    provisional('the opening flow is PROPOSED; needs M15-T1 handlers and M14 hooks'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/gamification/mystery-box')
      await mock.hook('setWallet', 1, { tokens: 5 })
      await gotoApp('/gamification/mystery-box')
      // The next-result override lives in the page, so it is set after the reload.
      await mock.hook('m15MysteryNext', { coins: 12, xp: 4 })
      await page.getByTestId('box-1-btn').click()
      const modal = page.getByTestId('box-result')
      await expect(modal).toBeVisible()
      await expect(page.getByTestId('box-result-icon')).toHaveText('📦')
      await expect(page.getByTestId('box-result-name')).toHaveText('Kotak Gangsa')
      await expect(page.getByTestId('box-result-reward')).toHaveText('+12 🪙 · +4 XP')
      const box = await modal.boundingBox()
      const width = viewportWidth(page)
      if (width < 768) {
        expect(box!.width).toBeGreaterThanOrEqual(width - 1)
        expect(box!.height).toBeGreaterThanOrEqual(812 - 1)
      } else {
        expect(Math.round(box!.width)).toBe(400)
      }
      await expect(page.getByTestId('box-chip')).toHaveText('🎫 Token Anda: 3')
      await expectNoHorizontalScroll(page)
      const wallet = await mock.hook<{ currentSyiling: number; tokenBalance: number; xp: number }>(
        'getWallet',
        1,
      )
      expect([wallet.currentSyiling, wallet.tokenBalance, wallet.xp]).toEqual([268, 3, 12])
      const ledger = await mock.hook<{ description: string; amount: number }[]>('ledger', 1)
      expect(ledger[0]).toMatchObject({ description: 'Kotak Misteri: Kotak Gangsa', amount: 12 })
      await page.getByTestId('box-result-close').click()
      await expect(modal).toHaveCount(0)
      await gotoApp('/cabutan')
      await expect(page.getByTestId('cabutan-balance')).toHaveText('268 🪙')
    },
  )

  test(
    'SRS §12 #46 history card after an opening, none without @m15',
    provisional('the history card is PROPOSED; needs M15-T1 handlers and M14 hooks'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/gamification/mystery-box')
      await expect(page.getByTestId('box-history')).toHaveCount(0)
      await mock.hook('setWallet', 1, { tokens: 5 })
      await gotoApp('/gamification/mystery-box')
      // The next-result override lives in the page, so it is set after the reload.
      await mock.hook('m15MysteryNext', { coins: 12, xp: 4 })
      await page.getByTestId('box-1-btn').click()
      await page.getByTestId('box-result-close').click()
      await gotoApp('/gamification/mystery-box')
      await expect(page.getByText('Sejarah Kotak Misteri')).toBeVisible()
      const row = page.getByTestId('box-history-row').first()
      await expect(row).toContainText('Kotak Misteri: Kotak Gangsa')
      await expect(row).toContainText('+12 🪙 · +4 XP')
      await expect(row).toContainText('25/09 15:40')
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M15 S7 Cabutan Bertuah', MODULE, () => {
  test('SRS §12 #47 admin: header, tile "256 🪙", "Cabutan Dibuka" and the empty box @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cabutan')
    await expectTabTitle(page, 'Cabutan Bertuah - PRESTASIPLUS')
    await expectHeader(page, 'Cabutan Bertuah')
    await expect(page.getByTestId('cabutan-title')).toHaveText('🎟️ Cabutan Bertuah')
    await expect(
      page.getByText('Guna syiling untuk beli tiket & menangi hadiah hebat!'),
    ).toBeVisible()
    await expect(page.getByTestId('cabutan-tile')).toContainText('Syiling anda')
    expect(
      await page
        .getByTestId('cabutan-tile')
        .getByText('Syiling anda')
        .evaluate((el) => getComputedStyle(el).textTransform),
    ).toBe('uppercase')
    await expect(page.getByTestId('cabutan-balance')).toHaveText('256 🪙')
    await expect(page.getByRole('heading', { name: 'Cabutan Dibuka' })).toBeVisible()
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
      await expect(card.getByTestId('draw-price')).toHaveText('Harga tiket: 50 🪙')
      await expect(card.getByTestId('draw-owned')).toHaveText('Tiket anda: 0/10')
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
    'SRS §12 #49 buy a ticket: tile 206, "Tiket anda: 1/10", ledger row; limits and clock @m15',
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
      await expect(page.getByTestId('cabutan-balance')).toHaveText('206 🪙')
      await expect(page.getByTestId('draw-owned')).toHaveText('Tiket anda: 1/10')
      const ledger = await mock.hook<{ type: string; description: string; amount: number }[]>(
        'ledger',
        1,
      )
      expect(ledger[0]).toMatchObject({ description: 'Tiket Cabutan: Cabutan Demo' })
      expect(Math.abs(ledger[0]!.amount)).toBe(50)
      await mock.hook('setWallet', 1, { syiling: 40 })
      await gotoApp('/cabutan')
      await expect(page.getByTestId('draw-buy')).toBeDisabled()
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
        await expectHeader(page, title)
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
      await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
      await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
        'href',
        '/practice',
      )
    }
  })
})
