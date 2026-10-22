import { MarketplaceCategoryListResponseSchema, MarketplaceProductListResponseSchema, MarketplaceShopResponseSchema } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootMarketplaceApp, expectError, insertProducts, loginAs, type Client, type MarketplaceTestApp } from './helpers'

let t: MarketplaceTestApp
let student: Client

beforeAll(async () => {
  t = await bootMarketplaceApp()
  student = await loginAs(t, ACCOUNTS.student)
}, 120_000)
afterAll(async () => {
  await t.close()
})
/** Every test starts from the seed: extra rows and flipped statuses are undone here. */
afterEach(async () => {
  await t.db.query(`delete from marketplace_reviews`)
  await t.db.query(`delete from marketplace_products where id > 10`)
  await t.db.query(`update marketplace_products set status = 'active', stock_status = 'available'`)
  await t.db.query(`update marketplace_sellers set status = 'active'`)
})

const search = async (qs = '') => {
  const res = await student.get(`/api/marketplace/products${qs}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return MarketplaceProductListResponseSchema.parse(res.body)
}
const ids = async (qs = '') => (await search(qs)).data.map((c) => Number(c.id))

describe('GET /marketplace/categories', () => {
  it('returns the 6 constant categories, id ascending, without meta', async () => {
    const res = await student.get('/api/marketplace/categories')
    expect(res.status).toBe(200)
    const body = MarketplaceCategoryListResponseSchema.parse(res.body)
    expect(res.body.meta).toBeUndefined()
    expect(body.data.map((c) => c.slug)).toEqual(['peralatan-sekolah', 'buku-rujukan', 'uniform-pakaian', 'stationery', 'digital', 'lain-lain'])
    expect(body.data[0]).toEqual({ id: '1', slug: 'peralatan-sekolah', name: 'Peralatan Sekolah', icon: 'fa-pencil-ruler' })
    expect(body.data[4]).toMatchObject({ name: 'Digital & E-Book', icon: 'fa-tablet-alt' })
  })
})

describe('GET /marketplace/products on the seed (BR-M20-05)', () => {
  it('lists the 10 products, latest first with ties by id, 20 per page', async () => {
    const res = await search()
    expect(res.data.map((c) => c.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    expect(res.meta).toEqual({ page: 1, pageSize: 20, totalItems: 10, totalPages: 1, from: 1, to: 10 })
  })

  it('shapes the card as the mock does (R05, R09)', async () => {
    const { data } = await search()
    expect(data[0]).toEqual({
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
    })
    expect(data[4]).toMatchObject({ id: '5', originalPrice: null, discountPct: null, shippingLine: 'Penghantaran Percuma 🎉' })
    expect(data[2]).toMatchObject({ id: '3', discountPct: 57, shippingLine: 'Cash on Delivery (COD)' })
    expect(data[8]).toMatchObject({ id: '9', shippingLine: 'Ambil Sendiri (Pickup)' })
  })

  it('sorts by price ascending and descending (R06), by popularity (R07); an unknown sort is latest', async () => {
    expect(await ids('?sort=price_low')).toEqual([9, 3, 8, 5, 6, 7, 4, 10, 2, 1])
    expect(await ids('?sort=price_high')).toEqual([1, 2, 10, 4, 7, 6, 5, 8, 3, 9])
    expect(await ids('?sort=popular')).toEqual([1, 8, 2, 3, 10, 5, 9, 4, 7, 6])
    expect(await ids('?sort=zzz')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(await ids('?sort=')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('orders latest by id descending when a valid category is set (R08, DV-M20-07)', async () => {
    expect(await ids('?category=buku-rujukan')).toEqual([7, 5, 2])
    expect(await ids('?category=peralatan-sekolah')).toEqual([6, 1])
    expect(await ids('?category=uniform-pakaian')).toEqual([10, 3])
    expect(await ids('?category=stationery')).toEqual([9, 4])
    expect(await ids('?category=lain-lain')).toEqual([8])
    expect(await ids('?category=digital')).toEqual([])
    // An unknown slug is empty, and a blank one is "any category" (so the plain order applies).
    expect(await ids('?category=tiada')).toEqual([])
    expect(await ids('?category=')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    // Price sorts keep id ascending ties and ignore the category rule.
    expect(await ids('?category=buku-rujukan&sort=price_low')).toEqual([5, 7, 2])
  })

  it('filters by condition; any other non-blank value matches nothing (AC3)', async () => {
    expect((await search('?condition=new')).meta.totalItems).toBe(7)
    expect(await ids('?condition=used')).toEqual([3, 7, 10])
    expect(await ids('?condition=foo')).toEqual([])
    expect(await ids('?condition=NEW')).toEqual([])
    expect(await ids('?condition=')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('q is trimmed, case-insensitive, a literal substring and cut to 100 characters (V-M20-03)', async () => {
    expect(await ids('?q=%20BEG%20')).toEqual([1])
    expect(await ids('?q=zzqxv')).toEqual([])
    expect(await ids('?q=%20%20')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(await ids('?q=set&condition=new&category=stationery')).toEqual([9, 4])
    // `%` and `_` are plain characters, not wildcards.
    expect(await ids('?q=%25')).toEqual([])
    expect(await ids('?q=_')).toEqual([])
    // A name longer than 100 characters is still found by its first 100 characters: the tail is cut.
    const longName = `Zzlong ${'a'.repeat(93)}`
    await t.db.query(
      `insert into marketplace_products (seller_id, name, slug, category_id, price, condition, stock_status, status, shipping_method)
       values (1, $1, 'zzlong', 1, 1, 'new', 'available', 'active', 'pickup')`,
      [longName],
    )
    expect(await ids(`?q=${encodeURIComponent(`${longName}XYZ-not-in-the-name`)}`)).toHaveLength(1)
    expect(await ids(`?q=${encodeURIComponent(`${longName}xyz`)}`)).toHaveLength(1)
  })

  it('odd query shapes never answer 422 (repeated keys: the first wins; page is 1 when invalid)', async () => {
    expect(await ids('?q=beg&q=kamus')).toEqual([1])
    expect(await ids('?page=abc')).toHaveLength(10)
    expect(await ids('?page=-1')).toHaveLength(10)
    expect(await ids('?page=0')).toHaveLength(10)
    const beyond = await search('?page=3')
    expect(beyond.data).toEqual([])
    expect(beyond.meta).toEqual({ page: 3, pageSize: 20, totalItems: 10, totalPages: 1, from: null, to: null })
    expect((await search('?page=99999999999999999999')).data).toEqual([])
  })
})

describe('visibility (BR-M20-08, AC2)', () => {
  it('drafts and rejected products are absent from the search; out_of_stock stays', async () => {
    await t.db.query(`update marketplace_products set status = 'draft' where id = 2`)
    await t.db.query(`update marketplace_products set status = 'rejected' where id = 3`)
    await t.db.query(`update marketplace_products set stock_status = 'out_of_stock' where id = 4`)
    expect(await ids()).toEqual([1, 4, 5, 6, 7, 8, 9, 10])
  })

  it.each(['pending', 'suspended', 'banned'])('a %s seller hides every product and the shop', async (status) => {
    await t.db.query(`update marketplace_sellers set status = $1`, [status])
    expect(await ids()).toEqual([])
    expect((await search('?category=buku-rujukan')).meta.totalItems).toBe(0)
    expectError(await student.get('/api/marketplace/sellers/1'), 404, 'NOT_FOUND', 'Not Found.')
  })

  it('platform products (no seller) are visible whatever the sellers are', async () => {
    await t.db.query(`update marketplace_sellers set status = 'banned'`)
    await t.db.query(
      `insert into marketplace_products (seller_id, name, slug, category_id, price, condition, stock_status, status, shipping_method)
       values (null, 'Produk Platform', 'produk-platform', 5, 5, 'new', 'available', 'active', 'free')`,
    )
    const res = await search()
    expect(res.data).toHaveLength(1)
    expect(res.data[0]).toMatchObject({ name: 'Produk Platform', seller: null, thumbnailUrl: null, price: '5.00' })
  })
})

describe('a generated 45-product set (AC3), compared with the mock rules', () => {
  interface Row {
    id: number
    name: string
    price: number
    views: number
    created: number
    category: number
    condition: string
  }

  /** The mock's `buyerList`, written independently over the raw rows. */
  function oracle(rows: Row[], f: { q?: string; category?: number; condition?: string; sort?: string }): number[] {
    let r = rows.filter((p) => (f.q ? p.name.toLowerCase().includes(f.q.toLowerCase()) : true))
    if (f.category) r = r.filter((p) => p.category === f.category)
    if (f.condition) r = r.filter((p) => p.condition === f.condition)
    const byId = (a: Row, b: Row) => a.id - b.id
    const sorted = [...r].sort((a, b) => {
      switch (f.sort) {
        case 'price_low':
          return a.price - b.price || byId(a, b)
        case 'price_high':
          return b.price - a.price || byId(a, b)
        case 'popular':
          return b.views - a.views || byId(a, b)
        default:
          return a.created !== b.created ? b.created - a.created : f.category ? b.id - a.id : a.id - b.id
      }
    })
    return sorted.map((p) => p.id)
  }

  async function load(): Promise<Row[]> {
    const rows = await t.db.query<{ id: string; name: string; price: string; views: number; created: string; category_id: string; condition: string }>(
      `select id::text, name, price::text, views, (extract(epoch from created_at) * 1000)::bigint::text as created, category_id::text, condition from marketplace_products where status = 'active'`,
    )
    return rows.map((r) => ({ id: Number(r.id), name: r.name, price: Number(r.price), views: r.views, created: Number(r.created), category: Number(r.category_id), condition: r.condition }))
  }

  it('matches the oracle for every sort, filter and page', async () => {
    await insertProducts(t.db, 20, { categoryId: 2, prefix: 'Buku Ujian' })
    await insertProducts(t.db, 15, { categoryId: 3, prefix: 'Baju Ujian' })
    await t.db.query(`update marketplace_products set views = (id * 7) % 11 where id > 10`)
    const rows = await load()
    expect(rows).toHaveLength(45)

    for (const sort of [undefined, 'latest', 'price_low', 'price_high', 'popular', 'nonsense']) {
      for (const category of [undefined, 2, 3]) {
        const slug = category === 2 ? 'buku-rujukan' : category === 3 ? 'uniform-pakaian' : undefined
        const expected = oracle(rows, { sort, ...(category ? { category } : {}) })
        const got: number[] = []
        for (let page = 1; page <= Math.ceil(expected.length / 20) + 1; page++) {
          const qs = new URLSearchParams({ page: String(page) })
          if (sort) qs.set('sort', sort)
          if (slug) qs.set('category', slug)
          const res = await search(`?${qs.toString()}`)
          expect(res.data.length).toBeLessThanOrEqual(20)
          expect(res.meta.totalItems).toBe(expected.length)
          expect(res.meta.totalPages).toBe(Math.max(1, Math.ceil(expected.length / 20)))
          got.push(...res.data.map((c) => Number(c.id)))
        }
        expect(got, `sort=${String(sort)} category=${String(slug)}`).toEqual(expected)
      }
    }

    expect(await ids('?condition=used&sort=price_high')).toEqual(oracle(rows, { condition: 'used', sort: 'price_high' }).slice(0, 20))
    expect(await ids('?q=ujian%201&category=buku-rujukan')).toEqual(oracle(rows, { q: 'ujian 1', category: 2 }))
  })

  it('page 1 holds 20, page 2 holds 20 and page 3 holds the last 5', async () => {
    await insertProducts(t.db, 35)
    expect((await search()).data).toHaveLength(20)
    expect((await search('?page=2')).data).toHaveLength(20)
    const last = await search('?page=3')
    expect(last.data).toHaveLength(5)
    expect(last.meta).toEqual({ page: 3, pageSize: 20, totalItems: 45, totalPages: 3, from: 41, to: 45 })
  })
})

describe('GET /marketplace/sellers/:id (AC7)', () => {
  it('returns the shop and its visible products, newest first, ties by id (R12, R13)', async () => {
    const res = await student.get('/api/marketplace/sellers/1')
    expect(res.status).toBe(200)
    const body = MarketplaceShopResponseSchema.parse(res.body)
    expect(body.data.shop).toEqual({
      id: '1',
      shopName: 'JomBelajar Official',
      initial: 'J',
      description: 'Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾',
      verified: true,
      ratingStars: '☆☆☆☆☆',
      reviewCount: 0,
      productCount: 10,
      createdAt: '2026-02-09T12:00:00+08:00',
    })
    expect(body.data.products.map((c) => c.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  })

  it('answers 404 for an unknown, non-numeric, huge or non-active seller', async () => {
    for (const id of ['99', 'abc', '1.5', '-1', '0x1', '99999999999999999999999']) {
      expectError(await student.get(`/api/marketplace/sellers/${id}`), 404, 'NOT_FOUND', 'Not Found.')
    }
    await t.db.query(`update marketplace_sellers set status = 'pending'`)
    expectError(await student.get('/api/marketplace/sellers/1'), 404, 'NOT_FOUND')
  })

  it('hides drafts from the shop and counts the rating over ALL the seller products, hidden ones too (AC4)', async () => {
    const user = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ACCOUNTS.student]))[0]!.id
    await t.db.query(`update marketplace_products set status = 'draft' where id = 2`)
    // Two reviews on the hidden product, one on a visible one: (5 + 4 + 2) / 3 = 3.67, so four stars.
    await t.db.query(
      `insert into marketplace_reviews (product_id, user_id, rating, text, created_at)
       values (2, $1, 5, 'Bagus', '2026-03-01T10:00:00+08:00'), (2, $1, 4, 'Baik', '2026-03-02T10:00:00+08:00'), (1, $1, 2, 'Biasa', '2026-03-03T10:00:00+08:00')`,
      [user],
    )
    const body = MarketplaceShopResponseSchema.parse((await student.get('/api/marketplace/sellers/1')).body)
    expect(body.data.shop).toMatchObject({ productCount: 9, reviewCount: 3, ratingStars: '★★★★☆' })
    expect(body.data.products.map((c) => c.id)).not.toContain('2')
  })

  it('orders the shop by created_at descending, ties by id ascending', async () => {
    await insertProducts(t.db, 6, { at: '2026-04-01T10:00:00+08:00' })
    const body = MarketplaceShopResponseSchema.parse((await student.get('/api/marketplace/sellers/1')).body)
    const rows = await t.db.query<{ id: string }>(`select id::text from marketplace_products order by created_at desc, marketplace_products.id asc`)
    expect(body.data.products.map((c) => c.id)).toEqual(rows.map((r) => r.id))
    expect(body.data.shop.productCount).toBe(16)
  })
})
