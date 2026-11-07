/**
 * FR-GM-00.1, FR-MUR-21-1, AC-MUR-21-1, #497 ruling 14: `/permainan/pertandingan`, `/permainan/uji-minda` and
 * `/permainan/sambung-kata` have no route in R1, so each shows the catch-all 404 at 375 / 768 / 1280.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(16)] }

test.use({ mockInit: { latency: 0 } })

test.describe('Pages off in R1', () => {
  for (const path of ['/permainan/pertandingan', '/permainan/uji-minda', '/permainan/sambung-kata']) {
    test(`${path} shows the 404 page`, MODULE, async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp(path)
      await expect(page.locator('[data-page="not-found"]')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  }
})
