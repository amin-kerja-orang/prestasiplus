/**
 * M20 contract types (SRS M20 v1.2 §6.2–§6.8, §7 #13–#17; student slice). Shared by the mock handlers
 * and the screens S6 / S7 / S8 (M20-T2, M20-T3). JSON is camelCase; ids are integers; prices are
 * decimal strings with 2 dp ("89.90"); dates are ISO 8601 (+08:00).
 */

export const PRODUCT_CONDITIONS = ['new', 'used'] as const
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number]

export const STOCK_STATUSES = ['available', 'out_of_stock'] as const
export type StockStatus = (typeof STOCK_STATUSES)[number]

export const PRODUCT_STATUSES = ['active', 'draft', 'rejected'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export const SHIPPING_METHODS = ['pickup', 'postage', 'cod', 'free'] as const
export type ShippingMethod = (typeof SHIPPING_METHODS)[number]

export const SELLER_STATUSES = ['pending', 'active', 'suspended', 'banned'] as const
export type SellerStatus = (typeof SELLER_STATUSES)[number]

/** #14 sort keys (BR-M20-05); an unknown value behaves as `latest`. */
export const BUYER_SORTS = ['latest', 'price_low', 'price_high', 'popular'] as const
export type BuyerSort = (typeof BUYER_SORTS)[number]

/** DATA-M20-01 (#13). */
export interface MarketplaceCategory {
  id: number
  slug: string
  name: string
  icon: string
}

/** #14 `ProductCard` (SRS §6.3). `thumbnailUrl` is `null` for a product without an image. */
export interface ProductCard {
  id: number
  slug: string
  name: string
  price: string
  originalPrice: string | null
  /** `round((original - price) / original * 100)`; `null` without an original price (FR-M20-11). */
  discountPct: number | null
  condition: ProductCondition
  thumbnailUrl: string | null
  /** `null` = platform product ("PRESTASIPLUS Official", no tick, no shop link). */
  seller: { shopName: string; verified: boolean } | null
  /** BR-M20-17, e.g. "Pos / Kurier (RM8.00)". */
  shippingLine: string
}

export interface ProductImage {
  id: number
  /** 1 = "Utama". */
  position: number
  url: string
}

/** SRS §6.7 `SellerCard`. */
export interface SellerCard {
  id: number
  shopName: string
  /** First letter of the shop name, upper case. */
  initial: string
  verified: boolean
  /** BR-M20-16: five characters, "★" then "☆" ("☆☆☆☆☆" without reviews). */
  ratingStars: string
  /** Q-M20-SELLER-VISIBLE. */
  activeProductCount: number
}

export interface ProductReview {
  id: number
  userId: number
  rating: number
  text: string
  createdAt: string
}

/** #15 `ProductDetail`; `views` is the value after the +1 of this call (BR-M20-12). */
export interface ProductDetail {
  id: number
  slug: string
  name: string
  categoryId: number
  category: MarketplaceCategory
  price: string
  originalPrice: string | null
  discountPct: number | null
  description: string | null
  condition: ProductCondition
  stockStatus: StockStatus
  shippingMethod: ShippingMethod
  shippingFee: string | null
  shippingLine: string
  /** Empty string when none; S7 shows the map-marker line only when not empty (BR-M20-17). */
  location: string
  views: number
  createdAt: string
  images: ProductImage[]
  /** `null` for a platform product. */
  seller: SellerCard | null
  reviews: ProductReview[]
  reviewCount: number
  /** Q-M20-RELATED, at most 4. */
  related: ProductCard[]
}

/** #16 body (BR-M20-21). The caller navigates its new tab to `url` with `location.replace` (D14). */
export interface WhatsappHandoff {
  url: string
}

/** #17 shop card (S8). */
export interface ShopCard {
  id: number
  shopName: string
  initial: string
  description: string | null
  verified: boolean
  ratingStars: string
  /** Q-M20-SELLER-REVIEWS. */
  reviewCount: number
  /** Q-M20-SELLER-VISIBLE ("{n} produk"). */
  productCount: number
  /** "Bergabung {relative}" is derived from this at the mock clock (FR-M20-12). */
  createdAt: string
}

export interface ShopView {
  shop: ShopCard
  products: ProductCard[]
}

/** #14 query (V-M20-03). */
export interface ProductSearchQuery {
  q?: string
  /** Category slug. */
  category?: string
  condition?: ProductCondition | ''
  sort?: BuyerSort
  page?: number
  signal?: AbortSignal
}
