/**
 * @api Latih Tubi (practice) READ paths against the REAL API (BE-32 AC3, slug `e2e-bijak`).
 * Read-only: no session is started. BE-13 practice reads are on origin/feature/v2-backend 2f3b8311
 * (apps/api/src/modules/practice/reads/{overview,analytics}/*.controller.ts and practice.controller.ts).
 *
 * FE: the M05 pages call the shared api client (src/modules/m05-practice/api/practice.ts), so they run
 * in http mode unchanged:
 * - /practice            -> GET /api/practice/subjects         (testid practice-list-page, subject-grid)
 * - /practice/history    -> GET /api/practice/history          (testid history-page)
 * - /practice/progress   -> GET /api/practice/progress         (testid progress-page)
 * Routes are `access: 'auth'` and in the student scope (prototype-scope.ts items 16, Latih Tubi).
 * The page assertions are read from source, not yet run: @provisional until the first stack run.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS).
 */

import type { Page, Response } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

const ok2xx = (r: Response): boolean => r.status() >= 200 && r.status() < 300

/** Opens `path` and resolves with the response of the API call the page makes (matched by URL part). */
async function openAndCapture(page: Page, path: string, apiPart: string): Promise<Response> {
  const wait = page.waitForResponse(
    (r) => r.url().includes(apiPart) && r.request().method() === 'GET',
    {
      timeout: 30_000,
    },
  )
  await page.goto(path)
  return wait
}

test.describe('practice reads @api', () => {
  test.setTimeout(60_000)

  test('murid: the practice read endpoints answer 2xx for the signed-in pupil @api', async ({
    page,
  }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)

    const paths = [
      '/api/practice/subjects',
      '/api/practice/progress',
      '/api/practice/history',
      '/api/practice/mastery',
      '/api/practice/revision',
      '/api/practice/corrections',
      '/api/practice/chapter-subjects',
      '/api/practice/sessions?modes=random,chapter,revision',
    ]
    for (const p of paths) {
      const res = await page.request.get(p)
      expect(res.status(), `GET ${p}`).toBeLessThan(300)
      expect(res.status(), `GET ${p}`).toBeGreaterThanOrEqual(200)
    }
    const subjects = (await (await page.request.get('/api/practice/subjects')).json()) as {
      data: unknown
    }
    expect(subjects.data, 'subjects envelope has data').toBeDefined()
  })

  test('murid: /practice lists the subjects from GET /api/practice/subjects @api @provisional', async ({
    page,
  }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)

    const res = await openAndCapture(page, '/practice', '/api/practice/subjects')
    expect(ok2xx(res), `GET /api/practice/subjects -> ${res.status()}`).toBe(true)
    await expect(page.getByTestId('practice-list-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-ds=load-error]')).toHaveCount(0)
    await expect(page.getByTestId('subject-grid')).toBeVisible()
    await expectNoHScroll(page)
  })

  test('murid: /practice/history renders from GET /api/practice/history (list or empty state) @api @provisional', async ({
    page,
  }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)

    const res = await openAndCapture(page, '/practice/history', '/api/practice/history')
    expect(ok2xx(res), `GET /api/practice/history -> ${res.status()}`).toBe(true)
    await expect(page.getByTestId('history-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-ds=load-error]')).toHaveCount(0)
    // Exactly one of the list or the empty state.
    await expect
      .poll(
        async () =>
          (await page.getByTestId('history-list').count()) +
          (await page.getByTestId('history-empty').count()),
      )
      .toBe(1)
    await expectNoHScroll(page)
  })

  test('murid: /practice/progress renders from GET /api/practice/progress @api @provisional', async ({
    page,
  }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)

    const res = await openAndCapture(page, '/practice/progress', '/api/practice/progress')
    expect(ok2xx(res), `GET /api/practice/progress -> ${res.status()}`).toBe(true)
    await expect(page.getByTestId('progress-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-ds=load-error]')).toHaveCount(0)
    await expectNoHScroll(page)
  })
})
