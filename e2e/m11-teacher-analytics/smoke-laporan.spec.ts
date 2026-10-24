/**
 * M11 S1 `/guru/laporan` and S6 `/guru/analisis-item` at 375 / 768 / 1280 (M11-T2; SRS M11 §12:
 * E2E-M11-01 (S1/S6 part), 03, 04 (S1/S6 part), 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 43, 44, 48).
 * Accounts: the admin (no class: zero state) and 5 guru (`guru@demo.test`: classes 2001 Kimia and 2002
 * Sejarah, members 3001-3008). Teacher figures, populated lists and the S6 table are INFERRED /
 * PROPOSED (SRS §8.2), so those tests are `@provisional`. Other roles are refused by the M10 §7 **T**
 * guard: the router sends them to their landing page (the API 403 is covered by the T1 handler tests; a
 * raw page fetch bypasses the in-process mock, so it cannot probe it).
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  provisional,
} from '../support'

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(11)] }

test.use({ mockInit: { latency: 0 } })

/**
 * Landing path per role (M01 BR-07, `src/mock/auth/landing.ts`; not imported: that file pulls `@/` aliases the e2e
 * tsconfig does not resolve).
 */
const LANDING: Record<string, string> = {
  'adminsekolah@demo.test': '/dashboard',
  'pelajar@demo.test': '/dashboard',
  'ibubapa@demo.test': '/dashboard',
  'penaja@demo.test': '/dashboard',
  'ppd@demo.test': '/ppd/dashboard',
  'jpn@demo.test': '/jpn/dashboard',
}

const S1 = '/guru/laporan'
const S6 = '/guru/analisis-item'

/** 44px below lg; from lg the live size (pill 28, select 43, Reset 20; M03 precedent lg:min-h-0). */
async function expectTargetBelowLg(page: Page, locator: Locator): Promise<void> {
  if (!isDesktopShell(page)) return expectTouchTarget(locator)
  const box = await locator.boundingBox()
  expect(box!.height).toBeLessThan(44)
}

async function expectHeader(page: Page, title: string, subtitle: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(subtitle)
}

async function s1Header(page: Page): Promise<void> {
  await expectTabTitle(page, 'Laporan Statistik - Portal Guru')
  await expectHeader(page, 'Laporan Statistik', 'Pantau penglibatan dan prestasi pelajar')
}

async function s6Header(page: Page): Promise<void> {
  await expectTabTitle(page, 'Analisis Item Soalan - Portal Guru')
  await expectHeader(
    page,
    'Analisis Item Soalan',
    'Kenal pasti soalan yang sukar dan indeks diskriminasi',
  )
}

const value = (page: Page, card: string) => page.getByTestId(card).getByTestId('card-value')

/** The chart config published by `ChartCanvas` (dev / e2e registry). */
async function chartOf(page: Page, id: string) {
  return page.evaluate((key) => {
    const c = (
      window as unknown as {
        __charts?: Record<
          string,
          {
            type: string
            data: { labels: string[]; datasets: { data: number[]; label: string }[] }
            options: {
              plugins?: { legend?: { display?: boolean } }
              scales?: { y?: { beginAtZero?: boolean; ticks?: { stepSize?: number } } }
            }
          }
        >
      }
    ).__charts?.[key]
    return c
      ? {
          type: c.type,
          labels: c.data.labels,
          data: c.data.datasets[0]!.data,
          label: c.data.datasets[0]!.label,
          legend: c.options.plugins?.legend?.display,
          yBegin: c.options.scales?.y?.beginAtZero,
          yStep: c.options.scales?.y?.ticks?.stepSize,
        }
      : null
  }, id)
}

