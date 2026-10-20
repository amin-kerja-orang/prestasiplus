/**
 * @api logout for every role through the real menu (BE-32 AC3, slug `e2e-bijak`). Writes nothing
 * (a login/logout only creates and ends a session row).
 *
 * The menu item is "Log Keluar" in the account dropdown of each shell:
 * - murid, guru, admin sekolah: Pembelajaran shell, top-right avatar `pembelajaran-account-top`
 *   (PembelajaranLayout.vue `accountMenu`);
 * - Admin Pusat: Pentadbiran shell, sidebar footer `pentadbiran-account` (slide-over below `lg`,
 *   opened by `pentadbiran-menu-button`) (PentadbiranLayout.vue `accountItems`).
 * The item links to `/logout` (core route): POST /api/auth/logout, then `replace('/login')`.
 * Selectors for the two shells are read from source, not yet run: whole spec is @provisional until the
 * first stack run.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_<ROLE>_PASS).
 */

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, logoutViaMenu, sessionCookie, type ApiRole } from './helpers'

const ROLES: { role: ApiRole; label: string; shell: 'pembelajaran' | 'pentadbiran' }[] = [
  { role: 'student', label: 'murid', shell: 'pembelajaran' },
  { role: 'guru', label: 'guru', shell: 'pembelajaran' },
  { role: 'adminSekolah', label: 'admin sekolah', shell: 'pembelajaran' },
  { role: 'adminPusat', label: 'admin pusat', shell: 'pentadbiran' },
]

test.describe('logout @api', () => {
  test.setTimeout(60_000)

  for (const { role, label, shell } of ROLES) {
    test(`${label}: Log Keluar ends the session, lands on /login, GET /api/session is 401 @api @provisional`, async ({
      page,
      context,
    }) => {
      const { user, pass } = account(role)
      await loginViaUi(page, user, pass)
      expect(await sessionCookie(context), 'pp_session after login').toBeDefined()
      await expectNoHScroll(page)

      await logoutViaMenu(page, shell)

      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
      await expect(page.getByTestId('login-form')).toBeVisible()
      await expectNoHScroll(page)
      expect(await sessionCookie(context), 'pp_session after logout').toBeUndefined()
      expect((await page.request.get('/api/session')).status()).toBe(401)
    })
  }
})
