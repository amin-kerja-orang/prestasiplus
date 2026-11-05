/**
 * M20 admin endpoints (API-ADM-19, S7-T08; role `admin` only: guest 401, any other role 403). The rules
 * mirror the API (`marketplace-admin.service.ts`) and use its contract schemas, so the 422 `fields`
 * texts are the same:
 *
 * | Route | Notes |
 * |---|---|
 * | `GET /api/admin/marketplace/products` | `?q&categoryId&status&page`; 20 per page; `meta.stats` is global |
 * | `POST /api/admin/marketplace/products` | 201; `images` are files of `purpose=marketplace_image` |
 * | `GET`/`PUT`/`DELETE …/products/:id` | PUT changes only the keys sent; `newImages` are appended; no order block (OD-9) |
 * | `DELETE …/products/:id/images/:imageId` | its own action (D-M20-01); answers the product |
 * | `GET …/seller-options` | "PRESTASIPLUS Official (Admin)" (`id: null`) first, then the active sellers |
 * | `GET …/sellers`, `GET …/sellers/:id` | `?status&page`; `meta.stats` is global; owner masked |
 * | `POST …/sellers/:id/{approve,verify,suspend,ban}` | 409 when the status does not allow it |
 * | `POST /api/files?purpose=marketplace_image` | the upload of the image field (admin only, JPG/PNG/WebP, 2 MB) |
 */

import {
  MARKETPLACE_ADMIN_ERRORS,
  MARKETPLACE_ADMIN_LIMITS,
  MARKETPLACE_ADMIN_MESSAGES,
  MARKETPLACE_ADMIN_PROPOSED,
  MARKETPLACE_OFFICIAL_SELLER_LABEL,
  MARKETPLACE_SELLER_ACTIONS,
  MarketplaceAdminProductCreateSchema,
  MarketplaceAdminProductListQuerySchema,
  MarketplaceAdminProductUpdateSchema,
  MarketplaceAdminSellerListQuerySchema,
  type MarketplaceSellerAction,
} from '@pp/contract'

import { API_ERROR_CODES } from '@/api/errors'
import {
  created,
  fail,
  notFound,
  ok,
  pageParams,
  paginate,
  requireRole,
  route,
  str,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import type { MpProduct } from '../repository/types'
import {
  adminProductDetail,
  adminProductRow,
  adminSellerDetail,
  adminSellerRow,
} from '../repository/admin-wire'
import {
  mpCategoriesRepository,
  mpImagesRepository,
  mpProductsRepository,
  mpSellersRepository,
} from '../repository/marketplace'

const adminOnly = requireRole('admin')

/** Decimal-string ids: digits only; anything else is an unknown id (404). */
const numericId = (text: string): number | null => (/^[1-9]\d{0,15}$/.test(text) ? Number(text) : null)

/** First message per field of a failed schema parse (the API's `StrictZodValidationPipe` shape). */
interface Issue {
  path: readonly PropertyKey[]
  message: string
  code: string
  keys?: string[]
}

/** The part of a zod schema this file uses (the root package does not depend on zod itself). */
interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: readonly Issue[] } }
}

function fieldsOf(issues: readonly Issue[]) {
  const fields: Record<string, string> = {}
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys' && issue.keys) {
      for (const key of issue.keys) fields[key] ??= issue.message
      continue
    }
    const key = String(issue.path[0] ?? '_')
    fields[key] ??= issue.message
  }
  return fields
}

function parse<T>(schema: Schema<T>, value: unknown): { value: T } | { error: MockResponse } {
  const result = schema.safeParse(value)
  if (result.success) return { value: result.data }
  return {
    error: validationError(fieldsOf(result.error.issues), MARKETPLACE_ADMIN_ERRORS.VALIDATION_ERROR.message),
  }
}

const bodyOf = (req: MockRequest): unknown =>
  typeof req.body === 'object' && req.body !== null ? req.body : {}

// --- upload (POST /api/files?purpose=marketplace_image) ------------------------------------------

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
let uploadCount = 0

/** Public token form of a `FileRef` (22 URL-safe characters); the mock numbers them. */
const tokenOf = (n: number): string => `mockmpimg${String(n).padStart(13, '0')}`

function upload(req: MockRequest): MockResponse {
  const purpose = req.query.purpose
  if (purpose !== 'marketplace_image') {
    return validationError({ purpose: 'Tujuan fail tidak sah.' })
  }
  const file = req.formData?.get('file')
  if (!(file instanceof Blob)) return validationError({ file: MARKETPLACE_ADMIN_MESSAGES.imageInvalid })
  if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
    return validationError({ file: MARKETPLACE_ADMIN_MESSAGES.imageInvalid })
  }
  uploadCount += 1
  const id = tokenOf(uploadCount)
  return created({ id, url: `/api/files/${id}` })
}

// --- products ------------------------------------------------------------------------------------

const IMAGE_URL = /^\/api\/files\/[A-Za-z0-9_-]{22}$/

