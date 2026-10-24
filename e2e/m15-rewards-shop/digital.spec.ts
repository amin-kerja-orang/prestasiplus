/**
 * M15 S10 `/cikgu/hadiah` and S11 `/cikgu/hadiah/saya` at 375 / 768 / 1280 (M15-T2; SRS M15 v1.6
 * §12 E2E-M15-58..71). Titles carry "SRS §12 #nn" and no E2E ids (developer smoke, as the M10
 * specs). The admin wallet is 256 syiling / 0 tokens, Gangsa tier rate 50 (SRS §6.8, BR-M15-26).
 * Scenarios on unobserved behaviour or needing an M14 hook are `@provisional`; run them once M15-T1
 * (#19, #20) and the M14 hooks are merged.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(15)] }
const SUBTITLE = 'Selamat datang kembali'
const EMPTY = 'Tiada hadiah dalam kategori ini.'
const CHIPS = [
  ['all', '🌟 Semua'],
  ['flagship', '🏆 Mahkota'],
  ['ewallet', '💳 Dompet Digital'],
  ['telco', '📱 Telekomunikasi'],
  ['gaming', '🎮 Permainan'],
  ['streaming', '🎬 Penstriman'],
  ['food_beverage', '🍔 Makan & Minum'],
  ['ecommerce', '🛒 Beli-belah'],
  ['education', '📚 Pembelajaran'],
  ['entertainment', '🎭 Hiburan'],
] as const

test.use({ mockInit: { latency: 0 } })

async function expectHeader(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(SUBTITLE)
}

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

/** The visible (rendered) text of an element, as a reader sees it (CSS upper case applied). */
function visibleText(page: Page, testId: string): Promise<string> {
  return page
    .getByTestId(testId)
    .evaluate((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
}

test.describe('M15 S10 Kedai Hadiah Digital', MODULE, () => {
  test('SRS §12 #59 admin: title, header, balance card with the tier rate, button to S11 @m15', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/hadiah')
    await expectTabTitle(page, 'Kedai Hadiah Digital')
    await expectHeader(page, 'Kedai Hadiah Digital')
    await expect(page.getByTestId('digital-title')).toHaveText('🎁 Kedai Hadiah Digital')
    await expect(
      page.getByText('Tukar token kepada hadiah digital — terus dihantar, tanpa pos.'),
    ).toBeVisible()
    // DOM text is mixed case; the rendered text is upper case.
    await expect(page.getByTestId('digital-token-label')).toHaveText('Token Anda')
    expect(await visibleText(page, 'digital-token-label')).toBe('TOKEN ANDA')
    await expect(page.getByTestId('digital-token')).toHaveText('0')
    await expect(page.getByTestId('digital-syiling-label')).toHaveText('Syiling')
    expect(await visibleText(page, 'digital-syiling-label')).toBe('SYILING')
    await expect(page.getByTestId('digital-syiling')).toHaveText('256')
    await expect(page.getByTestId('digital-caption')).toHaveText('50 syiling = 1 token')
    await expect(page.getByText('100 syiling')).toHaveCount(0)
    const bg = await page
      .getByTestId('digital-card')
      .evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(bg).toContain('gradient')
    expect(await mock.lastRequest('/api/gamification/wallet')).not.toBeNull()
    const btn = page.getByTestId('digital-my-redemptions')
    await expect(btn).toHaveAttribute('href', '/cikgu/hadiah/saya')
    await btn.click()
    await expect(page).toHaveURL(/\/cikgu\/hadiah\/saya$/)
    await expect(page.getByTestId('redemptions-title')).toBeVisible()
  })

  test('SRS §12 #61 default chips: ten labels in order, hrefs, only Semua active, empty line @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/hadiah')
    const chips = page.getByTestId('digital-chips').locator('a')
    await expect(chips).toHaveText(CHIPS.map(([, label]) => label))
    for (const [key, label] of CHIPS) {
      const chip = page.getByTestId(`digital-chip-${key}`)
      await expect(chip).toHaveText(label)
      await expect(chip).toHaveAttribute('href', `/cikgu/hadiah?cat=${key}`)
      await expect(chip).toHaveAttribute('data-active', key === 'all' ? 'true' : 'false')
    }
    await expect(page.getByTestId('digital-empty')).toHaveText(EMPTY)
    await expect(page.getByText('Tebus', { exact: true })).toHaveCount(0)
    await expect(page.locator('main button')).toHaveCount(0)
  })

  test('SRS §12 #62 follow each of the ten chips: URL, title, empty copy, one active chip @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/hadiah')
    for (const [key] of CHIPS) {
      await page.getByTestId(`digital-chip-${key}`).click()
      await expect(page).toHaveURL(new RegExp(`/cikgu/hadiah\\?cat=${key}$`))
      await expectTabTitle(page, 'Kedai Hadiah Digital')
      await expect(page.getByTestId('digital-empty')).toHaveText(EMPTY)
      await expect(page.locator('[data-testid="digital-chips"] a[data-active="true"]')).toHaveCount(
        1,
      )
      await expect(page.getByTestId(`digital-chip-${key}`)).toHaveAttribute('data-active', 'true')
    }
  })

  test('SRS §12 #63 unknown cat: page shown, empty copy, no chip active, #19 activeCat null @m15', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/hadiah?cat=bogus')
    await expect(page.getByTestId('digital-title')).toBeVisible()
    await expect(page.getByTestId('digital-empty')).toHaveText(EMPTY)
    await expect(page.locator('[data-testid="digital-chips"] a[data-active="true"]')).toHaveCount(0)
    const req = await mock.lastRequest('/api/hadiah-digital/items')
    expect(req).not.toBeNull()
    expect(JSON.stringify(req)).toContain('bogus')
  })

  test(
    'SRS §12 #60 student with 20 tokens / 300 syiling: card values and the wallet read @m15',
    provisional('needs the M14 hook setWallet; student view is INFERRED'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/cikgu/hadiah')
      await mock.hook('setWallet', 2, { tokens: 20, syiling: 300 })
      await gotoApp('/cikgu/hadiah')
      await expect(page.getByTestId('digital-token')).toHaveText('20')
      await expect(page.getByTestId('digital-syiling')).toHaveText('300')
      await expect(page.getByTestId('digital-caption')).toHaveText(/^\d+ syiling = 1 token$/)
      expect(await mock.lastRequest('/api/gamification/wallet')).not.toBeNull()
    },
  )

  test(
    'SRS §12 #64 active rewards and queued redemptions never populate S10 / S11 @m15',
    provisional('needs the M15 hooks m15SetReward and m15LoadFixture (M15-T1)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/cikgu/hadiah')
      await mock.hook('m15SetReward', 1, { isActive: true })
      await mock.hook('m15LoadFixture', 'queue')
      await gotoApp('/cikgu/hadiah?cat=gaming')
      await expect(page.getByTestId('digital-empty')).toHaveText(EMPTY)
      await expect(page.locator('main button')).toHaveCount(0)
      await gotoApp('/cikgu/hadiah/saya')
      await expect(page.getByTestId('redemptions-empty')).toContainText('Belum ada tebusan.')
    },
  )

  test(
    'SRS §12 #67 guest goes to /login; student, parent and teacher open both pages @m15',
    provisional('role access is INFERRED (FR-M15-76)'),
    async ({ page, gotoApp }) => {
      for (const path of ['/cikgu/hadiah', '/cikgu/hadiah?cat=gaming', '/cikgu/hadiah/saya']) {
        await gotoApp(path)
        await expect(page).toHaveURL(/\/login/)
      }
    },
  )
})

