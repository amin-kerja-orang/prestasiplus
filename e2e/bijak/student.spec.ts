/**
 * Bijak SPM, Murid: list -> start -> answer -> autosave (indicator + persistence) -> Hantar ->
 * result. Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import { expect, reloadApp, test } from '../fixtures/test'
import { expectNoHorizontalScroll, provisional } from '../support'
import {
  HTTP_MODE,
  openHubFromSpm,
  pickOption,
  pressedOptions,
  startPaper,
  submitAttempt,
} from './bijak-flow'

test.skip(
  HTTP_MODE,
  'mock-only (loginAs init-script session, __mock boot, local mock server): not run when BIJAK_API_BASE is set',
)
test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

test.describe('Bijak SPM Murid @bijak', () => {
  test('list, start, answer, autosave, reload keeps the answer, submit, result @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await openHubFromSpm(page, gotoApp)
    await expect(page.getByTestId('paper-count')).toBeVisible()

    await startPaper(page)
    const attemptUrl = page.url()
    expect(attemptUrl).toContain('/spm/bijak/percubaan/')

    await pickOption(page, 1)
    // Autosave indicator settles on "Disimpan".
    await expect(page.getByTestId('save-status')).toHaveText('Disimpan')
    expect(await pressedOptions(page)).toContain('true')
    const before = await pressedOptions(page)

    // The answer survives a reload (local copy + mock server).
    await reloadApp(page)
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    expect(page.url()).toBe(attemptUrl)
    await expect.poll(() => pressedOptions(page)).toEqual(before)
    await expectNoHorizontalScroll(page)

    // ... and after leaving to the hub and coming back.
    await gotoApp('/spm/bijak')
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByTestId('paper-status').first()).toContainText('Sedang dijawab')
    await gotoApp(new URL(attemptUrl).pathname)
    await expect(page.getByTestId('attempt-shell')).toBeVisible()
    await expect.poll(() => pressedOptions(page)).toEqual(before)

    await submitAttempt(page)
    await expect(page.getByTestId('section-score').first()).toBeVisible()
    await expect(page.getByTestId('home')).toBeVisible()
    await expectNoHorizontalScroll(page)

    // History lists the submitted attempt.
    await gotoApp('/spm/bijak/sejarah')
    await expect(page.getByTestId('history-list')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test(
    'autosave sends no network request in the mock build (local mock server) @bijak',
    provisional(
      'asserts the mock transport: autosave is an in-tab server, no HTTP; revisit when the real API is wired',
    ),
    async ({ page, loginAs, gotoApp }) => {
      const requests: string[] = []
      page.on('request', (r) => {
        if (/\/api\/.*bijak/i.test(r.url())) requests.push(r.url())
      })
      await loginAs('pelajar@demo.test')
      await gotoApp('/spm/bijak')
      await startPaper(page)
      await pickOption(page, 0)
      await expect(page.getByTestId('save-status')).toHaveText('Disimpan')
      expect(requests).toEqual([])
      const keys = await page.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.startsWith('pp.bijak.local.')),
      )
      expect(keys.length).toBeGreaterThan(0)
    },
  )
})
