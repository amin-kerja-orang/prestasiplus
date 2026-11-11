/**
 * M08 G5 QA: ACs not asserted by the developer specs: 27.6 (ETR vs RS accuracy boxes of 3203 / 3202),
 * 35.1 / 35.2 (class 516 headcount block and ranking badges), 19.4 (S8 links to S6), 36.1 / 36.3 (S22).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

async function text(page: Page): Promise<string> {
  const main = page.getByTestId('pentadbiran-main')
  await expect(main).not.toBeEmpty()
  return (await main.innerText()).replace(/\s+/g, ' ').trim()
}

test.describe('M08 G5 headcount gaps (admin)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  test('AC-27.6 3203: ETR 57.0 vs RS 47.0, Selisih -10, Hampir Tepat', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/student/3203')
    await expect(page.getByText('Ketepatan Ramalan ETR vs RS').first()).toBeVisible()
    const t = await text(page)
    expect(t).toMatch(/ETR \(Ramalan\): 57(\.0)?% \(C\+\)/)
    expect(t).toMatch(/RS \(Sebenar\): 47(\.0)?% \(D\)/)
    expect(t).toContain('Selisih: -10 markah')
    expect(t).toContain('Hampir Tepat')
    expect(t).toContain(
      'Ramalan ETR agak tepat — selisih dalam lingkungan ±10 markah. Boleh diperbaiki lagi.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('AC-27.6 3202: ETR 65.0 vs RS 35.1, Selisih -29.9, Selisih Besar', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/student/3202')
    await expect(page.getByText('Ketepatan Ramalan ETR vs RS').first()).toBeVisible()
    const t = await text(page)
    expect(t).toMatch(/ETR \(Ramalan\): 65(\.0)?% \(B\+\)/)
    expect(t).toContain('RS (Sebenar): 35.1% (G)')
    expect(t).toContain('Selisih: -29.9 markah')
    expect(t).toContain('Selisih Besar')
    expect(t).toContain('Selisih melebihi 10 markah. Semak semula kaedah penetapan ETR.')
  })

  test('AC-27.2 / 27.3 / 27.4 S15 3001 chips and the ETR vs RS box print one decimal (TOV: 60.0% (B))', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/headcount/student/3001')
    await expect(page.getByTestId('headcount-student-page')).toBeVisible()
    const t = await text(page)
    expect.soft(t).toContain('TOV: 58.0% (C+)')
    expect.soft(t).toContain('TOV: 60.0% (B)')
    expect.soft(t).toContain('ETR: 75.0% (A-)')
    expect.soft(t).toContain('ETR (Ramalan): 80.0% (A)')
    expect.soft(t).toContain('RS (Sebenar): 82.0% (A)')
  })

  test('AC-35.1 class 516 headcount block', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas/516')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    const t = await text(page)
    // FR-M08-31: "{sekolah} · {subjek} · {tahun} · Kod: {joinCode}" (V2 has no per-class page, so V1/SRS applies). C-47 shows Kod.
    await expect(page.getByTestId('class-sub').first()).toContainText('· 2026 · Kod: DEMO-4S')
    await expect(page.getByTestId('class-code')).toHaveText('DEMO-4S')
    for (const f of ['📈 Headcount — Ringkasan Kelas', '0 Tiada Data', 'Purata TOV: 62.1%', 'Purata ETR: 71.9%', 'Lihat Penuh →']) {
      expect(t, f).toContain(f)
    }
    // Observed anchors of config 213 (7 On Track / 8 Below): data deferred, the mock gives 15 On Track.
    for (const f of ['7 On Track / Above', '8 Below Target']) expect.soft(t, f).toContain(f)
    await expect(page.getByRole('link', { name: /Lihat Penuh/ })).toHaveAttribute(
      'href',
      '/headcount/213/summary',
    )
    const html = await page.getByTestId('pentadbiran-main').innerHTML()
    expect.soft(html).toMatch(/width: 46\.66\d*%/)
    expect.soft(html).toMatch(/width: 53\.33\d*%/)
  })

  test('AC-35.2 class 516 ranking: 7 On Track / 8 Below, attention list 15 idle', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/kelas/516')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    await expect(page.getByTestId('attention-count')).toHaveText('(15)')
    const t = await text(page)
    const rankingStart = t.indexOf('Kedudukan Murid')
    expect(rankingStart).toBeGreaterThan(0)
    const ranking = t.slice(rankingStart)
    expect((ranking.match(/\bOn Track\b/g) ?? []).length).toBe(7)
    expect((ranking.match(/\bBelow\b/g) ?? []).length).toBe(8)
    expect((t.match(/Belum mula berlatih/g) ?? []).length).toBe(15)
  })

  test('AC-35.4 classes 4 and 228 show no headcount block', async ({ page, gotoApp }) => {
    for (const id of ['4', '228']) {
      await gotoApp(`/prestasi/kelas/${id}`)
      await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
      expect(await text(page)).not.toContain('Headcount — Ringkasan Kelas')
    }
  })

  test('AC-19.4 S8 class 4: name and "Lihat Analitik" open /prestasi/{userId}', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analitik/kelas?classroom_id=4')
    await expect(page.getByText('Lihat Analitik').first()).toBeVisible()
    const hrefs = await page
      .locator('[data-testid=pembelajaran-main], [data-testid=pentadbiran-main]')
      .locator('a[href^="/prestasi/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    expect(hrefs.length).toBeGreaterThanOrEqual(12)
    for (const h of hrefs) expect(h).toMatch(/^\/prestasi\/\d+$/)
    await page.getByText('Lihat Analitik').first().click()
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/prestasi\/\d+$/)
    await expect(page.locator('[data-testid=pentadbiran-header] :is(h1, [data-testid=shell-title])')).toHaveText('Prestasi 360')
  })

  test('AC-36.1 / 36.3 S22 header, back link, cards and buttons', async ({ page, gotoApp }) => {
    await gotoApp('/headcount/213/summary')
    await expect(page.getByRole('heading', { name: 'Taburan Prestasi Per OTR' })).toBeVisible()
    const t = await text(page)
    await expect(
      page.locator('[data-testid=pentadbiran-header] :is(h1, [data-testid=shell-title])'),
    ).toHaveText('Ringkasan Kelas')
    await expect(page.getByTestId('summary-subtitle')).toContainText('Sejarah · 4 Simulasi · Tingkatan 4 · 2026')
    for (const f of [
      '15 Jumlah Murid',
      '62.1 Purata TOV (%)',
      '71.9 Purata ETR (%)',
      '3 OTR Aktif',
    ]) {
      expect(t, f).toContain(f)
    }
    await expect(page.getByRole('link', { name: /Lihat Table Penuh/ })).toHaveAttribute(
      'href',
      '/headcount/213',
    )
    await expect(page.getByRole('link', { name: /Export CSV/ })).toHaveAttribute(
      'href',
      '/headcount/213/export',
    )
    await expectNoHorizontalScroll(page)
  })
})
