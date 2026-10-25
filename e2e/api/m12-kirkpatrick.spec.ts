/**
 * @api M12 "Kirkpatrick" (S1-S8) against the REAL API (EX-4, slug `m12-kirkpatrick`). Read-only: no test
 * posts an intervention or feedback, so the shared seeded database is safe with workers=1.
 *
 * Screens (src/modules/m12-kirkpatrick/routes, docs/requirements/{urs,srs}/M12-kirkpatrick.md):
 * - S1 `/admin/kirkpatrick` Overview          <- GET /api/kirkpatrick/overview (+ filter-options)
 * - S2 `/reaction`, S3 `/learning`, S4 `/behavior`, S5 `/results`, S6 `/chain`, S7 `/interventions`
 * - S8 `/pelajar/:id`                          <- GET /api/kirkpatrick/students/:id
 * Mounts: `/admin/kirkpatrick` (admin), `/guru/kirkpatrick` (teacher + admin, every screen) and the
 * school-admin alias `/admin-sekolah/kirkpatrick` (S1 only, no detail links, scope forced to the own school).
 * A role the route does not allow is sent to its landing page; the API answers 403 for a pupil.
 *
 * The seed is relative to "now" and other specs change the demo pupil's activity, so figures are NEVER
 * hard-coded: every test reads the same endpoint the page reads and compares the rendered numbers with
 * that response (this also proves the page shows the real API and not the in-browser mock). Layout: every
 * screen is measured for horizontal page overflow on the three Playwright projects (375 / 768 / 1280).
 *
 * What the fresh poc seed leaves EMPTY: interventions (the S7 rows) and the T1 reaction responses. On this
 * seed only their empty states run; populated S7 rows are checked by count only.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_ADMIN_PASS / BIJAK_GURU_PASS / BIJAK_ADMIN_SEKOLAH_PASS /
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

const ADMIN = '/admin/kirkpatrick'
const GURU = '/guru/kirkpatrick'
const ALIAS = '/admin-sekolah/kirkpatrick'

// ---- response shapes (only the fields the specs read; src/modules/m12-kirkpatrick/api/types.ts) ----

interface Overview {
  scope: { schoolId: string | null; state: string | null }
  t4: { gps: number | null; recordsLabel: number }
  t3: { active: number; t4t5: number; sessions: number; accuracy: number }
  t2: { accuracy: number; answers: number }
  t1: { satisfaction: number; responses: number }
  comparison: { subtitle: string }
  kpi: {
    t4t5: number
    answers: number
    teachersLoggedIn: number
    teachers: number
    accuracy: number
  }
  bands: { key: string; count: number; pct: number }[]
}
interface FilterOptions {
  schools: { id: string; name: string }[]
  states: string[]
}
interface Reaction {
  npsStudent: number
  npsTeacher: number
  npsAdmin: number
  satisfaction: number
}
interface Learning {
  kpi: {
    answers: number
    accuracy: number
    avgScore: number
    sessionsCompleted: number
    sessions: number
    completionPct: number
  }
  subjects: { name: string; answers: number; accuracy: number; status: string }[]
  schools: { schoolId: string; name: string; students: number; answers: number }[]
}
interface Behavior {
  kpi: {
    t4t5: number
    active: number
    sessions: number
    answers: number
    accuracy: number
    teacherPct: number
  }
  bands: { key: string; count: number; pct: number }[]
  schools: { schoolId: string; name: string; students: number; active: number }[]
  alerts: unknown[]
}
interface Results {
  kpi: { accuracy: number; active: number; t4t5: number }
  schools: { schoolId: string; name: string }[]
  predictions: { userId: string; name: string }[]
}
interface Chain {
  t2: { accuracy: number; answers: number }
  t3: { active: number; t4t5: number; sessions: number }
  correlation: { bands: { label: string; n: number; acc: number }[]; r: number }
}
interface Interventions {
  kpi: { total: number; pending: number; up: number; down: number }
  rows: unknown[]
}
interface StudentKirkpatrick {
  student: { id: string; name: string; schoolName: string; grade: number }
  answers: number
  accuracy: number
  platform: { subjectName: string }[]
}
interface MonitoringSchool {
  school: { id: string; name: string }
  students: { id: string; name: string; answers: number }[]
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

/** No load-error, no 403/404 page, no "not in the prototype" page, and the loading line is gone. */
async function expectHealthy(page: Page): Promise<void> {
  await expect(page.locator('[data-page=forbidden]')).toHaveCount(0)
  await expect(page.getByText('Belum tersedia dalam prototaip')).toHaveCount(0)
  await expect(page.getByTestId('kirk-error')).toHaveCount(0)
  await expect(page.getByTestId('kirk-loading')).toHaveCount(0)
}

