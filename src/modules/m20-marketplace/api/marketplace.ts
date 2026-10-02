/**
 * M20 buyer endpoints (SRS M20 v1.2 §7 #13–#17), any signed-in role. UI tasks read this file and do
 * not change it. Errors reach the caller as `ApiError`: `401`, `404 NOT_FOUND` (unknown or hidden
 * slug / shop, BR-M20-08 -> the M01 global 404 page), 5xx.
 */

import { api } from '@/api'
import type { ListResult } from '@/api/envelope'

import type {
  MarketplaceCategory,
  ProductCard,
  ProductDetail,
  ProductSearchQuery,
  ShopView,
  WhatsappHandoff,
} from './types'

type Options = { signal?: AbortSignal }
const withSignal = (o: Options) => (o.signal ? { signal: o.signal } : {})

/** #13 `GET /api/marketplace/categories`: the 6 constant categories (selects, chips). */
export function fetchMarketplaceCategories(options: Options = {}): Promise<MarketplaceCategory[]> {
  return api.get<MarketplaceCategory[]>('/api/marketplace/categories', withSignal(options))
}

/** #14 `GET /api/marketplace/products` (S6; 20 per page; `meta.totalPages > 1` shows the pager). */
export function searchMarketplaceProducts(
  query: ProductSearchQuery = {},
): Promise<ListResult<ProductCard>> {
  return api.list<ProductCard>('/api/marketplace/products', {
    query: {
      q: query.q || null,
      category: query.category || null,
      condition: query.condition || null,
      sort: query.sort ?? null,
      page: query.page ?? null,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #15 `GET /api/marketplace/products/:slug` (S7). Every call adds 1 to `views` (BR-M20-12). */
export function fetchMarketplaceProduct(
  slug: string,
  options: Options = {},
): Promise<ProductDetail> {
  return api.get<ProductDetail>(
    `/api/marketplace/products/${encodeURIComponent(slug)}`,
    withSignal(options),
  )
}

/** #16 `POST /api/marketplace/products/:slug/whatsapp` (W; records the click, returns the wa.me URL, D14). */
export function recordWhatsappClick(slug: string): Promise<WhatsappHandoff> {
  return api.post<WhatsappHandoff>(`/api/marketplace/products/${encodeURIComponent(slug)}/whatsapp`)
}

/** #17 `GET /api/marketplace/sellers/:id` (S8; 404 unless the seller is active). */
export function fetchMarketplaceShop(sellerId: number, options: Options = {}): Promise<ShopView> {
  return api.get<ShopView>(`/api/marketplace/sellers/${String(sellerId)}`, withSignal(options))
}
