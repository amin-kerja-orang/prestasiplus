import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MARKETPLACE_ADMIN_MESSAGES as MSG, MarketplaceAdminProductListResponseSchema, MarketplaceAdminProductResponseSchema } from '@pp/contract'

import { ACCOUNTS, auditRows, bootAdminApp, clientAs, count, expectError, insertSeller, VALID_PRODUCT, type AdminClient, type MarketplaceTestApp } from './admin-helpers'

let t: MarketplaceTestApp
let admin: AdminClient
let student: AdminClient
const BASE = '/api/admin/marketplace'

beforeAll(async () => {
  t = await bootAdminApp()
  admin = await clientAs(t, ACCOUNTS.admin)
  student = await clientAs(t, ACCOUNTS.student)
}, 120_000)
afterAll(async () => {
  await t.close()
})

const create = async (body: Record<string, unknown> = {}, who: AdminClient = admin) => who.post(`${BASE}/products`).send({ ...VALID_PRODUCT, ...body })
const fieldsOf = (res: { body: { error?: { fields?: Record<string, string> } } }) => res.body.error?.fields ?? {}

describe('roles and sessions', () => {
  const routes = [
    ['get', '/products'],
    ['get', '/products/1'],
    ['post', '/products'],
    ['put', '/products/1'],
    ['delete', '/products/1'],
    ['delete', '/products/1/images/1'],
    ['get', '/seller-options'],
    ['get', '/sellers'],
    ['get', '/sellers/1'],
    ['post', '/sellers/1/approve'],
    ['post', '/sellers/1/verify'],
    ['post', '/sellers/1/suspend'],
    ['post', '/sellers/1/ban'],
  ] as const

  it.each(routes)('%s %s without a session is 401', async (method, url) => {
    expectError(await t.http()[method](`${BASE}${url}`), 401, 'UNAUTHORIZED')
  })

  it.each([
    ['student', ACCOUNTS.student],
    ['teacher', ACCOUNTS.teacher],
    ['school admin', ACCOUNTS.schoolAdmin],
  ])('%s is 403 on every admin route and nothing changes', async (_name, account) => {
    const c = await clientAs(t, account)
    const before = await count(t.db, `select count(*) as n from marketplace_products`)
    for (const [method, url] of routes) {
      const req = method === 'get' ? c.get(`${BASE}${url}`) : method === 'post' ? c.post(`${BASE}${url}`) : method === 'put' ? c.put(`${BASE}${url}`) : c.del(`${BASE}${url}`)
      expectError(await req.send(method === 'get' ? undefined : {}), 403, 'FORBIDDEN')
    }
    expect(await count(t.db, `select count(*) as n from marketplace_products`)).toBe(before)
    expect(await count(t.db, `select count(*) as n from marketplace_sellers where status <> 'active'`)).toBe(0)
  })

  it('writes need the CSRF header: 403 CSRF_INVALID and nothing is written', async () => {
    const before = await count(t.db, `select count(*) as n from marketplace_products`)
    expectError(await admin.postNoCsrf(`${BASE}/products`).send(VALID_PRODUCT), 403, 'CSRF_INVALID')
    expectError(await admin.putNoCsrf(`${BASE}/products/1`).send({ status: 'draft' }), 403, 'CSRF_INVALID')
    expectError(await admin.delNoCsrf(`${BASE}/products/1`), 403, 'CSRF_INVALID')
    expectError(await admin.postNoCsrf(`${BASE}/sellers/1/ban`), 403, 'CSRF_INVALID')
    expect(await count(t.db, `select count(*) as n from marketplace_products`)).toBe(before)
    expect(await count(t.db, `select count(*) as n from marketplace_products where id = 1`)).toBe(1)
  })
})

