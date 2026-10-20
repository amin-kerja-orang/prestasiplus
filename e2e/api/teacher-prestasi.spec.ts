/**
 * @api Guru opens a pupil's Prestasi 360 against the REAL API (BE-32 AC3, slug `e2e-bijak`). Read-only.
 *
 * In http mode (src/modules/m08-student-performance/pages/Prestasi360Page.vue) the page shows the
 * section `bijak-summary` titled "Keputusan Bijak SPM" (US-33) holding EITHER `stat-cards` (the pupil has
 * Bijak sittings) OR `bijak-empty` ("Tiada data"), never both.
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

  test('guru sees "Keputusan Bijak SPM" with stat cards or the empty state, never both @api @provisional', async ({
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
    const section = page.getByTestId('bijak-summary')
    await expect(section).toBeVisible()
    await expect(section).toContainText('Keputusan Bijak SPM')

    await expect
      .poll(
        async () =>
          (await section.getByTestId('stat-cards').count()) +
          (await section.getByTestId('bijak-empty').count()),
      )
      .toBe(1)
    if ((await section.getByTestId('bijak-empty').count()) === 1) {
      await expect(section.getByTestId('bijak-empty')).toContainText('Tiada data')
    }
    await expectNoHScroll(page)
  })
})
