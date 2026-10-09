/**
 * M16 S28 `/sekolah-bersaing` at 375 / 768 / 1280 (M16-T6a, roles-matrix row L50; SRS M16 v1.6 §12
 * E2E-M16-89, 90, AC-M16-38.1..6). Account 8 is the school admin (user shell, DV-M16-02). Clock
 * 2026-09-25T15:40+08:00: the current week is Monday 21 Sep 2026 with 49 rows.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, viewportWidth } from '../support'

const SCHOOL_ADMIN = 'adminsekolah@demo.test'
const ADMIN = 'admin@demo.test'
const STUDENT = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(16)] }

test.use({ mockInit: { latency: 0 } })

test(
  'E2E-M16-89 school admin (account 8): title, hero, 49 rows, medals, footer',
  MODULE,
  async ({ page, gotoApp, loginAs }) => {
    await loginAs(8)
    await gotoApp('/sekolah-bersaing')
    await expectTabTitle(page, 'Sekolah Bersaing — Leaderboard Mingguan')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Sekolah Bersaing')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText('Selamat datang kembali')
    await expect(page.getByRole('heading', { level: 1, name: '🏆 Sekolah Bersaing' })).toBeVisible()
    await expect(
      page.getByText(
        'Leaderboard mingguan — bandingkan sekolah-sekolah di Malaysia. Anda rasa bangga? Kongsi.',
      ),
    ).toBeVisible()
    await expect(page.getByTestId('sb-week')).toHaveText(
      'Minggu 21 Sep 2026 · 49 sekolah dalam pertandingan',
    )

    const rows = page.getByTestId('sb-row')
    await expect(rows).toHaveCount(49)
    await expect(rows.nth(0).getByTestId('sb-rank')).toHaveText('🥇')
    await expect(rows.nth(0)).toHaveClass(/gold/)
    await expect(rows.nth(0).getByTestId('sb-state')).toHaveText('Kelantan')
    await expect(rows.nth(0).getByTestId('sb-aktif')).toContainText('0.0%')
    await expect(rows.nth(1).getByTestId('sb-rank')).toHaveText('🥈')
    await expect(rows.nth(1)).toHaveClass(/silver/)
    await expect(rows.nth(1).getByTestId('sb-state')).toHaveText('Johor')
    await expect(rows.nth(2).getByTestId('sb-rank')).toHaveText('🥉')
    await expect(rows.nth(2)).toHaveClass(/bronze/)
    await expect(rows.nth(2).getByTestId('sb-state')).toHaveText('Sabah')
    // Row #17 and #49 (AC-M16-38.2).
    await expect(rows.nth(16).getByTestId('sb-rank')).toHaveText('#17')
    await expect(rows.nth(16).getByTestId('sb-state')).toHaveText('Selangor')
    await expect(rows.nth(16).getByTestId('sb-aktif')).toContainText('0.5%')
    await expect(rows.nth(48).getByTestId('sb-rank')).toHaveText('#49')
    await expect(rows.nth(48).getByTestId('sb-state')).toHaveText('Selangor')

    const wide = viewportWidth(page) >= 768
    const header = page.getByTestId('sb-header')
    for (const label of ['#', 'Sekolah', '% Aktif']) await expect(header).toContainText(label)
    if (wide) {
      await expect(header).toContainText('Streak Avg')
      await expect(header).toContainText('Nota/Pelajar')
      await expect(rows.nth(0).getByTestId('sb-streak')).toContainText('🔥 15.0')
      await expect(rows.nth(1).getByTestId('sb-streak')).toContainText('🔥 9.3')
      await expect(rows.nth(2).getByTestId('sb-streak')).toContainText('🔥 8.6')
      await expect(rows.nth(16).getByTestId('sb-streak')).toContainText('🔥 1.6')
      await expect(rows.nth(48).getByTestId('sb-streak')).toContainText('🔥 0.0')
    } else {
      await expect(page.getByText('Streak Avg')).toBeHidden()
      await expect(page.getByText('Nota/Pelajar')).toBeHidden()
      await expect(rows.nth(0).getByTestId('sb-streak')).toBeHidden()
      const size = await rows
        .nth(0)
        .getByTestId('sb-aktif')
        .locator('div')
        .nth(1)
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
      expect(size).toBeGreaterThanOrEqual(12)
    }

    const tip = page.getByTestId('sb-tip')
    await expect(tip).toContainText('💡 Untuk Cikgu Besar / PIBG:')
    await expect(tip).toContainText('Share ranking ini ke parent group WhatsApp.')
    await expect(tip).toContainText('Sekolah yang opt-out akan paparkan sebagai "Sekolah anonim".')
    await expectNoHorizontalScroll(page)
  },
)

test(
  'E2E-M16-90 earlier weeks, the empty week and an invalid week',
  MODULE,
  async ({ page, gotoApp, loginAs }) => {
    await loginAs(SCHOOL_ADMIN)
    const rows = page.getByTestId('sb-row')

    await gotoApp('/sekolah-bersaing?week=2026-09-16')
    await expect(page.getByTestId('sb-week')).toHaveText(
      'Minggu 14 Sep 2026 · 48 sekolah dalam pertandingan',
    )
    await expect(rows).toHaveCount(48)
    await expect(rows.nth(17).getByTestId('sb-state')).toHaveText('Kelantan')
    await expect(rows.nth(17).getByTestId('sb-aktif')).toContainText('0.0%')
    await expect(rows.nth(19).getByTestId('sb-state')).toHaveText('Kuala Lumpur')

    await gotoApp('/sekolah-bersaing?week=2026-09-07')
    await expect(page.getByTestId('sb-week')).toHaveText(
      'Minggu 07 Sep 2026 · 48 sekolah dalam pertandingan',
    )
    await expect(rows).toHaveCount(48)

    await gotoApp('/sekolah-bersaing?week=2026-08-31')
    await expect(page.getByTestId('sb-week')).toHaveText(
      'Minggu 31 Aug 2026 · 48 sekolah dalam pertandingan',
    )
    await expect(rows.nth(16).getByTestId('sb-state')).toHaveText('Selangor')
    await expect(rows.nth(16).getByTestId('sb-aktif')).toContainText('0.2%')

    await gotoApp('/sekolah-bersaing?week=2025-01-06')
    await expect(page.getByRole('heading', { level: 1, name: '🏆 Sekolah Bersaing' })).toBeVisible()
    await expect(page.getByTestId('sb-empty')).toContainText('📊 Data minggu ini belum dijana.')
    await expect(page.getByTestId('sb-empty')).toContainText(
      'Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya.',
    )
    await expect(rows).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await gotoApp('/sekolah-bersaing?week=bogus')
    await expect(page.getByTestId('sb-week')).toHaveText(
      'Minggu 21 Sep 2026 · 49 sekolah dalam pertandingan',
    )
    await expect(rows).toHaveCount(49)
  },
)

for (const [name, who] of [
  ['admin', ADMIN],
  ['student', STUDENT],
] as const) {
  test(
    `E2E-M16-05 ${name} opens S28 in the user shell with the live title`,
    MODULE,
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(who)
      await gotoApp('/sekolah-bersaing')
      await expectTabTitle(page, 'Sekolah Bersaing — Leaderboard Mingguan')
      await expect(page.getByTestId('shell-user-title')).toHaveText('Sekolah Bersaing')
      await expect(page.getByTestId('sb-row')).toHaveCount(49)
    },
  )
}
