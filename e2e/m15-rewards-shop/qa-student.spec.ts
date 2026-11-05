/**
 * QA additions for M15 Session 5 student rows (L36, L40, L27, L43), role Murid.
 * Covers ACs the developer specs do not execute: AC-M15-24.4 (nav entry -> /cikgu/hadiah, sidebar and
 * drawer), AC-M15-18.3 (ticket limit and short balance disable the button), DV-M15-20 (readable
 * disabled box text, >= 4.5:1), hero heading readability on S6/S7/S10/S11 (global h1 colour pitfall).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell, moduleTag } from '../support'

import { contrast, parseRgb, textContrast } from './helpers'

const PELAJAR = 'pelajar@demo.test'
const PELAJAR_ID = 2
const MODULE = { tag: [moduleTag(15)] }

// These tests boot the app up to seven times and one boot may take the 15 s budget of `gotoApp`, so
// the default 30 s only fits an idle machine. A longer limit, not a retry.
test.describe.configure({ timeout: 90_000 })

test.use({ mockInit: { latency: 0 } })

/** Below `lg` the full menu is behind "Lagi" in the bottom tab bar (PembelajaranLayout, 94504f1bc). */
async function openFullMenu(page: Page): Promise<void> {
  if (!isDesktopShell(page)) await page.locator('[data-nav-id="tab-lagi"]').click()
}

async function openNavEntry(page: Page): Promise<void> {
  await openFullMenu(page)
  const link = page.locator('a[href="/cikgu/hadiah"]:visible').first()
  await link.scrollIntoViewIfNeeded()
  await expect(link).toContainText('Kedai Hadiah')
  await expect(link).toContainText('DIGITAL')
  await link.click()
}

test.describe('M15 QA student rows', MODULE, () => {
  test('AC-24.4 nav entry "Kedai Hadiah DIGITAL" opens S10, not the 404 page @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/gamification/rewards')
    await expect(page.getByTestId('shop-empty')).toBeVisible()
    await openNavEntry(page)
    await expect(page).toHaveURL(/\/cikgu\/hadiah$/)
    await expect(page.getByTestId('digital-title')).toHaveText('🎁 Kedai Hadiah Digital')
    await expect(page).toHaveTitle('Kedai Hadiah Digital | PRESTASIPLUS')
  })

  test('AC-24.5 "Kedai Hadiah" (plain) entry still opens S5 with its own copy @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/cikgu/hadiah')
    await expect(page.getByTestId('digital-title')).toBeVisible()
    await openFullMenu(page)
    const link = page.locator('a[href="/gamification/rewards"]:visible').first()
    await link.scrollIntoViewIfNeeded()
    await link.click()
    await expect(page).toHaveURL(/\/gamification\/rewards$/)
    await expect(page.getByTestId('shop-title')).toHaveText('🎁 Kedai Hadiah')
  })

  test('AC-18.3 ticket limit and short balance disable "Beli Tiket" (student) @m15', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/cabutan')
    await mock.hook('createDraw', {
      title: 'Cabutan QA',
      description: 'QA',
      ticketCostSyiling: 50,
      maxTicketsPerStudent: 2,
      prizePool: [],
      closesAt: '2026-12-30',
      openNow: true,
    })
    await mock.hook('setWallet', PELAJAR_ID, { syiling: 1000 })
    await gotoApp('/cabutan')
    const buy = page.getByTestId('draw-buy')
    await expect(page.getByTestId('cabutan-balance')).toHaveText('1000')
    await buy.click()
    await expect(page.getByTestId('draw-owned')).toHaveText('Tiket anda: 1/2')
    await expect(page.getByTestId('cabutan-balance')).toHaveText('950')
    await expect(buy).toBeEnabled()
    await buy.click()
    await expect(page.getByTestId('draw-owned')).toHaveText('Tiket anda: 2/2')
    await expect(page.getByTestId('cabutan-balance')).toHaveText('900')
    await expect(buy).toBeDisabled()
    const ledger = await mock.hook<{ description: string; amount: number }[]>('ledger', PELAJAR_ID)
    expect(ledger.filter((l) => l.description === 'Tiket Cabutan: Cabutan QA')).toHaveLength(2)
    await expectNoHorizontalScroll(page)
  })

  test('AC-18.3 balance below the ticket price disables the button @m15', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/cabutan')
    await mock.hook('createDraw', {
      title: 'Cabutan QA',
      description: 'QA',
      ticketCostSyiling: 50,
      maxTicketsPerStudent: 5,
      prizePool: [],
      closesAt: '2026-12-30',
      openNow: true,
    })
    await mock.hook('setWallet', PELAJAR_ID, { syiling: 40 })
    await gotoApp('/cabutan')
    await expect(page.getByTestId('cabutan-balance')).toHaveText('40')
    await expect(page.getByTestId('draw-buy')).toBeDisabled()
  })

  test('DV-M15-20 disabled mystery box text is readable (>= 4.5:1) for the student @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/gamification/mystery-box')
    for (const id of [1, 2, 3, 4]) {
      const btn = page.getByTestId(`box-${String(id)}-btn`)
      await expect(btn).toBeDisabled()
      const [fg, bg] = await btn.evaluate((el) => {
        const s = getComputedStyle(el)
        return [s.color, s.backgroundColor]
      })
      expect(contrast(parseRgb(fg), parseRgb(bg))).toBeGreaterThanOrEqual(4.5)
    }
  })

  // B06 (79b5fa2dc) replaced the dark hero gradients by plain cards, so the check is readability on
  // whatever the heading sits on, not a fixed colour.
  test('hero headings: S6, S7 on their card and S10, S11 on the page are readable (>= 4.5:1) @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    for (const [path, testId] of [
      ['/gamification/mystery-box', 'box-title'],
      ['/cabutan', 'cabutan-title'],
      ['/cikgu/hadiah', 'digital-title'],
      ['/cikgu/hadiah/saya', 'redemptions-title'],
    ] as const) {
      await gotoApp(path)
      const heading = page.getByTestId(testId)
      await expect(heading).toBeVisible()
      expect(await textContrast(heading)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
