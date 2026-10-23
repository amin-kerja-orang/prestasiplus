/**
 * @api SW5-01: the teacher adds a pupil of the school to an own class from "Pelajar Sekolah". The
 * SPA used to send `{ classroomId: 15 }` (a number); `ClassStudentAddRequestSchema` takes a string id
 * (`IdSchema`) and the API answered 422 "Kelas tidak sah.". Runs against the REAL API at 375 / 768 /
 * 1280 (playwright.http.config.ts). Needs the seeded teacher with at least one own class and one
 * school pupil that is not yet in it (a pupil already in the class has no "Tambah" button).
 */

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

test.describe('SW5-01 add pupil to class sends a string id @api', () => {
  test.setTimeout(90_000)

  test('Pelajar Sekolah: "Tambah" sends classroomId as a string and answers 200 @api', async ({
    page,
  }) => {
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`)
      void d.dismiss()
    })
    const guru = account('guru')
    await loginViaUi(page, guru.user, guru.pass)

    await page.goto('/guru/pelajar')
    await expect(page.getByTestId('pelajar-page')).toBeVisible()
    await page.getByTestId('tab-school').click()
    await expect(page.getByTestId('pelajar-add-bar')).toBeVisible()

    // Pick the first own class (the options come from the API).
    const target = page.getByTestId('pelajar-target')
    await expect(target.locator('option:not([value=""])').first()).toBeAttached()
    const classValue = await target.locator('option:not([value=""])').first().getAttribute('value')
    expect(classValue, 'an own class to add to').toBeTruthy()
    await target.selectOption(classValue!)
    await expectNoHScroll(page)

    const add = page.getByTestId('student-add').and(page.locator(':enabled')).first()
    await expect(add, 'a school pupil that is not yet in the class').toBeVisible()

    const put = page.waitForResponse(
      (r) => /\/api\/guru\/students\/[^/]+$/.test(r.url()) && r.request().method() === 'PUT',
    )
    await add.click()
    const res = await put
    const sent = res.request().postDataJSON() as { classroomId: unknown }
    expect(typeof sent.classroomId, 'classroomId on the wire').toBe('string')
    expect(sent.classroomId).toBe(classValue)
    expect(res.status(), `PUT /api/guru/students/:id ${await res.text()}`).toBe(200)
    await expect(page.getByText('Pelajar berjaya ditambah ke kelas.')).toBeVisible()
    await expectNoHScroll(page)
    expect(dialogs).toEqual([])
  })
})