test.describe('M15 S11 Tebusan Saya', MODULE, () => {
  test('SRS §12 #65 admin: title, header, back button, empty text and link @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/hadiah/saya')
    await expectTabTitle(page, 'Tebusan Saya')
    await expectHeader(page, 'Tebusan Saya')
    await expect(page.getByTestId('redemptions-title')).toHaveText('📋 Tebusan Saya')
    await expect(page.getByTestId('redemptions-to-shop')).toHaveText('🎁 Kedai Hadiah')
    await expect(page.getByTestId('redemptions-to-shop')).toHaveAttribute('href', '/cikgu/hadiah')
    await expect(page.getByTestId('redemptions-icon')).toHaveText('🎁')
    const size = await page
      .getByTestId('redemptions-icon')
      .evaluate((el) => getComputedStyle(el).fontSize)
    expect(size).toBe('48px')
    await expect(page.getByTestId('redemptions-empty')).toContainText(
      'Belum ada tebusan. Kumpul syiling dulu, lepas tukar token dan tebus hadiah.',
    )
    await expect(page.getByTestId('redemptions-browse')).toHaveText('Layari Kedai Hadiah')
    await expect(page.getByTestId('redemptions-browse')).toHaveAttribute('href', '/cikgu/hadiah')
    await expect(page.locator('main table, main select, main li')).toHaveCount(0)
  })

  test('SRS §12 #66 both links lead back to S10 with Semua active @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const id of ['redemptions-to-shop', 'redemptions-browse']) {
      await gotoApp('/cikgu/hadiah/saya')
      await page.getByTestId(id).click()
      await expect(page).toHaveURL(/\/cikgu\/hadiah$/)
      await expect(page.getByTestId('digital-chip-all')).toHaveAttribute('data-active', 'true')
    }
  })

  test('SRS §12 #68 wrong addresses render the global 404 page @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const path of ['/kedai-hadiah', '/hadiah', '/kedai', '/cikgu/hadiah/1']) {
      await gotoApp(path)
      await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
      await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
        'href',
        '/practice',
      )
    }
  })
})

