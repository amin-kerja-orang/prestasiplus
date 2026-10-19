import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { ListMetaSchema } from '../common/envelope'
import { TimestampSchema } from '../common/time'

/**
 * M20 Marketplace, buyer slice (BE-46): five routes, any signed-in role (D53a). There is no cart,
 * order or payment (D14): the buyer is handed to WhatsApp and the server never sends a message.
 *
 * The frontend mock (`src/modules/m20-marketplace`, wire types `api/types.ts`) is the wire spec.
 * Differences from the mock: every id is a decimal-string `Id` (D53 UD-1), where the mock has
 * integers (`id`, `categoryId`, image `id`, review `id` and `userId`, seller `id`). Everything else
 * keeps the mock's field names and copy.
 *
 * Prices are decimal STRINGS with exactly two decimals ("89.90"; `numeric(10,2)`, never floats).
 * Instants are ISO 8601 with `+08:00`.
 */

// --- enums ---------------------------------------------------------------------------------------

/** `condition` of a product (the only values a product can have). */
export const MARKETPLACE_CONDITIONS = ['new', 'used'] as const
export const MarketplaceConditionSchema = z.enum(MARKETPLACE_CONDITIONS).meta({ id: 'MarketplaceCondition' })
export type MarketplaceCondition = z.infer<typeof MarketplaceConditionSchema>

/** Stock never hides a product (BR-M20-08): `out_of_stock` products stay visible. */
export const MARKETPLACE_STOCK_STATUSES = ['available', 'out_of_stock'] as const
export const MarketplaceStockStatusSchema = z.enum(MARKETPLACE_STOCK_STATUSES).meta({ id: 'MarketplaceStockStatus' })
export type MarketplaceStockStatus = z.infer<typeof MarketplaceStockStatusSchema>

export const MARKETPLACE_SHIPPING_METHODS = ['pickup', 'postage', 'cod', 'free'] as const
export const MarketplaceShippingMethodSchema = z.enum(MARKETPLACE_SHIPPING_METHODS).meta({ id: 'MarketplaceShippingMethod' })
export type MarketplaceShippingMethod = z.infer<typeof MarketplaceShippingMethodSchema>

/** Sort keys of the search (BR-M20-05). An unknown value behaves as `latest`; it is not an error. */
export const MARKETPLACE_SORTS = ['latest', 'price_low', 'price_high', 'popular'] as const
export const MarketplaceSortSchema = z.enum(MARKETPLACE_SORTS).meta({ id: 'MarketplaceSort' })
export type MarketplaceSort = z.infer<typeof MarketplaceSortSchema>

/** Page size of the search, fixed (the route ignores `pageSize`). */
export const MARKETPLACE_PAGE_SIZE = 20
/** `related` of the product page: at most 4 (BR-M20-20). */
export const MARKETPLACE_RELATED_LIMIT = 4
/** `q` is trimmed and cut to 100 characters (V-M20-03). */
export const MARKETPLACE_QUERY_MAX = 100

// --- errors (copy is the project's generic copy, see mock `respond.ts`) -----------------------------

/** Codes these routes answer, with status and the exact message the mock sends. */
export const MARKETPLACE_ERRORS = {
  UNAUTHORIZED: { status: 401, message: 'Unauthenticated.' },
  /** Unknown or hidden slug, unknown or non-active shop, non-numeric shop id. Nothing changes. */
  NOT_FOUND: { status: 404, message: 'Not Found.' },
  /** POST only: missing or wrong `X-CSRF-Token`. The message is the session contract's. */
  CSRF_INVALID: { status: 403, message: 'Sesi tidak sah. Sila muat semula halaman dan cuba lagi.' },
} as const

// --- value types ---------------------------------------------------------------------------------

/** RM amount as a decimal string with exactly two decimals. */
export const MarketplaceMoneySchema = z
  .string()
  .regex(/^\d+\.\d{2}$/, 'Amount must be a decimal string with 2 decimals')
  .meta({ id: 'MarketplaceMoney', description: 'RM amount, decimal string with 2 decimals.', example: '89.90' })
export type MarketplaceMoney = z.infer<typeof MarketplaceMoneySchema>

