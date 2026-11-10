/**
 * Global smoke: the user shell (F-19) for canonical account 2 (`pelajar@demo.test`) at the three
 * project widths (build-plan F-22). Sidebar at ≥ 1024 px; drawer and bottom nav below; no
 * horizontal scroll, with the drawer closed and open.
 *
 * No module route exists yet, so the shell is opened on a probe route (`e2e/support/probe-route.ts`)
 * with `layout: 'user'`, `access: 'auth'`. Switch to `/dashboard` once M08 builds it.
 */

import { expect, gotoApp, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  isDesktopShell,
  isInViewportX,
  openProbeRoute,
  provisional,
  TAG,
} from '../support'

const SHELL_PROBE = { path: '/__e2e/user-shell', layout: 'user', access: 'auth' } as const

test.describe('user shell', { tag: [TAG.smoke] }, () => {
  test(
    'renders for pelajar@demo.test with the layout of the viewport (probe route)',
    provisional('probe route until M08/M01'),
    async ({ page, loginAs, mock }) => {
      const account = await loginAs('pelajar@demo.test')
      await gotoApp(page, '/')
      await openProbeRoute(page, SHELL_PROBE)

      await expect(page).toHaveURL(SHELL_PROBE.path)
      // v2: the student frame is the Pembelajaran layout (D29).
      const shell = page.locator('[data-layout="pembelajaran"]')
      await expect(shell).toBeAttached()
      await expect(page.getByTestId('pembelajaran-main')).toBeVisible()
      await expect(page.getByTestId('pembelajaran-header')).toBeVisible()

      // Fast login: the session came from __MOCK_INIT__.session, not from the login endpoint.
      expect(await mock.requests('POST /api/auth/login')).toHaveLength(0)

      const sidebar = page.getByTestId('pembelajaran-sidebar')
      const bottomNav = page.getByTestId('pembelajaran-bottom-nav')

      if (isDesktopShell(page)) {
        await expect(sidebar).toBeVisible()
        expect(await isInViewportX(page, sidebar)).toBe(true)
        await expect(page.getByTestId('pembelajaran-nav')).toBeVisible()
        await expect(bottomNav).toBeHidden()
        await expect(page.getByTestId('pembelajaran-account-top')).toBeVisible()
        await expectNoHorizontalScroll(page)
        return
      }

      // Tablet and mobile: no sidebar; bottom tab bar with "Lagi", which opens the full menu sheet.
      await expect(sidebar).toBeHidden()
      await expect(bottomNav).toBeVisible()
      await expectNoHorizontalScroll(page)

      await bottomNav.locator('[data-nav-id="tab-lagi"]').click()
      const lagi = page.getByTestId('pembelajaran-lagi-nav')
      await expect(lagi).toBeVisible()
      await expect(page.getByRole('dialog')).toContainText(account.name)
      await expect(page.getByRole('dialog').getByText('Log Keluar')).toBeVisible()
      await expectNoHorizontalScroll(page)

      await page.keyboard.press('Escape')
      await expect(lagi).toBeHidden()
      await expectNoHorizontalScroll(page)
    },
  )
})
