/**
 * D-09: no icon is ever fetched at run time. Visits the menu routes of every prototype role and
 * asserts, at 375 / 768 / 1280:
 * - zero requests to the Iconify API hosts (`api.iconify.design`, `api.simplesvg.com`, `api.unisvg.com`);
 * - zero `[icons] not bundled` warnings (the network-off guard of `src/theme/icon-offline.ts`
 *   reports a name that is missing from the local bundle instead of fetching it);
 * - no horizontal page scroll.
 * The same check against the real API: `e2e/api/icons-no-fetch.spec.ts` (`@api`).
 */
import { expect, test } from '../fixtures/test'
import { ICON_ROUTES, visitAll, watchIcons } from './icon-routes'

for (const [role, routes] of Object.entries(ICON_ROUTES)) {
  test(`D-09 no icon is fetched at run time: ${role} @icons`, async ({ page, loginAs, gotoApp }) => {
    test.setTimeout(300_000)
    const seen = watchIcons(page)
    await loginAs(role)
    // One page load, then in-app navigation: re-booting the mock for each of ~100 routes is slow.
    await gotoApp('/')
    const overflowing = await visitAll(page, routes)
    expect(overflowing, `horizontal page scroll on ${role} routes`).toEqual([])
    expect(seen, `icons fetched or missing from the bundle on ${role} routes`).toEqual([])
  })
}
