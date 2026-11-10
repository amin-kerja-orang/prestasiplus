/**
 * M01-T5a developer smoke (QA writes E2E-M01-* at G5): the user-shell account controls for demo
 * accounts 2 (pelajar), 5 (guru) and 8 (adminsekolah): logout from the drawer (below 1024px) or the
 * header (1280px) lands on `/login`; identity blocks; account links; the bell badge refresh.
 * Opened on a probe route because the landing pages belong to other modules.
 */

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  moduleTag,
  openProbeRoute,
  TAG,
} from '../support'

const PROBE = { path: '/__e2e/m01-account', layout: 'user', access: 'auth' } as const

const ACCOUNTS = ['pelajar@demo.test', 'guru@demo.test', 'adminsekolah@demo.test'] as const

test.describe('M01 shell account controls', { tag: [TAG.smoke, moduleTag(1)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const email of ACCOUNTS) {
    test(`${email}: identity, account links and logout to /login (probe route)`, async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      const account = await loginAs(email)
      await gotoApp('/')
      await openProbeRoute(page, PROBE)

      // BUG-I1: PembelajaranLayout has no notification bell (design v2-shells.md 266); the bell link is not asserted here.

      // v2 Pembelajaran frame: identity, account links and logout live in the account menu (all
      // widths).
      await page.getByTestId('pembelajaran-account-top').click()
      const menu = page.getByRole('menu')
      await expect(menu).toContainText(account.name)
      await expect(menu.getByRole('menuitem', { name: 'Profil Saya' })).toHaveAttribute('href', '/profile')
      await expect(menu.getByRole('menuitem', { name: 'Tetapan' })).toHaveAttribute('href', '/tetapan')
      await expectNoHorizontalScroll(page)
      await menu.getByRole('menuitem', { name: 'Log Keluar' }).click()

      await expect(page).toHaveURL('/login')
      expect(await mock.requests('POST /api/auth/logout')).toHaveLength(1)
      // The session is gone: a protected page now sends the visitor back to the login page.
      await openProbeRoute(page, PROBE)
      await expect(page).toHaveURL(/\/login/)
    })
  }

  test('bell badge: appears at the first unread and shows "99+" over 99 (probe route)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    // ibubapa starts with an empty inbox: the counts below are built with the mock hook only.
    const account = await loginAs('ibubapa@demo.test')
    await gotoApp('/')
    await openProbeRoute(page, PROBE)
    // The shell mounts asynchronously: wait for it before pushing (its listener is added on mount).
    await expect(page.getByTestId('shell-user-bell')).toBeVisible()
    await expect(page.getByTestId('shell-user-bell-badge')).toHaveCount(0)
    const note = { title: 'Ujian', body: 'Notifikasi ujian' }
    for (let n = 0; n < 100; n += 1) {
      await mock.hook('pushNotification', account.id, note, { push: false })
    }
    await mock.hook('pushNotification', account.id, note) // 101st, with the push event
    await expect(page.getByTestId('shell-user-bell-badge').first()).toHaveText('99+')
  })

  test('bell badge: a simulated push updates the count without waiting 60 s (probe route)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    const account = await loginAs('ibubapa@demo.test')
    await gotoApp('/')
    await openProbeRoute(page, PROBE)
    // The shell mounts asynchronously: wait for it before pushing (its listener is added on mount).
    await expect(page.getByTestId('shell-user-bell')).toBeVisible()
    await expect(page.getByTestId('shell-user-bell-badge')).toHaveCount(0)
    await mock.hook('pushNotification', account.id, { title: 'Ujian', body: 'Notifikasi ujian' })
    await expect(page.getByTestId('shell-user-bell-badge').first()).toHaveText('1')
    await mock.hook('pushNotification', account.id, { title: 'Ujian 2', body: 'Notifikasi ujian' })
    await expect(page.getByTestId('shell-user-bell-badge').first()).toHaveText('2')
  })
})
