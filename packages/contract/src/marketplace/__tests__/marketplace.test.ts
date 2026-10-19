import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { MARKETPLACE_COMPONENT_SCHEMAS } from '../paths'
import {
  MARKETPLACE_ERRORS,
  MARKETPLACE_PAGE_SIZE,
  MarketplaceCategoryListResponseSchema,
  MarketplaceProductCardSchema,
  MarketplaceProductDetailSchema,
  MarketplaceProductListResponseSchema,
  MarketplaceProductResponseSchema,
  MarketplaceSearchQuerySchema,
  MarketplaceSellerCardSchema,
  MarketplaceShopResponseSchema,
  MarketplaceWhatsappResponseSchema,
  marketplaceDiscountPct,
  marketplaceInitial,
  marketplaceRatingStars,
  marketplaceShippingLine,
  marketplaceWhatsappUrl,
} from '../schema'

const AT = '2026-02-09T12:00:00+08:00'
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success

/** Mock seed shapes (SRS M20 6.11): seller 1 and the observed products, ids as strings. */
const category = { id: '1', slug: 'peralatan-sekolah', name: 'Peralatan Sekolah', icon: 'fa-pencil-ruler' }
const card1 = {
  id: '1',
  slug: 'beg-sekolah-anti-air-premium-vH1Fj',
  name: 'Beg Sekolah Anti-Air Premium',
  price: '89.90',
  originalPrice: '129.90',
  discountPct: 31,
  condition: 'new',
  thumbnailUrl: '/images/marketplace/products/1/img_1.jpg',
  seller: { shopName: 'JomBelajar Official', verified: true },
  shippingLine: 'Pos / Kurier (RM8.00)',
}
/** Platform product: no seller, no thumbnail, no original price. */
const card5 = {
  id: '5',
  slug: 'e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84',
  name: 'E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)',
  price: '19.90',
  originalPrice: null,
  discountPct: null,
  condition: 'new',
  thumbnailUrl: null,
  seller: null,
  shippingLine: 'Penghantaran Percuma 🎉',
}
const sellerCard = { id: '1', shopName: 'JomBelajar Official', initial: 'J', verified: true, ratingStars: '☆☆☆☆☆', activeProductCount: 10 }
const detail = {
  id: '1',
  slug: card1.slug,
  name: card1.name,
  categoryId: '1',
  category,
  price: '89.90',
  originalPrice: '129.90',
  discountPct: 31,
  description: 'Beg sekolah kalis air dengan 4 kompartmen.',
  condition: 'new',
  stockStatus: 'available',
  shippingMethod: 'postage',
  shippingFee: '8.00',
  shippingLine: 'Pos / Kurier (RM8.00)',
  location: 'Kuala Lumpur',
  views: 31,
  createdAt: AT,
  images: [
    { id: '1', position: 1, url: '/images/marketplace/products/1/img_1.jpg' },
    { id: '2', position: 2, url: '/images/marketplace/products/1/img_2.jpg' },
  ],
  seller: sellerCard,
  reviews: [{ id: '3', userId: '2', rating: 4, text: 'Beg yang kemas.', createdAt: AT }],
  reviewCount: 1,
  related: [card5],
}
const meta = { page: 1, pageSize: 20, totalItems: 2, totalPages: 1, from: 1, to: 2 }

describe('MarketplaceCategory list (GET /marketplace/categories)', () => {
  it('parses the six constant categories and has no meta', () => {
    expect(ok(MarketplaceCategoryListResponseSchema, { data: [category] })).toBe(true)
    expect(ok(MarketplaceCategoryListResponseSchema, { data: [] })).toBe(true)
    expect(ok(MarketplaceCategoryListResponseSchema, { data: [category], meta })).toBe(false)
  })

  it('rejects numeric ids and a missing icon', () => {
    expect(ok(MarketplaceCategoryListResponseSchema, { data: [{ ...category, id: 1 }] })).toBe(false)
    expect(ok(MarketplaceCategoryListResponseSchema, { data: [{ ...category, icon: undefined }] })).toBe(false)
  })
})

