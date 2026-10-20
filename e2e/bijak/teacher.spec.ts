/**
 * Bijak SPM, Guru: no Bijak screen (D43, AC-01.4): a direct Bijak route is the in-place 403.
 */
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { FORBIDDEN_TITLE } from './bijak-flow'

test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

test.describe('Bijak SPM Guru @bijak', () => {
  for (const path of ['/spm/bijak', '/spm/bijak/kertas/mat-k1-2025-a', '/spm/bijak/sejarah']) {
    test(`teacher gets 403 on ${path} @bijak`, async ({ page, loginAs, gotoApp }) => {
      await loginAs('guru@demo.test')
      await gotoApp(path)
      await expect(page).toHaveTitle(FORBIDDEN_TITLE)
      await expect(page.getByRole('main').getByText('403', { exact: true })).toBeVisible()
      expect(new URL(page.url()).pathname).toBe(path)
      await expect(page.getByTestId('bijak-hub')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    })
  }

  test.fixme('teacher sees a student Bijak attempt result in a Guru module @bijak', () => {
    // No mock Guru view (Prestasi, Analitik, Analisa Item, Monitoring) is fed by Bijak attempts:
    // v2-bijak-spm US-33 is a data contract only, not wired in the mock. Do not invent one.
  })
})
