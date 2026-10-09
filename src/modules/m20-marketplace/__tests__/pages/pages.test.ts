// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables'

import MarketplacePage from '../../pages/MarketplacePage.vue'
import PenjualShopPage from '../../pages/PenjualShopPage.vue'
import ProductDetailPage from '../../pages/ProductDetailPage.vue'
import WhatsappHandoffPage from '../../pages/WhatsappHandoffPage.vue'
import marketplaceRoutes from '../../routes/marketplace'
import productRoutes from '../../routes/product'
import { CARD_1, CARD_5, CATEGORIES, DETAIL_1, SHOP_1, listOf } from '../fixtures'

const api = vi.hoisted(() => ({
  fetchMarketplaceCategories: vi.fn(),
  searchMarketplaceProducts: vi.fn(),
  fetchMarketplaceProduct: vi.fn(),
  fetchMarketplaceShop: vi.fn(),
  recordWhatsappClick: vi.fn(),
}))
vi.mock('../../api', () => api)

const notFound = () => new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' })
const serverError = () => new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' })

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(component: Component, path: string, url: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path, component, props: true }, { path: '/marketplace', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(component, {
    props: { ...router.currentRoute.value.params } as Record<string, string>,
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  setRouteOutcome(null)
  usePageMeta().reset()
  api.fetchMarketplaceCategories.mockResolvedValue(CATEGORIES)
  api.searchMarketplaceProducts.mockResolvedValue(listOf([CARD_1, CARD_5]))
  api.fetchMarketplaceProduct.mockResolvedValue(DETAIL_1)
  api.fetchMarketplaceShop.mockResolvedValue(SHOP_1)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('routes', () => {
  it('S6 / S8 are user-shell routes for every signed-in role with the live titles and headers', () => {
    const byPath = Object.fromEntries(marketplaceRoutes.map((r) => [r.path, r.meta]))
    expect(byPath['/marketplace']).toMatchObject({
      layout: 'user',
      access: 'auth',
      title: 'Marketplace - PRESTASIPLUS',
      header: { title: 'Marketplace', subtitle: 'Peralatan sekolah untuk pelajar 🛒' },
    })
    expect(byPath['/marketplace/penjual/:id']).toMatchObject({
      layout: 'user',
      header: { title: 'Kedai Penjual' },
    })
    for (const r of [...marketplaceRoutes, ...productRoutes]) expect(r.meta?.roles).toBeUndefined()
  })

  it('S7 is a user-shell route and W has no shell (D14)', () => {
    const byPath = Object.fromEntries(productRoutes.map((r) => [r.path, r.meta]))
    expect(byPath['/marketplace/:slug']).toMatchObject({ layout: 'user', header: { title: 'Marketplace' } })
    expect(byPath['/marketplace/:slug/whatsapp']).toMatchObject({ layout: 'bare', access: 'auth' })
  })
})

describe('S6 MarketplacePage', () => {
  it('requests #14 with the query values and renders the grid with the search card and chips', async () => {
    const w = await mountAt(
      MarketplacePage,
      '/marketplace',
      '/marketplace?q=beg&category=peralatan-sekolah&condition=new&sort=popular',
    )
    expect(api.searchMarketplaceProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'beg',
        category: 'peralatan-sekolah',
        condition: 'new',
        sort: 'popular',
        page: 1,
      }),
    )
    expect(w.findAll('[data-testid="product-card"]')).toHaveLength(2)
    expect(w.find('[data-testid="marketplace-empty"]').exists()).toBe(false)
    expect(w.findAll('a').some((a) => (a.attributes('href') ?? '').includes('page='))).toBe(false)
    expect(w.get<HTMLInputElement>('[data-testid="marketplace-q"]').element.value).toBe('beg')
    expect(w.get('[data-testid="marketplace-chip-peralatan-sekolah"]').attributes('data-active')).toBe(
      'true',
    )
  })

  it('shows "Tiada Produk Dijumpai" and no pager when nothing matches', async () => {
    api.searchMarketplaceProducts.mockResolvedValue(listOf([], 1))
    const w = await mountAt(MarketplacePage, '/marketplace', '/marketplace?q=zzqxv')
    const empty = w.get('[data-testid="marketplace-empty"]')
    expect(empty.text()).toContain('🛒')
    expect(empty.text()).toContain('Tiada Produk Dijumpai')
    expect(empty.text()).toContain('Cuba tukar kata kunci atau kategori')
    expect(w.find('[data-testid="product-grid"]').exists()).toBe(false)
  })

  it('page beyond the last: the empty state and no pager even when there are several pages', async () => {
    api.searchMarketplaceProducts.mockResolvedValue({
      data: [],
      meta: { page: 2, pageSize: 20, totalItems: 10, totalPages: 1 },
    })
    const w = await mountAt(MarketplacePage, '/marketplace', '/marketplace?page=2')
    expect(api.searchMarketplaceProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
    expect(w.find('[data-testid="marketplace-empty"]').exists()).toBe(true)
  })

  it('renders the pager only when there is more than one page and keeps the query', async () => {
    api.searchMarketplaceProducts.mockResolvedValue({
      data: [CARD_1],
      meta: { page: 1, pageSize: 20, totalItems: 35, totalPages: 2 },
    })
    const w = await mountAt(MarketplacePage, '/marketplace', '/marketplace?category=buku-rujukan')
    const hrefs = w.findAll('a').map((a) => a.attributes('href') ?? '')
    expect(hrefs.some((h) => h.includes('category=buku-rujukan') && h.includes('page=2'))).toBe(true)
  })

  it('a search pushes the four form values to the URL', async () => {
    const w = await mountAt(MarketplacePage, '/marketplace', '/marketplace')
    await w.get('[data-testid="marketplace-q"]').setValue('kamus')
    await w.get('[data-testid="marketplace-sort"]').setValue('price_low')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      q: 'kamus',
      category: '',
      condition: '',
      sort: 'price_low',
    })
    expect(api.searchMarketplaceProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'kamus', sort: 'price_low' }),
    )
  })

  it('a failed request shows the error box and "Cuba Semula" reloads', async () => {
    api.searchMarketplaceProducts.mockRejectedValueOnce(serverError())
    const w = await mountAt(MarketplacePage, '/marketplace', '/marketplace')
    expect(w.get('[data-testid="m20-load-error"]').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await w.get('[data-testid="m20-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="product-card"]')).toHaveLength(2)
  })
})

