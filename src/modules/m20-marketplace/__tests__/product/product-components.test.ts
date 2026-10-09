// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import CategoryChips from '../../components/product/CategoryChips.vue'
import {
  formatPrice,
  readBuyerQuery,
  readPage,
  shippingKindOf,
} from '../../components/product/copy'
import ProductCard from '../../components/product/ProductCard.vue'
import ProductFilters from '../../components/product/ProductFilters.vue'
import ShopCard from '../../components/product/ShopCard.vue'
import { shippingLine } from '../../mock/repository/format'
import { CARD_1, CARD_3, CARD_5, CATEGORIES, SHOP_1 } from '../fixtures'

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
}

describe('format helpers', () => {
  it('formats prices as "RM 89.90"', () => {
    expect(formatPrice('89.90')).toBe('RM 89.90')
    expect(formatPrice('15')).toBe('RM 15.00')
  })

  it('reads the four filter values and the page from a route query', () => {
    expect(
      readBuyerQuery({ q: 'beg', category: ['a', 'b'], condition: 3, sort: 'popular' }),
    ).toEqual({
      q: 'beg',
      category: 'a',
      condition: '',
      sort: 'popular',
    })
    expect(readPage({})).toBe(1)
    expect(readPage({ page: '3' })).toBe(3)
    expect(readPage({ page: '0' })).toBe(1)
    expect(readPage({ page: 'x' })).toBe(1)
    expect(readPage({ page: '1.5' })).toBe(1)
  })
})

describe('ProductCard', () => {
  it('full: badge, seller with tick, prices and the shipping line, one link to S7', () => {
    const r = router()
    const w = mount(ProductCard, { props: { product: CARD_1 }, global: { plugins: [r] } })
    expect(w.element.tagName).toBe('A')
    expect(w.attributes('href')).toBe(`/marketplace/${CARD_1.slug}`)
    expect(w.get('[data-testid="product-card-discount"]').text()).toBe('-31%')
    expect(w.find('[data-testid="product-card-used"]').exists()).toBe(false)
    expect(w.get('[data-testid="product-card-name"]').text()).toBe('Beg Sekolah Anti-Air Premium')
    expect(w.get('[data-testid="product-card-seller"]').text()).toBe('JomBelajar Official')
    expect(w.find('[data-testid="product-card-verified"]').exists()).toBe(true)
    expect(w.get('[data-testid="product-card-price"]').text()).toBe('RM 89.90')
    expect(w.get('[data-testid="product-card-original"]').text()).toBe('RM 129.90')
    expect(w.get('[data-testid="product-card-shipping"]').text()).toBe('Pos / Kurier (RM8.00)')
  })

  it('full: the "Terpakai" badge for a used item; no badge or struck price without an original', () => {
    const r = router()
    const used = mount(ProductCard, { props: { product: CARD_3 }, global: { plugins: [r] } })
    expect(used.get('[data-testid="product-card-used"]').text()).toBe('Terpakai')
    const free = mount(ProductCard, { props: { product: CARD_5 }, global: { plugins: [r] } })
    expect(free.find('[data-testid="product-card-discount"]').exists()).toBe(false)
    expect(free.find('[data-testid="product-card-original"]').exists()).toBe(false)
    expect(free.find('[data-testid="product-card-seller"]').exists()).toBe(false)
    expect(free.get('[data-testid="product-card-shipping"]').text()).toBe('Penghantaran Percuma 🎉')
  })

  it('shows the neutral placeholder (no generated image) when there is no thumbnail', () => {
    const w = mount(ProductCard, { props: { product: CARD_5 }, global: { plugins: [router()] } })
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('[data-testid="product-card-placeholder"]').exists()).toBe(true)
  })

  it('simple (S8): image, name, price and struck original only', () => {
    const w = mount(ProductCard, {
      props: { product: CARD_1, variant: 'simple' },
      global: { plugins: [router()] },
    })
    expect(w.find('[data-testid="product-card-discount"]').exists()).toBe(false)
    expect(w.find('[data-testid="product-card-seller"]').exists()).toBe(false)
    expect(w.find('[data-testid="product-card-shipping"]').exists()).toBe(false)
    expect(w.get('[data-testid="product-card-original"]').text()).toBe('RM 129.90')
  })

  it('related (S7): name and price only', () => {
    const w = mount(ProductCard, {
      props: { product: CARD_1, variant: 'related' },
      global: { plugins: [router()] },
    })
    expect(w.find('[data-testid="product-card-original"]').exists()).toBe(false)
    expect(w.get('[data-testid="product-card-price"]').text()).toBe('RM 89.90')
  })
})

