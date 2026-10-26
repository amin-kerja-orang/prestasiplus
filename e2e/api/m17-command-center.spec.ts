/**
 * @api M17 Command Center and the admin dashboards against the REAL API (EX-4), at 375 / 768 / 1280.
 *
 * Complements `command-center-pending.spec.ts` (board numbers, daily board, the S4 to S7 drill chain, the Guru
 * board, pending teachers, foreign student and class 404). This file adds:
 *  - CC-01  every tile and panel of the Admin Pusat board shows what `GET /api/admin/command-center/live-data`
 *           returns: the four tiles, Top Sekolah in API order, the live feed, the panel titles, LIVE badge and clock
 *           (UAT-ADM-03, FR-M17-23)
 *  - CC-02  "Sekolah Berdaftar" counts schools with an active subscription: a subscription made in M02 raises the
 *           tile by one on the board and cancelling it takes it back (M02 to M17 flow, FN-M17-3.2.1)
 *  - CC-03  the daily board tabs (Hari Ini, Minggu Ini, Bulan Ini) each ask the API for their period, the six pulse
 *           cards and the panels stay, "Command Center" leads back to the board (UAT-ADM-03)
 *  - CC-04  when the live data call fails (500) the tiles keep "--" and no English server text shows, and the board
 *           recovers by itself when the API answers again; a 404 shows the BM "unavailable" message (FR-M17-21, SWE)
 *  - CC-05  an id that does not exist on a drill-down route is the 404 page, not a blank or broken board
 *  - CC-06  the Command Center APIs: 401 anonymous, 403 for Pelajar (and Guru on the admin ones), Admin Sekolah is
 *           scoped to its own school and cannot read another school (404) or the platform school drill (403)
 *  - CC-07  the screens: Admin Sekolah, Guru and Pelajar are sent to their own home from /admin/command-center,
 *           /admin goes to the board for Admin Pusat (J-10), an anonymous visitor is sent to the login
 *  - CC-08  the Admin Sekolah board (`/admin-sekolah/command-center`) and its daily board are school scoped:
 *           the school name, no Top Sekolah panel, "sekolah anda" under the accuracy (FR-M17-106 b)
 *  - CC-09  the Pembetulan tiles keep their width and their numbers are not broken or clipped at each width
 *           (RS3-02, DV-M17-49)
 *  - CC-10  load time of the board on the PoC seed over http: the live data answers in under 3 s and the tiles
 *           show numbers in under 8 s; the measured milliseconds are attached as annotations
 *  - CC-11  Monitoring (`/admin/monitoring`) and Kirkpatrick (`/admin/kirkpatrick`) mounted in the Portal
 *           Pentadbiran load their data (UAT-ADM-04)
 *
 * Writes data only in CC-02: a basic subscription for the seed school SK Demo Tiga, cancelled again before the test
 * ends (a cancelled row stays in the list). Seed accounts and the password come from `./helpers` (`account()`); the
 * password is never written here.
 */

import { expect, test, type Page } from '@playwright/test'

import { loginViaUi } from '../fixtures/api'
import { account, expectNoHScroll, HOME, newPeerContext, type ApiRole } from './helpers'
import {
  cancelOpenSubscriptions,
  cancelOpenSubscriptionsQuietly,
  dataOf,
  openApiSession,
  type ApiSession,
} from './m02-m17-support'

interface LiveData {
  scope: 'platform' | 'school'
  school: { id: string; name: string } | null
  totalSchools: number
  totalStudents: number
  activeStudents: number
  totalAnswered: number
  accuracy: number
  topSchools: { schoolId: string; schoolName: string; totalAnswers: number }[]
  recentFeed: { student: string; subject: string; schoolName?: string }[]
  correction: { total: number; avgImprovement: number; improvedCount: number }
}

const LIVE = '/api/admin/command-center/live-data'
const SUB_SCHOOL = 'SK Demo Tiga'

async function signIn(page: Page, role: ApiRole): Promise<void> {
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
}

function livePath(response: { url(): string; request(): { method(): string } }): boolean {
  return new URL(response.url()).pathname === LIVE && response.request().method() === 'GET'
}

/** The digits of a tile value, so "1,234" and "1234" compare equal. */
const digits = (text: string | null): string => (text ?? '').replace(/\D/g, '')