describe('MarketplaceProductCard and the search list (GET /marketplace/products)', () => {
  it('parses a seller product and a platform product', () => {
    expect(ok(MarketplaceProductCardSchema, card1)).toBe(true)
    expect(ok(MarketplaceProductCardSchema, card5)).toBe(true)
    expect(ok(MarketplaceProductListResponseSchema, { data: [card1, card5], meta })).toBe(true)
  })

  it('answers an empty page with null from/to', () => {
    const empty = { page: 3, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null }
    expect(ok(MarketplaceProductListResponseSchema, { data: [], meta: empty })).toBe(true)
  })

  it('requires meta and at most 20 rows per page', () => {
    expect(ok(MarketplaceProductListResponseSchema, { data: [card1] })).toBe(false)
    const many = Array.from({ length: MARKETPLACE_PAGE_SIZE + 1 }, () => card1)
    expect(ok(MarketplaceProductListResponseSchema, { data: many, meta })).toBe(false)
    expect(ok(MarketplaceProductListResponseSchema, { data: many.slice(1), meta })).toBe(true)
  })

  it('prices are two-decimal strings, never numbers', () => {
    expect(ok(MarketplaceProductCardSchema, { ...card1, price: 89.9 })).toBe(false)
    expect(ok(MarketplaceProductCardSchema, { ...card1, price: '89.9' })).toBe(false)
    expect(ok(MarketplaceProductCardSchema, { ...card1, price: '89' })).toBe(false)
    expect(ok(MarketplaceProductCardSchema, { ...card1, originalPrice: 'RM129.90' })).toBe(false)
  })

  it('rejects an unknown condition, numeric id and an extra field (no legacy columns on the wire)', () => {
    expect(ok(MarketplaceProductCardSchema, { ...card1, condition: 'foo' })).toBe(false)
    expect(ok(MarketplaceProductCardSchema, { ...card1, id: 1 })).toBe(false)
    expect(ok(MarketplaceProductCardSchema, { ...card1, legacyId: '9' })).toBe(false)
    expect(ok(MarketplaceProductCardSchema, { ...card1, thumbnailUrl: undefined })).toBe(false)
  })

  it('accepts only the documented query keys as free strings (never a 422)', () => {
    expect(ok(MarketplaceSearchQuerySchema, {})).toBe(true)
    expect(ok(MarketplaceSearchQuerySchema, { q: ' beg ', category: 'tiada', condition: 'foo', sort: 'whatever', page: 'abc' })).toBe(true)
    expect(ok(MarketplaceSearchQuerySchema, { q: 'x', category: 'digital', condition: 'used', sort: 'price_low', page: '2' })).toBe(true)
  })
})