async function expectNotFoundPage(page: Page): Promise<void> {
  await expect(page).toHaveTitle(NOT_FOUND_TITLE, SLOW)
  await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
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

/** `Number(n.toFixed(1))` as text: one decimal, ".0" dropped (src/lib/number, `mean` / `pct`). */
const mean = (n: number): string => String(Number(n.toFixed(1)))
const count = (n: number): string => n.toLocaleString('en-US')

/** A stat tile shows its label and the figure as one exact line (a bare "0" elsewhere cannot pass). */
async function expectTileValue(tile: Locator, label: string, value: string): Promise<void> {
  await expect(tile, label).toContainText(label)
  await expect
    .poll(async () => (await tile.innerText()).split('\n').map((l) => l.trim()), { message: label })
    .toContain(value)
}

const TAB_LABELS = [
  'Overview',
  'T1: Reaksi',
  'T2: Pembelajaran',
  'T3: Tingkah Laku',
  'T4: Hasil',
  'Intervensi',
]

/** The in-page level strip of S2-S5 and S7: six links, built from the mount prefix, one active. */
async function expectTabStrip(page: Page, prefix: string, active: string): Promise<void> {
  const strip = page.getByTestId('kirk-tabs')
  await expect(strip).toBeVisible()
  await expect(strip.getByRole('link')).toHaveText(TAB_LABELS)
  for (const link of await strip.getByRole('link').all()) {
    await expect(link).toHaveAttribute('href', new RegExp(`^${prefix}(/|$|\\?)`))
  }
  await expect(page.getByTestId(`kirk-tab-${active}`)).toHaveAttribute('data-active', 'true')
}

/** The id of a pupil of the demo school, found through the monitoring API (admin and teacher may read it). */
async function firstPupil(page: Page): Promise<MonitoringSchool['students'][number]> {
  const overview = await getData<{ studentRows: { schoolId: string }[] }>(
    page,
    '/api/monitoring/overview',
  )
  const schoolId = overview.studentRows[0]!.schoolId
  const school = await getData<MonitoringSchool>(page, `/api/monitoring/schools/${schoolId}`)
  expect(school.students.length, 'the school has pupils').toBeGreaterThan(0)
  return school.students[0]!
}

// =====================================================================================================
// S1 Overview
// =====================================================================================================

test.describe('M12 S1 Overview @api', () => {
  test.setTimeout(90_000)

  test('AC-M12-05.1 AC-M12-06 AC-M12-07 AC-M12-08 AC-M12-09 admin: filter, level cards, flow, comparison, KPIs and bands equal GET /api/kirkpatrick/overview @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const options = page.waitForResponse(
      (r) => r.url().includes('/api/kirkpatrick/filter-options'),
      SLOW,
    )
    const d = await openWith<Overview>(page, ADMIN, '/api/kirkpatrick/overview')
    const filterOptions = await bodyOf<FilterOptions>(await options)
    await expect(page.getByTestId('kirk-overview-page')).toBeVisible(SLOW)
    await expect(page.getByTestId('kirk-levels')).toBeVisible(SLOW)
    await expectHealthy(page)

    await expect(page).toHaveTitle('Kirkpatrick Evaluation Dashboard')
    await expect(
      page.getByRole('heading', { name: 'Kirkpatrick Evaluation', level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByText('Analisis Keberkesanan Platform — Model Penilaian 4 Tahap'),
    ).toBeVisible()
    // The overview has no level strip (S2-S5 and S7 only).
    await expect(page.getByTestId('kirk-tabs')).toHaveCount(0)

    // Filter: Sekolah and Negeri with their options from filter-options.
    await openFilters(page)
    await expect(page.getByLabel('Sekolah', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Negeri', { exact: true })).toBeVisible()
    await expect(page.getByTestId('kirk-filter-school').locator('option')).toHaveText([
      'Semua Sekolah',
      ...filterOptions.schools.map((s) => s.name),
    ])
    await expect(page.getByTestId('kirk-filter-state').locator('option')).toHaveText([
      'Semua Negeri',
      ...filterOptions.states,
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

    // The four level cards, in the documented order (T4, T3, T2, T1), with the response figures.
    const t4 = page.getByTestId('kirk-level-t4')
    await expect(t4).toContainText('Tahap 4: Hasil')
    await expect(t4.getByTestId('kirk-level-value')).toHaveText(
      d.t4.gps === null ? 'Belum Ada Data' : d.t4.gps.toFixed(2),
    )
    await expect(t4.getByTestId('kirk-level-caption')).toHaveText(
      d.t4.gps === null
        ? 'Import keputusan peperiksaan'
        : `GPS Sekolah · ${d.t4.recordsLabel} rekod headcount`,
    )
    const t3 = page.getByTestId('kirk-level-t3')
    await expect(t3).toContainText('Tahap 3: Tingkah Laku')
    await expect(t3.getByTestId('kirk-level-value')).toHaveText(`${d.t3.active}/${d.t3.t4t5}`)
    await expect(t3.getByTestId('kirk-level-caption')).toContainText(`${d.t3.sessions} sesi`)
    await expect(t3.getByTestId('kirk-level-caption')).toContainText(`${d.t3.accuracy}% ketepatan`)
    const t2 = page.getByTestId('kirk-level-t2')
    await expect(t2).toContainText('Tahap 2: Pembelajaran')
    await expect(t2.getByTestId('kirk-level-value')).toHaveText(`${d.t2.accuracy}%`)
    await expect(t2.getByTestId('kirk-level-caption')).toContainText(
      `${d.t2.answers.toLocaleString('en-US')} soalan dijawab`,
    )
    const t1 = page.getByTestId('kirk-level-t1')
    await expect(t1).toContainText('Tahap 1: Reaksi')
    await expect(t1.getByTestId('kirk-level-value')).toHaveText(`${mean(d.t1.satisfaction)}/5`)
    await expect(t1.getByTestId('kirk-level-caption')).toContainText(`${d.t1.responses} respon`)
    for (const card of [t4, t3, t2, t1]) await expect(card).toContainText('Lihat detail')

    // Flow, before/after comparison, KPI links, engagement bands and the model note.
    await expect(page.getByTestId('kirk-flow')).toContainText('Kirkpatrick Evaluation Flow')
    await expect(page.getByTestId('kirk-comparison-subtitle')).toHaveText(d.comparison.subtitle)
    await expect(page.getByText('Perbandingan Sebelum & Selepas')).toBeVisible()
    await expectTileValue(
      page.getByTestId('kirk-kpi-registered'),
      'Pelajar Berdaftar (T4/T5)',
      count(d.kpi.t4t5),
    )
    await expectTileValue(
      page.getByTestId('kirk-kpi-answers'),
      'Soalan Dijawab',
      count(d.kpi.answers),
    )
    await expectTileValue(
      page.getByTestId('kirk-kpi-teachers'),
      'Guru Aktif',
      `${d.kpi.teachersLoggedIn}/${d.kpi.teachers}`,
    )
    await expectTileValue(
      page.getByTestId('kirk-kpi-accuracy'),
      'Ketepatan Keseluruhan',
      `${mean(d.kpi.accuracy)}%`,
    )
    await expect(page.getByText('Taburan Engagement Pelajar')).toBeVisible()
    await expect(page.getByTestId('kirk-band-count')).toHaveCount(5)
    await expect(page.getByTestId('kirk-band-count')).toHaveText(
      d.bands.map((b) => String(b.count)),
    )
    await expect(page.getByTestId('kirk-info')).toContainText(
      'Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan',
    )
    await expectNoHScroll(page)
  })

  test('AC-M12-05.2 AC-M12-06.2 choosing a school and Tapis re-reads the API; a card opens its level @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const filterApi = page.waitForResponse(
      (r) => r.url().includes('/api/kirkpatrick/filter-options'),
      SLOW,
    )
    await openWith<Overview>(page, ADMIN, '/api/kirkpatrick/overview')
    const options = await bodyOf<FilterOptions>(await filterApi)
    const school = options.schools[0]
    expect(school, 'seed: filter-options lists a school').toBeDefined()
    await expect(page.getByTestId('kirk-levels')).toBeVisible(SLOW)

    const scoped = page.waitForResponse(
      (r) =>
        r.url().includes('/api/kirkpatrick/overview') && r.url().includes(`schoolId=${school!.id}`),
      SLOW,
    )
    await openFilters(page)
    await page.getByTestId('kirk-filter-school').selectOption(school!.id)
    await applyFilters(page)
    const d = await bodyOf<Overview>(await scoped)
    await expect(page).toHaveURL(new RegExp(`/admin/kirkpatrick\\?school_id=${school!.id}&state=$`))
    expect(d.scope.schoolId).toBe(school!.id)
    await expect(page.getByText('Penapis aktif')).toBeVisible()
    await openFilters(page)
    await expect(page.getByTestId('kirk-filter-school')).toHaveValue(school!.id)
    await closeFilters(page)
    await expect(page.getByTestId('kirk-level-t3').getByTestId('kirk-level-value')).toHaveText(
      `${d.t3.active}/${d.t3.t4t5}`,
    )
    await expectHealthy(page)
    await expectNoHScroll(page)

    // Reset goes back to the unfiltered overview; a level card opens its screen.
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick$/)
    await openFilters(page)
    await expect(page.getByTestId('kirk-filter-school')).toHaveValue('')
    await closeFilters(page)
    await page.getByTestId('kirk-level-t3').click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\/behavior$/)
    await expect(page.getByTestId('kirk-behavior')).toBeVisible(SLOW)
    await expect(page.getByTestId('kirk-tab-behavior')).toHaveAttribute('data-active', 'true')
  })
})

// =====================================================================================================
// S2-S7 level screens (admin mount)
// =====================================================================================================

test.describe('M12 S2-S7 level screens @api', () => {
  test.setTimeout(90_000)

  test('AC-M12-01.3 AC-M12-10 S2 Reaksi: tab strip and the four cards equal GET /api/kirkpatrick/reaction @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const d = await openWith<Reaction>(page, `${ADMIN}/reaction`, '/api/kirkpatrick/reaction')
    await expect(page.getByTestId('kirk-reaction-page')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Tahap 1: Reaksi — Kirkpatrick')
    await expect(page.getByRole('heading', { name: 'Tahap 1: Reaksi', level: 1 })).toBeVisible()
    await expect(page.getByText('Kepuasan dan persepsi pengguna terhadap platform')).toBeVisible()
    await expectTabStrip(page, ADMIN, 'reaction')

    const cards = page.getByTestId('kirk-reaction-cards')
    await expect(cards).toBeVisible()
    for (const [key, label, value] of [
      ['nps-student', 'NPS Pelajar', `${mean(d.npsStudent)}/10`],
      ['nps-teacher', 'NPS Guru', `${mean(d.npsTeacher)}/10`],
      ['nps-admin', 'NPS Admin', `${mean(d.npsAdmin)}/10`],
      ['satisfaction', 'Kepuasan Purata', `${mean(d.satisfaction)}/5`],
    ] as const) {
      await expectTileValue(page.getByTestId(`kirk-${key}`), label, value)
    }
    await expectNoHScroll(page)
  })

  test('AC-M12-11 AC-M12-12 AC-M12-13 S3 Pembelajaran: KPIs, subjects and schools equal GET /api/kirkpatrick/learning @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const d = await openWith<Learning>(page, `${ADMIN}/learning`, '/api/kirkpatrick/learning')
    await expect(page.getByTestId('kirk-learning-page')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Tahap 2: Pembelajaran — Kirkpatrick')
    await expect(
      page.getByRole('heading', { name: 'Tahap 2: Pembelajaran', level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByText('Peningkatan pengetahuan, kemahiran, dan kefahaman pelajar'),
    ).toBeVisible()
    await expectTabStrip(page, ADMIN, 'learning')

    await expect(page.getByTestId('kirk-learning-kpis')).toBeVisible()
    for (const [key, label, value] of [
      ['answers', 'Soalan Dijawab', count(d.kpi.answers)],
      ['accuracy', 'Ketepatan', `${mean(d.kpi.accuracy)}%`],
      ['score', 'Skor Purata', `${mean(d.kpi.avgScore)}%`],
      ['sessions', 'Sesi Selesai', `${d.kpi.sessionsCompleted}/${d.kpi.sessions}`],
      ['completion', 'Kadar Penyelesaian', `${mean(d.kpi.completionPct)}%`],
      ['gain', 'Learning Gain', '-'],
    ] as const) {
      await expectTileValue(page.getByTestId(`kirk-kpi-${key}`), label, value)
    }
    await expect(page.getByTestId('kirk-gain-card')).toContainText(
      'Pre-Test / Post-Test belum dimulakan',
    )

    await expect(page.getByText('Prestasi Mengikut Subjek')).toBeVisible()
    await expect(page.getByTestId('kirk-subject-row')).toHaveCount(d.subjects.length)
    const subject = d.subjects[0]!
    expect(subject, 'seed: the platform has answers in at least one subject').toBeDefined()
    await expect(page.getByTestId('kirk-subject-name').first()).toHaveText(subject.name)
    await expect(page.getByTestId('kirk-subject-count').first()).toContainText(
      `${subject.answers} soalan`,
    )
    await expect(page.getByTestId('kirk-subject-status').first()).toHaveText(subject.status)
    await expect(page.getByRole('heading', { name: 'Pembelajaran Mengikut Sekolah' })).toBeVisible()
    await expect(rowsOf(page.getByTestId('kirk-schools'))).toHaveCount(d.schools.length)
    await expect(page.getByTestId('kirk-schools')).toContainText(d.schools[0]!.name)
    await expectNoHScroll(page)
  })

  test('AC-M12-14 AC-M12-15 AC-M12-16 AC-M12-17 AC-M12-18 S4 Tingkah Laku: KPIs, bands, schools and heat map equal GET /api/kirkpatrick/behavior @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const d = await openWith<Behavior>(page, `${ADMIN}/behavior`, '/api/kirkpatrick/behavior')
    await expect(page.getByTestId('kirk-behavior')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Tahap 3: Tingkah Laku — Kirkpatrick')
    await expect(
      page.getByRole('heading', { name: 'Tahap 3: Tingkah Laku', level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByText('Konsistensi penggunaan, engagement score, dan corak tingkah laku pelajar'),
    ).toBeVisible()
    await expectTabStrip(page, ADMIN, 'behavior')
    await openFilters(page)
    await expect(page.getByLabel('Sekolah', { exact: true })).toBeVisible()
    await closeFilters(page)

    for (const [key, label, value] of [
      ['t4t5', 'Pelajar T4/T5', count(d.kpi.t4t5)],
      ['active', 'Pernah Aktif', String(d.kpi.active)],
      ['sessions', 'Jumlah Sesi', String(d.kpi.sessions)],
      ['answers', 'Soalan Dijawab', count(d.kpi.answers)],
      ['accuracy', 'Ketepatan', `${mean(d.kpi.accuracy)}%`],
      ['teachers', 'Guru Aktif', `${mean(d.kpi.teacherPct)}%`],
    ] as const) {
      await expectTileValue(page.getByTestId(`beh-kpi-${key}`), label, value)
    }

    await expect(page.getByText('Taburan Tahap Engagement')).toBeVisible()
    await expect(page.getByTestId('band-count')).toHaveText(d.bands.map((b) => String(b.count)))
    for (const label of ['Champion', 'Konsisten', 'Berkembang', 'Minimum', 'Tidak Terlibat']) {
      await expect(
        page.getByTestId('beh-bands').getByText(label, { exact: true }),
        label,
      ).toBeVisible()
    }

    await expect(page.getByText('Engagement Mengikut Sekolah').first()).toBeVisible()
    await expect(rowsOf(page.getByTestId('beh-schools'))).toHaveCount(d.schools.length)
    await expect(page.getByTestId('beh-schools')).toContainText(d.schools[0]!.name)

    await expect(page.getByText('Corak Masa Aktiviti')).toBeVisible()
    await expect(page.getByTestId('beh-heat')).toBeVisible()
    await expect(page.getByTestId('beh-heat-cell')).toHaveCount(7 * 18)
    if (d.alerts.length > 0)
      await expect(page.getByTestId('beh-alerts')).toContainText('Amaran & Pemerhatian')
    await expectNoHScroll(page)
  })

  test('AC-M12-19 AC-M12-22 AC-M12-23 AC-M12-24 S5 Hasil: sections and tables equal GET /api/kirkpatrick/results @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const d = await openWith<Results>(page, `${ADMIN}/results`, '/api/kirkpatrick/results')
    await expect(page.getByTestId('kirk-results')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Tahap 4: Hasil — Kirkpatrick')
    await expect(page.getByRole('heading', { name: 'Tahap 4: Hasil', level: 1 })).toBeVisible()
    await expect(
      page.getByText('Impak terhadap keputusan peperiksaan dan prestasi akademik'),
    ).toBeVisible()
    await expectTabStrip(page, ADMIN, 'results')

    const kpis = page.getByTestId('res-kpis')
    for (const label of [
      'GPS Headcount',
      'Kadar Lulus',
      'Pelajar Gred A',
      'Ketepatan Platform',
      'Pelajar Aktif',
      'Rekod Headcount',
    ]) {
      await expect(kpis.getByText(label, { exact: true }), label).toBeVisible()
    }
    await expect(kpis).toContainText(`${d.kpi.accuracy}%`)
    for (const heading of [
      'GPS Mengikut Subjek',
      'Trend GPS',
      'Prestasi Mengikut Sekolah (Platform + Headcount)',
      'Ramalan Prestasi Pelajar Aktif',
      'Ramalan ALESA (Predictive Grade)',
      'ROI Platform (Anggaran)',
      'Pemerhatian & Insight',
    ]) {
      await expect(page.getByText(heading).first(), heading).toBeVisible()
    }
    await expect(rowsOf(page.getByTestId('res-schools'))).toHaveCount(d.schools.length)
    await expect(rowsOf(page.getByTestId('res-predictions'))).toHaveCount(d.predictions.length)
    await expect(page.getByTestId('res-insights')).toContainText('Disclaimer:')
    await expectNoHScroll(page)
  })

  test('AC-M12-25 AC-M12-26 AC-M12-27 S6 Rantaian Impak: cards, correlation and conclusion; "Muat Turun Laporan" opens the print sheet @api', async ({
    page,
    context,
  }) => {
    await signIn(page, 'adminPusat')
    const d = await openWith<Chain>(page, `${ADMIN}/chain`, '/api/kirkpatrick/chain')
    await expect(page.getByTestId('kirk-chain')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Kirkpatrick Impact Chain')
    await expect(page.getByRole('heading', { name: 'Rantaian Impak', level: 1 })).toBeVisible()
    await expect(
      page.getByText('Bukti keberkesanan Prestasi Plus berdasarkan 4 Tahap Kirkpatrick'),
    ).toBeVisible()
    // No level strip on S6.
    await expect(page.getByTestId('kirk-tabs')).toHaveCount(0)

    const cards = page.getByTestId('chain-cards')
    for (const level of ['Reaksi', 'Pembelajaran', 'Tingkah Laku']) {
      await expect(cards.getByText(level, { exact: true }).first(), level).toBeVisible()
    }
    await expect(cards).toContainText('Hasil / Impak')
    await expect(cards).toContainText(`${d.t2.accuracy}%`)
    await expect(cards).toContainText(d.t2.answers.toLocaleString('en-US'))
    await expect(cards).toContainText(`${d.t3.active}/${d.t3.t4t5}`)

    await expect(page.getByText('Analisis Korelasi: Penggunaan → Pencapaian')).toBeVisible()
    for (const band of d.correlation.bands) {
      await expect(page.getByTestId('chain-correlation'), band.label).toContainText(band.label)
      await expect(page.getByTestId('chain-correlation')).toContainText(`${band.acc}%`)
    }
    await expect(page.getByTestId('chain-correlation')).toContainText(`r = ${d.correlation.r}`)
    await expect(page.getByText('Kesimpulan ALESA:')).toBeVisible()
    await expect(page.getByTestId('chain-conclusion')).toContainText('Kesimpulan Model Kirkpatrick')
    await expectNoHScroll(page)

    // "Muat Turun Laporan" opens the print sheet in a new tab; "Kembali" goes back to the overview.
    await expect(page.getByTestId('chain-export')).toHaveAttribute('target', '_blank')
    const popup = context.waitForEvent('page')
    await page.getByTestId('chain-export').click()
    const sheet = await popup
    await sheet.waitForLoadState('domcontentloaded')
    await expect(sheet).toHaveURL(new RegExp(`${ADMIN}/export-pdf$`))
    await expect(sheet.getByTestId('kirk-pdf')).toBeVisible(SLOW)
    await expect(
      sheet.getByRole('heading', { name: 'Model Kirkpatrick — Rantaian Impak' }),
    ).toBeVisible()
    for (const band of d.correlation.bands) {
      await expect(sheet.getByTestId('chain-correlation'), band.label).toContainText(band.label)
    }
    await expect(sheet.getByTestId('kirk-error')).toHaveCount(0)
    await sheet.close()

    await page.getByTestId('chain-back').click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick$/)
  })

  test('AC-M12-28 AC-M12-29 S7 Intervensi: KPIs and list equal the API; the form opens and blocks an empty submit without a request @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    // Any write (not a GET/HEAD) to the Kirkpatrick API would break the read-only rule of this suite.
    const writes: string[] = []
    page.on('request', (r) => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && r.url().includes('/api/kirkpatrick/'))
        writes.push(`${r.method()} ${r.url()}`)
    })
    const d = await openWith<Interventions>(
      page,
      `${ADMIN}/interventions`,
      '/api/kirkpatrick/interventions',
    )
    await expect(page.getByTestId('kirk-interventions')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Intervensi — Kirkpatrick')
    await expect(page.getByRole('heading', { name: 'Intervensi Pelajar', level: 1 })).toBeVisible()
    await expect(
      page.getByText('Rekod tindakan intervensi berdasarkan amaran Kirkpatrick'),
    ).toBeVisible()
    await expectTabStrip(page, ADMIN, 'interventions')

    for (const [key, label, value] of [
      ['total', 'Jumlah Intervensi', d.kpi.total],
      ['pending', 'Menunggu Semakan', d.kpi.pending],
      ['up', 'Meningkat', d.kpi.up],
      ['down', 'Menurun', d.kpi.down],
    ] as const) {
      await expectTileValue(page.getByTestId(`int-kpi-${key}`), label, String(value))
    }
    await expect(page.getByText('Senarai Intervensi')).toBeVisible()
    if (d.rows.length === 0) {
      await expect(page.getByTestId('int-empty')).toHaveText('Tiada intervensi direkodkan lagi.')
    } else {
      await expect(page.getByTestId('int-row-student')).toHaveCount(d.rows.length)
    }

    // The panel "Rekod Intervensi Baru" is closed, opens with its fields and closes again.
    await expect(page.getByTestId('int-form')).toBeHidden()
    await page.getByTestId('int-form-toggle').click()
    const form = page.getByTestId('int-form')
    await expect(form).toBeVisible()
    for (const label of [
      'Pelajar (ID)',
      'Jenis Amaran',
      'Tarikh Tindakan',
      'Penerangan Amaran',
      'Tindakan Diambil',
      'Ketepatan Sebelum (%)',
      'Mood Sebelum',
      'Ketepatan Selepas (%)',
      'Mood Selepas',
    ]) {
      await expect(form.getByText(label, { exact: false }).first(), label).toBeVisible()
    }
    await expect(page.getByTestId('int-student')).toHaveAttribute('placeholder', 'ID pelajar')
    await expectNoHScroll(page)

    // Empty "Pelajar (ID)": the browser blocks the submit, nothing is sent.
    await page.getByTestId('int-submit').click()
    await expect(page.getByTestId('int-student')).toHaveJSProperty('validity.valueMissing', true)
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\/interventions$/)
    expect(writes, 'no write to /api/kirkpatrick/ was sent').toEqual([])

    await page.getByTestId('int-form-toggle').click()
    await expect(page.getByTestId('int-form')).toBeHidden()
  })
})

// =====================================================================================================
// S8 pupil detail
// =====================================================================================================

test.describe('M12 S8 Pelajar @api', () => {
  test.setTimeout(90_000)

  test('AC-M12-30 AC-M12-31 admin: pupil page equals GET /api/kirkpatrick/students/:id; Kembali goes to Tahap 3 @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const pupil = await firstPupil(page)
    const d = await openWith<StudentKirkpatrick>(
      page,
      `${ADMIN}/pelajar/${pupil.id}`,
      `/api/kirkpatrick/students/${pupil.id}`,
    )
    await expect(page.getByTestId('kirk-pelajar')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle(`Kirkpatrick — ${d.student.name}`)
    await expect(page.getByTestId('pel-name')).toHaveText(d.student.name)
    await expect(page.getByTestId('pel-school')).toContainText(d.student.schoolName)
    await expect(page.getByTestId('pel-school')).toContainText('Tingkatan')
    await expect(page.getByTestId('pel-back')).toHaveText('Kembali ke Tahap 3')
    await expect(page.getByTestId('pel-alesa')).toContainText(
      'ALESA — Analisis Tingkah Laku Kirkpatrick',
    )
    await expect(page.getByTestId('pel-paragraph')).toContainText(d.student.name)
    await expectTileValue(page.getByTestId('pel-tile-answers'), 'Soalan', count(d.answers))
    await expectTileValue(
      page.getByTestId('pel-tile-accuracy'),
      'Ketepatan',
      `${mean(d.accuracy)}%`,
    )
    await expect(page.getByTestId('pel-headcount')).toContainText('Tahap 2 — Head Count')
    await expect(page.getByTestId('pel-platform')).toContainText('Tahap 2 — Prestasi Platform')
    await expect(page.getByTestId('pel-plat-row')).toHaveCount(d.platform.length)
    await expectNoHScroll(page)

    await page.getByTestId('pel-back').click()
    await expect(page).toHaveURL(/\/admin\/kirkpatrick\/behavior$/)
  })

  test('AC-M12-30.4 AC-M12-03.4 a pupil without answers opens from the M11 school page link; an inaccessible id shows the 403 page; a non-numeric id the 404 page @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const overview = await getData<{ studentRows: { schoolId: string }[] }>(
      page,
      '/api/monitoring/overview',
    )
    const school = await getData<MonitoringSchool>(
      page,
      `/api/monitoring/schools/${overview.studentRows[0]!.schoolId}`,
    )
    const idle = school.students.find((s) => s.answers === 0)
    expect(idle, 'seed: a pupil without answers').toBeDefined()
    // The M11 school page links a pupil without answers to this page (AC-M12-30.4).
    await gotoApi(page, `/guru/monitoring/sekolah/${school.school.id}`)
    const link = page.locator(`a[href$="/kirkpatrick/pelajar/${idle!.id}"]`).first()
    await expect(link).toBeVisible(SLOW)
    const idleApi = page.waitForResponse(
      (r) => r.url().includes(`/api/kirkpatrick/students/${idle!.id}`),
      SLOW,
    )
    await link.click()
    expect((await idleApi).status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`/guru/kirkpatrick/pelajar/${idle!.id}$`))
    await expect(page.getByTestId('pel-name')).toHaveText(idle!.name)
    await expectTileValue(page.getByTestId('pel-tile-answers'), 'Soalan', '0')
    await expectHealthy(page)
    await expectNoHScroll(page)

    // An id that is not an accessible pupil: the API answers 403 and the 403 page renders in place.
    const denied = page.waitForResponse(
      (r) => r.url().includes('/api/kirkpatrick/students/99999999'),
      SLOW,
    )
    await gotoApi(page, `${ADMIN}/pelajar/99999999`)
    expect((await denied).status()).toBe(403)
    await expect(page).toHaveTitle(FORBIDDEN_TITLE)
    await expect(page.getByText('Akses Ditolak')).toBeVisible()
    await expectNoHScroll(page)

    // No route for a non-numeric id, a bare /pelajar, an intervention id or an unknown sub-page.
    for (const path of [
      `${ADMIN}/pelajar/abc`,
      `${ADMIN}/pelajar`,
      `${ADMIN}/interventions/1`,
      `${ADMIN}/interventions/create`,
      `${ADMIN}/survey`,
    ]) {
      await gotoApi(page, path)
      await expectNotFoundPage(page)
    }
  })
})

