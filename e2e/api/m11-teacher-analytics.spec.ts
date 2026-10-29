/**
 * @api M11 "Analitik Guru" against the REAL API (EX-4, slug `m11-teacher-analytics`). Read-only: no test
 * changes data, so the shared seeded database is safe with workers=1.
 *
 * Screens (src/modules/m11-teacher-analytics/routes, docs/requirements/{urs,srs}/M11-teacher-analytics.md):
 * - S1 `/guru/laporan` "Laporan Statistik"        <- GET /api/teacher/report
 * - S6 `/guru/analisis-item` "Analisis Item Soalan" <- GET /api/teacher/item-analysis
 * - S2 `/guru/monitoring` "Monitoring Penglibatan"  <- GET /api/monitoring/overview
 * - S3 `.../sekolah/:id`, S4 `.../pelajar/:id`, S5 `.../guru/:id` <- GET /api/monitoring/schools/...
 * - school-admin alias `/admin-sekolah/monitoring...` (own school only, other ids answer 404)
 *
 * Roles (route meta): S1, S6 and `/guru/monitoring` = teacher + admin; `/admin-sekolah/monitoring` =
 * school_admin. A role the route does not allow is sent to its landing page (M10 §7 "T" guard); the API
 * answers 403 for it. Seed: BE-07 poc profile (school DEMO001, accounts and password in helpers.ts).
 *
 * The seed is relative to "now" and other specs log the demo pupil in, so figures are NEVER hard-coded:
 * each test reads the same endpoint the page reads and compares the rendered numbers with that response.
 * That also proves the page shows the real API and not the in-browser mock.
 *
 * What the fresh poc seed leaves EMPTY: the teacher's "Paling Aktif" list and activity total (no attempts
 * in the last 30 days), the S6 item-analysis rows, the S4 question list, "Jawapan Salah" and gap cards (the
 * answers have no question rows), and the admin's classes. On this seed only the EMPTY branch runs. The
 * S1 "Paling Aktif" list, the S6 item rows and the S4 gap cards also carry a populated-branch assertion
 * (it runs once other data exists); the S4 question list and "Jawapan Salah" are checked for their empty
 * state only, so their populated rendering is not covered by these specs.
 * Anything the specs REQUIRE from the seed (a pupil, a teacher, the admin owning no class) is asserted
 * with `expect(...)`, never skipped, so a seed change fails loudly. Layout: every screen is
 * measured for horizontal page overflow on the three Playwright projects (375 / 768 / 1280).
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_GURU_PASS / BIJAK_ADMIN_PASS / BIJAK_ADMIN_SEKOLAH_PASS /
 * BIJAK_STUDENT_PASS; see helpers.ts). Stack: npm run stack:up.
 */

import type { Locator, Page, Response } from '@playwright/test'

import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { viewportWidth } from '../support'
import {
  account,
  type ApiRole,
  expectNoHScroll,
  FORBIDDEN_TITLE,
  HOME,
  newPeerContext,
} from './helpers'

const SLOW = { timeout: 30_000 }
const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'

const LAPORAN = '/guru/laporan'
const ITEM = '/guru/analisis-item'
const MON = '/guru/monitoring'
const MON_SA = '/admin-sekolah/monitoring'

// ---- response shapes (only the fields the specs read; src/modules/m11-teacher-analytics/api/types.ts) ----

interface ReportStudent {
  id: string
  name: string
  email: string
}
interface TeacherReport {
  range: number
  classroomId: string | null
  options: { classes: { id: string; name: string }[] }
  population: { total: number; loggedIn: number; practised: number }
  activity: { total: number; byType: Record<string, number> }
  score: { overall: number | null }
  trend: { date: string; count: number }[]
  notLoggedIn: ReportStudent[]
  notPractised: ReportStudent[]
  notPractisedAll: ReportStudent[]
  mostActive: ReportStudent[]
}
interface ItemAnalysis {
  options: { subjects: { id: string; name: string }[]; classes: { id: string; name: string }[] }
  rows: { subjectName: string; attempts: number; pct: number }[]
}
interface OverviewRow {
  schoolId: string
  name: string
  code: string | null
  state: string
  registered: number
  pct: number
}
interface Overview {
  kpi: {
    schools: number
    students: number
    engaged: number
    engagementPct: number
    answers: number
    avgPerStudent: number
    teachers: number
    teachersLoggedIn: number
    teacherPct: number
  }
  studentRows: OverviewRow[]
  teacherRows: OverviewRow[]
  weekly: { schoolId: string; name: string }[]
}
interface SchoolDetail {
  school: { id: string; name: string; code: string | null; state: string }
  cards: {
    students: number
    engaged: number
    answers: number
    teachers: number
    teachersLoggedIn: number
  }
  students: { id: string; name: string; email: string; answers: number }[]
  teachers: { id: string; name: string; email: string }[]
}
interface StudentDetail {
  student: { name: string }
  gaps: { count: number; items: unknown[] }
}

// ---- helpers ----

async function signIn(page: Page, role: ApiRole): Promise<void> {
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
}

async function bodyOf<T>(res: Response | Awaited<ReturnType<Page['request']['get']>>): Promise<T> {
  return ((await res.json()) as { data: T }).data
}

async function getData<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(path)
  expect(res.status(), `GET ${path}`).toBe(200)
  return bodyOf<T>(res)
}

/** Opens `path` and returns the data of the first response whose URL contains `apiPart` (must be 200). */
async function openWith<T>(page: Page, path: string, apiPart: string): Promise<T> {
  const api = page.waitForResponse((r) => r.url().includes(apiPart), SLOW)
  await gotoApi(page, path)
  const res = await api
  expect(res.status(), `GET ${apiPart}`).toBe(200)
  return bodyOf<T>(res)
}

/** The page must not be a load-error, a 403/404 page or the "not in the prototype" page. */
async function expectHealthy(page: Page): Promise<void> {
  await expect(page.locator('[data-page=forbidden]')).toHaveCount(0)
  await expect(page.getByText('Belum tersedia dalam prototaip')).toHaveCount(0)
  await expect(page.getByTestId('mon-error')).toHaveCount(0)
  await expect(page.getByTestId('mon-loading')).toHaveCount(0)
}

async function expectNotFoundPage(page: Page): Promise<void> {
  await expect(page).toHaveTitle(NOT_FOUND_TITLE, SLOW)
  await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
  await expect(
    page.getByText('Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan.'),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Halaman Utama' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mula Latihan' })).toBeVisible()
}

/**
 * `DsFilterBar` and `DsDataTable` switch at 768 px (src/ds/DsFilterBar.vue, DsDataTable.vue): from there the
 * filter fields are inline and the lists are tables; below it the fields sit in a bottom sheet behind the
 * "Penapis" button and the lists are cards.
 */
