/**
 * @api Bijak SPM structured answers against the REAL API (AZ-17, #78 78-09). A Kertas 2 paper of the
 * PoC seed is opened and started; its leaf parts render through `PartInput.vue`. Every leaf kind the
 * server sends is a `BijakAttemptLeafKind` (the PKSK leaf `pksk_choice` is never served to Bijak), so
 * no part may show the "not yet available" notice unless the paper really has a `table_fill` leaf.
 *
 * Starting the attempt writes one in-progress attempt for the seed pupil (the other Bijak specs take
 * "Mula Semula" when they find it). Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_PASS).
 */

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

test.describe('Bijak structured parts @api', () => {
  test.setTimeout(90_000)

  test('a Kertas 2 attempt renders every served leaf kind with its own control @api', async ({ page }) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)

    const papersRes = page.waitForResponse(
      (r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/bijak/papers',
      { timeout: 30_000 },
    )
    await page.goto('/spm/bijak')
    const papers = ((await (await papersRes).json()) as { data: { id: string; kertas: number }[] }).data
    const k2 = papers.find((p) => p.kertas === 2)
    expect(k2, 'a Kertas 2 paper in the seed').toBeDefined()
    await expect(page.getByTestId('bijak-hub')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId(`open-${k2!.id}`).click()
    await expect(page.getByTestId('bijak-cover')).toBeVisible({ timeout: 20_000 })
    await expectNoHScroll(page)

    const started = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/bijak/attempts',
      { timeout: 30_000 },
    )
    if (await page.getByTestId('resume-choice').isVisible()) {
      await page.getByTestId('restart').click()
      await page.getByTestId('confirm-restart').click()
    } else {
      await page.locator('[data-ds=hero-cta]').click()
    }
    const res = await started
    expect(res.status(), 'POST /api/bijak/attempts').toBeLessThan(300)
    const body = await res.text()
    expect(body, 'the attempt never carries the PKSK leaf mode').not.toContain('pksk_choice')
    const hasTableFill = /"kind":"table_fill"/.test(body)

    await expect(page.getByTestId('attempt-shell')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('attempt-loading')).toHaveCount(0)
    const parts = page.locator('[data-testid^=part-input-]')
    await expect(parts.first(), 'the first question has leaf parts').toBeVisible({ timeout: 20_000 })
    if (!hasTableFill) await expect(page.getByTestId('kind-unavailable')).toHaveCount(0)
    for (const part of await parts.all()) {
      if (!(await part.isVisible())) continue
      const controls = part.locator('textarea, input, button, [contenteditable=true], math-field')
      const notice = part.getByTestId('kind-unavailable')
      expect((await controls.count()) + (await notice.count()), 'a control or the notice').toBeGreaterThan(0)
    }
    await expectNoHScroll(page)
  })
})
