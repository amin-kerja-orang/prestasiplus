/**
 * @api Bijak attempt ownership against the REAL API (BE-32 AC3, slug `e2e-bijak`).
 *
 * WRITES ONE ROW: pupil A (`pelajar@demo.test`) starts a `latihan` (untimed) attempt on
 * `BIJAK_PAPER_ID` when set, else the first published paper. The spec leaves it UNSENT (in progress): a later start by A on the same paper
 * returns this same attempt, so reruns do not pile up rows (POST /api/bijak/attempts without
 * `restart` returns the open attempt, 200 instead of 201). Pupil B (`murid4@demo.test`, a second
 * pupil of school DEMO001) only reads.
 *
 * API rule (apps/api/src/modules/bijak/attempts/attempts.service.ts `owned`): another user's attempt
 * is 403 FORBIDDEN "Akses ditolak" (D54b), an unknown id is 404. Controller is `@Roles('student')`.
 * UI (src/modules/m28-bijak-spm/pages/AttemptPage.vue): a 403 or a 404 sets `refused` and renders
 * `attempt-not-found` "Percubaan ini tidak dijumpai." with no exam shell (no position, map, options or
 * submit). Run green against a local API at 375/768/1280.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS / BIJAK_STUDENT_B_PASS; B defaults to A's password).
 */

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, csrfOf, expectNoHScroll, newPeerContext } from './helpers'

interface PaperRow {
  id: string
  status: string
}

test.describe('bijak attempt ownership @api', () => {
  test.setTimeout(90_000)

  test('pupil B cannot read pupil A attempt: API 403, UI refusal without data @api', async ({
    page,
    browser,
  }, testInfo) => {
    // Pupil A starts (or re-opens) an attempt.
    const a = account('student')
    await loginViaUi(page, a.user, a.pass)
    const papersRes = await page.request.get('/api/bijak/papers')
    expect(papersRes.status(), 'GET /api/bijak/papers').toBe(200)
    const papers = ((await papersRes.json()) as { data: PaperRow[] }).data
    test.skip(papers.length === 0, 'no published Bijak paper on this stack')
    // BIJAK_PAPER_ID (CI: the bank demo paper) like the other Bijak http specs; the first paper is a PoC
    // paper on a seeded stack, which is not playable without PoC questions (R1-B07 / T36).
    const paperId = process.env.BIJAK_PAPER_ID || papers[0]!.id

    const start = await page.request.post('/api/bijak/attempts', {
      data: { paperId, mode: 'latihan' },
      headers: { 'x-csrf-token': await csrfOf(page) },
    })
    expect([200, 201], 'POST /api/bijak/attempts').toContain(start.status())
    const attemptId = ((await start.json()) as { data: { attemptId: string } }).data.attemptId
    expect(attemptId).toBeTruthy()

    // A can read it (control).
    expect((await page.request.get(`/api/bijak/attempts/${attemptId}`)).status()).toBe(200)

    // Pupil B, own context.
    const peer = await newPeerContext(browser, testInfo)
    try {
      const pageB = await peer.newPage()
      const b = account('studentB')
      await loginViaUi(pageB, b.user, b.pass)

      // API: foreign attempt is 403 (view, result, answers).
      const view = await pageB.request.get(`/api/bijak/attempts/${attemptId}`)
      expect(view.status(), 'GET /api/bijak/attempts/:id as B').toBe(403)
      expect(JSON.stringify(await view.json())).not.toContain('"questions"')
      expect((await pageB.request.get(`/api/bijak/attempts/${attemptId}/result`)).status()).toBe(
        403,
      )
      const put = await pageB.request.put(`/api/bijak/attempts/${attemptId}/answers`, {
        data: { answers: {} },
        headers: { 'x-csrf-token': await csrfOf(pageB) },
      })
      expect([403, 400, 422], 'PUT answers as B must not succeed').toContain(put.status())
      expect(put.status()).not.toBe(200)

      // UI: the attempt page shows the app's refusal and none of A's data.
      await pageB.goto(`/spm/bijak/percubaan/${attemptId}`)
      await expect(pageB.getByTestId('attempt-not-found')).toBeVisible({ timeout: 20_000 })
      await expect(pageB.getByText('Percubaan ini tidak dijumpai.')).toBeVisible()
      // The refused state renders no exam shell content. Assert none of A's data is shown: no
      // question position/map, no answer options, no way to submit.
      await expect(pageB.getByTestId('position')).toHaveCount(0)
      await expect(pageB.getByTestId('open-map')).toHaveCount(0)
      await expect(pageB.locator('[data-testid^=option-]')).toHaveCount(0)
      await expect(pageB.getByTestId('submit')).toHaveCount(0)
      // The server must refuse a direct submit regardless of the UI.
      const submitB = await pageB.request.post(`/api/bijak/attempts/${attemptId}/submit`, {
        headers: { 'x-csrf-token': await csrfOf(pageB) },
        data: { idempotencyKey: `s3-foreign-${Date.now()}`, changes: [] },
      })
      expect(submitB.status(), 'B submitting A attempt').toBe(403)
      await expectNoHScroll(pageB)
    } finally {
      await peer.close()
    }

    // A's attempt is still in progress and readable (B changed nothing).
    expect((await page.request.get(`/api/bijak/attempts/${attemptId}`)).status()).toBe(200)
  })
})
