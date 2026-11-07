import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { MARKETPLACE_COMPONENT_SCHEMAS } from '../paths'
import {
  MARKETPLACE_ADMIN_MESSAGES as MSG,
  MARKETPLACE_ADMIN_PROPOSED,
  MARKETPLACE_SELLER_ACTIONS,
  MARKETPLACE_SELLER_TRANSITIONS,
  MarketplaceAdminProductCreateSchema,
  MarketplaceAdminProductDetailSchema,
  MarketplaceAdminProductListQuerySchema,
  MarketplaceAdminProductListResponseSchema,
  MarketplaceAdminProductUpdateSchema,
  MarketplaceAdminSellerDetailSchema,
  MarketplaceAdminSellerListResponseSchema,
  MarketplaceAdminSellerOptionsResponseSchema,
  marketplaceSellerActions,
} from '../schema'

const valid = {
  sellerId: null,
  name: 'Beg',
  categoryId: '1',
  price: '50.00',
  originalPrice: '70.00',
  condition: 'new',
  stockStatus: 'available',
  shippingMethod: 'postage',
}
const AT = '2026-02-09T12:00:00+08:00'
const fieldsOf = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, v: unknown) => {
  const r = schema.safeParse(v)
  const out: Record<string, string> = {}
  for (const i of r.error?.issues ?? []) out[i.path.map(String).join('.') || '_'] ??= i.message
  return out
}

describe('admin product create', () => {
  it('accepts the minimal valid body and the limits', () => {
    expect(MarketplaceAdminProductCreateSchema.safeParse(valid).success).toBe(true)
    expect(MarketplaceAdminProductCreateSchema.safeParse({ ...valid, price: '0.01', originalPrice: null, shippingFee: '0', name: 'x'.repeat(120), description: 'x'.repeat(2000), location: 'x'.repeat(100) }).success).toBe(true)
    expect(MarketplaceAdminProductCreateSchema.safeParse({ ...valid, price: '100000', originalPrice: null, shippingFee: '1000.00' }).success).toBe(true)
  })

  it('gives the exact PRD messages for the required fields', () => {
    const f = fieldsOf(MarketplaceAdminProductCreateSchema, {})
    expect(f.sellerId).toBe('Penjual diperlukan.')
    expect(f.name).toBe('Nama produk diperlukan.')
    expect(f.categoryId).toBe('Kategori diperlukan.')
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, name: '  ', categoryId: '', sellerId: '' })).toMatchObject({
      sellerId: 'Penjual diperlukan.',
      name: 'Nama produk diperlukan.',
      categoryId: 'Kategori diperlukan.',
    })
  })

  it('original price must be greater than price', () => {
    for (const originalPrice of ['50.00', '49.99']) {
      expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, originalPrice }).originalPrice).toBe('Harga asal mesti lebih besar daripada harga.')
    }
    expect(MarketplaceAdminProductCreateSchema.safeParse({ ...valid, originalPrice: '50.01' }).success).toBe(true)
  })

  it('refuses out-of-range and malformed numbers and over-long text', () => {
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, price: '0.00' }).price).toBe(MSG.priceRange)
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, price: '100000.01', originalPrice: null }).price).toBe(MSG.priceRange)
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, price: '1.234' }).price).toBe(MSG.priceFormat)
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, shippingFee: '1000.01' }).shippingFee).toBe(MSG.shippingFeeRange)
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, name: 'x'.repeat(121) }).name).toBe(MSG.nameTooLong)
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, description: 'x'.repeat(2001) }).description).toBe(MSG.descriptionTooLong)
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, location: 'x'.repeat(101) }).location).toBe(MSG.locationTooLong)
  })

  it('images: at most 5 with the BM message; blank urls use the image message', () => {
    const urls = Array.from({ length: 6 }, (_, i) => `/api/files/${String(i).repeat(22)}`)
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, images: urls }).images).toBe('Maksimum 5 gambar.')
    expect(MarketplaceAdminProductCreateSchema.safeParse({ ...valid, images: urls.slice(0, 5) }).success).toBe(true)
    expect(fieldsOf(MarketplaceAdminProductCreateSchema, { ...valid, images: [''] })['images.0']).toBe('Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.')
  })

  it('is strict about unknown keys and enum values', () => {
    expect(MarketplaceAdminProductCreateSchema.safeParse({ ...valid, views: 1 }).success).toBe(false)
    expect(MarketplaceAdminProductCreateSchema.safeParse({ ...valid, status: 'banned' }).success).toBe(false)
    expect(MarketplaceAdminProductCreateSchema.safeParse({ ...valid, condition: 'broken' }).success).toBe(false)
  })
})

describe('admin product update', () => {
  it('every key is optional; Nyahaktif is {status:"draft"}', () => {
    expect(MarketplaceAdminProductUpdateSchema.safeParse({}).success).toBe(true)
    expect(MarketplaceAdminProductUpdateSchema.safeParse({ status: 'draft' }).success).toBe(true)
    expect(MarketplaceAdminProductUpdateSchema.safeParse({ originalPrice: null, shippingFee: null, description: null }).success).toBe(true)
  })

  it('keeps the same messages and the price rule when both prices are sent', () => {
    expect(fieldsOf(MarketplaceAdminProductUpdateSchema, { name: ' ' }).name).toBe('Nama produk diperlukan.')
    expect(fieldsOf(MarketplaceAdminProductUpdateSchema, { sellerId: '' }).sellerId).toBe('Penjual diperlukan.')
    expect(fieldsOf(MarketplaceAdminProductUpdateSchema, { price: '10.00', originalPrice: '10.00' }).originalPrice).toBe(MSG.originalPriceNotGreater)
    expect(MarketplaceAdminProductUpdateSchema.safeParse({ price: '10.00' }).success).toBe(true)
    expect(fieldsOf(MarketplaceAdminProductUpdateSchema, { newImages: Array(6).fill('/api/files/x') }).newImages).toBe('Maksimum 5 gambar.')
  })
})