describe('S7 ProductDetailPage', () => {
  it('fetches #15 once, sets the header and the tab title, and shows the views of the response', async () => {
    const w = await mountAt(ProductDetailPage, '/marketplace/:slug', `/marketplace/${DETAIL_1.slug}`)
    expect(api.fetchMarketplaceProduct).toHaveBeenCalledTimes(1)
    expect(api.fetchMarketplaceProduct.mock.calls[0]![0]).toBe(DETAIL_1.slug)
    expect(usePageMeta().state.header).toEqual({
      title: 'Marketplace',
      subtitle: 'Peralatan Sekolah',
    })
    expect(document.title).toBe('Beg Sekolah Anti-Air Premium - Marketplace PRESTASIPLUS')
    expect(w.get('[data-testid="product-views"]').text()).toBe('31 tontonan')
    expect(w.get('[data-testid="marketplace-back"]').attributes('href')).toBe('/marketplace')
    expect(w.get('[data-testid="seller-link"]').attributes('href')).toBe('/marketplace/penjual/1')
    expect(w.get('[data-testid="reviews-title"]').text()).toBe('Ulasan (0)')
    expect(w.findAll('[data-testid="related-products"] [data-testid="product-card"]')).toHaveLength(1)
  })

  it('an unknown slug renders the in-place 404 outcome', async () => {
    api.fetchMarketplaceProduct.mockRejectedValue(notFound())
    const w = await mountAt(ProductDetailPage, '/marketplace/:slug', '/marketplace/tiada-produk-zzqxv')
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-testid="product-page"]').exists()).toBe(false)
  })

  it('another failure shows the error box, not the 404', async () => {
    api.fetchMarketplaceProduct.mockRejectedValue(serverError())
    const w = await mountAt(ProductDetailPage, '/marketplace/:slug', '/marketplace/x')
    expect(useRouteOutcome().value).toBeNull()
    expect(w.find('[data-testid="m20-load-error"]').exists()).toBe(true)
  })
})

