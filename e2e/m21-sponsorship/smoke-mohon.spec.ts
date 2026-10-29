/**
 * M21-T2 smoke: S6 `/mohon-keluarga-angkat` opens in the user shell as account 2 (pelajar) with the
 * header title of DV-M21-06 and the live tab title. Full S6 coverage is in `s6-mohon.spec.ts`.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag } from '../support'
import { KELUARGA_ANGKAT_ON, KELUARGA_ANGKAT_SKIP_REASON } from '../support/keluarga-angkat'

// Hidden unless VITE_KELUARGA_ANGKAT=on (D74): the route is not registered (404).
test.skip(!KELUARGA_ANGKAT_ON, KELUARGA_ANGKAT_SKIP_REASON)

test.use({ mockInit: { latency: 0 } })

test.describe('M21 S6 smoke', { tag: [moduleTag(21)] }, () => {
  test('smoke: tab "Mohon Keluarga Angkat" as account 2 renders the form @m21', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/mohon-keluarga-angkat')
    await expect(page.getByTestId('mohon-hero').locator('h1')).toHaveText('Mohon Keluarga Angkat')
    await expect(page.getByTestId('shell-user-title').first()).toHaveText('Mohon Keluarga Angkat')
    await expectTabTitle(page, 'Mohon Keluarga Angkat')
    await expect(page.locator('#student_email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hantar Permohonan' })).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
