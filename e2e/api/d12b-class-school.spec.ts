/**
 * @api D-12b (AZ-32 rehearsal, report #144 section 7): "a teacher-created class has `schoolId` null, so it
 * is missing from Kelas Sekolah". Not a defect: on S5 "Cipta Kelas" the school is OPTIONAL and is set only
 * through the "Pilih Sekolah" search (URS M10 FN-M10-3.2.2, SRS M10 §5 `school_id` "optional; must exist",
 * OBSERVED on live; the backend keeps it, `classes.service.ts` createClass). The rehearsal created its class
 * through the API without a school. This spec pins the documented path at 375 / 768 / 1280:
 *
 * - a class created WITH the teacher's own school (picked in "Pilih Sekolah") is sent with a string
 *   `schoolId` and is listed in the school admin's "Kelas Sekolah";
 * - a class created WITHOUT a school is sent without `schoolId` and is not listed there (as live).
 *
 * Env: E2E_DEMO_PASSWORD (or the BIJAK_<ROLE>_PASS variables). Seed: PoC (teacher and school admin of
 * "SMK Demo Satu").
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, newPeerContext } from './helpers'

const SCHOOL = 'SMK Demo Satu'

async function createClass(page: Page, name: string, pickSchool: boolean): Promise<Record<string, unknown>> {
  await page.goto('/guru/kelas/cipta')
  await expect(page.getByTestId('kelas-create-page')).toBeVisible()
  if (pickSchool) {
    await page.getByTestId('school-search').fill('Demo Satu')
    const result = page.getByTestId('school-result').filter({ hasText: SCHOOL })
    await expect(result).toHaveCount(1)
    await result.click()
    await expect(page.getByTestId('school-selected-name')).toContainText(SCHOOL)
  }
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
  await expect(page).toHaveURL(/\/guru\/kelas$/)
  return res.request().postDataJSON() as Record<string, unknown>
}

test.describe('D-12b class school @api', () => {
  test.setTimeout(120_000)

  test('a class gets the school picked in "Pilih Sekolah" and shows in Kelas Sekolah @api', async ({
    page,
    browser,
  }, info) => {
    const guru = account('guru')
    await loginViaUi(page, guru.user, guru.pass)
    const stamp = `${info.project.name} ${String(Date.now()).slice(-6)}`
    const withSchool = `D12b sekolah ${stamp}`
    const without = `D12b tiada ${stamp}`

    const sentWith = await createClass(page, withSchool, true)
    expect(typeof sentWith.schoolId, 'schoolId on the wire').toBe('string')
    const sentWithout = await createClass(page, without, false)
    expect(sentWithout).not.toHaveProperty('schoolId')

    const peer = await newPeerContext(browser, info)
    try {
      const adminPage = await peer.newPage()
      const admin = account('adminSekolah')
      await loginViaUi(adminPage, admin.user, admin.pass)
      for (const [name, listed] of [
        [withSchool, true],
        [without, false],
      ] as const) {
        const list = adminPage.waitForResponse(
          (r) => r.url().includes('/api/admin-sekolah/kelas') && r.request().method() === 'GET',
        )
        await adminPage.goto(`/admin-sekolah/kelas?search=${encodeURIComponent(name)}`)
        expect((await list).status()).toBe(200)
        await expect(adminPage.getByTestId('kl-page')).toBeVisible()
        await expect(adminPage.getByTestId('kl-loading')).toHaveCount(0)
        if (listed) await expect(adminPage.getByTestId('kl-page')).toContainText(name)
        else await expect(adminPage.getByTestId('kl-page')).not.toContainText(name)
        await expectNoHScroll(adminPage)
      }
    } finally {
      await peer.close()
    }
  })
})
