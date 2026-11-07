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
  UNAUTHORIZED: { status: 401, message: 'Sesi anda telah tamat. Sila log masuk semula.' },
  /** Unknown or hidden slug, unknown or non-active shop, non-numeric shop id. Nothing changes. */
  NOT_FOUND: { status: 404, message: 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?' },
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

// =================================================================================================
// Admin slice (S7-T08, API-ADM-19; PRD 30 P2-12 and P2-13, fields P12-01..P12-11). Role `admin` only.
// =================================================================================================

/** `status` of a product (stored values). The BM labels are `MARKETPLACE_PRODUCT_STATUS_LABELS`. */
export const MARKETPLACE_PRODUCT_STATUSES = ['active', 'draft', 'rejected'] as const
export const MarketplaceProductStatusSchema = z.enum(MARKETPLACE_PRODUCT_STATUSES).meta({ id: 'MarketplaceProductStatus' })
export type MarketplaceProductStatus = z.infer<typeof MarketplaceProductStatusSchema>

/** `status` of a seller (stored values; DB check `ck_marketplace_sellers_status`). */
export const MARKETPLACE_SELLER_STATUSES = ['pending', 'active', 'suspended', 'banned'] as const
export const MarketplaceSellerStatusSchema = z.enum(MARKETPLACE_SELLER_STATUSES).meta({ id: 'MarketplaceSellerStatus' })
export type MarketplaceSellerStatus = z.infer<typeof MarketplaceSellerStatusSchema>

/** The four seller transitions, the last path segment of `POST /admin/marketplace/sellers/{id}/{action}`. */
export const MARKETPLACE_SELLER_ACTIONS = ['approve', 'verify', 'suspend', 'ban'] as const
export const MarketplaceSellerActionSchema = z.enum(MARKETPLACE_SELLER_ACTIONS).meta({ id: 'MarketplaceSellerAction' })
export type MarketplaceSellerAction = z.infer<typeof MarketplaceSellerActionSchema>

/** PRD 30 P2-12 `Semua Status` (`Aktif`, `Draf`, `Ditolak`) and the status radio P12-10. */
export const MARKETPLACE_PRODUCT_STATUS_LABELS: Readonly<Record<MarketplaceProductStatus, string>> = {
  active: 'Aktif',
  draft: 'Draf',
  rejected: 'Ditolak',
}
/** PRD 30 P2-13 `Semua Status` (`Pending`, `Aktif`, `Digantung`, `Diharamkan`). */
export const MARKETPLACE_SELLER_STATUS_LABELS: Readonly<Record<MarketplaceSellerStatus, string>> = {
  pending: 'Pending',
  active: 'Aktif',
  suspended: 'Digantung',
  banned: 'Diharamkan',
}
/** PRD 30 P2-13 action buttons: Luluskan, Sahkan, Gantung, Haramkan. */
export const MARKETPLACE_SELLER_ACTION_LABELS: Readonly<Record<MarketplaceSellerAction, string>> = {
  approve: 'Luluskan',
  verify: 'Sahkan',
  suspend: 'Gantung',
  ban: 'Haramkan',
}
/** P12-02 default option (PRD: "PRESTASIPLUS Official (Admin)"); the stored product has `seller_id` null. */
export const MARKETPLACE_OFFICIAL_SELLER_LABEL = 'PRESTASIPLUS Official (Admin)'
/** Seller name shown on a card of a platform product. */
export const MARKETPLACE_OFFICIAL_SHOP_NAME = 'PRESTASIPLUS Official'

/**
 * Seller transition table (decision 6 on issue #506). `from` lists the statuses an action may start in; anything
 * else is 409. `ban` ("Haramkan") works from any non-banned state; `banned` is terminal. `verify` ("Sahkan") only
 * when `active` and not yet verified, and sets `verified_at` (status unchanged). `approve` ("Luluskan") is
 * pending -> active and also suspended -> active.
 */
export const MARKETPLACE_SELLER_TRANSITIONS: Readonly<
  Record<MarketplaceSellerAction, { from: readonly MarketplaceSellerStatus[]; to: MarketplaceSellerStatus }>
> = {
  approve: { from: ['pending', 'suspended'], to: 'active' },
  verify: { from: ['active'], to: 'active' },
  suspend: { from: ['active'], to: 'suspended' },
  ban: { from: ['pending', 'active', 'suspended'], to: 'banned' },
}

/** The actions the admin may take on a seller right now (the server sends the same list as `actions`). */
export function marketplaceSellerActions(status: MarketplaceSellerStatus, verified: boolean): MarketplaceSellerAction[] {
  return MARKETPLACE_SELLER_ACTIONS.filter((a) => {
    if (!MARKETPLACE_SELLER_TRANSITIONS[a].from.includes(status)) return false
    return a !== 'verify' || !verified
  })
}

/** P12-03, 05, 06, 08, 09 limits. */
export const MARKETPLACE_ADMIN_LIMITS = {
  nameMax: 120,
  descriptionMax: 2000,
  locationMax: 100,
  priceMin: 0.01,
  priceMax: 100000,
  feeMin: 0,
  feeMax: 1000,
  maxImages: 5,
  pageSize: 20,
  queryMax: 100,
} as const

/**
 * Exact BM copy from PRD 30 P2-12 (P12-02, 03, 04, 05, 09). The rest of the field messages follow the catalogue
 * patterns of 40 X10 (ERR-REQ-10 "Sila isi {medan}.", -11 "Sila pilih {medan}.", -12 "{Medan} tidak boleh melebihi {n}
 * aksara.", -14 "Format {medan} tidak sah.", -15 "{Medan} mesti antara {a} dan {b}."). Each is the 422 `fields.<name>` text.
 */
export const MARKETPLACE_ADMIN_MESSAGES = {
  sellerRequired: 'Penjual diperlukan.',
  nameRequired: 'Nama produk diperlukan.',
  categoryRequired: 'Kategori diperlukan.',
  originalPriceNotGreater: 'Harga asal mesti lebih besar daripada harga.',
  maxImages: 'Maksimum 5 gambar.',
  imageInvalid: 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.',
  // Catalogue patterns (ERR-REQ-10..15):
  nameTooLong: 'Nama produk tidak boleh melebihi 120 aksara.',
  priceRequired: 'Sila isi harga.',
  priceFormat: 'Format harga tidak sah.',
  priceRange: 'Harga mesti antara 0.01 dan 100000.',
  originalPriceFormat: 'Format harga asal tidak sah.',
  originalPriceRange: 'Harga asal mesti antara 0.01 dan 100000.',
  descriptionTooLong: 'Penerangan tidak boleh melebihi 2000 aksara.',
  conditionRequired: 'Sila pilih keadaan.',
  stockStatusRequired: 'Sila pilih status stok.',
  shippingMethodRequired: 'Sila pilih kaedah penghantaran.',
  statusRequired: 'Sila pilih status produk.',
  shippingFeeFormat: 'Format kos penghantaran tidak sah.',
  shippingFeeRange: 'Kos penghantaran mesti antara 0 dan 1000.',
  locationTooLong: 'Lokasi tidak boleh melebihi 100 aksara.',
  /** ERR-CON-04 of the catalogue: an illegal seller transition (409). */
  transitionNotAllowed: 'Perubahan status ini tidak dibenarkan daripada status semasa.',
} as const

/**
 * [PROPOSED] BM copy that no PRD row gives. One place, for owner approval (D94); the frontend reads these so a
 * change here is the only edit. Nothing in the API contract depends on the wording.
 */
export const MARKETPLACE_ADMIN_PROPOSED = {
  /** Label of the way back from `Nyahaktif` (decision 6: `Aktifkan`). */
  productActivateLabel: 'Aktifkan',
  /** Product `Nyahaktif` sets `draft`. */
  productDeactivateLabel: 'Nyahaktif',
  /** 422 `fields.sellerId` when the chosen seller is unknown or not `Aktif`. */
  sellerInvalid: 'Penjual tidak sah.',
  /** 422 `fields.categoryId` when the category id is unknown. */
  categoryInvalid: 'Kategori tidak sah.',
  /** 422 `fields.images` when the same stored file is used twice or already belongs to a product image. */
  imageDuplicate: 'Gambar ini sudah digunakan.',
  /** Success flashes. */
  flash: {
    productCreated: 'Produk berjaya ditambah.',
    productUpdated: 'Produk berjaya dikemas kini.',
    productDeleted: 'Produk berjaya dipadam.',
    imageDeleted: 'Gambar berjaya dipadam.',
    sellerApproved: 'Penjual berjaya diluluskan.',
    sellerVerified: 'Penjual berjaya disahkan.',
    sellerSuspended: 'Penjual berjaya digantung.',
    sellerBanned: 'Penjual berjaya diharamkan.',
  },
  /** Confirm dialog for a seller action: "Haramkan penjual ini?" is the PRD text, the others follow "{Tindakan} penjual ini?". */
  sellerConfirm: (action: MarketplaceSellerAction): string => `${MARKETPLACE_SELLER_ACTION_LABELS[action]} penjual ini?`,
  /** Confirm dialog of a product delete (PRD P12-11: "Padam produk ini?", buttons `Batal` / `Ya, Padam`). */
  productDeleteConfirm: 'Padam produk ini?',
} as const

export const MARKETPLACE_ADMIN_ERRORS = {
  UNAUTHORIZED: MARKETPLACE_ERRORS.UNAUTHORIZED,
  /** Not an admin (including a teacher, a pupil, a school admin). */
  FORBIDDEN: { status: 403, message: 'Anda tidak dibenarkan melakukan tindakan ini.' },
  NOT_FOUND: MARKETPLACE_ERRORS.NOT_FOUND,
  /** Illegal seller transition. */
  CONFLICT: { status: 409, message: MARKETPLACE_ADMIN_MESSAGES.transitionNotAllowed },
  VALIDATION_ERROR: { status: 422, message: 'Data yang dihantar tidak sah. Sila semak dan cuba lagi.' },
} as const

// --- field schemas -------------------------------------------------------------------------------

const required = (message: string) => z.string({ error: message }).trim().min(1, message)

/** A price field as the decimal string the API uses everywhere ("89.90", one or two decimals accepted on input). */
const priceInput = (msgs: { format: string; range: string; required?: string }) => {
  const base = msgs.required ? z.string({ error: msgs.required }) : z.string({ error: msgs.format })
  return base
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, msgs.format)
    .refine((v) => Number(v) >= MARKETPLACE_ADMIN_LIMITS.priceMin && Number(v) <= MARKETPLACE_ADMIN_LIMITS.priceMax, msgs.range)
}

