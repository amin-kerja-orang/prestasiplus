/**
 * M06-T2 S10 "Sejarah Kuiz SPM" (SRS M06 v1.4 §12: E2E-M06-27, -28, and the S10 part of -04, -39). Rows come from
 * M05 endpoint #23; the seeds are the M05 designed sessions (admin A2–A5, student P1–P4).
 */

import { expect, test } from './fixtures'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  viewportWidth,
} from '../support'
import { ADMIN, columnsOf, PELAJAR, smallTexts, tid } from './support'

const rowsOf = (page: import('@playwright/test').Page) => page.getByTestId('history-row')

test.describe('M06 S10 history', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M06-27 admin: header, stats, 4 rows with exact texts, filters and the empty block', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/spm/history')
    await expectTabTitle(page, 'Sejarah Kuiz SPM | PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Sejarah Kuiz SPM')
    if (isDesktopShell(page)) {
      await expect(tid(page, 'shell-user-subtitle')).toHaveText('Selamat datang kembali')
    }
    await expect(tid(page, 'spm-back')).toHaveText('Kembali ke Mod SPM')
    await expect(tid(page, 'spm-back')).toHaveAttribute('href', '/spm')
    await expect(tid(page, 'spm-heading')).toHaveText('Sejarah Kuiz SPM')
    const stats = page.locator('[data-testid^=history-stat-]')
    await expect(stats.getByTestId('stat-value')).toHaveText(['4', '21.8%', '26', '84'])
    await expect(stats.getByTestId('stat-label')).toHaveText([
      'Sesi Kuiz',
      'Purata Ketepatan',
      'Jumlah Syiling',
      'Soalan Dijawab',
    ])
    expect(await columnsOf(page, 'history-stats')).toBe(viewportWidth(page) >= 768 ? 4 : 2)
    await expect(page.locator('[data-testid^=history-filter-]')).toHaveText([
      'Semua',
      'Tahun Lepas',
      'Latih Tubi',
      'Tracking A',
    ])
    await expect(tid(page, 'history-filter-past_year')).toHaveAttribute(
      'href',
      '/spm/history?type=past_year',
    )
    await expect(tid(page, 'history-filter-all')).toHaveAttribute('href', '/spm/history')

    const rows = rowsOf(page)
    await expect(rows).toHaveCount(4)
    await expect(rows.getByTestId('row-score')).toHaveText(['0%', '20%', '32%', '35%'])
    await expect(rows.getByTestId('row-correct')).toHaveText([
      '0/5 betul',
      '1/5 betul',
      '11/34 betul',
      '14/40 betul',
    ])
    await expect(rows.getByTestId('row-coins')).toHaveText(['+0 🪙', '+1 🪙', '+11 🪙', '+14 🪙'])
    await expect(rows.getByTestId('row-badge')).toHaveText([
      'Tahun Lepas',
      'Tahun Lepas',
      'Latih Tubi',
      'Latih Tubi',
    ])
    for (let i = 0; i < 4; i++) {
      await expect(rows.nth(i).getByTestId('row-score')).toHaveClass(/bg-red-100/)
      await expect(rows.nth(i).getByTestId('row-score')).toHaveClass(/text-red-600/)
    }
    await expect(rows.nth(1).getByTestId('row-meta')).toHaveText('19 May 2026, 03:26 AM · 0m 36s')
    await expect(rows.nth(2).getByTestId('row-meta')).toHaveText('11 May 2026, 02:27 PM · 1m 45s')
    await expect(rows.nth(3).getByTestId('row-meta')).toHaveText('11 May 2026, 02:22 PM · 2m 11s')
    // Rows are not links.
    expect(await rows.first().evaluate((el) => el.closest('a'))).toBeNull()
    await expectNoHorizontalScroll(page)

    await tid(page, 'history-filter-past_year').click()
    await expect(page).toHaveURL(/\/spm\/history\?type=past_year$/)
    await expect(rows).toHaveCount(2)
    await expect(tid(page, 'history-filter-past_year')).toHaveClass(/bg-amber-500/)
    await expect(tid(page, 'history-filter-past_year')).toHaveClass(/text-white/)
    await expect(tid(page, 'history-filter-past_year')).toHaveClass(/shadow-md/)
    await expect(tid(page, 'history-filter-latih_tubi')).toHaveClass(/border-slate-200/)
    // The stats do not follow the filter.
    await expect(stats.getByTestId('stat-value')).toHaveText(['4', '21.8%', '26', '84'])

    await tid(page, 'history-filter-latih_tubi').click()
    await expect(tid(page, 'history-filter-latih_tubi')).toHaveClass(/bg-blue-500/)
    await expect(rows).toHaveCount(2)

    await tid(page, 'history-filter-ramalan').click()
    await expect(tid(page, 'history-filter-ramalan')).toHaveClass(/bg-purple-500/)
    await expect(rows).toHaveCount(0)
    await expect(tid(page, 'history-empty')).toContainText('Belum Ada Sejarah')
    await expect(tid(page, 'history-empty')).toContainText(
      'Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini.',
    )
    await expect(tid(page, 'history-empty-cta')).toHaveText('Mula Kuiz SPM')
    await expect(tid(page, 'history-empty-cta')).toHaveAttribute('href', '/spm')
    await expectNoHorizontalScroll(page)

    // An unknown type lists everything with no filter active.
    await gotoApp('/spm/history?type=zzz')
    await expect(rows).toHaveCount(4)
    for (const id of ['all', 'past_year', 'latih_tubi', 'ramalan']) {
      await expect(tid(page, `history-filter-${id}`)).not.toHaveClass(
        /bg-(indigo|amber|blue|purple)-500/,
      )
    }
  })

  test('E2E-M06-28 student: rows newest first with the score bands and the stats', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/history')
    const rows = rowsOf(page)
    await expect(rows).toHaveCount(4)
    await expect(rows.getByTestId('row-score')).toHaveText(['85%', '60%', '76%', '40%'])
    await expect(rows.nth(0).getByTestId('row-badge')).toHaveText('Tracking A')
    await expect(rows.nth(0).getByTestId('row-score')).toHaveClass(/bg-green-100/)
    await expect(rows.nth(1).getByTestId('row-score')).toHaveClass(/bg-yellow-100/)
    await expect(rows.nth(2).getByTestId('row-score')).toHaveClass(/bg-yellow-100/)
    await expect(rows.nth(3).getByTestId('row-score')).toHaveClass(/bg-red-100/)
    await expect(rows.nth(0).getByTestId('row-badge')).toHaveClass(/bg-purple-100/)
    await expect(page.locator('[data-testid^=history-stat-]').getByTestId('stat-value')).toHaveText(
      ['4', '65.4%', '70', '94'],
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-39 S10 has no text below 12px', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/spm/history')
    await expect(rowsOf(page).first()).toBeVisible()
    expect(await smallTexts(page)).toEqual([])
  })
})
