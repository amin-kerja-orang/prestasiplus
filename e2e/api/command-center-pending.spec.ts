/**
 * @api Command Center (BE-22) and the pending-teacher screen (BE-21 AC13) against the REAL API (AM-12, 78-19 / 78-01).
 *
 * - Admin Pusat `/admin/command-center` shows live numbers (not "--") and the daily board plus the drill-down pages
 *   (school, teacher, classroom, student, "Semua Sesi Latihan") load; their ids are found through the API (strings).
 * - Guru `/guru/command-center` loads its tiles and panels (class level text mapped from the curriculum codes).
 * - Admin Sekolah opens `/admin-sekolah/guru/menunggu`, sees the list or the empty state, registers a teacher through the
 *   public sign-up (BE-06: created pending for the school), then verifies it and sees it leave the list.
 *
 * Sources: src/modules/m17-admin-dashboard (BoardKpis, CommandCenter*Page), src/modules/m10-teacher-class/pages/CommandCenterPage.vue,
 * src/modules/m27-school-admin/pages/GuruMenungguPage.vue. Seed: BE-07 poc profile, the shared seed password (API_PASSWORD, e2e/fixtures/api.ts).
 * Every project (375 / 768 / 1280) runs the same flows; the spec registers its own uniquely named teacher.
 */

import type { Page } from '@playwright/test'

import { API_PASSWORD, expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, newPeerContext } from './helpers'

const NOT_AVAILABLE = 'Belum tersedia dalam prototaip'

async function getData<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(path)
  expect(res.status(), `GET ${path}`).toBe(200)
  return ((await res.json()) as { data: T }).data
}

/** The first page (any role) must not be the "not in the prototype" page nor a 403/404 page. */
async function expectInScope(page: Page): Promise<void> {
  await expect(page.getByText(NOT_AVAILABLE)).toHaveCount(0)
}

async function expectNoLoadError(page: Page): Promise<void> {
  await expect(page.getByTestId('cc-loading')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByTestId('cc-unavailable')).toHaveCount(0)
  await expect(page.getByTestId('cc-error')).toHaveCount(0)
}

/**
 * A class and a pupil of a school other than `ownSchoolId` (answers not needed), as Admin Pusat can read any id.
 * There is no school list in the contract, so school ids are probed upward from 1 until the first 404 (bounded).
 */
async function findForeign(
  page: Page,
  ownSchoolId: string,
): Promise<{ classId: string; studentId: string } | null> {
  for (let id = 1; id <= 12; id += 1) {
    if (String(id) === ownSchoolId) continue
    const res = await page.request.get(`/api/command-center/school/${id}`)
    if (res.status() === 404) break
    expect(res.status(), `GET school ${id}`).toBe(200)
    const school = ((await res.json()) as { data: { teachers: { userId: string; classes: number }[] } }).data
    for (const t of school.teachers.filter((x) => x.classes > 0)) {
      const teacher = await getData<{ classes: { id: string }[] }>(
        page,
        `/api/command-center/school/${id}/teacher/${t.userId}`,
      )
      for (const c of teacher.classes) {
        const cls = await getData<{ students: { userId: string }[] }>(
          page,
          `/api/command-center/classroom/${c.id}`,
        )
        if (cls.students.length > 0) return { classId: c.id, studentId: cls.students[0]!.userId }
      }
    }
  }
  return null
}

interface Chain {
  schoolId: string
  teacherId: string
  classId: string
  studentId: string
}

/** At most this many drill-down reads while looking for a pupil (the Command Center read limit is 120 per minute). */
const MAX_CHAIN_READS = 12

/**
 * school -> teacher (with a class) -> classroom -> a pupil, by the admin drill-down API. Stops at the first class
 * that has a pupil with answers; else falls back to the first pupil seen. Bounded by `MAX_CHAIN_READS`.
 */
