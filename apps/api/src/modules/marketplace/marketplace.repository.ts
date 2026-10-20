import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../db/generated/client'
import { PrismaService } from '../../db/prisma.service'
import type { MarketplaceSort } from '@pp/contract'

/** BR-M20-08: active, and the seller (if any) active. Stock does not matter. */
export const VISIBLE_PRODUCT: Prisma.MarketplaceProductWhereInput = {
  status: 'active',
  OR: [{ sellerId: null }, { seller: { status: 'active' } }],
}

const CARD_INCLUDE = {
  images: { orderBy: { position: 'asc' as const }, take: 1, select: { url: true } },
  seller: { select: { shopName: true, verifiedAt: true } },
} satisfies Prisma.MarketplaceProductInclude

export type CardRow = Prisma.MarketplaceProductGetPayload<{ include: typeof CARD_INCLUDE }>

const DETAIL_INCLUDE = {
  category: true,
  images: { orderBy: { position: 'asc' as const } },
  seller: true,
  reviews: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] },
} satisfies Prisma.MarketplaceProductInclude

export type DetailRow = Prisma.MarketplaceProductGetPayload<{ include: typeof DETAIL_INCLUDE }>

export interface SearchFilter {
  /** Already trimmed and cut; '' = no filter. */
  q: string
  /** Category slug; '' = any. */
  category: string
  /** '' = any. */
  condition: string
  sort: MarketplaceSort
}

export interface SellerStats {
  reviewCount: number
  ratingSum: number
  visibleCount: number
}

/** The product page after the view counter moved (one atomic statement). */
export interface ViewedProduct {
  id: bigint
  views: number
}

export interface HandoffTarget {
  name: string
  /** Null: a platform product. */
  sellerId: bigint | null
  sellerWhatsapp: string | null
}

const VISIBLE_SQL = Prisma.sql`p.status = 'active' AND (p.seller_id IS NULL OR s.status = 'active')`

/**
 * The only doorway to the five marketplace tables (ADR-0014). Every statement is parameterised; sort
 * keys come from a fixed allow-list. Counters are single `UPDATE ... RETURNING` statements, so
 * parallel calls never lose a count.
 */
