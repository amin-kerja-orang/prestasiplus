import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { MarketplaceProductResponseSchema, MarketplaceWhatsappResponseSchema, marketplaceWhatsappUrl } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ACCOUNTS, bootMarketplaceApp, count, expectError, insertProducts, loginAs, type Client, type MarketplaceTestApp } from './helpers'

const SLUG_1 = 'beg-sekolah-anti-air-premium-vH1Fj'
const SLUG_8 = 'botol-air-750ml-bpa-free-biru-KEz9H'

let t: MarketplaceTestApp
let student: Client
let teacher: Client
let admin: Client

beforeAll(async () => {
  t = await bootMarketplaceApp()
  ;[student, teacher, admin] = await Promise.all([loginAs(t, ACCOUNTS.student), loginAs(t, ACCOUNTS.teacher), loginAs(t, ACCOUNTS.admin)])
}, 120_000)
afterAll(async () => {
  await t.close()
})
afterEach(async () => {
  await t.db.query(`delete from marketplace_reviews`)
  await t.db.query(`delete from marketplace_products where id > 10`)
  await t.db.query(`update marketplace_products set status = 'active', stock_status = 'available'`)
  await t.db.query(`update marketplace_sellers set status = 'active', whatsapp = '60100000000', whatsapp_clicks = 16`)
  await t.db.query(`update marketplace_products set views = v.views from (values (1,30),(2,14),(3,13),(4,5),(5,7),(6,3),(7,5),(8,19),(9,6),(10,9)) as v(id, views) where marketplace_products.id = v.id`)
})

