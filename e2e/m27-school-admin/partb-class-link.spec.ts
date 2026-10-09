/**
 * M27-T0c (XR-M27-13b): a school admin (adminsekolah@demo.test, school 900001) opens the M08 S5 class
 * page `/prestasi/kelas/{id}` for a class of the own school only; a class of another school gets the
 * same standalone 404 as before.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle } from '../support'

const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'

test.describe('M27 Part B class link (school admin 900001)', () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs('adminsekolah@demo.test')
  })

  test('own-school class 2001 renders the class page', async ({ page, gotoApp }) => {
    await gotoApp('/prestasi/kelas/2001')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    await expectTabTitle(page, '5 MARIKH - Kimia — Dashboard Kelas')
    await expect(page.getByTestId('shell-user-title')).toHaveText('5 MARIKH - Kimia')
    await expect(page.getByTestId('hc-on')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('class of another school (366, school 8080) is refused with the 404 page', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/prestasi/kelas/366')
    await expectTabTitle(page, NOT_FOUND_TITLE)
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toHaveCount(0)
  })
})
