/**
 * UAT G-06 (Guru) and S-06 (Admin Sekolah): the "Command Center" menu entry opens the board in the SAME tab.
 * It used to carry `target="_blank"` (user-nav.ts), so the click opened a second tab nobody asked for. The only
 * intended new-tab action of the portals is "Pratonton sebagai Pelajar" (TRACKER D30).
 * Runs at 375 / 768 / 1280 in the e2e build (legacy user shell) and, with `VITE_PROTOTYPE_SCOPE=on`, in the
 * Pembelajaran layout: the menu is found by its link name, wherever the shell puts it.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

const CASES = [
  { who: 'UAT G-06 guru', email: 'guru@demo.test', home: '/guru', board: '/guru/command-center' },
  {
    who: 'UAT S-06 admin sekolah',
    email: 'adminsekolah@demo.test',
    home: '/admin-sekolah',
    board: '/admin-sekolah/command-center',
  },
] as const

/**
 * The visible "Command Center" menu link. In the legacy shell below lg it lives in the drawer, which the hamburger
 * opens; the Pembelajaran layout and the desktop sidebar show it directly.
 */
async function commandCenterLink(page: Page) {
  const hamburger = page.getByTestId('shell-user-hamburger')
  const link = page.getByRole('link', { name: /Command Center/ }).filter({ visible: true }).first()
  // Wait for the shell to settle: the link is on screen or the hamburger is.
  await expect(link.or(hamburger).first()).toBeVisible()
  if (await hamburger.isVisible()) {
    await hamburger.click()
    return page.getByTestId('shell-user-drawer').getByRole('link', { name: /Command Center/ })
  }
  return link
}

for (const c of CASES) {
  test.describe(c.who, MODULE, () => {
    test(`the Command Center menu entry navigates in the same tab @m10`, async ({
      page,
      context,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(c.email)
      await gotoApp(c.home)

      const opened: string[] = []
      context.on('page', (p) => opened.push(p.url()))

      const link = await commandCenterLink(page)
      await expect(link).toBeVisible()
      await expect(link).not.toHaveAttribute('target', '_blank')
      await link.click()

      await expect(page).toHaveURL(new RegExp(`${c.board}$`))
      // Give a stray window.open / target=_blank tab time to appear before asserting there is none.
      await page.waitForTimeout(750)
      expect(opened, 'no new tab or window').toEqual([])
      expect(context.pages()).toHaveLength(1)
      await expectNoHorizontalScroll(page)
    })
  })
}