test.describe('M17 Command Center board (Admin Pusat) @api', () => {
  test.setTimeout(120_000)

  test('CC-01 tiles and panels show what the live data API returns @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    await expect(page).toHaveURL(/\/admin\/command-center$/, { timeout: 20_000 })
    const live = await page.request.get(LIVE)
    expect(live.status(), `GET ${LIVE}`).toBe(200)
    const data = ((await live.json()) as { data: LiveData }).data
    expect(data.scope).toBe('platform')

    await expect(page.getByTestId('cc-s2')).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveTitle(/COMMAND CENTER/)
    await expect(page.getByTestId('cc-s2-heading')).toBeVisible()
    await expect(page.getByTestId('cc-live-badge')).toBeVisible()
    await expect(page.getByTestId('cc-clock')).toHaveText(/\d{1,2}:\d{2}/)

    const tile = (id: string) => page.getByTestId(`cc-kpi-${id}`).getByTestId('cc-kpi-value')
    await expect(page.getByTestId('cc-kpi-schools')).toContainText('Sekolah Berdaftar')
    await expect(page.getByTestId('cc-kpi-students')).toContainText('Pelajar Berdaftar')
    await expect(page.getByTestId('cc-kpi-answered')).toContainText('Soalan Dijawab')
    await expect(page.getByTestId('cc-kpi-accuracy')).toContainText('Ketepatan Purata')
    // The tiles count up over 800 ms: poll until they reach the API value.
    await expect
      .poll(async () => digits(await tile('students').textContent()), { timeout: 15_000 })
      .toBe(String(data.totalStudents))
    await expect
      .poll(async () => digits(await tile('answered').textContent()), { timeout: 15_000 })
      .toBe(String(data.totalAnswered))
    await expect(tile('accuracy')).toContainText(String(Math.trunc(data.accuracy)))
    if (data.totalSchools > 0) {
      await expect
        .poll(async () => digits(await tile('schools').textContent()), { timeout: 15_000 })
        .toBe(String(data.totalSchools))
    }
    await expect(page.getByTestId('cc-kpi-students').getByTestId('cc-kpi-sub')).toContainText(
      'aktif menjawab',
    )

    // The panels and their titles.
    const panels: [string, string][] = [
      ['cc-panel-top-schools', 'Top Sekolah'],
      ['cc-panel-kirkpatrick', 'Kirkpatrick'],
      ['cc-panel-alesa', 'ALESA AI'],
      ['cc-panel-today', 'Aktiviti Hari Ini'],
      ['cc-panel-feed', 'Live Feed'],
      ['cc-panel-mood', 'Mood Pelajar'],
      ['cc-panel-correction', 'Pembetulan'],
      ['cc-panel-engagement', 'Engagement'],
    ]
    for (const [id, title] of panels) {
      await expect(page.getByTestId(id), title).toBeVisible()
      await expect(page.getByTestId(id).getByTestId('board-panel-title')).toHaveText(title)
    }

    // Top Sekolah lists the API's schools in the API's order; the feed shows the API's latest answers.
    const topRows = page.getByTestId('cc-top-school')
    if (data.topSchools.length === 0) {
      await expect(page.getByTestId('cc-panel-top-schools').getByTestId('cc-empty')).toBeVisible()
    } else {
      await expect(topRows.first()).toBeVisible()
      await expect(topRows.first()).toContainText(data.topSchools[0]!.schoolName)
      expect(await topRows.count()).toBeLessThanOrEqual(data.topSchools.length)
    }
    const feed = page.getByTestId('cc-feed-row')
    if (data.recentFeed.length > 0) {
      await expect(feed.first()).toBeVisible()
      await expect(feed.first().getByTestId('cc-feed-name')).toHaveText(data.recentFeed[0]!.student)
    }
    await expect(page.getByTestId('cc-unavailable')).toHaveCount(0)
    await expect(page.getByTestId('cc-footer')).toBeVisible()
    await expectNoHScroll(page)
  })

  test('CC-02 a subscription made in M02 raises "Sekolah Berdaftar" by one and cancelling takes it back @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    try {
      // Start from a known state: the school has no open subscription.
      const schoolId = await cancelOpenSubscriptions(admin, SUB_SCHOOL)
      const baseline = dataOf<LiveData>(await admin.get(LIVE), 'live-data').totalSchools

      await signIn(page, 'adminPusat')
      const tile = page.getByTestId('cc-kpi-schools').getByTestId('cc-kpi-value')
      const shows = async (n: number) => {
        await page.goto('/admin/command-center')
        await expect(page.getByTestId('cc-s2')).toBeVisible({ timeout: 20_000 })
        await expect
          .poll(async () => digits(await tile.textContent()), { timeout: 15_000 })
          .toBe(String(n))
      }
      await shows(baseline)

      const packages = dataOf<{ id: string }[]>(
        await admin.get('/api/admin/school-packages'),
        'school-packages',
      )
      const made = dataOf<{ id: string }>(
        await admin.send('POST', '/api/admin/school-subscriptions', {
          schoolId,
          packageTier: 'basic',
          schoolPackageId: packages[0]!.id,
          studentQuota: 3,
        }),
        'POST school-subscriptions',
      )
      try {
        expect(dataOf<LiveData>(await admin.get(LIVE), 'live-data').totalSchools).toBe(baseline + 1)
        await shows(baseline + 1)
        await expectNoHScroll(page)
      } finally {
        await admin.send('POST', `/api/admin/school-subscriptions/${made.id}/cancel`)
      }
      expect(dataOf<LiveData>(await admin.get(LIVE), 'live-data').totalSchools).toBe(baseline)
      await shows(baseline)
    } finally {
      await cancelOpenSubscriptionsQuietly(admin, SUB_SCHOOL)
      await admin.dispose()
    }
  })

  test('CC-03 the daily board tabs ask the API for their period and the way back works @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    await expect(page.getByTestId('cc-s2')).toBeVisible({ timeout: 20_000 })
    const daily = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/command-center/daily-activity',
      { timeout: 30_000 },
    )
    await page.getByTestId('cc-s2-daily').click()
    expect((await daily).status()).toBe(200)
    await expect(page).toHaveURL(/\/admin\/command-center\/daily-activity$/)
    await expect(page.getByTestId('cc-s3')).toBeVisible({ timeout: 20_000 })

    const pulse = ['schools', 'logins', 'pupils', 'answers', 'sessions', 'engagement']
    for (const id of pulse) await expect(page.getByTestId(`cc-pulse-${id}`), id).toBeVisible()
    await expect(page.getByTestId('cc-tab').filter({ hasText: 'Hari Ini' })).toHaveAttribute(
      'data-active',
      'true',
    )
    await expectNoHScroll(page)

    for (const [label, period] of [
      ['Minggu Ini', 'week'],
      ['Bulan Ini', 'month'],
      ['Hari Ini', 'today'],
    ] as const) {
      const asked = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/command-center/daily-activity' &&
          r.url().includes(`period=${period}`),
        { timeout: 30_000 },
      )
      await page.getByTestId('cc-tab').filter({ hasText: label }).click()
      const res = await asked
      expect(res.status(), `daily-activity period=${period}`).toBe(200)
      expect(((await res.json()) as { data: { period: string } }).data.period).toBe(period)
      await expect(page.getByTestId('cc-tab').filter({ hasText: label })).toHaveAttribute(
        'data-active',
        'true',
      )
      for (const id of pulse) await expect(page.getByTestId(`cc-pulse-${id}`)).toBeVisible()
      await expect(page.getByTestId('cc-panel-schools')).toBeVisible()
      await expectNoHScroll(page)
    }

    await page.getByTestId('cc-s3-back').click()
    await expect(page).toHaveURL(/\/admin\/command-center$/, { timeout: 20_000 })
    await expect(page.getByTestId('cc-s2')).toBeVisible()
  })

  test('CC-04 a failing live data call keeps the placeholders, shows no English server text, and recovers @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    await expect(page.getByTestId('cc-s2')).toBeVisible({ timeout: 20_000 })

    let mode: 'fail' | 'missing' | 'ok' = 'fail'
    await page.route(`**${LIVE}`, async (route) => {
      if (mode === 'ok') return route.continue()
      await route.fulfill({
        status: mode === 'fail' ? 500 : 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: mode === 'fail' ? 'SERVER_ERROR' : 'NOT_FOUND', message: 'Server Error' },
        }),
      })
    })

    // 500: the tiles keep "--" (FR-M17-21), the board is not replaced by an error page, no English text.
    await page.goto('/admin/command-center')
    await expect(page.getByTestId('cc-s2')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('cc-kpi-students').getByTestId('cc-kpi-value')).toHaveText('--', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('cc-unavailable'), '500 is not "not built yet"').toHaveCount(0)
    const failed = ((await page.getByTestId('cc-body').textContent()) ?? '').toLowerCase()
    expect(failed, 'no raw English server text').not.toContain('server error')
    await expectNoHScroll(page)

    // The board polls every 10 s: it recovers by itself once the API answers again.
    mode = 'ok'
    await expect(page.getByTestId('cc-kpi-students').getByTestId('cc-kpi-value')).toHaveText(/\d/, {
      timeout: 30_000,
    })
    await expect(page.getByTestId('cc-kpi-students').getByTestId('cc-kpi-value')).not.toHaveText(
      '--',
    )

    // 404 (endpoint not built): the BM "unavailable" message, polling stops.
    mode = 'missing'
    await page.goto('/admin/command-center')
    const unavailable = page.getByTestId('cc-unavailable')
    await expect(unavailable).toBeVisible({ timeout: 20_000 })
    await expect(unavailable).toContainText('belum tersedia')
    expect(((await unavailable.textContent()) ?? '').toLowerCase()).not.toContain('server error')
    await expectNoHScroll(page)
  })

  test('CC-05 an unknown id on a drill-down route is the 404 page @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    for (const [path, api] of [
      ['/admin/command-center/school/99999999', '/api/command-center/school/99999999'],
      ['/admin/command-center/classroom/99999999', '/api/command-center/classroom/99999999'],
      ['/admin/command-center/student/99999999', '/api/command-center/student/99999999'],
      [
        '/admin/command-center/school/99999999/teacher/99999999',
        '/api/command-center/school/99999999/teacher/99999999',
      ],
    ] as const) {
      const answered = page.waitForResponse((r) => new URL(r.url()).pathname === api, {
        timeout: 30_000,
      })
      await page.goto(path)
      expect((await answered).status(), `GET ${api}`).toBe(404)
      await expect(page, path).toHaveTitle(/404/, { timeout: 15_000 })
      await expect(page.getByTestId('cc-kpis')).toHaveCount(0)
      await expectNoHScroll(page)
    }
  })

  test('CC-09 the Pembetulan tiles keep their width and show whole numbers at this width @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    await expect(page.getByTestId('cc-panel-correction')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('cc-panel-correction').getByText('Memuatkan')).toHaveCount(0, {
      timeout: 15_000,
    })
    const live = dataOf<LiveData>(
      { status: 200, body: await (await page.request.get(LIVE)).json() },
      'live-data',
    )
    const tiles = page.locator('[data-testid^="cc-correction-"]')
    await expect(tiles).toHaveCount(3)
    for (let i = 0; i < 3; i += 1) {
      const t = tiles.nth(i)
      await t.scrollIntoViewIfNeeded()
      const box = await t.boundingBox()
      // The DS auto-fit grid never makes a tile narrower than 9rem (144 px).
      expect(box!.width, `tile ${i} width`).toBeGreaterThanOrEqual(140)
      const clipped = await t.evaluate((el) =>
        [...el.querySelectorAll('*')].some((c) => c.scrollWidth > c.clientWidth + 1),
      )
      expect(clipped, `tile ${i} content overflows its box`).toBe(false)
    }
    await expect(page.getByTestId('cc-correction-total')).toContainText(
      String(live.correction.total),
    )
    await expectNoHScroll(page)
  })

  test('CC-10 load time of the board on the seed is measured and within bounds @api', async ({
    page,
  }, info) => {
    await signIn(page, 'adminPusat')
    const startedAt = Date.now()
    const answered = page.waitForResponse(livePath, { timeout: 30_000 })
    const requestedAt = Date.now()
    await page.goto('/admin/command-center')
    const res = await answered
    const apiMs = Date.now() - requestedAt
    expect(res.status()).toBe(200)
    await expect(page.getByTestId('cc-kpi-students').getByTestId('cc-kpi-value')).toHaveText(/\d/, {
      timeout: 15_000,
    })
    const tilesMs = Date.now() - startedAt
    info.annotations.push(
      { type: 'cc-live-data-ms', description: String(apiMs) },
      { type: 'cc-tiles-ms', description: String(tilesMs) },
    )
    // A shared CI runner is slower than a local stack: the bounds are three times wider under CI.
    const factor = process.env.CI ? 3 : 1
    expect(apiMs, `live data answered within ${3 * factor} s of the navigation`).toBeLessThan(
      3000 * factor,
    )
    expect(tilesMs, `tiles show numbers within ${8 * factor} s of the navigation`).toBeLessThan(
      8000 * factor,
    )
  })

  test('CC-11 Monitoring and Kirkpatrick load their data in the admin portal @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    for (const [path, api, heading] of [
      ['/admin/monitoring', '/api/monitoring/overview', /Monitoring/],
      ['/admin/kirkpatrick', '/api/kirkpatrick/overview', /Kirkpatrick/],
    ] as const) {
      const answered = page.waitForResponse((r) => new URL(r.url()).pathname === api, {
        timeout: 30_000,
      })
      await page.goto(path)
      expect((await answered).status(), `GET ${api}`).toBe(200)
      await expect(page.locator('h1').first()).toHaveText(heading, { timeout: 20_000 })
      await expect(page, path).not.toHaveTitle(/404|403/)
      await expectNoHScroll(page)
    }
  })
})

