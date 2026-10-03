/**
 * M17-T3a S4-S7 Command Center drill-down as the admin at 375 / 768 / 1280 (SRS M17 §12: E2E-M17-07 for
 * S4-S7, 55-69). Anchors (XR-M17-02, landed in M05): 8082 549 / 393 / 130,233 / 82.3%, 8080 185 / 174 / 53,494 /
 * 81.7%, class 370 30 members / 8 active / 13,641 / 79.0%, pupil 2022 2,378 / 93.5%, 123 sessions, week 21/09
 * 23 sessions / 452 / 99.6%. Other counts are asserted as "heading count = row count".
 * E2E-M17-70 (the teacher mount) belongs to M10-T4's spec.
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const MODULE = { tag: [moduleTag(17)] }
const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'
const CC = '/admin/command-center'

test.use({ mockInit: { latency: 0 } })
test.beforeEach(async ({ loginAs }) => {
  await loginAs('admin@demo.test')
})

/** "(68)" of "Senarai Guru (68)". */
function countOf(heading: string): number {
  const m = /\((\d+)\)\s*$/.exec(heading)
  if (!m) throw new Error(`no count in "${heading}"`)
  return Number(m[1])
}

async function expectHeader(page: Page, backLabel: string): Promise<void> {
  await expect(page.getByTestId('cc-title')).toHaveText('PrestasiPlus Command Center')
  await expect(page.getByTestId('cc-back')).toHaveText(backLabel)
  await expect(page.getByTestId('cc-breadcrumb').getByRole('link').first()).toHaveText(
    'Command Center',
  )
  // standalone page: no shell
  await expect(page.getByTestId('shell-admin-sidebar')).toHaveCount(0)
  await expect(page.getByTestId('shell-user-sidebar')).toHaveCount(0)
}

async function expectNotFound(page: Page): Promise<void> {
  const root = page.locator('[data-page=not-found]')
  await expect(root).toBeVisible()
  await expectTabTitle(page, NOT_FOUND_TITLE)
  await expect(root).toContainText('Halaman Tidak Dijumpai')
  await expect(root).toContainText(
    'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
  )
}

/** A scroller scrolls inside its card (mobile) or fits (tablet, desktop), never the page. */
async function scrollState(
  scroller: Locator,
): Promise<{ scrolls: boolean; sw: number; cw: number }> {
  return scroller.evaluate((el) => ({
    scrolls: el.scrollWidth > el.clientWidth + 1,
    sw: el.scrollWidth,
    cw: el.clientWidth,
  }))
}

test.describe('S4 school', MODULE, () => {
  test('E2E-M17-55 header, breadcrumb, cards, teacher list and the row click to S5', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/school/8082`)
    await expect(page.getByTestId('cc-teacher-row').first()).toBeVisible()
    await expectHeader(page, '← Kembali ke Overview')
    await expect(page.getByTestId('cc-back')).toHaveAttribute('href', CC)
    await expect(page.getByTestId('cc-crumb-current')).toHaveText(/\S/)
    const name = (await page.getByTestId('cc-crumb-current').innerText()).trim()
    await expectTabTitle(page, `${name} - Command Center`)

    const labels = await page
      .getByTestId('cc-stat')
      .evaluateAll((els) => els.map((e) => e.firstElementChild?.textContent.trim()))
    expect(labels).toEqual(['Jumlah Pelajar', 'Pelajar Aktif', 'Jumlah Jawapan', 'Ketepatan'])
    await expect(page.getByTestId('cc-stat-value')).toHaveText(['549', '393', '130,233', '82.3%'])

    const heading = ((await page.getByTestId('cc-panel-title').textContent()) ?? '').trim()
    expect(heading).toMatch(/^Senarai Guru \(\d+\)$/)
    await expect(page.getByTestId('cc-teacher-row')).toHaveCount(countOf(heading))
    const head = await page.getByTestId('cc-teachers-table').locator('th').allInnerTexts()
    expect(head.map((h) => h.toLowerCase())).toEqual([
      '#',
      'nama guru',
      'subjek',
      'kelas',
      'pelajar',
      'aktif (30h)',
    ])

    const first = page.getByTestId('cc-teacher-row').first()
    const userId = await first.getAttribute('data-user-id')
    await first.click()
    await expect(page).toHaveURL(new RegExp(`${CC}/school/8082/teacher/${userId}$`))
    await expect(page.getByTestId('cc-info')).toContainText('Sekolah:')
  })

  test('E2E-M17-56 school 8080 lists teacher 1919 with their classes', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/school/8080`)
    const row = page.locator('[data-testid=cc-teacher-row][data-user-id="1919"]')
    await expect(row).toBeVisible()
    await expect(page.getByTestId('cc-stat-value')).toHaveText(['185', '174', '53,494', '81.7%'])
    await expect(row.locator('td').nth(3)).toHaveText('7')
  })
})

