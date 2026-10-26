/**
 * @api M02 user management (Admin Pusat) against the REAL API (EX-4), at 375 / 768 / 1280.
 *
 * What each test proves (UAT / finding in brackets):
 *  - USR-01  /admin/users shows the stat cards and the page of rows the API returns, and page 2 loads (UAT-ADM-05)
 *  - USR-02  the role filter keeps only that role, a search miss shows "Tiada pengguna dijumpai", reset restores
 *  - USR-03  create a Pelajar with the school picker (list painted in the flow, SWX-4 / RS5-M1), the one-time
 *            password is shown, the new pupil can sign in with it, and "Padam" removes it (D55c, D59b)
 *  - USR-04  deactivate and reactivate from the row menu; a deactivated account cannot sign in
 *  - USR-05  select two accounts and delete them in bulk: ids go over the wire as strings, no 422 (SWX-2)
 *  - USR-06  an Admin cannot delete or demote his own account (D58 self guards, last-admin 409 message)
 *  - USR-07  the user APIs answer 401 anonymous and 403 for Guru, Admin Sekolah and Pelajar; the admin user
 *            screens send Admin Sekolah back to /admin-sekolah (UAT-ASK-10)
 *  - USR-09  a taken e-mail keeps the create form, shows the API field message and keeps the input (FR-M02-22)
 *  - USR-10  the school search list of the Admin Sekolah generator is painted in the flow (RS5-M1)
 *  - USR-08  the "Pakej" page of an account loads from the API (SW2-04)
 *
 * Data written: every account is created by the test (fictitious names, `@example.test` e-mails, unique per run,
 * project and test) and is deleted again, also when the test fails. Accounts that need their own rate limit
 * bucket sign in as a throw-away Admin Pusat created for the test (see `createTempAdmin`).
 * The generated passwords exist in memory only: they are never logged, attached or written to a file.
 * Seed accounts and the password come from `./helpers` (`account()`); the password is never written here.
 */

import { expect, test, type Page } from '@playwright/test'

import { gotoApi, loginViaUi } from '../fixtures/api'
import { account, expectNoHScroll, HOME, newPeerContext, type ApiRole } from './helpers'
import {
  applyFilters,
  createTempAdmin,
  createUser,
  dataOf,
  filterControls,
  gotoExpectUrl,
  isPainted,
  isTableLayout,
  openApiSession,
  openTempSession,
  removeUsers,
  stamp,
  type ApiErrorBody,
} from './m02-m17-support'

interface WireUser {
  id: string
  name: string
  email: string
  roles: string[]
  isActive: boolean
  school: { id: string; name: string } | null
}

interface UserList {
  data: WireUser[]
  meta: { pageSize: number; totalItems: number; roleCounts: Record<string, number> }
}

async function signIn(page: Page, role: ApiRole): Promise<void> {
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
}

async function wireList(page: Page, query: Record<string, string> = {}): Promise<UserList> {
  const res = await page.request.get('/api/admin/users', { params: query })
  expect(res.status(), 'GET /api/admin/users').toBe(200)
  return (await res.json()) as UserList
}

/** Searches the list for `text` through the filter bar and waits for the API answer. */
async function searchFor(page: Page, text: string): Promise<void> {
  await filterControls(page)
  await page.getByTestId('users-search').fill(text)
  const answered = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/admin/users' && r.url().includes('search='),
    { timeout: 30_000 },
  )
  await applyFilters(page)
  expect((await answered).status(), 'GET /api/admin/users?search=').toBe(200)
}

/** The row (table row or card) of user `id`, to reach its "..." menu. */
function rowOf(page: Page, id: string) {
  return page
    .locator('tr, [data-ds="data-table-cards"] > li')
    .filter({ has: page.locator(`[data-testid="user-row"][data-user-id="${id}"]`) })
}

