/**
 * @api Admin Pusat user create / edit / import / comp-student screens against the REAL API (D-12d, D59b).
 *
 * In http mode the removed `GET /api/admin/config/defaults` is never called, no password field is shown, and
 * the server-generated one-time password (`generatedPassword`) is shown once after a create or a reset. The
 * generated password is only checked for presence: it is never logged or attached.
 *
 * Writes data: the teacher e-mail is unique per run and project. Env: E2E_DEMO_PASSWORD (or BIJAK_ADMIN_PUSAT_PASS).
 */

import { expect, test, type Page, type Request } from '@playwright/test'

import { gotoApi, loginViaUi } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

/** Records every request to the removed defaults route; the list must stay empty. */
function watchDefaults(page: Page): Request[] {
  const hits: Request[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/admin/config/defaults')) hits.push(r)
  })
  return hits
}

async function csrf(page: Page): Promise<string> {
  const res = await page.request.get('/api/session')
  return ((await res.json()) as { data: { csrf: string } }).data.csrf
}

test.describe('admin pusat users D59b @api', () => {
  test.setTimeout(90_000)

  test('creates a teacher, sees a one-time password, edits it keeping the role @api', async ({
    page,
  }, info) => {
    const defaultsHits = watchDefaults(page)
    const { user, pass } = account('adminPusat')
    await loginViaUi(page, user, pass)

    const unique = `${Date.now().toString(36)}${info.project.name}`
    const email = `d12d.${unique}@example.test`

    await gotoApi(page, '/admin/users/create')
    await page.getByTestId('user-role').selectOption('teacher')
    await expect(page.getByTestId('user-password')).toHaveCount(0)
    await expect(page.getByTestId('user-password-confirm')).toHaveCount(0)
    await page.getByTestId('user-name').fill('Guru Ujian D12d')
    await page.getByTestId('user-email').fill(email)
    await expectNoHScroll(page)

    const created = page.waitForResponse(
      (r) => r.url().endsWith('/api/admin/users') && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Daftar Pengguna' }).click()
    const res = await created
    expect(res.status(), 'POST /api/admin/users').toBe(201)
    const sentBody = JSON.parse(res.request().postData() ?? '{}') as Record<string, unknown>
    expect(sentBody.roles).toEqual(['teacher'])
    expect(sentBody).not.toHaveProperty('password')
    const id = ((await res.json()) as { data: { id: string } }).data.id

    await expect(page.getByTestId('generated-credentials')).toBeVisible()
    await expect(page.getByTestId('credential-email')).toHaveText(email)
    expect(
      ((await page.getByTestId('credential-password').textContent()) ?? '').trim().length,
    ).toBeGreaterThan(7)
    await expectNoHScroll(page)

    // Edit: the role stays; there is no password field, only the reset switch.
    await gotoApi(page, `/admin/users/${id}/edit`)
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('user-role')).toHaveValue('teacher')
    await expect(page.getByTestId('user-new-password')).toHaveCount(0)
    await page.getByTestId('user-name').fill('Guru Ujian D12d Baharu')
    await expectNoHScroll(page)
    const updated = page.waitForResponse(
      (r) => r.url().endsWith(`/api/admin/users/${id}`) && r.request().method() === 'PUT',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Kemaskini' }).click()
    expect((await updated).status(), 'PUT /api/admin/users/:id').toBe(200)
    await expect(page).toHaveURL(/\/admin\/users$/, { timeout: 20_000 })

    const after = await page.request.get(`/api/admin/users/${id}`)
    const detail = ((await after.json()) as { data: { roles: string[]; name: string } }).data
    expect(detail.roles).toEqual(['teacher'])
    expect(detail.name).toBe('Guru Ujian D12d Baharu')

    // Reset: the switch asks the server for a new password, shown once.
    await gotoApi(page, `/admin/users/${id}/edit`)
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('user-password-toggle').click()
    await page.getByTestId('user-reset-password').click()
    const reset = page.waitForResponse(
      (r) => r.url().endsWith(`/api/admin/users/${id}`) && r.request().method() === 'PUT',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Kemaskini' }).click()
    const resetRes = await reset
    expect(resetRes.status()).toBe(200)
    expect(JSON.parse(resetRes.request().postData() ?? '{}')).toMatchObject({ resetPassword: true })
    await expect(page.getByTestId('credential-password')).toBeVisible()
    await expectNoHScroll(page)

    // Clean up so a re-run does not pile up accounts.
    await page.request.delete(`/api/admin/users/${id}`, {
      headers: { 'x-csrf-token': await csrf(page) },
    })

    expect(defaultsHits, 'requests to /api/admin/config/defaults').toHaveLength(0)
  })

  test('a multi-role user keeps every role when saved unchanged @api', async ({ page }) => {
    const { user, pass } = account('adminPusat')
    await loginViaUi(page, user, pass)
    const found = await page.request.get('/api/admin/users', {
      params: { search: 'guruadmin@demo.test' },
    })
    const row = ((await found.json()) as { data: { id: string; roles: string[] }[] }).data[0]
    test.skip(!row || row.roles.length < 2, 'the seed has no multi-role guruadmin on this stack')
    const id = row!.id

    await gotoApi(page, `/admin/users/${id}/edit`)
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 20_000 })
    const updated = page.waitForResponse(
      (r) => r.url().endsWith(`/api/admin/users/${id}`) && r.request().method() === 'PUT',
      { timeout: 30_000 },
    )
    await page.getByRole('button', { name: 'Kemaskini' }).click()
    expect((await updated).status(), 'PUT /api/admin/users/:id').toBe(200)

    const after = await page.request.get(`/api/admin/users/${id}`)
    const roles = ((await after.json()) as { data: { roles: string[] } }).data.roles
    expect([...roles].sort()).toEqual([...row!.roles].sort())
  })

  test('bulk import and comp-student screens have no default password and never call the defaults route @api', async ({
    page,
  }) => {
    const defaultsHits = watchDefaults(page)
    const { user, pass } = account('adminPusat')
    await loginViaUi(page, user, pass)

    await gotoApi(page, '/admin/users/bulk-import')
    await expect(page.getByTestId('bulk-form')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('bulk-default-password')).toHaveCount(0)
    await expectNoHScroll(page)

    await gotoApi(page, '/admin/comp-students/create')
    await expect(page.getByTestId('comp-form')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('comp-info-password')).toHaveCount(0)
    await expectNoHScroll(page)

    expect(defaultsHits, 'requests to /api/admin/config/defaults').toHaveLength(0)
  })
})
