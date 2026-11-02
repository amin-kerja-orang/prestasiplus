/**
 * @api M07 admin writes on the REAL API, where `idInput` takes a decimal string and refuses a number:
 * "Sila pilih domain." and "Pengguna tidak dijumpai." were shown for valid choices. Runs at 375 / 768 /
 * 1280 (playwright.http.config.ts). The seed has no PKSK question, so the spec creates its own through the
 * form and removes it again; the access row it grants is revoked again.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_ADMIN_PUSAT_PASS).
 */

import type { Page } from '@playwright/test'

import { currentSession, expect, loginViaUi, test } from '../fixtures/api'
import { account, csrfOf, expectNoHScroll } from './helpers'

function recordDialogs(page: Page): string[] {
  const seen: string[] = []
  page.on('dialog', (d) => {
    seen.push(`${d.type()}: ${d.message()}`)
    void d.dismiss()
  })
  return seen
}

const writeTo = (page: Page, path: RegExp, method: string) =>
  page.waitForResponse((r) => path.test(new URL(r.url()).pathname) && r.request().method() === method)

test.describe('PKSK admin writes with string ids @api', () => {
  test.setTimeout(120_000)

  test('a question is created, edited and bulk-rejected through the pages @api', async ({
    page,
  }, info) => {
    const dialogs = recordDialogs(page)
    const admin = account('adminPusat')
    await loginViaUi(page, admin.user, admin.pass)
    const text = `E2E PKSK ${info.project.name} ${String(Date.now()).slice(-6)}`
    let questionId: string | undefined

    try {
      await page.goto('/admin/pksk/questions/create')
      await expect(page.getByTestId('pksk-question-form')).toBeVisible()
      await page.getByTestId('q-bahagian').selectOption('B')
      const domain = page.getByTestId('q-domain')
      const domainValue = await domain.locator('option:not([value=""])').first().getAttribute('value')
      await domain.selectOption(domainValue!)
      await page.getByTestId('q-text').fill(text)
      const options = page.getByTestId('option-text')
      for (let i = 0; i < 4; i++) await options.nth(i).fill(`Pilihan ${String(i + 1)}`)
      await page.getByTestId('option-correct').first().click()
      await expectNoHScroll(page)

      const created = writeTo(page, /\/api\/admin\/pksk-questions$/, 'POST')
      await page.getByTestId('pksk-question-form').locator('button[type=submit]').click()
      const createRes = await created
      expect(createRes.request().postDataJSON()).toMatchObject({ pkskDomainId: domainValue })
      expect(createRes.status(), `POST question ${await createRes.text()}`).toBe(201)
      questionId = ((await createRes.json()) as { data: { id: string } }).data.id
      await expect(page).toHaveURL(/\/admin\/pksk\/questions$/)

      // The edit form pre-fills the domain and saves it back.
      await page.goto(`/admin/pksk/questions/${questionId}/edit`)
      await expect(page.getByTestId('q-domain')).toHaveValue(domainValue!)
      await page.getByTestId('q-text').fill(`${text} (edit)`)
      const updated = writeTo(page, /\/api\/admin\/pksk-questions\/\d+$/, 'PUT')
      await page.getByTestId('pksk-question-form').locator('button[type=submit]').click()
      const updateRes = await updated
      expect(updateRes.request().postDataJSON()).toMatchObject({ pkskDomainId: domainValue })
      expect(updateRes.status(), `PUT question ${await updateRes.text()}`).toBe(200)
      await expect(page).toHaveURL(/\/admin\/pksk\/questions$/)

      // Bulk: the ids come from the list rows.
      await page.goto(`/admin/pksk/questions?search=${encodeURIComponent(text)}`)
      // One row: a table row from 768, a card below it, each with this checkbox.
      const rowBox = page.getByRole('checkbox', { name: 'Pilih baris' })
      await expect(rowBox.first()).toBeVisible()
      await rowBox.first().click()
      await expect(page.getByTestId('bulk-count')).toHaveText('1 dipilih')
      const bulk = writeTo(page, /\/api\/admin\/pksk-questions\/bulk$/, 'POST')
      await page.getByTestId('bulk-reject').click()
      const bulkRes = await bulk
      expect(bulkRes.request().postDataJSON()).toEqual({ action: 'reject', ids: [questionId] })
      expect(bulkRes.status(), `POST bulk ${await bulkRes.text()}`).toBeLessThan(300)
      const saved = await page.request.get(`/api/admin/pksk-questions/${questionId}`)
      expect(((await saved.json()) as { data: { status: string } }).data.status).toBe('rejected')
      expect(dialogs).toEqual([])
    } finally {
      if (questionId) {
        const del = await page.request.delete(`/api/admin/pksk-questions/${questionId}`, {
          headers: { 'x-csrf-token': await csrfOf(page) },
        })
        expect(del.status(), 'cleanup DELETE question').toBeLessThan(300)
      }
    }
  })

  test('access is granted to a user id typed in the form @api', async ({ page }) => {
    const dialogs = recordDialogs(page)
    const admin = account('adminPusat')
    await loginViaUi(page, admin.user, admin.pass)
    const { user } = await currentSession(page)

    await page.goto('/admin/pksk/access')
    await page.getByTestId('grant-toggle').click()
    const pkg = page.getByTestId('grant-package')
    await expect(pkg.locator('option').first()).toBeAttached()
    const packageId = await pkg.inputValue()
    await page.getByTestId('grant-user').fill(user.id)
    await expectNoHScroll(page)

    const granted = writeTo(page, /\/api\/admin\/pksk-access$/, 'POST')
    await page.getByTestId('grant-submit').click()
    const res = await granted
    expect(res.request().postDataJSON()).toEqual({ userId: user.id, packageId, expiresAt: null })
    expect(res.status(), `POST access ${await res.text()}`).toBe(201)
    const accessId = ((await res.json()) as { data: { id: string } }).data.id
    try {
      await expect(page.getByTestId('grant-alert')).toHaveCount(0)
      await expect(page.getByText('Pengguna tidak dijumpai.')).toHaveCount(0)
      expect(dialogs).toEqual([])
    } finally {
      const revoke = await page.request.post(`/api/admin/pksk-access/${accessId}/revoke`, {
        headers: { 'x-csrf-token': await csrfOf(page) },
      })
      expect(revoke.status(), 'cleanup revoke').toBeLessThan(300)
    }
  })
})
