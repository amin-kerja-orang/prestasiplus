import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../db/generated/client'
import { PrismaService } from '../../db/prisma.service'
import type { MarketplaceProductStatus, MarketplaceSellerAction, MarketplaceSellerStatus } from '@pp/contract'

const LIST_INCLUDE = {
  category: { select: { name: true } },
  seller: { select: { shopName: true } },
  images: { orderBy: { position: 'asc' as const }, take: 1, select: { url: true } },
} satisfies Prisma.MarketplaceProductInclude

export type AdminProductListRow = Prisma.MarketplaceProductGetPayload<{ include: typeof LIST_INCLUDE }>

const DETAIL_INCLUDE = {
  category: { select: { name: true } },
  seller: { select: { shopName: true } },
  images: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.MarketplaceProductInclude

export type AdminProductDetailRow = Prisma.MarketplaceProductGetPayload<{ include: typeof DETAIL_INCLUDE }>

export interface AdminProductFilter {
  /** Already trimmed and cut; '' = no filter. */
  q: string
  categoryId: bigint | null
  status: MarketplaceProductStatus | null
}

export interface ProductWrite {
  sellerId: bigint | null
  name: string
  categoryId: bigint
  price: string
  originalPrice: string | null
  description: string | null
  condition: string
  stockStatus: string
  shippingMethod: string
  shippingFee: string | null
  location: string
  status: string
}

export type AdminSellerRow = Prisma.MarketplaceSellerGetPayload<Record<string, never>> & { productCount: number; ownerName: string }

/**
 * Admin side of the marketplace tables (S7-T08). Same rules as the buyer repository: parameterised statements only,
 * no visibility filter (the admin sees every status). `prisma.client` is the open transaction when the service
 * runs one, so a write and its audit row commit together.
 */
@Injectable()
export class MarketplaceAdminRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // --- products ---------------------------------------------------------------------------------------

  private productWhere(f: AdminProductFilter): Prisma.MarketplaceProductWhereInput {
    const where: Prisma.MarketplaceProductWhereInput = {}
    if (f.q !== '') where.name = { contains: f.q, mode: 'insensitive' }
    if (f.categoryId !== null) where.categoryId = f.categoryId
    if (f.status !== null) where.status = f.status
    return where
  }

  async products(filter: AdminProductFilter, skip: number, take: number): Promise<{ rows: AdminProductListRow[]; total: number }> {
    const where = this.productWhere(filter)
    const [rows, total] = await Promise.all([
      this.prisma.client.marketplaceProduct.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: LIST_INCLUDE,
      }),
      this.prisma.client.marketplaceProduct.count({ where }),
    ])
    return { rows, total }
  }

  /** Global stat cards: all products and the `active` ones (not the filtered query). */
  async productStats(): Promise<{ total: number; active: number }> {
    const [total, active] = await Promise.all([
      this.prisma.client.marketplaceProduct.count(),
      this.prisma.client.marketplaceProduct.count({ where: { status: 'active' } }),
    ])
    return { total, active }
  }

  product(id: bigint): Promise<AdminProductDetailRow | null> {
    return this.prisma.client.marketplaceProduct.findUnique({ where: { id }, include: DETAIL_INCLUDE })
  }

  categoryExists(id: bigint): Promise<boolean> {
    return this.prisma.client.marketplaceCategory.count({ where: { id } }).then((n) => n > 0)
  }

  slugTaken(slug: string): Promise<boolean> {
    return this.prisma.client.marketplaceProduct.count({ where: { slug } }).then((n) => n > 0)
  }

  async createProduct(data: ProductWrite & { slug: string }): Promise<bigint> {
    const row = await this.prisma.client.marketplaceProduct.create({ data: this.productData(data), select: { id: true } })
    return row.id
  }

  async updateProduct(id: bigint, data: Partial<ProductWrite>): Promise<void> {
    const patch: Prisma.MarketplaceProductUncheckedUpdateInput = { updatedAt: new Date() }
    if (data.sellerId !== undefined) patch.sellerId = data.sellerId
    if (data.name !== undefined) patch.name = data.name
    if (data.categoryId !== undefined) patch.categoryId = data.categoryId
    if (data.price !== undefined) patch.price = data.price
    if (data.originalPrice !== undefined) patch.originalPrice = data.originalPrice
    if (data.description !== undefined) patch.description = data.description
    if (data.condition !== undefined) patch.condition = data.condition
    if (data.stockStatus !== undefined) patch.stockStatus = data.stockStatus
    if (data.shippingMethod !== undefined) patch.shippingMethod = data.shippingMethod
    if (data.shippingFee !== undefined) patch.shippingFee = data.shippingFee
    if (data.location !== undefined) patch.location = data.location
    if (data.status !== undefined) patch.status = data.status
    await this.prisma.client.marketplaceProduct.update({ where: { id }, data: patch })
  }

  /** Deletes the product (images and reviews cascade). False when it is already gone. */
  async deleteProduct(id: bigint): Promise<boolean> {
    const res = await this.prisma.client.marketplaceProduct.deleteMany({ where: { id } })
    return res.count > 0
  }

  private productData(d: ProductWrite & { slug: string }): Prisma.MarketplaceProductUncheckedCreateInput {
    return {
      sellerId: d.sellerId,
      name: d.name,
      slug: d.slug,
      categoryId: d.categoryId,
      price: d.price,
      originalPrice: d.originalPrice,
      description: d.description,
      condition: d.condition,
      stockStatus: d.stockStatus,
      shippingMethod: d.shippingMethod,
      shippingFee: d.shippingFee,
      location: d.location,
      status: d.status,
    }
  }

  // --- images -----------------------------------------------------------------------------------------

  /** Locks the product row so two parallel image writes of one product cannot pick the same position. */
  async lockProduct(id: bigint): Promise<boolean> {
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>(Prisma.sql`SELECT id FROM marketplace_products WHERE id = ${id} FOR UPDATE`)
    return rows.length > 0
  }

  async imageStats(productId: bigint): Promise<{ count: number; maxPosition: number }> {
    const agg = await this.prisma.client.marketplaceProductImage.aggregate({ where: { productId }, _count: { _all: true }, _max: { position: true } })
    return { count: agg._count._all, maxPosition: agg._max.position ?? 0 }
  }

  async imageUrlsTaken(urls: string[]): Promise<boolean> {
    return (await this.prisma.client.marketplaceProductImage.count({ where: { url: { in: urls } } })) > 0
  }

  async addImages(productId: bigint, startPosition: number, urls: string[]): Promise<void> {
    await this.prisma.client.marketplaceProductImage.createMany({
      data: urls.map((url, i) => ({ productId, position: startPosition + i, url })),
    })
  }

  imageOf(productId: bigint, imageId: bigint) {
    return this.prisma.client.marketplaceProductImage.findFirst({ where: { id: imageId, productId } })
  }

  async deleteImage(id: bigint): Promise<boolean> {
    return (await this.prisma.client.marketplaceProductImage.deleteMany({ where: { id } })).count > 0
  }

  imageUrlsOfProduct(productId: bigint): Promise<{ url: string }[]> {
    return this.prisma.client.marketplaceProductImage.findMany({ where: { productId }, select: { url: true } })
  }

  /** Public tokens (of the given purpose) that exist among `tokens`. */
  async fileTokens(tokens: string[], purpose: string): Promise<Set<string>> {
    const rows = await this.prisma.client.file.findMany({ where: { publicId: { in: tokens }, purpose }, select: { publicId: true } })
    return new Set(rows.map((r) => r.publicId))
  }

  // --- sellers ----------------------------------------------------------------------------------------

  async activeSellerOptions(): Promise<{ id: bigint; shopName: string }[]> {
    return this.prisma.client.marketplaceSeller.findMany({
      where: { status: 'active' },
      orderBy: [{ shopName: 'asc' }, { id: 'asc' }],
      select: { id: true, shopName: true },
    })
  }

  async sellerIsActive(id: bigint): Promise<boolean> {
    return (await this.prisma.client.marketplaceSeller.count({ where: { id, status: 'active' } })) > 0
  }

  /** Global stat cards (not the filtered query). */
  async sellerStats(): Promise<{ total: number; active: number; pending: number }> {
    const [total, active, pending] = await Promise.all([
      this.prisma.client.marketplaceSeller.count(),
      this.prisma.client.marketplaceSeller.count({ where: { status: 'active' } }),
      this.prisma.client.marketplaceSeller.count({ where: { status: 'pending' } }),
    ])
    return { total, active, pending }
  }

  async sellers(status: MarketplaceSellerStatus | null, skip: number, take: number): Promise<{ rows: AdminSellerRow[]; total: number }> {
    const where: Prisma.MarketplaceSellerWhereInput = status ? { status } : {}
    const [sellers, total] = await Promise.all([
      this.prisma.client.marketplaceSeller.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
      this.prisma.client.marketplaceSeller.count({ where }),
    ])
    return { rows: await this.withExtras(sellers), total }
  }

  async seller(id: bigint): Promise<AdminSellerRow | null> {
    const s = await this.prisma.client.marketplaceSeller.findUnique({ where: { id } })
    if (!s) return null
    return (await this.withExtras([s]))[0] ?? null
  }

  /** Adds the product count (any status) and the owner's account name (`user_id` has no Prisma relation). */
  private async withExtras(sellers: Prisma.MarketplaceSellerGetPayload<Record<string, never>>[]): Promise<AdminSellerRow[]> {
    if (sellers.length === 0) return []
    const ids = sellers.map((s) => s.id)
    const [counts, users] = await Promise.all([
      this.prisma.client.marketplaceProduct.groupBy({ by: ['sellerId'], where: { sellerId: { in: ids } }, _count: { _all: true } }),
      this.prisma.client.user.findMany({ where: { id: { in: sellers.map((s) => s.userId) } }, select: { id: true, name: true } }),
    ])
    const countOf = new Map(counts.map((c) => [c.sellerId, c._count._all]))
    const nameOf = new Map(users.map((u) => [u.id, u.name]))
    return sellers.map((s) => ({ ...s, productCount: countOf.get(s.id) ?? 0, ownerName: nameOf.get(s.userId) ?? '' }))
  }

  /**
   * One atomic statement per transition: it changes the row only when the start status allows it, so two parallel
   * actions cannot both win. Returns false when the row did not match (unknown id, or a status that is not allowed).
   */
  async transition(id: bigint, action: MarketplaceSellerAction, from: readonly MarketplaceSellerStatus[], to: MarketplaceSellerStatus): Promise<boolean> {
    if (action === 'verify') {
      const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>(Prisma.sql`
        UPDATE marketplace_sellers SET verified_at = now()
        WHERE id = ${id} AND status = 'active' AND verified_at IS NULL RETURNING id`)
      return rows.length > 0
    }
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>(Prisma.sql`
      UPDATE marketplace_sellers SET status = ${to}
      WHERE id = ${id} AND status IN (${Prisma.join([...from])}) RETURNING id`)
    return rows.length > 0
  }
}
