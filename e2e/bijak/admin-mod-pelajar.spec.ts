/**
 * Bijak SPM, Admin Pusat in Mod Pelajar: the admin opens the learner portal as the demo student
 * from the account menu and runs the student flow. Needs the scope-ON build.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, isDesktopShell } from '../support'
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
    await expect(page.getByTestId('save-status')).toHaveText('disimpan')
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

// C-52 (f4e47844a, 6bde70acd, e124669fd): an m28 student route is roles ['student'] with modPelajarForAdmin
// (modules/m28-bijak-spm/routes.ts:15-24). The router guard (src/app/router/guards.ts step 2c, wouldEnterModPelajar :113)
// switches a PLAIN admin into Mod Pelajar and lands on the requested URL, query included; school_admin and an admin on a
// route the student cannot open (scope-hidden, e.g. /kertas-subjektif*) get the in-place 403 with no switch.
// NOT RUN: written while local browsers are banned (BSOD rule); selectors read from the source.
test.describe('Bijak SPM student routes for a plain admin (C-52) @bijak', () => {
  for (const path of ['/spm/bijak', '/spm/bijak/sejarah?tab=2', '/simulasi/kuiz?from=e2e']) {
    test(`admin opening ${path} enters Mod Pelajar and stays on the URL`, async ({ page, loginAs, gotoApp }) => {
      await loginAs('admin@demo.test')
      await gotoApp(path)
      await expect(page.getByTestId('mod-pelajar-banner')).toBeVisible()
      const url = new URL(page.url())
      expect(url.pathname + url.search).toBe(path)
      await expect(page.locator('[data-page=forbidden]')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    })
  }

  test('a logged-out admin returns to the /login?redirect= target after login, then switches', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/login?redirect=/spm/bijak/sejarah')
    await page.getByTestId('login-email').fill('admin@demo.test')
    await page.getByTestId('login-password').fill('Demo1234')
    await page.getByTestId('login-submit').click()
    // resolvePostLoginTarget keeps the flagged route for the admin (guards.ts:289-301).
    await expect(page).toHaveURL(/\/spm\/bijak\/sejarah$/)
    await expect(page.getByTestId('mod-pelajar-banner')).toBeVisible()
  })

  test('a school admin on /spm/bijak gets the in-place 403 (no switch)', async ({ page, loginAs, gotoApp }) => {
    await loginAs('adminsekolah@demo.test')
    await gotoApp('/spm/bijak')
    await expect(page.locator('[data-page=forbidden]')).toBeVisible()
    await expectTabTitle(page, 'Akses Ditolak | PRESTASIPLUS')
    expect(new URL(page.url()).pathname).toBe('/spm/bijak')
    await expect(page.getByTestId('mod-pelajar-banner')).toHaveCount(0)
  })

  test('a plain admin on /kertas-subjektif (outside the student scope) gets the in-place 403, no switch (6bde70acd)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/kertas-subjektif')
    await expect(page.locator('[data-page=forbidden]')).toBeVisible()
    await expectTabTitle(page, 'Akses Ditolak | PRESTASIPLUS')
    expect(new URL(page.url()).pathname).toBe('/kertas-subjektif')
    await expect(page.getByTestId('mod-pelajar-banner')).toHaveCount(0)
  })
})
