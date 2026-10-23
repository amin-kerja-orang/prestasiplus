/**
 * @api SW7-08: the teacher contributes a question WITHOUT an image from "Sumbang Soalan"
 * (`/guru/soalan/cipta`). The SPA used to send `educationLevelId` / `subjectId` as numbers in the JSON
 * body; `QuestionGuruCreateRequestSchema` takes string ids (`idWith`) and the API answered 422
 * ("Sila pilih tahap pendidikan.", "Sila pilih subjek."). Only the multipart path (with an image)
 * worked. Same family as SW5-01. Runs against the REAL API at 375 / 768 / 1280
 * (playwright.http.config.ts). Needs the seeded teacher (school DEMO001) and a seeded level and subject.
 * The new question is removed again (`DELETE /api/guru/questions/:id`) in a `finally`.
 */

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, csrfOf, expectNoHScroll } from './helpers'

test.describe('SW7-08 contribute a question without an image sends string ids @api', () => {
  test.setTimeout(90_000)

  test('Sumbang Soalan: an MCQ without an image posts string ids and answers 201 @api', async ({
    page,
  }) => {
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`)
      void d.dismiss()
    })
    const guru = account('guru')
    await loginViaUi(page, guru.user, guru.pass)

    let createdId: string | undefined
    let createdStatus = 0
    try {
      await page.goto('/guru/soalan/cipta')
      await expect(page.getByTestId('soalan-cipta-page')).toBeVisible()
      await expect(page.getByTestId('question-form')).toBeVisible()

      // Level and subject come from the API: take the first real option of each.
      const level = page.getByTestId('q-level')
      const subject = page.getByTestId('q-subject')
      await expect(level.locator('option:not([value=""])').first()).toBeAttached()
      await expect(subject.locator('option:not([value=""])').first()).toBeAttached()
      const levelValue = await level.locator('option:not([value=""])').first().getAttribute('value')
      const subjectValue = await subject
        .locator('option:not([value=""])')
        .first()
        .getAttribute('value')
      expect(levelValue, 'a level option').toBeTruthy()
      expect(subjectValue, 'a subject option').toBeTruthy()
      await level.selectOption(levelValue!)
      await subject.selectOption(subjectValue!)

      // The type defaults to MCQ ("Aneka Pilihan (MCQ)"); no image is attached.
      await page.getByTestId('q-difficulty').selectOption('easy')
      await page.getByTestId('q-text').fill('Soalan ujian regresi SW7-08: pilih jawapan B.')
      for (const [i, text] of ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'].entries()) {
        await page.getByTestId(`q-option-${String(i)}`).fill(text)
      }
      await page.locator('[data-testid="q-correct"] [role="radio"]').nth(1).click()
      await expectNoHScroll(page)

      const post = page.waitForResponse(
        (r) => /\/api\/guru\/questions$/.test(r.url()) && r.request().method() === 'POST',
      )
      await page.getByTestId('form-submit').click()
      const res = await post
      const body = await res.text()
      createdStatus = res.status()
      try {
        createdId = String(((JSON.parse(body) as { data?: { id?: unknown } }).data ?? {}).id ?? '')
      } catch {
        createdId = undefined
      }

      const sent = res.request().postDataJSON() as {
        educationLevelId: unknown
        subjectId: unknown
      }
      expect(typeof sent.educationLevelId, 'educationLevelId on the wire').toBe('string')
      expect(typeof sent.subjectId, 'subjectId on the wire').toBe('string')
      expect(sent.educationLevelId).toBe(levelValue)
      expect(sent.subjectId).toBe(subjectValue)
      expect(res.status(), `POST /api/guru/questions ${body}`).toBe(201)

      await expect(page.getByText('Soalan berjaya dihantar untuk semakan.')).toBeVisible()
      await expect(page).toHaveURL(/\/guru\/soalan$/)
      await expectNoHScroll(page)
      expect(dialogs).toEqual([])
    } finally {
      // Remove the question again (own question; session cookie + CSRF header, as the app does).
      if (createdId && createdStatus === 201) {
        const del = await page.request.delete(`/api/guru/questions/${createdId}`, {
          headers: { 'x-csrf-token': await csrfOf(page) },
        })
        expect(del.status(), `cleanup DELETE /api/guru/questions/${createdId}`).toBeLessThan(300)
      }
    }
  })
})
