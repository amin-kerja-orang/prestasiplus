/**
 * M20 G5 QA (row L37, student scope): legs of the in-scope ACs that the developer smoke does not
 * execute. SRS M20 §12 E2E-M20-08 (S7 guest), 16 (clock), 19 (loading), 24.3 (no coin price,
 * wallet unchanged after the WhatsApp hand-off). Viewer: pelajar@demo.test.
 */

import { APP_BOOT_TIMEOUT_MS, expect, test } from '../fixtures/test'
import { moduleTag } from '../support'

const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(20)] }
const SLUG_1 = 'beg-sekolah-anti-air-premium-vH1Fj'

test.describe('M20 L37 QA legs', MODULE, () => {
  test('AC-M20-03.1 a guest opening S7 and W is sent to /login', async ({ page, gotoApp }) => {
    await gotoApp(`/marketplace/${SLUG_1}`)
    await expect(page).toHaveURL(/\/login/)
    await gotoApp(`/marketplace/${SLUG_1}/whatsapp`)
    await expect(page).toHaveURL(/\/login/)
  })

  test.describe('latency 2 s', () => {
    test.use({ mockInit: { latency: 2000, now: '2026-09-25T15:40:00+08:00' } })
    test('AC-M20-05.5 S6 shows the loading state, then the grid', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(PELAJAR)
      await gotoApp('/marketplace')
      await expect(page.getByTestId('marketplace-loading')).toBeVisible({
        timeout: APP_BOOT_TIMEOUT_MS,
      })
      await expect(page.getByTestId('product-card')).toHaveCount(10, { timeout: 30_000 })
      await expect(page.getByTestId('marketplace-loading')).toHaveCount(0)
    })
  })

  test.describe('clock 2026-10-10', () => {
    test.use({ mockInit: { latency: 0, now: '2026-10-10T09:00:00+08:00' } })
    test('AC-M20-05.2 S8 reads "Bergabung 8 bulan yang lepas"', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(PELAJAR)
      await gotoApp('/marketplace/penjual/1')
      await expect(page.getByText('Bergabung 8 bulan yang lepas')).toBeVisible()
    })
  })

  test.describe('wallet', () => {
    test.use({ mockInit: { latency: 0, now: '2026-09-25T15:40:00+08:00' } })
    test('AC-M20-24.3 no buy button or coin price; the wallet chip is unchanged after a hand-off', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(PELAJAR)
      await page.context().route('https://wa.me/**', (route) => route.abort())
      await gotoApp(`/marketplace/${SLUG_1}`)
      await expect(page.getByTestId('product-name')).toBeVisible()
      const body = page.locator('main')
      await expect(body.getByRole('button', { name: /beli|tambah ke troli|checkout/i })).toHaveCount(0)
      const chip = page.getByText(/\d+\s*koin/).first()
      const norm = async () => ((await chip.textContent()) ?? '').replace(/\s+/g, '')
      const before = await norm()
      const popupPromise = page.waitForEvent('popup')
      await page.getByTestId('product-whatsapp').click()
      const popup = await popupPromise
      await popup.close()
      expect(await norm()).toBe(before)
    })
  })
})
