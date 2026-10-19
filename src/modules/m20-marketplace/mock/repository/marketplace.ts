/**
 * M20 repositories (SRS M20 v1.2 §6.8, §7 "Repository contract"): `mpCategories`, `mpProducts`,
 * `mpImages`, `mpSellers`, `mpReviews`. Every figure is computed per request from the stores through
 * the named queries of §6.8 (FR-M20-76); the stores are small materialised tables, not D11 datasets.
 * Writes happen only inside these methods (D12 guard); tables of the same module are read directly.
 *
 * Buyer-slice methods (M20-T1) are complete; admin and seller methods (M20-T4, M20-T6) are not built.
 */

import { defineRepository } from '@/mock/repository'

import type {
  MarketplaceCategory,
  ProductCard,
  ProductDetail,
  ProductReview,
  ShopView,
} from '../../api/types'
import { nowMs } from './clock'
import { toIso } from './format'
import {
  categoriesTable,
  documentsTable,
  imagesTable,
  productsTable,
  reviewsTable,
  sellersTable,
} from './tables'
import type { MpImage, MpProduct, MpSeller } from './types'
import {
  discountPct,
  initialOf,
  platformWhatsappNumber,
  ratingStars,
  shippingLine,
  whatsappMessage,
} from './format'

/** Page size of #1, #14 and #20 (OQ-M20-08). */
export const PAGE_SIZE = 20
/** BR-M20-20. */
const RELATED_LIMIT = 4

// --- shared reads (Q-M20-*) -------------------------------------------------------------------

function sellerOf(p: MpProduct): MpSeller | undefined {
  return p.sellerId === null ? undefined : sellersTable.get(p.sellerId)
}

/** BR-M20-08: active, and the seller (if any) active. Stock does not matter. */
function isVisible(p: MpProduct): boolean {
  if (p.status !== 'active') return false
  if (p.sellerId === null) return true
  return sellersTable.get(p.sellerId)?.status === 'active'
}

function imagesOf(productId: number): MpImage[] {
  return imagesTable.query({ where: { productId }, sort: 'position' }).rows
}

/** Q-M20-SELLER-REVIEWS: reviews over all the seller's products. */
function sellerReviews(sellerId: number): number[] {
  const ids = new Set(productsTable.query({ where: { sellerId } }).rows.map((p) => p.id))
  return reviewsTable
    .query()
    .rows.filter((r) => ids.has(r.productId))
    .map((r) => r.rating)
}

/** Q-M20-SELLER-RATING (BR-M20-16). */
function sellerStars(sellerId: number): string {
  const ratings = sellerReviews(sellerId)
  if (ratings.length === 0) return ratingStars(null)
  return ratingStars(ratings.reduce((a, b) => a + b, 0) / ratings.length)
}

/** Q-M20-SELLER-VISIBLE. */
function sellerVisibleCount(sellerId: number): number {
  return productsTable.query({ where: { sellerId } }).rows.filter(isVisible).length
}

function toCard(p: MpProduct): ProductCard {
  const seller = sellerOf(p)
  const first = imagesOf(p.id)[0]
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    discountPct: discountPct(p.price, p.originalPrice),
    condition: p.condition,
    thumbnailUrl: first ? first.url : null,
    seller: seller ? { shopName: seller.shopName, verified: seller.verifiedAt !== null } : null,
    shippingLine: shippingLine(p.shippingMethod, p.shippingFee),
  }
}

/** Q-M20-RELATED (BR-M20-20): visible, same category, not the product, id ascending, at most 4. */
function relatedOf(p: MpProduct): MpProduct[] {
  return productsTable
    .query({ where: { categoryId: p.categoryId } })
    .rows.filter((r) => r.id !== p.id && isVisible(r))
    .slice(0, RELATED_LIMIT)
}

export interface BuyerFilter {
  q: string
  /** Category slug; `''` = any. */
  category: string
  /** `''` = any. */
  condition: string
  sort: string
}

