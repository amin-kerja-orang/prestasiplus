import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import {
  MARKETPLACE_ADMIN_ERRORS,
  MARKETPLACE_ERRORS,
  MarketplaceAdminDeletedSchema,
  MarketplaceAdminProductCreateSchema,
  MarketplaceAdminProductDetailSchema,
  MarketplaceAdminProductListMetaSchema,
  MarketplaceAdminProductListQuerySchema,
  MarketplaceAdminProductListResponseSchema,
  MarketplaceAdminProductResponseSchema,
  MarketplaceAdminProductRowSchema,
  MarketplaceAdminProductStatsSchema,
  MarketplaceAdminProductUpdateSchema,
  MarketplaceAdminSellerDetailSchema,
  MarketplaceAdminSellerListMetaSchema,
  MarketplaceAdminSellerListQuerySchema,
  MarketplaceAdminSellerListResponseSchema,
  MarketplaceAdminSellerOptionSchema,
  MarketplaceAdminSellerOptionsResponseSchema,
  MarketplaceAdminSellerResponseSchema,
  MarketplaceAdminSellerRowSchema,
  MarketplaceAdminSellerStatsSchema,
  MarketplaceProductStatusSchema,
  MarketplaceSellerActionSchema,
  MarketplaceSellerStatusSchema,
  MarketplaceCardSellerSchema,
  MarketplaceCategoryListResponseSchema,
  MarketplaceCategorySchema,
  MarketplaceConditionSchema,
  MarketplaceMoneySchema,
  MarketplaceProductCardSchema,
  MarketplaceProductDetailSchema,
  MarketplaceProductImageSchema,
  MarketplaceProductListResponseSchema,
  MarketplaceProductResponseSchema,
  MarketplaceProductReviewSchema,
  MarketplaceRatingStarsSchema,
  MarketplaceSearchQuerySchema,
  MarketplaceSellerCardSchema,
  MarketplaceShippingMethodSchema,
  MarketplaceShopResponseSchema,
  MarketplaceShopSchema,
  MarketplaceShopViewSchema,
  MarketplaceSortSchema,
  MarketplaceStockStatusSchema,
  MarketplaceWhatsappHandoffSchema,
  MarketplaceWhatsappResponseSchema,
  MarketplaceWhatsappUrlSchema,
} from './schema'

