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
      const shell = page.locator('[data-layout="user"]')
      await expect(shell).toBeVisible()
      await expect(page.getByTestId('shell-user-main')).toBeVisible()
      await expect(page.getByTestId('shell-user-header')).toBeVisible()
      // Default header (DV-SH-03) on a route without its own header.
      await expect(page.getByTestId('shell-user-title').first()).toHaveText('Papan Pemuka')

      // Fast login: the session came from __MOCK_INIT__.session, not from the login endpoint.
      expect(await mock.requests('POST /api/auth/login')).toHaveLength(0)

      const sidebar = page.getByTestId('shell-user-sidebar')
      const drawer = page.getByTestId('shell-user-drawer')
      const bottomNav = page.getByTestId('shell-user-bottom-nav')
      const hamburger = page.getByTestId('shell-user-hamburger')

      if (isDesktopShell(page)) {
        await expect(sidebar).toBeVisible()
        expect(await isInViewportX(page, sidebar)).toBe(true)
        await expect(page.getByTestId('shell-user-sidebar-card')).toContainText(account.name)
        await expect(page.getByTestId('shell-user-sidebar-card')).toContainText(account.email)
        await expect(page.getByTestId('shell-user-footer')).toBeVisible()
        await expect(bottomNav).toBeHidden()
        await expect(hamburger).toBeHidden()
        await expect(page.getByTestId('shell-user-drawer-root')).toBeHidden()
        await expectNoHorizontalScroll(page)
        return
      }

      // Tablet and mobile: no sidebar; hamburger + bottom nav; the drawer is off-canvas until opened.
      await expect(sidebar).toBeHidden()
      await expect(page.getByTestId('shell-user-footer')).toBeHidden()
      await expect(bottomNav).toBeVisible()
      await expect(hamburger).toBeVisible()
      await expect(drawer).not.toHaveClass(/\bopen\b/)
      expect(await isInViewportX(page, drawer)).toBe(false)
      await expectNoHorizontalScroll(page)

      await hamburger.click()
      await expect(drawer).toHaveClass(/\bopen\b/)
      await expect.poll(() => isInViewportX(page, drawer)).toBe(true)
      await expect(page.getByTestId('shell-user-drawer-card')).toContainText(account.name)
      await expect(page.getByTestId('shell-user-drawer-logout')).toBeVisible()
      await expectNoHorizontalScroll(page)

      await page.getByTestId('shell-user-drawer-close').click()
      await expect(drawer).not.toHaveClass(/\bopen\b/)

      // The bottom nav "Lagi" button opens the same drawer.
      await bottomNav.locator('[data-nav-id="bottom-lagi"]').click()
      await expect(drawer).toHaveClass(/\bopen\b/)
      // Tap the overlay beside the drawer (the drawer is at most 280 px / 85vw wide, on the left).
      const width = page.viewportSize()!.width
      await page
        .getByTestId('shell-user-drawer-overlay')
        .click({ position: { x: width - 8, y: 300 } })
      await expect(drawer).not.toHaveClass(/\bopen\b/)
      await expectNoHorizontalScroll(page)
    },
  )
})