const WIDE_MIN_WIDTH = 768
const isWide = (page: Page): boolean => viewportWidth(page) >= WIDE_MIN_WIDTH

/** Makes the filter fields reachable (opens the bottom sheet below 768 px; idempotent). */
async function openFilters(page: Page): Promise<void> {
  if (isWide(page)) return
  const sheet = page.locator('[data-ds=filter-sheet]')
  if (!(await sheet.isVisible())) await page.locator('[data-ds=filter-open]').click()
  await expect(sheet).toBeVisible()
}

/** Closes the bottom sheet again (no-op from 768 px). */
async function closeFilters(page: Page): Promise<void> {
  if (isWide(page)) return
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-ds=filter-sheet]')).toBeHidden()
}

/** Submits the filter bar: the "Tapis" button from 768 px, "Guna" in the bottom sheet below it. */
async function applyFilters(page: Page): Promise<void> {
  if (isWide(page))
    await page.getByRole('search').getByRole('button', { name: 'Tapis', exact: true }).click()
  else await page.locator('[data-ds=filter-sheet]').getByRole('button', { name: 'Guna' }).click()
}

/** The rows of the data table(s) inside `scope`: table rows from 768 px, cards below it. */
const rowsOf = (scope: Locator): Locator =>
  scope.locator('tbody tr, [data-ds=data-table-cards] > li')

/** A stat tile shows its label and the figure as one exact line (a bare "0" elsewhere cannot pass). */
async function expectTileValue(tile: Locator, label: string, value: string): Promise<void> {
  await expect(tile, label).toContainText(label)
  await expect
    .poll(async () => (await tile.innerText()).split('\n').map((l) => l.trim()), { message: label })
    .toContain(value)
}

const pctInt = (part: number, whole: number): string =>
  `${whole === 0 ? 0 : Math.round((part / whole) * 100)}%`

// =====================================================================================================
// S1 Laporan Statistik
// =====================================================================================================

