/**
 * @api M02 schools and school subscriptions (Admin Pusat) against the REAL API (EX-4), at 375 / 768 / 1280.
 *
 * What each test proves (UAT / finding in brackets):
 *  - SCH-01  /admin/schools lists the schools the API returns, with the seed schools (UAT-ADM-06)
 *  - SCH-02  search narrows the list, a miss shows the empty state "Tiada sekolah dijumpai" (UAT-ADM-06)
 *  - SCH-03  create a school through the form, edit it, switch it off and on again (FR-M02-80/81, UAT-ADM-06)
 *  - SCH-04  a duplicate school code keeps the form and shows a BM error, never the raw English text (SWE)
 *  - SCH-05  an unknown school id on the edit route is the 404 page, not a blank form (S11 decision)
 *  - SUB-01  /admin/school-subscriptions loads the list and its summary from the API (UAT-ADM-13)
 *  - SUB-02  create a subscription with the school picker, list it, change its quota, cancel it
 *            (FR-M02-84..97; SWX-4: the picker list is painted in the flow, not clipped by the card)
 *  - SUB-03  creating without a school is refused by the API and shown as a BM alert (input kept)
 *  - SUB-04  the renewal invoice of a full subscription loads (FR-M02-96)
 *  - GRD-01  the school and subscription APIs: 401 anonymous, 403 for Guru, Admin Sekolah and Pelajar
 *  - GRD-02  the school and subscription screens redirect Admin Sekolah, Guru and Pelajar to their own home
 *
 * Data written (kept small, safe to re-run):
 *  - a school named "Sekolah Ujian M02 <stamp>" with code "UJ<stamp>" per create test and project. Schools
 *    cannot be deleted by the API, so the test leaves it switched OFF (inactive) at the end.
 *  - a basic subscription for the seed school SK Demo Tiga, always cancelled again before the test ends. A
 *    cancelled row stays in the list; every assertion tolerates earlier rows. Any active subscription of that
 *    school left by an aborted run is cancelled first, so a re-run starts clean.
 * Seed accounts and the password come from `./helpers` (`account()`); the password is never written here.
 */

import { expect, test, type Page } from '@playwright/test'

import { currentSession, gotoApi, loginViaUi } from '../fixtures/api'
import { account, expectNoHScroll, HOME, newPeerContext, type ApiRole } from './helpers'
import {
  applyFilters,
  cancelOpenSubscriptions,
  dataOf,
  filterControls,
  isPainted,
  openApiSession,
  stamp,
  type ApiErrorBody,
} from './m02-m17-support'

interface WireSchool {
  id: string
  name: string
  code: string
  type: string
  state: string
  isActive: boolean
}

interface WireSubscription {
  id: string
  school: { id: string; name: string }
  status: string
  studentQuota: number
  packageTier: string
}

/** The seed school every subscription test uses: not the one the other specs write to (DEMO001). */
const SUB_SCHOOL = 'SK Demo Tiga'

async function signIn(page: Page, role: ApiRole): Promise<void> {
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
}

async function wireSchools(
  page: Page,
  search = '',
): Promise<{ data: WireSchool[]; pageSize: number }> {
  const res = await page.request.get('/api/admin/schools', { params: search ? { search } : {} })
  expect(res.status(), 'GET /api/admin/schools').toBe(200)
  const body = (await res.json()) as { data: WireSchool[]; meta: { pageSize: number } }
  return { data: body.data, pageSize: body.meta.pageSize }
}

