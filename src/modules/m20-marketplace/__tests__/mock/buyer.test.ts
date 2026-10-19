/**
 * M20-T1 endpoints #13–#17 (SRS M20 v1.2 §6.8, §6.9, §7; BR-M20-05, 08, 12, 17, 20, 21): the observed
 * seed figures (R01–R17), the buyer list rules, the view and click counters, the visibility rule and
 * the test hooks. Every test starts from a fresh seed.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'

import type {
  MarketplaceCategory,
  ProductCard,
  ProductDetail,
  ShopView,
  WhatsappHandoff,
} from '../../api/types'
import m20, { mpProducts, mpSellers } from '../../mock'
import { m20Hooks } from '../../mock/hooks'
import { discountPct, ratingStars, shippingLine } from '../../mock/repository/format'

const NOW = '2026-09-25T15:40:00+08:00'
const ADMIN = 1
const PELAJAR = 2

interface Answer<T = unknown> {
  status: number
  body: T
}
interface ListBody<T> {
  data: T[]
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number }
}

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m20],
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}, 120_000)

beforeEach(async () => {
  await runtime.reset()
})

async function call<T = unknown>(
  method: 'GET' | 'POST',
  url: string,
  as: number | null,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) {
    headers.authorization = `Bearer ${issueSession(users.get(as) as never, false, Date.parse(NOW)).token}`
  }
  const res: TransportResponse = await runtime.transport.request({ method, url, headers })
  return { status: res.status, body: res.body as T }
}

const list = (url: string, as: number | null = PELAJAR) =>
  call<ListBody<ProductCard>>('GET', url, as)
const ids = (a: Answer<ListBody<ProductCard>>) => a.body.data.map((c) => c.id)
const data = <T>(a: Answer<{ data: T }>): T => a.body.data

describe('formats (BR-M20-16, 17; FR-M20-11)', () => {
  it('computes the discount badge, the shipping lines and the stars', () => {
    expect(discountPct('89.90', '129.90')).toBe(31)
    expect(discountPct('15.00', '35.00')).toBe(57)
    expect(discountPct('19.90', null)).toBeNull()
    expect(shippingLine('postage', '8.00')).toBe('Pos / Kurier (RM8.00)')
    expect(shippingLine('free', null)).toBe('Penghantaran Percuma 🎉')
    expect(shippingLine('cod', null)).toBe('Cash on Delivery (COD)')
    expect(shippingLine('pickup', null)).toBe('Ambil Sendiri (Pickup)')
    expect(ratingStars(null)).toBe('☆☆☆☆☆')
    expect(ratingStars(3.6)).toBe('★★★★☆')
  })
})

describe('guards', () => {
  it.each([
    ['GET', '/api/marketplace/categories'],
    ['GET', '/api/marketplace/products'],
    ['GET', '/api/marketplace/products/beg-sekolah-anti-air-premium-vH1Fj'],
    ['POST', '/api/marketplace/products/beg-sekolah-anti-air-premium-vH1Fj/whatsapp'],
    ['GET', '/api/marketplace/sellers/1'],
  ] as const)('%s %s answers 401 to a guest', async (method, url) => {
    expect((await call(method, url, null)).status).toBe(401)
  })

  it('accepts a student and an admin alike', async () => {
    expect((await list('/api/marketplace/products', ADMIN)).status).toBe(200)
    expect((await list('/api/marketplace/products', PELAJAR)).status).toBe(200)
  })
})

describe('#13 categories', () => {
  it('returns the 6 constant categories in order', async () => {
    const a = await call<{ data: MarketplaceCategory[] }>(
      'GET',
      '/api/marketplace/categories',
      PELAJAR,
    )
    expect(a.status).toBe(200)
    expect(data(a).map((c) => c.slug)).toEqual([
      'peralatan-sekolah',
      'buku-rujukan',
      'uniform-pakaian',
      'stationery',
      'digital',
      'lain-lain',
    ])
    expect(data(a)[0]).toMatchObject({ id: 1, name: 'Peralatan Sekolah', icon: 'fa-pencil-ruler' })
  })
})

describe('#14 product search / sort / pager (BR-M20-05)', () => {
  it('lists the 10 products, latest first (ties by id), 20 per page', async () => {
    const a = await list('/api/marketplace/products')
    expect(ids(a)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(a.body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 10, totalPages: 1 })
  })

  it('shapes the card (R05, R09)', async () => {
    const [first, fifth] = [
      (await list('/api/marketplace/products')).body.data[0],
      (await list('/api/marketplace/products')).body.data[4],
    ]
    expect(first).toEqual({
      id: 1,
      slug: 'beg-sekolah-anti-air-premium-vH1Fj',
      name: 'Beg Sekolah Anti-Air Premium',
      price: '89.90',
      originalPrice: '129.90',
      discountPct: 31,
      condition: 'new',
      thumbnailUrl: '/images/marketplace/products/1/img_1.jpg',
      seller: { shopName: 'JomBelajar Official', verified: true },
      shippingLine: 'Pos / Kurier (RM8.00)',
    })
    expect(fifth).toMatchObject({ id: 5, originalPrice: null, discountPct: null })
  })

  it('sorts by price ascending / descending (R06)', async () => {
    expect(ids(await list('/api/marketplace/products?sort=price_low'))).toEqual([
      9, 3, 8, 5, 6, 7, 4, 10, 2, 1,
    ])
    expect(ids(await list('/api/marketplace/products?sort=price_high'))).toEqual([
      1, 2, 10, 4, 7, 6, 5, 8, 3, 9,
    ])
  })

  it('sorts by popularity at the seed (R07)', async () => {
    expect(ids(await list('/api/marketplace/products?sort=popular'))).toEqual([
      1, 8, 2, 3, 10, 5, 9, 4, 7, 6,
    ])
  })

  it('treats an unknown sort as latest', async () => {
    expect(ids(await list('/api/marketplace/products?sort=zzz'))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it('orders latest by id descending when a category is set (R08, DV-M20-07)', async () => {
    expect(ids(await list('/api/marketplace/products?category=buku-rujukan'))).toEqual([7, 5, 2])
    expect(ids(await list('/api/marketplace/products?category=peralatan-sekolah'))).toEqual([6, 1])
    expect(ids(await list('/api/marketplace/products?category=uniform-pakaian'))).toEqual([10, 3])
    expect(ids(await list('/api/marketplace/products?category=stationery'))).toEqual([9, 4])
    expect(ids(await list('/api/marketplace/products?category=lain-lain'))).toEqual([8])
    expect(ids(await list('/api/marketplace/products?category=digital'))).toEqual([])
    expect(ids(await list('/api/marketplace/products?category=tiada'))).toEqual([])
  })

  it('filters by condition (R08: new 7, used 3), by q and combines them', async () => {
    expect((await list('/api/marketplace/products?condition=new')).body.meta.totalItems).toBe(7)
    expect(ids(await list('/api/marketplace/products?condition=used'))).toEqual([3, 7, 10])
    expect(ids(await list('/api/marketplace/products?q=%20BEG%20'))).toEqual([1])
    expect(ids(await list('/api/marketplace/products?q=zzqxv'))).toEqual([])
    expect(
      ids(await list('/api/marketplace/products?q=set&condition=new&category=stationery')),
    ).toEqual([9, 4])
  })

  it('hides products of a seller that is not active and drafts (BR-M20-08)', async () => {
    mpProducts.patch(2, { status: 'draft' })
    expect(ids(await list('/api/marketplace/products'))).not.toContain(2)
    mpProducts.patch(2, { status: 'active' })
    expect(ids(await list('/api/marketplace/products'))).toContain(2)
  })

  it('pages by 20 and answers an empty page beyond the last (FR-M20-13)', async () => {
    m20Hooks.m20LoadFixture('m20-many')
    const p1 = await list('/api/marketplace/products')
    expect(p1.body.data).toHaveLength(20)
    expect(p1.body.meta).toMatchObject({ totalItems: 25, totalPages: 2 })
    const p2 = await list('/api/marketplace/products?page=2')
    expect(p2.body.data).toHaveLength(5)
    const p3 = await list('/api/marketplace/products?page=3')
    expect(p3.body.data).toHaveLength(0)
    expect(p3.body.meta.totalItems).toBe(25)
    expect(ids(await list('/api/marketplace/products?page=abc'))).toEqual(ids(p1))
  })
})

describe('#15 product by slug (BR-M20-12, BR-M20-20)', () => {
  const SLUG_1 = 'beg-sekolah-anti-air-premium-vH1Fj'

  it('returns the detail and adds 1 to views on every call', async () => {
    const a = await call<{ data: ProductDetail }>(
      'GET',
      `/api/marketplace/products/${SLUG_1}`,
      PELAJAR,
    )
    expect(a.status).toBe(200)
    expect(data(a)).toMatchObject({
      id: 1,
      name: 'Beg Sekolah Anti-Air Premium',
      views: 31,
      category: { slug: 'peralatan-sekolah' },
      condition: 'new',
      stockStatus: 'available',
      shippingLine: 'Pos / Kurier (RM8.00)',
      location: 'Kuala Lumpur',
      reviewCount: 0,
      reviews: [],
      seller: {
        id: 1,
        shopName: 'JomBelajar Official',
        initial: 'J',
        verified: true,
        ratingStars: '☆☆☆☆☆',
        activeProductCount: 10,
      },
    })
    expect(data(a).images.map((i) => i.position)).toEqual([1, 2, 3, 4])
    expect(data(a).related.map((c) => c.id)).toEqual([6])
    const b = await call<{ data: ProductDetail }>(
      'GET',
      `/api/marketplace/products/${SLUG_1}`,
      ADMIN,
    )
    expect(data(b).views).toBe(32)
    expect(mpProducts.get(1)?.views).toBe(32)
  })

  it('lists the related products of #5 and #7 (R10)', async () => {
    const five = await call<{ data: ProductDetail }>(
      'GET',
      '/api/marketplace/products/e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84',
      PELAJAR,
    )
    expect(data(five).related.map((c) => c.id)).toEqual([2, 7])
    const seven = await call<{ data: ProductDetail }>(
      'GET',
      '/api/marketplace/products/kamus-dewan-edisi-keempat-terpakai-8axTV',
      PELAJAR,
    )
    expect(data(seven).related.map((c) => c.id)).toEqual([2, 5])
  })

  it('answers 404 for an unknown or hidden slug and does not count a view', async () => {
    expect((await call('GET', '/api/marketplace/products/tiada-produk', PELAJAR)).status).toBe(404)
    mpProducts.patch(1, { status: 'draft' })
    expect((await call('GET', `/api/marketplace/products/${SLUG_1}`, PELAJAR)).status).toBe(404)
    expect(mpProducts.get(1)?.views).toBe(30)
  })

  it('hides the products of a banned seller (BR-M20-08)', async () => {
    mpSellers.patch(1, { status: 'banned' })
    expect(ids(await list('/api/marketplace/products'))).toEqual([])
    expect((await call('GET', `/api/marketplace/products/${SLUG_1}`, PELAJAR)).status).toBe(404)
    expect((await call('GET', '/api/marketplace/sellers/1', PELAJAR)).status).toBe(404)
    expect(
      (await call('POST', `/api/marketplace/products/${SLUG_1}/whatsapp`, PELAJAR)).status,
    ).toBe(404)
  })
})

describe('#16 WhatsApp hand-off (BR-M20-21, D14)', () => {
  const SLUG = 'botol-air-750ml-bpa-free-biru-KEz9H'

  it('counts the click and returns the simulated wa.me URL; renders no screen', async () => {
    const a = await call<{ data: WhatsappHandoff }>(
      'POST',
      `/api/marketplace/products/${SLUG}/whatsapp`,
      PELAJAR,
    )
    expect(a.status).toBe(200)
    expect(data(a).url).toBe(
      `https://wa.me/60100000000?text=${encodeURIComponent('Salam, saya berminat dengan produk "Botol Air 750ml BPA Free (Biru)" di PRESTASIPLUS Marketplace.')}`,
    )
    expect(mpSellers.get(1)?.whatsappClicks).toBe(17)
    expect(m20Hooks.m20WhatsappLog()).toEqual([data(a).url])
    // #16 does not change views.
    expect(mpProducts.get(8)?.views).toBe(19)
  })

  it('answers 404 for an unknown slug and changes nothing', async () => {
    expect((await call('POST', '/api/marketplace/products/tiada/whatsapp', PELAJAR)).status).toBe(
      404,
    )
    expect(mpSellers.get(1)?.whatsappClicks).toBe(16)
    expect(m20Hooks.m20WhatsappLog()).toEqual([])
  })

  it('does not inherit the log or the counter after a reset', async () => {
    await call('POST', `/api/marketplace/products/${SLUG}/whatsapp`, PELAJAR)
    await runtime.reset()
    expect(m20Hooks.m20WhatsappLog()).toEqual([])
    expect(mpSellers.get(1)?.whatsappClicks).toBe(16)
  })
})

describe('#17 shop', () => {
  it('returns the shop card and the 10 visible products (R12, R13)', async () => {
    const a = await call<{ data: ShopView }>('GET', '/api/marketplace/sellers/1', PELAJAR)
    expect(a.status).toBe(200)
    expect(data(a).shop).toEqual({
      id: 1,
      shopName: 'JomBelajar Official',
      initial: 'J',
      description:
        'Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾',
      verified: true,
      ratingStars: '☆☆☆☆☆',
      reviewCount: 0,
      productCount: 10,
      createdAt: '2026-02-09T12:00:00+08:00',
    })
    expect(data(a).products.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('answers 404 for an unknown or non-active seller', async () => {
    expect((await call('GET', '/api/marketplace/sellers/99', PELAJAR)).status).toBe(404)
    expect((await call('GET', '/api/marketplace/sellers/abc', PELAJAR)).status).toBe(404)
  })
})

describe('hooks and fixtures (§6.13)', () => {
  it('loads m20-many idempotently (no duplicate slugs or rows)', async () => {
    m20Hooks.m20LoadFixture('m20-many')
    expect(() => m20Hooks.m20LoadFixture('m20-many')).not.toThrow()
    const res = await list('/api/marketplace/products?page=2')
    expect(res.body.meta.totalItems).toBe(25)
    const slugs = [...(await list('/api/marketplace/products')).body.data, ...res.body.data].map(
      (p) => p.slug,
    )
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('loads m20-second-seller, m20-many and m20-out-of-stock; rejects an unknown name', async () => {
    m20Hooks.m20LoadFixture('m20-second-seller')
    const shop = await call<{ data: ShopView }>('GET', '/api/marketplace/sellers/2', PELAJAR)
    expect(data(shop).shop).toMatchObject({ shopName: 'Kedai Ujian Demo', productCount: 1 })
    m20Hooks.m20LoadFixture('m20-out-of-stock')
    expect(mpProducts.get(4)?.stockStatus).toBe('out_of_stock')
    expect(() => m20Hooks.m20LoadFixture('nope')).toThrow(RangeError)
    await runtime.reset()
    expect(mpSellers.forUser(2)).toBeUndefined()
    expect(mpProducts.get(4)?.stockStatus).toBe('available')
  })
})
