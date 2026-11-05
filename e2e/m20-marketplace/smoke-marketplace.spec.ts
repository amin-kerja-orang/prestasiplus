/**
 * M20 S6 `/marketplace` and S8 `/marketplace/penjual/:id` at 375 / 768 / 1280 (M20-T2; SRS M20 §12
 * E2E-M20-49..54, 64, 65 and the S6 / S8 part of 84 and 85). Developer smoke: titles carry the SRS
 * scenario ids. The seed is SRS §6.11 (10 products of seller 1 "JomBelajar Official", all active);
 * the viewer is account 2 `pelajar@demo.test` (a signed-in student).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  viewportWidth,
} from '../support'

import {
  applyButton,
  applyFilters,
  expectProductPhotosLoad,
  expectShellH1,
  expectShellTitle,
  filterOpenButton,
  filtersInline,
  openFilters,
  optionLabels,
  searchWith,
} from './helpers'

const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(20)] }

// Project clock pinned explicitly: "Bergabung {relative}" depends on it.
test.use({ mockInit: { latency: 0, now: '2026-09-25T15:40:00+08:00' } })

const cards = (page: Page) => page.getByTestId('product-card')
const cardIds = (page: Page) =>
  cards(page).evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-product-id'))))

/** The number of distinct left edges among the first cards = grid columns. */
async function columns(page: Page): Promise<number> {
  return page
    .getByTestId('product-grid')
    .first()
    .evaluate((grid) => {
      const xs = new Set(
        Array.from(grid.children).map((c) =>
          Math.round((c as HTMLElement).getBoundingClientRect().x),
        ),
      )
      return xs.size
    })
}

function expectedColumns(page: Page): number {
  const w = viewportWidth(page)
  return w >= 1280 ? 4 : w >= 768 ? 3 : 2
}