const priceField = () =>
  priceInput({ format: MARKETPLACE_ADMIN_MESSAGES.priceFormat, range: MARKETPLACE_ADMIN_MESSAGES.priceRange, required: MARKETPLACE_ADMIN_MESSAGES.priceRequired })
const originalPriceField = () =>
  priceInput({ format: MARKETPLACE_ADMIN_MESSAGES.originalPriceFormat, range: MARKETPLACE_ADMIN_MESSAGES.originalPriceRange })
const feeField = () =>
  z
    .string({ error: MARKETPLACE_ADMIN_MESSAGES.shippingFeeFormat })
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, MARKETPLACE_ADMIN_MESSAGES.shippingFeeFormat)
    .refine((v) => Number(v) >= MARKETPLACE_ADMIN_LIMITS.feeMin && Number(v) <= MARKETPLACE_ADMIN_LIMITS.feeMax, MARKETPLACE_ADMIN_MESSAGES.shippingFeeRange)

/** `/api/files/{token}`: the `FileRef.url` of a `marketplace_image` upload, kept verbatim in `marketplace_product_images.url`. */
const imageUrlField = () => z.string({ error: MARKETPLACE_ADMIN_MESSAGES.imageInvalid }).trim().min(1, MARKETPLACE_ADMIN_MESSAGES.imageInvalid).max(300, MARKETPLACE_ADMIN_MESSAGES.imageInvalid)
const imagesField = () => z.array(imageUrlField(), { error: MARKETPLACE_ADMIN_MESSAGES.imageInvalid }).max(MARKETPLACE_ADMIN_LIMITS.maxImages, MARKETPLACE_ADMIN_MESSAGES.maxImages)

