/**
 * M14 student screens S11 `/gamification`, S12 `/gamification/convert`, S13 `/gamification/challenges` and
 * S17 `/gamification/history` at 375 / 768 / 1280 (M14-T2a; SRS M14 §12: E2E-M14-03 / 04 (these four
 * screens), 05, 08 (S17 part), 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 29, 94 (these four
 * routes), 95 (S11, S13), 96 (S11 "Lihat semua →")).
 *
 * Deferred, not covered here: E2E-M14-28 (needs the `gamificationSession` scenario) and E2E-M14-30 (needs the
 * admin S3 challenge screen). E2E-M14-25 (direct #6 call) is not here: a raw page fetch bypasses the in-process mock; it is covered by
 * the S12 page unit test (422 message) and the M14 handler tests.
 *
 * Needs the M14 mock handlers #2-#43 (built in a separate worktree) and the M14 seeds; it cannot run before
 * they are merged. Observed values (admin: 256 syiling, Gangsa, Level 2, 14 ledger rows) are asserted
 * plainly; student values, POST results, the completed-card style and the guards are INFERRED / PROPOSED
 * and tagged `@provisional`.
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
} from '../support'

const ADMIN = 'admin@demo.test'
const STUDENT_2 = 'pelajar2@demo.test'
const MODULE = { tag: [moduleTag(14)] }

test.use({ mockInit: { latency: 0 } })

const S11 = '/gamification'
const S12 = '/gamification/convert'
const S13 = '/gamification/challenges'
const S17 = '/gamification/history'

const SUBTITLE = 'Selamat datang kembali'

async function expectHeader(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(SUBTITLE)
}

const text = (page: Page, id: string) => page.getByTestId(id)

/** DV-M14-15: bronze keeps its live colour; gold, silver and platinum label text is slate-800. */
async function expectTierLabelColours(tiers: Locator): Promise<void> {
  const label = (i: number) => tiers.nth(i).locator('p.font-semibold').first()
  await expect(label(0)).toHaveCSS('color', 'rgb(205, 127, 50)')
  for (const i of [1, 2, 3]) await expect(label(i)).toHaveCSS('color', 'rgb(30, 41, 59)')
}

test.describe('S11 / S12 / S13 / S17 headers and titles', MODULE, () => {
  const cases = [
    { path: S11, tab: 'Gamifikasi Dashboard', header: 'Gamifikasi Dashboard', ready: 's11-hero' },
    { path: S12, tab: 'Tukar Token', header: 'Tukar Syiling → Token', ready: 's12-hero' },
    { path: S13, tab: 'Cabaran Harian', header: 'Cabaran Harian', ready: 's13-hero' },
    { path: S17, tab: 'Sejarah Transaksi', header: 'Sejarah Transaksi', ready: 's17-list' },
  ] as const
  test('E2E-M14-03 shell header title and subtitle on S11, S12, S13 and S17', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.slow() // several app boots in one test
    await loginAs(ADMIN)
    for (const c of cases) {
      await gotoApp(c.path)
      await expect(text(page, c.ready)).toBeVisible()
      await expectHeader(page, c.header)
    }
  })

  test('E2E-M14-04 tab titles and the user shell on S11, S12, S13 and S17', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.slow() // several app boots in one test
    await loginAs(ADMIN)
    for (const c of cases) {
      await gotoApp(c.path)
      await expect(text(page, c.ready)).toBeVisible()
      await expectTabTitle(page, c.tab)
      await expect(page.getByTestId('shell-user-title')).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })
})