describe('MarketplaceProductDetail (GET /marketplace/products/{slug})', () => {
  it('parses the seeded product page and a platform product without seller, location or reviews', () => {
    expect(ok(MarketplaceProductResponseSchema, { data: detail })).toBe(true)
    const platform = {
      ...detail,
      originalPrice: null,
      discountPct: null,
      description: null,
      shippingMethod: 'free',
      shippingFee: null,
      shippingLine: 'Penghantaran Percuma 🎉',
      location: '',
      images: [],
      seller: null,
      reviews: [],
      reviewCount: 0,
      related: [],
    }
    expect(ok(MarketplaceProductDetailSchema, platform)).toBe(true)
  })

  it('keeps out_of_stock products valid (stock does not hide a product)', () => {
    expect(ok(MarketplaceProductDetailSchema, { ...detail, stockStatus: 'out_of_stock' })).toBe(true)
    expect(ok(MarketplaceProductDetailSchema, { ...detail, stockStatus: 'sold' })).toBe(false)
  })

  it('allows at most 4 related cards', () => {
    expect(ok(MarketplaceProductDetailSchema, { ...detail, related: [card1, card5, card1, card5] })).toBe(true)
    expect(ok(MarketplaceProductDetailSchema, { ...detail, related: [card1, card5, card1, card5, card1] })).toBe(false)
  })

  it('views is the value after the +1, so at least 1', () => {
    expect(ok(MarketplaceProductDetailSchema, { ...detail, views: 0 })).toBe(false)
    expect(ok(MarketplaceProductDetailSchema, { ...detail, views: 1.5 })).toBe(false)
  })

  it('rejects a draft/rejected status field, an unknown shipping method and a non +08:00 instant', () => {
    expect(ok(MarketplaceProductDetailSchema, { ...detail, status: 'draft' })).toBe(false)
    expect(ok(MarketplaceProductDetailSchema, { ...detail, shippingMethod: 'courier' })).toBe(false)
    expect(ok(MarketplaceProductDetailSchema, { ...detail, createdAt: '2026-02-09T04:00:00Z' })).toBe(false)
  })

  it('validates review rating 1..5 and string user ids', () => {
    const review = detail.reviews[0]
    expect(ok(MarketplaceProductDetailSchema, { ...detail, reviews: [{ ...review, rating: 0 }] })).toBe(false)
    expect(ok(MarketplaceProductDetailSchema, { ...detail, reviews: [{ ...review, rating: 6 }] })).toBe(false)
    expect(ok(MarketplaceProductDetailSchema, { ...detail, reviews: [{ ...review, userId: 2 }] })).toBe(false)
  })

  it('SellerCard ratingStars are five characters of star then empty star', () => {
    expect(ok(MarketplaceSellerCardSchema, { ...sellerCard, ratingStars: '★★★☆☆' })).toBe(true)
    expect(ok(MarketplaceSellerCardSchema, { ...sellerCard, ratingStars: '★★★★★' })).toBe(true)
    expect(ok(MarketplaceSellerCardSchema, { ...sellerCard, ratingStars: '☆★☆☆☆' })).toBe(false)
    expect(ok(MarketplaceSellerCardSchema, { ...sellerCard, ratingStars: '★★★★' })).toBe(false)
    expect(ok(MarketplaceSellerCardSchema, { ...sellerCard, ratingStars: '***++' })).toBe(false)
  })
})

describe('WhatsApp hand-off (POST /marketplace/products/{slug}/whatsapp)', () => {
  it('parses the exact wa.me URL of the mock for the seller and the platform number', () => {
    const seller = marketplaceWhatsappUrl('60100000000', 'Beg Sekolah Anti-Air Premium')
    expect(seller).toBe(
      'https://wa.me/60100000000?text=Salam%2C%20saya%20berminat%20dengan%20produk%20%22Beg%20Sekolah%20Anti-Air%20Premium%22%20di%20PRESTASIPLUS%20Marketplace.',
    )
    expect(ok(MarketplaceWhatsappResponseSchema, { data: { url: seller } })).toBe(true)
    expect(ok(MarketplaceWhatsappResponseSchema, { data: { url: marketplaceWhatsappUrl('60000000000', 'X') } })).toBe(true)
  })

  it('rejects a non wa.me URL, a missing url and extra fields', () => {
    expect(ok(MarketplaceWhatsappResponseSchema, { data: { url: 'https://example.com/?text=a' } })).toBe(false)
    expect(ok(MarketplaceWhatsappResponseSchema, { data: { url: 'https://wa.me/abc?text=a' } })).toBe(false)
    expect(ok(MarketplaceWhatsappResponseSchema, { data: {} })).toBe(false)
    expect(ok(MarketplaceWhatsappResponseSchema, { data: { url: 'https://wa.me/601?text=a', clicks: 17 } })).toBe(false)
  })

  it('never leaks the seller contact data: only the url is on the wire', () => {
    expect(ok(MarketplaceWhatsappResponseSchema, { data: { url: 'https://wa.me/60100000000?text=a', whatsapp: '60100000000' } })).toBe(false)
    expect(ok(MarketplaceSellerCardSchema, { ...sellerCard, whatsapp: '60100000000' })).toBe(false)
    expect(ok(MarketplaceSellerCardSchema, { ...sellerCard, phone: '0100000000' })).toBe(false)
  })
})

