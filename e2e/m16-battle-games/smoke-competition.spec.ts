/**
 * M16 S20 `/permainan/pertandingan`, S21 `/permainan/uji-minda`, S22 `/permainan/sambung-kata` at
 * 375 / 768 / 1280 (M16-T6b; SRS M16 v1.6 §12 E2E-M16-72..75, 12, 13). Clock 2026-09-25T15:40+08:00.
 * Scenarios on unobserved behaviour are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, provisional, TAG } from '../support'

const ADMIN = 'admin@demo.test'
const PELAJARMAJU = 'pelajarmaju@demo.test'
const MODULE = { tag: [moduleTag(16)] }
const SUBTITLE = 'Selamat datang kembali'

test.use({ mockInit: { latency: 0 } })

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

test.describe('S20 Pertandingan Mingguan', () => {
  test(
    'E2E-M16-72 header, week, countdown, prizes and own status as admin',
    MODULE,
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/permainan/pertandingan')
      await expectTabTitle(page, 'Pertandingan Mingguan — PRESTASIPLUS')
      await expect(page.getByTestId('shell-user-title')).toHaveText('Pertandingan Mingguan')
      await expect(page.getByTestId('shell-user-subtitle')).toHaveText(SUBTITLE)
      await expect(
        page.getByRole('heading', { level: 1, name: '🏆 Pertandingan Mingguan' }),
      ).toBeVisible()
      await expect(
        page.getByText('Lumba dengan semua pelajar! 3 teratas dapat Syiling bonus.'),
      ).toBeVisible()
      await expect(page.getByTestId('pertandingan-range')).toHaveText('21 Sep — 27 Sep 2026')
      await expect(page.getByTestId('pertandingan-countdown')).toHaveText('2h 8j 19m')

      await mock.advanceTime(60_000)
      await expect(page.getByTestId('pertandingan-countdown')).toHaveText('2h 8j 18m')

      const prizes = page.getByTestId('pertandingan-prize')
      await expect(prizes).toHaveCount(3)
      await expect(prizes.nth(0)).toContainText('Juara')
      await expect(prizes.nth(0)).toContainText('+100 🪙')
      await expect(prizes.nth(1)).toContainText('Naib Juara')
      await expect(prizes.nth(1)).toContainText('+50 🪙')
      await expect(prizes.nth(2)).toContainText('Tempat Ketiga')
      await expect(prizes.nth(2)).toContainText('+25 🪙')
      // Three columns at every width (AC-M16-29.3).
      const xs = await prizes.evaluateAll((els) =>
        els.map((e) => Math.round(e.getBoundingClientRect().top)),
      )
      expect(new Set(xs).size).toBe(1)

      const status = page.getByTestId('pertandingan-status')
      await expect(status).toContainText('📝')
      await expect(status).toContainText('Belum mula lagi minggu ini!')
      await expect(status).toContainText('Buat Latih Tubi untuk masuk kedudukan.')
      await expect(page.getByTestId('pertandingan-start')).toHaveAttribute('href', '/practice')
      await expect(page.getByTestId('m16-back-link')).toHaveAttribute('href', '/permainan')
      await expectNoHorizontalScroll(page)
      expect(await minTextSize(page)).toBeGreaterThanOrEqual(12)
    },
  )

  test(
    'E2E-M16-72 the countdown ends with "Tamat!"',
    MODULE,
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/permainan/pertandingan')
      await expect(page.getByTestId('pertandingan-countdown')).toHaveText('2h 8j 19m')
      await mock.advanceTime(3 * 24 * 3_600_000)
      await expect(page.getByTestId('pertandingan-countdown')).toHaveText('Tamat!')
    },
  )

  test(
    'E2E-M16-73 the 20 ranked users in Q-WEEK-RANK order',
    provisional('Q-WEEK-RANK anchors depend on XR-M16-03 / XR-M16-09', [moduleTag(16)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp('/permainan/pertandingan')
      const rows = page.getByTestId('pertandingan-row')
      await expect(rows).toHaveCount(20)
      await expect(rows.nth(0)).toContainText('🥇')
      await expect(rows.nth(0)).toContainText('23 sesi')
      await expect(rows.nth(0)).toContainText('450')
      await expect(rows.nth(0)).toContainText('99.6%')
      await expect(rows.nth(1)).toContainText('🥈')
      await expect(rows.nth(1)).toContainText('329')
      await expect(rows.nth(2)).toContainText('🥉')
      await expect(rows.nth(2)).toContainText('187')
      await expect(rows.nth(3)).toContainText('145')
      await expect(rows.nth(13)).toContainText('26')
      await expectNoHorizontalScroll(page)
    },
  )

  // Characterisation of the live accuracies of ranks 3 and 4 (AC-M16-29.5), one test per gap. The
  // M05 weekRank seed yields other values, so each is expected to fail until the owner (M05) fixes
  // the seed. The setup (login, navigation, 20 rows, a percentage present in the row) runs BEFORE
  // `test.fail(...)` is called, so a setup failure is a normal failure and never the expected one.
  const KNOWN_GAPS = [
    { id: 'E2E-M16-73b', rank: 3, row: 2, live: '90.7%', seed: '93.5%' },
    { id: 'E2E-M16-73c', rank: 4, row: 3, live: '61.4%', seed: 'a different value' },
  ] as const

  for (const gap of KNOWN_GAPS) {
    test(
      `${gap.id} rank ${String(gap.rank)} shows the live accuracy ${gap.live} (known gap)`,
      {
        tag: [TAG.provisional, moduleTag(16)],
        annotation: {
          type: 'known-gap',
          description: `Known gap DV-M16-38 / XR-M16-10: M05 weekRank seed yields ${gap.seed} vs live ${gap.live} - owner M05`,
        },
      },
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(ADMIN)
        await gotoApp('/permainan/pertandingan')
        const rows = page.getByTestId('pertandingan-row')
        await expect(rows).toHaveCount(20)
        await expect(rows.nth(gap.row)).toContainText(/\d+\.\d%/)
        test.fail(
          true,
          `Known gap DV-M16-38 / XR-M16-10: M05 weekRank seed yields ${gap.seed} vs live ${gap.live}`,
        )
        await expect(rows.nth(gap.row)).toContainText(gap.live, { timeout: 3000 })
      },
    )
  }

  test(
    'E2E-M16-73 pelajarmaju is ranked 14 with the PROPOSED rank line',
    provisional('PROPOSED rank line copy; anchors depend on XR-M16-03', [moduleTag(16)]),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJARMAJU)
      await gotoApp('/permainan/pertandingan')
      await expect(page.getByTestId('pertandingan-my-rank')).toHaveText(
        '📊 Kedudukan kamu: #14 · 26 betul',
      )
      await expect(page.getByTestId('pertandingan-start')).toHaveCount(0)
    },
  )

  test('E2E-M16-08 ?week= is ignored', MODULE, async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan/pertandingan?week=2026-08-31')
    await expect(page.getByTestId('pertandingan-range')).toHaveText('21 Sep — 27 Sep 2026')
  })
})

test.describe('S21 Uji Minda', () => {
  test('E2E-M16-74 the empty state', MODULE, async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan/uji-minda')
    await expectTabTitle(page, 'Uji Minda — Belum Ada Cabaran')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Uji Minda')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(SUBTITLE)
    await expect(
      page.getByTestId('uji-minda-hero').getByRole('heading', { name: 'Uji Minda' }),
    ).toBeVisible()
    await expect(page.getByText('🧠')).toBeVisible()
    await expect(
      page.getByText(
        'Cabaran khas dari ibu/bapa kamu! Tapi ibu/bapa kamu belum tetapkan cabaran lagi.',
      ),
    ).toBeVisible()
    await expect(page.getByText('Bagaimana nak mula?')).toBeVisible()
    await expect(page.getByText('"Cabaran Uji Minda"')).toBeVisible()
    await expect(page.getByText('📋 Apa Ibu/Bapa boleh tetap:')).toBeVisible()
    for (const item of [
      '✅ Bilangan soalan setiap set',
      '✅ Syiling bagi setiap jawapan betul',
      '✅ Hadiah custom (cth: buku, jajan, trip)',
      '✅ Syiling minimum untuk menuntut hadiah',
    ]) {
      await expect(page.getByText(item)).toBeVisible()
    }
    await expect(page.getByTestId('m16-back-link')).toHaveAttribute('href', '/permainan')
    await expectNoHorizontalScroll(page)
    expect(await minTextSize(page)).toBeGreaterThanOrEqual(12)
  })
})

test.describe('S22 Sambung Kata (DV-M16-03)', () => {
  test(
    'E2E-M16-75 the handled 500 page; "Cuba Semula" reloads',
    MODULE,
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp('/permainan/sambung-kata')
      await expect(page.getByText('500', { exact: true })).toBeVisible()
      await expect(page.getByText('⚙️')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: 'Ralat Pelayan' })).toBeVisible()
      await expect(
        page.getByText(
          'Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.',
        ),
      ).toBeVisible()
      await expect(page.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
      await expect(page.getByText('PRESTASIPLUS', { exact: true })).toBeVisible()
      // No shell: no sidebar header.
      await expect(page.getByTestId('shell-user-title')).toHaveCount(0)
      await expectNoHorizontalScroll(page)

      await Promise.all([
        page.waitForEvent('load'),
        page.getByRole('button', { name: 'Cuba Semula' }).click(),
      ])
      await expect(page.getByRole('heading', { level: 1, name: 'Ralat Pelayan' })).toBeVisible({
        timeout: 30_000,
      })
    },
  )
})