test.describe('S11 dashboard', MODULE, () => {
  test('E2E-M14-15 hero, progress and button targets', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S11)
    await expect(text(page, 's11-tier-icon')).toHaveText('🥉')
    await expect(text(page, 's11-title-chip')).toHaveText('📚 Permulaan')
    await expect(text(page, 's11-tier-name')).toHaveText('Gangsa Tier')
    await expect(text(page, 's11-level')).toHaveText('Level 2')
    await expect(text(page, 's11-hero-syiling')).toHaveText('256')
    await expect(text(page, 's11-hero-token')).toHaveText('0')
    await expect(text(page, 's11-next-tier')).toContainText('Naik ke Perak')
    await expect(text(page, 's11-next-pct')).toHaveText('51.2%')
    await expect(text(page, 's11-next-need')).toHaveText('Perlu 244 syiling lagi')
    await expect(text(page, 's11-btn-convert')).toHaveAttribute('href', S12)
    await expect(text(page, 's11-btn-challenges')).toHaveAttribute('href', S13)
    await expect(text(page, 's11-btn-rewards')).toHaveAttribute('href', '/gamification/rewards')
    await expectTouchTarget(text(page, 's11-btn-convert'))
    // The white hero heading must stay white (global h1 colour rule).
    await expect(text(page, 's11-tier-name')).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M14-16 stat cards at the project clock', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S11)
    await expect(text(page, 's11-stat-syiling')).toHaveText('256')
    await expect(text(page, 's11-stat-today')).toHaveText('+0 hari ini')
    await expect(text(page, 's11-stat-token')).toHaveText('0')
    await expect(text(page, 's11-stat-rate')).toHaveText('50 syiling = 1 token')
    await expect(text(page, 's11-stat-level')).toHaveText('2')
    await expect(text(page, 's11-stat-xp')).toHaveText('8/110 XP')
    await expect(text(page, 's11-xp-bar')).toHaveAttribute('style', /width:\s*7%/)
    await expect(text(page, 's11-stat-total')).toHaveText('256')
    await expect(text(page, 's11-stat-week')).toHaveText('+0 minggu ini')
  })

  test(
    'E2E-M14-17 student stat cards (+198 hari ini / +370 minggu ini)',
    provisional('FN-M14-2.1.5 earned sums are INFERRED (BR-M14-07)', [moduleTag(14)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(2)
      await gotoApp(S11)
      await expect(text(page, 's11-stat-syiling')).toHaveText('370')
      await expect(text(page, 's11-stat-today')).toHaveText('+198 hari ini')
      await expect(text(page, 's11-stat-total')).toHaveText('370')
      await expect(text(page, 's11-stat-week')).toHaveText('+370 minggu ini')
    },
  )

  test('E2E-M14-18 challenges and recent transactions', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp(S11)
    const cards = page.getByTestId('s11-challenge')
    await expect(cards).toHaveCount(4)
    await expect(cards.nth(0)).toContainText('Rajin Berlatih')
    await expect(cards.nth(0)).toContainText('Selesaikan 3 kuiz hari ini')
    await expect(cards.nth(0).getByTestId('s11-challenge-progress')).toHaveText('0/3')
    await expect(cards.nth(0).getByTestId('s11-challenge-reward')).toHaveText('+15 💰')
    await expect(cards.nth(0).getByTestId('s11-challenge-difficulty')).toHaveCSS(
      'text-transform',
      'uppercase',
    )
    await expect(cards.nth(1)).toContainText('Si Tepat')
    await expect(cards.nth(2)).toContainText('Penjelajah Topik')
    await expect(cards.nth(3)).toContainText('Kilat Matematik')
    const rows = page.getByTestId('s11-recent-row')
    await expect(rows).toHaveCount(6)
    const expected = [
      ['Cabaran selesai: Penjelajah Topik', '+25'],
      ['Streak activity (spm)', '+7'],
      ['SPM Tahun Lepas: 1 betul — 20%', '+3'],
      ['Cabaran selesai: Cabaran Kilat', '+40'],
      ['Cabaran selesai: Rajin Berlatih', '+15'],
      ['Latih Tubi SPM: 11 betul — 32.35%', '+22'],
    ]
    for (const [i, [desc, amount]] of expected.entries()) {
      await expect(rows.nth(i)).toContainText(desc!)
      await expect(rows.nth(i)).toContainText(amount!)
      await expect(rows.nth(i)).toContainText('💰')
      await expect(rows.nth(i)).toContainText('4 bulan yang lepas')
    }
    await text(page, 's11-challenges-all').click()
    await expect(page).toHaveURL(new RegExp(`${S13}$`))
    await gotoApp(S11)
    await text(page, 's11-recent-all').click()
    await expect(page).toHaveURL(new RegExp(`${S17}$`))
  })

  test('E2E-M14-19 mastery, tier system, next title and share card', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S11)
    const mastery = page.getByTestId('s11-mastery-row')
    await expect(mastery).toHaveCount(2)
    await expect(mastery.nth(0)).toContainText('L2')
    await expect(mastery.nth(0)).toContainText('Bahasa Melayu')
    await expect(mastery.nth(0)).toContainText('Aktif')
    await expect(mastery.nth(0)).toContainText('46 betul / 50')
    await expect(mastery.nth(0)).toContainText('48.94% tepat · 1.05x bonus')
    await expect(mastery.nth(1)).toContainText('L1')
    await expect(mastery.nth(1)).toContainText('Sejarah')
    await expect(mastery.nth(1)).toContainText('Mula Belajar')
    await expect(mastery.nth(1)).toContainText('14 betul / 25')
    await expect(mastery.nth(1)).toContainText('35% tepat')
    const tiers = page.getByTestId('s11-tier')
    await expect(tiers).toHaveCount(4)
    await expect(tiers.nth(0)).toContainText('Gangsa')
    await expect(tiers.nth(0)).toContainText('0+ syiling')
    await expect(tiers.nth(0)).toContainText('50 syiling = 1 token')
    await expect(tiers.nth(0)).toContainText('✨ ANDA DI SINI')
    await expect(tiers.nth(2)).toContainText('2,000+ syiling')
    await expect(tiers.nth(3)).toContainText('20 syiling = 1 token')
    await expect(page.getByTestId('s11-tier-mine')).toHaveCount(1)
    await expectTierLabelColours(tiers)
    await expect(text(page, 's11-next-title')).toContainText('Pelajar')
    await expect(text(page, 's11-next-title-need')).toHaveText(
      'Perlu 44 syiling lagi untuk gelaran ini',
    )
    await expect(text(page, 's11-share-link')).toContainText('Kongsi pencapaian anda di WhatsApp!')
    await expect(text(page, 's11-share-link')).toHaveAttribute('href', '/gamification/kad-kongsi')
  })

  test('E2E-M14-13 pelajar2 with no wallet row reads the defaults', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(STUDENT_2)
    await gotoApp(S11)
    await expect(text(page, 's11-hero-syiling')).toHaveText('0')
    await expect(text(page, 's11-hero-token')).toHaveText('0')
    await expect(text(page, 's11-level')).toHaveText('Level 1')
    await expect(text(page, 's11-tier-name')).toHaveText('Gangsa Tier')
    await expect(text(page, 's11-title-chip')).toHaveText('📚 Permulaan')
    await expect(text(page, 's11-next-need')).toHaveText('Perlu 500 syiling lagi')
  })

  test('E2E-M14-95 no visible text under 12px (S11 and S13)', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const [path, ready, prefix] of [
      [S11, 's11-hero', 's11-'],
      [S13, 's13-hero', 's13-'],
    ] as const) {
      await gotoApp(path)
      await expect(text(page, ready)).toBeVisible()
      const small = await page.evaluate((pfx) => {
        const bad: string[] = []
        for (const el of document.querySelectorAll(
          `[data-testid^="${pfx}"], [data-testid^="${pfx}"] *`,
        )) {
          const own = Array.from(el.childNodes).some(
            (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
          )
          if (!own) continue
          const size = parseFloat(getComputedStyle(el).fontSize)
          if (size < 12) bad.push(`${el.tagName}: ${size}`)
        }
        return bad
      }, prefix)
      expect(small).toEqual([])
    }
  })
})