describe('list and stats', () => {
  it('lists every status, newest first, 20 per page, with global stats', async () => {
    const total = await count(t.db, `select count(*) as n from marketplace_products`)
    const active = await count(t.db, `select count(*) as n from marketplace_products where status = 'active'`)
    const res = await admin.get(`${BASE}/products`)
    expect(res.status).toBe(200)
    const body = MarketplaceAdminProductListResponseSchema.parse(res.body)
    expect(body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: total, stats: { total, active } })
    expect(body.data.length).toBe(Math.min(20, total))
    expect(res.headers['cache-control']).toContain('no-store')
  })

  it('filters by q, category and status, but the stat cards stay global', async () => {
    await t.db.query(`update marketplace_products set status = 'draft' where id = 2`)
    await t.db.query(`update marketplace_products set status = 'rejected' where id = 3`)
    const total = await count(t.db, `select count(*) as n from marketplace_products`)
    const draft = MarketplaceAdminProductListResponseSchema.parse((await admin.get(`${BASE}/products?status=draft`)).body)
    expect(draft.data.map((p) => p.id)).toEqual(['2'])
    expect(draft.data[0]!.status).toBe('draft')
    expect(draft.meta.totalItems).toBe(1)
    expect(draft.meta.stats.total).toBe(total)
    const rejected = MarketplaceAdminProductListResponseSchema.parse((await admin.get(`${BASE}/products?status=rejected`)).body)
    expect(rejected.data.map((p) => p.id)).toEqual(['3'])
    const q = MarketplaceAdminProductListResponseSchema.parse((await admin.get(`${BASE}/products?q=PENSEL`)).body)
    expect(q.data.length).toBeGreaterThan(0)
    expect(q.data.every((p) => p.name.toLowerCase().includes('pensel'))).toBe(true)
    const cat = MarketplaceAdminProductListResponseSchema.parse((await admin.get(`${BASE}/products?categoryId=2`)).body)
    expect(cat.data.length).toBeGreaterThan(0)
    expect(cat.data.every((p) => p.categoryId === '2')).toBe(true)
    // blank filters mean "Semua ..."
    const blank = MarketplaceAdminProductListResponseSchema.parse((await admin.get(`${BASE}/products?q=&categoryId=&status=`)).body)
    expect(blank.meta.totalItems).toBe(total)
    expect(MarketplaceAdminProductListResponseSchema.parse((await admin.get(`${BASE}/products?categoryId=abc`)).body).data).toEqual([])
    await t.db.query(`update marketplace_products set status = 'active' where id in (2, 3)`)
  })

  it('an unknown status or a bad page is a 422', async () => {
    expectError(await admin.get(`${BASE}/products?status=Aktif`), 422, 'VALIDATION_ERROR')
    expectError(await admin.get(`${BASE}/products?page=0`), 422, 'VALIDATION_ERROR')
  })

  it('an out-of-range page is an empty page', async () => {
    const body = MarketplaceAdminProductListResponseSchema.parse((await admin.get(`${BASE}/products?page=99`)).body)
    expect(body.data).toEqual([])
    expect(body.meta.from).toBeNull()
  })
})