test.describe('M11 S1 Laporan Statistik @api', () => {
  test.setTimeout(90_000)

  test('AC-M11-01.3 AC-M11-04.1 AC-M11-05 teacher: header, filter and the four cards equal GET /api/teacher/report @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const d = await openWith<TeacherReport>(page, LAPORAN, '/api/teacher/report')
    await expect(page.getByTestId('laporan-page')).toBeVisible(SLOW)
    await expect(page.getByTestId('laporan-loading')).toHaveCount(0)
    await expectHealthy(page)

    await expect(page).toHaveTitle('Laporan Statistik - Portal Guru')
    await expect(page.getByRole('heading', { name: 'Laporan Statistik', level: 1 })).toBeVisible()
    await expect(page.getByText('Pantau penglibatan dan prestasi pelajar')).toBeVisible()

    // Filter: "Tapis:", the class select (Semua Kelas + the viewer's own classes) and the three range pills.
    const filter = page.getByTestId('filter-card')
    await expect(filter.getByText('Tapis:')).toBeVisible()
    const select = page.getByTestId('filter-classroom')
    await expect(select).toHaveValue('')
    await expect(select.locator('option')).toHaveText([
      'Semua Kelas',
      ...d.options.classes.map((c) => c.name),
    ])
    await expect(page.getByTestId('range-pills').getByRole('link')).toHaveText([
      '7 Hari',
      '30 Hari',
      '3 Bulan',
    ])
    await expect(page.getByTestId('range-30')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('range-7')).toHaveAttribute('data-active', 'false')

    // Cards (titles, values and sub-lines come from the response).
    const n = d.population.total
    const login = page.getByTestId('card-login')
    await expect(login.getByTestId('card-title')).toHaveText('Pernah Login')
    await expect(login.getByTestId('card-value')).toHaveText(pctInt(d.population.loggedIn, n))
    await expect(login).toContainText(`${d.population.loggedIn} / ${n} pelajar`)
    if (n - d.population.loggedIn > 0) {
      await expect(page.getByTestId('card-login-missing')).toHaveText(
        `${n - d.population.loggedIn} belum pernah login`,
      )
    } else {
      await expect(page.getByTestId('card-login-missing')).toHaveCount(0)
    }
    const practised = page.getByTestId('card-latihan')
    await expect(practised.getByTestId('card-title')).toHaveText('Pernah Buat Latihan')
    await expect(practised.getByTestId('card-value')).toHaveText(pctInt(d.population.practised, n))
    await expect(practised).toContainText(`${d.population.practised} / ${n} pelajar`)
    const activity = page.getByTestId('card-aktiviti')
    await expect(activity.getByTestId('card-title')).toHaveText('Jumlah Aktiviti')
    await expect(activity.getByTestId('card-value')).toHaveText(
      d.activity.total.toLocaleString('en-US'),
    )
    await expect(page.getByTestId('card-range')).toHaveText('30 hari lepas')
    const score = page.getByTestId('card-skor')
    await expect(score.getByTestId('card-title')).toHaveText('Skor Purata')
    await expect(score.getByTestId('card-value')).toHaveText(
      d.score.overall === null ? '-%' : `${d.score.overall}%`,
    )

    // Trend and the two lists; each shows the rows of the response or its empty-state copy.
    const trend = page.getByTestId('trend-card')
    await expect(trend).toBeVisible()
    await expect(page.getByText('Trend Aktiviti').first()).toBeVisible()
    await expect(page.getByTestId('trend-range')).toHaveText('30 hari lepas')
    expect(d.trend.length, 'one trend point per day of the range').toBe(30)
    // The chart's data table lists "{dd/mm}{n} aktiviti" for each day of the response.
    for (const point of d.trend) {
      await expect(trend, point.date).toContainText(
        new RegExp(`${point.date}\\s*${point.count} aktiviti`),
      )
    }
    await expect(
      page.getByTestId('list-active').getByRole('heading', { name: 'Paling Aktif' }),
    ).toBeVisible()
    if (d.mostActive.length === 0) {
      await expect(page.getByTestId('list-active-empty')).toHaveText('Belum ada aktiviti')
    } else {
      const active = page.getByTestId('list-active-rows').getByTestId('student-row')
      await expect(active).toHaveCount(d.mostActive.length)
      await expect(active.first().getByTestId('student-name')).toHaveText(d.mostActive[0]!.name)
    }
    await expect(
      page.getByTestId('list-idle').getByRole('heading', { name: 'Belum Pernah Buat Latihan' }),
    ).toBeVisible()
    if (d.notPractised.length === 0) {
      await expect(page.getByTestId('list-idle-empty')).toHaveText(
        'Semua pelajar sudah aktif buat latihan!',
      )
    } else {
      await expect(page.getByTestId('list-idle-rows').getByTestId('student-row')).toHaveCount(
        d.notPractised.length,
      )
    }
    await expectNoHScroll(page)
  })

  test('AC-M11-04.2 AC-M11-04.3 AC-M11-05.4 range pills and class select keep and drop the query @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const d = await openWith<TeacherReport>(page, `${LAPORAN}?range=999`, '/api/teacher/report')
    // An unknown range falls back to 30 days.
    await expect(page.getByTestId('range-30')).toHaveAttribute('data-active', 'true', SLOW)
    await expect(page.getByTestId('card-range')).toHaveText('30 hari lepas')

    // 7 Hari: the label, the trend length and the request follow the pill.
    const seven = page.waitForResponse(
      (r) => r.url().includes('/api/teacher/report') && r.url().includes('range=7'),
      SLOW,
    )
    await page.getByTestId('range-7').click()
    const week = await bodyOf<TeacherReport>(await seven)
    await expect(page).toHaveURL(/\/guru\/laporan\?range=7$/)
    await expect(page.getByTestId('range-7')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('card-range')).toHaveText('7 hari lepas')
    await expect(page.getByTestId('card-aktiviti').getByTestId('card-value')).toHaveText(
      week.activity.total.toLocaleString('en-US'),
    )

    // A class: the URL keeps the range and carries classroom_id; "3 Bulan" then drops the class again.
    const firstClass = d.options.classes[0]
    if (firstClass) {
      await page.getByTestId('filter-classroom').selectOption(firstClass.id)
      await expect(page).toHaveURL(
        new RegExp(`/guru/laporan\\?range=7&classroom_id=${firstClass.id}$`),
      )
      await expect(page.getByTestId('filter-classroom')).toHaveValue(firstClass.id)
      await expect(page.getByTestId('card-range')).toHaveText('7 hari lepas')
    }
    await page.getByTestId('range-90').click()
    await expect(page).toHaveURL(/\/guru\/laporan\?range=90$/)
    await expect(page.getByTestId('range-90')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('card-range')).toHaveText('90 hari lepas')
    await expect(page.getByTestId('filter-classroom')).toHaveValue('')
    await expectNoHScroll(page)
  })

  test('AC-M11-06 the four cards open and close one shared panel @api', async ({ page }) => {
    await signIn(page, 'guru')
    const d = await openWith<TeacherReport>(page, LAPORAN, '/api/teacher/report')
    await expect(page.getByTestId('card-login')).toBeVisible(SLOW)
    for (const id of ['panel-login', 'panel-latihan', 'panel-aktiviti', 'panel-skor']) {
      await expect(page.getByTestId(id), `${id} is closed on load`).toHaveCount(0)
    }

    // Pernah Login: the panel lists the pupils without a login (or the "all logged in" line).
    await page.getByTestId('card-login').click()
    await expect(page.getByTestId('card-login')).toHaveAttribute('data-open', 'true')
    const loginPanel = page.getByTestId('panel-login')
    await expect(
      loginPanel.getByRole('heading', {
        name: `Pelajar Belum Pernah Login (${d.notLoggedIn.length})`,
      }),
    ).toBeVisible()
    if (d.notLoggedIn.length === 0) {
      await expect(loginPanel).toContainText('Semua pelajar sudah pernah login!')
    } else {
      await expect(loginPanel.getByTestId('student-row')).toHaveCount(d.notLoggedIn.length)
    }
    await expectNoHScroll(page)

    // Jumlah Aktiviti: the login panel closes, the activity breakdown opens.
    await page.getByTestId('card-aktiviti').click()
    await expect(page.getByTestId('panel-login')).toHaveCount(0)
    await expect(page.getByTestId('card-login')).toHaveAttribute('data-open', 'false')
    const activity = page.getByTestId('panel-aktiviti')
    await expect(activity.getByTestId('panel-title')).toHaveText('Pecahan Aktiviti (30 Hari Lepas)')
    for (const label of [
      'Kuiz',
      'Struktur',
      'Latih Tubi',
      'Tracking A',
      'Battle',
      'Permainan',
      'Jumlah',
    ]) {
      await expect(activity.getByText(label, { exact: true }), label).toBeVisible()
    }
    await expectNoHScroll(page)

    // Pernah Buat Latihan, then Skor Purata.
    await page.getByTestId('card-latihan').click()
    await expect(
      page.getByTestId('panel-latihan').getByRole('heading', {
        name: `Pelajar Belum Pernah Buat Latihan (${d.notPractisedAll.length})`,
      }),
    ).toBeVisible()
    await page.getByTestId('card-skor').click()
    await expect(page.getByTestId('panel-skor').getByText('Pecahan Skor Purata')).toBeVisible()
    await expectNoHScroll(page)

    // The open card again: nothing stays open.
    await page.getByTestId('card-skor').click()
    await expect(page.getByTestId('panel-skor')).toHaveCount(0)
    await expect(page.getByTestId('card-skor')).toHaveAttribute('data-open', 'false')
  })

  test('AC-M11-05.1 AC-M11-06.2 AC-M11-08.1 admin without classes sees the zero state @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const d = await openWith<TeacherReport>(page, LAPORAN, '/api/teacher/report')
    await expect(page.getByTestId('laporan-page')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Laporan Statistik - Portal Guru')
    // Seed precondition: the admin owns no class, so the population is 0 pupils (fails loudly otherwise).
    expect(d.population.total, 'seed: the admin owns no class').toBe(0)
    expect(d.options.classes, 'seed: the admin owns no class').toEqual([])

    await expect(page.getByTestId('filter-classroom').locator('option')).toHaveText(['Semua Kelas'])
    await expect(page.getByTestId('card-login').getByTestId('card-value')).toHaveText('0%')
    await expect(page.getByTestId('card-login')).toContainText('0 / 0 pelajar')
    await expect(page.getByTestId('card-login-missing')).toHaveCount(0)
    await expect(page.getByTestId('card-latihan')).toContainText('0 / 0 pelajar')
    await expect(page.getByTestId('card-skor').getByTestId('card-value')).toHaveText('-%')
    await expect(page.getByTestId('list-active-empty')).toHaveText('Belum ada aktiviti')
    await expect(page.getByTestId('list-idle-empty')).toHaveText(
      'Semua pelajar sudah aktif buat latihan!',
    )

    await page.getByTestId('card-login').click()
    await expect(page.getByTestId('panel-login')).toContainText('Pelajar Belum Pernah Login (0)')
    await expect(page.getByTestId('panel-login')).toContainText('Semua pelajar sudah pernah login!')
    await page.getByTestId('card-latihan').click()
    await expect(page.getByTestId('panel-latihan')).toContainText(
      'Pelajar Belum Pernah Buat Latihan (0)',
    )
    await expect(page.getByTestId('panel-latihan')).toContainText(
      'Semua pelajar sudah aktif buat latihan!',
    )
    await expectNoHScroll(page)
  })
})