test.describe('S5 teacher', MODULE, () => {
  test('E2E-M17-57 teacher 1919 (class rows), 4402, and 4418 "Tiada kelas aktif"', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/school/8080/teacher/1919`)
    await expect(page.getByTestId('cc-class-row').first()).toBeVisible()
    await expectHeader(page, '← Kembali ke Sekolah')
    await expect(page.getByTestId('cc-back')).toHaveAttribute('href', `${CC}/school/8080`)
    await expect(page.getByTestId('cc-info')).toContainText('Sekolah:')
    const heading = ((await page.getByTestId('cc-panel-title').textContent()) ?? '').trim()
    expect(heading).toMatch(/^Senarai Kelas \(\d+\)$/)
    await expect(page.getByTestId('cc-class-row')).toHaveCount(countOf(heading))
    const head = await page.getByTestId('cc-classes-table').locator('th').allInnerTexts()
    expect(head.map((h) => h.toLowerCase())).toEqual([
      '#',
      'nama kelas',
      'tahap',
      'pelajar',
      'aktif (30h)',
      'jumlah jawapan',
      'ketepatan',
    ])
    const name = (await page.getByTestId('cc-crumb-current').innerText()).trim()
    await expectTabTitle(page, `${name} - Command Center`)
    const c370 = page.locator('[data-testid=cc-class-row][data-class-id="370"]')
    await expect(c370).toBeVisible()
    const cells = await c370.locator('td').allInnerTexts()
    expect(cells.slice(1).map((c) => c.trim())).toEqual([
      '5 PERNIAGAAN',
      'T5',
      '30',
      '8',
      '13,641',
      '79.0%',
    ])

    await gotoApp(`${CC}/school/8082/teacher/4402`)
    await expect(page.getByTestId('cc-class-row').first()).toBeVisible()
    await expect(page.getByTestId('cc-class-row')).toContainText(['5 CYBER'])

    await gotoApp(`${CC}/school/8082/teacher/4418`)
    await expect(page.getByTestId('cc-panel-title')).toHaveText('Senarai Kelas (0)')
    await expect(page.getByTestId('cc-empty-row')).toHaveText('Tiada kelas aktif')
  })
})

test.describe('S6 class', MODULE, () => {
  test('E2E-M17-58 class 370 header, info bar, rows, status counts and the row click to S7', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/classroom/370`)
    await expect(page.getByTestId('cc-student-row').first()).toBeVisible()
    await expectHeader(page, '← Kembali ke Guru')
    await expect(page.getByTestId('cc-info')).toContainText('Sekolah:')
    await expect(page.getByTestId('cc-info')).toContainText('Guru:')
    await expect(page.getByTestId('cc-info')).toContainText('Tahap:')
    await expect(page.getByTestId('cc-info')).toContainText('T5')
    const name = (await page.getByTestId('cc-crumb-current').innerText()).trim()
    expect(name).toBe('5 PERNIAGAAN')
    await expectTabTitle(page, '5 PERNIAGAAN - Command Center')

    const first2022 = page.getByTestId('cc-student-row').first()
    await expect(first2022).toHaveAttribute('data-user-id', '2022')
    await expect(first2022.locator('td').nth(2)).toHaveText('2,378')
    await expect(first2022.locator('td').nth(3)).toHaveText('93.5%')
    const heading = ((await page.getByTestId('cc-panel-title').textContent()) ?? '').trim()
    expect(heading).toMatch(/^Senarai Pelajar \(\d+\)$/)
    const total = countOf(heading)
    await expect(page.getByTestId('cc-student-row')).toHaveCount(total)
    const head = await page.getByTestId('cc-students-table').locator('th').allInnerTexts()
    expect(head.map((h) => h.toLowerCase())).toEqual([
      '#',
      'nama pelajar',
      'jumlah jawapan',
      'ketepatan',
      'terakhir aktif',
      'status',
      'mood',
    ])
    const aktif = await page.locator('.status-active').count()
    const tidak = await page.locator('.status-inactive').count()
    expect(aktif + tidak).toBe(total)
    await expect(page.locator('.status-active').first()).toHaveText('Aktif')
    await expect(page.locator('.status-inactive').first()).toHaveText('Tidak Aktif')
    // ordered by answers, descending
    const answers = (
      await page
        .getByTestId('cc-student-row')
        .evaluateAll((rows) =>
          rows.map((r) => r.querySelectorAll('td')[2]?.textContent.trim() ?? '0'),
        )
    ).map((t) => Number(t.replace(/,/g, '')))
    expect(answers).toEqual([...answers].sort((a, b) => b - a))

    const first = page.getByTestId('cc-student-row').first()
    const userId = await first.getAttribute('data-user-id')
    await first.click()
    await expect(page).toHaveURL(new RegExp(`${CC}/student/${userId}$`))
    await expect(page.getByTestId('cc-stat')).toHaveCount(5)
  })
})