describe('Shop (GET /marketplace/sellers/{id})', () => {
  const shop = {
    id: '1',
    shopName: 'JomBelajar Official',
    initial: 'J',
    description: 'Kedai rasmi JomBelajar.',
    verified: true,
    ratingStars: '☆☆☆☆☆',
    reviewCount: 0,
    productCount: 10,
    createdAt: AT,
  }

  it('parses a shop with its products, with and without description', () => {
    expect(ok(MarketplaceShopResponseSchema, { data: { shop, products: [card1, card5] } })).toBe(true)
    expect(ok(MarketplaceShopResponseSchema, { data: { shop: { ...shop, description: null }, products: [] } })).toBe(true)
  })

  it('has no meta (not paginated) and rejects numeric ids', () => {
    expect(ok(MarketplaceShopResponseSchema, { data: { shop, products: [] }, meta })).toBe(false)
    expect(ok(MarketplaceShopResponseSchema, { data: { shop: { ...shop, id: 1 }, products: [] } })).toBe(false)
  })
})

describe('pure rules (BR-M20-16, 17, 21; FR-M20-11)', () => {
  it('discountPct rounds half up and is null without a positive original price', () => {
    expect(marketplaceDiscountPct('89.90', '129.90')).toBe(31)
    expect(marketplaceDiscountPct('15.00', '35.00')).toBe(57)
    expect(marketplaceDiscountPct('45.00', '65.00')).toBe(31)
    expect(marketplaceDiscountPct('50.00', '100.00')).toBe(50)
    expect(marketplaceDiscountPct('99.50', '100.00')).toBe(1)
    expect(marketplaceDiscountPct('19.90', null)).toBeNull()
    expect(marketplaceDiscountPct('19.90', '0.00')).toBeNull()
  })

  it('shippingLine is the five exact strings', () => {
    expect(marketplaceShippingLine('postage', '8.00')).toBe('Pos / Kurier (RM8.00)')
    expect(marketplaceShippingLine('postage', '5')).toBe('Pos / Kurier (RM5.00)')
    expect(marketplaceShippingLine('postage', null)).toBe('Pos / Kurier')
    expect(marketplaceShippingLine('free', null)).toBe('Penghantaran Percuma 🎉')
    expect(marketplaceShippingLine('cod', null)).toBe('Cash on Delivery (COD)')
    expect(marketplaceShippingLine('pickup', null)).toBe('Ambil Sendiri (Pickup)')
  })

  it('ratingStars: no reviews is all empty, the average is rounded, five characters always', () => {
    expect(marketplaceRatingStars(null)).toBe('☆☆☆☆☆')
    expect(marketplaceRatingStars(3.5)).toBe('★★★★☆')
    expect(marketplaceRatingStars(3.4)).toBe('★★★☆☆')
    expect(marketplaceRatingStars(5)).toBe('★★★★★')
    expect(marketplaceRatingStars(0)).toBe('☆☆☆☆☆')
  })

  it('initial is the upper-cased first character, "?" when empty', () => {
    expect(marketplaceInitial('jomBelajar Official')).toBe('J')
    expect(marketplaceInitial('  kedai')).toBe('K')
    expect(marketplaceInitial('')).toBe('?')
  })

  it('the produced values satisfy the wire schemas', () => {
    expect(ok(MarketplaceSellerCardSchema, { ...sellerCard, ratingStars: marketplaceRatingStars(4), initial: marketplaceInitial('x') })).toBe(true)
    expect(ok(MarketplaceProductCardSchema, { ...card1, shippingLine: marketplaceShippingLine('cod', null), discountPct: marketplaceDiscountPct('1.00', '2.00') })).toBe(true)
  })
})

describe('errors', () => {
  it('uses the generic copy of the mock', () => {
    expect(MARKETPLACE_ERRORS.UNAUTHORIZED).toEqual({ status: 401, message: 'Unauthenticated.' })
    expect(MARKETPLACE_ERRORS.NOT_FOUND).toEqual({ status: 404, message: 'Not Found.' })
    expect(MARKETPLACE_ERRORS.CSRF_INVALID.status).toBe(403)
  })

  it('error bodies parse', () => {
    expect(ok(ErrorBodySchema, { error: { code: 'NOT_FOUND', message: 'Not Found.' } })).toBe(true)
    expect(ok(ErrorBodySchema, { error: { code: 'CSRF_INVALID', message: MARKETPLACE_ERRORS.CSRF_INVALID.message } })).toBe(true)
  })
})