const enumRequired = <const T extends readonly [string, ...string[]]>(values: T, message: string) => z.enum(values, { error: message })

/** Original price must be greater than price (card, 60 API-ADM-19; P12-05 `>=` is corrected to `>`). */
function checkOriginalGreater(v: { price?: string | undefined; originalPrice?: string | null | undefined }, ctx: z.core.$RefinementCtx): void {
  if (v.price === undefined || v.originalPrice === undefined || v.originalPrice === null) return
  if (!(Number(v.originalPrice) > Number(v.price))) {
    ctx.addIssue({ code: 'custom', path: ['originalPrice'], message: MARKETPLACE_ADMIN_MESSAGES.originalPriceNotGreater })
  }
}

const SellerRefField = z
  .string({ error: MARKETPLACE_ADMIN_MESSAGES.sellerRequired })
  .trim()
  .min(1, MARKETPLACE_ADMIN_MESSAGES.sellerRequired)
  .max(64, MARKETPLACE_ADMIN_MESSAGES.sellerRequired)
  .nullable()
  .meta({ description: 'Seller id, or null for "PRESTASIPLUS Official" (P12-02). A missing key or blank id is 422 "Penjual diperlukan.". Must be an `active` seller.' })

const productWriteShape = {
  sellerId: SellerRefField,
  name: required(MARKETPLACE_ADMIN_MESSAGES.nameRequired).max(MARKETPLACE_ADMIN_LIMITS.nameMax, MARKETPLACE_ADMIN_MESSAGES.nameTooLong),
  categoryId: z.string({ error: MARKETPLACE_ADMIN_MESSAGES.categoryRequired }).trim().min(1, MARKETPLACE_ADMIN_MESSAGES.categoryRequired).max(64, MARKETPLACE_ADMIN_MESSAGES.categoryRequired),
  price: priceField().meta({ description: 'RM 0.01 to 100000, decimal string.' }),
  originalPrice: originalPriceField().nullable().optional().meta({ description: 'Optional; when given it must be greater than `price`.' }),
  description: z.string().max(MARKETPLACE_ADMIN_LIMITS.descriptionMax, MARKETPLACE_ADMIN_MESSAGES.descriptionTooLong).nullable().optional(),
  condition: enumRequired(MARKETPLACE_CONDITIONS, MARKETPLACE_ADMIN_MESSAGES.conditionRequired),
  stockStatus: enumRequired(MARKETPLACE_STOCK_STATUSES, MARKETPLACE_ADMIN_MESSAGES.stockStatusRequired),
  shippingMethod: enumRequired(MARKETPLACE_SHIPPING_METHODS, MARKETPLACE_ADMIN_MESSAGES.shippingMethodRequired),
  shippingFee: feeField().nullable().optional().meta({ description: 'RM 0 to 1000, decimal string; null clears.' }),
  location: z.string().max(MARKETPLACE_ADMIN_LIMITS.locationMax, MARKETPLACE_ADMIN_MESSAGES.locationTooLong).optional(),
  status: enumRequired(MARKETPLACE_PRODUCT_STATUSES, MARKETPLACE_ADMIN_MESSAGES.statusRequired),
}