test.describe('M20 S6 Marketplace', MODULE, () => {
  test('E2E-M20-06/49 header, tab title, search card, chips and defaults', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/marketplace')
    await expectTabTitle(page, 'Marketplace | PRESTASIPLUS')
    await expectShellH1(page, 'Marketplace')
    await expect(page.getByTestId('marketplace-q')).toHaveAttribute(
      'placeholder',
      'Cari peralatan sekolah...',
    )
    // AC-MUR-32-4: below `md` the search stays on the page and the selects move into the sheet.
    if (!filtersInline(page)) {
      await expect(page.getByTestId('marketplace-q')).toBeVisible()
      await expect(page.getByTestId('marketplace-sort')).toHaveCount(0)
    }
    await openFilters(page)
    expect(await optionLabels(page, 'marketplace-category')).toEqual([
      'Semua Kategori',
      'Peralatan Sekolah',
      'Buku & Rujukan',
      'Uniform & Pakaian',
      'Stationery',
      'Digital & E-Book',
      'Lain-lain',
    ])
    expect(await optionLabels(page, 'marketplace-condition')).toEqual([
      'Semua Keadaan',
      'Baru',
      'Terpakai',
    ])
    expect(await optionLabels(page, 'marketplace-sort')).toEqual([
      'Terbaru',
      'Harga ↑',
      'Harga ↓',
      'Popular',
    ])
    await expect(page.getByTestId('marketplace-sort')).toHaveText('Terbaru')
    if (!filtersInline(page)) {
      // The selects are stacked in the sheet and fill its width (`w-full`).
      const cat = await page.getByTestId('marketplace-category').boundingBox()
      const cond = await page.getByTestId('marketplace-condition').boundingBox()
      const sort = await page.getByTestId('marketplace-sort').boundingBox()
      expect(cond!.y).toBeGreaterThanOrEqual(cat!.y + cat!.height - 1)
      expect(sort!.y).toBeGreaterThanOrEqual(cond!.y + cond!.height - 1)
      expect(Math.abs(cat!.width - sort!.width)).toBeLessThan(2)
      await expect(applyButton(page)).toHaveText('Guna')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('marketplace-sort')).toHaveCount(0)
    } else {
      if (viewportWidth(page) < 1024) {
        // At 768: search, category and condition on one row, then sort and the button.
        const q = await page.getByTestId('marketplace-q').boundingBox()
        const cat = await page.getByTestId('marketplace-category').boundingBox()
        const cond = await page.getByTestId('marketplace-condition').boundingBox()
        const sort = await page.getByTestId('marketplace-sort').boundingBox()
        expect(Math.abs(q!.y - cat!.y)).toBeLessThan(2)
        expect(Math.abs(cat!.y - cond!.y)).toBeLessThan(2)
        expect(sort!.y).toBeGreaterThan(cond!.y + cond!.height - 1)
      }
      await expect(applyButton(page)).toHaveText('Cari')
    }
    await expect(page.getByTestId('marketplace-chip-all')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('marketplace-chip-digital')).toHaveAttribute(
      'href',
      '/marketplace?category=digital',
    )
    await expect(page.getByTestId('marketplace-chips').locator('a')).toHaveText([
      'Semua',
      'Peralatan Sekolah',
      'Buku & Rujukan',
      'Uniform & Pakaian',
      'Stationery',
      'Digital & E-Book',
      'Lain-lain',
    ])
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M20-50 ten cards in id order with the observed content and real photos', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/marketplace')
    await expect(cards(page)).toHaveCount(10)
    expect(await cardIds(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const c1 = cards(page).nth(0)
    await expect(c1.getByTestId('product-card-discount')).toHaveText('-31%')
    await expect(c1.getByTestId('product-card-name')).toHaveText('Beg Sekolah Anti-Air Premium')
    await expect(c1.getByTestId('product-card-seller')).toHaveText('JomBelajar Official')
    await expect(c1.getByTestId('product-card-verified')).toBeVisible()
    await expect(c1.getByTestId('product-card-price')).toHaveText('RM 89.90')
    await expect(c1.getByTestId('product-card-original')).toHaveText('RM 129.90')
    await expect(c1.getByTestId('product-card-shipping')).toHaveText('Pos / Kurier (RM8.00)')
    const c3 = cards(page).nth(2)
    await expect(c3.getByTestId('product-card-discount')).toHaveText('-57%')
    await expect(c3.getByTestId('product-card-used')).toHaveText('Terpakai')
    await expect(c3.getByTestId('product-card-shipping')).toHaveText('Cash on Delivery (COD)')
    const c5 = cards(page).nth(4)
    await expect(c5.getByTestId('product-card-discount')).toHaveCount(0)
    await expect(c5.getByTestId('product-card-original')).toHaveCount(0)
    await expect(c5.getByTestId('product-card-shipping')).toHaveText('Penghantaran Percuma 🎉')
    await expect(cards(page).nth(8).getByTestId('product-card-shipping')).toHaveText(
      'Ambil Sendiri (Pickup)',
    )
    // Each shipping method keeps its own icon; colours follow B06 (79b5fa2dc), one accent only.
    await expect(c1.getByTestId('product-card-shipping-icon')).toHaveAttribute(
      'data-icon',
      'i-ph-truck-duotone',
    )
    await expect(c3.getByTestId('product-card-shipping-icon')).toHaveAttribute(
      'data-icon',
      'i-ph-hand-coins-duotone',
    )
    await expect(c5.getByTestId('product-card-shipping-icon')).toHaveAttribute(
      'data-icon',
      'i-ph-gift-duotone',
    )
    await expect(cards(page).nth(8).getByTestId('product-card-shipping-icon')).toHaveAttribute(
      'data-icon',
      'i-ph-map-pin-duotone',
    )
    await expect(c1.getByTestId('product-card-verified')).toHaveClass(/text-primary-t/)
    const cardBox = await c3.boundingBox()
    const imgBox = await c3.getByTestId('product-card-image').boundingBox()
    // The `UCard` body is `p-4 sm:p-5` (src/theme/ui.config.ts; B06 moved the card to `UCard`).
    const inset = viewportWidth(page) < 640 ? 16 : 20
    expect(Math.abs(imgBox!.x - cardBox!.x - inset)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(imgBox!.y - cardBox!.y - inset)).toBeLessThanOrEqual(1.5)
    await expectNoHorizontalScroll(page)
    const disc = await c3.getByTestId('product-card-discount').boundingBox()
    const used = await c3.getByTestId('product-card-used').boundingBox()
    expect(used!.y).toBeGreaterThanOrEqual(disc!.y + disc!.height - 1)
    expect(Math.abs(used!.x - disc!.x)).toBeLessThan(2)
    await expectProductPhotosLoad(page)
    await c1.click()
    await expect(page).toHaveURL(/\/marketplace\/beg-sekolah-anti-air-premium-vH1Fj$/)
  })

  test('E2E-M20-51/52/53 sorts, chips and combined filters', async ({ page, gotoApp, loginAs }) => {
    await loginAs(PELAJAR)
    await gotoApp('/marketplace')
    await expect(cards(page)).toHaveCount(10)
    await searchWith(page, [['marketplace-sort', 'Harga ↑']])
    await expect.poll(() => cardIds(page)).toEqual([9, 3, 8, 5, 6, 7, 4, 10, 2, 1])
    await searchWith(page, [['marketplace-sort', 'Harga ↓']])
    await expect.poll(() => cardIds(page)).toEqual([1, 2, 10, 4, 7, 6, 5, 8, 3, 9])
    await searchWith(page, [['marketplace-sort', 'Popular']])
    await expect.poll(() => cardIds(page)).toEqual([1, 8, 2, 3, 10, 5, 9, 4, 7, 6])

    await page.getByTestId('marketplace-chip-buku-rujukan').click()
    await expect(page).toHaveURL(/\/marketplace\?category=buku-rujukan$/)
    await expect(page.getByTestId('marketplace-chip-buku-rujukan')).toHaveAttribute(
      'data-active',
      'true',
    )
    await expect.poll(() => cardIds(page)).toEqual([7, 5, 2])
    await page.getByTestId('marketplace-chip-peralatan-sekolah').click()
    await expect.poll(() => cardIds(page)).toEqual([6, 1])
    await page.getByTestId('marketplace-chip-uniform-pakaian').click()
    await expect.poll(() => cardIds(page)).toEqual([10, 3])
    await page.getByTestId('marketplace-chip-stationery').click()
    await expect.poll(() => cardIds(page)).toEqual([9, 4])
    await page.getByTestId('marketplace-chip-lain-lain').click()
    await expect.poll(() => cardIds(page)).toEqual([8])

    await page.getByTestId('marketplace-chip-all').click()
    await searchWith(page, [['marketplace-condition', 'Terpakai']])
    await expect
      .poll(async () => (await cardIds(page)).slice().sort((a, b) => a - b))
      .toEqual([3, 7, 10])
    await searchWith(page, [['marketplace-condition', 'Baru']])
    await expect(cards(page)).toHaveCount(7)

    await page.getByTestId('marketplace-q').fill('beg')
    await searchWith(page, [
      ['marketplace-category', 'Peralatan Sekolah'],
      ['marketplace-condition', 'Baru'],
      ['marketplace-sort', 'Popular'],
    ])
    await expect.poll(() => cardIds(page)).toEqual([1])
    await expect(page).toHaveURL(/q=beg/)
    await expect(page).toHaveURL(/category=peralatan-sekolah/)
    await expect(page).toHaveURL(/condition=new/)
    await expect(page).toHaveURL(/sort=popular/)
    // The four values stay selected after the search (FR-M20-49), in the sheet below `md`.
    await expect(page.getByTestId('marketplace-q')).toHaveValue('beg')
    await openFilters(page)
    await expect(page.getByTestId('marketplace-category')).toHaveText('Peralatan Sekolah')
    await expect(page.getByTestId('marketplace-condition')).toHaveText('Baru')
    await expect(page.getByTestId('marketplace-sort')).toHaveText('Popular')
    if (!filtersInline(page)) await page.keyboard.press('Escape')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M20-54 no match, Digital, a page beyond the last: the empty state', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    for (const url of [
      '/marketplace?q=zzqxv',
      '/marketplace?category=digital',
      '/marketplace?page=2',
      '/marketplace?category=peralatan-sekolah&condition=used&sort=price_high',
    ]) {
      await gotoApp(url)
      const empty = page.getByTestId('marketplace-empty')
      // The 🛒 of live became a glyph with the restyle (B06, 79b5fa2dc; `DsEmptyState icon`).
      await expect(empty.locator('[data-ds="empty-state"] svg.iconify')).toBeVisible()
      await expect(empty).not.toContainText('🛒')
      await expect(empty).toContainText('Tiada Produk Dijumpai')
      await expect(empty).toContainText('Cuba tukar kata kunci atau kategori')
      await expect(cards(page)).toHaveCount(0)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M20-85/84 grid columns 2 / 3 / 4, no horizontal scroll, text >= 12 px, 44 px targets', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/marketplace')
    await expect(cards(page)).toHaveCount(10)
    expect(await columns(page)).toBe(expectedColumns(page))
    await expectNoHorizontalScroll(page)
    const small = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
      let min = Infinity
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim() || !n.parentElement) continue
        const style = getComputedStyle(n.parentElement)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        min = Math.min(min, parseFloat(style.fontSize))
      }
      return min
    })
    expect(small).toBeGreaterThanOrEqual(12)
    for (const id of ['marketplace-chip-all', 'marketplace-chip-digital']) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(43.9)
    }
    // Search and filter controls: on the page from `md`, in the sheet below it.
    await expectTouchTarget(page.getByTestId('marketplace-q'))
    if (!filtersInline(page)) await expectTouchTarget(filterOpenButton(page))
    await openFilters(page)
    for (const id of ['marketplace-category', 'marketplace-condition', 'marketplace-sort']) {
      await expectTouchTarget(page.getByTestId(id))
    }
    await expectTouchTarget(applyButton(page))
  })

  test('E2E-M20-19 a failed request shows the error box and "Cuba Semula" recovers', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/marketplace')
    await expect(cards(page)).toHaveCount(10)
    await mock.failNext('/api/marketplace/products', 500)
    await applyFilters(page)
    await expect(page.getByTestId('m20-load-error')).toContainText(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
    await page.getByTestId('m20-retry').click()
    await expect(cards(page)).toHaveCount(10)
  })
})