test.describe('M17 Command Center scope and role guards @api', () => {
  test.setTimeout(120_000)

  test('CC-06 the APIs are scoped by role: 401, 403, own school only @api', async ({
    browser,
  }, info) => {
    const anon = await newPeerContext(browser, info)
    try {
      for (const path of [
        LIVE,
        '/api/command-center/daily-activity',
        '/api/command-center/school/1',
        '/api/guru/command-center/live-data',
      ]) {
        expect((await anon.request.get(path)).status(), `anonymous GET ${path}`).toBe(401)
      }
    } finally {
      await anon.close()
    }

    const sessions: Record<string, ApiSession> = {}
    try {
      for (const role of ['adminPusat', 'adminSekolah', 'guru', 'student'] as const) {
        sessions[role] = await openApiSession(browser, info, role)
      }
      const central = sessions.adminPusat!
      const school = sessions.adminSekolah!
      const guru = sessions.guru!
      const pupil = sessions.student!

      // Admin Pusat: platform; Admin Sekolah: its own school only.
      const platform = dataOf<LiveData>(await central.get(LIVE), 'admin live-data')
      expect(platform.scope).toBe('platform')
      expect(platform.school).toBeNull()
      const own = dataOf<LiveData>(await school.get(LIVE), 'school admin live-data')
      expect(own.scope).toBe('school')
      expect(own.school?.id, 'the school admin has a school').toBeTruthy()
      expect(own.totalStudents).toBeLessThanOrEqual(platform.totalStudents)
      expect(own.topSchools, 'a school board has no school ranking').toEqual([])

      // Guru and Pelajar cannot read the admin board; Pelajar nothing at all.
      expect((await guru.get(LIVE)).status, 'Guru GET admin live-data').toBe(403)
      expect((await guru.get('/api/command-center/daily-activity')).status).toBe(403)
      for (const path of [
        LIVE,
        '/api/command-center/daily-activity',
        '/api/command-center/school/1',
        '/api/command-center/classroom/1',
        '/api/command-center/student/1',
        '/api/guru/command-center/live-data',
      ]) {
        expect((await pupil.get(path)).status, `Pelajar GET ${path}`).toBe(403)
      }

      // The platform school drill is Admin Pusat only; another school is a 404 for a school admin and a Guru.
      const options = dataOf<{ id: string }[]>(
        await central.get('/api/admin/schools/options'),
        'school options',
      )
      const foreign = options.find((o) => o.id !== own.school!.id)
      expect(foreign, 'the seed has another school').toBeTruthy()
      expect((await central.get(`/api/command-center/school/${foreign!.id}`)).status).toBe(200)
      expect((await school.get(`/api/command-center/school/${foreign!.id}`)).status).toBe(404)
      expect((await guru.get(`/api/command-center/school/${foreign!.id}`)).status).toBe(404)
      expect(
        (await school.get(`/api/command-center/daily-activity/school/${own.school!.id}`)).status,
      ).toBe(403)
      expect(
        (await guru.get(`/api/command-center/daily-activity/school/${own.school!.id}`)).status,
      ).toBe(403)
      expect(
        (await central.get(`/api/command-center/daily-activity/school/${foreign!.id}`)).status,
      ).toBe(200)
    } finally {
      for (const s of Object.values(sessions)) await s.dispose()
    }
  })

  for (const [role, label, home] of [
    ['adminSekolah', 'Admin Sekolah', HOME.adminSekolah],
    ['guru', 'Guru', HOME.guru],
    ['student', 'Pelajar', HOME.student],
  ] as const) {
    test(`CC-07 ${label} on /admin/command-center is sent to its own home @api`, async ({
      page,
    }) => {
      await signIn(page, role)
      for (const path of [
        '/admin/command-center',
        '/admin/command-center/daily-activity',
        '/admin/command-center/school/1',
        '/admin',
      ]) {
        await page.goto(path)
        await expect(page).toHaveURL(new RegExp(`${home}$`), { timeout: 20_000 })
        await expect(page.getByTestId('cc-s2')).toHaveCount(0)
        await expectNoHScroll(page)
      }
    })
  }

  test('CC-07 /admin goes to the board for Admin Pusat and an anonymous visitor to the login @api', async ({
    page,
    browser,
  }, info) => {
    await signIn(page, 'adminPusat')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/command-center$/, { timeout: 20_000 })
    await expect(page.getByTestId('cc-s2')).toBeVisible({ timeout: 20_000 })

    const guest = await newPeerContext(browser, info)
    try {
      const view = await guest.newPage()
      await view.goto('/admin/command-center')
      await expect(view).toHaveURL(/\/login/, { timeout: 20_000 })
      await expect(view.getByTestId('login-form')).toBeVisible({ timeout: 20_000 })
      await expectNoHScroll(view)
    } finally {
      await guest.close()
    }
  })
})

