/**
 * S2-T05 against the real stack: Quick Edit saves a live single-leaf MCQ as a new draft while the live version keeps
 * serving (FR-ADM-Q24.3, AC-ADM-Q24.2), a multi-part question is out of scope, and `pratonton` goes to the Studio.
 *
 *   BASE_URL=http://localhost:5192 E2E_DEMO_PASSWORD=<demo password> \
 *     npx playwright test -c playwright.http.config.ts e2e/m04-question-bank/quick-edit-http.spec.ts
 *
 * Writes: one question, approved through the API, then edited; it is archived at the end.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { expectNoHorizontalScrollHttp, HTTP_MODE } from '../bijak/bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from '../bijak/http-creds'

const { user: ADMIN_USER, pass: ADMIN_PASS } = demoCreds('adminPusat')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!ADMIN_USER || !ADMIN_PASS, NEEDS_PASSWORD)

const data = async <T>(page: Page, path: string): Promise<T> =>
  ((await (await page.request.get(path)).json()) as { data: T }).data

async function login(page: Page): Promise<string> {
  const res = await page.request.post('/api/auth/login', { data: { identifier: ADMIN_USER, password: ADMIN_PASS } })
  expect(res.ok()).toBe(true)
  return (await data<{ csrf: string }>(page, '/api/session')).csrf
}

/** A question through the same API a form uses. */
async function makeQuestion(page: Page, csrf: string, token: string, extra: object = {}): Promise<{ id: string; subjectId: string; levelId: string }> {
  const subjects = await data<{ id: string }[]>(page, '/api/subjects')
  const levels = await data<{ id: string; name: string }[]>(page, '/api/education-levels')
  const subjectId = String(subjects[0]?.id)
  const levelId = String(levels.find((l) => l.name === 'Tingkatan 4')?.id)
  const res = await page.request.post('/api/questions', {
    headers: { 'x-csrf-token': csrf },
    data: {
      subjectId,
      educationLevelId: levelId,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: `Soalan ${token} untuk suntingan pantas.`,
      options: ['Satu', 'Dua', 'Tiga', 'Empat'],
      correctAnswer: 1,
      ...extra,
    },
  })
  expect(res.status(), await res.text()).toBe(201)
  return { id: String(((await res.json()) as { data: { id: string } }).data.id), subjectId, levelId }
}

test.describe('R1-ADM-Q-24 Quick Edit @api', () => {
  test('a draft saves in place, with no page scroll, and the option reaches the API @api', async ({ page }) => {
    const csrf = await login(page)
    const token = `QE${String(Date.now())}`
    const q = await makeQuestion(page, csrf, token)
    await page.goto(`/admin/spm/soalan/${q.id}/sunting`)
    await expect(page.getByTestId('edit-stem')).toHaveValue(new RegExp(token))
    await expectNoHorizontalScrollHttp(page)
    await page.getByTestId('edit-option-C').fill(`Tiga ${token}`)
    await page.getByTestId('edit-submit').click()
    await expect(page.getByText('Soalan dikemas kini.')).toBeVisible()
    const back = await data<{ status: string; parts: { options: { body: { ms: string } }[] }[] }>(page, `/api/questions/${q.id}`)
    expect(back.status).toBe('draft')
    expect(back.parts[0]?.options[2]?.body.ms).toBe(`Tiga ${token}`)
  })

  test('an empty option is named and Simpan stays off @api', async ({ page }) => {
    const csrf = await login(page)
    const q = await makeQuestion(page, csrf, `QF${String(Date.now())}`)
    await page.goto(`/admin/spm/soalan/${q.id}/sunting`)
    await page.getByTestId('edit-option-A').fill('')
    await expect(page.getByTestId('edit-gate')).toContainText('Pilihan A tidak boleh kosong.')
    await expect(page.getByTestId('edit-submit')).toBeDisabled()
  })

  test('the preview path goes to the Studio @api', async ({ page }) => {
    const csrf = await login(page)
    const q = await makeQuestion(page, csrf, `QP${String(Date.now())}`)
    await page.goto(`/admin/spm/soalan/${q.id}/pratonton`)
    await expect(page).toHaveURL(new RegExp(`/admin/studio/questions/${q.id}/sunting`))
  })
})