test.describe('M15 S10 / S11 responsive', MODULE, () => {
  test('SRS §12 #70 no horizontal scroll; card full width / natural / beside the title; text >= 12px @m15', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/hadiah')
    await expect(page.getByTestId('digital-empty')).toBeVisible()
    await expectNoHorizontalScroll(page)
    const width = viewportWidth(page)
    const card = (await page.getByTestId('digital-card').boundingBox())!
    const title = (await page.getByTestId('digital-title').boundingBox())!
    const main = (await page.locator('main').boundingBox())!
    if (width < 640) {
      // Full width of the content column.
      expect(card.width).toBeGreaterThan(main.width - 40)
    } else if (!isDesktopShell(page)) {
      // Under the title block, natural width (SRS: 369px).
      expect(card.y).toBeGreaterThan(title.y + title.height - 1)
      expect(card.width).toBeLessThan(main.width - 100)
      expect(card.width).toBeGreaterThan(300)
    } else {
      // Right of the title block, on one row.
      expect(card.x).toBeGreaterThan(title.x + title.width - 1)
      expect(Math.abs(card.y - title.y)).toBeLessThan(60)
    }
    expect(await minTextSize(page)).toBeGreaterThanOrEqual(12)

    await gotoApp('/cikgu/hadiah/saya')
    await expect(page.getByTestId('redemptions-empty')).toBeVisible()
    await expectNoHorizontalScroll(page)
    const h1 = (await page.getByTestId('redemptions-title').boundingBox())!
    const btn = (await page.getByTestId('redemptions-to-shop').boundingBox())!
    expect(btn.x).toBeGreaterThan(h1.x + h1.width - 1)
    expect(Math.abs(btn.y + btn.height / 2 - (h1.y + h1.height / 2))).toBeLessThan(30)
    expect(await minTextSize(page)).toBeGreaterThanOrEqual(12)
  })

  test('SRS §12 #71 failed wallet / items read shows the shared error state, no sideways scroll @m15', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    // Faults live in the page, so each one is armed after the load and hit by a client-side navigation.
    await gotoApp('/cikgu/hadiah/saya')
    await expect(page.getByTestId('redemptions-empty')).toBeVisible()
    await mock.failNext('/api/gamification/wallet', { status: 500 })
    await page.getByTestId('redemptions-to-shop').click()
    await expect(page.getByTestId('m15-load-error')).toContainText(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
    await expectNoHorizontalScroll(page)
    await page.getByTestId('m15-retry').click()
    await expect(page.getByTestId('digital-empty')).toBeVisible()
    await mock.failNext('/api/hadiah-digital/items', { status: 500 })
    await page.getByTestId('digital-chip-gaming').click()
    await expect(page.getByTestId('m15-load-error')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
