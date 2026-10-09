/**
 * M20 S7 `/marketplace/:slug` and the W hand-off `/marketplace/:slug/whatsapp` at 375 / 768 / 1280
 * (M20-T3; SRS M20 §12 E2E-M20-55..63 and the S7 part of 07 / 12 / 82 / 84 / 85). Developer smoke:
 * titles carry the SRS scenario ids. The seed is SRS §6.11 (views before the first visit: #1 30,
 * #5 7, #7 5); the viewer is account 2 `pelajar@demo.test`. W has no screen (D14): the click opens a new
 * tab, the external `wa.me` navigation is intercepted (never followed) and its URL asserted.
 */

import type { Page } from '@playwright/test'

import { APP_BOOT_TIMEOUT_MS, expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, viewportWidth } from '../support'

const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(20)] }

const SLUG_1 = 'beg-sekolah-anti-air-premium-vH1Fj'
const SLUG_5 = 'e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84'
const SLUG_7 = 'kamus-dewan-edisi-keempat-terpakai-8axTV'

test.use({ mockInit: { latency: 0, now: '2026-09-25T15:40:00+08:00' } })

async function expectHeader(page: Page, title: string, subtitle: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(subtitle)
}

const mainSrc = (page: Page) => page.getByTestId('gallery-main').getAttribute('src')

