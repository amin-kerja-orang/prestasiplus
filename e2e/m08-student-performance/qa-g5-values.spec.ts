/**
 * M08 G5 QA: observed values and copy of ACs that the developer specs do not assert (S1 GPS / grade
 * distribution / trend / subject GPS / teacher cards / quick links, S3 class table and risk list,
 * S4 empty state, S9 pills, S11 summaries). The page text is whitespace-normalised and checked in order.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const main = (page: Page) => page.getByTestId('shell-user-main')

async function text(page: Page): Promise<string> {
  await expect(main(page)).not.toBeEmpty()
  return (await main(page).innerText()).replace(/\s+/g, ' ').trim()
}

/** Every fragment must appear, in the given order. */
function expectInOrder(haystack: string, fragments: string[]): void {
  let from = 0
  for (const f of fragments) {
    const i = haystack.indexOf(f, from)
    expect(
      i,
      `"${f}" after offset ${from} in: ${haystack.slice(Math.max(0, from - 40), from + 160)}`,
    ).toBeGreaterThanOrEqual(0)
    from = i + f.length
  }
}

test.describe('M08 G5 values (admin)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  test('AC-05.1 / 05.2 GPS card and grade distribution', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/sekolah')
    await expect(page.getByTestId('prestasi-sekolah-page')).toBeVisible()
    const t = await text(page)
    expectInOrder(t, [
      '📊 GPS Anggaran',
      'Gred Purata Sekolah (lebih rendah = lebih baik)',
      '3.45',
      'GPS',
      'Baik',
      'Berdasarkan 744 entri headcount',
      '* Anggaran dari markah OTR, bukan SPM sebenar',
      '📈 Taburan Gred (Anggaran)',
      'A+ 125 16.8%',
      'A 146 19.6%',
      'A- 96 12.9%',
      'B+ 47 6.3%',
      'B 107 14.4%',
      'C+ 24 3.2%',
      'C 23 3.1%',
      'D 76 10.2%',
      'E 28 3.8%',
      'G 72 9.7%',
      'Jumlah: 744 rekod',
    ])
  })

  test('AC-06.1 / 06.2 trend caption, axis note and table', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/sekolah')
    await expect(page.getByTestId('gps-trend-chart')).toBeVisible()
    const t = await text(page)
    expectInOrder(t, [
      '📉 Trend GPS (5 Tahun)',
      '2022–2026 · lebih rendah = lebih baik',
      'Paksi Y diterbalikkan: 0 (A+) di atas, 9 (G) di bawah.',
      '2022 5.20 Sederhana 150 SPM Sebenar —',
      '2023 4.80 Sederhana 160 SPM Sebenar ▼ 0.40',
      '2024 4.50 Sederhana 175 SPM Sebenar ▼ 0.30',
      '2025 4.30 Sederhana 180 SPM Sebenar ▼ 0.20',
      '2026 Semasa Tiada data — — — —',
    ])
  })

  test('AC-06.1 / 06.3 chart datasets, reversed 0-9 axis and the tooltip texts', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/sekolah')
    await expect(page.getByTestId('gps-trend-chart')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            (window as unknown as { __charts?: Record<string, unknown> }).__charts?.[
              'gps-trend-chart'
            ],
          ),
        ),
      )
      .toBe(true)
    const info = await page.evaluate(() => {
      const c = (window as unknown as { __charts: Record<string, Any> }).__charts[
        'gps-trend-chart'
      ]!
      const y = c.options.scales.y
      const cb = c.options.plugins.tooltip.callbacks
      const ds = c.data.datasets
      const item = (di: number, i: number) => ({
        dataset: ds[di],
        label: c.data.labels[i],
        dataIndex: i,
        parsed: { y: ds[di].data[i] },
      })
      return {
        labels: c.data.labels,
        overall: ds[0].data,
        dashed: ds.filter((d: Any) => d.borderDash && d.borderDash.length).length,
        yReverse: y.reverse,
        yMin: y.min,
        yMax: y.max,
        ticks: [0, 9].map((v) => y.ticks.callback(v)),
        title2022: cb.title([item(0, 0)]),
        label2022: cb.label(item(0, 0)),
        label2026: cb.label(item(0, 4)),
      }
    })
    expect(info.labels.map(String)).toEqual(['2022', '2023', '2024', '2025', '2026'])
    expect(info.overall.slice(0, 4)).toEqual([5.2, 4.8, 4.5, 4.3])
    expect(info.overall[4] ?? null).toBeNull()
    expect(info.dashed).toBe(6)
    expect(info.yReverse).toBe(true)
    expect([info.yMin, info.yMax]).toEqual([0, 9])
    expect(info.ticks).toEqual(['A+ (0)', 'G (9)'])
    expect(info.title2022).toBe('Tahun 2022')
    expect(info.label2022).toBe('GPS Keseluruhan: 5.20 (Sederhana)')
    expect(info.label2026).toBe('GPS Keseluruhan: Tiada data')
  })

  test('AC-07.1 / 07.2 subject GPS table: 18 rows, order, grade and bar', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/sekolah')
    await expect(page.getByTestId('prestasi-sekolah-page')).toBeVisible()
    const t = await text(page)
    expectInOrder(t, [
      '1 Tasawwur Islam 0.29 A+ 7 0 0 7',
      '2 Pendidikan Islam 0.98 A 48 0 1 47',
      '3 Prinsip Perakaunan 1.40 A 5 0 3 2',
      '4 Ekonomi 1.86 A- 28 9 7 12',
      '5 Biologi 1.96 A- 23 19 4 0',
      '6 Fizik 2.50 B+ 2 1 0 1',
      '7 Bahasa Inggeris 2.57 B+ 37 13 16 8',
      '8 Sains 2.79 B+ 131 74 36 21',
      '9 Bahasa Melayu 2.84 B+ 109 22 4 83',
      '10 Kimia 3.21 B+ 56 8 4 44',
      '11 Pendidikan Moral 3.44 B+ 9 3 2 4',
      '12 Sejarah 3.56 B 101 27 34 40',
      '13 Matematik Tambahan 3.67 B 3 3 0 0',
      '14 Sains Komputer 4.00 B 1 1 0 0',
      '15 Matematik 4.54 C+ 100 24 28 48',
      '16 Perniagaan 7.15 D 84 7 61 16',
      '17 Pendidikan Seni Visual',
      '18 Sains Sukan',
    ])
  })

  test('AC-08.2 / 08.3 teacher cards (310, A-Z, observed cards) and quick links', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/sekolah')
    const list = page.getByTestId('teachers-list')
    await expect(list).toBeVisible()
    const cards = await list.evaluate((el) => {
      const t = (el as HTMLElement).innerText.replace(/\s+/g, ' ')
      return {
        n: (t.match(/\d+ kelas · \d+ murid/g) ?? []).length,
        has76: t.includes('2 kelas · 76 murid'),
        has89: t.includes('3 kelas · 89 murid'),
        has725: t.includes('72.5%'),
        has727: t.includes('72.7%'),
      }
    })
    expect(cards.n).toBe(310)
    expect.soft(cards.has76, 'observed card "2 kelas · 76 murid" 72.5%').toBe(true)
    expect.soft(cards.has725, 'observed accuracy 72.5%').toBe(true)
    expect.soft(cards.has89, 'observed card "3 kelas · 89 murid" 72.7%').toBe(true)
    expect.soft(cards.has727, 'observed accuracy 72.7%').toBe(true)
    const links = page.getByTestId('quick-nav').getByRole('link')
    await expect(links).toHaveText([
      '🎓 Dashboard Tingkatan',
      '📊 Dashboard Kelas',
      '📈 Headcount',
      '🔬 Analisa Item',
    ])
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    expect(hrefs).toEqual([
      '/prestasi/tingkatan',
      '/prestasi/kelas',
      '/headcount',
      '/analisa-item/sekolah',
    ])
  })

  test('AC-09.3 S3 headcount overall T4 and T5', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/tingkatan/t4')
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
    expectInOrder(await text(page), [
      'Headcount Keseluruhan',
      '45% On Track',
      'On Track: 34',
      'Below Target: 41',
    ])
    await gotoApp('/prestasi/tingkatan/t5')
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
    expectInOrder(await text(page), ['28% On Track', 'On Track: 114', 'Below Target: 289'])
  })

  test('AC-09.4 S3 T5 header reads 645 kelas · 26 subjek', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/tingkatan/t5')
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
    await expect(page.getByTestId('level-summary')).toHaveText(
      'Dashboard Prestasi Tingkatan · 645 kelas · 26 subjek',
    )
  })

  test('AC-10.1 / 10.2 / 10.5 S3 T4 class table in the observed order with the Simulasi 13 / 2', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/tingkatan/t4')
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
    const rows = page.locator('[data-testid^=class-row-]')
    await expect(rows).toHaveCount(13)
    const names = await rows.evaluateAll((trs) =>
      trs.map((r) => (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
    )
    const expected = [
      '4 Bestari Tiada Subjek',
      '4 Simulasi Tiada Subjek',
      '4 Bestari - BM Bahasa Melayu',
      '4 Cemerlang - BM Bahasa Melayu',
      '4 Dedikasi - BM Bahasa Melayu',
      'MUMTAZ - Biologi Biologi',
      '5 BEST Fizik',
      '4 IBNU SINA Matematik',
      '4 Bestari - SEJ Sejarah',
      '4 Cemerlang - SEJ Sejarah',
      '4 Dedikasi - SEJ Sejarah',
      'T4 4 Bestari Kelas Sekolah',
      'T4 4 Khawarizmi Kelas Sekolah',
    ]
    expected.forEach((e, i) => expect.soft(names[i], `row ${i + 1}`).toContain(e))
    expect.soft(names[1]).toMatch(/15 0 0% 13 2/)
    const hrefs = await rows.evaluateAll((trs) =>
      trs.map((r) => r.querySelector('a')?.getAttribute('href') ?? null),
    )
    expect(hrefs).toEqual([
      '/prestasi/kelas/419',
      '/prestasi/kelas/516',
      '/prestasi/kelas/4',
      '/prestasi/kelas/5',
      '/prestasi/kelas/6',
      '/prestasi/kelas/90',
      '/prestasi/kelas/25',
      '/prestasi/kelas/115',
      '/prestasi/kelas/8',
      '/prestasi/kelas/9',
      '/prestasi/kelas/10',
      null,
      null,
    ])
  })

  test('AC-10.4 S3 risk list: 15 rows on T4, links to /prestasi/{id}; T5 first row', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/tingkatan/t4')
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
    const t4 = await text(page)
    expectInOrder(t4, [
      'Murid Berisiko',
      '4 Simulasi · OTR3: 56.00% (sasaran 82.00%) -26',
      '4 Simulasi · OTR3: 83.00% (sasaran 93.00%) -10',
    ])
    const risk = page
      .getByRole('heading', { name: /Murid Berisiko/ })
      .locator('xpath=ancestor::*[self::section or self::div][.//a][1]')
    expect(await risk.locator('a[href^="/prestasi/"]').count()).toBe(15)
    await gotoApp('/prestasi/tingkatan/t5')
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
    const t5 = await text(page)
    expect(t5).toMatch(/OTR3: 0\.00% \(sasaran 70\.00%\) -70/)
    expect(t5).toMatch(/OTR3: 40\.00% \(sasaran 71\.00%\) -31/)
  })

  test('AC-10.4 S3 T5 risk list: observed class labels "5 LEQOE" (first) and "5 JUJUR"', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/tingkatan/t5')
    await expect(page.getByTestId('tingkatan-page')).toBeVisible()
    const t5 = await text(page)
    expect.soft(t5).toContain('5 LEQOE · OTR3: 0.00% (sasaran 70.00%) -70')
    expect.soft(t5).toContain('5 JUJUR · OTR3: 40.00% (sasaran 71.00%) -31')
  })

  test('AC-10.3 S3 T5 best students: 10 rows capped at 100%', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/tingkatan/t5')
    await expect(page.getByTestId('top-students')).toBeVisible()
    const t = (await page.getByTestId('top-students').innerText()).replace(/\s+/g, ' ')
    expect((t.match(/100%/g) ?? []).length).toBe(10)
    expect(t).not.toMatch(/1[0-9]{2}\.[0-9]%/)
  })

  test('AC-11.1 S4 admin empty state with the Cipta Kelas link', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas')
    await expect(
      page.getByTestId('kelas-list').or(page.getByText('Anda belum mempunyai kelas aktif.')),
    ).toBeVisible()
    const t = await text(page)
    expectInOrder(t, [
      'Dashboard Kelas',
      'Pilih kelas untuk lihat prestasi keseluruhan',
      '📭',
      'Anda belum mempunyai kelas aktif.',
      'Cipta kelas terlebih dahulu untuk mula memantau prestasi murid.',
      'Cipta Kelas',
    ])
    await expect(page.getByRole('link', { name: 'Cipta Kelas' })).toHaveAttribute(
      'href',
      '/guru/kelas/cipta',
    )
  })

  test('AC-12.1 / 12.2 / 13.1 S5 class 228 header and class 4 attention list', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/kelas/228')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    const t = await text(page)
    expect(t).toContain('ALFA - Bahasa Inggeris')
    expect(t).toMatch(/· Bahasa Inggeris · 2026 · Kod: UDL749/)
    await expect(page.getByTestId('back-link')).toHaveAttribute('href', '/prestasi/kelas')
    await expect(page.getByTestId('back-link')).toHaveAttribute('title', 'Kembali ke senarai kelas')
    await gotoApp('/prestasi/kelas/4')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    await expect(page.getByTestId('attention-count')).toHaveText('(58)')
    const t4 = await text(page)
    expect((t4.match(/Belum mula berlatih/g) ?? []).length).toBe(58)
    expect((t4.match(/Tak Aktif/g) ?? []).length).toBeGreaterThanOrEqual(58)
    expect(t4).toContain('Belum ada aktiviti dalam 30 hari terakhir.')
  })

  test('AC-13.2a class 228 later rows: sessions rows below 50% non-increasing, idle rows last', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/kelas/228')
    await expect(page.getByTestId('attention-count')).toHaveText('(57)')
    const rows = await page.getByTestId('attention-count').evaluate((el) => {
      let root: HTMLElement | null = el as HTMLElement
      while (root && !/ketepatan|Belum mula berlatih/.test(root.innerText))
        root = root.parentElement
      const t = (root?.innerText ?? '').replace(/\s+/g, ' ')
      const withSessions = Array.from(t.matchAll(/(\d+) sesi · ([\d.]+)% ketepatan/g)).map((m) =>
        Number(m[2]),
      )
      const idle = (t.match(/Belum mula berlatih/g) ?? []).length
      const order = Array.from(
        t.matchAll(/(\d+ sesi · [\d.]+% ketepatan|Belum mula berlatih)/g),
      ).map((m) => m[1])
      return { withSessions, idle, order }
    })
    expect(rows.withSessions.length + rows.idle).toBe(57)
    expect(rows.withSessions.slice(0, 3)).toEqual([48.3, 45, 44.6])
    for (let i = 1; i < rows.withSessions.length; i++) {
      expect(rows.withSessions[i]).toBeLessThanOrEqual(rows.withSessions[i - 1]!)
      expect(rows.withSessions[i]).toBeLessThan(50)
    }
    const firstIdle = rows.order.findIndex((o) => o === 'Belum mula berlatih')
    if (firstIdle >= 0)
      expect(rows.order.slice(firstIdle).every((o) => o === 'Belum mula berlatih')).toBe(true)
  })

  test('AC-20.1 S9 own school (no pupils) copy and the Papan Pemuka breadcrumb', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah')
    await expect(page.getByTestId('school-empty')).toBeVisible()
    const t = await text(page)
    expectInOrder(t, [
      'Papan Pemuka',
      'Analisa Item Sekolah',
      'Tingkatan:',
      'Semua',
      'Tingkatan 4',
      'Tingkatan 5',
      'Tiada Data Pelajar',
      'Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan.',
    ])
    await expect(page.getByRole('link', { name: 'Papan Pemuka' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })

  test('AC-20.2 S9 Tingkatan 4 chip sets ?tingkatan=T4 and the subtitle', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah')
    await expect(page.getByRole('link', { name: 'Tingkatan 4' })).toBeVisible()
    await page.getByRole('link', { name: 'Tingkatan 4' }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('tingkatan')).toBe('T4')
    await expect(page.getByTestId('shell-user-subtitle')).toContainText('— Tingkatan 4')
  })

  test('AC-20.3 S9 /8880: school card, profile, GPS, subject rows, pills order and first card', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah/8880')
    await expect(page.getByTestId('school-card')).toBeVisible()
    const t = await text(page)
    expectInOrder(t, [
      'SEKOLAH MENENGAH KEBANGSAAN TINGGI KLUANG',
      'JEB2037',
      'PPD KLUANG • Johor',
      '59 Pelajar',
      '10,194 Jawapan',
      'Profil Kesukaran',
      'GPS Anggaran Sekolah',
      '2.49',
      'Baik',
      'Berdasarkan 148 entri headcount • Lebih rendah = lebih baik',
      'Prestasi 360',
      'Sains 29 1,094 70.9% 539',
      'Sejarah 29 1,109 71.0% 615',
      'Bahasa Inggeris 29 851 71.9% 539',
      'Bahasa Melayu 30 507 72.0% 580',
      'Matematik 31 817 72.4% 614',
    ])
    const pills = await page.getByTestId('question-filters').locator('button').allInnerTexts()
    expect(pills.map((p) => p.replace(/\s+/g, ' ').trim())).toEqual([
      'Semua (20)',
      'Bahasa Melayu (13)',
      'Sains (6)',
      'Sejarah (1)',
    ])
    const first = page.getByTestId('question-list').locator('article').first()
    await expect(first).toContainText('Prinsip Pascal menyatakan bahawa:')
    await expect(first).toContainText('Sukar')
    await expect(first).toContainText('100.0% salah')
  })

  test('AC-20.4 S9 /8880 T4: subject table start, pills order and the Sains filter', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah/8880?tingkatan=T4')
    await expect(page.getByTestId('school-card')).toBeVisible()
    expect(await text(page)).toContain('Sejarah 15 854 75.7% 312')
    const pills = await page.getByTestId('question-filters').locator('button').allInnerTexts()
    expect(pills.map((p) => p.replace(/\s+/g, ' ').trim())).toEqual([
      'Semua (20)',
      'Bahasa Inggeris (1)',
      'Bahasa Melayu (11)',
      'Sains (2)',
      'Sejarah (6)',
    ])
    const before = page.url()
    await page
      .getByTestId('question-filters')
      .getByRole('button', { name: /^Sains \(2\)/ })
      .click()
    await expect(page.getByTestId('question-list').locator('article')).toHaveCount(2)
    expect(page.url()).toBe(before)
  })

  test('AC-20.5 S9 question card expands with the correct option, popular wrong answer and chips', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/sekolah/8880')
    const first = page.getByTestId('question-list').locator('article').first()
    await first.locator('button').first().click()
    await expect(first.getByText('Jawapan Betul')).toBeVisible()
    await expect(first.getByText(/Jawapan Salah Paling Popular \(\d+x dipilih\)/)).toBeVisible()
    await expect(first.getByText('Pelajar Yang Salah')).toBeVisible()
    const href = await first.locator('a[href^="/prestasi/"]').first().getAttribute('href')
    expect(href).toMatch(/^\/prestasi\/\d+$/)
  })

  test('AC-20.6 S9 /2700 pupils without answers', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/sekolah/2700')
    await expect(page.getByTestId('school-card')).toBeVisible()
    const t = await text(page)
    expectInOrder(t, [
      '0 Soalan Dijawab',
      '0.0% Ketepatan Keseluruhan',
      'Profil Kesukaran',
      'Tiada data',
    ])
    await expect(page.getByTestId('question-list').locator('article')).toHaveCount(0)
  })

  test('AC-21.1 S10 750 cards, first three, link', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas')
    await expect(page.getByText('Pilih Kelas untuk Analisis')).toBeVisible()
    await expect(page.getByText('Klik mana-mana kelas untuk melihat analisa item')).toBeVisible()
    const links = page.getByTestId('class-grid').locator('> a')
    const first = links.first()
    await expect(first).toHaveAttribute('href', '/analisa-item/kelas/1156')
    await expect(first).toContainText('5 CYBER')
    await expect(first).toContainText('Sains Rumah Tangga')
    await expect(first).toContainText('1 pelajar')
    await expect(first).toContainText('JOV330')
    await expect(first).toContainText('Lihat Analisa')
  })

  test('AC-21.1 / NFR-01 S10 lists 750 cards', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas')
    await expect(page.getByText('Pilih Kelas untuk Analisis')).toBeVisible()
    await expect(page.getByTestId('class-grid').locator('> a')).toHaveCount(750)
  })

  test('AC-22.1 / 22.7 S11 class 228 summary and the Sederhana / Mudah pills', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/kelas/228')
    await expect(page.getByText('Indeks Kesukaran')).toBeVisible()
    const t = await text(page)
    expectInOrder(t, [
      'ALFA - Bahasa Inggeris',
      'Bahasa Inggeris • tingkatan-5 • Tahun 2026',
      '93',
      'Pelajar',
      '596',
      'Soalan Diuji',
      '381',
      '64% daripada soalan',
      '78',
      '13% daripada soalan',
      '137',
      '23% daripada soalan',
      'Indeks Kesukaran 596',
      'Indeks Diskriminasi 596',
    ])
    await expect(page.locator('tbody tr')).toHaveCount(596)
  })

  test('AC-22.1 S11 class 228 first observed row "Which of the following is a fact?"', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/kelas/228')
    await expect(page.locator('tbody tr')).toHaveCount(596)
    const row = (await page.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ')
    expect(row).toContain('Which of the following is a fact?')
    expect(row).toContain('2 pelajar salah')
    expect(row).toContain('Sukar')
  })

  test('AC-22.5 S11 class 6 empty state', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas/6')
    const t = await text(page)
    expectInOrder(t, [
      'Bahasa Melayu • tingkatan-4 • Tahun 2026',
      'Tiada Data Lagi',
      'Pelajar dalam kelas ini belum menjawab sebarang soalan lagi.',
    ])
    expect(t).not.toContain('% daripada soalan')
  })

  test('AC-22.2 / 23.1 / 23.2 S11 class 2001 order, discrimination guide and table', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/kelas/2001')
    await expect(page.getByText('Indeks Kesukaran')).toBeVisible()
    const idx = await page
      .locator('tbody tr')
      .evaluateAll((trs) => trs.map((r) => (r as HTMLElement).innerText.replace(/\s+/g, ' ')))
    expect(idx).toHaveLength(8)
    const indexes = idx.map((r) => r.match(/\b(0\.\d\d)\b/)?.[1])
    expect(indexes).toEqual(['0.88', '0.88', '0.75', '0.50', '0.50', '0.50', '0.40', '0.25'])
    const acc = idx.map((r) => r.match(/(\d+\.\d)%/)?.[1])
    expect(acc).toEqual(['12.5', '12.5', '25.0', '50.0', '50.0', '50.0', '60.0', '75.0'])
    await page.getByRole('button', { name: /Indeks Diskriminasi/ }).click()
    const t = await text(page)
    expectInOrder(t, [
      '≥ 0.40 = Sangat Baik',
      '0.30 – 0.39 = Baik',
      '0.20 – 0.29 = Sederhana',
      '< 0.20 = Lemah',
      'Indeks dikira berdasarkan perbezaan prestasi antara 27% pelajar terbaik dan 27% pelajar bawah dengan menggunakan semua sesi latihan.',
      '1.000',
      '1.000',
      '1.000',
      '0.500',
      '0.333',
      '0.250',
      '0.000',
      '-0.500',
    ])
    await expect(page.getByPlaceholder('Cari soalan...')).toBeHidden()
  })

  test('AC-23.4 S11 "Tukar Kelas" has 750 chips and navigates', async ({ page, gotoApp }) => {
    await gotoApp('/analisa-item/kelas/2001')
    await expect(page.getByText('Indeks Kesukaran')).toBeVisible()
    const chips = page.locator('a[href^="/analisa-item/kelas/"]')
    expect(await chips.count()).toBeGreaterThanOrEqual(748)
    await chips.nth(1).click()
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/analisa-item\/kelas\/\d+$/)
    await expectNoHorizontalScroll(page)
  })

  test('AC-23.4 S11 "Tukar Kelas" has one chip per class (750 for the admin)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analisa-item/kelas/2001')
    await expect(page.getByText('Indeks Kesukaran')).toBeVisible()
    await expect(page.locator('a[href^="/analisa-item/kelas/"]')).toHaveCount(750)
  })
})