describe('create', () => {
  it('creates an active product with 2 images; pupils see it with the first image as main', async () => {
    const a = await admin.upload('marketplace_image')
    const b = await admin.upload('marketplace_image')
    const res = await create({ name: 'Beg Ujian Admin Aktif', images: [a.url, b.url] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const p = MarketplaceAdminProductResponseSchema.parse(res.body).data
    expect(p).toMatchObject({ status: 'active', sellerId: null, sellerName: 'PRESTASIPLUS Official', price: '50.00', originalPrice: '70.00', shippingFee: '8.00', thumbnailUrl: a.url })
    expect(p.slug).toMatch(/^beg-ujian-admin-aktif-[A-Za-z0-9]{5}$/)
    expect(p.images.map((i) => [i.position, i.url])).toEqual([
      [1, a.url],
      [2, b.url],
    ])
    const list = await student.get('/api/marketplace/products?q=Beg Ujian Admin Aktif')
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0]).toMatchObject({ price: '50.00', thumbnailUrl: a.url, seller: null })
    // any signed-in user reads the uploaded image
    expect((await student.get(a.url)).status).toBe(200)
    const audit = await auditRows(t, 'marketplace.product.created')
    expect(audit.at(-1)).toMatchObject({ target_type: 'marketplace_product', target_id: p.id, detail: { name: 'Beg Ujian Admin Aktif', images: 2, status: 'active' } })
  })

  it('a draft product is not shown to pupils; two products with the same name get different slugs', async () => {
    const one = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Nama Sama', status: 'draft' })).body).data
    const two = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Nama Sama' })).body).data
    expect(one.slug).not.toBe(two.slug)
    expect(one.status).toBe('draft')
    const list = await student.get('/api/marketplace/products?q=Nama Sama')
    expect(list.body.data.map((p: { slug: string }) => p.slug)).toEqual([two.slug])
  })

  it('a seller product: the seller must be active', async () => {
    const pending = await insertSeller(t, 'guru@demo.test', 'pending', 'Kedai Menunggu')
    const bad = await create({ sellerId: pending })
    expectError(bad, 422, 'VALIDATION_ERROR')
    expect(fieldsOf(bad).sellerId).toBe('Penjual tidak sah.')
    expect(fieldsOf(await create({ sellerId: '999999' })).sellerId).toBe('Penjual tidak sah.')
    expect(fieldsOf(await create({ sellerId: 'abc' })).sellerId).toBe('Penjual tidak sah.')
    const good = await create({ sellerId: '1', name: 'Produk Kedai' })
    expect(good.status).toBe(201)
    expect(good.body.data.sellerName).toBe('JomBelajar Official')
  })

  it('refuses a missing body with the PRD messages', async () => {
    const res = await admin.post(`${BASE}/products`).send({})
    expectError(res, 422, 'VALIDATION_ERROR')
    expect(fieldsOf(res)).toMatchObject({
      sellerId: 'Penjual diperlukan.',
      name: 'Nama produk diperlukan.',
      categoryId: 'Kategori diperlukan.',
      price: MSG.priceRequired,
      condition: MSG.conditionRequired,
      stockStatus: MSG.stockStatusRequired,
      shippingMethod: MSG.shippingMethodRequired,
    })
  })

  it('refuses a blank name, a blank category and a blank seller', async () => {
    const res = await create({ name: '   ', categoryId: '', sellerId: '' })
    expect(fieldsOf(res)).toMatchObject({ sellerId: 'Penjual diperlukan.', name: 'Nama produk diperlukan.', categoryId: 'Kategori diperlukan.' })
    expect(fieldsOf(await create({ categoryId: '99' })).categoryId).toBe('Kategori tidak sah.')
  })

  it.each([
    [{ name: 'x'.repeat(121) }, 'name', MSG.nameTooLong],
    [{ originalPrice: '50.00' }, 'originalPrice', 'Harga asal mesti lebih besar daripada harga.'],
    [{ originalPrice: '40.00' }, 'originalPrice', 'Harga asal mesti lebih besar daripada harga.'],
    [{ price: '0.00' }, 'price', MSG.priceRange],
    [{ price: '100000.01' }, 'price', MSG.priceRange],
    [{ price: 'abc' }, 'price', MSG.priceFormat],
    [{ price: '1.234' }, 'price', MSG.priceFormat],
    [{ shippingFee: '1000.01' }, 'shippingFee', MSG.shippingFeeRange],
    [{ description: 'x'.repeat(2001) }, 'description', MSG.descriptionTooLong],
    [{ location: 'x'.repeat(101) }, 'location', MSG.locationTooLong],
    [{ condition: 'broken' }, 'condition', MSG.conditionRequired],
    [{ status: 'banned' }, 'status', MSG.statusRequired],
  ])('field rule %j', async (patch, field, message) => {
    const res = await create(patch)
    expectError(res, 422, 'VALIDATION_ERROR')
    expect(fieldsOf(res)[field]).toBe(message)
  })

  it('accepts the limits: price 0.01 and 100000, fee 0 and 1000, name of 120, no original price', async () => {
    expect((await create({ price: '0.01', originalPrice: null, shippingFee: '0', name: 'x'.repeat(120) })).status).toBe(201)
    expect((await create({ price: '100000', originalPrice: null, shippingFee: '1000.00', description: null })).status).toBe(201)
  })

  it('refuses an unknown key', async () => {
    expect(fieldsOf(await create({ views: 99 })).views).toBe('The views field is not allowed.')
  })

  it('images: at most 5, only stored marketplace_image files, each used once', async () => {
    const files = await Promise.all(Array.from({ length: 6 }, () => admin.upload('marketplace_image')))
    const tooMany = await create({ images: files.map((f) => f.url) })
    expect(fieldsOf(tooMany).images).toBe('Maksimum 5 gambar.')
    const wrongPurpose = await admin.upload('avatar')
    expect(fieldsOf(await create({ images: [wrongPurpose.url] })).images).toBe(MSG.imageInvalid)
    expect(fieldsOf(await create({ images: ['/images/marketplace/x.jpg'] })).images).toBe(MSG.imageInvalid)
    expect(fieldsOf(await create({ images: ['/api/files/AAAAAAAAAAAAAAAAAAAAAA'] })).images).toBe(MSG.imageInvalid)
    expect(fieldsOf(await create({ images: [files[0]!.url, files[0]!.url] })).images).toBe('Gambar ini sudah digunakan.')
    const five = await create({ images: files.slice(0, 5).map((f) => f.url) })
    expect(five.status).toBe(201)
    // a file that already belongs to an image cannot be attached again
    expect(fieldsOf(await create({ images: [files[0]!.url] })).images).toBe('Gambar ini sudah digunakan.')
    expect(fieldsOf(await create({ images: [files[5]!.url, files[5]!.url] })).images).toBeDefined()
  })

  it('an upload of a wrong type or over 2 MB never becomes a file (BM message)', async () => {
    const big = Buffer.concat([(await import('../files/fixtures')).makePng(), Buffer.alloc(3 * 1024 * 1024)])
    const res = await admin.post('/api/files?purpose=marketplace_image').attach('file', big, { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(422)
    expect(res.body.error.fields.file).toBe(MSG.imageInvalid)
  })

  it('a refused create writes nothing', async () => {
    const before = await count(t.db, `select count(*) as n from marketplace_products`)
    await create({ originalPrice: '1.00' })
    expect(await count(t.db, `select count(*) as n from marketplace_products`)).toBe(before)
  })
})

describe('get and update', () => {
  it('reads one product and 404 for an unknown or non-numeric id', async () => {
    const res = await admin.get(`${BASE}/products/1`)
    const p = MarketplaceAdminProductResponseSchema.parse(res.body).data
    expect(p.id).toBe('1')
    expect(p.images.length).toBeGreaterThan(0)
    expectError(await admin.get(`${BASE}/products/999999`), 404, 'NOT_FOUND')
    expectError(await admin.get(`${BASE}/products/abc`), 404, 'NOT_FOUND')
  })

  it('Nyahaktif / Aktifkan: a partial status update hides and shows the product for pupils', async () => {
    const p = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Produk Nyahaktif' })).body).data
    const visible = async () => (await student.get('/api/marketplace/products?q=Produk Nyahaktif')).body.data.length
    expect(await visible()).toBe(1)
    const off = await admin.put(`${BASE}/products/${p.id}`).send({ status: 'draft' })
    expect(off.status, JSON.stringify(off.body)).toBe(200)
    expect(off.body.data).toMatchObject({ status: 'draft', name: 'Produk Nyahaktif', price: '50.00' })
    expect(await visible()).toBe(0)
    expect((await admin.put(`${BASE}/products/${p.id}`).send({ status: 'active' })).status).toBe(200)
    expect(await visible()).toBe(1)
    const rows = await auditRows(t, 'marketplace.product.updated')
    expect(rows.at(-1)).toMatchObject({ target_id: p.id, detail: { changed: ['status'], statusFrom: 'draft', statusTo: 'active' } })
  })

  it('updates fields, keeps the slug, null clears optional fields', async () => {
    const p = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Produk Ubah' })).body).data
    const res = await admin.put(`${BASE}/products/${p.id}`).send({ name: 'Produk Ubah Baru', price: '60.00', originalPrice: null, shippingFee: null, description: null, stockStatus: 'out_of_stock', condition: 'used', location: '' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toMatchObject({ name: 'Produk Ubah Baru', slug: p.slug, price: '60.00', originalPrice: null, shippingFee: null, description: null, stockStatus: 'out_of_stock', condition: 'used', location: '' })
  })

  it('validates like create, including the price rule against the stored original price', async () => {
    const p = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Produk Harga' })).body).data
    expect(fieldsOf(await admin.put(`${BASE}/products/${p.id}`).send({ price: '70.00' })).originalPrice).toBe('Harga asal mesti lebih besar daripada harga.')
    expect(fieldsOf(await admin.put(`${BASE}/products/${p.id}`).send({ name: ' ' })).name).toBe('Nama produk diperlukan.')
    expect(fieldsOf(await admin.put(`${BASE}/products/${p.id}`).send({ price: '10.00', originalPrice: '10.00' })).originalPrice).toBe(MSG.originalPriceNotGreater)
    expect(fieldsOf(await admin.put(`${BASE}/products/${p.id}`).send({ sellerId: '' })).sellerId).toBe('Penjual diperlukan.')
    expect(fieldsOf(await admin.put(`${BASE}/products/${p.id}`).send({ categoryId: '' })).categoryId).toBe('Kategori diperlukan.')
    const after = await admin.get(`${BASE}/products/${p.id}`)
    expect(after.body.data).toMatchObject({ price: '50.00', name: 'Produk Harga' })
    expectError(await admin.put(`${BASE}/products/999999`).send({ status: 'draft' }), 404, 'NOT_FOUND')
  })

  it('moves a product between the official seller and an active seller; a suspended seller keeps its product editable', async () => {
    const p = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Produk Pindah', sellerId: '1' })).body).data
    expect((await admin.put(`${BASE}/products/${p.id}`).send({ sellerId: null })).body.data.sellerName).toBe('PRESTASIPLUS Official')
    await admin.put(`${BASE}/products/${p.id}`).send({ sellerId: '1' })
    await t.db.query(`update marketplace_sellers set status = 'suspended' where id = 1`)
    expect((await admin.put(`${BASE}/products/${p.id}`).send({ sellerId: '1', location: 'Ipoh' })).status).toBe(200)
    await t.db.query(`update marketplace_sellers set status = 'active' where id = 1`)
  })

  it('appends new images after the existing ones and stops at 5 in total', async () => {
    const f = await Promise.all(Array.from({ length: 6 }, () => admin.upload('marketplace_image')))
    const p = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Produk Gambar', images: [f[0]!.url, f[1]!.url, f[2]!.url] })).body).data
    const over = await admin.put(`${BASE}/products/${p.id}`).send({ newImages: [f[3]!.url, f[4]!.url, f[5]!.url] })
    expect(fieldsOf(over).newImages).toBe('Maksimum 5 gambar.')
    const ok = await admin.put(`${BASE}/products/${p.id}`).send({ newImages: [f[3]!.url, f[4]!.url] })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body.data.images.map((i: { position: number; url: string }) => [i.position, i.url])).toEqual(f.slice(0, 5).map((x, i) => [i + 1, x.url]))
  })
})

describe('image delete and product delete', () => {
  it('deleting image 1 of 4 keeps the product and the other 3 images (AC-ADM-P2-12.2) and removes the stored file', async () => {
    const f = await Promise.all(Array.from({ length: 4 }, () => admin.upload('marketplace_image')))
    const p = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Produk Padam Gambar', images: f.map((x) => x.url) })).body).data
    const first = p.images[0]!
    const res = await admin.del(`${BASE}/products/${p.id}/images/${first.id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const after = MarketplaceAdminProductResponseSchema.parse(res.body).data
    expect(after.name).toBe('Produk Padam Gambar')
    expect(after.images.map((i) => i.position)).toEqual([2, 3, 4])
    expect(after.thumbnailUrl).toBe(f[1]!.url)
    expect((await admin.get(f[0]!.url)).status).toBe(404)
    expect((await admin.get(f[1]!.url)).status).toBe(200)
    // a new image goes after the highest position
    const extra = await admin.upload('marketplace_image')
    const added = await admin.put(`${BASE}/products/${p.id}`).send({ newImages: [extra.url] })
    expect(added.body.data.images.map((i: { position: number }) => i.position)).toEqual([2, 3, 4, 5])
    const rows = await auditRows(t, 'marketplace.product.image_deleted')
    expect(rows.at(-1)).toMatchObject({ target_id: p.id, detail: { imageId: first.id, position: 1 } })
  })

  it('the image must belong to the product: 404 otherwise, and a seeded asset path has no file to remove', async () => {
    const seeded = await admin.get(`${BASE}/products/1`)
    const imageId = seeded.body.data.images[0].id as string
    expectError(await admin.del(`${BASE}/products/2/images/${imageId}`), 404, 'NOT_FOUND')
    expectError(await admin.del(`${BASE}/products/1/images/999999`), 404, 'NOT_FOUND')
    expectError(await admin.del(`${BASE}/products/1/images/abc`), 404, 'NOT_FOUND')
    const before = seeded.body.data.images.length as number
    const res = await admin.del(`${BASE}/products/1/images/${imageId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.images).toHaveLength(before - 1)
  })

  it('deletes a product: gone for pupils, images cascade, files removed, audited, second delete is 404', async () => {
    const f = await admin.upload('marketplace_image')
    const p = MarketplaceAdminProductResponseSchema.parse((await create({ name: 'Produk Untuk Dipadam', images: [f.url] })).body).data
    expect((await student.get('/api/marketplace/products?q=Produk Untuk Dipadam')).body.data).toHaveLength(1)
    const res = await admin.del(`${BASE}/products/${p.id}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { id: p.id } })
    expect((await student.get('/api/marketplace/products?q=Produk Untuk Dipadam')).body.data).toHaveLength(0)
    expect(await count(t.db, `select count(*) as n from marketplace_product_images where product_id = $1`, [p.id])).toBe(0)
    expect((await admin.get(f.url)).status).toBe(404)
    expectError(await admin.get(`${BASE}/products/${p.id}`), 404, 'NOT_FOUND')
    expectError(await admin.del(`${BASE}/products/${p.id}`), 404, 'NOT_FOUND')
    expectError(await admin.del(`${BASE}/products/abc`), 404, 'NOT_FOUND')
    const rows = await auditRows(t, 'marketplace.product.deleted')
    expect(rows.at(-1)).toMatchObject({ target_id: p.id, detail: { name: 'Produk Untuk Dipadam', images: 1 } })
  })
})