/** `POST /admin/marketplace/products` (create form "Tambah Produk Marketplace"). */
export const MarketplaceAdminProductCreateSchema = z
  .strictObject({
    ...productWriteShape,
    status: productWriteShape.status.optional().meta({ description: 'Default `active`.' }),
    images: imagesField().optional().meta({
      description: 'Up to 5 `FileRef.url` values of files uploaded with `POST /api/files?purpose=marketplace_image`. Position follows array order; the first is "Utama".',
    }),
  })
  .superRefine(checkOriginalGreater)
  .meta({ id: 'MarketplaceAdminProductCreate' })
export type MarketplaceAdminProductCreate = z.infer<typeof MarketplaceAdminProductCreateSchema>

/**
 * `PUT /admin/marketplace/products/{id}`: every key optional (only the keys sent change; `null` clears an optional
 * field), so `Nyahaktif` is `{ "status": "draft" }`. Images are NOT replaced here: `newImages` are appended after the
 * existing ones (total at most 5) and `DELETE .../images/{imageId}` removes one (separate action, D-M20-01).
 */
export const MarketplaceAdminProductUpdateSchema = z
  .strictObject({
    sellerId: productWriteShape.sellerId.optional(),
    name: productWriteShape.name.optional(),
    categoryId: productWriteShape.categoryId.optional(),
    price: productWriteShape.price.optional(),
    originalPrice: productWriteShape.originalPrice,
    description: productWriteShape.description,
    condition: productWriteShape.condition.optional(),
    stockStatus: productWriteShape.stockStatus.optional(),
    shippingMethod: productWriteShape.shippingMethod.optional(),
    shippingFee: productWriteShape.shippingFee,
    location: productWriteShape.location,
    status: productWriteShape.status.optional(),
    newImages: imagesField().optional().meta({ description: 'Files to append (same rules as `images` on create).' }),
  })
  .superRefine(checkOriginalGreater)
  .meta({ id: 'MarketplaceAdminProductUpdate' })
export type MarketplaceAdminProductUpdate = z.infer<typeof MarketplaceAdminProductUpdateSchema>

