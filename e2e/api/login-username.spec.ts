/**
 * @api specs for AM2-A1b (DV-25): the login field takes an e-mail OR a roster username.
 *   npm run stack:up && npm run test:e2e:http -- --grep @api
 * Seed (poc): `murid04` exists once (SMK Demo Satu), `murid01` exists in two schools with the same
 * password, so a login by that username alone is ambiguous (422 AMBIGUOUS_USERNAME). The password is
 * `E2E_DEMO_PASSWORD` when set (staging), else the local seed password from the fixture.
 */

import { API_PASSWORD, currentSession, expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { expectNoHScroll, HOME } from './helpers'

const PASSWORD = process.env.E2E_DEMO_PASSWORD || API_PASSWORD

test.describe('login by username @api', () => {
  // bcrypt on the real API makes a login take several seconds on a busy machine.
  test.setTimeout(60_000)

  test('the identifier field is a text field, not an e-mail field @api', async ({ page }) => {
    await gotoApi(page, '/login')
    const field = page.getByTestId('login-form').getByLabel('Alamat Email / Nama Pengguna')
    await expect(field).toHaveAttribute('type', 'text')
    await expect(field).toHaveAttribute('autocomplete', 'username')
    await expect(field).toHaveAttribute('required', '')
    await expectNoHScroll(page)
  })

  test('a pupil with a unique username signs in and lands on /dashboard @api', async ({
    page,
  }) => {
    await loginViaUi(page, 'murid04', PASSWORD)
    expect(new URL(page.url()).pathname).toBe(HOME.student)
    const session = await currentSession(page)
    expect(session.active.role).toBe('student')
    expect(session.user.email).toBe('murid4@demo.test')
  })

  test('an ambiguous username shows the server message and stays on /login @api', async ({
    page,
  }) => {
    await gotoApi(page, '/login')
    const form = page.getByTestId('login-form')
    await form.getByLabel('Alamat Email / Nama Pengguna').fill('murid01')
    await form.getByLabel('Kata Laluan').fill(PASSWORD)
    const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'), {
      timeout: 30_000,
    })
    await form.getByRole('button', { name: 'Log Masuk' }).click()
    expect((await response).status(), 'POST /api/auth/login').toBe(422)
    await expect(page.getByTestId('login-alert')).toHaveText(
      'Nama pengguna ini wujud di lebih daripada satu sekolah. Sila pilih sekolah anda.',
      { timeout: 20_000 },
    )
    await expect(page).toHaveURL(/\/login/)
    // The typed username is kept; the password is cleared.
    await expect(form.getByLabel('Alamat Email / Nama Pengguna')).toHaveValue('murid01')
    await expect(form.getByLabel('Kata Laluan')).toHaveValue('')
  })
})
