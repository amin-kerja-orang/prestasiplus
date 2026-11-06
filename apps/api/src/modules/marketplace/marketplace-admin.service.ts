import { randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import {
  MARKETPLACE_ADMIN_LIMITS,
  MARKETPLACE_ADMIN_MESSAGES as MSG,
  MARKETPLACE_ADMIN_PROPOSED as PROPOSED,
  MARKETPLACE_OFFICIAL_SELLER_LABEL,
  MARKETPLACE_SELLER_TRANSITIONS,
  type MarketplaceAdminDeleted,
  type MarketplaceAdminProductCreate,
  type MarketplaceAdminProductDetail,
  type MarketplaceAdminProductListQuery,
  type MarketplaceAdminProductListResponse,
  type MarketplaceAdminProductUpdate,
  type MarketplaceAdminSellerDetail,
  type MarketplaceAdminSellerListQuery,
  type MarketplaceAdminSellerListResponse,
  type MarketplaceAdminSellerOption,
  type MarketplaceProductStatus,
  type MarketplaceSellerAction,
  type MarketplaceSellerStatus,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http/respond'
import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { FilesService } from '../files'
import { fileTokenOfImageUrl, imageUrlOfToken, MARKETPLACE_IMAGE_PURPOSE } from './marketplace-admin.images'
import type { MarketplaceActor } from './marketplace-admin.actor'
import { MarketplaceAdminRepository, type ProductWrite } from './marketplace-admin.repository'
import { toAdminProductDetail, toAdminProductRow, toAdminSellerDetail, toAdminSellerRow } from './marketplace.mapper'

const notFound = (): ApiError => ApiError.of('NOT_FOUND')
const invalid = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })

const SELLER_AUDIT: Record<MarketplaceSellerAction, string> = {
  approve: AUDIT_ACTIONS.MARKETPLACE_SELLER_APPROVED,
  verify: AUDIT_ACTIONS.MARKETPLACE_SELLER_VERIFIED,
  suspend: AUDIT_ACTIONS.MARKETPLACE_SELLER_SUSPENDED,
  ban: AUDIT_ACTIONS.MARKETPLACE_SELLER_BANNED,
}

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const SLUG_BASE_MAX = 60

/** `Beg Sekolah Anti-Air` -> `beg-sekolah-anti-air` (ASCII, at most 60 characters). */
export function slugBase(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_BASE_MAX)
    .replace(/-+$/g, '')
  return s === '' ? 'produk' : s
}

/** The seeded form: base + "-" + 5 random alphanumerics. */
export const slugWithSuffix = (name: string): string =>
  `${slugBase(name)}-${Array.from({ length: 5 }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join('')}`

/** 1-based page from the raw query text; anything that is not a positive integer (NaN, 0, a fraction, Infinity) is page 1. */
export const pageOf = (raw: string | undefined): number => {
  const n = Number(raw)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}

/**
 * Admin side of the marketplace (S7-T08, API-ADM-19). Every write runs in one transaction with its audit row.
 * Image files are removed AFTER the commit (a failed delete never leaves a row pointing at a missing file, and a
 * failed clean-up only leaves an orphan file). Sellers are never created or deleted here (decision 6).
 */