async function findChain(page: Page): Promise<Chain> {
  const live = await getData<{ topSchools: { schoolId: string }[] }>(
    page,
    '/api/admin/command-center/live-data',
  )
  expect(live.topSchools.length, 'the seed has a school with answers').toBeGreaterThan(0)
  const schoolId = live.topSchools[0]!.schoolId
  const school = await getData<{ teachers: { userId: string; classes: number }[] }>(
    page,
    `/api/command-center/school/${schoolId}`,
  )
  let fallback: Chain | null = null
  let reads = 0
  search: for (const t of school.teachers.filter((x) => x.classes > 0)) {
    if (reads >= MAX_CHAIN_READS) break
    reads += 1
    const teacher = await getData<{ classes: { id: string }[] }>(
      page,
      `/api/command-center/school/${schoolId}/teacher/${t.userId}`,
    )
    for (const c of teacher.classes) {
      if (reads >= MAX_CHAIN_READS) break search
      reads += 1
      const cls = await getData<{ students: { userId: string; answers: number }[] }>(
        page,
        `/api/command-center/classroom/${c.id}`,
      )
      for (const s of cls.students) {
        const chain = { schoolId, teacherId: t.userId, classId: c.id, studentId: s.userId }
        if (s.answers > 0) return chain
        fallback ??= chain
      }
    }
  }
  expect(fallback, 'the seed has a class with a pupil').not.toBeNull()
  return fallback!
}

