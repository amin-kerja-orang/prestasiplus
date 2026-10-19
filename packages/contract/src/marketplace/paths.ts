import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import {
  MARKETPLACE_ERRORS,
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
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

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
  id: IdSchema.meta({ description: 'Digits only; a non-numeric value answers 404 "Not Found.".' }),
})
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

/**
 * Registers the five buyer routes of M20 (BE-46). Bodies are `{ data }`, `{ data, meta }` or
 * `{ error }`. No response carries a credential or token, so none sends Cache-Control: no-store (D57(b)).
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
    responses: { 429: RATE_LIMITED, 200: json(MarketplaceProductResponseSchema, 'The product.'), 401: UNAUTHORIZED, 404: NOT_FOUND_PRODUCT },
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
      200: json(MarketplaceWhatsappResponseSchema, 'The hand-off URL.'),
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