describe('queries', () => {
  it('blank filters are allowed ("Semua ..."); unknown status and page 0 are not', () => {
    expect(MarketplaceAdminProductListQuerySchema.safeParse({ q: '', categoryId: '', status: '', page: '2' }).success).toBe(true)
    expect(MarketplaceAdminProductListQuerySchema.safeParse({ status: 'draft' }).success).toBe(true)
    expect(MarketplaceAdminProductListQuerySchema.safeParse({ status: 'Draf' }).success).toBe(false)
    expect(MarketplaceAdminProductListQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(MarketplaceAdminProductListQuerySchema.safeParse({ pageSize: '5' }).success).toBe(false)
  })
})

describe('seller transitions', () => {
  it('follows decision 6', () => {
    expect(MARKETPLACE_SELLER_TRANSITIONS).toEqual({
      approve: { from: ['pending', 'suspended'], to: 'active' },
      verify: { from: ['active'], to: 'active' },
      suspend: { from: ['active'], to: 'suspended' },
      ban: { from: ['pending', 'active', 'suspended'], to: 'banned' },
    })
    expect(MARKETPLACE_SELLER_ACTIONS).toEqual(['approve', 'verify', 'suspend', 'ban'])
  })

  it('lists the actions allowed now; Sahkan disappears once verified; banned has none', () => {
    expect(marketplaceSellerActions('pending', false)).toEqual(['approve', 'ban'])
    expect(marketplaceSellerActions('active', false)).toEqual(['verify', 'suspend', 'ban'])
    expect(marketplaceSellerActions('active', true)).toEqual(['suspend', 'ban'])
    expect(marketplaceSellerActions('suspended', false)).toEqual(['approve', 'ban'])
    expect(marketplaceSellerActions('banned', true)).toEqual([])
  })

  it('the confirm text follows "{Tindakan} penjual ini?"', () => {
    expect(MARKETPLACE_ADMIN_PROPOSED.sellerConfirm('ban')).toBe('Haramkan penjual ini?')
  })
})

describe('admin responses', () => {
  const row = {
    id: '1', slug: 'beg-aaaaa', name: 'Beg', price: '50.00', originalPrice: null, thumbnailUrl: null, sellerId: null,
    sellerName: 'PRESTASIPLUS Official', categoryId: '1', categoryName: 'Peralatan Sekolah', condition: 'new', stockStatus: 'available',
    status: 'active', views: 0, createdAt: AT,
  }

  it('parses the product list with stats and the detail with images', () => {
    expect(
      MarketplaceAdminProductListResponseSchema.safeParse({
        data: [row],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1, stats: { total: 10, active: 10 } },
      }).success,
    ).toBe(true)
    expect(
      MarketplaceAdminProductDetailSchema.safeParse({ ...row, description: null, shippingMethod: 'pickup', shippingFee: null, location: '', images: [{ id: '5', position: 1, url: '/api/files/x' }], updatedAt: AT }).success,
    ).toBe(true)
  })

  it('parses sellers with global stats and the options (official first, id null)', () => {
    const seller = { id: '1', shopName: 'Kedai', initial: 'K', ownerMasked: 'A*** B***', status: 'pending', verified: false, productCount: 0, actions: ['approve', 'ban'], createdAt: AT }
    expect(
      MarketplaceAdminSellerListResponseSchema.safeParse({
        data: [seller],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1, stats: { total: 1, active: 0, pending: 1 } },
      }).success,
    ).toBe(true)
    expect(MarketplaceAdminSellerDetailSchema.safeParse({ ...seller, description: null, phone: '0', whatsapp: '6', verifiedAt: null, whatsappClicks: 0 }).success).toBe(true)
    expect(MarketplaceAdminSellerOptionsResponseSchema.safeParse({ data: [{ id: null, label: 'PRESTASIPLUS Official (Admin)' }] }).success).toBe(true)
    expect(MarketplaceAdminSellerListResponseSchema.safeParse({ data: [{ ...seller, status: 'Aktif' }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, stats: { total: 1, active: 0, pending: 1 } } }).success).toBe(false)
  })
})

describe('OpenAPI', () => {
  it('registers the ten admin paths and the components', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } }
    const paths = Object.keys(doc.paths).filter((p) => p.startsWith('/admin/marketplace'))
    expect(paths).toHaveLength(10)
    expect(Object.keys(doc.paths['/admin/marketplace/products']!).sort()).toEqual(['get', 'post'])
    expect(Object.keys(doc.paths['/admin/marketplace/products/{id}']!).sort()).toEqual(['delete', 'get', 'put'])
    expect(Object.keys(doc.paths['/admin/marketplace/products/{id}/images/{imageId}']!)).toEqual(['delete'])
    for (const a of MARKETPLACE_SELLER_ACTIONS) expect(Object.keys(doc.paths[`/admin/marketplace/sellers/{id}/${a}`]!)).toEqual(['post'])
    for (const id of Object.keys(MARKETPLACE_COMPONENT_SCHEMAS)) expect(doc.components.schemas).toHaveProperty(id)
  })
})
