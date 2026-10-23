/**
 * @api AM2-N1: teacher self-registration on `/register` against the REAL API. The server answers 201
 * `{status: 'pending_verification', message}` for a teacher and sets NO session; the SPA must show that
 * message with a link to `/login` (no `pp.auth`, no redirect), and the account must not be able to
 * sign in until a school admin verifies it. Student registration (which returns a session) must still
 * land on `/dashboard`.
 *
 * Also covers the two small fixes in the same page: the school field is "Sekolah" (required) for the
 * teacher role and "Sekolah (Pilihan)" otherwise, and the school-chip clear button sits to the right of
 * the school name. No horizontal page scroll at any step (375 / 768 / 1280 via the three projects).
 *
 * Writes data: one teacher (inactive, left pending) and one student per project and run, with
 * `@demo.test` addresses unique per run. The password is the public local seed password
 * (`API_PASSWORD`, see `fixtures/api.ts`). Names are fictitious.
 */

import type { Page } from '@playwright/test'

import { API_PASSWORD, expect, gotoApi, test } from '../fixtures/api'
import { expectNoHScroll } from './helpers'

const PENDING_MESSAGE =
  'Pendaftaran diterima. Akaun guru anda akan diaktifkan selepas disahkan oleh pentadbir sekolah.'
const SCHOOL_QUERY = 'Demo Satu'

function uniqueEmail(prefix: string, project: string): string {
  return `${prefix}.${project}.${String(Date.now())}@demo.test`
}

async function fillCommon(page: Page, name: string, email: string): Promise<void> {
  await page.getByTestId('register-name').fill(name)
  await page.getByTestId('register-email').fill(email)
  await page.getByTestId('register-password').fill(API_PASSWORD)
  await page.getByTestId('register-password-confirm').fill(API_PASSWORD)
}

async function pickSchool(page: Page): Promise<void> {
  await page.getByTestId('register-school-search').fill(SCHOOL_QUERY)
  await page.getByTestId('school-option').first().click()
  await expect(page.getByTestId('school-chip')).toBeVisible()
}

test.describe('register: teacher pending verification @api', () => {
  test.setTimeout(90_000)

  test('teacher: pending message, no session, login refused @api', async ({ page }, info) => {
    const email = uniqueEmail('cikgu.n1', info.project.name)
    await gotoApi(page, '/register')
    await expectNoHScroll(page)

    // AM2-L1: the school is optional for a student, required for a teacher.
    const label = page.getByTestId('register-school-label')
    await expect(label).toHaveText('Sekolah (Pilihan)')
    await page.getByTestId('role-teacher').click()
    await expect(label).toHaveText('Sekolah')
    await expect(page.getByTestId('register-school-search')).toHaveAttribute('required', '')

    await fillCommon(page, 'Cikgu Contoh Pending', email)
    await pickSchool(page)

    // AM2-L2: the clear button is on the same row as the school name, to its right.
    const nameBox = await page
      .locator('[data-testid=school-chip] .text-label')
      .first()
      .boundingBox()
    const clearBox = await page.getByTestId('school-clear').boundingBox()
    expect(nameBox, 'school name box').not.toBeNull()
    expect(clearBox, 'clear button box').not.toBeNull()
    expect(clearBox!.x).toBeGreaterThan(nameBox!.x + nameBox!.width - 1)
    expect(clearBox!.y).toBeLessThan(nameBox!.y + nameBox!.height)
    expect(clearBox!.y + clearBox!.height).toBeGreaterThan(nameBox!.y)
    await expectNoHScroll(page)

    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/register') && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByTestId('register-submit').click()
    const res = await response
    expect(res.status(), 'POST /api/auth/register').toBe(201)
    expect(((await res.json()) as { data: { status: string } }).data.status).toBe(
      'pending_verification',
    )

    // The pending message replaces the form; no error alert, no redirect.
    const message = page.getByTestId('register-pending-message')
    await expect(message).toBeVisible()
    await expect(message).toContainText(PENDING_MESSAGE)
    await expect(page.getByTestId('register-name')).toHaveCount(0)
    await expect(page.getByTestId('register-submit')).toHaveCount(0)
    await expect(page.getByTestId('register-alert')).toHaveCount(0)
    await expect(page).toHaveURL(/\/register(\?|$)/)
    await expectNoHScroll(page)

    // No session: the API says 401, the browser holds no cookie and no `pp.auth`.
    expect((await page.request.get('/api/session')).status(), 'GET /api/session').toBe(401)
    expect((await page.context().cookies()).find((c) => c.name === 'pp_session')).toBeUndefined()
    expect(await page.evaluate(() => localStorage.getItem('pp.auth'))).toBeNull()

    // The link goes to /login, and the pending account cannot sign in.
    await page.getByTestId('register-login-link').click()
    await expect(page).toHaveURL(/\/login(\?|$)/)
    const form = page.getByTestId('login-form')
    await form.getByLabel('Alamat Email').fill(email)
    await form.getByLabel('Kata Laluan').fill(API_PASSWORD)
    await form.getByRole('button', { name: 'Log Masuk' }).click()
    await expect(page.getByTestId('login-alert')).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveURL(/\/login(\?|$)/)
    expect((await page.request.get('/api/session')).status(), 'GET /api/session').toBe(401)
    expect(await page.evaluate(() => localStorage.getItem('pp.auth'))).toBeNull()
    await expectNoHScroll(page)
  })

  test('student: registration still logs in and lands on /dashboard @api', async ({
    page,
  }, info) => {
    const email = uniqueEmail('murid.n1', info.project.name)
    await gotoApi(page, '/register')
    await fillCommon(page, 'Murid Contoh Baru', email)
    await page.getByTestId('grade-3').click()

    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/register') && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.getByTestId('register-submit').click()
    expect((await response).status(), 'POST /api/auth/register').toBe(201)

    await expect(page).toHaveURL(/\/dashboard(\?|$)/, { timeout: 20_000 })
    await expect(page.getByTestId('register-pending-message')).toHaveCount(0)
    expect((await page.request.get('/api/session')).status(), 'GET /api/session').toBe(200)
    expect(await page.evaluate(() => localStorage.getItem('pp.auth'))).not.toBeNull()
    await expectNoHScroll(page)
  })
})
