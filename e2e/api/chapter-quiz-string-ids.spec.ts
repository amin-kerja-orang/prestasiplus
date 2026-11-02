/**
 * @api REQ-B-109: "Soalan by Chapter" starts over the REAL API. The http API sends chapter ids as strings
 * (contract `IdSchema`) while the route param is digits, so the page used to find no chapter, raise the global
 * 404 and never start the session. Runs at 375 / 768 / 1280 (playwright.http.config.ts).
 *
 * The pupil opens the quiz URL of the first seeded chapter that has questions: the session starts (2xx on
 * POST /api/practice/sessions, no 404 page, no browser dialog) and the first question shows. A second flow goes
 * the way a pupil does: S5 chapter list, the level select, a chapter's count link, answer to the results.
 * Needs the chapter-linked questions of the e2e seed (apps/api/prisma/seed/e2e.ts `linkPracticeChapters`).
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS).
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

interface Wire<T> {
  data: T
}
interface SubjectCard {
  code: string
  questionCount: number
}
interface SubjectDetail {
  levels: { id: string; name: string }[]
  levelId: string | null
  chapters: { id: string; total: number }[]
}

/** The first chapter (any level) of a subject that has questions, read from the API like the page does. */
async function firstChapterWithQuestions(
  page: Page,
): Promise<{ code: string; id: string; levelId: string } | null> {
  const subjects = (await (await page.request.get('/api/practice/chapter-subjects')).json()) as Wire<SubjectCard[]>
  for (const s of subjects.data.filter((x) => x.questionCount > 0)) {
    const url = `/api/practice/chapter-subjects/${encodeURIComponent(s.code)}`
    const first = (await (await page.request.get(url)).json()) as Wire<SubjectDetail>
    const details = [first.data]
    for (const l of first.data.levels) {
      if (l.id === first.data.levelId) continue
      details.push(((await (await page.request.get(`${url}?levelId=${l.id}`)).json()) as Wire<SubjectDetail>).data)
    }
    for (const d of details) {
      const hit = d.chapters.find((c) => c.total > 0)
      if (hit && d.levelId) return { code: s.code, id: hit.id, levelId: d.levelId }
    }
  }
  return null
}

test.describe('REQ-B-109 chapter quiz string ids @api', () => {
  test.setTimeout(90_000)

  test('murid: the chapter quiz starts and shows a question, not the 404 page @api', async ({ page }) => {
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`)
      void d.dismiss()
    })
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)

    const chapter = await firstChapterWithQuestions(page)
    expect(chapter, 'a seeded chapter with questions').not.toBeNull()
    const start = page.waitForResponse(
      (r) => r.url().includes('/api/practice/sessions') && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    await page.goto(`/practice/chapter/${encodeURIComponent(chapter?.code ?? '')}/${chapter?.id ?? ''}/quiz?count=5`)
    const res = await start
    expect(res.status(), 'POST /api/practice/sessions').toBeLessThan(300)
    await expect(page.getByTestId('quiz-question')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('quiz-title')).toContainText('Bab')
    await expectNoHScroll(page)
    expect(dialogs).toEqual([])
  })

  test('murid: chapter list, level select, chapter quiz to the results @api', async ({ page }) => {
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`)
      void d.dismiss()
    })
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)
    const chapter = await firstChapterWithQuestions(page)
    expect(chapter, 'a seeded chapter with questions').not.toBeNull()

    await page.goto(`/practice/chapter/${encodeURIComponent(chapter?.code ?? '')}`)
    await expect(page.getByTestId('chapter-subject-page')).toBeVisible()
    await expect(page.getByTestId('chapter-list')).toBeVisible()
    // The level select changes the level in the URL (the level ids are strings on the API).
    const select = page.getByTestId('chapter-level-select')
    await select.click()
    const options = page.getByRole('option')
    await expect(options.nth(1)).toBeVisible()
    await options.nth(1).click()
    await expect(page).toHaveURL(/[?&]level=\d+/)
    await expect(page.getByTestId('chapter-subject-page')).toBeVisible()
    await expectNoHScroll(page)

    // Back on the level of the chapter found through the API; its smallest count link starts the quiz.
    await page.goto(`/practice/chapter/${encodeURIComponent(chapter?.code ?? '')}?level=${chapter?.levelId ?? ''}`)
    const link = page.locator(`[data-testid^=chapter-count-${chapter?.id ?? ''}-]`).first()
    await expect(link).toBeVisible()
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/api/practice/sessions') && r.request().method() === 'POST',
    )
    await link.click()
    const res = await started
    expect(res.status(), `POST /api/practice/sessions ${await res.text()}`).toBe(201)
    await expect(page.getByTestId('quiz-question')).toBeVisible()
    for (let i = 0; i < 30 && !(await page.getByTestId('quiz-results').isVisible()); i += 1) {
      await page.getByTestId('option-A').click()
      await page.getByTestId('btn-check').click()
      await page.getByTestId('btn-next').click()
    }
    await expect(page.getByTestId('quiz-results')).toBeVisible()
    await expectNoHScroll(page)
    expect(dialogs).toEqual([])
  })
})