test.describe('M17 Command Center board (Admin Sekolah) @api', () => {
  test.setTimeout(120_000)

  test('CC-08 the school board and its daily board are scoped to the own school @api', async ({
    page,
  }) => {
    await signIn(page, 'adminSekolah')
    const live = page.waitForResponse(livePath, { timeout: 30_000 })
    await page.goto('/admin-sekolah/command-center')
    expect((await live).status(), `GET ${LIVE}`).toBe(200)
    const data = ((await (await live).json()) as { data: LiveData }).data
    expect(data.scope).toBe('school')

    await expect(page.getByTestId('cc-s2-alias')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('cc-kpis')).toBeVisible()
    await expect(page.getByTestId('cc-kpi-accuracy').getByTestId('cc-kpi-sub')).toHaveText(
      'sekolah anda',
    )
    await expect(
      page.getByTestId('cc-panel-top-schools'),
      'no school ranking on a school board',
    ).toHaveCount(0)
    await expect(page.getByTestId('cc-panel-correction')).toBeVisible()
    await expect(page.getByTestId('cc-panel-engagement')).toBeVisible()
    await expect
      .poll(
        async () =>
          digits(
            await page.getByTestId('cc-kpi-students').getByTestId('cc-kpi-value').textContent(),
          ),
        { timeout: 15_000 },
      )
      .toBe(String(data.totalStudents))
    await expect(page.getByTestId('cc-unavailable')).toHaveCount(0)
    await expectNoHScroll(page)

    // Every pupil link of the feed and the top pupils stays inside this school's alias route.
    const hrefs = await page
      .locator('[data-testid=cc-s2-alias] a[href*="/command-center/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      expect(href, 'a school board links to school routes only').toMatch(/^\/admin-sekolah\//)
    }

    const daily = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/command-center/daily-activity',
      { timeout: 30_000 },
    )
    await page.getByTestId('cc-s2-daily').click()
    const dailyRes = await daily
    expect(dailyRes.status()).toBe(200)
    expect(((await dailyRes.json()) as { data: { scope: string } }).data.scope).toBe('school')
    await expect(page).toHaveURL(/\/admin-sekolah\/command-center\/daily-activity$/)
    await expect(page.getByTestId('cc-s3-alias')).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByTestId('cc-panel-schools'),
      'no school list on a school board',
    ).toHaveCount(0)
    for (const id of ['logins', 'pupils', 'answers', 'sessions', 'engagement']) {
      await expect(page.getByTestId(`cc-pulse-${id}`)).toBeVisible()
    }
    await expectNoHScroll(page)
  })
})