// --- queries -------------------------------------------------------------------------------------

const pageField = z
  .string()
  .regex(/^[1-9]\d{0,8}$/, 'Halaman tidak sah.')
  .optional()
  .meta({ description: 'Positive integer, default 1.' })
const blankOr = <T extends z.ZodType>(schema: T) => z.union([z.literal(''), schema])

/** `GET /admin/marketplace/products` (P12-01). A blank value means "no filter" (the `Semua ...` options). */
export const MarketplaceAdminProductListQuerySchema = z
  .strictObject({
    q: z.string().max(MARKETPLACE_ADMIN_LIMITS.queryMax * 4).optional().meta({ description: 'Substring of the name, case-insensitive; trimmed and cut to 100 characters.' }),
    categoryId: blankOr(IdSchema).optional(),
    status: blankOr(MarketplaceProductStatusSchema).optional(),
    page: pageField,
  })
  .meta({ id: 'MarketplaceAdminProductListQuery' })
export type MarketplaceAdminProductListQuery = z.infer<typeof MarketplaceAdminProductListQuerySchema>

/** `GET /admin/marketplace/sellers`. */
export const MarketplaceAdminSellerListQuerySchema = z
  .strictObject({
    status: blankOr(MarketplaceSellerStatusSchema).optional(),
    page: pageField,
  })
  .meta({ id: 'MarketplaceAdminSellerListQuery' })
export type MarketplaceAdminSellerListQuery = z.infer<typeof MarketplaceAdminSellerListQuerySchema>

// --- read models ---------------------------------------------------------------------------------

/** Row of the product grid (P2-12 card: image, name, price, seller, category, stock, status). */
export const MarketplaceAdminProductRowSchema = z
  .strictObject({
    id: IdSchema,
    slug: z.string().min(1),
    name: z.string().min(1),
    price: MarketplaceMoneySchema,
    originalPrice: MarketplaceMoneySchema.nullable(),
    thumbnailUrl: z.string().min(1).nullable().meta({ description: 'Image at the lowest position; null shows the placeholder.' }),
    sellerId: IdSchema.nullable(),
    sellerName: z.string().min(1).meta({ description: '"PRESTASIPLUS Official" for a platform product.' }),
    categoryId: IdSchema,
    categoryName: z.string().min(1),
    condition: MarketplaceConditionSchema,
    stockStatus: MarketplaceStockStatusSchema,
    status: MarketplaceProductStatusSchema,
    views: z.number().int().min(0),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'MarketplaceAdminProductRow' })
export type MarketplaceAdminProductRow = z.infer<typeof MarketplaceAdminProductRowSchema>

/** Edit form and the answer of create / update. `images` are by position; each has its own delete. */
export const MarketplaceAdminProductDetailSchema = MarketplaceAdminProductRowSchema.extend({
  description: z.string().nullable(),
  shippingMethod: MarketplaceShippingMethodSchema,
  shippingFee: MarketplaceMoneySchema.nullable(),
  location: z.string(),
  images: z.array(MarketplaceProductImageSchema).max(MARKETPLACE_ADMIN_LIMITS.maxImages),
  updatedAt: TimestampSchema,
}).meta({ id: 'MarketplaceAdminProductDetail' })
export type MarketplaceAdminProductDetail = z.infer<typeof MarketplaceAdminProductDetailSchema>

/** Global stat cards of the product page (not the filtered query): `Jumlah Produk`, `Aktif`. */
export const MarketplaceAdminProductStatsSchema = z
  .strictObject({ total: z.number().int().min(0), active: z.number().int().min(0) })
  .meta({ id: 'MarketplaceAdminProductStats' })
export type MarketplaceAdminProductStats = z.infer<typeof MarketplaceAdminProductStatsSchema>

/** Global stat cards of the seller page: `Jumlah Penjual`, `Aktif`, `Menunggu Pengesahan` (= status pending). */
export const MarketplaceAdminSellerStatsSchema = z
  .strictObject({ total: z.number().int().min(0), active: z.number().int().min(0), pending: z.number().int().min(0) })
  .meta({ id: 'MarketplaceAdminSellerStats' })
export type MarketplaceAdminSellerStats = z.infer<typeof MarketplaceAdminSellerStatsSchema>