test.describe('M02 schools (Admin Pusat) @api', () => {
  test.setTimeout(120_000)

  test('SCH-01 the list shows the schools the API returns, seed schools included @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const listed = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/admin/schools' && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await gotoApi(page, '/admin/schools')
    expect((await listed).status(), 'GET /api/admin/schools').toBe(200)
    await expect(page.getByTestId('schools-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('schools-error')).toHaveCount(0)
    await expect(page.getByTestId('school-row').first()).toBeVisible({ timeout: 20_000 })

    const { data, pageSize } = await wireSchools(page)
    expect(data.length, 'the seed has the four demo schools').toBeGreaterThanOrEqual(4)
    await expect(page.getByTestId('school-row')).toHaveCount(Math.min(data.length, pageSize))
    for (const name of ['SMK Demo Satu', 'SK Demo Dua', 'SK Demo Tiga', 'SJK(C) Demo Empat']) {
      expect(
        data.map((s) => s.name),
        `API lists ${name}`,
      ).toContain(name)
      await expect(page.getByTestId('school-row').filter({ hasText: name }).first()).toBeVisible()
    }
    await expect(page.getByRole('link', { name: 'Tambah Sekolah' })).toBeVisible()
    await expectNoHScroll(page)
  })

  test('SCH-02 search narrows the list and a miss shows the empty state @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    await gotoApi(page, '/admin/schools')
    await expect(page.getByTestId('school-row').first()).toBeVisible({ timeout: 20_000 })

    await filterControls(page)
    await page.getByTestId('schools-search').fill('DEMO002')
    const filtered = page.waitForResponse(
      (r) => r.url().includes('/api/admin/schools') && r.url().includes('search=DEMO002'),
      { timeout: 30_000 },
    )
    await applyFilters(page)
    expect((await filtered).status(), 'GET /api/admin/schools?search=DEMO002').toBe(200)
    await expect(page.getByTestId('school-row')).toHaveCount(1, { timeout: 15_000 })
    await expect(page.getByTestId('school-row')).toContainText('SK Demo Dua')
    await expectNoHScroll(page)

    await filterControls(page)
    await page.getByTestId('schools-search').fill(`tiada-sekolah-${stamp(test.info())}`)
    await applyFilters(page)
    await expect(page.getByTestId('schools-empty')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('school-row')).toHaveCount(0)
    await expectNoHScroll(page)
  })

  test('SCH-03 create a school, edit it, switch it off and on again @api', async ({
    page,
  }, info) => {
    await signIn(page, 'adminPusat')
    const id = stamp(info)
    const name = `Sekolah Ujian M02 ${id}`
    const code = `UJ${id}`.toUpperCase()

    await gotoApi(page, '/admin/schools/create')
    await expect(page.getByTestId('school-form')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('school-name').fill(name)
    await page.getByTestId('school-code').fill(code)
    await page.getByTestId('school-type').selectOption('SK')
    await page.getByTestId('school-state').selectOption('Johor')
    await page.getByTestId('school-district').fill('Johor Bahru')
    await page.getByTestId('school-city').fill('Johor Bahru')
    await expectNoHScroll(page)

    const created = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/admin/schools' && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Simpan' }).click()
    const createdRes = await created
    expect(createdRes.status(), 'POST /api/admin/schools').toBe(201)
    const schoolId = ((await createdRes.json()) as { data: { id: string } }).data.id
    await expect(page).toHaveURL(/\/admin\/schools$/, { timeout: 20_000 })

    try {
      const stored = dataOf<WireSchool>(
        {
          status: 200,
          body: await (await page.request.get(`/api/admin/schools/${schoolId}`)).json(),
        },
        'GET school',
      )
      expect(stored).toMatchObject({ name, code, type: 'SK', state: 'Johor', isActive: true })

      // The new school is found by its code in the list.
      await expect(page.getByTestId('school-row').first()).toBeVisible({ timeout: 20_000 })
      await filterControls(page)
      await page.getByTestId('schools-search').fill(code)
      await applyFilters(page)
      const row = page.locator(`[data-testid=school-row][data-school-id="${schoolId}"]`)
      await expect(row).toHaveCount(1, { timeout: 15_000 })

      // Edit: the form is pre-filled from the API, the new name is stored.
      await gotoApi(page, `/admin/schools/${schoolId}/edit`)
      await expect(page.getByTestId('school-form')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByTestId('school-name')).toHaveValue(name)
      await expect(page.getByTestId('school-code')).toHaveValue(code)
      await expect(page.getByTestId('school-state')).toHaveValue('Johor')
      const renamed = `${name} Baharu`
      await page.getByTestId('school-name').fill(renamed)
      await expectNoHScroll(page)
      const updated = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/admin/schools/${schoolId}` &&
          r.request().method() === 'PUT',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Kemaskini' }).click()
      expect((await updated).status(), 'PUT /api/admin/schools/:id').toBe(200)
      await expect(page).toHaveURL(/\/admin\/schools$/, { timeout: 20_000 })
      const afterEdit = (await (
        await page.request.get(`/api/admin/schools/${schoolId}`)
      ).json()) as {
        data: WireSchool
      }
      expect(afterEdit.data.name).toBe(renamed)
      expect(afterEdit.data.code, 'an edit keeps the code').toBe(code)

      // Toggle off and on from the list.
      await expect(page.getByTestId('school-row').first()).toBeVisible({ timeout: 20_000 })
      await filterControls(page)
      await page.getByTestId('schools-search').fill(code)
      await applyFilters(page)
      await expect(row).toHaveCount(1, { timeout: 15_000 })
      for (const want of [false, true]) {
        const toggled = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === `/api/admin/schools/${schoolId}/toggle` &&
            r.request().method() === 'POST',
          { timeout: 30_000 },
        )
        // Table: the button is in the row; cards (below md) have no toggle, so use the edit-free API path there.
        const toggle = page.locator('[data-testid=school-toggle]:visible')
        if ((await toggle.count()) > 0) {
          await toggle.first().click()
          expect((await toggled).status(), 'POST /api/admin/schools/:id/toggle').toBe(200)
        } else {
          void toggled.catch(() => undefined)
          const csrf = (
            (await (await page.request.get('/api/session')).json()) as {
              data: { csrf: string }
            }
          ).data.csrf
          const res = await page.request.post(`/api/admin/schools/${schoolId}/toggle`, {
            headers: { 'x-csrf-token': csrf },
          })
          expect(res.status(), 'POST toggle').toBe(200)
        }
        await expect
          .poll(
            async () =>
              (
                (await (await page.request.get(`/api/admin/schools/${schoolId}`)).json()) as {
                  data: WireSchool
                }
              ).data.isActive,
            { timeout: 15_000 },
          )
          .toBe(want)
      }
    } finally {
      // Leave the fixture school switched off: schools cannot be deleted through the API.
      const csrf = (
        (await (await page.request.get('/api/session')).json()) as {
          data: { csrf: string }
        }
      ).data.csrf
      const now = (await (await page.request.get(`/api/admin/schools/${schoolId}`)).json()) as {
        data: WireSchool
      }
      if (now.data.isActive) {
        await page.request.post(`/api/admin/schools/${schoolId}/toggle`, {
          headers: { 'x-csrf-token': csrf },
        })
      }
    }
  })

  test('SCH-04 a duplicate code keeps the form and shows a BM error (no raw English) @api', async ({
    page,
  }, info) => {
    await signIn(page, 'adminPusat')
    await gotoApi(page, '/admin/schools/create')
    await expect(page.getByTestId('school-form')).toBeVisible({ timeout: 20_000 })
    const name = `Sekolah Pendua ${stamp(info)}`
    await page.getByTestId('school-name').fill(name)
    await page.getByTestId('school-code').fill('DEMO001')
    await page.getByTestId('school-type').selectOption('SMK')
    await page.getByTestId('school-state').selectOption('Selangor')

    const created = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/admin/schools' && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Simpan' }).click()
    expect((await created).status(), 'a taken code is a validation error').toBe(422)

    const alert = page.getByTestId('school-form-alert')
    await expect(alert).toBeVisible({ timeout: 15_000 })
    const text = ((await alert.textContent()) ?? '').trim()
    expect(text.length, 'the alert has a message').toBeGreaterThan(0)
    for (const english of [
      'the given data was invalid',
      'server error',
      'conflict',
      'unauthorized',
    ]) {
      expect(text.toLowerCase(), 'no generic English server text').not.toContain(english)
    }
    await expect(page).toHaveURL(/\/admin\/schools\/create$/)
    await expect(page.getByTestId('school-name'), 'the input is kept').toHaveValue(name)
    await expectNoHScroll(page)
  })

  test('SCH-05 an unknown school id on the edit route is the 404 page @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    const missing = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/admin/schools/99999999',
      { timeout: 30_000 },
    )
    await page.goto('/admin/schools/99999999/edit')
    expect((await missing).status(), 'GET /api/admin/schools/99999999').toBe(404)
    await expect(page).toHaveTitle(/404/, { timeout: 15_000 })
    await expect(page.getByTestId('school-form')).toHaveCount(0)
    await expectNoHScroll(page)
  })
})

test.describe('M02 school subscriptions (Admin Pusat) @api', () => {
  test.setTimeout(150_000)

  test('SUB-01 the list and its summary come from the API @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    const listed = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/admin/school-subscriptions' &&
        r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await gotoApi(page, '/admin/school-subscriptions')
    const res = await listed
    expect(res.status(), 'GET /api/admin/school-subscriptions').toBe(200)
    const body = (await res.json()) as {
      data: WireSubscription[]
      meta: { totalItems: number; counts: { active: number } }
    }
    await expect(page.getByTestId('subs-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('subs-error')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Langganan Baru' })).toBeVisible()
    await expect(page.getByTestId('subs-skeleton')).toHaveCount(0, { timeout: 20_000 })
    if (body.data.length === 0) {
      await expect(page.getByTestId('subs-empty')).toBeVisible()
    } else {
      await expect(page.getByTestId('subs-row').first()).toBeVisible()
      await expect(page.getByTestId('subs-row')).toHaveCount(
        Math.min(body.data.length, body.meta.totalItems),
      )
    }
    await expectNoHScroll(page)
  })

  test('SUB-02 create with the school picker, change the quota, cancel @api', async ({
    page,
    browser,
  }, info) => {
    const api = await openApiSession(browser, info, 'adminPusat')
    try {
      const schoolId = await cancelOpenSubscriptions(api, SUB_SCHOOL)
      await signIn(page, 'adminPusat')
      await gotoApi(page, '/admin/school-subscriptions/create')
      await expect(page.getByTestId('sub-form')).toBeVisible({ timeout: 20_000 })

      // The school picker: type, the result list is painted in the flow (SWX-4), pick the school.
      await page.getByTestId('sub-school-search').fill('Demo Tiga')
      const result = page.getByTestId('sub-school-result').filter({ hasText: SUB_SCHOOL })
      await expect(result).toBeVisible({ timeout: 15_000 })
      expect(await isPainted(result), 'the school result is not clipped by the form card').toBe(
        true,
      )
      await result.click()
      await expect(page.getByTestId('sub-school-name')).toHaveText(SUB_SCHOOL)

      // Basic tier (default) and the first package card; the quota is 12.
      await expect(page.getByTestId('sub-packages')).toBeVisible({ timeout: 15_000 })
      await page.getByTestId('sub-packages').getByRole('radio').first().check({ force: true })
      await page.getByTestId('sub-quota').fill('12')
      await expect(page.getByTestId('sub-summary')).toBeVisible()
      await page.getByTestId('sub-reference').fill(`UJI-${stamp(info)}`)
      await expectNoHScroll(page)

      const created = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/school-subscriptions' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByTestId('sub-submit').click()
      const createdRes = await created
      expect(createdRes.status(), 'POST /api/admin/school-subscriptions').toBe(201)
      const sub = ((await createdRes.json()) as { data: { id: string; schoolId: string } }).data
      expect(sub.schoolId).toBe(schoolId)

      try {
        await expect(page).toHaveURL(new RegExp(`/admin/school-subscriptions/${sub.id}$`), {
          timeout: 20_000,
        })
        await expect(page.getByTestId('sub-detail-page')).toBeVisible({ timeout: 20_000 })
        await expect(page.getByTestId('sub-school')).toContainText(SUB_SCHOOL)
        await expect(page.getByTestId('sub-status')).toHaveText('Aktif')
        await expect(page.getByTestId('sub-tier')).toHaveText('Pemantauan')
        await expect(page.getByTestId('sub-usage')).toContainText('12')
        await expectNoHScroll(page)

        // Change the quota.
        await page.getByTestId('sub-toggle-quota').click()
        await expect(page.getByTestId('sub-quota-form')).toBeVisible()
        await page.getByTestId('sub-quota-input').fill('20')
        await page.getByTestId('sub-quota-notes').fill('Ujian kuota')
        const quota = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === `/api/admin/school-subscriptions/${sub.id}/quota` &&
            r.request().method() === 'PUT',
          { timeout: 30_000 },
        )
        await page.getByTestId('sub-quota-save').click()
        expect((await quota).status(), 'PUT quota').toBe(200)
        await expect(page.getByTestId('sub-usage')).toContainText('20', { timeout: 15_000 })
        const afterQuota = dataOf<{ studentQuota: number }>(
          await api.get(`/api/admin/school-subscriptions/${sub.id}`),
          'GET subscription',
        )
        expect(afterQuota.studentQuota).toBe(20)

        // The list shows the row.
        await gotoApi(page, '/admin/school-subscriptions')
        await expect(
          page.locator(`[data-testid=subs-row][data-sub-id="${sub.id}"]`),
          'the new subscription is listed',
        ).toHaveCount(1, { timeout: 20_000 })
        await expectNoHScroll(page)

        // Cancel from the detail page.
        await gotoApi(page, `/admin/school-subscriptions/${sub.id}`)
        await expect(page.getByTestId('sub-status')).toHaveText('Aktif', { timeout: 20_000 })
        await page.getByTestId('sub-cancel').click()
        const cancelled = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === `/api/admin/school-subscriptions/${sub.id}/cancel` &&
            r.request().method() === 'POST',
          { timeout: 30_000 },
        )
        await page.locator('[data-ds="confirm-ok"]').click()
        expect((await cancelled).status(), 'POST cancel').toBe(200)
        await expect(page.getByTestId('sub-status')).toHaveText('Batal', { timeout: 15_000 })
        await expectNoHScroll(page)
      } finally {
        // Whatever happened above, the subscription must not stay active.
        await cancelOpenSubscriptions(api, SUB_SCHOOL)
      }
    } finally {
      await api.dispose()
    }
  })

  test('SUB-03 creating without a school is refused and shown as a BM alert @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    await gotoApi(page, '/admin/school-subscriptions/create')
    await expect(page.getByTestId('sub-form')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('sub-packages')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('sub-packages').getByRole('radio').first().check({ force: true })
    await page.getByTestId('sub-quota').fill('7')

    const created = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/admin/school-subscriptions' &&
        r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByTestId('sub-submit').click()
    expect((await created).status(), 'no school is a validation error').toBe(422)
    const alert = page.getByTestId('sub-form-alert')
    await expect(alert).toBeVisible({ timeout: 15_000 })
    expect(((await alert.textContent()) ?? '').toLowerCase()).not.toContain(
      'the given data was invalid',
    )
    await expect(page).toHaveURL(/\/admin\/school-subscriptions\/create$/)
    await expect(page.getByTestId('sub-quota'), 'the input is kept').toHaveValue('7')
    await expectNoHScroll(page)
  })

  test('SUB-04 the renewal invoice of a full subscription loads @api', async ({
    page,
    browser,
  }, info) => {
    const api = await openApiSession(browser, info, 'adminPusat')
    try {
      const schoolId = await cancelOpenSubscriptions(api, SUB_SCHOOL)
      const packages = dataOf<{ id: string; formLevel: string }[]>(
        await api.get('/api/admin/school-packages'),
        'GET /api/admin/school-packages',
      )
      const made = await api.send('POST', '/api/admin/school-subscriptions', {
        schoolId,
        packageTier: 'full',
        schoolPackageId: packages[0]!.id,
        studentQuota: 8,
        paymentReference: `UJI-${stamp(info)}`,
        paymentNotes: null,
      })
      const sub = dataOf<{ id: string; packageTier: string }>(made, 'POST school-subscriptions')
      try {
        expect(sub.packageTier).toBe('full')
        await signIn(page, 'adminPusat')
        const invoice = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname ===
            `/api/admin/school-subscriptions/${sub.id}/renewal-invoice`,
          { timeout: 30_000 },
        )
        await gotoApi(page, `/admin/school-subscriptions/${sub.id}/renewal-invoice`)
        expect((await invoice).status(), 'GET renewal-invoice').toBe(200)
        await expect(page.getByTestId('invoice-page')).toBeVisible({ timeout: 20_000 })
        await expect(page.getByTestId('invoice-error')).toHaveCount(0)
        await expect(page.getByTestId('invoice-school')).toContainText(SUB_SCHOOL)
        await expectNoHScroll(page)
      } finally {
        await cancelOpenSubscriptions(api, SUB_SCHOOL)
      }
    } finally {
      await api.dispose()
    }
  })
})

test.describe('M02 role guards on schools and subscriptions @api', () => {
  test.setTimeout(90_000)

  const PATHS = [
    '/api/admin/schools',
    '/api/admin/schools/options',
    '/api/admin/school-subscriptions',
    '/api/admin/school-packages',
  ]

  test('GRD-01 the APIs answer 401 anonymous and 403 for Guru, Admin Sekolah and Pelajar @api', async ({
    browser,
  }, info) => {
    const anon = await newPeerContext(browser, info)
    try {
      for (const path of PATHS) {
        const res = await anon.request.get(path)
        expect(res.status(), `anonymous GET ${path}`).toBe(401)
      }
    } finally {
      await anon.close()
    }
    for (const role of ['guru', 'adminSekolah', 'student'] as const) {
      const api = await openApiSession(browser, info, role)
      try {
        for (const path of PATHS) {
          const res = await api.get(path)
          expect(res.status, `${role} GET ${path}`).toBe(403)
          expect((res.body as ApiErrorBody).error.code).toBe('FORBIDDEN')
        }
        const write = await api.send('POST', '/api/admin/schools', {
          name: 'Tidak Dibenarkan',
          code: 'TD0001',
          type: 'SK',
          state: 'Johor',
        })
        expect(write.status, `${role} POST /api/admin/schools`).toBe(403)
      } finally {
        await api.dispose()
      }
    }
  })

  for (const [role, label] of [
    ['adminSekolah', 'Admin Sekolah'],
    ['guru', 'Guru'],
    ['student', 'Pelajar'],
  ] as const) {
    test(`GRD-02 ${label} opening the admin school screens is sent to its own home @api`, async ({
      page,
    }) => {
      await signIn(page, role)
      const session = await currentSession(page)
      expect(session.active.role).toBeTruthy()
      const home =
        HOME[role === 'adminSekolah' ? 'adminSekolah' : role === 'guru' ? 'guru' : 'student']
      for (const path of [
        '/admin/schools',
        '/admin/school-subscriptions',
        '/admin/schools/create',
      ]) {
        await page.goto(path)
        await expect(page).toHaveURL(new RegExp(`${home}$`), { timeout: 20_000 })
        await expect(page.getByTestId('schools-page')).toHaveCount(0)
        await expect(page.getByTestId('subs-page')).toHaveCount(0)
        await expectNoHScroll(page)
      }
    })
  }

  test('GRD-03 an anonymous visitor on /admin/schools is sent to the login @api', async ({
    page,
  }) => {
    await page.goto('/admin/schools')
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 20_000 })
    await expectNoHScroll(page)
  })
})