const mpCategoriesRepo = defineRepository({
  owner: 'M20',
  name: 'mpCategories',
  store: categoriesTable,
  methods: ({ store, transaction }) => ({
    /** #13: the 6 constant categories, id ascending. */
    all(): MarketplaceCategory[] {
      return store.query().rows.map((c) => ({ ...c }))
    },
    bySlug(slug: string): MarketplaceCategory | undefined {
      return store.query({ where: { slug } }).rows[0]
    },
    seedRows(rows: readonly MarketplaceCategory[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },
  }),
})

const mpImagesRepo = defineRepository({
  owner: 'M20',
  name: 'mpImages',
  store: imagesTable,
  methods: ({ store, transaction }) => ({
    /** Q-M20-IMAGES(p): by position. */
    forProduct(productId: number): MpImage[] {
      return imagesOf(productId)
    },
    total(): number {
      return store.count()
    },
    insertMany(rows: readonly MpImage[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },
  }),
})

const mpReviewsRepo = defineRepository({
  owner: 'M20',
  name: 'mpReviews',
  store: reviewsTable,
  methods: ({ store }) => ({
    /** Q-M20-PRODUCT-REVIEWS(p). */
    reviewCount(productId: number): number {
      return store.count({ productId })
    },
    /** Q-M20-SELLER-REVIEWS(s). */
    countForSeller(sellerId: number): number {
      return sellerReviews(sellerId).length
    },
  }),
})

const mpProductsRepo = defineRepository({
  owner: 'M20',
  name: 'mpProducts',
  store: productsTable,
  methods: ({ store, transaction }) => ({
    get(idOrSlug: number | string): MpProduct | undefined {
      if (typeof idOrSlug === 'number') return store.get(idOrSlug)
      return store.query({ where: { slug: idOrSlug } }).rows[0]
    },

    isVisible(p: MpProduct): boolean {
      return isVisible(p)
    },

    total(): number {
      return store.count()
    },

    /** Q-M20-SELLER-PRODUCTS(s): all statuses. */
    sellerProductCount(sellerId: number): number {
      return store.count({ sellerId })
    },

    /** Q-M20-SELLER-ACTIVE(s). */
    sellerActiveCount(sellerId: number): number {
      return store.count({ sellerId, status: 'active' })
    },

    /** Q-M20-SELLER-VISIBLE(s). */
    sellerVisibleCount(sellerId: number): number {
      return sellerVisibleCount(sellerId)
    },

    /** Q-M20-VIEWS-SUM(s). */
    viewsSum(sellerId: number): number {
      return store.query({ where: { sellerId } }).rows.reduce((n, p) => n + p.views, 0)
    },

    /** Q-M20-RELATED(p). */
    related(productId: number): MpProduct[] {
      const p = store.get(productId)
      return p ? relatedOf(p) : []
    },

    card(p: MpProduct): ProductCard {
      return toCard(p)
    },

    /**
     * Q-M20-BUYER-LIST (BR-M20-05): visible products; `q` case-insensitive substring of `name`;
     * `category` slug; `condition` exact; AND. `latest` (also unknown values) = createdAt desc, ties id
     * asc, but id desc when a category is set (DV-M20-07); `price_low` / `price_high` by price, ties id
     * asc; `popular` = views desc, ties id asc. The caller pages the result.
     */
    buyerList(filter: BuyerFilter): MpProduct[] {
      const q = filter.q.trim().toLowerCase()
      const category = filter.category === '' ? undefined : mpCategoriesRepo.bySlug(filter.category)
      if (filter.category !== '' && !category) return []
      let rows = store.query().rows.filter(isVisible)
      if (q !== '') rows = rows.filter((p) => p.name.toLowerCase().includes(q))
      if (category) rows = rows.filter((p) => p.categoryId === category.id)
      if (filter.condition !== '') rows = rows.filter((p) => p.condition === filter.condition)
      const sort = filter.sort
      const byId = (a: MpProduct, b: MpProduct) => a.id - b.id
      switch (sort) {
        case 'price_low':
          return [...rows].sort((a, b) => Number(a.price) - Number(b.price) || byId(a, b))
        case 'price_high':
          return [...rows].sort((a, b) => Number(b.price) - Number(a.price) || byId(a, b))
        case 'popular':
          return [...rows].sort((a, b) => b.views - a.views || byId(a, b))
        default:
          return [...rows].sort((a, b) => {
            if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
            return category ? b.id - a.id : a.id - b.id
          })
      }
    },

    /**
     * #15 (BR-M20-12): adds 1 to `views` of a visible product and returns the detail with the new
     * value. `undefined` for an unknown or hidden slug (nothing changes).
     */
    view(slug: string): ProductDetail | undefined {
      return transaction(() => {
        const found = store.query({ where: { slug } }).rows[0]
        if (!found || !isVisible(found)) return undefined
        const p = store.update(found.id, { views: found.views + 1 })
        const category = categoriesTable.get(p.categoryId)
        if (!category) throw new Error(`M20: product ${String(p.id)} has an unknown category`)
        const seller = sellerOf(p)
        const reviews: ProductReview[] = reviewsTable
          .query({ where: { productId: p.id }, sort: { field: 'createdAt', dir: 'desc' } })
          .rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            rating: r.rating,
            text: r.text,
            createdAt: r.createdAt,
          }))
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          categoryId: p.categoryId,
          category: { ...category },
          price: p.price,
          originalPrice: p.originalPrice,
          discountPct: discountPct(p.price, p.originalPrice),
          description: p.description,
          condition: p.condition,
          stockStatus: p.stockStatus,
          shippingMethod: p.shippingMethod,
          shippingFee: p.shippingFee,
          shippingLine: shippingLine(p.shippingMethod, p.shippingFee),
          location: p.location,
          views: p.views,
          createdAt: p.createdAt,
          images: imagesOf(p.id).map((i) => ({ id: i.id, position: i.position, url: i.url })),
          seller: seller
            ? {
                id: seller.id,
                shopName: seller.shopName,
                initial: initialOf(seller.shopName),
                verified: seller.verifiedAt !== null,
                ratingStars: sellerStars(seller.id),
                activeProductCount: sellerVisibleCount(seller.id),
              }
            : null,
          reviews,
          reviewCount: reviews.length,
          related: relatedOf(p).map(toCard),
        }
      })
    },

    /** Seed and test-fixture loading (`m20LoadFixture`); the id is kept when free. */
    insertMany(rows: readonly MpProduct[]): MpProduct[] {
      return transaction(() =>
        rows.map((r) => {
          if (!store.get(r.id)) return store.insert({ ...r })
          const rest: Omit<MpProduct, 'id'> & { id?: number } = { ...r }
          delete rest.id
          return store.insert(rest)
        }),
      )
    },

    /** Test hook: a raw patch (e.g. `{stockStatus: 'out_of_stock'}`). */
    patch(id: number, patch: Partial<MpProduct>): MpProduct | undefined {
      return transaction(() => {
        if (!store.get(id)) return undefined
        return store.update(id, { ...patch, updatedAt: toIso(nowMs()) })
      })
    },
  }),
})