test.describe('S12 convert', MODULE, () => {
  test('E2E-M14-22 render, quick buttons, tier grid and tip', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S12)
    await expect(text(page, 's12-hero')).toContainText(
      'Tukar syiling anda kepada token untuk tebus hadiah',
    )
    await expect(text(page, 's12-balance-syiling')).toHaveText('256')
    await expect(text(page, 's12-balance-token')).toHaveText('0')
    const input = text(page, 's12-input')
    await expect(input).toHaveValue('50')
    await expect(input).toHaveAttribute('min', '50')
    await expect(input).toHaveAttribute('max', '256')
    await expect(input).toHaveAttribute('placeholder', '0')
    await expect(text(page, 's12-preview-tokens')).toHaveText('1')
    await expect(text(page, 's12-rate-line')).toHaveText('Kadar: 50 syiling = 1 token (Gangsa)')
    await text(page, 's12-quick-five').click()
    await expect(input).toHaveValue('250')
    await expect(text(page, 's12-preview-tokens')).toHaveText('5')
    await expect(text(page, 's12-quick-five')).toHaveClass(/bg-amber-500/)
    await text(page, 's12-quick-all').click()
    await expect(input).toHaveValue('256')
    await expect(text(page, 's12-preview-tokens')).toHaveText('5')
    await expect(text(page, 's12-quick-all')).toHaveText('Semua (256)')
    const tiers = page.getByTestId('s12-tier')
    await expect(tiers).toHaveCount(4)
    await expect(tiers.nth(0)).toContainText('ANDA')
    await expect(page.getByTestId('s12-tier-mine')).toHaveCount(1)
    await expectTierLabelColours(tiers)
    await expect(tiers.nth(1)).toContainText('500+ syiling')
    await expect(tiers.nth(1)).toContainText('40')
    await expect(tiers.nth(1)).toContainText('syiling/token')
    await expect(text(page, 's12-tip')).toContainText(
      'Naik tier untuk dapatkan kadar penukaran yang lebih baik!',
    )
    await expectTouchTarget(text(page, 's12-quick-rate'))
    await expectTouchTarget(text(page, 's12-submit'))
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M14-23 the button is disabled below the rate and above the balance', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S12)
    const input = text(page, 's12-input')
    await input.fill('30')
    await expect(text(page, 's12-preview-tokens')).toHaveText('0')
    await expect(text(page, 's12-submit')).toBeDisabled()
    await input.fill('300')
    await expect(text(page, 's12-preview-tokens')).toHaveText('6')
    await expect(text(page, 's12-submit')).toBeDisabled()
    await input.fill('50')
    await expect(text(page, 's12-submit')).toBeEnabled()
  })

  test(
    'E2E-M14-24 convert 250: S12, S11 and S17 agree',
    provisional('FN-M14-3.1.8 effect INFERRED; success copy and 🔄 icon PROPOSED', [moduleTag(14)]),
    async ({ page, gotoApp, loginAs }) => {
      test.slow() // several app boots in one test
      await loginAs(ADMIN)
      await gotoApp(S12)
      await text(page, 's12-quick-five').click()
      await text(page, 's12-submit').click()
      await expect(page.getByText('Berjaya! 250 syiling ditukar kepada 5 token.')).toBeVisible()
      await expect(text(page, 's12-balance-syiling')).toHaveText('6')
      await expect(text(page, 's12-balance-token')).toHaveText('5')
      await gotoApp(S11)
      await expect(text(page, 's11-hero-syiling')).toHaveText('6')
      await expect(text(page, 's11-hero-token')).toHaveText('5')
      await expect(text(page, 's11-stat-today')).toHaveText('+0 hari ini')
      await expect(text(page, 's11-stat-total')).toHaveText('256')
      await expect(text(page, 's11-tier-name')).toHaveText('Gangsa Tier')
      await gotoApp(`${S17}?type=convert`)
      const rows = page.getByTestId('s17-row')
      await expect(rows).toHaveCount(1)
      await expect(rows.first().getByTestId('s17-row-icon')).toHaveText('🔄')
      await expect(rows.first().getByTestId('s17-row-desc')).toHaveText(
        'Tukar 250 syiling → 5 token',
      )
      await expect(rows.first().getByTestId('s17-row-amount')).toHaveText('−250')
      await expect(rows.first().getByTestId('s17-row-balance')).toHaveText('Baki: 6')
    },
  )
})