/** Components contributed by BE-46 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const MARKETPLACE_COMPONENT_SCHEMAS = {
  MarketplaceCondition: MarketplaceConditionSchema,
  MarketplaceStockStatus: MarketplaceStockStatusSchema,
  MarketplaceShippingMethod: MarketplaceShippingMethodSchema,
  MarketplaceSort: MarketplaceSortSchema,
  MarketplaceMoney: MarketplaceMoneySchema,
  MarketplaceRatingStars: MarketplaceRatingStarsSchema,
  MarketplaceWhatsappUrl: MarketplaceWhatsappUrlSchema,
  MarketplaceCategory: MarketplaceCategorySchema,
  MarketplaceCardSeller: MarketplaceCardSellerSchema,
  MarketplaceProductCard: MarketplaceProductCardSchema,
  MarketplaceProductImage: MarketplaceProductImageSchema,
  MarketplaceSellerCard: MarketplaceSellerCardSchema,
  MarketplaceProductReview: MarketplaceProductReviewSchema,
  MarketplaceProductDetail: MarketplaceProductDetailSchema,
  MarketplaceWhatsappHandoff: MarketplaceWhatsappHandoffSchema,
  MarketplaceShop: MarketplaceShopSchema,
  MarketplaceShopView: MarketplaceShopViewSchema,
  MarketplaceSearchQuery: MarketplaceSearchQuerySchema,
  MarketplaceCategoryListResponse: MarketplaceCategoryListResponseSchema,
  MarketplaceProductListResponse: MarketplaceProductListResponseSchema,
  MarketplaceProductResponse: MarketplaceProductResponseSchema,
  MarketplaceWhatsappResponse: MarketplaceWhatsappResponseSchema,
  MarketplaceShopResponse: MarketplaceShopResponseSchema,
  // S7-T08 admin slice (API-ADM-19)
  MarketplaceProductStatus: MarketplaceProductStatusSchema,
  MarketplaceSellerStatus: MarketplaceSellerStatusSchema,
  MarketplaceSellerAction: MarketplaceSellerActionSchema,
  MarketplaceAdminProductCreate: MarketplaceAdminProductCreateSchema,
  MarketplaceAdminProductUpdate: MarketplaceAdminProductUpdateSchema,
  MarketplaceAdminProductListQuery: MarketplaceAdminProductListQuerySchema,
  MarketplaceAdminSellerListQuery: MarketplaceAdminSellerListQuerySchema,
  MarketplaceAdminProductRow: MarketplaceAdminProductRowSchema,
  MarketplaceAdminProductDetail: MarketplaceAdminProductDetailSchema,
  MarketplaceAdminProductStats: MarketplaceAdminProductStatsSchema,
  MarketplaceAdminSellerStats: MarketplaceAdminSellerStatsSchema,
  MarketplaceAdminSellerRow: MarketplaceAdminSellerRowSchema,
  MarketplaceAdminSellerDetail: MarketplaceAdminSellerDetailSchema,
  MarketplaceAdminSellerOption: MarketplaceAdminSellerOptionSchema,
  MarketplaceAdminProductListMeta: MarketplaceAdminProductListMetaSchema,
  MarketplaceAdminSellerListMeta: MarketplaceAdminSellerListMetaSchema,
  MarketplaceAdminProductListResponse: MarketplaceAdminProductListResponseSchema,
  MarketplaceAdminProductResponse: MarketplaceAdminProductResponseSchema,
  MarketplaceAdminDeleted: MarketplaceAdminDeletedSchema,
  MarketplaceAdminSellerListResponse: MarketplaceAdminSellerListResponseSchema,
  MarketplaceAdminSellerResponse: MarketplaceAdminSellerResponseSchema,
  MarketplaceAdminSellerOptionsResponse: MarketplaceAdminSellerOptionsResponseSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
/** 200 that adds Cache-Control: no-store (the two routes that move a counter). */
const jsonNoStore = (schema: z.ZodType, description: string) => ({
  ...json(schema, description),
  headers: { 'Cache-Control': { description: 'no-store', schema: { type: 'string' as const } } },
})

/**
 * D57(a): every write route, and the product page GET that bumps `views`, can answer 429. Standard `{ error }`
 * body; the mock has no limiter.
 */
const RATE_LIMITED = {
  description:
    'RATE_LIMITED (BM "Terlalu banyak percubaan. Sila cuba sebentar lagi."): body error.retryAfter and the Retry-After header carry the seconds to wait.',
  headers: {
    'Retry-After': {
      description: 'Seconds until a retry is allowed (same value as error.retryAfter).',
      schema: { type: 'integer' as const, minimum: 0 },
    },
  },
  content: { 'application/json': { schema: ErrorBodySchema } },
}

const UNAUTHORIZED = err(`UNAUTHORIZED "${MARKETPLACE_ERRORS.UNAUTHORIZED.message}" (no valid session). Every role may call these routes.`)
const NOT_FOUND_PRODUCT = err(
  `NOT_FOUND "${MARKETPLACE_ERRORS.NOT_FOUND.message}": unknown slug, or a hidden product (status other than active, or the seller is not active). Nothing is counted.`,
)
const NOT_FOUND_SHOP = err(
  `NOT_FOUND "${MARKETPLACE_ERRORS.NOT_FOUND.message}": unknown id, non-numeric id, or a seller whose status is not active.`,
)
const FORBIDDEN_CSRF = err(`CSRF_INVALID "${MARKETPLACE_ERRORS.CSRF_INVALID.message}" (missing or wrong X-CSRF-Token).`)

