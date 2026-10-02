/**
 * M10 S33 `/kelas-saya` (student) at 375 / 768 / 1280 (SRS M10 §12: E2E-M10-03 guest part,
 * E2E-M10-27, E2E-M10-28). The empty state and the field are OBSERVED; joined cards, the refusal
 * copy and the `?kod=` pre-fill are PROPOSED / UNVERIFIED, so those tests are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
} from '../support'

const PELAJAR2 = 'pelajar2@demo.test'
const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const app = document.querySelector('#app') as
      | (Element & {
          __vue_app__?: {
            config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
          }
        })
      | null
    await app!.__vue_app__!.config.globalProperties.$router.push(to)
  }, path)
}

test.describe('M10 S33 Kelas Saya (student)', MODULE, () => {
  test('E2E-M10-27 fields, maxlength 6 and the empty texts as pelajar2 @m10', async ({
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

    await expect(page.getByText('Masukkan Kod Kelas')).toBeVisible()
    const input = page.getByTestId('class-code')
    await expect(input).toHaveAttribute('placeholder', 'cth: MAT5B2')
    await expect(input).toHaveAttribute('maxlength', '6')
    await expect(input).toHaveAttribute('required', '')
    await input.pressSequentially('ABCDEFG')
    await expect(input).toHaveValue('ABCDEF')
    await input.fill('')
    const submit = page.getByTestId('join-submit')
    await expect(submit).toHaveText('Sertai')
    await expectTouchTarget(submit)
    await expectTouchTarget(input)

    const empty = page.getByTestId('classes-empty')
    await expect(empty).toContainText('Belum Sertai Mana-Mana Kelas')
    await expect(empty).toContainText('Minta kod kelas daripada guru anda dan masukkan di atas')
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

  test(
    'E2E-M10-28 pelajar2 joins DMO101, an unknown code and a repeat are refused, ?kod= pre-fills @m10',
    provisional('joined cards, the refusal copy and ?kod= are PROPOSED / UNVERIFIED (OQ-M10-04)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJAR2)
      await gotoApp('/kelas-saya')
      await expect(page.getByTestId('classes-empty')).toBeVisible({ timeout: 15_000 })

      const input = page.getByTestId('class-code')
      await input.fill('ZZZ999')
      await page.getByTestId('join-submit').click()
      await expect(page.getByTestId('join-error')).toContainText('Kod kelas tidak sah.')
      await expect(page.getByTestId('classes-empty')).toBeVisible()

      await input.fill('dmo101')
      await page.getByTestId('join-submit').click()
      await expect(page.getByTestId('join-success')).toContainText('Berjaya menyertai kelas')
      await expect(page.getByTestId('joined-class')).toHaveCount(1)
      await expect(page.getByTestId('class-name')).toHaveText('5 MARIKH - Kimia')
      await expect(page.getByTestId('class-level')).toHaveText('Ting. 5')
      await expect(page.getByTestId('classes-empty')).toHaveCount(0)
      await expect(input).toHaveValue('')

      await input.fill('DMO101')
      await page.getByTestId('join-submit').click()
      await expect(page.getByTestId('join-error')).toContainText('Anda sudah menyertai kelas ini.')
      await expect(page.getByTestId('joined-class')).toHaveCount(1)
      await expectNoHorizontalScroll(page)

      await spaGo(page, '/kelas-saya?kod=DMO102')
      await expect(input).toHaveValue('DMO102')
      await expect(page.getByTestId('joined-class')).toHaveCount(1)
    },
  )
})