describe('CategoryChips', () => {
  it('links every chip to ?category={slug} only and marks the current one active', () => {
    const w = mount(CategoryChips, {
      props: { categories: CATEGORIES, active: 'buku-rujukan' },
      global: { plugins: [router()] },
    })
    const all = w.get('[data-testid="marketplace-chip-all"]')
    expect(all.attributes('href')).toBe('/marketplace')
    expect(all.attributes('data-active')).toBe('false')
    const chip = w.get('[data-testid="marketplace-chip-buku-rujukan"]')
    expect(chip.attributes('href')).toBe('/marketplace?category=buku-rujukan')
    expect(chip.attributes('data-active')).toBe('true')
    expect(chip.classes()).toContain('bg-indigo-500')
    expect(w.findAll('a')).toHaveLength(7)
    expect(w.get('[data-testid="marketplace-chip-lain-lain"]').text()).toBe('Lain-lain')
  })

  it('"Semua" is active with no category', () => {
    const w = mount(CategoryChips, {
      props: { categories: CATEGORIES, active: '' },
      global: { plugins: [router()] },
    })
    expect(w.get('[data-testid="marketplace-chip-all"]').attributes('data-active')).toBe('true')
  })
})

describe('ProductFilters', () => {
  it('renders the four controls with the current values and emits them on submit', async () => {
    const w = mount(ProductFilters, {
      props: {
        categories: CATEGORIES,
        query: { q: 'beg', category: 'peralatan-sekolah', condition: 'new', sort: 'popular' },
      },
    })
    const q = w.get<HTMLInputElement>('[data-testid="marketplace-q"]')
    expect(q.element.placeholder).toBe('Cari peralatan sekolah...')
    expect(q.element.value).toBe('beg')
    expect(w.get<HTMLSelectElement>('[data-testid="marketplace-category"]').element.value).toBe(
      'peralatan-sekolah',
    )
    expect(w.get<HTMLSelectElement>('[data-testid="marketplace-condition"]').element.value).toBe(
      'new',
    )
    expect(w.get<HTMLSelectElement>('[data-testid="marketplace-sort"]').element.value).toBe(
      'popular',
    )
    expect(w.get('[data-testid="marketplace-submit"]').text()).toBe('Cari')
    expect(w.findAll('[data-testid="marketplace-category"] option').map((o) => o.text())).toEqual([
      'Semua Kategori',
      ...CATEGORIES.map((c) => c.name),
    ])
    expect(w.findAll('[data-testid="marketplace-sort"] option').map((o) => o.text())).toEqual([
      'Terbaru',
      'Harga ↑',
      'Harga ↓',
      'Popular',
    ])
    await w.get('form').trigger('submit')
    expect(w.emitted('search')?.[0]).toEqual([
      { q: 'beg', category: 'peralatan-sekolah', condition: 'new', sort: 'popular' },
    ])
  })

  it('defaults the sort to "Terbaru" (latest) when the query has none', () => {
    const w = mount(ProductFilters, {
      props: { categories: CATEGORIES, query: { q: '', category: '', condition: '', sort: '' } },
    })
    expect(w.get<HTMLSelectElement>('[data-testid="marketplace-sort"]').element.value).toBe(
      'latest',
    )
  })
})

describe('ShopCard', () => {
  // Pin the project clock: "Bergabung" is relative to now (seed createdAt 2026-02-09).
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the initial, name with tick, stars with the count, "{n} produk" and "Bergabung"', () => {
    const w = mount(ShopCard, { props: { shop: SHOP_1.shop } })
    expect(w.get('[data-testid="shop-initial"]').text()).toBe('J')
    expect(w.get('h1').text()).toBe('JomBelajar Official')
    expect(w.find('[data-testid="shop-verified"]').exists()).toBe(true)
    expect(w.get('[data-testid="shop-rating"]').text()).toBe('☆☆☆☆☆ (0)')
    expect(w.get('[data-testid="shop-products"]').text()).toBe('10 produk')
    expect(w.get('[data-testid="shop-joined"]').text()).toBe('Bergabung 7 bulan yang lepas')
  })
})

describe('shipping icon per method', () => {
  it('maps every shipping line the formatter produces to its method', () => {
    expect(shippingKindOf(shippingLine('postage', '8.00'))).toBe('postage')
    expect(shippingKindOf(shippingLine('postage', null))).toBe('postage')
    expect(shippingKindOf(shippingLine('free', null))).toBe('free')
    expect(shippingKindOf(shippingLine('cod', null))).toBe('cod')
    expect(shippingKindOf(shippingLine('pickup', null))).toBe('pickup')
  })

  it('renders the matching icon colour on the card', () => {
    const colour = (line: string) => {
      const w = mount(ProductCard, {
        props: { product: { ...CARD_1, shippingLine: line } },
        global: { plugins: [router()] },
      })
      return w.get('[data-testid="product-card-shipping-icon"]').classes()
    }
    expect(colour(shippingLine('postage', '8.00'))).toContain('text-indigo-400')
    expect(colour(shippingLine('free', null))).toContain('text-slate-400')
    expect(colour(shippingLine('cod', null))).toContain('text-slate-400')
    expect(colour(shippingLine('pickup', null))).toContain('text-red-500')
  })
})
