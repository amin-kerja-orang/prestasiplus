/**
 * M01 G5 QA additions (L01 / L02 / L05, user shell). Covers acceptance criteria the developer
 * smoke specs leave open: Back after logout (AC-M01-13.3), the drawer "Tetapan" entry (AC-M01-21.1),
 * the 60 s bell refresh through the mock clock (AC-M01-22.3), the guest redirect of the account
 * routes (AC-M01-05.1) and the readable hero heading of /tetapan (AC-M01-19.1, D9 unreadable text).
 */

import { expect, test } from '../fixtures/test'
import { expectContrast, isDesktopShell, moduleTag, TAG } from '../support'

test.describe(
  'M01 QA: account shell and profile extras',
  { tag: [moduleTag(1), TAG.smoke] },
  () => {
    test.use({ mockInit: { latency: 0 } })
    test.slow()

    test('E2E-M01-25 AC-13.3: Back after logout ends on /login', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/profile')
      await expect(page.getByTestId('shell-user-bell')).toBeVisible()
      if (isDesktopShell(page)) {
        await page.getByTestId('shell-user-header-logout').click()
      } else {
        await page.getByTestId('shell-user-hamburger').click()
        await page.getByTestId('shell-user-drawer-logout').click()
      }
      await expect(page).toHaveURL('/login')
      await page.goBack()
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByTestId('login-submit')).toBeVisible()
    })

    test('E2E-M01-36 AC-21.1: drawer "Tetapan" opens /tetapan (below 1024px)', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      test.skip(isDesktopShell(page), 'drawer only below 1024px')
      await loginAs('pelajar@demo.test')
      await gotoApp('/profile')
      await page.getByTestId('shell-user-hamburger').click()
      const drawer = page.getByTestId('shell-user-drawer')
      await expect(drawer).toHaveClass(/\bopen\b/)
      await drawer.locator('a[href="/tetapan"]', { hasText: /^\s*Tetapan\s*$/ }).click()
      await expect(page).toHaveURL('/tetapan')
      await expect(page.getByTestId('tetapan-form')).toBeVisible()
    })

    test('E2E-M01-49 AC-22.3: the bell refreshes after 60 s without a reload', async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      const account = await loginAs('pelajar@demo.test')
      await gotoApp('/profile')
      await expect(page.getByTestId('shell-user-bell-badge').first()).toHaveText('12')
      await mock.hook(
        'pushNotification',
        account.id,
        { title: 'Ujian', body: 'Notifikasi ujian' },
        { push: false },
      )
      await mock.advanceTime(60_000)
      await expect(page.getByTestId('shell-user-bell-badge').first()).toHaveText('13')
    })

    test('E2E-M01-05 AC-05.1: a guest on /profile, /profile/edit, /tetapan lands on /login', async ({
      page,
      gotoApp,
    }) => {
      for (const path of ['/profile', '/profile/edit', '/tetapan']) {
        await gotoApp(path)
        await expect(page).toHaveURL(/\/login\?/)
        // D51: the guard keeps where the guest was heading
        expect(new URL(page.url()).searchParams.get('redirect')).toBe(path)
      }
    })

    test('E2E-M01-32 AC-19.1: the /tetapan hero heading is readable (contrast against its real background)', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs('guru@demo.test')
      await gotoApp('/tetapan')
      const h = page.getByRole('heading', { name: '⚙️ Tetapan Peribadi' })
      await expect(h).toBeVisible()
      // v2 restyle (DsPage / UCard, dark heading): assert real contrast, not exact colours; 24px+ heading is large text
      await expectContrast(h, 4.5)
    })
  },
)
