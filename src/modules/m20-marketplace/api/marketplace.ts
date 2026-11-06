/**
 * M20 buyer endpoints (SRS M20 v1.2 §7 #13–#17), any signed-in role. UI tasks read this file and do
 * not change it. Errors reach the caller as `ApiError`: `401`, `404 NOT_FOUND` (unknown or hidden
 * slug / shop, BR-M20-08 -> the M01 global 404 page), 5xx.
 */

import type {
  MarketplaceAdminProductCreate,
  MarketplaceAdminProductDetail,
  MarketplaceAdminProductListQuery,
  MarketplaceAdminProductRow,
  MarketplaceAdminProductStats,
  MarketplaceAdminProductUpdate,
  MarketplaceAdminSellerDetail,
  MarketplaceAdminSellerListQuery,
  MarketplaceAdminSellerOption,
  MarketplaceAdminSellerRow,
  MarketplaceAdminSellerStats,
  MarketplaceSellerAction,
} from '@pp/contract'

import { api, API_ERROR_CODES, ApiError, isApiError, isHttpMode } from '@/api'
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

// --- Admin (S7-T08, API-ADM-19; role `admin`; ids are decimal strings) -------------------------------

const ADMIN = '/api/admin/marketplace'

export type AdminProductList = ListResult<MarketplaceAdminProductRow, { stats: MarketplaceAdminProductStats }>
export type AdminSellerList = ListResult<MarketplaceAdminSellerRow, { stats: MarketplaceAdminSellerStats }>

/** `GET /admin/marketplace/products` (P12-01; `meta.stats` is global, not the filtered query). */
export function fetchAdminProducts(
  query: MarketplaceAdminProductListQuery = {},
  options: Options = {},
): Promise<AdminProductList> {
  return api.list<MarketplaceAdminProductRow, { stats: MarketplaceAdminProductStats }>(`${ADMIN}/products`, {
    query: {
      q: query.q || null,
      categoryId: query.categoryId || null,
      status: query.status || null,
      page: query.page ?? null,
    },
    ...withSignal(options),
  })
}

/** `GET /admin/marketplace/products/:id` (edit form). */
export function fetchAdminProduct(id: string, options: Options = {}): Promise<MarketplaceAdminProductDetail> {
  return api.get<MarketplaceAdminProductDetail>(`${ADMIN}/products/${encodeURIComponent(id)}`, withSignal(options))
}

/** `POST /admin/marketplace/products` (201; 422 with `fields`). */
export function createAdminProduct(body: MarketplaceAdminProductCreate): Promise<MarketplaceAdminProductDetail> {
  return api.post<MarketplaceAdminProductDetail>(`${ADMIN}/products`, { body })
}

/** `PUT /admin/marketplace/products/:id` (only the keys sent change; `newImages` are appended). */
export function updateAdminProduct(
  id: string,
  body: MarketplaceAdminProductUpdate,
): Promise<MarketplaceAdminProductDetail> {
  return api.put<MarketplaceAdminProductDetail>(`${ADMIN}/products/${encodeURIComponent(id)}`, { body })
}

/** `DELETE /admin/marketplace/products/:id`. No orders exist, so nothing blocks a delete (OD-9). */
export function deleteAdminProduct(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`${ADMIN}/products/${encodeURIComponent(id)}`)
}

/** `DELETE /admin/marketplace/products/:id/images/:imageId` (its own action; answers the product). */
export function deleteAdminProductImage(id: string, imageId: string): Promise<MarketplaceAdminProductDetail> {
  return api.delete<MarketplaceAdminProductDetail>(
    `${ADMIN}/products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`,
  )
}

/** `GET /admin/marketplace/seller-options` (P12-02: "PRESTASIPLUS Official (Admin)" first, `id: null`). */
export function fetchAdminSellerOptions(options: Options = {}): Promise<MarketplaceAdminSellerOption[]> {
  return api.get<MarketplaceAdminSellerOption[]>(`${ADMIN}/seller-options`, withSignal(options))
}

/** `GET /admin/marketplace/sellers` (P2-13; `meta.stats` is global). */
export function fetchAdminSellers(
  query: MarketplaceAdminSellerListQuery = {},
  options: Options = {},
): Promise<AdminSellerList> {
  return api.list<MarketplaceAdminSellerRow, { stats: MarketplaceAdminSellerStats }>(`${ADMIN}/sellers`, {
    query: { status: query.status || null, page: query.page ?? null },
    ...withSignal(options),
  })
}

/** `GET /admin/marketplace/sellers/:id` ("Semak Penjual"). */
export function fetchAdminSeller(id: string, options: Options = {}): Promise<MarketplaceAdminSellerDetail> {
  return api.get<MarketplaceAdminSellerDetail>(`${ADMIN}/sellers/${encodeURIComponent(id)}`, withSignal(options))
}

/** `POST /admin/marketplace/sellers/:id/{approve,verify,suspend,ban}` (409 when not allowed from the current status). */
export function runAdminSellerAction(
  id: string,
  action: MarketplaceSellerAction,
): Promise<MarketplaceAdminSellerDetail> {
  return api.post<MarketplaceAdminSellerDetail>(`${ADMIN}/sellers/${encodeURIComponent(id)}/${action}`)
}

let mockUploads = 0
/**
 * Mock mode: the in-browser mock has no shared `/api/files` route (the router cannot decline a request, so a module
 * route would capture other modules' uploads). The upload is answered locally with a deterministic 22-character token
 * in the `FileRef.url` form the mock create / update accept; it is not loaded as a picture.
 */
function mockImageUrl(): string {
  mockUploads += 1
  return `/api/files/${`mockmpimg${String(mockUploads).padStart(13, '0')}`}`
}

/**
 * Best-effort cleanup of an image uploaded in the form and never attached to a product (`DELETE /api/files/:token`,
 * owner only). Never throws: a failed cleanup must not block the form. Mock mode stores nothing, so it does nothing.
 */
export async function discardMarketplaceImage(url: string): Promise<void> {
  if (!isHttpMode()) return
  const token = url.split('/').pop() ?? ''
  if (token === '') return
  try {
    await api.delete(`/api/files/${encodeURIComponent(token)}`)
  } catch {
    /* an orphan is left to the purge; the form carries on */
  }
}

/** Fallback text when an image upload is refused without a message of its own (P12-09). */
const IMAGE_REFUSED = 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.'

/**
 * `POST /api/files?purpose=marketplace_image` (multipart field `file`, admin only). Resolves to the
 * `FileRef.url` that `images` (create) / `newImages` (update) carry. A refusal is rethrown as a 422
 * `ApiError` keyed `images` so the form shows it under the image field; a network failure is rethrown as is.
 */
export async function uploadMarketplaceImage(file: Blob): Promise<string> {
  if (!isHttpMode()) return mockImageUrl()
  const form = new FormData()
  form.append('file', file)
  try {
    const stored = await api.multipart<{ id: string; url: string }>('/api/files', form, {
      query: { purpose: 'marketplace_image' },
    })
    return stored.url
  } catch (err) {
    if (!isApiError(err) || err.code === API_ERROR_CODES.NETWORK_ERROR) throw err
    const message = err.fields?.file ?? (err.message === '' ? IMAGE_REFUSED : err.message)
    throw new ApiError({
      status: 422,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message,
      fields: { images: message },
      cause: err,
    })
  }
}