// =====================================================================================================
// Mounts and guards
// =====================================================================================================

test.describe('M12 mounts and guards @api', () => {
  test.setTimeout(120_000)

  test('AC-M12-04.2 AC-M12-04.3 teacher: the /guru mount shows S1-S8 with every link on the /guru prefix @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    const d = await openWith<Overview>(page, GURU, '/api/kirkpatrick/overview')
    await expect(page.getByTestId('kirk-levels')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Kirkpatrick Evaluation Dashboard')
    await expect(page.getByTestId('kirk-level-t3').getByTestId('kirk-level-value')).toHaveText(
      `${d.t3.active}/${d.t3.t4t5}`,
    )
    // The teacher is forced to the own school: filter-options lists only that school.
    const options = await getData<FilterOptions>(page, '/api/kirkpatrick/filter-options')
    await openFilters(page)
    await expect(page.getByTestId('kirk-filter-school').locator('option')).toHaveText([
      'Semua Sekolah',
      ...options.schools.map((s) => s.name),
    ])
    await closeFilters(page)
    await expect(page.getByTestId('kirk-level-t3')).toHaveAttribute('href', `${GURU}/behavior`)
    await expectNoHScroll(page)

    const screens: [string, string, string][] = [
      ['reaction', 'kirk-reaction-page', 'reaction'],
      ['learning', 'kirk-learning-page', 'learning'],
      ['behavior', 'kirk-behavior', 'behavior'],
      ['results', 'kirk-results', 'results'],
      ['interventions', 'kirk-interventions', 'interventions'],
    ]
    for (const [path, testid, tab] of screens) {
      await gotoApi(page, `${GURU}/${path}`)
      await expect(page.getByTestId(testid), path).toBeVisible(SLOW)
      await expectHealthy(page)
      await expectTabStrip(page, GURU, tab)
      await expectNoHScroll(page)
    }
    await gotoApi(page, `${GURU}/chain`)
    await expect(page.getByTestId('kirk-chain')).toBeVisible(SLOW)
    await expect(page.getByTestId('chain-back')).toHaveAttribute('href', GURU)
    await expectNoHScroll(page)

    // S8 of a pupil of the teacher's own school, with the back link on the /guru prefix.
    const pupil = await firstPupil(page)
    await gotoApi(page, `${GURU}/pelajar/${pupil.id}`)
    await expect(page.getByTestId('kirk-pelajar')).toBeVisible(SLOW)
    await expect(page.getByTestId('pel-name')).toHaveText(pupil.name)
    await expect(page.getByTestId('pel-back')).toHaveAttribute('href', `${GURU}/behavior`)
    await expectNoHScroll(page)
  })

  test('AC-M12-35.1 AC-M12-35.2 school admin alias: S1 only, own school, no detail links; other screens are not routed; the API is scoped to the own school @api', async ({
    page,
  }) => {
    await signIn(page, 'adminSekolah')
    const d = await openWith<Overview>(page, ALIAS, '/api/kirkpatrick/overview')
    await expect(page.getByTestId('kirk-levels')).toBeVisible(SLOW)
    await expectHealthy(page)
    await expect(page).toHaveTitle('Kirkpatrick Evaluation Dashboard')
    await expect(
      page.getByText('Analisis Keberkesanan Platform — Model Penilaian 4 Tahap'),
    ).toBeVisible()
    expect(d.scope.schoolId, 'the API forces the own school').not.toBeNull()
    await expect(page.getByTestId('kirk-level-t3').getByTestId('kirk-level-value')).toHaveText(
      `${d.t3.active}/${d.t3.t4t5}`,
    )
    // The level screens are not open to the school admin: plain boxes, no "Lihat detail".
    await expect(page.getByText('Lihat detail', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('kirk-level-t3')).not.toHaveAttribute('href', /.+/)
    await expectNoHScroll(page)

    // The school and state in the query are ignored (no chips, nothing preselected).
    await gotoApi(page, `${ALIAS}?school_id=99999&state=Johor`)
    await expect(page.getByTestId('kirk-levels')).toBeVisible(SLOW)
    await openFilters(page)
    await expect(page.getByTestId('kirk-filter-school')).toHaveValue('')
    await expect(page.getByTestId('kirk-filter-state')).toHaveValue('')
    await closeFilters(page)
    await expect(page.getByText('Penapis aktif')).toHaveCount(0)

    // S2-S8 have no route on the alias: the 404 page.
    for (const path of ['behavior', 'learning', 'chain', 'interventions']) {
      await gotoApi(page, `${ALIAS}/${path}`)
      await expectNotFoundPage(page)
    }
    // The staff mounts send a school admin to its own landing page.
    for (const path of [ADMIN, GURU, `${GURU}/behavior`]) {
      await gotoApi(page, path)
      await expect(page, path).toHaveURL(new RegExp(`${HOME.adminSekolah}$`), SLOW)
    }

    // API: AC-M12-35.2 says 403 for S2-S7 data, but the API (apps/api kirkpatrick controllers,
    // `@Roles('admin', 'teacher', 'school_admin')`) answers 200 SCOPED to the own school, observed on the
    // R3 stack. The screens are unreachable through the SPA (no route), so this asserts the observed
    // scoping: every list holds the own school only, whatever the query says.
    const own = d.scope.schoolId!
    const forced = await getData<Overview>(
      page,
      '/api/kirkpatrick/overview?schoolId=99999&state=Johor',
    )
    expect(forced.scope.schoolId, 'a foreign school id in the query is ignored').toBe(own)
    const learning = await getData<Learning>(page, '/api/kirkpatrick/learning?schoolId=99999')
    const behavior = await getData<Behavior>(page, '/api/kirkpatrick/behavior?schoolId=99999')
    const results = await getData<Results>(page, '/api/kirkpatrick/results?schoolId=99999')
    for (const [name, schools] of [
      ['learning', learning.schools],
      ['behavior', behavior.schools],
      ['results', results.schools],
    ] as const) {
      expect(
        schools.map((x) => x.schoolId),
        `${name}: the own school only`,
      ).toEqual([own])
    }
    expect((await page.request.get('/api/kirkpatrick/interventions')).status()).toBe(200)
    // A pupil that is not accessible answers 403 (S8).
    expect((await page.request.get('/api/kirkpatrick/students/99999999')).status()).toBe(403)
  })

  test('AC-M12-03.1 without a session every M12 route is sent to /login @api', async ({ page }) => {
    for (const path of [ADMIN, `${ADMIN}/chain`, GURU, `${GURU}/pelajar/1`, ALIAS]) {
      await page.goto(path)
      await expect(page, path).toHaveURL(/\/login(\?|$)/, SLOW)
      await expect(page.getByTestId('login-form')).toBeVisible()
    }
    await expectNoHScroll(page)
  })

  test('AC-M12-03 a pupil is sent to the pupil dashboard on every Kirkpatrick route; the API answers 403 @api', async ({
    page,
  }) => {
    await signIn(page, 'student')
    for (const path of [ADMIN, `${ADMIN}/behavior`, GURU, `${GURU}/interventions`, ALIAS]) {
      await gotoApi(page, path)
      await expect(page, path).toHaveURL(new RegExp(`${HOME.student}$`), SLOW)
      await expect(page.getByTestId('kirk-levels')).toHaveCount(0)
    }
    for (const api of [
      '/api/kirkpatrick/overview',
      '/api/kirkpatrick/learning',
      '/api/kirkpatrick/interventions',
      '/api/kirkpatrick/students/1',
    ]) {
      expect((await page.request.get(api)).status(), `pupil GET ${api}`).toBe(403)
    }
    await expectNoHScroll(page)
  })

  test('AC-M12-03 a teacher is sent to the teacher landing page from the admin-only mount @api', async ({
    page,
  }) => {
    await signIn(page, 'guru')
    for (const path of [ADMIN, `${ADMIN}/results`, `${ADMIN}/pelajar/1`]) {
      await gotoApi(page, path)
      await expect(page, path).toHaveURL(new RegExp(`${HOME.guru}$`), SLOW)
      await expect(page.getByTestId('kirk-levels')).toHaveCount(0)
    }
  })
})

// =====================================================================================================
// Responsive sweep
// =====================================================================================================

test.describe('M12 responsive @api', () => {
  test.setTimeout(150_000)

  test('AC-M12-05.5 AC-M12-06.3 AC-M12-28.3 admin S1-S8 have no horizontal page scroll (S7 form open) @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const pupil = await firstPupil(page)
    const screens: [string, string][] = [
      [ADMIN, 'kirk-levels'],
      [`${ADMIN}/reaction`, 'kirk-reaction-cards'],
      [`${ADMIN}/learning`, 'kirk-learning-kpis'],
      [`${ADMIN}/behavior`, 'beh-kpis'],
      [`${ADMIN}/results`, 'res-kpis'],
      [`${ADMIN}/chain`, 'chain-cards'],
      [`${ADMIN}/interventions`, 'int-kpis'],
      [`${ADMIN}/pelajar/${pupil.id}`, 'pel-alesa'],
    ]
    for (const [path, ready] of screens) {
      await gotoApi(page, path)
      await expect(page.getByTestId(ready), path).toBeVisible(SLOW)
      await expectHealthy(page)
      await expectNoHScroll(page)
    }
    // S7 with the new-record form open, S6 print sheet.
    await gotoApi(page, `${ADMIN}/interventions`)
    await page.getByTestId('int-form-toggle').click()
    await expect(page.getByTestId('int-form')).toBeVisible()
    await expectNoHScroll(page)
    await gotoApi(page, `${ADMIN}/export-pdf`)
    await expect(page.getByTestId('kirk-pdf')).toBeVisible(SLOW)
    await expectNoHScroll(page)
  })

  test('AC-M12-05.5 teacher S1 and S4 and the school admin alias S1 have no horizontal page scroll @api', async ({
    page,
    browser,
  }, info) => {
    await signIn(page, 'guru')
    for (const [path, ready] of [
      [GURU, 'kirk-levels'],
      [`${GURU}/behavior`, 'beh-kpis'],
      [`${GURU}/results`, 'res-kpis'],
    ] as const) {
      await gotoApi(page, path)
      await expect(page.getByTestId(ready), path).toBeVisible(SLOW)
      await expectNoHScroll(page)
    }
    const peer = await newPeerContext(browser, info)
    try {
      const other = await peer.newPage()
      await signIn(other, 'adminSekolah')
      await gotoApi(other, ALIAS)
      await expect(other.getByTestId('kirk-levels')).toBeVisible(SLOW)
      await expectNoHScroll(other)
    } finally {
      await peer.close()
    }
  })
})