test.describe('S7 student', MODULE, () => {
  test('E2E-M17-59 header, breadcrumb and the five cards', async ({ page, gotoApp }) => {
    await gotoApp(`${CC}/student/2022`)
    await expect(page.getByTestId('cc-stat')).toHaveCount(5)
    await expectHeader(page, '← Kembali ke Kelas')
    const crumbs = page.getByTestId('cc-breadcrumb')
    await expect(crumbs).toContainText('Command Center')
    const name = (await page.getByTestId('cc-crumb-current').innerText()).trim()
    await expectTabTitle(page, `${name} - Command Center`)
    const labels = await page
      .getByTestId('cc-stat')
      .evaluateAll((els) =>
        els.map((e) => e.firstElementChild?.textContent.replace(/\s+/g, ' ').trim()),
      )
    expect(labels).toEqual([
      'Jumlah Jawapan 🔍',
      'Ketepatan',
      'Hari Aktif',
      'Streak',
      'Konsistensi',
    ])
    await expect(page.getByTestId('cc-stat').first()).toHaveAttribute(
      'title',
      'Klik untuk lihat semua sesi',
    )
    const values = await page.getByTestId('cc-stat-value').allInnerTexts()
    expect(values.slice(0, 2)).toEqual(['2,378', '93.5%'])
    expect(values[2]).toMatch(/^\d+$/)
    expect(values[3]).toMatch(/^\d+$/)
    expect(values[4]).toMatch(/^\d+%$/)
  })

  test('E2E-M17-60 subject row, eight weekly bars, mood panel', async ({ page, gotoApp }) => {
    await gotoApp(`${CC}/student/2022`)
    await expect(page.getByTestId('cc-subject-row').first()).toBeVisible()
    await expect(page.getByTestId('cc-panel-title')).toHaveText([
      'Pecahan Subjek',
      'Aktiviti Mingguan (8 Minggu)',
      'Trend Mood (30 Hari)',
      'HeadCount',
      'ALESA AI Insight',
    ])
    // subject rows: "{subjek} 🔍", the ratio, the live title; free practice reads "Latihan Bebas" when present
    const subjectRow = page.getByTestId('cc-subject-row').first()
    await expect(subjectRow).toContainText('🔍')
    await expect(subjectRow.getByTestId('cc-subject-ratio')).toHaveText(/^\d+\/\d+$/)
    await expect(subjectRow).toHaveAttribute('title', 'Klik untuk lihat sesi')
    const umum = page.locator('[data-testid=cc-subject-row][data-code=UMUM]')
    if ((await umum.count()) > 0) await expect(umum).toContainText('Latihan Bebas')
    await expect(page.getByTestId('cc-week')).toHaveCount(8)
    // dd/mm labels of the 8 Mondays
    const labels = await page.getByTestId('cc-week').allInnerTexts()
    for (const l of labels) expect(l).toMatch(/^\d+\s+\d{2}\s*\/\d{2}$/)
    // no seeded check-in for this pupil: the empty copy (a dot list otherwise)
    const dots = await page.getByTestId('cc-mood-dot').count()
    if (dots === 0) await expect(page.getByTestId('cc-mood-empty')).toHaveText('Tiada data mood')
  })

  test('E2E-M17-61 HeadCount rows and the ALESA insight', async ({ page, gotoApp }) => {
    await gotoApp(`${CC}/student/2022`)
    await expect(page.getByTestId('cc-headcount-row').first()).toBeVisible()
    const head = await page.getByTestId('cc-headcount-table').locator('th').allInnerTexts()
    expect(head.map((h) => h.toLowerCase())).toEqual([
      'subjek',
      'tov',
      'etr',
      'rs',
      'gred',
      'tarikh',
    ])
    await expect(page.getByTestId('cc-headcount-row').first()).toHaveAttribute(
      'title',
      'Klik untuk lihat semua pelajar',
    )
    const dates = await page
      .getByTestId('cc-headcount-row')
      .evaluateAll((rows) => rows.map((r) => r.querySelectorAll('td')[5]?.textContent.trim()))
    for (const d of dates) expect(d).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    await expect(page.getByTestId('cc-insight')).toContainText('Analisis ALESA')
    await expect(page.getByTestId('cc-insight')).toContainText('Sumber: Rule-based Analysis')
    await expect(page.getByTestId('cc-insight-text')).toContainText('Ketepatan cemerlang (93.5%).')
  })

  test('E2E-M17-62 all-sessions modal: summary, first row, close by x and by backdrop', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/student/2022`)
    await page.getByTestId('cc-stat').first().click()
    const modal = page.getByTestId('cc-sessions-modal')
    await expect(modal).toBeVisible()
    await expect(modal.getByTestId('cc-modal-title')).toHaveText('Semua Sesi Latihan')
    await expect(page.getByTestId('cc-session-row').first()).toBeVisible()
    const labels = await modal
      .getByTestId('cc-modal-stat')
      .evaluateAll((els) => els.map((e) => e.lastElementChild?.textContent.trim()))
    expect(labels).toEqual(['Jawapan', 'Sesi', 'Ketepatan', 'Jumlah Masa'])
    const sums = await modal
      .getByTestId('cc-modal-stat')
      .evaluateAll((els) => els.map((e) => e.firstElementChild?.textContent.trim()))
    expect(sums.slice(0, 3)).toEqual(['2,372', '123', '93.7%'])
    const heads = await modal.locator('th').allInnerTexts()
    expect(heads.map((h) => h.toLowerCase())).toEqual([
      'tarikh',
      'subjek',
      'soalan',
      'betul',
      'ketepatan',
      'masa',
    ])
    const firstRow = page.getByTestId('cc-session-row').first()
    await expect(firstRow.locator('td').first()).toHaveText(/^\d{2}\/\d{2} \d{2}:\d{2}$/)
    await expect(firstRow).not.toHaveAttribute('title', /.+/)
    await expectNoHorizontalScroll(page)

    await modal.getByTestId('cc-modal-close').click()
    await expect(modal).toHaveCount(0)
    await page.getByTestId('cc-stat').first().click()
    await expect(modal).toBeVisible()
    // backdrop: a click in the gutter outside the panel
    await page.getByTestId('cmp-modal-backdrop').click({ position: { x: 4, y: 4 } })
    await expect(modal).toHaveCount(0)
  })

  test('E2E-M17-63 week modal of the last week with activity; a zero bar opens nothing', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/student/2022`)
    await expect(page.getByTestId('cc-week')).toHaveCount(8)
    const counts = (
      await page
        .getByTestId('cc-week')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-count')))
    ).map(Number)
    const zero = counts.findIndex((c) => c === 0)
    if (zero >= 0) {
      await page.getByTestId('cc-week').nth(zero).click()
      await expect(page.getByTestId('cc-sessions-modal')).toHaveCount(0)
    }
    const last = counts
      .map((c, i) => (c > 0 ? i : -1))
      .filter((i) => i >= 0)
      .pop()
    expect(last, 'the pupil has a week with answers').toBeDefined()
    const week = page.getByTestId('cc-week').nth(last ?? 0)
    const start = (await week.getAttribute('data-start')) ?? ''
    await week.click()
    const modal = page.getByTestId('cc-sessions-modal')
    await expect(modal).toBeVisible()
    await expect(modal.getByTestId('cc-modal-title')).toHaveText(
      /^Minggu \d{2}\/\d{2} \(\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2}\)$/,
    )
    await expect(modal.getByTestId('cc-modal-title')).toContainText(`(${start} ~`)
    const stat = await modal
      .getByTestId('cc-modal-stat')
      .evaluateAll((els) => els.map((e) => e.lastElementChild?.textContent.trim()))
    expect(stat).toEqual(['Jawapan', 'Sesi', 'Ketepatan', 'Masa'])
    if (start === '2026-09-21') {
      const sums = await modal
        .getByTestId('cc-modal-stat')
        .evaluateAll((els) => els.map((e) => e.firstElementChild?.textContent.trim()))
      expect(sums.slice(0, 3)).toEqual(['452', '23', '99.6%'])
    }
  })

  test('E2E-M17-64 subject modal "Latihan Bebas — Semua Sesi" with "Topik"', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/student/2022`)
    await expect(page.getByTestId('cc-subject-row').first()).toBeVisible()
    const row = page.getByTestId('cc-subject-row').first()
    const name = ((await row.locator('span').first().textContent()) ?? '').replace('🔍', '').trim()
    await row.click()
    const modal = page.getByTestId('cc-sessions-modal')
    // "Latihan Bebas — Semua Sesi" when the pupil has free practice (UMUM), else "{subjek} — Semua Sesi"
    await expect(modal.getByTestId('cc-modal-title')).toHaveText(`${name} — Semua Sesi`)
    await expect(page.getByTestId('cc-session-row').first()).toBeVisible()
    const heads = await modal.locator('th').allInnerTexts()
    expect(heads.map((h) => h.toLowerCase())).toContain('topik')
    expect(heads.map((h) => h.toLowerCase())).not.toContain('subjek')
    // live: the subject modal labels the time tile "Masa" ("Jumlah Masa" is the all-sessions modal only)
    const labels = await modal
      .getByTestId('cc-modal-stat')
      .evaluateAll((els) => els.map((e) => e.lastElementChild?.textContent.trim()))
    expect(labels).toEqual(['Jawapan', 'Sesi', 'Ketepatan', 'Masa'])
    await expect(page.getByTestId('cc-session-row').first()).toHaveAttribute('title', 'Klik soalan')
  })

  test('E2E-M17-65 session modal from the first row: subtitle, stats, question rows', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/student/2022`)
    await page.getByTestId('cc-stat').first().click()
    await page.getByTestId('cc-session-row').first().click()
    const modal = page.getByTestId('cc-session-modal')
    await expect(modal).toBeVisible()
    await expect(modal.getByTestId('cc-modal-title')).toHaveText(/ — /)
    await expect(modal.getByTestId('cc-modal-subtitle')).toHaveText(
      /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \| Kesukaran: (\d+|-) \| Masa: \d+m \d+s$/,
    )
    const stats = await modal
      .getByTestId('cc-modal-stat')
      .evaluateAll((els) => els.map((e) => e.lastElementChild?.textContent.trim()))
    expect(stats).toEqual(['Soalan', 'Betul', 'Salah', 'Ketepatan'])
    await expect(modal.getByTestId('cc-answer-row').first()).toBeVisible()
    const total = Number(
      await modal.getByTestId('cc-modal-stat').first().locator('div').first().innerText(),
    )
    await expect(modal.getByTestId('cc-answer-row')).toHaveCount(total)
    await expect(modal.getByTestId('cc-answer-row').first().locator('span').last()).toHaveText(
      /^\d{2}:\d{2}:\d{2}$/,
    )
    // the sessions modal stays underneath; closing the session modal returns to it
    await modal.getByTestId('cc-modal-close').click()
    await expect(modal).toHaveCount(0)
    await expect(page.getByTestId('cc-sessions-modal')).toBeVisible()
  })

  test('E2E-M17-66 headcount modal "HeadCount: {subjek}" with summary and rows', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/student/2022`)
    const row = page.getByTestId('cc-headcount-row').first()
    const subject = (await row.locator('td').first().innerText()).replace('🔍', '').trim()
    await row.click()
    const modal = page.getByTestId('cc-headcount-modal')
    await expect(modal.getByTestId('cc-modal-title')).toHaveText(`HeadCount: ${subject}`)
    await expect(modal.getByTestId('cc-headcount-student').first()).toBeVisible()
    const stats = await modal
      .getByTestId('cc-modal-stat')
      .evaluateAll((els) => els.map((e) => e.lastElementChild?.textContent.trim()))
    expect(stats).toEqual(['Pelajar', 'Purata TOV', 'Purata ETR', 'Kadar Lulus'])
    const total = Number(
      await modal.getByTestId('cc-modal-stat').first().locator('div').first().innerText(),
    )
    await expect(modal.getByTestId('cc-headcount-student')).toHaveCount(total)
    const heads = await modal.locator('th').allInnerTexts()
    expect(heads.map((h) => h.toLowerCase())).toEqual(['#', 'pelajar', 'tov', 'etr', 'rs', 'gred'])
    if (subject === 'Perniagaan') {
      const sums = await modal
        .getByTestId('cc-modal-stat')
        .evaluateAll((els) => els.map((e) => e.firstElementChild?.textContent.trim()))
      expect(sums).toEqual(['30', '29.7', '0', '0%'])
    }
  })

  test(
    'E2E-M17-67 mood-day modal from a check-in dot',
    provisional('mood-day modal is SOURCE-DERIVED (FN-M17-5.4.11); needs a pupil with a check-in'),
    async ({ page, gotoApp }) => {
      // Any pupil of class 370 with a mood in the S6 table has a check-in in the last 30 days.
      await gotoApp(`${CC}/classroom/370`)
      await expect(page.getByTestId('cc-student-row').first()).toBeVisible()
      const withMood = page
        .getByTestId('cc-student-row')
        .filter({ has: page.locator('[data-testid=cc-mood] span[title]') })
      test.skip((await withMood.count()) === 0, 'no pupil of class 370 has a check-in in the seed')
      const ids = await withMood.evaluateAll((rows) =>
        rows.map((r) => r.getAttribute('data-user-id') ?? ''),
      )
      let found = false
      for (const id of ids.slice(0, 6)) {
        await gotoApp(`${CC}/student/${id}`)
        await expect(page.getByTestId('cc-stat').first()).toBeVisible()
        if ((await page.getByTestId('cc-mood-dot').count()) > 0) {
          found = true
          break
        }
      }
      test.skip(!found, 'no pupil of class 370 has a check-in inside the 30-day trend')
      await expect(page.getByTestId('cc-mood-dot').first()).toBeVisible()
      await page.getByTestId('cc-mood-dot').last().click()
      const modal = page.getByTestId('cc-mood-modal')
      await expect(modal.getByTestId('cc-modal-title')).toHaveText(
        /^(😊|😐|😢|😥) \d{4}-\d{2}-\d{2} — Mood: (Gembira|OK|Sedih|Tekanan)$/,
      )
      const labels = await modal
        .getByTestId('cc-modal-stat')
        .evaluateAll((els) => els.map((e) => e.lastElementChild?.textContent.trim()))
      expect(labels).toEqual(['Mood', 'Sebab'])
    },
  )

  test(
    'E2E-M17-68 modal API failures show "Ralat memuatkan data" and "Ralat"',
    provisional('error states are never observed on live; the copy is SOURCE-DERIVED'),
    async ({ page, gotoApp, mock }) => {
      await gotoApp(`${CC}/student/2022`)
      await expect(page.getByTestId('cc-headcount-row').first()).toBeVisible()
      await mock.failNext('GET /api/command-center/student/:id/week', 500)
      await page.getByTestId('cc-stat').first().click()
      await expect(page.getByTestId('cc-sessions-modal').getByTestId('cc-modal-error')).toHaveText(
        'Ralat memuatkan data',
      )
      await page.getByTestId('cc-sessions-modal').getByTestId('cc-modal-close').click()
      await mock.failNext('GET /api/command-center/headcount/:id', 500)
      await page.getByTestId('cc-headcount-row').first().click()
      await expect(page.getByTestId('cc-headcount-modal').getByTestId('cc-modal-error')).toHaveText(
        'Ralat',
      )
    },
  )
})

test.describe('unknown ids', MODULE, () => {
  test('E2E-M17-07 non-numeric and unknown ids on S4-S7 show the 404 page', async ({
    page,
    gotoApp,
  }) => {
    for (const path of [
      `${CC}/school/abc`,
      `${CC}/school/8080/teacher/abc`,
      `${CC}/classroom/abc`,
      `${CC}/student/abc`,
      `${CC}/school/999999`,
      `${CC}/school/8080/teacher/999999`,
      `${CC}/classroom/999999`,
      `${CC}/student/999999`,
    ]) {
      await gotoApp(path)
      await expectNotFound(page)
      await expect(page.getByTestId('cc-page')).toHaveCount(0)
    }
    await expectNoHorizontalScroll(page)
  })
})

test.describe('responsive', MODULE, () => {
  const PAGES: { path: string; table: string }[] = [
    { path: `${CC}/school/8082`, table: 'cc-teachers-table' },
    { path: `${CC}/school/8080/teacher/1919`, table: 'cc-classes-table' },
    { path: `${CC}/classroom/370`, table: 'cc-students-table' },
  ]

  test('E2E-M17-69 S4-S6: no page scroll, tables scroll inside their cards at 375 and fit above', async ({
    page,
    gotoApp,
  }) => {
    for (const { path, table } of PAGES) {
      await gotoApp(path)
      await expect(page.getByTestId(table)).toBeVisible()
      await expect(page.getByTestId('cc-table-scroller')).toBeVisible()
      await expectNoHorizontalScroll(page)
      const { scrolls, sw, cw } = await scrollState(page.getByTestId('cc-table-scroller'))
      if (isMobileWidth(page)) {
        expect(scrolls, `${table} scrolls inside its card at 375`).toBe(true)
      } else if (viewportWidth(page) >= 768) {
        expect(
          scrolls,
          `${table} fits at ${String(viewportWidth(page))} (${String(sw)} > ${String(cw)})`,
        ).toBe(false)
      }
      // touch targets: the back link, and the whole row (the row is the live click target)
      await expectTouchTarget(page.getByTestId('cc-back'), 44)
      const row = page.locator('tbody tr[data-testid]:not([data-testid=cc-empty-row])').first()
      const box = await row.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.9)
    }
  })

  test('E2E-M17-69 S7: no page scroll, panels stack at 375 and sit in 2 columns from 768', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`${CC}/student/2022`)
    await expect(page.getByTestId('cc-week')).toHaveCount(8)
    await expectNoHorizontalScroll(page)
    const panels = page.locator('section')
    const a = await panels.nth(0).boundingBox()
    const b = await panels.nth(1).boundingBox()
    expect(a && b).toBeTruthy()
    if (isMobileWidth(page)) {
      expect(Math.abs((a?.x ?? 0) - (b?.x ?? 1))).toBeLessThan(2)
      expect(b?.y ?? 0).toBeGreaterThan((a?.y ?? 0) + (a?.height ?? 0) - 2)
    } else {
      expect(b?.x ?? 0).toBeGreaterThan((a?.x ?? 0) + (a?.width ?? 0) - 2)
      expect(Math.abs((a?.y ?? 0) - (b?.y ?? 1))).toBeLessThan(2)
    }
    // the eight week columns keep their count at every width
    const weeks = await page
      .getByTestId('cc-week')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().y))
    expect(new Set(weeks.map((y) => Math.round(y))).size).toBe(1)
    // the week labels never overlap each other (the label stacks below sm)
    const lefts = await page.getByTestId('cc-week-label').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect()
        return [r.left, r.right] as const
      }),
    )
    for (let i = 1; i < lefts.length; i++) {
      expect(
        lefts[i]?.[0] ?? 0,
        `label ${String(i)} starts after label ${String(i - 1)}`,
      ).toBeGreaterThanOrEqual((lefts[i - 1]?.[1] ?? 0) - 0.5)
    }
    // cards: 2 per row at 375
    if (isMobileWidth(page)) {
      const cards = await page
        .getByTestId('cc-stat')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().y)))
      expect(cards.filter((y) => y === cards[0])).toHaveLength(2)
    }
    // no text under 12 px on the page (NFR-M17-04)
    const small = await page.evaluate(() => {
      const bad: string[] = []
      for (const el of document.querySelectorAll('#app *')) {
        const own = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
        )
        if (own && parseFloat(getComputedStyle(el).fontSize) < 12) bad.push(el.tagName)
      }
      return bad
    })
    expect(small).toEqual([])
  })

  test('E2E-M17-69 S7 modals fit the viewport width', async ({ page, gotoApp }) => {
    await gotoApp(`${CC}/student/2022`)
    await page.getByTestId('cc-stat').first().click()
    await expect(page.getByTestId('cc-session-row').first()).toBeVisible()
    const box = await page.getByTestId('cc-sessions-modal').boundingBox()
    expect(box).not.toBeNull()
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth(page))
    if (isMobileWidth(page)) expect(box?.x ?? 0).toBeLessThanOrEqual(20)
    await expectNoHorizontalScroll(page)
  })
})
