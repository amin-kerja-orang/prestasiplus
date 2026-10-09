// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import ProductGallery from '../../components/detail/ProductGallery.vue'
import ProductInfo from '../../components/detail/ProductInfo.vue'
import RelatedProducts from '../../components/detail/RelatedProducts.vue'
import ReviewsCard from '../../components/detail/ReviewsCard.vue'
import SellerPanel from '../../components/detail/SellerPanel.vue'
import { DETAIL_1, SELLER_CARD } from '../fixtures'

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
}

describe('ProductGallery', () => {
  it('shows the first image and swaps the main image on a thumbnail click', async () => {
    const w = mount(ProductGallery, { props: { images: DETAIL_1.images, name: DETAIL_1.name } })
    const thumbs = w.findAll('[data-testid="gallery-thumb"]')
    expect(thumbs).toHaveLength(4)
    expect(w.get('[data-testid="gallery-main"]').attributes('src')).toBe(DETAIL_1.images[0]!.url)
    expect(thumbs[0]!.attributes('data-active')).toBe('true')
    await thumbs[1]!.trigger('click')
    expect(w.get('[data-testid="gallery-main"]').attributes('src')).toBe(DETAIL_1.images[1]!.url)
    expect(thumbs[0]!.attributes('data-active')).toBe('false')
    expect(thumbs[1]!.attributes('data-active')).toBe('true')
    expect(thumbs[1]!.classes()).toContain('border-indigo-500')
  })

  it('shows the placeholder, with no thumbnails, for a product without an image', () => {
    const w = mount(ProductGallery, { props: { images: [], name: 'X' } })
    expect(w.find('[data-testid="gallery-main"]').exists()).toBe(false)
    expect(w.find('[data-testid="gallery-thumbs"]').exists()).toBe(false)
    expect(w.find('[data-testid="gallery-placeholder"]').exists()).toBe(true)
  })
})

describe('ProductInfo', () => {
  it('renders the details of S7 #1 with the post-increment views', () => {
    const w = mount(ProductInfo, { props: { product: DETAIL_1 }, global: { plugins: [router()] } })
    expect(w.get('[data-testid="product-condition"]').text()).toBe('Baru')
    expect(w.get('[data-testid="product-category"]').text()).toBe('Peralatan Sekolah')
    expect(w.get('h1').text()).toBe('Beg Sekolah Anti-Air Premium')
    expect(w.get('[data-testid="product-price"]').text()).toBe('RM 89.90')
    expect(w.get('[data-testid="product-original"]').text()).toBe('RM 129.90')
    expect(w.get('[data-testid="product-discount"]').text()).toBe('-31%')
    expect(w.get('[data-testid="product-views"]').text()).toBe('31 tontonan')
    expect(w.get('[data-testid="product-stock"]').text()).toBe('Ada Stok')
    expect(w.get('[data-testid="product-shipping-line"]').text()).toBe('Pos / Kurier (RM8.00)')
    expect(w.get('[data-testid="product-location"]').text()).toBe('Kuala Lumpur')
  })

  it('the WhatsApp button opens W in a new tab with no `rel` (FR-M20-57)', () => {
    const w = mount(ProductInfo, { props: { product: DETAIL_1 }, global: { plugins: [router()] } })
    const a = w.get('[data-testid="product-whatsapp"]')
    expect(a.text()).toBe('Hubungi Penjual di WhatsApp')
    expect(a.attributes('href')).toBe(`/marketplace/${DETAIL_1.slug}/whatsapp`)
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBeUndefined()
  })

  it('hides the struck price, the badge and the location when absent; "Habis Stok" when out of stock', () => {
    const w = mount(ProductInfo, {
      props: {
        product: {
          ...DETAIL_1,
          originalPrice: null,
          discountPct: null,
          location: '',
          stockStatus: 'out_of_stock',
          condition: 'used',
        },
      },
      global: { plugins: [router()] },
    })
    expect(w.find('[data-testid="product-original"]').exists()).toBe(false)
    expect(w.find('[data-testid="product-discount"]').exists()).toBe(false)
    expect(w.find('[data-testid="product-location"]').exists()).toBe(false)
    expect(w.get('[data-testid="product-stock"]').text()).toBe('Habis Stok')
    expect(w.get('[data-testid="product-stock"]').classes()).toContain('text-red-600')
    expect(w.get('[data-testid="product-condition"]').text()).toBe('Terpakai')
  })
})

describe('SellerPanel', () => {
  it('links the whole card to S8 with the initial, tick, stars and "{n} produk"', () => {
    const w = mount(SellerPanel, { props: { seller: SELLER_CARD }, global: { plugins: [router()] } })
    const link = w.get('[data-testid="seller-link"]')
    expect(link.attributes('href')).toBe('/marketplace/penjual/1')
    expect(w.get('[data-testid="seller-initial"]').text()).toBe('J')
    expect(w.get('[data-testid="seller-name"]').text()).toBe('JomBelajar Official')
    expect(w.find('[data-testid="seller-verified"]').exists()).toBe(true)
    expect(w.get('[data-testid="seller-rating"]').text()).toBe('☆☆☆☆☆')
    expect(w.get('[data-testid="seller-products"]').text()).toBe('10 produk')
  })

  it('a platform product shows "PRESTASIPLUS Official" without a link or a tick', () => {
    const w = mount(SellerPanel, { props: { seller: null }, global: { plugins: [router()] } })
    expect(w.find('a').exists()).toBe(false)
    expect(w.get('[data-testid="seller-platform"]').text()).toContain('PRESTASIPLUS Official')
    expect(w.find('[data-testid="seller-verified"]').exists()).toBe(false)
  })
})

describe('ReviewsCard', () => {
  it('shows "Ulasan (0)" with the empty text and no form', () => {
    const w = mount(ReviewsCard, { props: { reviews: [], count: 0 } })
    expect(w.get('[data-testid="reviews-title"]').text()).toBe('Ulasan (0)')
    expect(w.get('[data-testid="reviews-empty"]').text()).toBe('Belum ada ulasan untuk produk ini')
    expect(w.find('form').exists()).toBe(false)
    expect(w.find('textarea').exists()).toBe(false)
  })

  it('lists existing reviews', () => {
    const w = mount(ReviewsCard, {
      props: {
        reviews: [{ id: 1, userId: 2, rating: 4, text: 'Bagus', createdAt: '2026-09-01T10:00:00+08:00' }],
        count: 1,
      },
    })
    expect(w.get('[data-testid="reviews-title"]').text()).toBe('Ulasan (1)')
    expect(w.get('[data-testid="review-item"]').text()).toContain('★★★★☆')
    expect(w.find('[data-testid="reviews-empty"]').exists()).toBe(false)
  })
})

describe('RelatedProducts', () => {
  it('lists the related cards under "Produk Berkaitan"', () => {
    const w = mount(RelatedProducts, {
      props: { products: DETAIL_1.related },
      global: { plugins: [router()] },
    })
    expect(w.get('h2').text()).toBe('Produk Berkaitan')
    expect(w.findAll('[data-testid="product-card"]')).toHaveLength(1)
  })

  it('renders nothing when there is none', () => {
    const w = mount(RelatedProducts, { props: { products: [] }, global: { plugins: [router()] } })
    expect(w.find('[data-testid="related-products"]').exists()).toBe(false)
  })
})