const views = async (id: number) => count(t.db, `select views as n from marketplace_products where id = $1`, [id])
const clicks = async () => count(t.db, `select whatsapp_clicks as n from marketplace_sellers where id = 1`)
const detail = async (c: Client, slug: string) => {
  const res = await c.get(`/api/marketplace/products/${slug}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return MarketplaceProductResponseSchema.parse(res.body).data
}

describe('GET /marketplace/products/:slug (AC5)', () => {
  it('returns the detail of the mock and adds 1 to views on every call, for any role', async () => {
    const first = await detail(student, SLUG_1)
    expect(first).toMatchObject({
      id: '1',
      name: 'Beg Sekolah Anti-Air Premium',
      categoryId: '1',
      category: { id: '1', slug: 'peralatan-sekolah', name: 'Peralatan Sekolah', icon: 'fa-pencil-ruler' },
      price: '89.90',
      originalPrice: '129.90',
      discountPct: 31,
      condition: 'new',
      stockStatus: 'available',
      shippingMethod: 'postage',
      shippingFee: '8.00',
      shippingLine: 'Pos / Kurier (RM8.00)',
      location: 'Kuala Lumpur',
      views: 31,
      createdAt: '2026-02-09T12:00:00+08:00',
      reviewCount: 0,
      reviews: [],
      seller: { id: '1', shopName: 'JomBelajar Official', initial: 'J', verified: true, ratingStars: '☆☆☆☆☆', activeProductCount: 10 },
    })
    expect(first.images.map((i) => i.position)).toEqual([1, 2, 3, 4])
    expect(first.images[0]!.url).toBe('/images/marketplace/products/1/img_1.jpg')
    expect(first.related.map((c) => c.id)).toEqual(['6'])
    expect((await detail(teacher, SLUG_1)).views).toBe(32)
    expect((await detail(admin, SLUG_1)).views).toBe(33)
    expect(await views(1)).toBe(33)
  })

  it('lists the related products in id order, never the product itself (R10)', async () => {
    expect((await detail(student, 'e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84')).related.map((c) => c.id)).toEqual(['2', '7'])
    expect((await detail(student, 'kamus-dewan-edisi-keempat-terpakai-8axTV')).related.map((c) => c.id)).toEqual(['2', '5'])
  })

  it('shows at most 4 related products, visible ones only', async () => {
    await insertProducts(t.db, 6, { categoryId: 1 })
    await t.db.query(`update marketplace_products set status = 'draft' where id = 11`)
    const related = (await detail(student, SLUG_1)).related
    expect(related).toHaveLength(4)
    expect(related.map((c) => c.id)).toEqual(['6', '12', '13', '14'])
  })

  it('20 parallel calls raise the counter by exactly 20, and every answer is a distinct value', async () => {
    const before = await views(1)
    const answers = await Promise.all(Array.from({ length: 20 }, () => student.get(`/api/marketplace/products/${SLUG_1}`)))
    for (const a of answers) expect(a.status).toBe(200)
    const seen = answers.map((a) => MarketplaceProductResponseSchema.parse(a.body).data.views)
    expect(new Set(seen).size).toBe(20)
    expect(Math.max(...seen)).toBe(before + 20)
    expect(await views(1)).toBe(before + 20)
  })

  it('answers 404 for an unknown or hidden slug and changes nothing', async () => {
    expectError(await student.get('/api/marketplace/products/tiada-produk'), 404, 'NOT_FOUND', 'Not Found.')
    await t.db.query(`update marketplace_products set status = 'draft' where id = 1`)
    expectError(await student.get(`/api/marketplace/products/${SLUG_1}`), 404, 'NOT_FOUND', 'Not Found.')
    await t.db.query(`update marketplace_products set status = 'rejected' where id = 1`)
    expectError(await student.get(`/api/marketplace/products/${SLUG_1}`), 404, 'NOT_FOUND')
    expect(await views(1)).toBe(30)
  })

  it.each(['pending', 'suspended', 'banned'])('a %s seller hides the product page', async (status) => {
    await t.db.query(`update marketplace_sellers set status = $1`, [status])
    expectError(await student.get(`/api/marketplace/products/${SLUG_1}`), 404, 'NOT_FOUND')
    expect(await views(1)).toBe(30)
  })

  it('an out_of_stock product stays visible and counts a view', async () => {
    await t.db.query(`update marketplace_products set stock_status = 'out_of_stock' where id = 1`)
    expect(await detail(student, SLUG_1)).toMatchObject({ stockStatus: 'out_of_stock', views: 31 })
  })

  it('reviews come newest first; the seller rating counts reviews of the seller\'s hidden products', async () => {
    const user = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ACCOUNTS.student]))[0]!.id
    await t.db.query(`update marketplace_products set status = 'draft' where id = 2`)
    await t.db.query(
      `insert into marketplace_reviews (product_id, user_id, rating, text, created_at) values
         (1, $1, 5, 'Satu', '2026-03-01T10:00:00+08:00'), (1, $1, 3, 'Dua', '2026-03-03T10:00:00+08:00'), (1, $1, 4, 'Tiga', '2026-03-03T10:00:00+08:00'),
         (2, $1, 1, 'Tersembunyi', '2026-03-01T10:00:00+08:00')`,
      [user],
    )
    const d = await detail(student, SLUG_1)
    // Newest first; the two reviews with one instant are ordered by id descending.
    expect(d.reviews.map((r) => r.text)).toEqual(['Tiga', 'Dua', 'Satu'])
    expect(d.reviews[0]).toMatchObject({ rating: 4, createdAt: '2026-03-03T10:00:00+08:00', userId: user })
    expect(d.reviewCount).toBe(3)
    // (5 + 3 + 4 + 1) / 4 = 3.25 -> 3 stars; the hidden product's review still counts.
    expect(d.seller).toMatchObject({ ratingStars: '★★★☆☆', activeProductCount: 9 })
  })

  it('a platform product has no seller and a null description/shipping fee comes through as null', async () => {
    await t.db.query(
      `insert into marketplace_products (seller_id, name, slug, category_id, price, condition, stock_status, status, shipping_method)
       values (null, 'Produk Platform', 'produk-platform', 5, 5.5, 'new', 'available', 'active', 'postage')`,
    )
    const d = await detail(student, 'produk-platform')
    expect(d).toMatchObject({ seller: null, description: null, shippingFee: null, shippingLine: 'Pos / Kurier', location: '', price: '5.50', originalPrice: null, discountPct: null, images: [] })
  })
})

describe('POST /marketplace/products/:slug/whatsapp (AC6, D14)', () => {
  const message = 'Salam, saya berminat dengan produk "Botol Air 750ml BPA Free (Biru)" di PRESTASIPLUS Marketplace.'

  it('returns the exact wa.me URL of the seller and adds 1 to the click counter only', async () => {
    const res = await student.post(`/api/marketplace/products/${SLUG_8}/whatsapp`)
    expect(res.status).toBe(200)
    expect(MarketplaceWhatsappResponseSchema.parse(res.body).data.url).toBe(`https://wa.me/60100000000?text=${encodeURIComponent(message)}`)
    expect(await clicks()).toBe(17)
    // The hand-off does not touch views.
    expect(await views(8)).toBe(19)
    expect((await teacher.post(`/api/marketplace/products/${SLUG_8}/whatsapp`)).status).toBe(200)
    expect((await admin.post(`/api/marketplace/products/${SLUG_8}/whatsapp`)).status).toBe(200)
    expect(await clicks()).toBe(19)
  })

  it('uses the seller number digits only', async () => {
    await t.db.query(`update marketplace_sellers set whatsapp = '+60 10-000 0000'`)
    const res = await student.post(`/api/marketplace/products/${SLUG_8}/whatsapp`)
    expect(MarketplaceWhatsappResponseSchema.parse(res.body).data.url).toBe(marketplaceWhatsappUrl('60100000000', 'Botol Air 750ml BPA Free (Biru)'))
  })

  it('a platform product uses the configured platform number and counts nothing', async () => {
    await t.db.query(
      `insert into marketplace_products (seller_id, name, slug, category_id, price, condition, stock_status, status, shipping_method)
       values (null, 'Produk "Platform" & Rakan', 'produk-platform', 5, 5, 'new', 'available', 'active', 'free')`,
    )
    const res = await student.post('/api/marketplace/products/produk-platform/whatsapp')
    expect(res.status).toBe(200)
    // The dev default of MARKETPLACE_PLATFORM_WHATSAPP; quotes and ampersands are encoded.
    expect(MarketplaceWhatsappResponseSchema.parse(res.body).data.url).toBe(
      `https://wa.me/60000000000?text=${encodeURIComponent('Salam, saya berminat dengan produk "Produk "Platform" & Rakan" di PRESTASIPLUS Marketplace.')}`,
    )
    expect(await clicks()).toBe(16)
  })

  it('20 parallel calls add exactly 20 clicks', async () => {
    const answers = await Promise.all(Array.from({ length: 20 }, () => student.post(`/api/marketplace/products/${SLUG_8}/whatsapp`)))
    for (const a of answers) expect(a.status).toBe(200)
    expect(await clicks()).toBe(36)
  })

  it('answers 404 for an unknown or hidden product and changes nothing', async () => {
    expectError(await student.post('/api/marketplace/products/tiada/whatsapp'), 404, 'NOT_FOUND', 'Not Found.')
    await t.db.query(`update marketplace_products set status = 'draft' where id = 8`)
    expectError(await student.post(`/api/marketplace/products/${SLUG_8}/whatsapp`), 404, 'NOT_FOUND')
    await t.db.query(`update marketplace_products set status = 'active' where id = 8`)
    await t.db.query(`update marketplace_sellers set status = 'suspended'`)
    expectError(await student.post(`/api/marketplace/products/${SLUG_8}/whatsapp`), 404, 'NOT_FOUND')
    expect(await clicks()).toBe(16)
  })

  it('sends nothing outbound: no HTTP client is called, and the module imports none', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      expect((await student.post(`/api/marketplace/products/${SLUG_8}/whatsapp`)).status).toBe(200)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
    const dir = fileURLToPath(new URL('../../src/modules/marketplace/', import.meta.url))
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const code = readFileSync(`${dir}${f}`, 'utf8')
      expect(code, f).not.toMatch(/\bfetch\(|node:https?|from 'https?'|axios|undici|XMLHttpRequest|nodemailer/)
    }
  })
})