/** Five characters: `round(average)` times "★", then "☆" for the rest ("☆☆☆☆☆" without reviews, BR-M20-16). */
export const MarketplaceRatingStarsSchema = z
  .string()
  .length(5)
  .regex(/^★*☆*$/)
  .meta({ id: 'MarketplaceRatingStars', description: 'Five characters, "★" then "☆".', example: '★★★★☆' })
export type MarketplaceRatingStars = z.infer<typeof MarketplaceRatingStarsSchema>

/** `https://wa.me/{number}?text=...` (BR-M20-21). Built by the server; the caller only navigates to it (D14). */
export const MarketplaceWhatsappUrlSchema = z
  .string()
  .regex(/^https:\/\/wa\.me\/\d+\?text=.+$/)
  .meta({ id: 'MarketplaceWhatsappUrl', description: 'wa.me hand-off URL with the encoded message.' })
export type MarketplaceWhatsappUrl = z.infer<typeof MarketplaceWhatsappUrlSchema>

// --- read models ---------------------------------------------------------------------------------

/** DATA-M20-01: the 6 constant categories. `icon` is a Font Awesome class kept verbatim (e.g. `fa-pencil-ruler`). */
export const MarketplaceCategorySchema = z
  .strictObject({
    id: IdSchema,
    slug: z.string().min(1),
    name: z.string().min(1),
    icon: z.string().min(1),
  })
  .meta({ id: 'MarketplaceCategory' })
export type MarketplaceCategory = z.infer<typeof MarketplaceCategorySchema>

/** Seller line of a product card. A platform product has `seller: null` ("PRESTASIPLUS Official", no tick, no shop link). */
export const MarketplaceCardSellerSchema = z
  .strictObject({ shopName: z.string().min(1), verified: z.boolean() })
  .meta({ id: 'MarketplaceCardSeller' })
export type MarketplaceCardSeller = z.infer<typeof MarketplaceCardSellerSchema>

/** Search and shop card (SRS 6.3). */
export const MarketplaceProductCardSchema = z
  .strictObject({
    id: IdSchema,
    slug: z.string().min(1),
    name: z.string().min(1),
    price: MarketplaceMoneySchema,
    originalPrice: MarketplaceMoneySchema.nullable(),
    discountPct: z.number().int().nullable().meta({
      description: 'round((original - price) / original x 100), half up; null without a positive original price (FR-M20-11).',
    }),
    condition: MarketplaceConditionSchema,
    thumbnailUrl: z.string().min(1).nullable().meta({ description: 'Image at the lowest position; null without images.' }),
    seller: MarketplaceCardSellerSchema.nullable(),
    shippingLine: z.string().min(1).meta({
      description:
        'BR-M20-17: "Pos / Kurier (RM8.00)" (postage with fee), "Pos / Kurier" (postage without fee), "Penghantaran Percuma 🎉" (free), "Cash on Delivery (COD)" (cod), "Ambil Sendiri (Pickup)" (pickup).',
    }),
  })
  .meta({ id: 'MarketplaceProductCard' })
export type MarketplaceProductCard = z.infer<typeof MarketplaceProductCardSchema>

export const MarketplaceProductImageSchema = z
  .strictObject({
    id: IdSchema,
    position: z.number().int().min(1).meta({ description: '1 = "Utama".' }),
    url: z.string().min(1),
  })
  .meta({ id: 'MarketplaceProductImage' })
export type MarketplaceProductImage = z.infer<typeof MarketplaceProductImageSchema>

/** SRS 6.7. The average rating is over the reviews of ALL the seller's products (any status). */
export const MarketplaceSellerCardSchema = z
  .strictObject({
    id: IdSchema,
    shopName: z.string().min(1),
    initial: z.string().min(1).max(2).meta({ description: 'First character of the shop name, upper case ("?" if empty).' }),
    verified: z.boolean().meta({ description: 'verified_at is not null.' }),
    ratingStars: MarketplaceRatingStarsSchema,
    activeProductCount: z.number().int().min(0).meta({ description: "The seller's visible products." }),
  })
  .meta({ id: 'MarketplaceSellerCard' })
export type MarketplaceSellerCard = z.infer<typeof MarketplaceSellerCardSchema>

