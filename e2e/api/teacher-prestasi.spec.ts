/**
 * @api Guru opens a pupil's Prestasi 360 against the REAL API (BE-32 AC3, slug `e2e-bijak`). Read-only.
 *
 * Since S10-T01 (#544) src/modules/m08-student-performance/pages/Prestasi360Page.vue renders one layout in
 * both modes (hero, `stat-cards`, trend, ...); the Bijak-only `bijak-summary` section no longer exists.
 *
 * The pupil id is found through the API, not hard-coded: GET /api/performance/classes (the teacher's
 * own classes, e.g. DEMO4M MATH), then GET /api/performance/classes/:id whose `ranking`/`attention`
 * rows carry `userId` (apps/api/src/modules/reports/performance/http/performance.controllers.ts).
 * The route is `/prestasi/:userId(\d+)`: ids are decimal strings (contract ids.ts).
 * Selectors are read from source, not yet run: @provisional until the first stack run.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_GURU_PASS).
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

interface ClassCard {
  id: number | string
  students?: number
}
interface ClassDash {
  ranking?: { userId: number | string }[]
  attention?: { userId: number | string }[]
}

/** First pupil id of the teacher's own classes, or null when there is none. */
async function findPupilId(page: Page): Promise<string | null> {
  const list = await page.request.get('/api/performance/classes')
  expect(list.status(), 'GET /api/performance/classes').toBe(200)
  const body = ((await list.json()) as { data: ClassCard[] | { items: ClassCard[] } }).data
  const classes = Array.isArray(body) ? body : body.items
  for (const c of classes) {
    const res = await page.request.get(`/api/performance/classes/${String(c.id)}`)
    expect(res.status(), `GET /api/performance/classes/${String(c.id)}`).toBe(200)
    const dash = ((await res.json()) as { data: ClassDash }).data
    const row = dash.ranking?.[0] ?? dash.attention?.[0]
    if (row) return String(row.userId)
  }
  return null
}

test.describe('guru prestasi 360 @api', () => {
  test.setTimeout(60_000)

  test('guru sees the shared Prestasi 360 layout (hero and stat cards, no Bijak-only section) @api @provisional', async ({
    page,
  }) => {
    const { user, pass } = account('guru')
    await loginViaUi(page, user, pass)

    const pupilId = await findPupilId(page)
    test.skip(pupilId === null, 'the teacher has no pupil in any class on this stack')

    const studentCall = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/performance/students/${pupilId}`) && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await page.goto(`/prestasi/${pupilId}`)
    const res = await studentCall
    expect(res.status(), 'GET /api/performance/students/:userId as teacher').toBe(200)

    await expect(page.getByTestId('prestasi360-page')).toBeVisible({ timeout: 20_000 })
    // S10-T01 (D115): the page is the shared Prestasi 360 layout; the Bijak-only section is gone.
    await expect(page.getByTestId('hero')).toBeVisible()
    await expect(page.getByTestId('stat-cards')).toBeVisible()
    await expect(page.getByTestId('bijak-summary')).toHaveCount(0)
    await expect(page.getByTestId('bijak-empty')).toHaveCount(0)
    await expectNoHScroll(page)
  })
})
