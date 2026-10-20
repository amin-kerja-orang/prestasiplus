/**
 * @api Bijak attempt ownership against the REAL API (BE-32 AC3, slug `e2e-bijak`).
 *
 * WRITES ONE ROW: pupil A (`pelajar@demo.test`) starts a `latihan` (untimed) attempt on the first
 * published paper. The spec leaves it UNSENT (in progress): a later start by A on the same paper
 * returns this same attempt, so reruns do not pile up rows (POST /api/bijak/attempts without
 * `restart` returns the open attempt, 200 instead of 201). Pupil B (`murid4@demo.test`, a second
 * pupil of school DEMO001) only reads.
 *
 * API rule (apps/api/src/modules/bijak/attempts/attempts.service.ts `owned`): another user's attempt
 * is 403 FORBIDDEN "Akses ditolak" (D54b), an unknown id is 404. Controller is `@Roles('student')`.
 * UI (src/modules/m28-bijak-spm/pages/AttemptPage.vue): a failed load shows `DsLoadError`
 * ([data-ds=load-error]) "Percubaan tidak dapat dimuatkan." (only a 404 says "tidak ditemui") and no
 * attempt shell. The UI text is read from source, not yet run: that part is @provisional.
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

  test('pupil B cannot read pupil A attempt: API 403, UI refusal without data @api @provisional', async ({
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
    const paperId = papers[0]!.id

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
      await expect(pageB.locator('[data-ds=load-error]')).toBeVisible({ timeout: 20_000 })
      await expect(pageB.getByText('Percubaan tidak dapat dimuatkan.')).toBeVisible()
      // The load-error sits inside the attempt shell, whose chrome (footer nav, save status) still
      // renders. Assert on A's data instead: no question count, no answer options, no way to submit.
      for (const id of ['position', 'open-map']) {
        for (const el of await pageB.getByTestId(id).all()) {
          await expect(el).toHaveText(/\b0\s*\/\s*0\b/)
        }
      }
      await expect(pageB.locator('[data-testid^=option-]')).toHaveCount(0)
      // The shell's Hantar stays enabled on the error (Low UX finding for d4); the server must refuse it.
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
