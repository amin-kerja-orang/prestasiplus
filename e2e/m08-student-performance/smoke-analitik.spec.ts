/**
 * M08-T2 developer E2E (build-plan M08-T2; QA writes the final E2E-M08-* at G5): S7 `/analitik/pelajar`
 * "Analitik Pembelajaran" as the admin (the observed data), pelajar (account 2), guru (account 5) and
 * Admin Sekolah (account 8) (own analytics, no SP record), and S6 `/prestasi/{userId}` "Prestasi 360" as
 * the admin (ids 1, 3001, 3008, 3201), pelajar, guru and Admin Sekolah, at 375 / 768 / 1280: the §6.10
 * anchors, the 404 / 403 pages, the numeric route constraint, titles and no horizontal page scroll.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  provisional,
} from '../support'

const FORBIDDEN_TITLE = 'Akses Ditolak | PRESTASIPLUS'
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'
const S7_SUBTITLE = 'Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan'

const header = (page: Page) => ({
  title: page.getByTestId('shell-user-title'),
  subtitle: page.getByTestId('shell-user-subtitle'),
})

async function expectForbidden(page: Page): Promise<void> {
  await expect(page.locator('[data-page=forbidden]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Akses Ditolak' })).toBeVisible()
  await expectTabTitle(page, FORBIDDEN_TITLE)
}

async function expectNotFound(page: Page): Promise<void> {
  await expect(page.locator('[data-page=not-found]')).toBeVisible()
  await expectTabTitle(page, NOT_FOUND_TITLE)
}

const statValues = (page: Page) => page.getByTestId('stat-value')
const activityValues = (page: Page) => page.getByTestId('activity-value')

test.describe('M08 T2 S7 admin', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  test('S7 Analitik Pembelajaran: title, header, top block and the Bahasa Melayu pane', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analitik/pelajar')
    await expect(page.getByTestId('analitik-page')).toBeVisible()
    await expectTabTitle(page, 'Analitik Pembelajaran')
    await expect(header(page).title).toHaveText('Analitik Pembelajaran')
    await expect(header(page).subtitle).toHaveText(S7_SUBTITLE)

    // Top block: the 4 weakest SPs of every subject, all 0 % (T1 tie rule: fewer answers, then SP id).
    await expect(page.getByTestId('top-weak')).toContainText('Topik Perlu Perhatian Utama (4)')
    const cards = page.getByTestId('top-weak').locator('article')
    await expect(cards).toHaveCount(4)
    for (let i = 0; i < 4; i++) await expect(cards.nth(i)).toContainText('0%')
    // Observed order (T1 fixed): 5.1.2 (3 answers, 16), 3.4.1 (1, 16), 5.1.3 (1, 7), 4.2.1 (4, 12).
    const expected = [
      ['5.1.2', '3', '16', 221],
      ['3.4.1', '1', '16', 206],
      ['5.1.3', '1', '7', 222],
      ['4.2.1', '4', '12', 214],
    ] as const
    for (const [i, [code, answered, count, sp]] of expected.entries()) {
      await expect(cards.nth(i)).toContainText(code)
      await expect(cards.nth(i)).toContainText(`Bahasa Melayu · ${answered} soalan dijawab`)
      await expect(cards.nth(i).getByRole('link')).toHaveText(`Latihan Fokus (${count} soalan)`)
      await expect(cards.nth(i).getByRole('link')).toHaveAttribute(
        'href',
        `/practice/BM/quiz?level=4&dskp_sp_id=${String(sp)}&count=${count}`,
      )
    }

    // Tabs and the BM pane: 3 / 6 / 17 / 0, ring 3 / 3 SP, 40.5 %, 79, G – C.
    await expect(page.getByTestId('tab-1')).toContainText('Bahasa Melayu')
    await expect(page.getByTestId('tab-1')).toContainText('41%')
    await expect(page.getByTestId('tab-1')).toHaveClass(/bg-blue-600/)
    await expect(page.getByTestId('tab-5')).toContainText('Sejarah')
    await expect(page.getByTestId('tab-5')).toContainText('35%')
    await expect(page.getByTestId('tab-5')).toHaveClass(/bg-white/)
    await expect(page.getByTestId('ring-mahir')).toHaveText('3')
    await expect(page.getByTestId('ring-total')).toHaveText('/ 3 SP')
    await expect(page.getByTestId('ring-arc')).toHaveAttribute('stroke-dasharray', '314 0')
    await expect(page.getByTestId('ring-legend').locator('> span')).toHaveText([
      '3',
      '6',
      '17',
      '0',
    ])
    await expect(page.getByTestId('kpi-acc')).toHaveText('40.5%')
    await expect(page.getByTestId('kpi-acc')).toHaveClass(/text-red-600/)
    await expect(page.getByTestId('kpi-answered')).toHaveText('79')
    await expect(page.getByTestId('kpi-grade')).toHaveText('G – C')
    await expect(page.getByTestId('encourage-box')).toContainText(
      'Jangan putus asa! Latihan konsisten akan membantu. Mulakan dengan topik yang paling lemah di bawah.',
    )
    await expect(page.getByTestId('map-caption')).toHaveText('KSSR Bahasa Melayu Darjah 4')
    await expect(page.getByTestId('map-tiles').locator('> div').first()).toHaveClass(/bg-/)
    await expect(page.getByTestId('map-legend')).toContainText('Mahir (75%+)')
    await expect(page.getByTestId('map-legend')).toContainText('Sederhana (50-74%)')
    await expect(page.getByTestId('map-legend')).toContainText('Lemah (<50%)')
    await expect(page.getByTestId('map-legend')).toContainText('Belum Cuba')
    await expect(page.getByTestId('map-legend')).toContainText('Klik untuk latihan fokus')
    await expectNoHorizontalScroll(page)
  })

  test('S7 the observed full lists: 17 BM cards, kept open on the Sejarah tab (13, bar 9), capped link', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analitik/pelajar')
    await expect(page.getByTestId('more-weak')).toContainText(
      'Masih ada topik lemah lain untuk subjek ini.',
    )
    await expect(page.getByTestId('more-count')).toHaveText('13')
    await expect(page.getByTestId('toggle-weak')).toHaveText('Lihat semua 17 topik lemah')
    await expect(page.getByTestId('all-weak')).toHaveCount(0)

    await page.getByTestId('toggle-weak').click()
    await expect(page.getByTestId('toggle-weak')).toHaveText('Sembunyi senarai penuh')
    await expect(page.getByTestId('all-weak').locator('article')).toHaveCount(17)
    const capped = page.getByTestId('all-weak').getByTestId('weak-card-194')
    await expect(capped.getByRole('link')).toHaveText('Latihan Fokus (25 soalan)')
    await expect(capped.getByRole('link')).toHaveAttribute('href', /count=25/)
    await expectNoHorizontalScroll(page)

    await page.getByTestId('tab-5').click()
    await expect(page.getByTestId('tab-5')).toHaveClass(/bg-blue-600/)
    await expect(page.getByTestId('toggle-weak')).toHaveText('Sembunyi senarai penuh')
    await expect(page.getByTestId('all-weak').locator('article')).toHaveCount(13)
    await expect(page.getByTestId('more-count')).toHaveText('9')
    await expect(page.getByTestId('all-weak').locator('article').first()).toContainText('15.3.2')

    await page.getByTestId('toggle-weak').click()
    await expect(page.getByTestId('all-weak')).toHaveCount(0)
    await expect(page.getByTestId('toggle-weak')).toHaveText('Lihat semua 13 topik lemah')
  })

  test('S7 the DSKP maps: BM 1.1 / 2.1 / 3.1 and Sejarah 1.1 / 2.1', async ({ page, gotoApp }) => {
    await gotoApp('/analitik/pelajar')
    await expect(page.getByTestId('map-tiles').locator('> div')).toHaveText(['1.1', '2.1', '3.1'])
    await page.getByTestId('tab-5').click()
    await expect(page.getByTestId('map-tiles').locator('> div')).toHaveText(['1.1', '2.1'])
  })

  test('S7 the Sejarah pane: ring 8 / 23 SP inside the circle, 35.0%, 40, G – D', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analitik/pelajar')
    await page.getByTestId('tab-5').click()
    await expect(page.getByTestId('ring-mahir')).toHaveText('8')
    await expect(page.getByTestId('ring-total')).toHaveText('/ 23 SP')
    const dash = await page.getByTestId('ring-arc').getAttribute('stroke-dasharray')
    const [filled, rest] = (dash ?? '').split(' ').map(Number)
    expect(filled).toBeGreaterThan(0)
    expect(filled).toBeLessThan(314)
    expect((filled ?? 0) + (rest ?? 0)).toBeCloseTo(314, 5)
    await expect(page.getByTestId('ring-legend').locator('> span')).toHaveText([
      '8',
      '2',
      '13',
      '0',
    ])
    await expect(page.getByTestId('kpi-acc')).toHaveText('35.0%')
    await expect(page.getByTestId('kpi-answered')).toHaveText('40')
    await expect(page.getByTestId('kpi-grade')).toHaveText('G – D')
    await expect(page.getByTestId('map-caption')).toHaveText('KSSR Sejarah Darjah 4')
    await expectNoHorizontalScroll(page)
  })

  test('S7 the legend and tabs fit the viewport (the live page overflows at 375, D-9)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/analitik/pelajar')
    await expect(page.getByTestId('map-legend')).toBeVisible()
    const box = await page.getByTestId('map-legend').boundingBox()
    const width = page.viewportSize()?.width ?? 0
    expect(box).not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
    await expectNoHorizontalScroll(page)
  })
})

for (const [id, label] of [
  [2, 'pelajar (account 2)'],
  [5, 'guru (account 5)'],
  [8, 'Admin Sekolah (account 8)'],
] as const) {
  test.describe(`M08 T2 S7 ${label}`, { tag: [moduleTag(8)] }, () => {
    test.use({ mockInit: { latency: 0 } })

    test.beforeEach(async ({ loginAs }) => {
      await loginAs(id)
    })

    test(
      'S7 shows only "Topik Perlu Perhatian Utama (0)": no tabs, no pane',
      provisional('FR-M08-53: the no-data state of S7 is PROPOSED (OQ-M08-08)'),
      async ({ page, gotoApp }) => {
        await gotoApp('/analitik/pelajar')
        await expect(page.getByTestId('top-weak')).toContainText('Topik Perlu Perhatian Utama (0)')
        await expectTabTitle(page, 'Analitik Pembelajaran')
        await expect(header(page).title).toHaveText('Analitik Pembelajaran')
        await expect(header(page).subtitle).toHaveText(S7_SUBTITLE)
        await expect(page.getByTestId('top-weak').locator('article')).toHaveCount(0)
        await expect(page.getByTestId('subject-tabs')).toHaveCount(0)
        await expect(page.getByTestId('ring-card')).toHaveCount(0)
        await expect(page.getByTestId('more-weak')).toHaveCount(0)
        await expectNoHorizontalScroll(page)
      },
    )
  })
}

test.describe('M08 T2 S6 admin', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@demo.test')
  })

  test('S6 /prestasi/1: the empty state of the admin', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/1')
    await expect(page.getByTestId('prestasi360-page')).toBeVisible()
    await expectTabTitle(page, 'Prestasi 360 — Admin Demo | PRESTASIPLUS')
    await expect(header(page).title).toHaveText('Prestasi 360')
    await expect(header(page).subtitle).toHaveText('Selamat datang kembali')
    await expect(page.getByTestId('hero-name')).toHaveText('Admin Demo')
    await expect(page.getByTestId('hero')).toContainText('Prestasi 360 — Dashboard Individu')
    await expect(page.getByTestId('avatar')).toHaveText('A')
    if (isDesktopShell(page)) {
      await expect(page.getByTestId('hero-accuracy')).toHaveText('0%')
      await expect(page.getByTestId('hero-streak')).toHaveText('1')
    } else {
      await expect(page.getByTestId('hero-mini')).toBeHidden()
    }
    await expect(statValues(page)).toHaveText(['0', '0.0%', '0', '0m'])
    await expect(page.getByTestId('headcount-block')).toHaveCount(0)
    await expect(page.getByTestId('badges-card')).toHaveCount(0)
    await expect(page.getByTestId('mastery-empty')).toContainText('Belum ada data latihan.')
    await expect(page.getByTestId('mastery-start')).toHaveAttribute('href', '/practice')
    // M14: streak 1, best 5, Koin 256 (DV-M14-09); practice days 13 (§6.10).
    await expect(activityValues(page)).toHaveText(['1', '5', '256', '13'])
    await expect(page.getByTestId('weak-empty')).toContainText('Tiada topik lemah! Teruskan usaha.')
    await expect(page.getByTestId('suggestions')).toContainText(
      'Sudah 127 hari tiada latihan. Mulakan semula dengan 10 soalan mudah untuk pemanasan.',
    )
    await expect(page.getByTestId('suggestions')).toContainText(
      'Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!',
    )
    await expectNoHorizontalScroll(page)
  })

  test('S6 the heatmap has 90 cells and the tooltip toggles on click', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/1')
    await expect(page.getByTestId('heat-cell')).toHaveCount(90)
    await expect(page.getByTestId('heatmap-card')).toContainText('sesi/hari')
    await expect(page.getByTestId('heat-tooltip')).toHaveCount(0)
    const first = page.getByTestId('heat-cell').first()
    await first.click()
    await expect(page.getByTestId('heat-tooltip')).toHaveText('28/06 (Ahad) — Tiada aktiviti')
    await first.click()
    await expect(page.getByTestId('heat-tooltip')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('S6 the hero name is white on the gradient', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/1')
    await expect(page.getByTestId('hero-name')).toHaveCSS('color', 'rgb(255, 255, 255)')
  })

  test('S6 /prestasi/3001: 3 sessions, 14 answers, 85.7%, 14m; Kimia 89% and Sejarah 80%', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/3001')
    await expect(page.getByTestId('prestasi360-page')).toBeVisible()
    await expect(statValues(page)).toHaveText(['3', '85.7%', '14', '14m'])
    const chem = page.getByTestId('mastery-CHEM')
    await expect(chem).toContainText('CH')
    await expect(chem).toContainText('Kimia')
    await expect(chem).toContainText('89%')
    await expect(chem).toContainText('2 sesi · 9 soalan')
    await expect(chem.getByTestId('pct')).toHaveClass(/text-green-600/)
    const sej = page.getByTestId('mastery-SEJ')
    await expect(sej).toContainText('SE')
    await expect(sej).toContainText('80%')
    await expect(sej).toContainText('1 sesi · 5 soalan')
    await expect(sej.getByTestId('pct')).toHaveClass(/text-green-600/)
    await expect(page.getByTestId('activity-card')).toContainText('Hari Latihan')

    const name = await page.getByTestId('hero-name').innerText()
    await expectTabTitle(page, `Prestasi 360 — ${name} | PRESTASIPLUS`)

    await expect(page.getByTestId('headcount-block')).toContainText('Headcount — Prestasi SPM')
    await expect(
      page.getByTestId('headcount-block').getByRole('link', { name: 'Lihat Penuh' }).first(),
    ).toHaveAttribute('href', '/headcount/student/3001')
    await expectNoHorizontalScroll(page)
  })

  test('S6 /prestasi/3008: the weakest learner, the weak topic and its Fokus link', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/3008')
    // 1 of 8 correct = 12.5 %, shown rounded on the tile and to 1 decimal in "Cadangan".
    await expect(page.getByTestId('mastery-CHEM')).toContainText('13%')
    await expect(page.getByTestId('suggestions')).toContainText(
      'Tingkatkan prestasi Kimia (purata 12.5%) dengan 3 sesi latihan fokus minggu ini.',
    )
    const rows = page.getByTestId('weak-list').locator('li')
    await expect(rows.first()).toContainText('Fokus')
    await expect(rows.first().getByRole('link')).toHaveAttribute(
      'href',
      /^\/practice\/CHEM\/quiz\?level=11&dskp_sp_id=\d+&count=\d+$/,
    )
    await expect(page.getByTestId('weak-block')).toContainText(
      'Klik untuk buka set latihan tertumpu pada topik lemah itu sahaja.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('S6 /prestasi/3201: five headcount cards in order, chips that wrap, three badges', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/3201')
    const cards = page.getByTestId('headcount-block').locator('article')
    await expect(cards).toHaveCount(5)
    const order = ['Sejarah', 'Matematik', 'Bahasa Melayu', 'Sains', 'Bahasa Inggeris']
    const pills = ['Below', 'Below', 'On Track', '—', 'On Track']
    for (let i = 0; i < 5; i++) {
      await expect(cards.nth(i).locator('h3')).toHaveText(order[i]!)
      await expect(cards.nth(i)).toContainText('4 Simulasi · 2026')
      await expect(cards.nth(i).getByTestId('status-pill')).toHaveText(pills[i]!)
    }
    await expect(cards.nth(0).getByTestId('chip')).toHaveText(['TOV: 67%', 'OTR3: 56%', 'ETR: 56%'])
    await expect(cards.nth(3).getByTestId('chip')).toHaveText(['TOV: 70%', 'OTR3: 61%', 'ETR: 61%'])
    await expect(cards.nth(3).getByTestId('chip').nth(1)).toHaveClass(/bg-red-50/)
    await expect(cards.nth(2).getByTestId('chip').nth(1)).toHaveClass(/bg-green-50/)

    await expect(page.getByTestId('badges-card')).toContainText('Lencana (3)')
    await expect(page.getByTestId('badge')).toHaveCount(3)
    await expect(page.getByTestId('badge').nth(0)).toHaveAttribute('title', 'Pemula Rajin')
    await expect(page.getByTestId('badge').nth(1)).toHaveAttribute('title', 'Pelajar Aktif')
    await expect(page.getByTestId('badge').nth(2)).toHaveAttribute('title', 'Pengumpul')

    await expect(page.getByTestId('suggestions')).toContainText(
      'Belum ada sesi latihan lagi. Mulakan dengan subjek yang paling kamu minati!',
    )
    await expect(page.getByTestId('suggestions')).toContainText(
      'Sejarah OTR3: markah sebenar (56.00) masih 26 mata di bawah sasaran (82.00). Fokus latihan untuk kejar target.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('S6 an unknown id is the standard 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/99999999')
    await expectNotFound(page)
  })

  test('S6 only digits match: /prestasi/tingkatan and /prestasi/kelas still open their pages', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/tingkatan')
    await expect(page.getByTestId('tingkatan-pilih-page')).toBeVisible()
    await gotoApp('/prestasi/kelas')
    await expect(page.getByTestId('kelas-empty')).toBeVisible()
    await gotoApp('/prestasi/abc')
    await expectNotFound(page)
  })

  test('S6 the back control goes back in the browser history', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/sekolah')
    await expect(page.getByTestId('prestasi-sekolah-page')).toBeVisible()
    await page.evaluate(() => {
      window.history.pushState({}, '', '/prestasi/1')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByTestId('prestasi360-page')).toBeVisible()
    await page.getByTestId('back').click()
    await expect(page.getByTestId('prestasi-sekolah-page')).toBeVisible()
  })
})

test.describe('M08 T2 S6 other roles (§9)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'pelajar opens the own Prestasi 360 and gets the 403 page for another pupil',
    provisional('§9: the pelajar S6 access (self only) is INFERRED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(2)
      await gotoApp('/prestasi/2')
      await expect(page.getByTestId('prestasi360-page')).toBeVisible()
      await expect(header(page).title).toHaveText('Prestasi 360')
      await expectNoHorizontalScroll(page)
      await gotoApp('/prestasi/3001')
      await expectForbidden(page)
    },
  )

  test(
    'guru opens a pupil of the own class and gets the 403 page for another pupil',
    provisional('§9: the guru S6 access (pupils of own classes) is INFERRED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(5)
      await gotoApp('/prestasi/3001')
      await expect(page.getByTestId('prestasi360-page')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await gotoApp('/prestasi/3201')
      await expectForbidden(page)
    },
  )

  test(
    'Admin Sekolah opens a pupil of the own school and gets the 403 page for another school',
    provisional('§9: the Admin Sekolah S6 access (pupils of the own school) is INFERRED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(8)
      await gotoApp('/prestasi/3001')
      await expect(page.getByTestId('prestasi360-page')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await gotoApp('/prestasi/3201')
      await expectForbidden(page)
    },
  )
})

test.describe('M08 T2 guest', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const path of ['/analitik/pelajar', '/prestasi/1']) {
    test(`${path} goes to /login without a session`, async ({ page, gotoApp }) => {
      await gotoApp(path)
      await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    })
  }
})
