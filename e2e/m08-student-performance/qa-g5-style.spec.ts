/**
 * M08 G5 QA: styling and scoping ACs the developer specs leave out: table headers upper case by CSS
 * (AC-06.2, 07.1, 10.1, 13.4, 22.1), the S11 Tahap pill colours (22.7) and the school admin S1 GPS (04.3).
 */

import type { Locator } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { moduleTag } from '../support'

const HEADER_PAGES = [
  '/prestasi/sekolah',
  '/prestasi/tingkatan/t4',
  '/prestasi/kelas/2001',
  '/analisa-item/kelas/228',
  '/analitik/kelas?classroom_id=4',
]

test.describe('M08 G5 style (admin)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const path of HEADER_PAGES) {
    test(`table headers keep the v2 sentence case on ${path}`, async ({ page, gotoApp, loginAs }) => {
      await loginAs('admin@demo.test')
      await gotoApp(path)
      const th = page.locator('[data-testid=pembelajaran-main], [data-testid=pentadbiran-main]').locator('thead th')
      await expect(th.first()).toBeVisible()
      const transforms = await th.evaluateAll((els) =>
        els
          .filter((e) => (e.textContent ?? '').trim().length > 1)
          .map((e) => getComputedStyle(e).textTransform),
      )
      expect(transforms.length).toBeGreaterThan(3)
      // v2 theme (text-th): column headers are sentence case, no upper-case transform.
      expect(transforms.every((t) => t === 'none')).toBe(true)
    })
  }

  test('AC-22.7 S11 class 228 Tahap pills Sederhana / Mudah colours', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/analisa-item/kelas/228')
    // 596 questions, 25 rows on the first page (DifficultyTab.vue PAGE_SIZE).
    await expect(page.getByTestId('class-questions')).toHaveText('596')
    await expect(page.locator('tbody tr')).toHaveCount(25)
    const found = await page.evaluate(() => {
      const out: Record<string, string> = {}
      for (const el of Array.from(document.querySelectorAll('span'))) {
        const t = (el.textContent ?? '').trim()
        if ((t === 'Sederhana' || t === 'Mudah') && !out[t]) {
          out[t] = el.className
        }
      }
      return out
    })
    // The DS Tahap badges are semantic (lib/prestasi/format.ts LEVEL_BADGE): Sederhana warning, Mudah success.
    expect(found['Sederhana']).toMatch(/text-warning/)
    expect(found['Mudah']).toMatch(/text-success/)
  })
})

test.describe('M08 G5 school admin S1 (OQ-M08-04, provisional)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('AC-04.3 own-school GPS 5.33 Sederhana, 6 entri headcount', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('adminsekolah@demo.test')
    await gotoApp('/prestasi/sekolah')
    await expect(page.getByTestId('prestasi-sekolah-page')).toBeVisible()
    const t = (await page.locator('[data-testid=pembelajaran-main], [data-testid=pentadbiran-main]').innerText()).replace(/\s+/g, ' ')
    expect(t).toContain('Ringkasan prestasi keseluruhan · 2 kelas · 10 murid')
    expect(t).toContain('5.33')
    expect(t).toContain('Sederhana')
    expect(t).toContain('Berdasarkan 6 entri headcount')
  })
})

test.describe(
  'M08 G5 class trend chart (teacher, provisional L-6)',
  { tag: [moduleTag(8)] },
  () => {
    test.use({ mockInit: { latency: 0 } })

    test('AC-13.3 class 2001 trend: 3 points 09-15 / 09-22 / 09-24, datasets "Purata Ketepatan (%)" and "Sesi"', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('guru@demo.test')
      await gotoApp('/prestasi/kelas/2001')
      await expect(page.getByTestId('class-trend-chart')).toBeVisible()
      // The 30-day trend is two DsCharts (accuracy and sessions, class-chart.ts), each mirrored in an sr-only table over a
      // daily axis: only the three session days carry a non-zero value.
      const days = async (chart: Locator, zero: string) =>
        chart.locator('table tbody tr').evaluateAll(
          (rows, z) =>
            rows
              .filter((r) => r.children[1]?.textContent?.trim() !== z)
              .map((r) => r.children[0]?.textContent?.trim()),
          zero,
        )
      const accuracy = page.getByTestId('class-trend-chart')
      const sessions = page.getByTestId('trend').locator('[data-ds=chart]').nth(1)
      expect(await days(accuracy, '0%')).toEqual(['09-15', '09-22', '09-24'])
      expect(await days(sessions, '0')).toEqual(['09-15', '09-22', '09-24'])
      await expect(accuracy.locator('table thead th').nth(1)).toHaveText('Purata Ketepatan (%)')
      await expect(sessions.locator('table thead th').nth(1)).toHaveText('Sesi')
    })
  },
)