@Injectable()
export class MarketplaceAdminService {
  constructor(
    @Inject(MarketplaceAdminRepository) private readonly repo: MarketplaceAdminRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  private record(actor: MarketplaceActor, action: string, targetType: string, targetId: string, details: Record<string, unknown>) {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetType,
      targetId,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details,
    })
  }

  // --- products: reads ----------------------------------------------------------------------------------

  async products(query: MarketplaceAdminProductListQuery): Promise<MarketplaceAdminProductListResponse> {
    const page = pageOf(query.page)
    const pageSize = MARKETPLACE_ADMIN_LIMITS.pageSize
    const q = (query.q ?? '').trim().slice(0, MARKETPLACE_ADMIN_LIMITS.queryMax)
    const stats = await this.repo.productStats()
    const categoryText = query.categoryId ?? ''
    // A category id that is not a numeric id matches nothing (the select only offers real ids).
    if (categoryText !== '' && !isIdString(categoryText)) return { data: [], meta: { ...listMeta(page, pageSize, 0), stats } }
    const { rows, total } = await this.repo.products(
      { q, categoryId: categoryText === '' ? null : idFromString(categoryText), status: (query.status || null) as MarketplaceProductStatus | null },
      (page - 1) * pageSize,
      pageSize,
    )
    return { data: rows.map(toAdminProductRow), meta: { ...listMeta(page, pageSize, total), stats } }
  }

  async product(idText: string): Promise<MarketplaceAdminProductDetail> {
    const row = await this.repo.product(this.idOf(idText))
    if (!row) throw notFound()
    return toAdminProductDetail(row)
  }

  async sellerOptions(): Promise<MarketplaceAdminSellerOption[]> {
    const sellers = await this.repo.activeSellerOptions()
    return [{ id: null, label: MARKETPLACE_OFFICIAL_SELLER_LABEL }, ...sellers.map((s) => ({ id: idToString(s.id), label: s.shopName }))]
  }

  // --- products: writes ---------------------------------------------------------------------------------

  async create(actor: MarketplaceActor, body: MarketplaceAdminProductCreate): Promise<MarketplaceAdminProductDetail> {
    const fields: Record<string, string> = {}
    const categoryId = await this.categoryOf(body.categoryId, fields)
    const sellerId = await this.sellerOf(body.sellerId, fields)
    const urls = await this.checkImages(body.images ?? [], 0, 'images', fields)
    if (Object.keys(fields).length > 0) throw invalid(fields)

    const id = await this.prisma.transaction(async () => {
      const newId = await this.repo.createProduct({
        sellerId,
        name: body.name,
        categoryId: categoryId as bigint,
        price: body.price,
        originalPrice: body.originalPrice ?? null,
        description: this.blankToNull(body.description),
        condition: body.condition,
        stockStatus: body.stockStatus,
        shippingMethod: body.shippingMethod,
        shippingFee: body.shippingFee ?? null,
        location: body.location ?? '',
        status: body.status ?? 'active',
        slug: await this.freeSlug(body.name),
      })
      if (urls.length > 0) await this.repo.addImages(newId, 1, urls)
      await this.record(actor, AUDIT_ACTIONS.MARKETPLACE_PRODUCT_CREATED, 'marketplace_product', idToString(newId), {
        name: body.name,
        status: body.status ?? 'active',
        sellerId: sellerId === null ? null : idToString(sellerId),
        images: urls.length,
      })
      return newId
    })
    return this.product(idToString(id))
  }

  async update(actor: MarketplaceActor, idText: string, body: MarketplaceAdminProductUpdate): Promise<MarketplaceAdminProductDetail> {
    const id = this.idOf(idText)
    await this.prisma.transaction(async () => {
      // The row lock also serialises two parallel image writes of one product (positions stay unique).
      if (!(await this.repo.lockProduct(id))) throw notFound()
      const current = await this.repo.product(id)
      if (!current) throw notFound()
      const fields: Record<string, string> = {}

      const categoryId = body.categoryId === undefined ? undefined : await this.categoryOf(body.categoryId, fields)
      let sellerId: bigint | null | undefined
      if (body.sellerId !== undefined) {
        const same = (body.sellerId === null && current.sellerId === null) || (body.sellerId !== null && current.sellerId !== null && body.sellerId === idToString(current.sellerId))
        // Unchanged seller is accepted whatever its status (a suspended seller's product can still be edited).
        sellerId = same ? current.sellerId : await this.sellerOf(body.sellerId, fields)
      }
      // The price rule on the merged values: a lower original price than the stored price is refused too.
      const price = body.price ?? current.price.toFixed(2)
      const original = body.originalPrice === undefined ? (current.originalPrice?.toFixed(2) ?? null) : body.originalPrice
      if (original !== null && !(Number(original) > Number(price))) fields.originalPrice = MSG.originalPriceNotGreater
      const urls = await this.checkImages(body.newImages ?? [], current.images.length, 'newImages', fields)
      if (Object.keys(fields).length > 0) throw invalid(fields)

      const patch: Partial<ProductWrite> = {}
      if (sellerId !== undefined) patch.sellerId = sellerId
      if (body.name !== undefined) patch.name = body.name
      if (categoryId !== undefined && categoryId !== null) patch.categoryId = categoryId
      if (body.price !== undefined) patch.price = body.price
      if (body.originalPrice !== undefined) patch.originalPrice = body.originalPrice
      if (body.description !== undefined) patch.description = this.blankToNull(body.description)
      if (body.condition !== undefined) patch.condition = body.condition
      if (body.stockStatus !== undefined) patch.stockStatus = body.stockStatus
      if (body.shippingMethod !== undefined) patch.shippingMethod = body.shippingMethod
      if (body.shippingFee !== undefined) patch.shippingFee = body.shippingFee
      if (body.location !== undefined) patch.location = body.location
      if (body.status !== undefined) patch.status = body.status
      await this.repo.updateProduct(id, patch)
      if (urls.length > 0) {
        const { maxPosition } = await this.repo.imageStats(id)
        await this.repo.addImages(id, maxPosition + 1, urls)
      }
      await this.record(actor, AUDIT_ACTIONS.MARKETPLACE_PRODUCT_UPDATED, 'marketplace_product', idToString(id), {
        changed: Object.keys(patch),
        ...(body.status !== undefined ? { statusFrom: current.status, statusTo: body.status } : {}),
        imagesAdded: urls.length,
      })
    })
    return this.product(idToString(id))
  }

  async remove(actor: MarketplaceActor, idText: string): Promise<MarketplaceAdminDeleted['data']> {
    const id = this.idOf(idText)
    const urls = await this.prisma.transaction(async () => {
      if (!(await this.repo.lockProduct(id))) throw notFound()
      const product = await this.repo.product(id)
      const images = await this.repo.imageUrlsOfProduct(id)
      if (!product || !(await this.repo.deleteProduct(id))) throw notFound()
      await this.record(actor, AUDIT_ACTIONS.MARKETPLACE_PRODUCT_DELETED, 'marketplace_product', idToString(id), {
        name: product.name,
        status: product.status,
        images: images.length,
      })
      return images.map((i) => i.url)
    })
    await this.discardFiles(urls)
    return { id: idToString(id) }
  }

  async removeImage(actor: MarketplaceActor, idText: string, imageIdText: string): Promise<MarketplaceAdminProductDetail> {
    const id = this.idOf(idText)
    const imageId = this.idOf(imageIdText)
    const url = await this.prisma.transaction(async () => {
      if (!(await this.repo.lockProduct(id))) throw notFound()
      const image = await this.repo.imageOf(id, imageId)
      if (!image || !(await this.repo.deleteImage(imageId))) throw notFound()
      await this.record(actor, AUDIT_ACTIONS.MARKETPLACE_PRODUCT_IMAGE_DELETED, 'marketplace_product', idToString(id), {
        imageId: idToString(imageId),
        position: image.position,
      })
      return image.url
    })
    await this.discardFiles([url])
    return this.product(idToString(id))
  }

  // --- sellers ------------------------------------------------------------------------------------------

  async sellers(query: MarketplaceAdminSellerListQuery): Promise<MarketplaceAdminSellerListResponse> {
    const page = pageOf(query.page)
    const pageSize = MARKETPLACE_ADMIN_LIMITS.pageSize
    const [stats, { rows, total }] = await Promise.all([
      this.repo.sellerStats(),
      this.repo.sellers((query.status || null) as MarketplaceSellerStatus | null, (page - 1) * pageSize, pageSize),
    ])
    return { data: rows.map(toAdminSellerRow), meta: { ...listMeta(page, pageSize, total), stats } }
  }

  async seller(idText: string): Promise<MarketplaceAdminSellerDetail> {
    const row = await this.repo.seller(this.idOf(idText))
    if (!row) throw notFound()
    return toAdminSellerDetail(row)
  }

  /** One of the four transitions of `MARKETPLACE_SELLER_TRANSITIONS`; atomic, 404 unknown seller, 409 not allowed from the current status. */
  async transition(actor: MarketplaceActor, idText: string, action: MarketplaceSellerAction): Promise<MarketplaceAdminSellerDetail> {
    const id = this.idOf(idText)
    const rule = MARKETPLACE_SELLER_TRANSITIONS[action]
    await this.prisma.transaction(async () => {
      const before = await this.repo.seller(id)
      if (!before) throw notFound()
      if (!(await this.repo.transition(id, action, rule.from, rule.to))) {
        throw ApiError.of('CONFLICT', { message: MSG.transitionNotAllowed })
      }
      await this.record(actor, SELLER_AUDIT[action], 'marketplace_seller', idToString(id), {
        statusFrom: before.status,
        statusTo: rule.to,
        shopName: before.shopName,
      })
    })
    return this.seller(idToString(id))
  }

  // --- helpers ------------------------------------------------------------------------------------------

  /** A non-numeric id is an unknown row. */
  private idOf(text: string): bigint {
    if (!isIdString(text)) throw notFound()
    return idFromString(text)
  }

  private blankToNull(v: string | null | undefined): string | null {
    if (v === undefined || v === null) return null
    return v.trim() === '' ? null : v
  }

  private async categoryOf(text: string, fields: Record<string, string>): Promise<bigint | null> {
    if (isIdString(text) && (await this.repo.categoryExists(idFromString(text)))) return idFromString(text)
    fields.categoryId = PROPOSED.categoryInvalid
    return null
  }

  /** `null` = the official seller. Any other seller must exist and be `active`. */
  private async sellerOf(text: string | null, fields: Record<string, string>): Promise<bigint | null> {
    if (text === null) return null
    if (isIdString(text) && (await this.repo.sellerIsActive(idFromString(text)))) return idFromString(text)
    fields.sellerId = PROPOSED.sellerInvalid
    return null
  }

  /**
   * Every url must be the download url of a stored `marketplace_image` file, used once, and not already an image of a
   * product. `existing` counts the product's current images toward the maximum of 5. Returns the stored urls.
   */
  private async checkImages(urls: string[], existing: number, field: string, fields: Record<string, string>): Promise<string[]> {
    if (urls.length === 0) return []
    if (existing + urls.length > MARKETPLACE_ADMIN_LIMITS.maxImages) {
      fields[field] = MSG.maxImages
      return []
    }
    const tokens = urls.map(fileTokenOfImageUrl)
    if (tokens.some((t) => t === null)) {
      fields[field] = MSG.imageInvalid
      return []
    }
    const list = tokens as string[]
    const found = await this.repo.fileTokens(list, MARKETPLACE_IMAGE_PURPOSE)
    if (list.some((t) => !found.has(t))) {
      fields[field] = MSG.imageInvalid
      return []
    }
    const stored = list.map(imageUrlOfToken)
    if (new Set(stored).size !== stored.length || (await this.repo.imageUrlsTaken(stored))) {
      fields[field] = PROPOSED.imageDuplicate
      return []
    }
    return stored
  }

  private async freeSlug(name: string): Promise<string> {
    for (let i = 0; i < 8; i += 1) {
      const slug = slugWithSuffix(name)
      if (!(await this.repo.slugTaken(slug))) return slug
    }
    throw ApiError.of('CONFLICT')
  }

  /** Removes the stored files behind deleted image rows (seeded asset paths have none). Never throws. */
  private async discardFiles(urls: string[]): Promise<void> {
    for (const url of urls) {
      const token = fileTokenOfImageUrl(url)
      if (token !== null) await this.files.discard(token, MARKETPLACE_IMAGE_PURPOSE)
    }
  }
}