test.describe('M02 users (Admin Pusat) @api', () => {
  test.setTimeout(240_000)

  test('USR-01 the list shows the stat cards and the page of rows the API returns @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const listed = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/admin/users' && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await gotoApi(page, '/admin/users')
    expect((await listed).status(), 'GET /api/admin/users').toBe(200)
    await expect(page.getByTestId('users-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('users-error')).toHaveCount(0)
    await expect(page.getByTestId('user-row').first()).toBeVisible({ timeout: 20_000 })

    const first = await wireList(page)
    expect(first.meta.totalItems, 'the seed has the demo users').toBeGreaterThanOrEqual(40)
    await expect(page.getByTestId('user-row')).toHaveCount(
      Math.min(first.data.length, first.meta.pageSize),
    )
    // The stat cards come from the same API answer: students, then teachers.
    await expect(page.getByTestId('users-stat-student')).toContainText(
      String(first.meta.roleCounts.student),
    )
    await expect(page.getByTestId('users-stat-teacher')).toContainText(
      String(first.meta.roleCounts.teacher),
    )
    // The signed-in admin's own row is listed.
    await expectNoHScroll(page)

    // Page 2, when the seed is larger than one page.
    if (first.meta.totalItems > first.meta.pageSize) {
      const second = page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/admin/users' && r.url().includes('page=2'),
        { timeout: 30_000 },
      )
      await page
        .locator('[data-ds="data-table-pager"]')
        .getByRole('button', { name: 'Halaman 2', exact: true })
        .click()
      expect((await second).status(), 'GET /api/admin/users?page=2').toBe(200)
      const page2 = await wireList(page, { page: '2' })
      await expect(page.getByTestId('user-row').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('user-row').first()).toHaveAttribute(
        'data-user-id',
        page2.data[0]!.id,
      )
      await expectNoHScroll(page)
    }
  })

  test('USR-02 role filter, search miss and reset @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    await gotoApi(page, '/admin/users')
    await expect(page.getByTestId('user-row').first()).toBeVisible({ timeout: 20_000 })

    await filterControls(page)
    await page.getByTestId('users-role').selectOption('teacher')
    const filtered = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/admin/users' && r.url().includes('role=teacher'),
      { timeout: 30_000 },
    )
    await applyFilters(page)
    expect((await filtered).status(), 'GET /api/admin/users?role=teacher').toBe(200)
    const teachers = await wireList(page, { role: 'teacher' })
    await expect(page.getByTestId('user-row')).toHaveCount(
      Math.min(teachers.data.length, teachers.meta.pageSize),
      { timeout: 15_000 },
    )
    // Every listed row is one of the API's teachers (a multi-role account shows its main role badge).
    const teacherIds = new Set(teachers.data.map((u) => u.id))
    for (const id of await page
      .locator('[data-testid="user-row"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-user-id') ?? ''))) {
      expect(teacherIds.has(id), `row ${id} is in the teacher filter result`).toBe(true)
    }
    for (const u of teachers.data) expect(u.roles, `${u.email} has the role`).toContain('teacher')
    await expectNoHScroll(page)

    // A search that matches nobody.
    await searchFor(page, `tiada-pengguna-${stamp(test.info())}`)
    await expect(page.getByTestId('users-empty')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('user-row')).toHaveCount(0)
    await expectNoHScroll(page)

    // Reset brings the full list back.
    await filterControls(page)
    if (isTableLayout(page)) {
      await page
        .locator('[data-ds="filter-bar"]')
        .getByRole('button', { name: 'Set Semula', exact: true })
        .first()
        .click()
    } else {
      await page
        .locator('[data-ds="filter-sheet"]')
        .getByRole('button', { name: 'Set Semula' })
        .click()
    }
    await expect(page.getByTestId('users-empty')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByTestId('user-row').first()).toBeVisible({ timeout: 15_000 })
  })

  test('USR-03 create a Pelajar, see the one-time password, sign in with it, delete it @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    let createdId: string | null = null
    try {
      await signIn(page, 'adminPusat')
      await gotoApi(page, '/admin/users/create')
      await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 20_000 })
      await page.getByTestId('user-role').selectOption('student')

      const id = stamp(info)
      const email = `murid.uji.${id}@example.test`.toLowerCase()
      await page.getByTestId('user-name').fill(`Murid Ujian ${id}`)
      await page.getByTestId('user-email').fill(email)
      // Tahap Pendidikan: Ting. 4 is grade 10.
      await page.locator('label', { hasText: 'Ting. 4' }).click()
      await expect(page.getByRole('radio', { name: 'Ting. 4' })).toBeChecked()

      // The school picker draws its list in the flow (SWX-4 / RS5-M1): the result is painted, not clipped.
      await page.getByTestId('std-school-search').fill('Demo Dua')
      const result = page.getByTestId('std-school-result').filter({ hasText: 'SK Demo Dua' })
      await expect(result).toBeVisible({ timeout: 15_000 })
      expect(await isPainted(result), 'the school result is not clipped by the form card').toBe(
        true,
      )
      await result.click()
      await expect(page.getByTestId('std-school-chosen')).toHaveText('SK Demo Dua')
      await expectNoHScroll(page)

      const created = page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/admin/users' && r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Daftar Pengguna' }).click()
      const res = await created
      if (res.status() < 300) {
        createdId = ((await res.json()) as { data: { id: string } }).data.id
      }
      expect(res.status(), 'POST /api/admin/users').toBe(201)
      const body = JSON.parse(res.request().postData() ?? '{}') as Record<string, unknown>
      expect(body.roles).toEqual(['student'])
      expect(body.grade).toBe(10)
      expect(typeof body.schoolId, 'the school id goes over the wire as a string').toBe('string')
      expect(body).not.toHaveProperty('password')

      // One-time credentials: shown now, never returned by a read.
      await expect(page.getByTestId('generated-credentials')).toBeVisible()
      await expect(page.getByTestId('credential-email')).toHaveText(email)
      const password = ((await page.getByTestId('credential-password').textContent()) ?? '').trim()
      expect(password.length, 'a generated password').toBeGreaterThan(7)
      await expectNoHScroll(page)

      const stored = dataOf<WireUser & { generatedPassword?: string }>(
        await admin.get(`/api/admin/users/${createdId}`),
        'GET user',
      )
      expect(stored).toMatchObject({ email, roles: ['student'], isActive: true })
      expect(stored.school?.name).toBe('SK Demo Dua')
      expect(stored, 'a read never returns the password').not.toHaveProperty('generatedPassword')

      // The new pupil signs in with the shown password.
      const pupil = await openTempSession(browser, info, { id: createdId!, email, password })
      try {
        const session = dataOf<{ active: { role: string } }>(
          await pupil.get('/api/session'),
          'GET /api/session',
        )
        expect(session.active.role).toBe('student')
      } finally {
        await pupil.dispose()
      }

      // Delete from the list: row menu, then the confirm dialog.
      await page.getByTestId('user-credential-continue').click()
      await expect(page).toHaveURL(/\/admin\/users$/, { timeout: 20_000 })
      await expect(page.getByTestId('user-row').first()).toBeVisible({ timeout: 20_000 })
      await searchFor(page, email)
      const row = rowOf(page, createdId!)
      await expect(row).toHaveCount(1, { timeout: 15_000 })
      await row.getByTestId('row-menu').click()
      await page.getByRole('menuitem', { name: 'Padam' }).click()
      await expect(page.getByRole('dialog', { name: 'Padam Pengguna?' })).toBeVisible()
      await expect(page.getByTestId('users-delete-name')).toHaveText(`Murid Ujian ${id}`)
      const deleted = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/admin/users/${createdId}` &&
          r.request().method() === 'DELETE',
        { timeout: 30_000 },
      )
      await page.getByTestId('users-delete-confirm').click()
      expect((await deleted).status(), 'DELETE /api/admin/users/:id').toBe(200)
      await expect(rowOf(page, createdId!)).toHaveCount(0, { timeout: 15_000 })
      expect((await admin.get(`/api/admin/users/${createdId}`)).status).toBe(404)
      createdId = null
    } finally {
      if (createdId) await removeUsers(admin, [createdId])
      await admin.dispose()
    }
  })

  test('USR-04 deactivate and reactivate from the row menu @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    const teacher = await createUser(admin, info, 'teacher', { schoolId: '2' }, 'gurunyah')
    try {
      await signIn(page, 'adminPusat')
      await gotoApi(page, '/admin/users')
      await expect(page.getByTestId('user-row').first()).toBeVisible({ timeout: 20_000 })
      await searchFor(page, teacher.email)
      const row = rowOf(page, teacher.id)
      await expect(row).toHaveCount(1, { timeout: 15_000 })

      const toggled = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/admin/users/${teacher.id}/toggle-active` &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await row.getByTestId('row-menu').click()
      await page.getByRole('menuitem', { name: 'Nyahaktifkan' }).click()
      await page.locator('[data-ds="confirm-ok"]').click()
      expect((await toggled).status(), 'POST toggle-active (off)').toBe(200)
      await expect
        .poll(
          async () =>
            dataOf<WireUser>(await admin.get(`/api/admin/users/${teacher.id}`), 'GET').isActive,
        )
        .toBe(false)

      // A deactivated account cannot sign in.
      const guest = await newPeerContext(browser, info)
      try {
        const denied = await guest.request.post('/api/auth/login', {
          data: { identifier: teacher.email, password: teacher.password },
        })
        expect(denied.status(), 'sign-in of a deactivated account').toBeGreaterThanOrEqual(400)
        expect(denied.status()).toBeLessThan(500)
      } finally {
        await guest.close()
      }

      // And back on.
      await expect(row).toHaveCount(1)
      const toggledBack = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/admin/users/${teacher.id}/toggle-active` &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await row.getByTestId('row-menu').click()
      await page.getByRole('menuitem', { name: 'Aktifkan' }).click()
      await page.locator('[data-ds="confirm-ok"]').click()
      expect((await toggledBack).status(), 'POST toggle-active (on)').toBe(200)
      await expect
        .poll(
          async () =>
            dataOf<WireUser>(await admin.get(`/api/admin/users/${teacher.id}`), 'GET').isActive,
        )
        .toBe(true)
      const again = await openTempSession(browser, info, teacher)
      await again.dispose()
      await expectNoHScroll(page)
    } finally {
      await removeUsers(admin, [teacher.id])
      await admin.dispose()
    }
  })

  test('USR-05 bulk delete sends string ids and removes the selected accounts @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    const key = stamp(info)
    const made: string[] = []
    try {
      const a = await createUser(admin, info, 'teacher', { schoolId: '2' }, `gurubulk.a${key}`)
      made.push(a.id)
      const b = await createUser(admin, info, 'teacher', { schoolId: '2' }, `gurubulk.b${key}`)
      made.push(b.id)
      await signIn(page, 'adminPusat')
      await gotoApi(page, '/admin/users')
      await expect(page.getByTestId('user-row').first()).toBeVisible({ timeout: 20_000 })
      // Only this run's two accounts are listed: the search key is unique to them.
      await searchFor(page, key)
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(2, { timeout: 15_000 })

      const boxes = page.locator('[data-testid="user-select"]:visible')
      await expect(boxes).toHaveCount(2)
      await boxes.nth(0).check()
      await boxes.nth(1).check()
      await expect(page.getByTestId('users-selected-count')).toHaveText('2')
      await page.getByTestId('users-bulk-delete').click()
      await expect(page.getByRole('dialog', { name: 'Padam Pengguna Terpilih?' })).toBeVisible()
      await expect(page.getByTestId('users-bulk-count')).toHaveText('2')
      const bulk = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/users/bulk-delete' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByTestId('users-bulk-confirm').click()
      const res = await bulk
      expect(res.status(), 'POST /api/admin/users/bulk-delete').toBe(200)
      const sent = JSON.parse(res.request().postData() ?? '{}') as { ids: unknown[] }
      expect(
        sent.ids.map((i) => typeof i),
        'ids are strings on the wire (SWX-2)',
      ).toEqual(['string', 'string'])
      await expect(page.getByTestId('user-row')).toHaveCount(0, { timeout: 15_000 })
      for (const user of [a, b]) {
        expect((await admin.get(`/api/admin/users/${user.id}`)).status).toBe(404)
      }
      await expectNoHScroll(page)
    } finally {
      await removeUsers(admin, made)
      await admin.dispose()
    }
  })

  test('USR-06 an Admin cannot delete or demote his own account @api', async ({
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    // A throw-away admin, so the seed admin is never at risk if a guard were missing.
    const temp = await createTempAdmin(admin, info)
    try {
      const own = await openTempSession(browser, info, temp)
      try {
        const del = await own.send('DELETE', `/api/admin/users/${temp.id}`)
        expect(del.status, 'DELETE own account').toBe(422)
        expect((del.body as ApiErrorBody).error.message).toContain(
          'tidak boleh memadam akaun sendiri',
        )

        const demote = await own.send('PUT', `/api/admin/users/${temp.id}`, {
          name: `Ujian ${temp.email}`,
          email: temp.email,
          roles: ['teacher'],
          schoolId: '2',
        })
        expect(demote.status, 'demote own account').toBe(409)
        expect((demote.body as ApiErrorBody).error.code).toBe('CONFLICT')
        expect((demote.body as ApiErrorBody).error.message.length).toBeGreaterThan(0)

        const bulk = await own.send('POST', '/api/admin/users/bulk-delete', { ids: [temp.id] })
        expect(bulk.status, 'bulk delete of own account').toBeGreaterThanOrEqual(400)
        expect(bulk.status).toBeLessThan(500)

        const still = dataOf<WireUser>(
          await admin.get(`/api/admin/users/${temp.id}`),
          'GET temp admin',
        )
        expect(still.roles).toEqual(['admin'])
        expect(still.isActive).toBe(true)
      } finally {
        await own.dispose()
      }
    } finally {
      await removeUsers(admin, [temp.id])
      await admin.dispose()
    }
  })

  test('USR-09 a taken e-mail keeps the create form and shows the API message @api', async ({
    page,
  }, info) => {
    await signIn(page, 'adminPusat')
    await gotoApi(page, '/admin/users/create')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('user-role').selectOption('parent')
    const name = `Ibu Pendua ${stamp(info)}`
    await page.getByTestId('user-name').fill(name)
    await page.getByTestId('user-email').fill('murid4@demo.test')

    const created = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/admin/users' && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Daftar Pengguna' }).click()
    const res = await created
    expect(res.status(), 'a taken e-mail is a validation error').toBe(422)
    const fields = ((await res.json()) as ApiErrorBody).error.fields
    expect(fields?.email, 'the error names the e-mail field').toBeTruthy()

    // The alert shows the field message of the API (the contract copy for a taken e-mail), the input is kept.
    const alert = page.getByTestId('user-form-alert')
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await expect(alert).toContainText(fields!.email!)
    await expect(page).toHaveURL(/\/admin\/users\/create$/)
    await expect(page.getByTestId('user-name'), 'the input is kept').toHaveValue(name)
    await expect(page.getByTestId('generated-credentials')).toHaveCount(0)
    await expectNoHScroll(page)
  })

  test('USR-10 the Admin Sekolah school search list is painted in the flow, not clipped @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    await gotoApi(page, '/admin/users/create')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('user-role').selectOption('school_admin')
    await expect(page.getByTestId('school-admin-generator')).toBeVisible()

    await page.getByTestId('gen-search').fill('Demo')
    const results = page.getByTestId('gen-result')
    await expect(results.first()).toBeVisible({ timeout: 15_000 })
    // The typeahead fills in as the search answers: wait for the four seed schools, do not read the count early.
    await expect
      .poll(() => results.count(), { message: 'the seed schools match "Demo"', timeout: 15_000 })
      .toBeGreaterThanOrEqual(4)
    for (const index of [0, (await results.count()) - 1]) {
      expect(
        await isPainted(results.nth(index)),
        `school result ${index} is not clipped by the form card`,
      ).toBe(true)
    }
    await results.filter({ hasText: 'SK Demo Dua' }).click()
    await expect(page.getByTestId('gen-chosen')).toContainText('SK Demo Dua')
    await expect(page.getByTestId('gen-generate')).toBeVisible()
    await expectNoHScroll(page)
  })

  test('USR-08 the Pakej page of a school admin loads from the API @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    const found = await wireList(page, { search: 'adminsekolah.demo004@example.test' })
    const schoolAdmin = found.data[0]
    expect(schoolAdmin?.roles, 'the seed has a school admin account').toContain('school_admin')
    const packages = page.waitForResponse(
      (r) => new URL(r.url()).pathname === `/api/admin/users/${schoolAdmin!.id}/packages`,
      { timeout: 30_000 },
    )
    await gotoApi(page, `/admin/users/${schoolAdmin!.id}/packages`)
    expect((await packages).status(), 'GET /api/admin/users/:id/packages').toBe(200)
    await expect(page.getByTestId('packages-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('packages-error')).toHaveCount(0)
    await expect(page.getByTestId('packages-school-name')).toBeVisible()
    await expectNoHScroll(page)
  })
})

test.describe('M02 user management role guards @api', () => {
  test.setTimeout(240_000)

  const PATHS = ['/api/admin/users', '/api/admin/users/filters', '/api/admin/comp-students']

  test('USR-07 the APIs answer 401 anonymous and 403 for Guru and Pelajar @api', async ({
    browser,
  }, info) => {
    const anon = await newPeerContext(browser, info)
    try {
      for (const path of PATHS) {
        expect((await anon.request.get(path)).status(), `anonymous GET ${path}`).toBe(401)
      }
    } finally {
      await anon.close()
    }
    for (const role of ['guru', 'student'] as const) {
      const api = await openApiSession(browser, info, role)
      try {
        for (const path of PATHS) {
          expect((await api.get(path)).status, `${role} GET ${path}`).toBe(403)
        }
        const write = await api.send('POST', '/api/admin/users', {
          name: 'Tidak Dibenarkan',
          email: `tiada.${stamp(info)}@example.test`,
          roles: ['teacher'],
        })
        expect(write.status, `${role} POST /api/admin/users`).toBe(403)
      } finally {
        await api.dispose()
      }
    }
  })

  test('USR-07a Admin Sekolah sees only its own school, cannot reach other schools or create an Admin @api', async ({
    browser,
  }, info) => {
    const central = await openApiSession(browser, info, 'adminPusat')
    const school = await openApiSession(browser, info, 'adminSekolah')
    try {
      const own = dataOf<{ school: { id: string } | null }>(
        await school.get('/api/admin/command-center/live-data'),
        'live-data',
      ).school
      expect(own, 'the school admin has a school').toBeTruthy()

      const list = (await school.get('/api/admin/users')).body as UserList
      expect(list.data.length, 'the school has users').toBeGreaterThan(0)
      for (const u of list.data)
        expect(u.school?.id, `${u.email} is of the own school`).toBe(own!.id)
      const filters = dataOf<{ schools: { id: string }[] }>(
        await school.get('/api/admin/users/filters'),
        'filters',
      )
      expect(
        filters.schools.map((s) => s.id),
        'the school filter holds the own school only',
      ).toEqual([own!.id])

      // A user of another school is hidden as 404, never data.
      const all = (await central.get('/api/admin/users?perPage=100')).body as UserList
      const foreign = all.data.find((u) => u.school && u.school.id !== own!.id)
      expect(foreign, 'the seed has users of other schools').toBeTruthy()
      expect((await school.get(`/api/admin/users/${foreign!.id}`)).status).toBe(404)

      // Admin Pusat only: comp-students, creating an Admin, the subscription packages of an account.
      expect((await school.get('/api/admin/comp-students')).status).toBe(403)
      const made = await school.send('POST', '/api/admin/users', {
        name: 'Tidak Dibenarkan',
        email: `tiada.${stamp(info)}@example.test`,
        roles: ['admin'],
      })
      expect(made.status, 'a school admin creating an Admin').toBe(403)
    } finally {
      await school.dispose()
      await central.dispose()
    }
  })

  test('USR-07b Admin Sekolah opening the admin user screens is sent to /admin-sekolah @api', async ({
    page,
  }) => {
    await signIn(page, 'adminSekolah')
    for (const path of [
      '/admin/users',
      '/admin/users/create',
      '/admin/users/bulk-import',
      '/admin/import-students',
      '/admin/comp-students',
    ]) {
      await gotoExpectUrl(page, path, new RegExp(`${HOME.adminSekolah}$`))
      await expect(page.getByTestId('users-page')).toHaveCount(0)
      await expectNoHScroll(page)
    }
  })
})