const mpSellersRepo = defineRepository({
  owner: 'M20',
  name: 'mpSellers',
  store: sellersTable,
  stores: { documents: documentsTable },
  methods: ({ store, stores, transaction }) => ({
    get(id: number): MpSeller | undefined {
      return store.get(id)
    },

    /** The Seller of a user (one per user), for the user-shell link "Kedai Saya" (FR-M20-79). */
    forUser(userId: number): MpSeller | undefined {
      return store.query({ where: { userId } }).rows[0]
    },

    total(): number {
      return store.count()
    },

    documentCount(sellerId: number): number {
      return stores.documents.count({ sellerId })
    },

    /** #17 (BR-M20-08): the shop of an active seller with its visible products; else `undefined`. */
    shop(sellerId: number): ShopView | undefined {
      const s = store.get(sellerId)
      if (!s || s.status !== 'active') return undefined
      const products = productsTable
        .query({ where: { sellerId } })
        .rows.filter(isVisible)
        .sort((a, b) =>
          a.createdAt === b.createdAt ? a.id - b.id : a.createdAt < b.createdAt ? 1 : -1,
        )
      return {
        shop: {
          id: s.id,
          shopName: s.shopName,
          initial: initialOf(s.shopName),
          description: s.description,
          verified: s.verifiedAt !== null,
          ratingStars: sellerStars(s.id),
          reviewCount: sellerReviews(s.id).length,
          productCount: products.length,
          createdAt: s.createdAt,
        },
        products: products.map(toCard),
      }
    },

    /**
     * #16 (BR-M20-21): for a visible product. A seller product adds 1 to the seller's
     * `whatsappClicks` and returns the seller's `wa.me` URL; a platform product counts nothing and
     * uses the platform number. `undefined` for an unknown or hidden slug.
     */
    click(slug: string): { url: string; countedSellerId: number | null } | undefined {
      return transaction(() => {
        const p = productsTable.query({ where: { slug } }).rows[0]
        if (!p || !isVisible(p)) return undefined
        const seller = sellerOf(p)
        let number = platformWhatsappNumber()
        if (seller) {
          store.update(seller.id, { whatsappClicks: seller.whatsappClicks + 1 })
          number = seller.whatsapp
        }
        const url = `https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage(p.name))}`
        return { url, countedSellerId: seller ? seller.id : null }
      })
    },

    /** Test-only raw patch (e.g. `{status: 'banned'}`; the real ban is M20-T4's #10). */
    patch(id: number, patch: Partial<MpSeller>): MpSeller | undefined {
      return transaction(() => (store.get(id) ? store.update(id, patch) : undefined))
    },

    insertMany(rows: readonly MpSeller[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },
  }),
})

export const mpCategoriesRepository = mpCategoriesRepo
export const mpProductsRepository = mpProductsRepo
export const mpImagesRepository = mpImagesRepo
export const mpSellersRepository = mpSellersRepo
export const mpReviewsRepository = mpReviewsRepo