/** P12-09 on the stored files: at most 5 in all, a file of this purpose, not used twice. */
function checkImages(urls: readonly string[], existing: number, field: string, fields: Record<string, string>): void {
  if (urls.length === 0) return
  if (existing + urls.length > MARKETPLACE_ADMIN_LIMITS.maxImages) {
    fields[field] = MARKETPLACE_ADMIN_MESSAGES.maxImages
  } else if (urls.some((u) => !IMAGE_URL.test(u))) {
    fields[field] = MARKETPLACE_ADMIN_MESSAGES.imageInvalid
  } else if (new Set(urls).size !== urls.length || urls.some((u) => mpImagesRepository.urlTaken(u))) {
    fields[field] = MARKETPLACE_ADMIN_PROPOSED.imageDuplicate
  }
}

/** The category must exist; the seller must be `null` (official) or an active seller. */
function checkRefs(
  categoryId: string | undefined,
  sellerId: string | null | undefined,
  fields: Record<string, string>,
): { categoryId?: number; sellerId?: number | null } {
  const out: { categoryId?: number; sellerId?: number | null } = {}
  if (categoryId !== undefined) {
    const id = numericId(categoryId)
    const category = id === null ? undefined : mpCategoriesRepository.all().find((c) => c.id === id)
    if (category) out.categoryId = category.id
    else fields.categoryId = MARKETPLACE_ADMIN_PROPOSED.categoryInvalid
  }
  if (sellerId !== undefined) {
    if (sellerId === null) out.sellerId = null
    else {
      const id = numericId(sellerId)
      const seller = id === null ? undefined : mpSellersRepository.get(id)
      if (seller?.status === 'active') out.sellerId = seller.id
      else fields.sellerId = MARKETPLACE_ADMIN_PROPOSED.sellerInvalid
    }
  }
  return out
}

function freeSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'produk'
  for (let n = 1; ; n += 1) {
    const slug = `${base}-m${String(n).padStart(4, '0')}`
    if (!mpProductsRepository.slugTaken(slug)) return slug
  }
}

const blankToNull = (v: string | null | undefined): string | null =>
  v === undefined || v === null || v.trim() === '' ? null : v

function products(req: MockRequest): MockResponse {
  const parsed = parse(MarketplaceAdminProductListQuerySchema, req.query)
  if ('error' in parsed) return parsed.error
  const q = parsed.value
  const categoryId = q.categoryId ? numericId(q.categoryId) : null
  const stats = mpProductsRepository.adminStats()
  // A category id that is not a numeric id matches nothing.
  const rows =
    q.categoryId && categoryId === null
      ? []
      : mpProductsRepository.adminList({
          q: (q.q ?? '').trim().slice(0, MARKETPLACE_ADMIN_LIMITS.queryMax),
          categoryId,
          status: q.status ? q.status : null,
        })
  return paginate(
    rows.map(adminProductRow),
    pageParams(req.query, { pageSize: MARKETPLACE_ADMIN_LIMITS.pageSize }),
    { stats },
  )
}

function productOf(req: MockRequest): MpProduct | undefined {
  const id = numericId(String(req.params.id))
  return id === null ? undefined : mpProductsRepository.get(id)
}

function product(req: MockRequest): MockResponse {
  const p = productOf(req)
  return p ? ok(adminProductDetail(p)) : notFound()
}

function createProduct(req: MockRequest): MockResponse {
  const parsed = parse(MarketplaceAdminProductCreateSchema, bodyOf(req))
  if ('error' in parsed) return parsed.error
  const b = parsed.value
  const fields: Record<string, string> = {}
  const refs = checkRefs(b.categoryId, b.sellerId, fields)
  checkImages(b.images ?? [], 0, 'images', fields)
  if (Object.keys(fields).length > 0) return validationError(fields)
  const row = mpProductsRepository.adminCreate(
    {
      sellerId: refs.sellerId ?? null,
      name: b.name,
      slug: freeSlug(b.name),
      categoryId: refs.categoryId as number,
      price: b.price,
      originalPrice: b.originalPrice ?? null,
      description: blankToNull(b.description),
      condition: b.condition,
      stockStatus: b.stockStatus,
      status: b.status ?? 'active',
      shippingMethod: b.shippingMethod,
      shippingFee: b.shippingFee ?? null,
      location: b.location ?? '',
    },
    b.images ?? [],
  )
  return created(adminProductDetail(row))
}