test.describe('M11 S1 Laporan Statistik: admin', MODULE, () => {
  test('E2E-M11-01/07 header, filter, pills, 30 Hari default and unknown range @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await s1Header(page)
    await expect(page.getByTestId('laporan-page')).toContainText('Tapis:')
    await expect(page.locator('[data-testid="filter-classroom"] option')).toHaveText([
      'Semua Kelas',
    ])
    await expect(page.locator('[data-testid="range-pills"] a')).toHaveText([
      '7 Hari',
      '30 Hari',
      '3 Bulan',
    ])
    await expect(page.getByTestId('range-30')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('range-7')).toHaveAttribute('href', '/guru/laporan?range=7')
    await expect(page.getByTestId('range-90')).toHaveAttribute('href', '/guru/laporan?range=90')
    await expectTargetBelowLg(page, page.getByTestId('filter-classroom'))
    await expectTargetBelowLg(page, page.getByTestId('range-7'))
    await expectNoHorizontalScroll(page)

    await gotoApp(`${S1}?range=999`)
    await expect(page.getByTestId('range-30')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('card-aktiviti')).toContainText('30 hari lepas')
  })

  test('E2E-M11-09 zero cards: no red line, "-%", range labels @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await s1Header(page)
    for (const id of ['card-login', 'card-latihan']) {
      await expect(value(page, id)).toHaveText('0%')
      await expect(page.getByTestId(id)).toContainText('0 / 0 pelajar')
      await expect(page.getByTestId(id)).toContainText('Klik untuk lihat senarai')
    }
    await expect(page.getByTestId('card-login-missing')).toHaveCount(0)
    await expect(page.getByTestId('card-login')).toContainText('Pernah Log Masuk')
    await expect(page.getByTestId('card-latihan')).toContainText('Pernah Buat Latihan')
    await expect(value(page, 'card-aktiviti')).toHaveText('0')
    await expect(page.getByTestId('card-aktiviti')).toContainText('30 hari lepas')
    await expect(page.getByTestId('card-aktiviti')).toContainText('Klik untuk lihat pecahan')
    await expect(value(page, 'card-skor')).toHaveText('-%')
    await expect(page.getByTestId('card-skor')).toContainText('Skor Purata')

    await gotoApp(`${S1}?range=7`)
    await expect(page.getByTestId('range-7')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('card-aktiviti')).toContainText('7 hari lepas')
    await expect(page.getByTestId('trend-range')).toHaveText('7 hari lepas')
    await gotoApp(`${S1}?range=90`)
    await expect(page.getByTestId('card-aktiviti')).toContainText('90 hari lepas')
    await expect(page.getByTestId('trend-range')).toHaveText('90 hari lepas')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M11-11 panels open, switch and close with the ring; zero copy @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    const login = page.getByTestId('card-login')
    await expect(page.getByTestId('panel-login')).toHaveCount(0)
    await login.click()
    await expect(page.getByTestId('panel-login')).toContainText('Pelajar Belum Pernah Log Masuk (0)')
    await expect(page.getByTestId('panel-login')).toContainText('Semua pelajar sudah pernah log masuk!')
    await expect(login).toHaveClass(/ring-blue-400/)

    await page.getByTestId('card-latihan').click()
    await expect(page.getByTestId('panel-login')).toHaveCount(0)
    await expect(page.getByTestId('panel-latihan')).toContainText(
      'Pelajar Belum Pernah Buat Latihan (0)',
    )
    await expect(page.getByTestId('panel-latihan')).toContainText(
      'Semua pelajar sudah aktif buat latihan!',
    )
    await expect(page.getByTestId('card-latihan')).toHaveClass(/ring-emerald-400/)

    await page.getByTestId('card-latihan').click()
    await expect(page.getByTestId('panel-latihan')).toHaveCount(0)
    await expect(page.getByTestId('card-latihan')).not.toHaveClass(/ring-2/)

    await gotoApp(`${S1}?range=7`)
    await page.getByTestId('card-aktiviti').click()
    await expect(page.getByTestId('panel-title')).toHaveText('Pecahan Aktiviti (7 Hari Lepas)')
    await expect(page.getByTestId('card-aktiviti')).toHaveClass(/ring-purple-400/)
    await expect(
      page.locator('[data-testid="panel-aktiviti"] [data-testid="tile-value"]'),
    ).toHaveText(['0', '0', '0', '0', '0', '0', '0'])
    await expect(page.getByTestId('panel-aktiviti')).toContainText('Permainan')
    await expectNoHorizontalScroll(page)

    await page.getByTestId('card-skor').click()
    const skor = page.getByTestId('panel-skor')
    await expect(skor).toContainText('Pecahan Skor Purata')
    await expect(page.locator('[data-testid="panel-skor"] [data-testid="bar-value"]')).toHaveText([
      '-%',
      '-%',
      '-%',
      '-%',
      '-%',
    ])
    await expect(skor).not.toContainText('Permainan')
    await expect(page.getByTestId('card-skor')).toHaveClass(/ring-amber-400/)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M11-13 trend chart: 30 labels 27/08 to 25/09, all zero, y from 0 step 1, no legend @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await expect(page.getByTestId('trend-card')).toContainText('Trend Aktiviti')
    await expect(page.getByTestId('trend-card')).toContainText('30 hari lepas')
    await expect.poll(() => chartOf(page, 'laporan-trend-chart')).not.toBeNull()
    const chart = (await chartOf(page, 'laporan-trend-chart'))!
    expect(chart.type).toBe('line')
    expect(chart.label).toBe('Aktiviti')
    expect(chart.labels).toHaveLength(30)
    expect(chart.labels[0]).toBe('27/08')
    expect(chart.labels.at(-1)).toBe('25/09')
    expect(chart.data.every((n) => n === 0)).toBe(true)
    expect(chart.legend).toBe(false)
    expect(chart.yBegin).toBe(true)
    expect(chart.yStep).toBe(1)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M11-15 lists: empty copy and no horizontal overflow @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S1)
    await expect(page.getByTestId('list-active')).toContainText('Paling Aktif')
    await expect(page.getByTestId('list-active-empty')).toHaveText('Belum ada aktiviti')
    await expect(page.getByTestId('list-idle')).toContainText('Belum Pernah Buat Latihan')
    await expect(page.getByTestId('list-idle-empty')).toHaveText(
      'Semua pelajar sudah aktif buat latihan!',
    )
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M11 S1 Laporan Statistik: teacher', MODULE, () => {
  test(
    'E2E-M11-08 class filter keeps the range; a range pill drops the class',
    provisional('teacher options are INFERRED (FN-M11-2.1.1)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(`${S1}?range=7`)
      await s1Header(page)
      await expect(page.locator('[data-testid="filter-classroom"] option')).toHaveText([
        'Semua Kelas',
        '5 MARIKH - Kimia',
        '5 MARIKH - Sejarah',
      ])
      await page.getByTestId('filter-classroom').selectOption({ label: '5 MARIKH - Kimia' })
      await expect(page).toHaveURL(/\/guru\/laporan\?range=7&classroom_id=2001$/)
      await expect(page.getByTestId('filter-classroom')).toHaveValue('2001')
      await expect(page.getByTestId('range-7')).toHaveAttribute('data-active', 'true')
      await page.getByTestId('range-90').click()
      await expect(page).toHaveURL(/\/guru\/laporan\?range=90$/)
      await expect(page.getByTestId('filter-classroom')).toHaveValue('')
      await expect(page.getByTestId('range-90')).toHaveAttribute('data-active', 'true')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M11-10 Semua Kelas 30 days: 100 %, 8 / 8, 14 activities, 46 %; class 2001 and 2002 equal; 7 days = 7',
    provisional('teacher figures are designed seeds (SRS §6.8)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      for (const id of ['card-login', 'card-latihan']) {
        await expect(value(page, id)).toHaveText('100%')
        await expect(page.getByTestId(id)).toContainText('8 / 8 pelajar')
      }
      await expect(page.getByTestId('card-login-missing')).toHaveCount(0)
      await expect(value(page, 'card-aktiviti')).toHaveText('14')
      await expect(value(page, 'card-skor')).toHaveText('46%')

      for (const id of ['2001', '2002']) {
        await gotoApp(`${S1}?range=30&classroom_id=${id}`)
        await expect(page.getByTestId('filter-classroom')).toHaveValue(id)
        await expect(page.getByTestId('card-login')).toContainText('8 / 8 pelajar')
        await expect(value(page, 'card-aktiviti')).toHaveText('14')
        await expect(value(page, 'card-skor')).toHaveText('46%')
      }

      await gotoApp(`${S1}?range=7`)
      await expect(value(page, 'card-aktiviti')).toHaveText('7')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M11-12 panels: tiles 14/0/0/0/0/0/14, score 46 % and four "-%", login and latihan "(0)"',
    provisional('teacher figures are designed seeds (SRS §6.8)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      await page.getByTestId('card-aktiviti').click()
      await expect(
        page.locator('[data-testid="panel-aktiviti"] [data-testid="tile-value"]'),
      ).toHaveText(['14', '0', '0', '0', '0', '0', '14'])
      await page.getByTestId('card-skor').click()
      await expect(page.locator('[data-testid="panel-skor"] [data-testid="bar-value"]')).toHaveText(
        ['46%', '-%', '-%', '-%', '-%'],
      )
      await page.getByTestId('card-login').click()
      await expect(page.getByTestId('panel-login')).toContainText('Pelajar Belum Pernah Log Masuk (0)')
      await expect(page.getByTestId('panel-login')).toContainText(
        'Semua pelajar sudah pernah log masuk!',
      )
      await page.getByTestId('card-latihan').click()
      await expect(page.getByTestId('panel-latihan')).toContainText(
        'Pelajar Belum Pernah Buat Latihan (0)',
      )
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M11-14 trend values: 15/09 4, 18/09 3, 22/09 4, 24/09 3, 0 elsewhere',
    provisional('teacher figures are designed seeds (SRS §6.8)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      await expect.poll(() => chartOf(page, 'laporan-trend-chart')).not.toBeNull()
      const chart = (await chartOf(page, 'laporan-trend-chart'))!
      const byDate = Object.fromEntries(chart.labels.map((l, i) => [l, chart.data[i]]))
      expect(byDate['15/09']).toBe(4)
      expect(byDate['18/09']).toBe(3)
      expect(byDate['22/09']).toBe(4)
      expect(byDate['24/09']).toBe(3)
      expect(chart.data.reduce((a, b) => a + b, 0)).toBe(14)
    },
  )

  test(
    'E2E-M11-16 lists: empty latihan copy and "Paling Aktif" with 8 rows, Murid Demo 01 and 02 first',
    provisional('"Paling Aktif" populated layout is PROPOSED (FR-M11-23)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      await expect(page.getByTestId('list-idle-empty')).toHaveText(
        'Semua pelajar sudah aktif buat latihan!',
      )
      const rows = page.locator('[data-testid="list-active-rows"] [data-testid="student-row"]')
      await expect(rows).toHaveCount(8)
      await expect(rows.nth(0).getByTestId('student-name')).toHaveText('Murid Demo 01')
      await expect(rows.nth(0).getByTestId('student-activities')).toHaveText('3 aktiviti')
      await expect(rows.nth(1).getByTestId('student-name')).toHaveText('Murid Demo 02')
      await expect(rows.nth(1).getByTestId('student-activities')).toHaveText('3 aktiviti')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M11-48 S1 grid columns per width; no text under 12px inside main (DV-M11-23)',
    provisional('teacher populated state'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      await expect(page.getByTestId('summary-cards')).toBeVisible()
      await page.getByTestId('card-aktiviti').click()
      await expect(page.getByTestId('panel-aktiviti')).toBeVisible()
      const cols = await page
        .getByTestId('summary-cards')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      const width = page.viewportSize()!.width
      expect(cols).toBe(width >= 1024 ? 5 : 2)
      const tiles = await page
        .getByTestId('panel-aktiviti')
        .locator('[data-testid^="tile-"]:not([data-testid="tile-value"])')
        .evaluateAll((els) => {
          const first = (els[0] as HTMLElement).getBoundingClientRect().top
          return els.filter(
            (e) => Math.abs((e as HTMLElement).getBoundingClientRect().top - first) < 2,
          ).length
        })
      expect(tiles).toBe(width >= 1024 ? 7 : width >= 640 ? 3 : 2)
      const small = await page.locator('main').evaluate((main) => {
        const bad: string[] = []
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent?.trim()) continue
          const el = n.parentElement!
          if (el.closest('canvas, select, option')) continue
          const size = parseFloat(getComputedStyle(el).fontSize)
          if (size < 12) bad.push(`${size}px: ${n.textContent.trim().slice(0, 40)}`)
        }
        return bad
      })
      expect(small).toEqual([])
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M11-15 long e-mail: the e-mail truncates and the page does not scroll sideways',
    provisional('teacher list rows and the long e-mail are PROPOSED / injected (FR-M11-24, 25)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      const emails = page.locator('[data-testid="list-active-rows"] [data-testid="student-email"]')
      await expect(emails.first()).toBeVisible()
      // seeded e-mails are short (no seeded student has a long one): inject a 120-character e-mail
      await emails.first().evaluate((el) => {
        el.textContent = 'a'.repeat(110) + '@demo.test'
      })
      const m = await emails.first().evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
        overflow: getComputedStyle(el).textOverflow,
        nowrap: getComputedStyle(el).whiteSpace,
      }))
      expect(m.overflow).toBe('ellipsis')
      expect(m.nowrap).toBe('nowrap')
      expect(m.scroll).toBeGreaterThan(m.client)
      const width = page.viewportSize()!.width
      const box = await emails.first().boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M11-15 seeded e-mails fit their line (scrollWidth <= clientWidth)',
    provisional('teacher list rows are PROPOSED (FR-M11-23)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S1)
      const emails = page.locator('[data-testid="list-active-rows"] [data-testid="student-email"]')
      await expect(emails).toHaveCount(8)
      const fits = await emails.evaluateAll((els) =>
        els.every((e) => e.scrollWidth <= e.clientWidth),
      )
      expect(fits).toBe(true)
      await expectNoHorizontalScroll(page)
    },
  )

  test('E2E-M11-06 the S1 header and tab title render for the teacher (user shell) @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp(S1)
    await s1Header(page)
    await expect(page.locator('[data-layout="user"]')).toHaveCount(1)
    await expect(page.getByTestId('card-login')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M11 S6 Analisis Item Soalan: admin', MODULE, () => {
  test('E2E-M11-43 filter, legend, empty card, no Reset; choose a subject @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S6)
    await s6Header(page)
    await expect(page.getByTestId('analisis-item-page')).toContainText('Tapis:')
    await expect(page.getByTestId('analisis-item-page')).toContainText('Mata Pelajaran')
    const subjects = await page.locator('[data-testid="filter-subject"] option').allTextContents()
    expect(subjects).toHaveLength(32)
    expect(subjects[0]).toBe('Semua Subjek')
    const names = subjects.slice(1).map((s) => s.trim())
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, 'ms', { sensitivity: 'base' })),
    )
    expect(names).toContain('Bahasa Melayu')
    await expect(page.locator('[data-testid="filter-classroom"] option')).toHaveText([
      'Semua Kelas',
    ])
    const legend = page.getByTestId('item-legend')
    await expect(legend).toContainText('> 70% (Mudah)')
    await expect(legend).toContainText('40–70% (Sederhana)')
    await expect(legend).toContainText('< 40% (Sukar)')
    await expect(legend).toContainText('Diskriminasi: >0.3 = baik, <0 = semak semula')
    await expect(page.getByTestId('item-empty')).toContainText(
      'Tiada data analisis item untuk paparan ini.',
    )
    await expect(page.getByTestId('item-empty')).toContainText(
      'Pelajar perlu membuat latihan dahulu.',
    )
    await expect(page.getByTestId('filter-reset')).toHaveCount(0)
    await expectTargetBelowLg(page, page.getByTestId('filter-subject'))
    await expectTargetBelowLg(page, page.getByTestId('filter-classroom'))
    await expectNoHorizontalScroll(page)

    await page.getByTestId('filter-subject').selectOption({ label: 'Bahasa Melayu' })
    await expect(page).toHaveURL(/\/guru\/analisis-item\?subject_id=1&classroom_id=$/)
    await expect(page.getByTestId('filter-subject')).toHaveValue('1')
    await expect(page.getByTestId('filter-reset')).toBeVisible()
    await expectTargetBelowLg(page, page.getByTestId('filter-reset'))
    await expect(page.getByTestId('item-empty')).toBeVisible()
    await page.getByTestId('filter-reset').click()
    await expect(page).toHaveURL(/\/guru\/analisis-item$/)
    await expect(page.getByTestId('filter-reset')).toHaveCount(0)
    await expect(page.getByTestId('filter-subject')).toHaveValue('')
  })

  test('E2E-M11-43 classroom_id=228 stays empty and keeps "Semua Kelas" @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${S6}?classroom_id=228`)
    await expect(page.getByTestId('item-empty')).toBeVisible()
    await expect(page.getByTestId('filter-classroom')).toHaveValue('')
    await expect(page.getByTestId('filter-reset')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('S6 at this width: filter stacks below sm, selects side by side from sm; legend wraps @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(S6)
    await expect(page.getByTestId('item-empty')).toBeVisible()
    const [a, b] = await Promise.all([
      page.getByTestId('filter-subject').boundingBox(),
      page.getByTestId('filter-classroom').boundingBox(),
    ])
    if (isMobileWidth(page)) {
      expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1)
      expect(a!.width).toBeGreaterThan(page.viewportSize()!.width * 0.7)
    } else {
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
    }
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M11 S6 Analisis Item Soalan: teacher', MODULE, () => {
  test(
    'E2E-M11-44 class 2001: 8 rows, % betul, band colours and discrimination labels',
    provisional('populated S6 table is PROPOSED (FR-M11-80)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(`${S6}?subject_id=&classroom_id=2001`)
      await s6Header(page)
      await expect(page.locator('[data-testid="filter-classroom"] option')).toHaveText([
        'Semua Kelas',
        '5 MARIKH - Kimia',
        '5 MARIKH - Sejarah',
      ])
      await expect(page.getByTestId('filter-classroom')).toHaveValue('2001')
      await expect(page.getByTestId('filter-reset')).toBeVisible()
      const rows = page.getByTestId('item-row')
      await expect(rows).toHaveCount(8)
      // M08 anchors Q1-Q8: p 75, 50, 60, 25, 12.5, 12.5, 50, 50 (ordered % betul ascending)
      await expect(rows.getByTestId('item-pct')).toHaveText([
        '12.5%',
        '12.5%',
        '25%',
        '50%',
        '50%',
        '50%',
        '60%',
        '75%',
      ])
      await expect(rows.nth(0)).toHaveAttribute('data-band', 'sukar')
      await expect(rows.nth(0).getByTestId('item-dot')).toHaveClass(/bg-red-500/)
      await expect(rows.nth(3)).toHaveAttribute('data-band', 'sederhana')
      await expect(rows.nth(3).getByTestId('item-dot')).toHaveClass(/bg-amber-400/)
      await expect(rows.nth(7)).toHaveAttribute('data-band', 'mudah')
      await expect(rows.nth(7).getByTestId('item-dot')).toHaveClass(/bg-emerald-500/)
      await expect(
        page.getByTestId('item-disc-note').filter({ hasText: 'semak semula' }),
      ).toHaveCount(1)
      await expect(page.getByTestId('item-disc-note').filter({ hasText: 'baik' })).toHaveCount(5)
      await expect(page.getByTestId('item-empty')).toHaveCount(0)
      // the table scrolls inside its card, never the page
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M11-44 Semua Kelas shows every answered question; the card pattern is gone',
    provisional('populated S6 table is PROPOSED (FR-M11-80)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(S6)
      await expect(page.getByTestId('item-table')).toBeVisible()
      expect(await page.getByTestId('item-row').count()).toBeGreaterThanOrEqual(8)
      await expect(page.getByTestId('filter-reset')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M11 S1 / S6 access', MODULE, () => {
  test('E2E-M11-03 a guest is sent to /login @m11', async ({ page, gotoApp }) => {
    for (const path of [S1, S6]) {
      await gotoApp(path)
      await expect(page).toHaveURL('/login')
    }
  })

  test('E2E-M11-04 unknown sub-paths give the 404 page @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const path of ['/guru/laporan/4', '/guru/analisis-item/1']) {
      await gotoApp(path)
      await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
      await expect(page).toHaveURL(path)
    }
  })

  for (const who of [
    'adminsekolah@demo.test',
    'pelajar@demo.test',
    'ibubapa@demo.test',
    'penaja@demo.test',
    'ppd@demo.test',
    'jpn@demo.test',
  ]) {
    test(`role refusal: ${who} is redirected from S1 and S6 to its role landing path (the page never renders) @m11`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      const landing = LANDING[who]!
      await loginAs(who)
      for (const path of [S1, S6]) {
        await gotoApp(path)
        await expect(page).toHaveURL(landing)
        await expect(page.getByTestId('laporan-page')).toHaveCount(0)
        await expect(page.getByTestId('analisis-item-page')).toHaveCount(0)
      }
    })
  }
})
