/**
 * M10 S33 `/kelas-saya` (student) at 375 / 768 / 1280 (SRS M10 §12: E2E-M10-03 guest part,
 * E2E-M10-27). The empty state is OBSERVED; there is no join box (API-MUR-04, D-A8).
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag } from '../support'

const PELAJAR2 = 'pelajar2@demo.test'
const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

test.describe('M10 S33 Kelas Saya (student)', MODULE, () => {
  test('E2E-M10-27 no join box and the empty texts as pelajar2 @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/kelas-saya')
    await expect(page.getByTestId('kelas-saya-page')).toBeVisible({ timeout: 15_000 })
    await expectTabTitle(page, 'Kelas Saya')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Kelas Saya')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText('Sertai kelas guru anda 🏫')

    await expect(page.getByText('Masukkan Kod Kelas')).toHaveCount(0)
    await expect(page.getByTestId('class-code')).toHaveCount(0)
    await expect(page.getByTestId('join-submit')).toHaveCount(0)

    const empty = page.getByTestId('classes-empty')
    await expect(empty).toContainText('Anda belum dimasukkan ke dalam kelas')
    await expect(empty).toContainText(
      'Guru anda yang menambah pelajar ke dalam kelas. Minta guru anda menambah nama anda supaya anda boleh melihat set soalan kelas dan kedudukan kelas.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M10-03 a guest opening /kelas-saya is sent to /login @m10', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/kelas-saya')
    await expect(page).toHaveURL(/\/login/)
  })

  test('E2E-M10-03 a teacher is not served the student page @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('guru@demo.test')
    await gotoApp('/kelas-saya')
    await expect(page).not.toHaveURL(/\/kelas-saya/)
    await expect(page.getByTestId('kelas-saya-page')).toHaveCount(0)
  })

  test('E2E-M10-03 the admin sees S33 in the user shell @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/kelas-saya')
    await expect(page.getByTestId('kelas-saya-page')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('classes-empty')).toBeVisible()
  })
})