function updateProduct(req: MockRequest): MockResponse {
  const current = productOf(req)
  if (!current) return notFound()
  const parsed = parse(MarketplaceAdminProductUpdateSchema, bodyOf(req))
  if ('error' in parsed) return parsed.error
  const b = parsed.value
  const fields: Record<string, string> = {}
  // An unchanged seller is accepted whatever its status.
  const sameSeller =
    b.sellerId !== undefined &&
    (b.sellerId === null ? current.sellerId === null : current.sellerId !== null && b.sellerId === String(current.sellerId))
  const refs = checkRefs(b.categoryId, sameSeller ? undefined : b.sellerId, fields)
  // The price rule on the merged values.
  const price = b.price ?? current.price
  const original = b.originalPrice === undefined ? current.originalPrice : b.originalPrice
  if (original !== null && !(Number(original) > Number(price))) {
    fields.originalPrice = MARKETPLACE_ADMIN_MESSAGES.originalPriceNotGreater
  }
  checkImages(b.newImages ?? [], mpImagesRepository.forProduct(current.id).length, 'newImages', fields)
  if (Object.keys(fields).length > 0) return validationError(fields)

  const patch: Partial<MpProduct> = {}
  if (refs.sellerId !== undefined) patch.sellerId = refs.sellerId
  if (b.name !== undefined) patch.name = b.name
  if (refs.categoryId !== undefined) patch.categoryId = refs.categoryId
  if (b.price !== undefined) patch.price = b.price
  if (b.originalPrice !== undefined) patch.originalPrice = b.originalPrice
  if (b.description !== undefined) patch.description = blankToNull(b.description)
  if (b.condition !== undefined) patch.condition = b.condition
  if (b.stockStatus !== undefined) patch.stockStatus = b.stockStatus
  if (b.shippingMethod !== undefined) patch.shippingMethod = b.shippingMethod
  if (b.shippingFee !== undefined) patch.shippingFee = b.shippingFee
  if (b.location !== undefined) patch.location = b.location
  if (b.status !== undefined) patch.status = b.status
  const updated = mpProductsRepository.adminUpdate(current.id, patch, b.newImages ?? [])
  return updated ? ok(adminProductDetail(updated)) : notFound()
}

function removeProduct(req: MockRequest): MockResponse {
  const p = productOf(req)
  if (!p || !mpProductsRepository.adminRemove(p.id)) return notFound()
  return ok({ id: String(p.id) })
}

function removeImage(req: MockRequest): MockResponse {
  const p = productOf(req)
  const imageId = numericId(String(req.params.imageId))
  if (!p || imageId === null || !mpProductsRepository.adminRemoveImage(p.id, imageId)) return notFound()
  const after = mpProductsRepository.get(p.id)
  return after ? ok(adminProductDetail(after)) : notFound()
}

// --- sellers -------------------------------------------------------------------------------------

function sellerOptions(): MockResponse {
  return ok([
    { id: null, label: MARKETPLACE_OFFICIAL_SELLER_LABEL },
    ...mpSellersRepository.activeOptions().map((s) => ({ id: String(s.id), label: s.shopName })),
  ])
}

function sellers(req: MockRequest): MockResponse {
  const parsed = parse(MarketplaceAdminSellerListQuerySchema, req.query)
  if ('error' in parsed) return parsed.error
  return paginate(
    mpSellersRepository.adminList(parsed.value.status ? parsed.value.status : null).map(adminSellerRow),
    pageParams(req.query, { pageSize: MARKETPLACE_ADMIN_LIMITS.pageSize }),
    { stats: mpSellersRepository.adminStats() },
  )
}

function seller(req: MockRequest): MockResponse {
  const id = numericId(String(req.params.id))
  const s = id === null ? undefined : mpSellersRepository.get(id)
  return s ? ok(adminSellerDetail(s)) : notFound()
}

function transition(action: MarketplaceSellerAction) {
  return (req: MockRequest): MockResponse => {
    const id = numericId(String(req.params.id))
    const result = id === null ? undefined : mpSellersRepository.transition(id, action)
    if (result === undefined) return notFound()
    if (result === 'conflict') {
      return fail(409, API_ERROR_CODES.CONFLICT, MARKETPLACE_ADMIN_ERRORS.CONFLICT.message)
    }
    return ok(adminSellerDetail(result))
  }
}

const A = '/api/admin/marketplace'

export const adminRoutes: RouteDef[] = [
  route('GET', `${A}/products`, [adminOnly], products),
  route('POST', `${A}/products`, [adminOnly], createProduct),
  route('GET', `${A}/products/:id`, [adminOnly], product, { params: { id: str() } }),
  route('PUT', `${A}/products/:id`, [adminOnly], updateProduct, { params: { id: str() } }),
  route('DELETE', `${A}/products/:id`, [adminOnly], removeProduct, { params: { id: str() } }),
  route('DELETE', `${A}/products/:id/images/:imageId`, [adminOnly], removeImage, {
    params: { id: str(), imageId: str() },
  }),
  route('GET', `${A}/seller-options`, [adminOnly], sellerOptions),
  route('GET', `${A}/sellers`, [adminOnly], sellers),
  route('GET', `${A}/sellers/:id`, [adminOnly], seller, { params: { id: str() } }),
  ...MARKETPLACE_SELLER_ACTIONS.map((action) =>
    route('POST', `${A}/sellers/:id/${action}`, [adminOnly], transition(action), { params: { id: str() } }),
  ),
  route('POST', '/api/files', [adminOnly], upload),
]