/** Seller card (P2-13: avatar initial, shop name, owner line, status badge, "{n} produk") and the detail "Semak Penjual". */
export const MarketplaceAdminSellerRowSchema = z
  .strictObject({
    id: IdSchema,
    shopName: z.string().min(1),
    initial: z.string().min(1).max(2),
    ownerMasked: z.string().meta({ description: 'The owner account name with each word cut to its first letter and "***" (never the full name).' }),
    status: MarketplaceSellerStatusSchema,
    verified: z.boolean().meta({ description: '`verified_at` is not null (the tick set by `Sahkan`).' }),
    productCount: z.number().int().min(0).meta({ description: 'All the seller\'s products, any status.' }),
    actions: z.array(MarketplaceSellerActionSchema).meta({ description: 'The transitions allowed now (same as `marketplaceSellerActions`).' }),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'MarketplaceAdminSellerRow' })
export type MarketplaceAdminSellerRow = z.infer<typeof MarketplaceAdminSellerRowSchema>

export const MarketplaceAdminSellerDetailSchema = MarketplaceAdminSellerRowSchema.extend({
  description: z.string().nullable(),
  phone: z.string(),
  whatsapp: z.string(),
  verifiedAt: TimestampSchema.nullable(),
  whatsappClicks: z.number().int().min(0),
}).meta({ id: 'MarketplaceAdminSellerDetail' })
export type MarketplaceAdminSellerDetail = z.infer<typeof MarketplaceAdminSellerDetailSchema>

/** P12-02 options: the official seller first (`id` null), then the `active` sellers by shop name. */
export const MarketplaceAdminSellerOptionSchema = z
  .strictObject({ id: IdSchema.nullable(), label: z.string().min(1) })
  .meta({ id: 'MarketplaceAdminSellerOption' })
export type MarketplaceAdminSellerOption = z.infer<typeof MarketplaceAdminSellerOptionSchema>

// --- responses -----------------------------------------------------------------------------------

export const MarketplaceAdminProductListMetaSchema = ListMetaSchema.extend({ stats: MarketplaceAdminProductStatsSchema }).meta({
  id: 'MarketplaceAdminProductListMeta',
})
export const MarketplaceAdminProductListResponseSchema = z
  .strictObject({ data: z.array(MarketplaceAdminProductRowSchema).max(MARKETPLACE_ADMIN_LIMITS.pageSize), meta: MarketplaceAdminProductListMetaSchema })
  .meta({ id: 'MarketplaceAdminProductListResponse' })
export type MarketplaceAdminProductListResponse = z.infer<typeof MarketplaceAdminProductListResponseSchema>

export const MarketplaceAdminProductResponseSchema = z
  .strictObject({ data: MarketplaceAdminProductDetailSchema })
  .meta({ id: 'MarketplaceAdminProductResponse' })
export type MarketplaceAdminProductResponse = z.infer<typeof MarketplaceAdminProductResponseSchema>

export const MarketplaceAdminDeletedSchema = z
  .strictObject({ data: z.strictObject({ id: IdSchema }) })
  .meta({ id: 'MarketplaceAdminDeleted' })
export type MarketplaceAdminDeleted = z.infer<typeof MarketplaceAdminDeletedSchema>

export const MarketplaceAdminSellerListMetaSchema = ListMetaSchema.extend({ stats: MarketplaceAdminSellerStatsSchema }).meta({
  id: 'MarketplaceAdminSellerListMeta',
})
export const MarketplaceAdminSellerListResponseSchema = z
  .strictObject({ data: z.array(MarketplaceAdminSellerRowSchema).max(MARKETPLACE_ADMIN_LIMITS.pageSize), meta: MarketplaceAdminSellerListMetaSchema })
  .meta({ id: 'MarketplaceAdminSellerListResponse' })
export type MarketplaceAdminSellerListResponse = z.infer<typeof MarketplaceAdminSellerListResponseSchema>

export const MarketplaceAdminSellerResponseSchema = z
  .strictObject({ data: MarketplaceAdminSellerDetailSchema })
  .meta({ id: 'MarketplaceAdminSellerResponse' })
export type MarketplaceAdminSellerResponse = z.infer<typeof MarketplaceAdminSellerResponseSchema>

export const MarketplaceAdminSellerOptionsResponseSchema = z
  .strictObject({ data: z.array(MarketplaceAdminSellerOptionSchema).min(1) })
  .meta({ id: 'MarketplaceAdminSellerOptionsResponse' })
export type MarketplaceAdminSellerOptionsResponse = z.infer<typeof MarketplaceAdminSellerOptionsResponseSchema>
