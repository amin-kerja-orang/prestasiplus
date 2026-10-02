/**
 * M01 G5 QA additions (L01 / L02 / L05, user shell). Covers acceptance criteria the developer
 * smoke specs leave open: Back after logout (AC-M01-13.3), the drawer "Tetapan" entry (AC-M01-21.1),
 * the 60 s bell refresh through the mock clock (AC-M01-22.3), the guest redirect of the account
 * routes (AC-M01-05.1) and the readable (white) hero heading of /tetapan (AC-M01-19.1, D9 unreadable text).
 */

import { expect, test } from '../fixtures/test'
import { isDesktopShell, moduleTag, TAG } from '../support'

function luminance([r = 0, g = 0, b = 0]: number[]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
const rgb = (s: string): number[] => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)

test.describe('M01 QA: account shell and profile extras', { tag: [moduleTag(1), TAG.smoke] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.slow()

  test('E2E-M01-25 AC-13.3: Back after logout ends on /login', async ({ page, loginAs, gotoApp }) => {
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
      await expect(page).toHaveURL(/\/login$/)
    }
  })

  test('E2E-M01-32 AC-19.1: the /tetapan hero heading is readable (white on the slate gradient)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('guru@demo.test')
    await gotoApp('/tetapan')
    const h = page.getByRole('heading', { name: '⚙️ Tetapan Peribadi' })
    await expect(h).toBeVisible()
    const color = await h.evaluate((el) => getComputedStyle(el).color)
    // The hero gradient runs #475569 -> #64748B; AA for normal text (4.5:1) at the lighter end; white gives 4.76, the dark slate text gives 3.05.
    expect(contrast(rgb(color), [100, 116, 139])).toBeGreaterThanOrEqual(4.5)
  })
})