test.describe('command center and pending teachers @api', () => {
  test.setTimeout(120_000)

  test('Admin Pusat: the board shows live numbers and the drill-down pages load @api', async ({
    page,
  }) => {
    const { user, pass } = account('adminPusat')
    const live = page.waitForResponse(
      (r) =>
        r.url().includes('/api/admin/command-center/live-data') && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await loginViaUi(page, user, pass)
    expect((await live).status(), 'GET /api/admin/command-center/live-data').toBe(200)

    await expect(page).toHaveURL(/\/admin\/command-center$/)
    await expectInScope(page)
    await expect(page.getByTestId('cc-s2')).toBeVisible({ timeout: 20_000 })
    const kpis = page.getByTestId('cc-kpis')
    await expect(kpis).toBeVisible()
    for (const id of ['students', 'answered', 'accuracy']) {
      const value = page.getByTestId(`cc-kpi-${id}`).getByTestId('cc-kpi-value')
      await expect(value, `kpi ${id} is a live number`).toHaveText(/\d/, { timeout: 15_000 })
      await expect(value).not.toHaveText('--')
    }
    await expect(page.getByTestId('cc-unavailable')).toHaveCount(0)
    await expect(page.getByTestId('cc-panels')).toBeVisible()
    await expectNoHScroll(page)

    // Daily activity board (S3).
    const daily = page.waitForResponse(
      (r) =>
        r.url().includes('/api/command-center/daily-activity') && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await page.goto('/admin/command-center/daily-activity')
    expect((await daily).status(), 'GET /api/command-center/daily-activity').toBe(200)
    await expect(page.getByTestId('cc-s3')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('cc-tabs')).toBeVisible()
    await expectNoHScroll(page)

    // Drill-down pages S4 to S7 by the ids the API returns.
    const ids = await findChain(page)
    const pages: { path: string; ready: string; api: RegExp }[] = [
      {
        path: `/admin/command-center/school/${ids.schoolId}`,
        ready: 'cc-teachers-table',
        api: /\/api\/command-center\/school\/[^/]+$/,
      },
      {
        path: `/admin/command-center/school/${ids.schoolId}/teacher/${ids.teacherId}`,
        ready: 'cc-classes-table',
        api: /\/api\/command-center\/school\/[^/]+\/teacher\/[^/]+$/,
      },
      {
        path: `/admin/command-center/classroom/${ids.classId}`,
        ready: 'cc-students-table',
        api: /\/api\/command-center\/classroom\/[^/]+$/,
      },
      {
        path: `/admin/command-center/student/${ids.studentId}`,
        ready: 'cc-student-cards',
        api: /\/api\/command-center\/student\/[^/]+$/,
      },
    ]
    for (const p of pages) {
      const res = page.waitForResponse(
        (r) => p.api.test(new URL(r.url()).pathname) && r.request().method() === 'GET',
        { timeout: 30_000 },
      )
      await page.goto(p.path)
      expect((await res).status(), `GET for ${p.path}`).toBe(200)
      await expectInScope(page)
      await expect(page.getByTestId(p.ready), p.path).toBeVisible({ timeout: 20_000 })
      await expectNoLoadError(page)
      await expectNoHScroll(page)
    }

    // The pupil page is the last one: "Semua Sesi Latihan" (BE-22 caps the range at 366 days).
    const range = page.waitForResponse(
      (r) => r.url().includes('/week?') && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await page.getByTestId('cc-stat-answers').click()
    expect((await range).status(), 'GET /api/command-center/student/:id/week').toBe(200)
    await expect(page.getByTestId('cc-sessions-modal')).toBeVisible()
    await expect(page.getByTestId('cc-modal-error')).toHaveCount(0)
    await expect(page.getByTestId('cc-modal-loading')).toHaveCount(0, { timeout: 15_000 })
    await expect(
      page.getByTestId('cc-modal-stats').or(page.getByTestId('cc-modal-empty')),
    ).toBeVisible()
  })

  test('Guru: the Command Center loads its tiles and panels @api', async ({ page }) => {
    const { user, pass } = account('guru')
    await loginViaUi(page, user, pass)

    const live = page.waitForResponse(
      (r) =>
        r.url().includes('/api/guru/command-center/live-data') && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await page.goto('/guru/command-center')
    expect((await live).status(), 'GET /api/guru/command-center/live-data').toBe(200)

    await expectInScope(page)
    await expect(page.getByTestId('cc-s2')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('cc-kpis')).toBeVisible()
    // "Pelajar Berdaftar" and "Soalan Dijawab" keep "--" only while the raw count is 0; the seeded teacher has pupils.
    for (const id of ['students', 'answered']) {
      await expect(page.getByTestId(`cc-kpi-${id}`), `tile ${id}`).toContainText(/\d/, {
        timeout: 15_000,
      })
      await expect(page.getByTestId(`cc-kpi-${id}`)).not.toContainText('--')
    }
    await expect(page.getByTestId('cc-panels')).toBeVisible()
    const rows = page.getByTestId('cc-class-row')
    await expect(rows.first()).toBeVisible()
    // BE-22 sends DARJAH_n / TINGKATAN_n; the page shows the slug text.
    for (const text of await page.getByTestId('cc-class-level').allTextContents()) {
      expect(text, 'class level text').toMatch(/^(tahun|tingkatan)-\d$/)
    }
    await expectNoHScroll(page)

    // A tile drill-down answers from /guru/command-center/drill.
    const drill = page.waitForResponse(
      (r) => r.url().includes('/api/guru/command-center/drill') && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await page.getByTestId('cc-kpi-students').click()
    expect((await drill).status(), 'GET /api/guru/command-center/drill').toBe(200)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('Pelajar Berdaftar')
    await expectNoHScroll(page)
  })

  test('Admin Sekolah: Guru Menunggu Pengesahan lists, verifies and removes a pending teacher @api', async ({
    page,
    browser,
  }) => {
    const { user, pass } = account('adminSekolah')
    await loginViaUi(page, user, pass)

    const schoolId = (
      await getData<{ school: { id: string } | null }>(page, '/api/admin/command-center/live-data')
    ).school?.id
    expect(schoolId, 'the school admin has a school').toBeTruthy()

    const list = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/admin-sekolah/guru/pending' &&
        r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await page.goto('/admin-sekolah/guru/menunggu')
    expect((await list).status(), 'GET /api/admin-sekolah/guru/pending').toBe(200)
    await expectInScope(page)
    await expect(page.getByTestId('pt-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('pt-error')).toHaveCount(0)
    await expect(page.getByTestId('pt-found')).toBeVisible()
    // The seed has no pending teacher (empty state), unless an earlier project left one.
    await expect
      .poll(
        async () =>
          (await page.getByTestId('pt-empty').count()) +
          (await page.getByTestId('pt-verify').count()),
      )
      .toBeGreaterThan(0)
    await expectNoHScroll(page)

    // Note: a failed verify step below can leave a pending "Guru Menunggu <stamp>" teacher behind; the empty-or-verify
    // poll above tolerates that on the next run.
    // A teacher signs up for this school (public sign-up, a separate cookie-less context).
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const name = `Guru Menunggu ${stamp}`
    const guest = await browser.newContext({ baseURL: test.info().project.use.baseURL as string })
    try {
      const res = await guest.request.post('/api/auth/register', {
        data: {
          name,
          email: `guru.menunggu.${stamp}@demo.test`,
          role: 'teacher',
          schoolId,
          password: API_PASSWORD,
          passwordConfirmation: API_PASSWORD,
        },
      })
      expect(res.status(), `POST /api/auth/register: ${await res.text()}`).toBe(201)
    } finally {
      await guest.close()
    }

    await page.reload()
    await expect(page.getByTestId('pt-page')).toBeVisible({ timeout: 20_000 })
    const row = page.locator(`[data-testid=pt-row]:visible`, { hasText: name })
    await expect(row, 'the new teacher is listed').toHaveCount(1, { timeout: 15_000 })
    await expect(page.getByTestId('pt-empty')).toHaveCount(0)
    await expectNoHScroll(page)

    const userId = await row.first().getAttribute('data-user-id')
    expect(userId).toBeTruthy()
    const verifyButton = page.locator(`[data-testid=pt-verify][data-user-id="${userId}"]:visible`)
    await expect(verifyButton).toHaveCount(1)
    await verifyButton.click()
    await expect(page.getByRole('dialog')).toContainText(name)

    const verified = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/admin-sekolah/guru/${userId}/verify` &&
        r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.locator('[data-ds="confirm-ok"]').click()
    expect((await verified).status(), 'POST /api/admin-sekolah/guru/:id/verify').toBe(200)

    await expect(page.getByText('Guru berjaya disahkan.')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(`[data-testid=pt-row][data-user-id="${userId}"]`)).toHaveCount(0, {
      timeout: 15_000,
    })
    await expectNoHScroll(page)
  })

  test('Admin Sekolah: another school student and classroom answer 404 (never data) @api', async ({
    page,
    browser,
  }, testInfo) => {
    const sk = account('adminSekolah')
    await loginViaUi(page, sk.user, sk.pass)
    const own = (
      await getData<{ school: { id: string } | null }>(page, '/api/admin/command-center/live-data')
    ).school?.id
    expect(own, 'the school admin has a school').toBeTruthy()

    // An id that exists but belongs to another school, found as Admin Pusat in an isolated context.
    const peer = await newPeerContext(browser, testInfo)
    let foreign: { classId: string; studentId: string } | null
    try {
      const adminPage = await peer.newPage()
      const admin = account('adminPusat')
      await loginViaUi(adminPage, admin.user, admin.pass)
      foreign = await findForeign(adminPage, own!)
    } finally {
      await peer.close()
    }
    test.skip(foreign === null, 'the seed has no other school with a class and a pupil')

    for (const path of [
      `/api/command-center/student/${foreign!.studentId}`,
      `/api/command-center/classroom/${foreign!.classId}`,
    ]) {
      const res = await page.request.get(path)
      // Contract (admin-paths.ts): out of scope answers 404 so ids cannot be probed; 403 would also deny.
      expect([403, 404], `GET ${path}`).toContain(res.status())
    }
  })
})