// =====================================================================================================
// S6 Analisis Item
// =====================================================================================================

test.describe('M11 S6 Analisis Item Soalan @api', () => {
  test.setTimeout(90_000)

  test('AC-M11-01.3 AC-M11-26.1 teacher: filter options, legend and the table or empty state equal GET /api/teacher/item-analysis @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const d = await openWith<ItemAnalysis>(page, ITEM, '/api/teacher/item-analysis')
    await expect(page.getByTestId('analisis-item-page')).toBeVisible(SLOW)
    await expect(page.getByTestId('analisis-item-loading')).toHaveCount(0)
    await expectHealthy(page)

    await expect(page).toHaveTitle('Analisis Item Soalan - Portal Guru')
    await expect(
      page.getByRole('heading', { name: 'Analisis Item Soalan', level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByText('Kenal pasti soalan yang sukar dan indeks diskriminasi'),
    ).toBeVisible()

    await openFilters(page)
    await expect(page.getByText('Tapis:')).toBeVisible()
    await expect(page.getByTestId('filter-subject').locator('option')).toHaveText([
      'Semua Subjek',
      ...d.options.subjects.map((s) => s.name),
    ])
    await expect(page.getByTestId('filter-classroom').locator('option')).toHaveText([
      'Semua Kelas',
      ...d.options.classes.map((c) => c.name),
    ])
    await expect(page.getByLabel('Mata Pelajaran')).toBeVisible()
    await expect(page.getByLabel('Kelas', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset' })).toHaveCount(0)
    await closeFilters(page)

    const legend = page.getByTestId('item-legend')
    await expect(legend).toContainText('> 70% (Mudah)')
    await expect(legend).toContainText('40–70% (Sederhana)')
    await expect(legend).toContainText('< 40% (Sukar)')
    await expect(page.getByTestId('item-legend-note')).toHaveText(
      'Diskriminasi: >0.3 = baik, <0 = semak semula',
    )

    if (d.rows.length === 0) {
      const empty = page.getByTestId('item-empty')
      await expect(empty).toContainText('Tiada data analisis item untuk paparan ini.')
      await expect(empty).toContainText('Pelajar perlu membuat latihan dahulu.')
      await expect(page.getByTestId('item-table-card')).toHaveCount(0)
    } else {
      // Populated branch (needs practice attempts in the teacher's classes; the fresh seed has none).
      await expect(page.getByTestId('item-empty')).toHaveCount(0)
      const table = page.getByTestId('item-table-card')
      await expect(table).toBeVisible()
      await expect(table).toContainText(d.rows[0]!.subjectName)
      await expect(table).toContainText(String(d.rows[0]!.attempts))
      await expect(table).toContainText(`${Number(d.rows[0]!.pct.toFixed(1))}%`)
    }
    await expectNoHScroll(page)
  })

  test('AC-M11-26.2 choosing a subject keeps it selected and shows Reset @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const d = await openWith<ItemAnalysis>(page, ITEM, '/api/teacher/item-analysis')
    const subject =
      d.options.subjects.find((s) => s.name === 'Bahasa Melayu') ?? d.options.subjects[0]
    expect(subject, 'the subject list is not empty').toBeDefined()

    const filtered = page.waitForResponse(
      (r) =>
        r.url().includes('/api/teacher/item-analysis') &&
        r.url().includes(`subjectId=${subject!.id}`),
      SLOW,
    )
    await openFilters(page)
    await page.getByTestId('filter-subject').selectOption({ label: subject!.name })
    expect((await filtered).status()).toBe(200)
    await expect(page).toHaveURL(
      new RegExp(`/guru/analisis-item\\?subject_id=${subject!.id}&classroom_id=$`),
    )
    await openFilters(page)
    await expect(page.getByTestId('filter-subject')).toHaveValue(subject!.id)
    await expect(page.getByTestId('filter-classroom')).toHaveValue('')
    await expectHealthy(page)
    await expectNoHScroll(page)

    // Reset links back to the bare page.
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(page).toHaveURL(/\/guru\/analisis-item$/)
    await openFilters(page)
    await expect(page.getByTestId('filter-subject')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Reset' })).toHaveCount(0)
  })

  test('AC-M11-26.1 admin: no own class, so "Kelas" offers only "Semua Kelas" @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const d = await openWith<ItemAnalysis>(page, ITEM, '/api/teacher/item-analysis')
    await expect(page.getByTestId('analisis-item-page')).toBeVisible(SLOW)
    await expectHealthy(page)
    await openFilters(page)
    await expect(page.getByTestId('filter-classroom').locator('option')).toHaveText([
      'Semua Kelas',
      ...d.options.classes.map((c) => c.name),
    ])
    await closeFilters(page)
    if (d.rows.length === 0) await expect(page.getByTestId('item-empty')).toBeVisible()
    await expectNoHScroll(page)
  })
})

// =====================================================================================================
// S2-S5 Monitoring (teacher mount)
// =====================================================================================================

test.describe('M11 S2 Monitoring Penglibatan @api', () => {
  test.setTimeout(90_000)

  test('AC-M11-01.3 AC-M11-10 AC-M11-13 teacher: header, tools, filters, KPIs, tabs and guide equal GET /api/monitoring/overview @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const d = await openWith<Overview>(page, MON, '/api/monitoring/overview')
    await expect(page.getByTestId('monitoring-page')).toBeVisible(SLOW)
    await expect(page.getByTestId('mon-kpis')).toBeVisible(SLOW)
    await expectHealthy(page)

    await expect(page).toHaveTitle('Monitoring Penglibatan Sekolah - Admin')
    await expect(
      page.getByText('Pantau penglibatan sekolah & pelajar T4/T5 dalam platform'),
    ).toBeVisible()

    // Tools: countdown, Refresh, PDF, CSV.
    await expect(page.getByTestId('mon-auto-refresh')).toContainText('Auto-refresh dalam')
    await expect(page.getByTestId('mon-countdown')).toHaveText(/^\d:\d{2}$/)
    await expect(page.getByTestId('mon-refresh')).toHaveText('Refresh')
    await expect(page.getByTestId('mon-export-pdf')).toHaveText('PDF')
    await expect(page.getByTestId('mon-export-csv')).toHaveText('CSV')

    // Filters: Tempoh / Negeri / Tahap and their options (in the bottom sheet below 768 px).
    await openFilters(page)
    await expect(page.getByTestId('mon-period').locator('option')).toHaveText([
      'Semua Masa',
      '7 Hari',
      '30 Hari',
      '3 Bulan',
    ])
    await expect(page.getByTestId('mon-state').locator('option').first()).toHaveText('Semua Negeri')
    await expect(page.getByTestId('mon-tahap').locator('option')).toHaveText([
      'Semua Tahap',
      'Cemerlang',
      'Sederhana',
      'Rendah',
      'Kritikal',
      'Tiada Langsung',
    ])
    if (isWide(page)) {
      await expect(
        page.getByRole('search').getByRole('button', { name: 'Tapis', exact: true }),
      ).toBeVisible()
    } else {
      await expect(
        page.locator('[data-ds=filter-sheet]').getByRole('button', { name: 'Guna' }),
      ).toBeVisible()
    }
    await closeFilters(page)

    // KPI cards: the nine tiles in the documented order, each with its label and its exact figure
    // (counts with thousands separators, percentages with one decimal and ".0" dropped).
    const count = (n: number): string => n.toLocaleString('en-US')
    const pct = (n: number): string => `${Number(n.toFixed(1))}%`
    const tiles: [string, string, string][] = [
      ['schools', 'Jumlah Sekolah', count(d.kpi.schools)],
      ['students', 'Pelajar T4/T5', count(d.kpi.students)],
      ['engaged', 'Pernah Aktif', count(d.kpi.engaged)],
      ['engagement', '% Penglibatan', pct(d.kpi.engagementPct)],
      ['answers', 'Soalan Dijawab', count(d.kpi.answers)],
      ['average', 'Purata/Pelajar', String(Number(d.kpi.avgPerStudent.toFixed(1)))],
      ['teachers', 'Guru Berdaftar', count(d.kpi.teachers)],
      ['teachersLoggedIn', 'Guru Pernah Login', count(d.kpi.teachersLoggedIn)],
      ['teacherPct', '% Penglibatan Guru', pct(d.kpi.teacherPct)],
    ]
    for (const [key, label, value] of tiles) {
      await expectTileValue(page.getByTestId(`mon-kpi-${key}`), label, value)
    }

    // Tabs and the student-by-school table (default tab).
    const tabs = page.getByTestId('mon-tabs')
    for (const name of [
      'Analisis Sekolah',
      'Analisis Guru',
      'Tracking Mingguan',
      'Sekolah Cemerlang / Perhatian Segera',
      'Cadangan Tindakan',
    ]) {
      const tab = tabs.getByRole('tab', { name })
      await expect(tab, name).toBeVisible()
      // The full label shows (G5-M11 bug 1: `truncate` clipped it): nothing inside the tab overflows.
      const clipped = await tab.evaluate(
        (el) =>
          [el, ...el.querySelectorAll('*')].filter((n) => n.scrollWidth > n.clientWidth).length,
      )
      expect(clipped, `${name}: label is not clipped`).toBe(0)
    }
    const table = page.getByTestId('mon-table-student')
    await expect(table.getByTestId('mon-table-count')).toHaveText(`${d.studentRows.length} sekolah`)
    await expect(rowsOf(table)).toHaveCount(d.studentRows.length)
    await expect(table.getByTestId('mon-school-link').first()).toHaveText(d.studentRows[0]!.name)

    // Guide (FN-M11-3.1.2) with its tip.
    await expect(page.getByText('Panduan Monitoring Penglibatan')).toBeVisible()
    await expect(
      page.getByText(
        'Tip: Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan.',
      ),
    ).toBeVisible()
    await expectNoHScroll(page)
  })

  test('AC-M11-10.2 AC-M11-12.2 AC-M11-17 period filter, Tapis, pause and the five tabs @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const all = await openWith<Overview>(page, MON, '/api/monitoring/overview')
    await expect(page.getByTestId('mon-kpis')).toBeVisible(SLOW)

    // Tempoh = 7 Hari + Tapis: the request carries period=7d and "7 Hari" stays selected.
    const filtered = page.waitForResponse(
      (r) => r.url().includes('/api/monitoring/overview') && r.url().includes('period=7d'),
      SLOW,
    )
    await openFilters(page)
    await page.getByTestId('mon-period').selectOption({ label: '7 Hari' })
    await applyFilters(page)
    expect((await filtered).status()).toBe(200)
    await expect(page).toHaveURL(/period=7d/)
    await openFilters(page)
    await expect(page.getByTestId('mon-period')).toHaveValue('7d')
    await closeFilters(page)
    await expect(page.getByTestId('mon-table-student')).toBeVisible()
    await expectHealthy(page)

    // The countdown can be paused and resumed (icon follows the state).
    const toggle = page.getByTestId('mon-refresh-toggle')
    await expect(toggle).toHaveAttribute('data-icon', 'pause')
    await toggle.click()
    await expect(toggle).toHaveAttribute('data-icon', 'play')
    await expect(toggle).toHaveAccessibleName('Sambung auto-refresh')
    await toggle.click()
    await expect(toggle).toHaveAttribute('data-icon', 'pause')

    // Back to the unfiltered page, then each tab shows its section.
    await gotoApi(page, MON)
    const tabs = page.getByTestId('mon-tabs')
    await expect(page.getByTestId('mon-table-student')).toBeVisible(SLOW)

    await tabs.getByRole('tab', { name: 'Analisis Guru' }).click()
    const teachers = page.getByTestId('mon-table-teacher')
    await expect(teachers).toBeVisible()
    await expect(teachers.getByTestId('mon-table-count')).toHaveText(
      `${all.teacherRows.length} sekolah`,
    )
    await expectNoHScroll(page)

    await tabs.getByRole('tab', { name: 'Tracking Mingguan' }).click()
    await expect(page.getByTestId('mon-weekly')).toBeVisible()
    await expect(rowsOf(page.getByTestId('mon-weekly'))).toHaveCount(all.weekly.length)
    await expectNoHScroll(page)

    await tabs.getByRole('tab', { name: 'Sekolah Cemerlang / Perhatian Segera' }).click()
    await expect(page.locator('#section-perhatian')).toBeVisible()
    await expectNoHScroll(page)

    await tabs.getByRole('tab', { name: 'Cadangan Tindakan' }).click()
    await expect(page.locator('#section-cadangan')).toBeVisible()
    await expectNoHScroll(page)
  })

  test('AC-M11-14.5 AC-M11-18 AC-M11-19 AC-M11-20 AC-M11-25 drill-down S2 to S3 to S5 to S4 @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const overview = await openWith<Overview>(page, MON, '/api/monitoring/overview')
    const row = overview.studentRows[0]!
    expect(row, 'seed: the overview has a school row').toBeDefined()

    // S2 -> S3 through the school link.
    const schoolApi = page.waitForResponse(
      (r) => r.url().endsWith(`/api/monitoring/schools/${row.schoolId}`),
      SLOW,
    )
    await page.getByTestId('mon-table-student').getByTestId('mon-school-link').first().click()
    const school = await bodyOf<SchoolDetail>(await schoolApi)
    await expect(page).toHaveURL(new RegExp(`${MON}/sekolah/${row.schoolId}$`))
    await expect(page.getByTestId('monitoring-school-page')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle(`${school.school.name} - Monitoring`)
    await expect(page.getByTestId('mon-crumbs')).toContainText('Monitoring')
    await expect(page.getByTestId('mon-crumbs')).toContainText(school.school.name)
    await expect(page.getByTestId('mon-school-name')).toHaveText(school.school.name)
    await expect(page.getByTestId('mon-school-code')).toContainText(school.school.code ?? '-')
    await expect(page.getByTestId('mon-school-state')).toContainText(school.school.state)
    for (const [key, label, value] of [
      ['students', 'Pelajar T4/T5', school.cards.students],
      ['engaged', 'Pernah Aktif', school.cards.engaged],
      ['answers', 'Soalan Dijawab', school.cards.answers],
      ['teachers', 'Guru Berdaftar', school.cards.teachers],
      ['teachersLoggedIn', 'Guru Pernah Login', school.cards.teachersLoggedIn],
    ] as const) {
      await expectTileValue(
        page.getByTestId(`mon-stat-${key}`),
        label,
        value.toLocaleString('en-US'),
      )
    }
    await expect(page.getByText('Senarai Pelajar T4/T5')).toBeVisible()
    await expect(page.getByTestId('mon-pill-all')).toHaveText(`Semua (${school.students.length})`)
    await expect(page.getByTestId('mon-pill-never')).toHaveText('Belum login')
    const pupilRows = rowsOf(page.getByTestId('mon-student-scroller'))
    await expect(pupilRows).toHaveCount(school.students.length)
    await expectNoHScroll(page)

    // The search box filters the rows; a nonsense term leaves none (AC-M11-19.4), clearing restores them.
    const search = page.getByTestId('mon-student-search')
    await search.fill('zzzz-no-such-pupil')
    const pupilLinks = page.getByTestId('mon-student-scroller').locator('a[href*="/pelajar/"]')
    await expect(pupilLinks).toHaveCount(0)
    await search.fill('')
    await expect(pupilLinks).toHaveCount(school.students.length)

    // Teacher tab (AC-M11-20.1) and the S5 page of its first teacher.
    const teacherTab = page.getByRole('tab', { name: `Guru (${school.teachers.length})` })
    await expect(teacherTab).toBeVisible()
    await teacherTab.click()
    const teacher = school.teachers[0]!
    expect(teacher, 'seed: the school has a teacher').toBeDefined()
    await expect(rowsOf(page.getByTestId('mon-teacher-scroller'))).toHaveCount(
      school.teachers.length,
    )
    await expectNoHScroll(page)
    const teacherApi = page.waitForResponse(
      (r) => r.url().endsWith(`/api/monitoring/schools/${row.schoolId}/teachers/${teacher.id}`),
      SLOW,
    )
    await page.locator(`a[href$="/guru/${teacher.id}"]`).first().click()
    expect((await teacherApi).status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`${MON}/sekolah/${row.schoolId}/guru/${teacher.id}$`))
    await expect(page.getByTestId('monitoring-teacher-page')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page.getByTestId('mon-teacher-name').first()).toBeVisible()
    await expect(page.getByTestId('mon-teacher-cards')).toBeVisible()
    await expect(page.getByTestId('mon-teacher-students')).toContainText('Prestasi Pelajar')
    await expect(page.getByTestId('mon-teacher-suggestions')).toContainText('Cadangan Tindakan')
    await expectNoHScroll(page)
    await page.goBack()
    await expect(page.getByTestId('monitoring-school-page')).toBeVisible(SLOW)

    // S3 -> S4 through the pupil link of the list (first tab of S3).
    const pupil = school.students[0]!
    expect(pupil, 'seed: the school has a pupil').toBeDefined()
    const pupilApi = page.waitForResponse(
      (r) => r.url().endsWith(`/api/monitoring/schools/${row.schoolId}/students/${pupil.id}`),
      SLOW,
    )
    await page.locator(`a[href$="/sekolah/${row.schoolId}/pelajar/${pupil.id}"]`).first().click()
    expect((await pupilApi).status()).toBe(200)
    await expect(page.getByTestId('monitoring-student-page')).toBeVisible(SLOW)
    await expect(page.getByTestId('mon-student-name')).toHaveText(pupil.name)
    await expectNoHScroll(page)
  })

  test('AC-M11-21 AC-M11-24.2 S4 pupil detail: cards, tabs and the Gap Analysis empty state @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const overview = await getData<Overview>(page, '/api/monitoring/overview')
    const schoolId = overview.studentRows[0]!.schoolId
    const school = await getData<SchoolDetail>(page, `/api/monitoring/schools/${schoolId}`)

    // Seed preconditions (fail loudly): one pupil without answers (AC-M11-21.5: the page renders) and
    // one with answers.
    const idle = school.students.find((s) => s.answers === 0)
    const active = school.students.find((s) => s.answers > 0)
    expect(idle, 'seed: a pupil without answers').toBeDefined()
    expect(active, 'seed: a pupil with answers').toBeDefined()
    const pupils = [idle!, active!]
    for (const pupil of pupils) {
      const d = await openWith<StudentDetail>(
        page,
        `${MON}/sekolah/${schoolId}/pelajar/${pupil.id}`,
        `/students/${pupil.id}`,
      )
      await expect(page.getByTestId('monitoring-student-page')).toBeVisible(SLOW)
      await expectHealthy(page)
      await expect(page).toHaveTitle(`${d.student.name} - Detail Pelajar`)
      await expect(page.getByTestId('mon-student-name')).toHaveText(d.student.name)
      await expect(page.getByTestId('mon-student-meta')).toContainText(pupil.email)
      await expect(page.getByTestId('mon-student-last')).toContainText('Aktiviti Terakhir:')
      const cards = page.getByTestId('mon-student-cards')
      for (const label of ['Soalan Dijawab', 'Betul', 'Salah', 'Ketepatan']) {
        await expect(cards.getByText(label, { exact: true }), label).toBeVisible()
      }

      // The five tabs; "Mengikut Subjek" is open by default.
      for (const key of ['subject', 'topic', 'list', 'wrong', 'gaps']) {
        await expect(page.getByTestId(`mon-tab-${key}`), key).toBeVisible()
      }
      await expect(page.getByTestId('mon-tab-gaps')).toContainText('Gap Analysis')
      await expect(page.getByTestId('mon-tab-wrong')).toContainText('Jawapan Salah')
      await expect(page.getByTestId('mon-panel-subject')).toBeVisible()
      await expectNoHScroll(page)

      // Gap Analysis: gap cards, or the empty-state copy plus the "not yet tried" subjects.
      await page.getByTestId('mon-tab-gaps').click()
      const gaps = page.getByTestId('mon-panel-gaps')
      await expect(gaps).toBeVisible()
      await expect(gaps).toContainText('Gap Analysis & Cadangan Latihan')
      if (d.gaps.items.length === 0) {
        await expect(page.getByTestId('mon-gap-empty')).toContainText('Tiada topik lemah dikesan!')
        await expect(page.getByTestId('mon-gap-empty')).toContainText(
          'Semua topik yang dicuba mempunyai ketepatan melebihi 60%.',
        )
        await expect(page.getByTestId('mon-gap-card')).toHaveCount(0)
      } else {
        await expect(page.getByTestId('mon-gap-card')).toHaveCount(d.gaps.items.length)
      }
      await expect(gaps).toContainText('Subjek Belum Dicuba')
      await expectNoHScroll(page)

      // Senarai Soalan and Jawapan Salah open without an error (their rows depend on the question bank).
      await page.getByTestId('mon-tab-list').click()
      await expect(page.getByTestId('mon-panel-list')).toBeVisible()
      await expect(page.getByTestId('mon-list-heading')).toContainText('Senarai Soalan (')
      await page.getByTestId('mon-tab-wrong').click()
      await expect(page.getByText(/Jawapan Salah \(\d+ jawapan, \d+ soalan unik\)/)).toBeVisible()
      await expectNoHScroll(page)
    }
  })

  test('AC-M11-03.2 unknown school, pupil, teacher and extra path segments render the 404 page @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const overview = await getData<Overview>(page, '/api/monitoring/overview')
    const schoolId = overview.studentRows[0]?.schoolId ?? '1'
    for (const path of [
      `${MON}/sekolah/99999999`,
      `${MON}/sekolah/${schoolId}/pelajar/99999999`,
      `${MON}/sekolah/${schoolId}/guru/99999999`,
      `${LAPORAN}/4`,
      `${ITEM}/4`,
    ]) {
      await gotoApi(page, path)
      await expectNotFoundPage(page)
      await expectNoHScroll(page)
    }
  })

  test('AC-M11-30.1 AC-M11-30.2 school admin alias shows only the own school; another school, its teacher and a cross-school pupil answer 404 @api', async ({
    page,
    browser,
  }, info) => {
    await signIn(page, 'adminSekolah')
    const d = await openWith<Overview>(page, MON_SA, '/api/monitoring/overview')
    await expect(page.getByTestId('monitoring-page')).toBeVisible(SLOW)
    await expect(page.getByTestId('mon-kpis')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Monitoring Penglibatan Sekolah - Admin')
    expect(d.studentRows.length, 'one school only').toBe(1)
    expect(d.teacherRows.length, 'one school only').toBe(1)
    const own = d.studentRows[0]!
    await expect(page.getByTestId('mon-table-student').getByTestId('mon-table-count')).toHaveText(
      '1 sekolah',
    )
    await expect(rowsOf(page.getByTestId('mon-table-student'))).toHaveCount(1)
    await expectNoHScroll(page)

    // Its school link stays under the alias prefix and opens S3 with the S2 figures.
    const schoolApi = page.waitForResponse(
      (r) => r.url().endsWith(`/api/monitoring/schools/${own.schoolId}`),
      SLOW,
    )
    await page.getByTestId('mon-school-link').first().click()
    const school = await bodyOf<SchoolDetail>(await schoolApi)
    await expect(page).toHaveURL(new RegExp(`${MON_SA}/sekolah/${own.schoolId}$`))
    await expect(page.getByTestId('mon-school-name')).toHaveText(own.name)
    await expect(page.getByTestId('mon-pill-all')).toHaveText(`Semua (${school.students.length})`)
    expect(school.cards.students, 'S3 equals the S2 row for the school admin').toBe(own.registered)
    await expectNoHScroll(page)
    const ownPupil = school.students[0]!
    expect(ownPupil, 'seed: the own school has a pupil').toBeDefined()

    // A REAL second school and one of its teachers, as the platform admin sees them (own context).
    const adminContext = await newPeerContext(browser, info)
    let other: { schoolId: string; teacherId: string }
    try {
      const adminPage = await adminContext.newPage()
      await signIn(adminPage, 'adminPusat')
      const options = await getData<{ schools: { id: string }[] }>(
        adminPage,
        '/api/kirkpatrick/filter-options',
      )
      const second = options.schools.find((s) => s.id !== own.schoolId)
      expect(second, 'seed: a second school exists').toBeDefined()
      const detail = await getData<SchoolDetail>(adminPage, `/api/monitoring/schools/${second!.id}`)
      expect(detail.teachers[0], 'seed: the second school has a teacher').toBeDefined()
      other = { schoolId: second!.id, teacherId: detail.teachers[0]!.id }
    } finally {
      await adminContext.close()
    }

    // The school admin gets 404 for everything of the other school, identical to an unknown id
    // (AC-M11-30.2): the school (S3), its teacher (S5), the teacher under the own school id, and an
    // own pupil asked for through the other school (S4).
    const foreign = [
      `/api/monitoring/schools/${other.schoolId}`,
      `/api/monitoring/schools/${other.schoolId}/teachers/${other.teacherId}`,
      `/api/monitoring/schools/${own.schoolId}/teachers/${other.teacherId}`,
      `/api/monitoring/schools/${other.schoolId}/students/${ownPupil.id}`,
      '/api/monitoring/schools/99999999',
    ]
    for (const api of foreign) {
      expect((await page.request.get(api)).status(), `GET ${api}`).toBe(404)
    }
    for (const path of [
      `${MON_SA}/sekolah/${other.schoolId}`,
      `${MON_SA}/sekolah/${other.schoolId}/guru/${other.teacherId}`,
      `${MON_SA}/sekolah/${own.schoolId}/guru/${other.teacherId}`,
      `${MON_SA}/sekolah/${other.schoolId}/pelajar/${ownPupil.id}`,
      `${MON_SA}/sekolah/99999999`,
    ]) {
      await gotoApi(page, path)
      await expectNotFoundPage(page)
    }
  })

  test('D43 teacher: Laporan Mingguan shows the prototype-scope page (the AC-M11-28.2 empty-state copy is not built), not an error page @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    await gotoApi(page, '/guru/laporan-mingguan-kelas')
    await expect(page).toHaveTitle('Belum Tersedia dalam Prototaip | PRESTASIPLUS')
    await expect(page.getByText('Belum tersedia dalam prototaip')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Kembali ke Dashboard' })).toBeVisible()
    await expect(page.getByText('Halaman Tidak Dijumpai')).toHaveCount(0)
    await expectNoHScroll(page)
  })
})