test.describe('S13 challenges', MODULE, () => {
  test('E2E-M14-26 admin: 0/10 Selesai and ten cards in order', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S13)
    await expect(text(page, 's13-hero').locator('h1')).toHaveText('Cabaran Harian')
    await expect(text(page, 's13-hero')).toContainText(
      'Selesaikan cabaran untuk dapatkan syiling & XP bonus!',
    )
    await expect(text(page, 's13-counter-value')).toHaveText('0/10')
    await expect(text(page, 's13-counter')).toContainText('Selesai')
    await expect(text(page, 's13-hero').locator('h1')).toHaveCSS('color', 'rgb(255, 255, 255)')
    const cards = page.getByTestId('s13-card')
    await expect(cards).toHaveCount(10)
    const titles = [
      'Rajin Berlatih',
      'Si Tepat',
      'Penjelajah Topik',
      'Kilat Matematik',
      'Mula Hari Ini',
      'Jawab 5 Betul',
      'Latihan 10 Minit',
      'Kombo 2 Hari',
      'Ketepatan 90%',
      'Cabaran Kilat',
    ]
    for (const [i, title] of titles.entries()) {
      await expect(cards.nth(i).getByTestId('s13-title')).toContainText(title)
      await expect(cards.nth(i).getByTestId('s13-progress')).toContainText('Progres: 0/')
      await expect(cards.nth(i).getByTestId('s13-pct')).toHaveText('0%')
      await expect(cards.nth(i).getByTestId('s13-reward-syiling')).toContainText('Syiling')
      await expect(cards.nth(i).getByTestId('s13-reward-xp')).toContainText('XP')
    }
    await expect(cards.nth(0).getByTestId('s13-reward-syiling')).toHaveText('💰 +15 Syiling')
    await expect(cards.nth(0).getByTestId('s13-reward-xp')).toHaveText('⭐ +10 XP')
    await expect(cards.nth(0).getByTestId('s13-progress')).toHaveText('Progres: 0/3')
    await expect(cards.nth(1).getByTestId('s13-progress')).toHaveText('Progres: 0/80')
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M14-27 student at the project clock: 7/10 Selesai',
    provisional('FN-M14-4.2.1 progress is INFERRED; completed styling PROPOSED', [moduleTag(14)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(2)
      await gotoApp(S13)
      await expect(text(page, 's13-counter-value')).toHaveText('7/10')
      const byTitle = (t: string) => page.getByTestId('s13-card').filter({ hasText: t })
      await expect(byTitle('Si Tepat').getByTestId('s13-progress')).toHaveText('Progres: 80/80')
      await expect(byTitle('Si Tepat').getByTestId('s13-pct')).toHaveText('100%')
      await expect(byTitle('Si Tepat')).toHaveAttribute('data-completed', 'true')
      await expect(byTitle('Kombo 2 Hari').getByTestId('s13-progress')).toHaveText('Progres: 2/2')
      await expect(byTitle('Cabaran Kilat').getByTestId('s13-progress')).toHaveText(
        'Progres: 20/20',
      )
      await expect(byTitle('Rajin Berlatih').getByTestId('s13-progress')).toHaveText('Progres: 1/3')
      await expect(byTitle('Rajin Berlatih').getByTestId('s13-pct')).toHaveText('33%')
      await expect(byTitle('Ketepatan 90%').getByTestId('s13-progress')).toHaveText(
        'Progres: 85/90',
      )
    },
  )

  test(
    'E2E-M14-29 progress restarts after midnight',
    provisional('FN-M14-4.2.3 reset is INFERRED', [moduleTag(14)]),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(2)
      await gotoApp(S13)
      await expect(text(page, 's13-counter-value')).toHaveText('7/10')
      await mock.advanceTime(8.5 * 3_600_000 + 25 * 60_000) // 15:40 -> 00:05 next day
      await gotoApp(S13)
      await expect(text(page, 's13-counter-value')).toHaveText('0/10')
      for (const p of await page.getByTestId('s13-pct').all()) await expect(p).toHaveText('0%')
    },
  )
})

