/**
 * M08 G5 QA: styling and scoping ACs the developer specs leave out: table headers upper case by CSS
 * (AC-06.2, 07.1, 10.1, 13.4, 22.1), the S11 Tahap pill colours (22.7) and the school admin S1 GPS (04.3).
 */

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
    test(`table headers are upper case by CSS on ${path}`, async ({ page, gotoApp, loginAs }) => {
      await loginAs('admin@demo.test')
      await gotoApp(path)
      const th = page.getByTestId('shell-user-main').locator('thead th')
      await expect(th.first()).toBeVisible()
      const transforms = await th.evaluateAll((els) =>
        els
          .filter((e) => (e.textContent ?? '').trim().length > 1)
          .map((e) => getComputedStyle(e).textTransform),
      )
      expect(transforms.length).toBeGreaterThan(3)
      expect(transforms.every((t) => t === 'uppercase')).toBe(true)
    })
  }

  test('AC-22.7 S11 class 228 Tahap pills Sederhana / Mudah colours', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/analisa-item/kelas/228')
    await expect(page.locator('tbody tr')).toHaveCount(596)
    const found = await page.evaluate(() => {
      const out: Record<string, { bg: string; fg: string }> = {}
      for (const el of Array.from(document.querySelectorAll('tbody td span'))) {
        const t = (el.textContent ?? '').trim()
        if ((t === 'Sederhana' || t === 'Mudah') && !out[t]) {
          const cs = getComputedStyle(el)
          out[t] = { bg: cs.backgroundColor, fg: cs.color }
        }
      }
      return out
    })
    expect(found['Sederhana']).toEqual({ bg: 'rgb(254, 243, 199)', fg: 'rgb(146, 64, 14)' })
    expect(found['Mudah']).toEqual({ bg: 'rgb(220, 252, 231)', fg: 'rgb(22, 101, 52)' })
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
    const t = (await page.getByTestId('shell-user-main').innerText()).replace(/\s+/g, ' ')
    expect(t).toContain('Ringkasan prestasi keseluruhan · 2 kelas · 9 murid')
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
      await expect
        .poll(() =>
          page.evaluate(() =>
            Boolean(
              (window as unknown as { __charts?: Record<string, unknown> }).__charts?.[
                'class-trend-chart'
              ],
            ),
          ),
        )
        .toBe(true)
      const info = await page.evaluate(() => {
        const c = (
          window as unknown as {
            __charts: Record<
              string,
              { data: { labels: string[]; datasets: { label: string; data: number[] }[] } }
            >
          }
        ).__charts['class-trend-chart']!
        return { labels: c.data.labels, datasets: c.data.datasets.map((d) => d.label) }
      })
      expect(info.labels).toEqual(['09-15', '09-22', '09-24'])
      expect(info.datasets).toEqual(['Purata Ketepatan (%)', 'Sesi'])
    })
  },
)