const SlugParams = z.object({
  slug: z.string().min(1).meta({ description: 'Product slug (unique).' }),
})
const SellerIdParams = z.object({
  id: IdSchema.meta({ description: 'Digits only; a non-numeric value answers 404 "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?".' }),
})
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

/**
 * Registers the five buyer routes of M20 (BE-46). Bodies are `{ data }`, `{ data, meta }` or
 * `{ error }`. No response carries a credential or token. The product page GET and the WhatsApp POST add
 * Cache-Control: no-store because they move a counter; the other three routes set no cache header.
 * Seller and admin routes of the SRS have no mock route and are not registered.
 */
export function registerMarketplacePaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/marketplace/categories',
    tags: ['marketplace'],
    summary: 'Marketplace categories',
    description: 'The 6 constant categories (selects and chips), id ascending. No meta.',
    responses: { 200: json(MarketplaceCategoryListResponseSchema, 'Categories.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/marketplace/products',
    tags: ['marketplace'],
    summary: 'Search products',
    description:
      'Visible products only (status active and the seller, if any, active; stock does not matter). Filters combine with AND. 20 per page (fixed). Never answers 422: unknown values degrade as described per parameter.',
    request: { query: MarketplaceSearchQuerySchema },
    responses: { 200: json(MarketplaceProductListResponseSchema, 'A page of product cards with ListMeta.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/marketplace/products/{slug}',
    tags: ['marketplace'],
    summary: 'Product page',
    description:
      'Adds 1 to `views` on EVERY call (no de-duplication) and returns the new value. A hidden or unknown slug changes nothing.',
    request: { params: SlugParams },
    responses: { 429: RATE_LIMITED, 200: jsonNoStore(MarketplaceProductResponseSchema, 'The product.'), 401: UNAUTHORIZED, 404: NOT_FOUND_PRODUCT },
  })

  registry.registerPath({
    method: 'post',
    path: '/marketplace/products/{slug}/whatsapp',
    tags: ['marketplace'],
    summary: 'WhatsApp hand-off',
    description:
      'No body. A seller product adds 1 to the seller\'s WhatsApp click counter and returns the seller\'s wa.me URL; a platform product counts nothing and returns the platform number (server configuration). The server never calls WhatsApp or sends a message (D14); the caller navigates to the URL.',
    request: { params: SlugParams, headers: [csrf] },
    responses: {
      429: RATE_LIMITED,
      200: jsonNoStore(MarketplaceWhatsappResponseSchema, 'The hand-off URL.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      404: NOT_FOUND_PRODUCT,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/marketplace/sellers/{id}',
    tags: ['marketplace'],
    summary: 'Public shop page',
    description: 'Active sellers only. `products` are the shop\'s visible products, newest first, not paginated.',
    request: { params: SellerIdParams },
    responses: { 200: json(MarketplaceShopResponseSchema, 'The shop and its products.'), 401: UNAUTHORIZED, 404: NOT_FOUND_SHOP },
  })
}

// --- admin slice (S7-T08, API-ADM-19) ---------------------------------------------------------------

const ADMIN_FORBIDDEN = err(`FORBIDDEN "${MARKETPLACE_ADMIN_ERRORS.FORBIDDEN.message}": every role except admin (teacher, pupil, school_admin, ppd_officer).`)
const ADMIN_NOT_FOUND = err(`NOT_FOUND "${MARKETPLACE_ERRORS.NOT_FOUND.message}": unknown or non-numeric id.`)
const ADMIN_VALIDATION = err(
  'VALIDATION_ERROR (422) with `fields.<name>`: sellerId "Penjual diperlukan." (also an unknown or non-active seller, [PROPOSED] "Penjual tidak sah."); name "Nama produk diperlukan."; categoryId "Kategori diperlukan."; originalPrice "Harga asal mesti lebih besar daripada harga."; images / newImages "Maksimum 5 gambar." (more than 5 in total) and "Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB." (not a stored marketplace_image file). Ranges: name <= 120, price 0.01..100000, description <= 2000, shippingFee 0..1000, location <= 100. Unknown keys: "The <key> field is not allowed.".',
)
const ADMIN_CONFLICT = err(`CONFLICT "${MARKETPLACE_ADMIN_ERRORS.CONFLICT.message}": the action is not allowed from the seller's current status.`)

const ProductIdParams = z.object({ id: IdSchema.meta({ description: 'Product id. A non-numeric value answers 404.' }) })
const ProductImageParams = z.object({
  id: IdSchema.meta({ description: 'Product id.' }),
  imageId: IdSchema.meta({ description: 'Image id; must belong to the product, else 404.' }),
})
const AdminSellerIdParams = z.object({ id: IdSchema.meta({ description: 'Seller id. A non-numeric value answers 404.' }) })
const ADMIN_TAG = ['marketplace-admin']

/**
 * Registers the admin routes of M20 (S7-T08, API-ADM-19). Role `admin` only (401 without a session, 403 for any
 * other role). All answers are `no-store`. Every write needs `X-CSRF-Token`, is rate limited (429) and audited.
 */
export function registerMarketplaceAdminPaths(registry: OpenAPIRegistry): void {
  const base = '/admin/marketplace'
  const common = { 401: UNAUTHORIZED, 403: ADMIN_FORBIDDEN }

  registry.registerPath({
    method: 'get',
    path: `${base}/products`,
    tags: ADMIN_TAG,
    summary: 'Admin product list (P2-12)',
    description:
      'All products whatever their status or seller status (not the pupil visibility rule). Filters combine with AND: `q` (name substring), `categoryId`, `status` (active=Aktif, draft=Draf, rejected=Ditolak). Newest first, 20 per page. `meta.totalItems` is the "{n} produk dijumpai" count; `meta.stats` are the global stat cards (`Jumlah Produk`, `Aktif`), never the filtered query.',
    request: { query: MarketplaceAdminProductListQuerySchema },
    responses: { 200: json(MarketplaceAdminProductListResponseSchema, 'A page of rows with ListMeta and stats.'), 422: ADMIN_VALIDATION, ...common },
  })

  registry.registerPath({
    method: 'get',
    path: `${base}/products/{id}`,
    tags: ADMIN_TAG,
    summary: 'Admin product detail (edit form)',
    request: { params: ProductIdParams },
    responses: { 200: json(MarketplaceAdminProductResponseSchema, 'The product with its images by position.'), 404: ADMIN_NOT_FOUND, ...common },
  })

  registry.registerPath({
    method: 'post',
    path: `${base}/products`,
    tags: ADMIN_TAG,
    summary: 'Create a product',
    description:
      'Generates a unique `slug` (name + 5 random characters). `sellerId: null` is the official seller; any other seller must be `active`. `status` defaults to `active`. Images are `FileRef.url` values of `marketplace_image` uploads (stored as given). Audited.',
    request: { headers: [csrf], body: { required: true, content: { 'application/json': { schema: MarketplaceAdminProductCreateSchema } } } },
    responses: { 201: json(MarketplaceAdminProductResponseSchema, 'The created product.'), 422: ADMIN_VALIDATION, 429: RATE_LIMITED, 403: ADMIN_FORBIDDEN, 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'put',
    path: `${base}/products/{id}`,
    tags: ADMIN_TAG,
    summary: 'Update a product (partial)',
    description:
      'Only the keys sent change; `null` clears an optional field. `Nyahaktif` is `{status:"draft"}` and `Aktifkan` is `{status:"active"}`. `newImages` are appended (total at most 5). The slug never changes. Audited.',
    request: { params: ProductIdParams, headers: [csrf], body: { required: true, content: { 'application/json': { schema: MarketplaceAdminProductUpdateSchema } } } },
    responses: { 200: json(MarketplaceAdminProductResponseSchema, 'The updated product.'), 404: ADMIN_NOT_FOUND, 422: ADMIN_VALIDATION, 429: RATE_LIMITED, ...common },
  })

  registry.registerPath({
    method: 'delete',
    path: `${base}/products/{id}`,
    tags: ADMIN_TAG,
    summary: 'Delete a product',
    description: 'Hard delete; images and reviews cascade and the stored image files are removed. No order-based block (there is no order table). Audited.',
    request: { params: ProductIdParams, headers: [csrf] },
    responses: { 200: json(MarketplaceAdminDeletedSchema, 'The deleted id.'), 404: ADMIN_NOT_FOUND, 429: RATE_LIMITED, ...common },
  })

  registry.registerPath({
    method: 'delete',
    path: `${base}/products/{id}/images/{imageId}`,
    tags: ADMIN_TAG,
    summary: 'Delete one product image',
    description: 'Its own action (D-M20-01): it never touches the product fields. The other images keep their positions. Audited.',
    request: { params: ProductImageParams, headers: [csrf] },
    responses: { 200: json(MarketplaceAdminProductResponseSchema, 'The product after the delete.'), 404: ADMIN_NOT_FOUND, 429: RATE_LIMITED, ...common },
  })

  registry.registerPath({
    method: 'get',
    path: `${base}/seller-options`,
    tags: ADMIN_TAG,
    summary: 'Seller select of the product form (P12-02)',
    description: 'The official seller first (`id` null, "PRESTASIPLUS Official (Admin)"), then the `active` sellers by shop name.',
    responses: { 200: json(MarketplaceAdminSellerOptionsResponseSchema, 'Options.'), ...common },
  })

  registry.registerPath({
    method: 'get',
    path: `${base}/sellers`,
    tags: ADMIN_TAG,
    summary: 'Admin seller list (P2-13)',
    description:
      'Filter `status` (pending=Pending, active=Aktif, suspended=Digantung, banned=Diharamkan). Newest first, 20 per page. `meta.totalItems` is the "{n} penjual dijumpai" count; `meta.stats` are global (`Jumlah Penjual`, `Aktif`, `Menunggu Pengesahan`).',
    request: { query: MarketplaceAdminSellerListQuerySchema },
    responses: { 200: json(MarketplaceAdminSellerListResponseSchema, 'A page of sellers with ListMeta and stats.'), 422: ADMIN_VALIDATION, ...common },
  })

  registry.registerPath({
    method: 'get',
    path: `${base}/sellers/{id}`,
    tags: ADMIN_TAG,
    summary: 'Admin seller detail ("Semak Penjual")',
    request: { params: AdminSellerIdParams },
    responses: { 200: json(MarketplaceAdminSellerResponseSchema, 'The seller.'), 404: ADMIN_NOT_FOUND, ...common },
  })

  const transitions: [string, string, string][] = [
    ['approve', 'Luluskan', 'pending or suspended -> active'],
    ['verify', 'Sahkan', 'active and not yet verified: sets `verified_at` (status unchanged)'],
    ['suspend', 'Gantung', 'active -> suspended'],
    ['ban', 'Haramkan', 'pending, active or suspended -> banned (terminal); atomic'],
  ]
  for (const [action, label, rule] of transitions) {
    registry.registerPath({
      method: 'post',
      path: `${base}/sellers/{id}/${action}`,
      tags: ADMIN_TAG,
      summary: `${label} penjual`,
      description: `${rule}. Any other starting status is 409. The seller's products leave the pupil Marketplace at once on suspend and ban. No body. Audited.`,
      request: { params: AdminSellerIdParams, headers: [csrf] },
      responses: { 200: json(MarketplaceAdminSellerResponseSchema, 'The seller after the transition.'), 404: ADMIN_NOT_FOUND, 409: ADMIN_CONFLICT, 429: RATE_LIMITED, ...common },
    })
  }
}
