import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  MARKETPLACE_PAGE_SIZE,
  MARKETPLACE_QUERY_MAX,
  MARKETPLACE_RELATED_LIMIT,
  MARKETPLACE_SORTS,
  marketplaceWhatsappUrl,
  type ListMeta,
  type MarketplaceCategory,
  type MarketplaceProductCard,
  type MarketplaceProductDetail,
  type MarketplaceShopView,
  type MarketplaceSort,
  type MarketplaceWhatsappHandoff,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http/respond'
import { idFromString, isIdString } from '../../db/ids'
import { DEFAULT_PLATFORM_WHATSAPP } from './marketplace.constants'
import { toCard, toCategory, toDetail, toSellerCard, toShop } from './marketplace.mapper'
import { MarketplaceRepository } from './marketplace.repository'

/** Raw query values as they arrive (a repeated key is an array; the first string wins). */
export interface RawSearchQuery {
  q?: unknown
  category?: unknown
  condition?: unknown
  sort?: unknown
  page?: unknown
}

const first = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : ''
}

/** Longest page number kept as given; anything longer is an out-of-range page anyway. */
const PAGE_MAX_DIGITS = 9

function pageOf(raw: string): number {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return 1
  if (t.length > PAGE_MAX_DIGITS) return 10 ** PAGE_MAX_DIGITS
  return Math.max(1, Number(t))
}

const notFound = (): ApiError => ApiError.of('NOT_FOUND')

@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(MarketplaceRepository) private readonly repo: MarketplaceRepository,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async categories(): Promise<MarketplaceCategory[]> {
    return (await this.repo.categories()).map(toCategory)
  }

  /** BR-M20-05, V-M20-03. Never a 422: odd values degrade (unknown sort = latest, unknown category = empty). */
  async search(raw: RawSearchQuery): Promise<{ data: MarketplaceProductCard[]; meta: ListMeta }> {
    const q = first(raw.q).trim().slice(0, MARKETPLACE_QUERY_MAX)
    const categorySlug = first(raw.category).trim()
    const condition = first(raw.condition).trim()
    const sortRaw = first(raw.sort).trim()
    const sort: MarketplaceSort = (MARKETPLACE_SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as MarketplaceSort) : 'latest'
    const page = pageOf(first(raw.page))

    let categoryId: bigint | null = null
    if (categorySlug !== '') {
      const category = await this.repo.categoryBySlug(categorySlug)
      if (!category) return { data: [], meta: listMeta(page, MARKETPLACE_PAGE_SIZE, 0) }
      categoryId = category.id
    }
    const { rows, total } = await this.repo.search(
      { q, category: categorySlug, condition, sort },
      categoryId,
      (page - 1) * MARKETPLACE_PAGE_SIZE,
      MARKETPLACE_PAGE_SIZE,
    )
    return { data: rows.map(toCard), meta: listMeta(page, MARKETPLACE_PAGE_SIZE, total) }
  }

  /** BR-M20-12: +1 view on every call to a visible product. */
  async product(slug: string): Promise<MarketplaceProductDetail> {
    const viewed = await this.repo.bumpViews(slug)
    if (!viewed) throw notFound()
    const p = await this.repo.productDetail(viewed.id)
    if (!p) throw notFound()
    const sellerRow = p.seller
    const [related, seller] = await Promise.all([
      this.repo.related(p, MARKETPLACE_RELATED_LIMIT),
      sellerRow ? this.repo.sellerStats(sellerRow.id).then((stats) => toSellerCard(sellerRow, stats)) : Promise.resolve(null),
    ])
    return toDetail(p, viewed.views, seller, related)
  }

  /** BR-M20-21. Builds the URL only; nothing is sent anywhere (D14). */
  async whatsapp(slug: string): Promise<MarketplaceWhatsappHandoff> {
    const target = await this.repo.handoffTarget(slug)
    if (!target) throw notFound()
    let number = this.platformNumber()
    if (target.sellerId !== null) {
      if (!(await this.repo.countClick(target.sellerId))) throw notFound()
      const digits = (target.sellerWhatsapp ?? '').replace(/\D/g, '')
      if (digits !== '') number = digits
    }
    return { url: marketplaceWhatsappUrl(number, target.name) }
  }

  /** BR-M20-08: active sellers only; an unknown or non-numeric id is a 404. */
  async shop(id: string): Promise<MarketplaceShopView> {
    if (!isIdString(id)) throw notFound()
    const seller = await this.repo.activeSeller(idFromString(id))
    if (!seller) throw notFound()
    const [stats, products] = await Promise.all([this.repo.sellerStats(seller.id), this.repo.shopProducts(seller.id)])
    return { shop: toShop(seller, stats, products.length), products: products.map(toCard) }
  }

  private platformNumber(): string {
    const n = String(this.config.get<string>('MARKETPLACE_PLATFORM_WHATSAPP') ?? '').replace(/\D/g, '')
    return n === '' ? DEFAULT_PLATFORM_WHATSAPP : n
  }
}