// =====================================================================================================
// Guards
// =====================================================================================================

test.describe('M11 guards @api', () => {
  test.setTimeout(90_000)

  test('AC-M11-03.1 without a session every M11 route is sent to /login @api', async ({ page }) => {
    for (const path of [LAPORAN, ITEM, MON, `${MON}/sekolah/1`, MON_SA]) {
      await page.goto(path)
      await expect(page, path).toHaveURL(/\/login(\?|$)/, SLOW)
      await expect(page.getByTestId('login-form')).toBeVisible()
    }
    await expectNoHScroll(page)
  })

  test('INFERRED (no AC for the pupil role): a pupil is sent to the pupil dashboard and the API answers 403 @api', async ({
    page,
  }) => {
    await signIn(page, 'student')
    const landed = new RegExp(`${HOME.student}$`)
    for (const path of [LAPORAN, ITEM, MON, `${MON}/sekolah/1`, MON_SA]) {
      await gotoApi(page, path)
      await expect(page, path).toHaveURL(landed, SLOW)
      await expect(page.getByTestId('laporan-page')).toHaveCount(0)
      await expect(page.getByTestId('monitoring-page')).toHaveCount(0)
    }
    for (const api of [
      '/api/teacher/report',
      '/api/teacher/item-analysis',
      '/api/monitoring/overview',
      '/api/monitoring/schools/1',
    ]) {
      expect((await page.request.get(api)).status(), `pupil GET ${api}`).toBe(403)
    }
    await expectNoHScroll(page)
  })

  test('AC-M11-30.2 a school admin cannot open S1, S6 or the /guru monitoring mount @api', async ({
    page,
  }) => {
    await signIn(page, 'adminSekolah')
    const landed = new RegExp(`${HOME.adminSekolah}$`)
    for (const path of [LAPORAN, ITEM, MON]) {
      await gotoApi(page, path)
      await expect(page, path).toHaveURL(landed, SLOW)
    }
    for (const api of ['/api/teacher/report', '/api/teacher/item-analysis']) {
      expect((await page.request.get(api)).status(), `school admin GET ${api}`).toBe(403)
    }
    // The alias is the school admin's own entry and still works.
    expect((await page.request.get('/api/monitoring/overview')).status()).toBe(200)
    await gotoApi(page, MON_SA)
    await expect(page.getByTestId('monitoring-page')).toBeVisible(SLOW)
    await expect(page).not.toHaveTitle(FORBIDDEN_TITLE)
    await expectNoHScroll(page)
  })
})

