/**
 * Bijak SPM, Admin Pusat in Mod Pelajar: the admin opens the learner portal as the demo student
 * from the account menu and runs the student flow. Needs the scope-ON build.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell } from '../support'
import { HTTP_MODE, pickOption, startPaper, submitAttempt } from './bijak-flow'

test.skip(
  HTTP_MODE,
  'mock-only (loginAs init-script session, __mock boot, local mock server): not run when BIJAK_API_BASE is set',
)
test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

async function enterModPelajar(page: Page, gotoApp: (p: string) => Promise<void>): Promise<void> {
  await gotoApp('/admin/command-center')
  // Below 1024 px the account menu sits inside the sidebar drawer.
  if (!isDesktopShell(page)) await page.getByTestId('pentadbiran-menu-button').click()
  await page.locator('[data-testid=pentadbiran-account]:visible').click()
  await page.getByRole('menuitem', { name: 'Masuk Mod Pelajar' }).click()
  await expect(page.getByTestId('mod-pelajar-banner')).toBeVisible()
}

test.describe('Bijak SPM Admin Mod Pelajar @bijak', () => {
  test('Admin Pusat in Mod Pelajar: list, start, answer, submit, result, leave @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await enterModPelajar(page, gotoApp)
    await expectNoHorizontalScroll(page)

    // In-app navigation keeps the parked admin session (a full reload would re-apply loginAs).
    await page.evaluate(() => {
      window.history.pushState({}, '', '/spm/bijak')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page.getByTestId('bijak-hub')).toBeVisible()
    await expect(page.getByTestId('mod-pelajar-banner')).toBeVisible()
    await expectNoHorizontalScroll(page)

    await startPaper(page)
    await pickOption(page, 0)
    await expect(page.getByTestId('save-status')).toHaveText('Disimpan')
    await submitAttempt(page)
    await expect(page.getByTestId('section-score').first()).toBeVisible()

    await page.getByTestId('mod-pelajar-leave').click()
    await expect(page).toHaveURL(/\/admin\/command-center/)
  })

  test.fixme('admin sees student Bijak results through an admin module @bijak', () => {
    // /admin/spm/kertas is the paper admin (Pembina Kertas); no admin module lists student
    // attempts or results in the mock. Only the student history in Mod Pelajar shows them.
  })

  test.fixme('school admin in Mod Pelajar: list, start, submit, result @bijak', () => {
    // v2-bijak-spm roles table (D31c, D33b) lists admin_sekolah for Mod Pelajar, but
    // src/shells/shared/mod-pelajar.ts enterModPelajar() accepts only role 'admin'.
  })
})
