/**
 * M20 stored row types (SRS M20 v1.2 §6.2–§6.6). Contract (read-model) types live in `api/types.ts`.
 */

import type {
  ProductCondition,
  ProductStatus,
  SellerStatus,
  ShippingMethod,
  StockStatus,
} from '../../api/types'

/** DATA-M20-02 (`mpProducts`). Prices are decimal strings with 2 dp. */
export interface MpProduct {
  id: number
  /** `null` = platform product. */
  sellerId: number | null
  name: string
  slug: string
  categoryId: number
  price: string
  originalPrice: string | null
  description: string | null
  condition: ProductCondition
  stockStatus: StockStatus
  status: ProductStatus
  shippingMethod: ShippingMethod
  shippingFee: string | null
  location: string
  views: number
  createdAt: string
  updatedAt: string
}

/** DATA-M20-03 (`mpImages`). */
export interface MpImage {
  id: number
  productId: number
  position: number
  url: string
}

/** DATA-M20-04 (`mpSellers`). */
export interface MpSeller {
  id: number
  userId: number
  shopName: string
  description: string | null
  phone: string
  whatsapp: string
  status: SellerStatus
  verifiedAt: string | null
  whatsappClicks: number
  createdAt: string
}

/** DATA-M20-05 (empty in the seed). */
export interface MpSellerDocument {
  id: number
  sellerId: number
  fileName: string
  url: string
  uploadedAt: string
}

/** DATA-M20-06 (empty in the seed; no submission endpoint, OQ-M20-05). */
export interface MpReview {
  id: number
  productId: number
  userId: number
  rating: number
  text: string
  createdAt: string
}
