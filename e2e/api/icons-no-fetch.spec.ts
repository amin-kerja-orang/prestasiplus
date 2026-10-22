/**
 * D-09 against the REAL API (SPA built with `VITE_API_MODE=http`): no icon is fetched from the
 * Iconify API hosts and none is missing from the local bundle (`[icons] not bundled` warning of
 * `src/theme/icon-offline.ts`) while each role visits its menu routes; no horizontal page scroll.
 * Read-only. Roles: pupil, teacher, school admin, Admin Pusat. Mock twin: `e2e/icons/no-icon-fetch.spec.ts`.
 */
import { expect, loginViaUi, test } from '../fixtures/api'
import { ICON_ROUTES, visitAll, watchIcons } from '../icons/icon-routes'
import { account, type ApiRole } from './helpers'

const ROLES: readonly (readonly [ApiRole, keyof typeof ICON_ROUTES])[] = [
  ['student', 'student'],
  ['guru', 'teacher'],
  ['adminSekolah', 'school_admin'],
  ['adminPusat', 'admin'],
]

test.describe('no icon is fetched at run time @api', () => {
  for (const [apiRole, routeRole] of ROLES) {
    test(`${routeRole} menu routes load every icon locally @api`, async ({ page }) => {
      test.setTimeout(300_000)
      const { user, pass } = account(apiRole)
      const seen = watchIcons(page)
      await loginViaUi(page, user, pass)
      const overflowing = await visitAll(page, ICON_ROUTES[routeRole])
      expect(overflowing, `horizontal page scroll on ${routeRole} routes`).toEqual([])
      expect(seen, `icons fetched or missing from the bundle on ${routeRole} routes`).toEqual([])
    })
  }
})
