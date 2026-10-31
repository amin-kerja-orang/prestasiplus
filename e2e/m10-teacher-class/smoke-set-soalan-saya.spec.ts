/**
 * M10 S34 `/set-soalan-saya` (student) at 375 / 768 / 1280 (SRS M10 §12: E2E-M10-47, E2E-M10-48).
 * The header, tab title and the empty card are OBSERVED; populated rows are PROPOSED (L-M10-09),
 * so that test is `@provisional`. pelajar2 is user 3; `mock.enrol` is the runtime join of §6.12.
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

const PELAJAR2_ID = 3
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

test.describe('M10 S34 Set Soalan Guru (student)', MODULE, () => {
  test('E2E-M10-47 header, tab title and the empty texts as admin @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/set-soalan-saya')
    await expect(page.getByTestId('set-soalan-page')).toBeVisible({ timeout: 15_000 })
    await expectTabTitle(page, 'Set Soalan Guru | PRESTASIPLUS')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Set Soalan Guru')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
      'Set soalan yang disediakan oleh guru anda',
    )
    const empty = page.getByTestId('sets-empty')
    await expect(empty).toContainText('Tiada Set Soalan')
    await expect(empty).toContainText('Guru anda belum sediakan set soalan untuk anda.')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M10-47 pelajar2 with no class sees the empty card @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar2@demo.test')
    await gotoApp('/set-soalan-saya')
    await expect(page.getByTestId('sets-empty')).toContainText('Tiada Set Soalan', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('set-row')).toHaveCount(0)
  })

  test('E2E-M10-03 a guest opening /set-soalan-saya is sent to /login @m10', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/set-soalan-saya')
    await expect(page).toHaveURL(/\/login/)
  })

  test('E2E-M10-03 a teacher is not served the student page @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('guru@demo.test')
    await gotoApp('/set-soalan-saya')
    await expect(page).not.toHaveURL(/\/set-soalan-saya/)
    await expect(page.getByTestId('set-soalan-page')).toHaveCount(0)
  })

  test(
    'E2E-M10-48 pelajar2 joins DMO102: set 7402 is listed, draft 7401 is not, "Mula" opens the quiz @m10',
    provisional('the populated row and its copy are PROPOSED (FN-M10-5.7.2, L-M10-09)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs('pelajar2@demo.test')
      await gotoApp('/set-soalan-saya')
      await expect(page.getByTestId('sets-empty')).toBeVisible({ timeout: 15_000 })

      await mock.hook('enrol', PELAJAR2_ID, 'DMO101')
      await mock.hook('enrol', PELAJAR2_ID, 'DMO102')
      await spaGo(page, '/kelas-saya')
      await spaGo(page, '/set-soalan-saya')

      await expect(page.getByTestId('set-row')).toHaveCount(1)
      await expect(page.getByTestId('set-title')).toHaveText('Sejarah Bab 1 - Set 1')
      await expect(page.getByText('Latih Tubi Kimia Sep 2026 - Set 1')).toHaveCount(0)
      await expect(page.getByTestId('set-teacher')).toHaveText('Guru Demo')
      await expect(page.getByTestId('set-count')).toHaveText('10 soalan')
      await expect(page.getByTestId('set-attempts')).toHaveText('1 percubaan berbaki')
      await expectNoHorizontalScroll(page)

      const start = page.getByTestId('set-start')
      await expect(start).toHaveText('Mula')
      await expectTouchTarget(start)
      await start.click()
      await expect(page).toHaveURL(/\/set-soalan-saya\/7402\/jawab$/)
    },
  )
})