// =====================================================================================================
// Responsive sweep: every M11 screen, the three Playwright projects
// =====================================================================================================

test.describe('M11 responsive @api', () => {
  test.setTimeout(150_000)

  test('AC-M11-29.1 teacher screens S1, S6, S2 (all tabs), S3, S4, S5 have no horizontal page scroll @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const overview = await getData<Overview>(page, '/api/monitoring/overview')
    const schoolId = overview.studentRows[0]!.schoolId
    const school = await getData<SchoolDetail>(page, `/api/monitoring/schools/${schoolId}`)

    // S1 with every panel open one after the other.
    await gotoApi(page, LAPORAN)
    await expect(page.getByTestId('card-login')).toBeVisible(SLOW)
    await expectNoHScroll(page)
    for (const card of ['card-login', 'card-latihan', 'card-aktiviti', 'card-skor']) {
      await page.getByTestId(card).click()
      await expectNoHScroll(page)
    }
    await gotoApi(page, `${LAPORAN}?range=90`)
    await expect(page.getByTestId('card-login')).toBeVisible(SLOW)
    await expectNoHScroll(page)

    // S6.
    await gotoApi(page, ITEM)
    await expect(page.getByTestId('filter-card')).toBeVisible(SLOW)
    await expectNoHScroll(page)

    // S2 and its tabs.
    await gotoApi(page, MON)
    await expect(page.getByTestId('mon-kpis')).toBeVisible(SLOW)
    await expectNoHScroll(page)
    for (const name of [
      'Analisis Guru',
      'Tracking Mingguan',
      'Sekolah Cemerlang / Perhatian Segera',
      'Cadangan Tindakan',
    ]) {
      await page.getByTestId('mon-tabs').getByRole('tab', { name }).click()
      await expectNoHScroll(page)
    }

    // S3 (both tabs), S5 and S4.
    await gotoApi(page, `${MON}/sekolah/${schoolId}`)
    await expect(page.getByTestId('mon-school-header')).toBeVisible(SLOW)
    await expectNoHScroll(page)
    await page.getByRole('tab', { name: /^Guru \(/ }).click()
    await expectNoHScroll(page)
    const teacher = school.teachers[0]!
    expect(teacher, 'seed: the school has a teacher').toBeDefined()
    await gotoApi(page, `${MON}/sekolah/${schoolId}/guru/${teacher.id}`)
    await expect(page.getByTestId('mon-teacher-header')).toBeVisible(SLOW)
    await expectNoHScroll(page)
    for (const pupil of school.students.slice(0, 2)) {
      await gotoApi(page, `${MON}/sekolah/${schoolId}/pelajar/${pupil.id}`)
      await expect(page.getByTestId('mon-student-header')).toBeVisible(SLOW)
      await expectNoHScroll(page)
      for (const key of ['topic', 'list', 'wrong', 'gaps']) {
        await page.getByTestId(`mon-tab-${key}`).click()
        await expectNoHScroll(page)
      }
    }
  })

  test('AC-M11-29.1 school admin alias S2 and S3 have no horizontal page scroll @api', async ({
    page,
  }) => {
    await signIn(page, 'adminSekolah')
    const overview = await getData<Overview>(page, '/api/monitoring/overview')
    const schoolId = overview.studentRows[0]!.schoolId
    await gotoApi(page, MON_SA)
    await expect(page.getByTestId('mon-kpis')).toBeVisible(SLOW)
    await expectNoHScroll(page)
    await page.getByTestId('mon-tabs').getByRole('tab', { name: 'Tracking Mingguan' }).click()
    await expectNoHScroll(page)
    await gotoApi(page, `${MON_SA}/sekolah/${schoolId}`)
    await expect(page.getByTestId('mon-school-header')).toBeVisible(SLOW)
    await expectNoHScroll(page)
  })
})
