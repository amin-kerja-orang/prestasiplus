/**
 * UAT T10: S-56 "Senarai Pelajar" / "Senarai Guru" "Eksport CSV" downloads a file whose header matches the
 * documented columns; S-55 "Laporan Bulanan" prints only the report (shell navigation, breadcrumb, month
 * links and the print button are hidden under `@media print`).
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'

test.use({ mockInit: { latency: 0 } })
test.describe.configure({ timeout: 300_000 })

const CSV_HEADER = '﻿id,name,email,role,sekolah,kelas,is_active,created_at'

for (const [path, role, word] of [
  ['/admin-sekolah/pelajar', 'pelajar', 'Pelajar'],
  ['/admin-sekolah/guru', 'guru', 'Guru'],
] as const) {
  test(`S-56 Senarai ${word}: Eksport CSV downloads users-${role}-*.csv`, { tag: ['@m27', '@t10'] }, async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('adminsekolah@demo.test')
    await gotoApp(path)
    await expect(page.getByTestId('user-export')).toBeVisible({ timeout: 180_000 })
    const rows = await page.locator('table tbody tr').count()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('user-export').click(),
    ])
    expect(download.suggestedFilename()).toMatch(new RegExp(`^users-${role}-\\d{4}-\\d{2}-\\d{2}\\.csv$`))
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const text = Buffer.concat(chunks).toString('utf8')
    const lines = text.split('\n').filter((l) => l !== '')
    expect(lines[0]).toBe(CSV_HEADER)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.length - 1).toBeGreaterThanOrEqual(Math.min(rows, 1))
    for (const l of lines.slice(1)) expect(l).toContain(`,${role},`)
    await expectNoHorizontalScroll(page)
  })
}

test('S-55 Laporan Bulanan prints the report only', { tag: ['@m27', '@t10'] }, async ({
  page,
  loginAs,
  gotoApp,
}) => {
  await loginAs('adminsekolah@demo.test')
  await gotoApp('/admin-sekolah/laporan-bulanan')
  await expect(page.getByTestId('lb-heading')).toBeVisible({ timeout: 180_000 })
  await expect(page.getByTestId('lb-print')).toBeVisible()
  await expect(page.getByTestId('lb-print-school')).toBeHidden()

  await page.emulateMedia({ media: 'print' })
  // the report stays, the school name appears, the screen-only controls and the shell are gone
  await expect(page.getByTestId('lb-heading')).toBeVisible()
  await expect(page.getByTestId('lb-print-school')).toBeVisible()
  await expect(page.getByTestId('lb-print')).toBeHidden()
  await expect(page.getByTestId('lb-prev')).toBeHidden()
  await expect(page.getByTestId('lb-breadcrumb')).toBeHidden()
  const visibleNav = await page.evaluate(() => {
    const vis = (el: Element) => getComputedStyle(el).visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null
    return [...document.querySelectorAll('nav, aside, header, footer, [data-testid="sa-dskp-heatmap"]')]
      .filter((e) => vis(e) && !e.closest('[data-print-area]'))
      .map((e) => `${e.tagName}.${String(e.className).slice(0, 60)}`)
  })
  expect(visibleNav).toEqual([])
  // the printed page is one column starting at the top-left, no horizontal overflow
  const box = await page.getByTestId('lb-heading').boundingBox()
  expect(box?.y ?? 999).toBeLessThan(200)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)

  // a real print render is a short document, not the screen layout with empty pages
  const pdf = await page.pdf({ format: 'A4' })
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  expect(pages).toBeGreaterThan(0)
  expect(pages).toBeLessThanOrEqual(3)
})

test('S-55 Laporan Bulanan: Cetak / PDF calls window.print', { tag: ['@m27', '@t10'] }, async ({
  page,
  loginAs,
  gotoApp,
}) => {
  await loginAs('adminsekolah@demo.test')
  await gotoApp('/admin-sekolah/laporan-bulanan')
  await expect(page.getByTestId('lb-print')).toBeVisible({ timeout: 180_000 })
  await page.evaluate(() => {
    ;(window as unknown as { __printed: number }).__printed = 0
    window.print = () => {
      ;(window as unknown as { __printed: number }).__printed++
    }
  })
  await page.getByTestId('lb-print').click()
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1)
})