test.describe('M20 S8 Kedai Penjual', MODULE, () => {
  test('E2E-M20-07/64 header, tab title and the shop card', async ({ page, gotoApp, loginAs }) => {
    await loginAs(PELAJAR)
    await gotoApp('/marketplace/penjual/1')
    await expectTabTitle(page, 'JomBelajar Official - Marketplace | PRESTASIPLUS')
    await expectShellTitle(page, 'Kedai Penjual')
    await expect(page.getByTestId('marketplace-back')).toHaveText('Kembali ke Marketplace')
    await expect(page.getByTestId('marketplace-back')).toHaveAttribute('href', '/marketplace')
    await expect(page.getByTestId('shop-initial')).toHaveText('J')
    await expect(page.getByTestId('shop-name')).toHaveText('JomBelajar Official')
    await expect(page.getByTestId('shop-verified')).toBeVisible()
    await expect(page.getByTestId('shop-description')).toContainText('Kedai rasmi JomBelajar')
    await expect(page.getByTestId('shop-rating')).toHaveText('☆☆☆☆☆ (0)')
    await expect(page.getByTestId('shop-products')).toHaveText('10 produk')
    await expect(page.getByTestId('shop-joined')).toHaveText('Bergabung 7 bulan yang lepas')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M20-65 ten simple cards in id order and a card opens S7', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/marketplace/penjual/1')
    await expect(cards(page)).toHaveCount(10)
    expect(await cardIds(page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    await expect(page.getByTestId('product-card-discount')).toHaveCount(0)
    await expect(page.getByTestId('product-card-shipping')).toHaveCount(0)
    await expect(page.getByTestId('product-card-original')).toHaveCount(9)
    await expectProductPhotosLoad(page)
    expect(await columns(page)).toBe(expectedColumns(page))
    await expectNoHorizontalScroll(page)
    await cards(page).nth(1).click()
    await expect(page).toHaveURL(/\/marketplace\/set-buku-latihan-matematik-tahun-6-5-buku-PAjPe$/)
  })

  test('E2E-M20-12 unknown and non-numeric shop ids render the 404 page', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    for (const url of ['/marketplace/penjual/999', '/marketplace/penjual/abc']) {
      await gotoApp(url)
      await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
    }
  })

  test('E2E-M20-08 a guest is sent to /login', async ({ page, gotoApp }) => {
    await gotoApp('/marketplace')
    await expect(page).toHaveURL(/\/login/)
    await gotoApp('/marketplace/penjual/1')
    await expect(page).toHaveURL(/\/login/)
  })
})
