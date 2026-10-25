/**
 * UAT G-47 (T10): the Guru monitoring report exports to CSV. The download starts, the file name is the
 * documented one and the header row matches the "Analisis Sekolah" table columns, with one row per school.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'

test.use({ mockInit: { latency: 0 } })
test.describe.configure({ timeout: 300_000 })

async function readDownload(download: import('@playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

for (const [who, path] of [
  ['guru@demo.test', '/guru/monitoring'],
  ['adminsekolah@demo.test', '/admin-sekolah/monitoring'],
] as const) {
  test(`G-47 ${who} CSV export of ${path} downloads a non-empty file`, { tag: ['@m11', '@t10'] }, async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(who)
    await gotoApp(path)
    await expect(page.getByTestId('mon-kpis')).toBeVisible({ timeout: 180_000 })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('mon-export-csv').click(),
    ])
    expect(download.suggestedFilename()).toBe('monitoring-penglibatan.csv')
    const text = await readDownload(download)
    const lines = text.split('\n').filter((l) => l !== '')
    expect(lines[0]).toBe('﻿"#","Sekolah","Kod","Negeri","Daftar","Aktif","%","Tahap"')
    expect(lines.length).toBeGreaterThan(1)
    // every data row has the 8 quoted cells
    for (const row of lines.slice(1)) expect(row.split('","').length).toBe(8)
    await expectNoHorizontalScroll(page)
  })
}

for (const query of [
  '?period=7d',
  '?period=30d&state=Selangor',
  '?tahap=Kritikal',
  '?state=Perlis&tahap=Tiada%20Langsung',
  '?period=today&state=Johor&tahap=Cemerlang',
]) {
  test(`G-47 guru CSV export with filters ${query} downloads and raises no page error`, { tag: ['@m11', '@t10'] }, async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await loginAs('guru@demo.test')
    await gotoApp(`/guru/monitoring${query}`)
    await expect(page.getByTestId('mon-kpis')).toBeVisible({ timeout: 180_000 })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('mon-export-csv').click(),
    ])
    const text = await readDownload(download)
    expect(text.startsWith('\uFEFF"#","Sekolah"')).toBe(true)
    expect(errors).toEqual([])
  })
}