describe('S8 PenjualShopPage', () => {
  it('renders the shop card and the simple grid; header and tab title carry the shop name', async () => {
    const w = await mountAt(PenjualShopPage, '/marketplace/penjual/:id', '/marketplace/penjual/1')
    expect(api.fetchMarketplaceShop).toHaveBeenCalledWith(1, expect.anything())
    expect(usePageMeta().state.header).toEqual({
      title: 'Kedai Penjual',
      subtitle: 'JomBelajar Official',
    })
    expect(document.title).toBe('JomBelajar Official - Marketplace PRESTASIPLUS')
    expect(w.get('[data-testid="shop-name"]').text()).toBe('JomBelajar Official')
    expect(w.findAll('[data-testid="product-card"]')).toHaveLength(2)
    expect(w.find('[data-testid="product-card-shipping"]').exists()).toBe(false)
    expect(w.get('[data-testid="marketplace-back"]').text()).toBe('Kembali ke Marketplace')
  })

  it('an unknown shop (404) and a non-numeric id both render the in-place 404 outcome', async () => {
    api.fetchMarketplaceShop.mockRejectedValue(notFound())
    await mountAt(PenjualShopPage, '/marketplace/penjual/:id', '/marketplace/penjual/999')
    expect(useRouteOutcome().value).toBe(404)
    wrapper?.unmount()
    setRouteOutcome(null)
    await mountAt(PenjualShopPage, '/marketplace/penjual/:id', '/marketplace/penjual/abc')
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('W WhatsappHandoffPage (D14)', () => {
  it('calls #16 once and replaces the tab location with the returned wa.me URL', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { replace })
    const url = 'https://wa.me/60100000000?text=Salam'
    api.recordWhatsappClick.mockResolvedValue({ url })
    const w = await mountAt(
      WhatsappHandoffPage,
      '/marketplace/:slug/whatsapp',
      `/marketplace/${DETAIL_1.slug}/whatsapp`,
    )
    expect(api.recordWhatsappClick).toHaveBeenCalledTimes(1)
    expect(api.recordWhatsappClick).toHaveBeenCalledWith(DETAIL_1.slug)
    expect(replace).toHaveBeenCalledWith(url)
    expect(w.text()).toBe('')
  })

  it('an unknown slug renders the 404 outcome and does not navigate', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { replace })
    api.recordWhatsappClick.mockRejectedValue(notFound())
    await mountAt(WhatsappHandoffPage, '/marketplace/:slug/whatsapp', '/marketplace/zzqxv/whatsapp')
    expect(useRouteOutcome().value).toBe(404)
    expect(replace).not.toHaveBeenCalled()
  })

  it('another failure shows the error box with a retry that hands over on success', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { replace })
    api.recordWhatsappClick.mockRejectedValueOnce(serverError())
    const w = await mountAt(WhatsappHandoffPage, '/marketplace/:slug/whatsapp', '/marketplace/x/whatsapp')
    expect(w.find('[data-testid="m20-load-error"]').exists()).toBe(true)
    expect(replace).not.toHaveBeenCalled()
    api.recordWhatsappClick.mockResolvedValue({ url: 'https://wa.me/1' })
    await w.get('[data-testid="m20-retry"]').trigger('click')
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('https://wa.me/1')
  })
})
