/**
 * Materialised M20 tables (SRS M20 v1.2 §6.10: small stores, every count is a named query over the
 * rows). Seed ids stay below the runtime ids: products 1–10 (runtime from 11), images 1–45 (46),
 * sellers 1 (2), documents and reviews empty (1); `maxPlusOne` gives exactly that.
 */

import { defineTable, maxPlusOne } from '@/mock/define'

import type { MarketplaceCategory } from '../../api/types'
import type { MpImage, MpProduct, MpReview, MpSeller, MpSellerDocument } from './types'

export const categoriesTable = defineTable<MarketplaceCategory>({
  name: 'marketplace.categories',
  ids: maxPlusOne(),
})

export const productsTable = defineTable<MpProduct>({
  name: 'marketplace.products',
  ids: maxPlusOne(),
  indexes: ['sellerId', 'categoryId', 'status'],
})

export const imagesTable = defineTable<MpImage>({
  name: 'marketplace.images',
  ids: maxPlusOne(),
  indexes: ['productId'],
})

export const sellersTable = defineTable<MpSeller>({
  name: 'marketplace.sellers',
  ids: maxPlusOne(),
  indexes: ['userId', 'status'],
})

export const documentsTable = defineTable<MpSellerDocument>({
  name: 'marketplace.documents',
  ids: maxPlusOne(),
  indexes: ['sellerId'],
})

export const reviewsTable = defineTable<MpReview>({
  name: 'marketplace.reviews',
  ids: maxPlusOne(),
  indexes: ['productId'],
})

export const M20_TABLES = {
  categories: categoriesTable,
  products: productsTable,
  images: imagesTable,
  sellers: sellersTable,
  documents: documentsTable,
  reviews: reviewsTable,
}