@Injectable()
export class MarketplaceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  categories() {
    return this.prisma.client.marketplaceCategory.findMany({ orderBy: { id: 'asc' } })
  }

  categoryBySlug(slug: string) {
    return this.prisma.client.marketplaceCategory.findUnique({ where: { slug } })
  }

  private orderBy(sort: MarketplaceSort, categorySet: boolean): Prisma.Sql {
    switch (sort) {
      case 'price_low':
        return Prisma.sql`p.price ASC, p.id ASC`
      case 'price_high':
        return Prisma.sql`p.price DESC, p.id ASC`
      case 'popular':
        return Prisma.sql`p.views DESC, p.id ASC`
      default:
        // DV-M20-07: id descending when a valid category is set.
        return categorySet ? Prisma.sql`p.created_at DESC, p.id DESC` : Prisma.sql`p.created_at DESC, p.id ASC`
    }
  }

  private where(filter: SearchFilter, categoryId: bigint | null): Prisma.Sql {
    const parts: Prisma.Sql[] = [VISIBLE_SQL]
    // strpos on lower(): a literal substring match, so `%` and `_` in the query are plain characters.
    if (filter.q !== '') parts.push(Prisma.sql`strpos(lower(p.name), lower(${filter.q})) > 0`)
    if (categoryId !== null) parts.push(Prisma.sql`p.category_id = ${categoryId}`)
    if (filter.condition !== '') parts.push(Prisma.sql`p.condition = ${filter.condition}`)
    return Prisma.join(parts, ' AND ')
  }

  /** BR-M20-05. `categoryId` is the resolved id of `filter.category` (null when no category filter). */
  async search(filter: SearchFilter, categoryId: bigint | null, skip: number, take: number): Promise<{ rows: CardRow[]; total: number }> {
    const where = this.where(filter, categoryId)
    const order = this.orderBy(filter.sort, categoryId !== null)
    const [ids, counted] = await Promise.all([
      this.prisma.client.$queryRaw<{ id: bigint }[]>(Prisma.sql`
        SELECT p.id FROM marketplace_products p
        LEFT JOIN marketplace_sellers s ON s.id = p.seller_id
        WHERE ${where} ORDER BY ${order} LIMIT ${take} OFFSET ${skip}`),
      this.prisma.client.$queryRaw<{ n: bigint }[]>(Prisma.sql`
        SELECT count(*) AS n FROM marketplace_products p
        LEFT JOIN marketplace_sellers s ON s.id = p.seller_id
        WHERE ${where}`),
    ])
    const total = Number(counted[0]?.n ?? 0n)
    if (ids.length === 0) return { rows: [], total }
    const rows = await this.prisma.client.marketplaceProduct.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: CARD_INCLUDE,
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    return { rows: ids.map((r) => byId.get(r.id)).filter((r): r is CardRow => r !== undefined), total }
  }

  /** The id of a visible product by slug, adding 1 to `views` in the same statement (BR-M20-12). */
  async bumpViews(slug: string): Promise<ViewedProduct | null> {
    const rows = await this.prisma.client.$queryRaw<ViewedProduct[]>(Prisma.sql`
      UPDATE marketplace_products p SET views = p.views + 1
      WHERE p.slug = ${slug} AND p.status = 'active'
        AND (p.seller_id IS NULL OR EXISTS (SELECT 1 FROM marketplace_sellers s WHERE s.id = p.seller_id AND s.status = 'active'))
      RETURNING p.id, p.views`)
    return rows[0] ?? null
  }

  productDetail(id: bigint): Promise<DetailRow | null> {
    return this.prisma.client.marketplaceProduct.findUnique({ where: { id }, include: DETAIL_INCLUDE })
  }

  /** Q-M20-RELATED (BR-M20-20). */
  related(product: { id: bigint; categoryId: bigint }, limit: number): Promise<CardRow[]> {
    return this.prisma.client.marketplaceProduct.findMany({
      where: { AND: [VISIBLE_PRODUCT, { categoryId: product.categoryId }, { id: { not: product.id } }] },
      orderBy: { id: 'asc' },
      take: limit,
      include: CARD_INCLUDE,
    })
  }

  /** Review count, rating sum and visible products of a seller; reviews cover ALL the seller's products (BR-M20-16). */
  async sellerStats(sellerId: bigint): Promise<SellerStats> {
    const [reviews, visible] = await Promise.all([
      this.prisma.client.$queryRaw<{ n: bigint; total: bigint | null }[]>(Prisma.sql`
        SELECT count(*) AS n, sum(r.rating) AS total FROM marketplace_reviews r
        JOIN marketplace_products p ON p.id = r.product_id WHERE p.seller_id = ${sellerId}`),
      this.prisma.client.marketplaceProduct.count({ where: { AND: [VISIBLE_PRODUCT, { sellerId }] } }),
    ])
    return { reviewCount: Number(reviews[0]?.n ?? 0n), ratingSum: Number(reviews[0]?.total ?? 0n), visibleCount: visible }
  }

  activeSeller(id: bigint) {
    return this.prisma.client.marketplaceSeller.findFirst({ where: { id, status: 'active' } })
  }

  /** Visible products of a seller, newest first, ties id ascending. */
  shopProducts(sellerId: bigint): Promise<CardRow[]> {
    return this.prisma.client.marketplaceProduct.findMany({
      where: { AND: [VISIBLE_PRODUCT, { sellerId }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: CARD_INCLUDE,
    })
  }

  /** A visible product's hand-off facts; null for an unknown or hidden slug. */
  async handoffTarget(slug: string): Promise<HandoffTarget | null> {
    const p = await this.prisma.client.marketplaceProduct.findFirst({
      where: { AND: [VISIBLE_PRODUCT, { slug }] },
      select: { name: true, sellerId: true, seller: { select: { whatsapp: true } } },
    })
    return p ? { name: p.name, sellerId: p.sellerId, sellerWhatsapp: p.seller?.whatsapp ?? null } : null
  }

  /** Adds 1 to the click counter of an active seller; false when the seller is no longer active. */
  async countClick(sellerId: bigint): Promise<boolean> {
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>(Prisma.sql`
      UPDATE marketplace_sellers SET whatsapp_clicks = whatsapp_clicks + 1
      WHERE id = ${sellerId} AND status = 'active' RETURNING id`)
    return rows.length > 0
  }
}