test.describe('S17 history', MODULE, () => {
  test('E2E-M14-20 admin: header, 14 rows with the balance chain, no pager', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S17)
    await expect(
      page.getByRole('heading', { level: 1, name: '📋 Sejarah Transaksi' }),
    ).toBeVisible()
    await expect(text(page, 's17-balance')).toHaveText('Baki semasa: 256 syiling')
    await expect(text(page, 's17-back')).toHaveText('← Dashboard')
    await expect(text(page, 's17-back')).toHaveAttribute('href', S11)
    const rows = page.getByTestId('s17-row')
    await expect(rows).toHaveCount(14)
    await expect(rows.first().getByTestId('s17-row-desc')).toHaveText(
      'Cabaran selesai: Penjelajah Topik',
    )
    await expect(rows.first().getByTestId('s17-row-time')).toHaveText(
      '19/05/2026 03:26 · 4 bulan yang lepas',
    )
    await expect(rows.first().getByTestId('s17-row-amount')).toHaveText('+25')
    await expect(rows.first().getByTestId('s17-row-balance')).toHaveText('Baki: 256')
    await expect(rows.last().getByTestId('s17-row-desc')).toHaveText(
      'Cabaran Kilat: 3 betul, combo 2x',
    )
    await expect(rows.last().getByTestId('s17-row-time')).toHaveText(
      '11/02/2026 05:23 · 7 bulan yang lepas',
    )
    await expect(rows.last().getByTestId('s17-row-amount')).toHaveText('+4')
    await expect(rows.last().getByTestId('s17-row-balance')).toHaveText('Baki: 4')
    await expect(page.locator('nav[aria-label="pagination"]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M14-21 pills: Dapat keeps 14 rows, the others show the empty state', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S17)
    const pills = page.getByTestId('s17-pill')
    await expect(pills).toHaveText(['Semua', '💰 Dapat', '🛍️ Belanja', '🔄 Tukar', '🎁 Bonus'])
    await expectTouchTarget(pills.nth(1))
    await pills.nth(1).click()
    await expect(page).toHaveURL(/\?type=earn$/)
    await expect(page.getByTestId('s17-row')).toHaveCount(14)
    await expect(pills.nth(1)).toHaveAttribute('data-active', 'true')
    for (const [i, type] of [
      [2, 'spend'],
      [3, 'convert'],
      [4, 'bonus'],
    ] as const) {
      await pills.nth(i).click()
      await expect(page).toHaveURL(new RegExp(`\\?type=${type}$`))
      await expect(text(page, 's17-empty')).toContainText('📋')
      await expect(text(page, 's17-empty')).toContainText('Belum ada transaksi')
      await expect(text(page, 's17-empty')).toContainText('Mula latih tubi untuk dapatkan syiling!')
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M14-08 an unknown ?type= renders the empty state', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S17}?type=zzz`)
    await expect(text(page, 's17-empty')).toContainText('Belum ada transaksi')
    await expect(page.getByTestId('s17-row')).toHaveCount(0)
  })
})

test.describe('Access and responsive sweep', MODULE, () => {
  test(
    'E2E-M14-05 a guest is sent to /login from S11 and S12',
    provisional('guard behaviour INFERRED (FN-M14-1.2.1)', [moduleTag(14)]),
    async ({ page, gotoApp }) => {
      await gotoApp(S11)
      await expect(page).toHaveURL(/\/login/)
      await gotoApp(S12)
      await expect(page).toHaveURL(/\/login/)
    },
  )

  test('E2E-M14-94 S11, S12, S13 and S17 have no horizontal page scroll', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.slow() // several app boots in one test
    await loginAs(ADMIN)
    for (const path of [S11, S12, S13, S17]) {
      await gotoApp(path)
      await expect(page.getByTestId('shell-user-title')).toBeVisible()
      await expect(page.locator('main h1, main h2').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })

  test('E2E-M14-96 "Lihat semua →" and "Semua →" have a 44px hit area (S11)', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S11)
    await expectTouchTarget(text(page, 's11-challenges-all'))
    await expectTouchTarget(text(page, 's11-recent-all'))
  })
})
