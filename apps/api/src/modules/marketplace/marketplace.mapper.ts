import {
  marketplaceDiscountPct,
  marketplaceInitial,
  marketplaceRatingStars,
  marketplaceShippingLine,
  type MarketplaceCategory,
  type MarketplaceProductCard,
  type MarketplaceProductDetail,
  type MarketplaceSellerCard,
  type MarketplaceShippingMethod,
  type MarketplaceShop,
} from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import { idToString } from '../../db/ids'
import type { CardRow, DetailRow, SellerStats } from './marketplace.repository'

/** `+08:00` instant at whole seconds, as the mock writes it (the milliseconds are dropped). */
const wire = (d: Date): string => toMytTimestamp(d).replace(/\.\d{3}\+08:00$/, '+08:00')

type Fixed ={ toFixed(n: number): string }

/** Prisma `Decimal` as a two-decimal string, never through a float. */
export const money = (d: Fixed): string => d.toFixed(2)
const moneyOrNull = (d: Fixed | null): string | null => (d === null ? null : money(d))

/** `round(sum / count)` stars, or the empty rating without reviews. */
export const starsOf = (s: Pick<SellerStats, 'reviewCount' | 'ratingSum'>): string =>
  marketplaceRatingStars(s.reviewCount === 0 ? null : s.ratingSum / s.reviewCount)

export function toCategory(c: { id: bigint; slug: string; name: string; icon: string }): MarketplaceCategory {
  return { id: idToString(c.id), slug: c.slug, name: c.name, icon: c.icon }
}

export function toCard(p: CardRow): MarketplaceProductCard {
  const price = money(p.price)
  const originalPrice = moneyOrNull(p.originalPrice)
  const fee = moneyOrNull(p.shippingFee)
  return {
    id: idToString(p.id),
    slug: p.slug,
    name: p.name,
    price,
    originalPrice,
    discountPct: marketplaceDiscountPct(price, originalPrice),
    condition: p.condition as MarketplaceProductCard['condition'],
    thumbnailUrl: p.images[0]?.url ?? null,
    seller: p.seller ? { shopName: p.seller.shopName, verified: p.seller.verifiedAt !== null } : null,
    shippingLine: marketplaceShippingLine(p.shippingMethod as MarketplaceShippingMethod, fee),
  }
}

interface SellerRow {
  id: bigint
  shopName: string
  verifiedAt: Date | null
}

export function toSellerCard(s: SellerRow, stats: SellerStats): MarketplaceSellerCard {
  return {
    id: idToString(s.id),
    shopName: s.shopName,
    initial: marketplaceInitial(s.shopName),
    verified: s.verifiedAt !== null,
    ratingStars: starsOf(stats),
    activeProductCount: stats.visibleCount,
  }
}

export function toDetail(p: DetailRow, views: number, seller: MarketplaceSellerCard | null, related: CardRow[]): MarketplaceProductDetail {
  const price = money(p.price)
  const originalPrice = moneyOrNull(p.originalPrice)
  const fee = moneyOrNull(p.shippingFee)
  return {
    id: idToString(p.id),
    slug: p.slug,
    name: p.name,
    categoryId: idToString(p.categoryId),
    category: toCategory(p.category),
    price,
    originalPrice,
    discountPct: marketplaceDiscountPct(price, originalPrice),
    description: p.description,
    condition: p.condition as MarketplaceProductDetail['condition'],
    stockStatus: p.stockStatus as MarketplaceProductDetail['stockStatus'],
    shippingMethod: p.shippingMethod as MarketplaceShippingMethod,
    shippingFee: fee,
    shippingLine: marketplaceShippingLine(p.shippingMethod as MarketplaceShippingMethod, fee),
    location: p.location,
    views,
    createdAt: wire(p.createdAt),
    images: p.images.map((i) => ({ id: idToString(i.id), position: i.position, url: i.url })),
    seller,
    reviews: p.reviews.map((r) => ({
      id: idToString(r.id),
      userId: idToString(r.userId),
      rating: r.rating,
      text: r.text,
      createdAt: wire(r.createdAt),
    })),
    reviewCount: p.reviews.length,
    related: related.map(toCard),
  }
}

export function toShop(
  s: SellerRow & { description: string | null; createdAt: Date },
  stats: SellerStats,
  productCount: number,
): MarketplaceShop {
  return {
    id: idToString(s.id),
    shopName: s.shopName,
    initial: marketplaceInitial(s.shopName),
    description: s.description,
    verified: s.verifiedAt !== null,
    ratingStars: starsOf(stats),
    reviewCount: stats.reviewCount,
    productCount,
    createdAt: wire(s.createdAt),
  }
}