/** Read only in B1: there is no submission route, so the seeded list is empty. */
export const MarketplaceProductReviewSchema = z
  .strictObject({
    id: IdSchema,
    userId: IdSchema,
    rating: z.number().int().min(1).max(5),
    text: z.string(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'MarketplaceProductReview' })
export type MarketplaceProductReview = z.infer<typeof MarketplaceProductReviewSchema>

/** `GET /marketplace/products/{slug}`; `views` is the value after the +1 of this call (BR-M20-12). */
export const MarketplaceProductDetailSchema = z
  .strictObject({
    id: IdSchema,
    slug: z.string().min(1),
    name: z.string().min(1),
    categoryId: IdSchema,
    category: MarketplaceCategorySchema,
    price: MarketplaceMoneySchema,
    originalPrice: MarketplaceMoneySchema.nullable(),
    discountPct: z.number().int().nullable(),
    description: z.string().nullable(),
    condition: MarketplaceConditionSchema,
    stockStatus: MarketplaceStockStatusSchema,
    shippingMethod: MarketplaceShippingMethodSchema,
    shippingFee: MarketplaceMoneySchema.nullable(),
    shippingLine: z.string().min(1),
    location: z.string().meta({ description: 'Empty string when none.' }),
    views: z.number().int().min(1),
    createdAt: TimestampSchema,
    images: z.array(MarketplaceProductImageSchema).meta({ description: 'By position ascending.' }),
    seller: MarketplaceSellerCardSchema.nullable().meta({ description: 'null for a platform product.' }),
    reviews: z.array(MarketplaceProductReviewSchema).meta({ description: 'Newest first.' }),
    reviewCount: z.number().int().min(0),
    related: z
      .array(MarketplaceProductCardSchema)
      .max(MARKETPLACE_RELATED_LIMIT)
      .meta({ description: 'Visible products of the same category, not the product itself, id ascending, at most 4.' }),
  })
  .meta({ id: 'MarketplaceProductDetail' })
export type MarketplaceProductDetail = z.infer<typeof MarketplaceProductDetailSchema>

/** `POST /marketplace/products/{slug}/whatsapp`: the hand-off URL. The caller navigates its new tab to it (D14). */
export const MarketplaceWhatsappHandoffSchema = z
  .strictObject({ url: MarketplaceWhatsappUrlSchema })
  .meta({ id: 'MarketplaceWhatsappHandoff' })
export type MarketplaceWhatsappHandoff = z.infer<typeof MarketplaceWhatsappHandoffSchema>

/** Shop header (S8). `reviewCount` is over all the seller's products; `productCount` is the visible ones. */
export const MarketplaceShopSchema = z
  .strictObject({
    id: IdSchema,
    shopName: z.string().min(1),
    initial: z.string().min(1).max(2),
    description: z.string().nullable(),
    verified: z.boolean(),
    ratingStars: MarketplaceRatingStarsSchema,
    reviewCount: z.number().int().min(0),
    productCount: z.number().int().min(0),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'MarketplaceShop' })
export type MarketplaceShop = z.infer<typeof MarketplaceShopSchema>

/** `GET /marketplace/sellers/{id}`: the shop and its visible products, newest first (`created_at` desc, ties id ascending), not paginated. */
export const MarketplaceShopViewSchema = z
  .strictObject({ shop: MarketplaceShopSchema, products: z.array(MarketplaceProductCardSchema) })
  .meta({ id: 'MarketplaceShopView' })
export type MarketplaceShopView = z.infer<typeof MarketplaceShopViewSchema>

// --- request query -------------------------------------------------------------------------------

/**
 * Query of `GET /marketplace/products`. Every key is a free string on purpose, as in the mock: the
 * route never answers 422. `q` is trimmed and cut to 100 characters; an unknown `category` slug
 * gives an empty list; a non-blank `condition` other than new/used matches nothing; an unknown
 * `sort` is `latest`; a missing or invalid `page` is 1; the page size is fixed at 20 and
 * `pageSize` is ignored.
 */
export const MarketplaceSearchQuerySchema = z
  .object({
    q: z.string().optional().meta({ description: 'Case-insensitive substring of the product name. Blank = no filter.' }),
    category: z.string().optional().meta({ description: 'Category slug. Unknown slug = empty result; blank = any.' }),
    condition: z.string().optional().meta({ description: 'new | used, exact. Any other non-blank value matches nothing; blank = any.' }),
    sort: z.string().optional().meta({
      description:
        'latest (default, and for any unknown value) | price_low | price_high | popular. `latest` is created_at desc, ties id ascending, but id descending when a valid category is set (DV-M20-07).',
    }),
    page: z.string().optional().meta({ description: 'Positive integer; missing or invalid = 1. An out-of-range page answers an empty page.' }),
  })
  .meta({ id: 'MarketplaceSearchQuery' })
export type MarketplaceSearchQuery = z.infer<typeof MarketplaceSearchQuerySchema>

// --- response bodies -----------------------------------------------------------------------------

export const MarketplaceCategoryListResponseSchema = z
  .strictObject({ data: z.array(MarketplaceCategorySchema) })
  .meta({ id: 'MarketplaceCategoryListResponse' })
export type MarketplaceCategoryListResponse = z.infer<typeof MarketplaceCategoryListResponseSchema>

export const MarketplaceProductListResponseSchema = z
  .strictObject({ data: z.array(MarketplaceProductCardSchema).max(MARKETPLACE_PAGE_SIZE), meta: ListMetaSchema })
  .meta({ id: 'MarketplaceProductListResponse' })
export type MarketplaceProductListResponse = z.infer<typeof MarketplaceProductListResponseSchema>

export const MarketplaceProductResponseSchema = z
  .strictObject({ data: MarketplaceProductDetailSchema })
  .meta({ id: 'MarketplaceProductResponse' })
export type MarketplaceProductResponse = z.infer<typeof MarketplaceProductResponseSchema>

export const MarketplaceWhatsappResponseSchema = z
  .strictObject({ data: MarketplaceWhatsappHandoffSchema })
  .meta({ id: 'MarketplaceWhatsappResponse' })
export type MarketplaceWhatsappResponse = z.infer<typeof MarketplaceWhatsappResponseSchema>

export const MarketplaceShopResponseSchema = z
  .strictObject({ data: MarketplaceShopViewSchema })
  .meta({ id: 'MarketplaceShopResponse' })
export type MarketplaceShopResponse = z.infer<typeof MarketplaceShopResponseSchema>

// --- pure rules shared with the server (BR-M20-16, 17, 21; FR-M20-11) -------------------------------

/** FR-M20-11: `round((original - price) / original x 100)` half up; null without a positive original price. */
export function marketplaceDiscountPct(price: string, originalPrice: string | null): number | null {
  if (originalPrice === null) return null
  const original = Number(originalPrice)
  if (!(original > 0)) return null
  return Math.round(((original - Number(price)) / original) * 100)
}

/** BR-M20-17 exact copy. A postage product without a fee shows no amount. */
export function marketplaceShippingLine(method: MarketplaceShippingMethod, fee: string | null): string {
  switch (method) {
    case 'postage':
      return fee === null ? 'Pos / Kurier' : `Pos / Kurier (RM${Number(fee).toFixed(2)})`
    case 'free':
      return 'Penghantaran Percuma 🎉'
    case 'cod':
      return 'Cash on Delivery (COD)'
    case 'pickup':
      return 'Ambil Sendiri (Pickup)'
  }
}

/** BR-M20-16: `avg` is the average rating, `null` without reviews. */
export function marketplaceRatingStars(avg: number | null): string {
  const filled = avg === null ? 0 : Math.max(0, Math.min(5, Math.round(avg)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

/** First character of a shop name, upper case; "?" when empty. */
export function marketplaceInitial(shopName: string): string {
  const first = Array.from(shopName.trim())[0]
  return first ? first.toUpperCase() : '?'
}

/** BR-M20-21 message text. */
export function marketplaceWhatsappMessage(productName: string): string {
  return `Salam, saya berminat dengan produk "${productName}" di PRESTASIPLUS Marketplace.`
}

/** BR-M20-21: `number` is digits only (the seller's, or the platform number for a platform product). */
export function marketplaceWhatsappUrl(number: string, productName: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(marketplaceWhatsappMessage(productName))}`
}