test.describe('M20 S7 Product page', MODULE, () => {
  test('E2E-M20-07/55 #1: header, tab title and the first-visit content', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(`/marketplace/${SLUG_1}`)
    await expectTabTitle(page, 'Beg Sekolah Anti-Air Premium - Marketplace PRESTASIPLUS')
    await expectHeader(page, 'Marketplace', 'Peralatan Sekolah')
    await expect(page.getByTestId('marketplace-back')).toHaveText('Kembali ke Marketplace')
    await expect(page.getByTestId('marketplace-back')).toHaveAttribute('href', '/marketplace')
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(4)
    await expect(page.getByTestId('gallery-thumb').first()).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('product-condition')).toHaveText('Baru')
    await expect(page.getByTestId('product-category')).toHaveText('Peralatan Sekolah')
    await expect(page.getByTestId('product-name')).toHaveText('Beg Sekolah Anti-Air Premium')
    await expect(page.getByTestId('product-price')).toHaveText('RM 89.90')
    await expect(page.getByTestId('product-original')).toHaveText('RM 129.90')
    await expect(page.getByTestId('product-discount')).toHaveText('-31%')
    await expect(page.getByTestId('product-description')).toContainText(
      'Beg sekolah kalis air dengan 4 kompartmen, bahan nylon berkualiti tinggi.',
    )
    await expect(page.getByTestId('product-views')).toHaveText('31 tontonan')
    await expect(page.getByTestId('product-stock')).toHaveText('Ada Stok')
    await expect(page.getByTestId('product-shipping-line')).toHaveText('Pos / Kurier (RM8.00)')
    await expect(page.getByTestId('product-location')).toHaveText('Kuala Lumpur')
    const wa = page.getByTestId('product-whatsapp')
    await expect(wa).toHaveText('Hubungi Penjual di WhatsApp')
    await expect(wa).toHaveAttribute('href', `/marketplace/${SLUG_1}/whatsapp`)
    await expect(wa).toHaveAttribute('target', '_blank')
    expect(await wa.getAttribute('rel')).toBeNull()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M20-56 a thumbnail swaps the main image with no request', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(`/marketplace/${SLUG_1}`)
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(4)
    const first = await mainSrc(page)
    const before = (await mock.requests()).length
    await page.getByTestId('gallery-thumb').nth(1).click()
    await expect.poll(() => mainSrc(page)).not.toBe(first)
    expect(await mainSrc(page)).toBe('/images/marketplace/products/1/img_2.jpg')
    await expect(page.getByTestId('gallery-thumb').nth(1)).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('gallery-thumb').first()).toHaveAttribute('data-active', 'false')
    expect((await mock.requests()).length).toBe(before)
    expect(
      await page.getByTestId('gallery-main').evaluate((i) => (i as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0)
  })

  test('E2E-M20-57 seller card, reviews and no review form', async ({ page, gotoApp, loginAs }) => {
    await loginAs(PELAJAR)
    await gotoApp(`/marketplace/${SLUG_1}`)
    await expect(page.getByTestId('seller-initial')).toHaveText('J', { timeout: APP_BOOT_TIMEOUT_MS })
    await expect(page.getByTestId('seller-name')).toHaveText('JomBelajar Official')
    await expect(page.getByTestId('seller-verified')).toBeVisible()
    await expect(page.getByTestId('seller-rating')).toHaveText('☆☆☆☆☆')
    await expect(page.getByTestId('seller-products')).toHaveText('10 produk')
    await expect(page.getByTestId('seller-link')).toHaveAttribute('href', '/marketplace/penjual/1')
    await expect(page.getByTestId('reviews-title')).toHaveText('Ulasan (0)')
    await expect(page.getByTestId('reviews-empty')).toHaveText('Belum ada ulasan untuk produk ini')
    await expect(page.locator('main form, main textarea')).toHaveCount(0)
    await page.getByTestId('seller-link').click()
    await expect(page).toHaveURL(/\/marketplace\/penjual\/1$/)
  })

  test('E2E-M20-58/59 related products and the #5 / #7 variants', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(`/marketplace/${SLUG_1}`)
    const related = page.getByTestId('related-products').getByTestId('product-card')
    await expect(related).toHaveCount(1)
    await expect(related.first()).toContainText('Kotak Pensel 3 Tingkat Disney Frozen')
    await expect(related.first()).toContainText('RM 22.90')

    await gotoApp(`/marketplace/${SLUG_7}`)
    await expectHeader(page, 'Marketplace', 'Buku & Rujukan')
    await expect(page.getByTestId('product-condition')).toHaveText('Terpakai')
    await expect(page.getByTestId('product-price')).toHaveText('RM 25.00')
    await expect(page.getByTestId('product-original')).toHaveText('RM 68.00')
    await expect(page.getByTestId('product-discount')).toHaveText('-63%')
    await expect(page.getByTestId('product-views')).toHaveText('6 tontonan')
    await expect(page.getByTestId('product-shipping-line')).toHaveText('Pos / Kurier (RM10.00)')
    await expect(page.getByTestId('product-location')).toHaveText('Penang')
    await expect(page.getByTestId('gallery-thumb')).toHaveCount(5)
    await expect(page.getByTestId('related-products').getByTestId('product-card-name')).toHaveText([
      'Set Buku Latihan Matematik Tahun 6 (5 Buku)',
      'E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)',
    ])

    await gotoApp(`/marketplace/${SLUG_5}`)
    await expectTabTitle(
      page,
      'E-Book: 1001 Soalan Sains Tingkatan 3 (PDF) - Marketplace PRESTASIPLUS',
    )
    await expectHeader(page, 'Marketplace', 'Buku & Rujukan')
    await expect(page.getByTestId('product-price')).toHaveText('RM 19.90')
    await expect(page.getByTestId('product-original')).toHaveCount(0)
    await expect(page.getByTestId('product-discount')).toHaveCount(0)
    await expect(page.getByTestId('product-category')).toHaveText('Buku & Rujukan')
    await expect(page.getByTestId('product-views')).toHaveText('8 tontonan')
    await expect(page.getByTestId('product-shipping-line')).toHaveText('Penghantaran Percuma 🎉')
    await expect(page.getByTestId('related-products').getByTestId('product-card-name')).toHaveText([
      'Set Buku Latihan Matematik Tahun 6 (5 Buku)',
      'Kamus Dewan Edisi Keempat (Terpakai)',
    ])
  })

  test('E2E-M20-60 every load adds a view; the list pages leave views unchanged', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(`/marketplace/${SLUG_1}`)
    await expect(page.getByTestId('product-views')).toHaveText('31 tontonan')
    // In-app navigation only (no reload): S6 and S8 leave views unchanged, every S7 mount adds one.
    await page.getByTestId('marketplace-back').click()
    await expect(page.getByTestId('product-card')).toHaveCount(10)
    await page.getByTestId('product-card').first().click()
    await expect(page.getByTestId('product-views')).toHaveText('32 tontonan')
    await page.getByTestId('seller-link').click()
    await expect(page.getByTestId('product-card')).toHaveCount(10)
    await page.goBack()
    await expect(page.getByTestId('product-views')).toHaveText('33 tontonan')
  })

  test('E2E-M20-12/82 unknown slugs and the non-routes render the 404 page', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    for (const url of [
      '/marketplace/tiada-produk-zzqxv',
      '/marketplace/cart',
      '/marketplace/pesanan',
    ]) {
      await gotoApp(url)
      await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
      await expect(page.getByTestId('product-page')).toHaveCount(0)
    }
    await expect(page.getByText('Beli')).toHaveCount(0)
  })

  test('E2E-M20-84/85 stacked at 375, side by side from 768, no horizontal scroll', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(`/marketplace/${SLUG_7}`)
    await expect(page.getByTestId('product-name')).toBeVisible()
    const gallery = await page.getByTestId('product-gallery').boundingBox()
    const info = await page.getByTestId('product-info').boundingBox()
    if (viewportWidth(page) < 768) {
      expect(info!.y).toBeGreaterThan(gallery!.y + gallery!.height - 1)
      expect(
        await page.getByTestId('gallery-thumb').evaluateAll((els) => {
          const ys = new Set(els.map((e) => Math.round(e.getBoundingClientRect().y)))
          return Math.ceil(els.length / ys.size)
        }),
      ).toBeLessThanOrEqual(5)
    } else {
      expect(info!.x).toBeGreaterThan(gallery!.x + gallery!.width - 1)
      expect(Math.abs(info!.y - gallery!.y)).toBeLessThan(2)
    }
    const h1 = await page
      .getByTestId('product-name')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(h1).toBe(24)
    const wa = await page.getByTestId('product-whatsapp').boundingBox()
    expect(wa!.height).toBeGreaterThanOrEqual(43.9)
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M20 W WhatsApp hand-off (D14)', MODULE, () => {
  /** Intercepts every `wa.me` navigation of the context: aborts it and records the URL. */
  async function interceptWaMe(page: Page): Promise<string[]> {
    const urls: string[] = []
    await page.context().route('https://wa.me/**', async (route) => {
      urls.push(route.request().url())
      await route.abort()
    })
    return urls
  }

  test('E2E-M20-61/62 the button opens a new tab that hands over to wa.me; S7 stays open', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    const urls = await interceptWaMe(page)
    await gotoApp(`/marketplace/${SLUG_1}`)
    await expect(page.getByTestId('product-views')).toHaveText('31 tontonan')

    const popupPromise = page.waitForEvent('popup')
    await page.getByTestId('product-whatsapp').click()
    const popup = await popupPromise
    // The new tab boots the whole app before it hands over, so wait as long as a boot.
    await expect.poll(() => urls.length, { timeout: APP_BOOT_TIMEOUT_MS }).toBe(1)
    expect(urls[0]).toBe(
      'https://wa.me/60100000000?text=' +
        encodeURIComponent(
          'Salam, saya berminat dengan produk "Beg Sekolah Anti-Air Premium" di PRESTASIPLUS Marketplace.',
        ),
    )
    // No screen of its own was rendered in the new tab.
    await expect(popup.getByTestId('whatsapp-handoff')).toHaveCount(0)
    await popup.close()
    // S7 stays open and unchanged in the original tab (views are not changed by the hand-off).
    await expect(page).toHaveURL(new RegExp(`/marketplace/${SLUG_1}$`))
    await expect(page.getByTestId('product-name')).toHaveText('Beg Sekolah Anti-Air Premium')
    await expect(page.getByTestId('product-views')).toHaveText('31 tontonan')

    // A second click opens a second tab and records a second hand-off.
    const secondPromise = page.waitForEvent('popup')
    await page.getByTestId('product-whatsapp').click()
    const second = await secondPromise
    // The new tab boots the whole app before it hands over, so wait as long as a boot.
    await expect.poll(() => urls.length, { timeout: APP_BOOT_TIMEOUT_MS }).toBe(2)
    await second.close()
    await expect(page.getByTestId('product-name')).toBeVisible()
  })

  test('E2E-M20-63 an unknown slug on W renders the 404 page', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    const urls = await interceptWaMe(page)
    await gotoApp('/marketplace/tiada-produk-zzqxv/whatsapp')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
    expect(urls).toHaveLength(0)
  })
})
