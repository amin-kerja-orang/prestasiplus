/**
 * M21 S6 "Mohon Keluarga Angkat" while the build flag is OFF (D74: `VITE_KELUARGA_ANGKAT` is read at build time,
 * src/app/features.ts:33-35, so it cannot be switched from a test or the Kawalan Ciri toggle page): the route is not
 * registered (404) and no menu entry points at it. The tests of the feature itself (s6-mohon, smoke-mohon) run only
 * on a build with the flag ON.
 */

import { expect, test } from '../fixtures/test'
import { moduleTag } from '../support'
import { KELUARGA_ANGKAT_ON } from '../support/keluarga-angkat'

test.use({ mockInit: { latency: 0 } })

test.describe('M21 S6 flag OFF', { tag: [moduleTag(21)] }, () => {
  test.skip(KELUARGA_ANGKAT_ON, 'this build has VITE_KELUARGA_ANGKAT=on; the feature specs run instead')

  test('E2E-M21-OFF-1 a pupil on /mohon-keluarga-angkat gets the 404 page and no menu entry links to it', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/dashboard')
    await expect(page.locator('a[href="/mohon-keluarga-angkat"]')).toHaveCount(0)
    await gotoApp('/mohon-keluarga-angkat')
    await expect(page.locator('[data-ds="error-page"][data-code="404"]')).toBeVisible()
  })
})