describe('openapi registration', () => {
  type Parameter = { name: string; in: string }
  type Operation = {
    tags?: string[]
    parameters?: Parameter[]
    requestBody?: unknown
    responses: Record<string, unknown>
  }
  const doc = buildOpenApiDocument() as unknown as {
    paths: Record<string, Record<string, Operation>>
    components: { schemas: Record<string, unknown> }
  }
  const ROUTES: readonly [string, string][] = [
    ['get', '/marketplace/categories'],
    ['get', '/marketplace/products'],
    ['get', '/marketplace/products/{slug}'],
    ['post', '/marketplace/products/{slug}/whatsapp'],
    ['get', '/marketplace/sellers/{id}'],
  ]
  const operations = (): [string, string, Operation][] =>
    Object.entries(doc.paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([, op]) => op.tags?.includes('marketplace'))
        .map(([method, op]): [string, string, Operation] => [method, path, op]),
    )

  it('registers the 5 routes, and only those, under the marketplace tag', () => {
    expect(ROUTES).toHaveLength(5)
    expect(operations()).toHaveLength(5)
    for (const [method, path] of ROUTES) {
      const op = doc.paths[path]?.[method]
      expect(op, `${method} ${path}`).toBeDefined()
      expect(op?.tags).toContain('marketplace')
    }
  })

  it('registers no cart, order, payment or seller route (D14)', () => {
    const paths = Object.keys(doc.paths).filter((p) => p.startsWith('/marketplace'))
    expect(paths.every((p) => ROUTES.some(([, r]) => r === p))).toBe(true)
  })

  it('contains every component with a unique Marketplace-prefixed id', () => {
    const ids = Object.keys(MARKETPLACE_COMPONENT_SCHEMAS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^Marketplace/)
      expect(doc.components.schemas, id).toHaveProperty(id)
    }
  })

  it('declares 401 on every route and 404 on the three slug/id routes only', () => {
    const with404 = new Set(['get /marketplace/products/{slug}', 'post /marketplace/products/{slug}/whatsapp', 'get /marketplace/sellers/{id}'])
    for (const [method, path, op] of operations()) {
      expect(op.responses['401'], `${method} ${path}`).toBeDefined()
      expect(op.responses['404'] !== undefined, `${method} ${path}`).toBe(with404.has(`${method} ${path}`))
    }
  })

  it('requires X-CSRF-Token and describes CSRF_INVALID only on the POST', () => {
    for (const [method, path, op] of operations()) {
      const csrf = (op.parameters ?? []).some((p) => p.in === 'header' && p.name === 'X-CSRF-Token')
      const mutating = method !== 'get'
      expect(csrf, `${method} ${path}`).toBe(mutating)
      if (mutating) expect(JSON.stringify(op.responses['403']), `${method} ${path}`).toContain('CSRF_INVALID')
      else expect(op.responses['403'], `${method} ${path}`).toBeUndefined()
    }
  })

  it('describes path params, the five search query keys and no request body', () => {
    const names = (path: string, method: string, where: string) =>
      (doc.paths[path]?.[method]?.parameters ?? []).filter((p) => p.in === where).map((p) => p.name)
    expect(names('/marketplace/products', 'get', 'query').sort()).toEqual(['category', 'condition', 'page', 'q', 'sort'])
    expect(names('/marketplace/products/{slug}', 'get', 'path')).toEqual(['slug'])
    expect(names('/marketplace/products/{slug}/whatsapp', 'post', 'path')).toEqual(['slug'])
    expect(names('/marketplace/sellers/{id}', 'get', 'path')).toEqual(['id'])
    for (const [method, path, op] of operations()) expect(op.requestBody, `${method} ${path}`).toBeUndefined()
  })
})
