/**
 * @api D-12b / SW7-01 (LEAD decision 6371548446 item 3): a teacher-created class belongs to the teacher's own
 * school. In http mode S5 "Cipta Kelas" opens with the teacher's own school already chosen (DV-M10-40), so a
 * class created without touching "Pilih Sekolah" is sent with a string `schoolId` and is listed in the school
 * admin's "Kelas Sekolah". Since DV-M10-49 the school is fixed: the picker has no search and no clear button,
 * so every class the teacher creates carries the own school. Pinned at 375 / 768 / 1280.
 *
 * Env: E2E_DEMO_PASSWORD (or the BIJAK_<ROLE>_PASS variables). Seed: PoC (teacher and school admin of
 * "SMK Demo Satu").
 *
 * Data: each run creates 1 class per project ("D12b …", unique names) and cannot remove them (the teacher
 * API has no class delete). It relies on the periodic reseed: run it only against a local or seed stack.
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, newPeerContext } from './helpers'

const SCHOOL = 'SMK Demo Satu'

async function createClass(
  page: Page,
  name: string,
): Promise<{ sent: Record<string, unknown>; storedSchoolId: unknown }> {
  await page.goto('/guru/kelas/cipta')
  await expect(page.getByTestId('kelas-create-page')).toBeVisible()
  // The teacher's own school is preselected (DV-M10-40) and fixed: no search, no clear (DV-M10-49).
  await expect(page.getByTestId('school-selected-name')).toContainText(SCHOOL)
  await expect(page.getByTestId('school-search')).toHaveCount(0)
  await expect(page.getByTestId('school-clear')).toHaveCount(0)
  const subject = page.getByTestId('kelas-subject')
  await expect(subject.locator('option').filter({ hasText: /^\s*Matematik\s*$/ })).toHaveCount(1)
  await page.getByTestId('kelas-name').fill(name)
  await subject.selectOption({ label: 'Matematik' })
  await page.getByTestId('kelas-levels').getByRole('radio', { name: 'Ting. 4' }).click()
  await expectNoHScroll(page)

  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/guru/classes') && r.request().method() === 'POST',
  )
  await page.getByTestId('kelas-submit').click()
  const res = await created
  expect(res.status(), `POST /api/guru/classes ${await res.text()}`).toBe(201)
  const stored = ((await res.json()) as { data: { schoolId: unknown } }).data.schoolId
  await expect(page).toHaveURL(/\/guru\/kelas$/)
  return { sent: res.request().postDataJSON() as Record<string, unknown>, storedSchoolId: stored }
}

test.describe('D-12b class school @api', () => {
  test.setTimeout(120_000)

  test("a class gets the teacher's own school by default and shows in Kelas Sekolah @api", async ({
    page,
    browser,
  }, info) => {
    const guru = account('guru')
    await loginViaUi(page, guru.user, guru.pass)
    const stamp = `${info.project.name} ${String(Date.now()).slice(-6)}`
    const withSchool = `D12b sekolah ${stamp}`

    const own = await createClass(page, withSchool)
    expect(typeof own.sent.schoolId, 'schoolId on the wire').toBe('string')
    expect(own.storedSchoolId).toBe(own.sent.schoolId)

    const peer = await newPeerContext(browser, info)
    try {
      const adminPage = await peer.newPage()
      const admin = account('adminSekolah')
      await loginViaUi(adminPage, admin.user, admin.pass)
      {
        const name = withSchool
        const list = adminPage.waitForResponse(
          (r) => r.url().includes('/api/admin-sekolah/kelas') && r.request().method() === 'GET',
        )
        await adminPage.goto(`/admin-sekolah/kelas?search=${encodeURIComponent(name)}`)
        expect((await list).status()).toBe(200)
        await expect(adminPage.getByTestId('kl-page')).toBeVisible()
        await expect(adminPage.getByTestId('kl-loading')).toHaveCount(0)
        await expect(adminPage.getByTestId('kl-page')).toContainText(name)
        await expectNoHScroll(adminPage)
      }
    } finally {
      await peer.close()
    }
  })
})
