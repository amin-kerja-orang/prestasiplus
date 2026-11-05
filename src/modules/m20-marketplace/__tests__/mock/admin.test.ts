/**
 * S7-T08 admin endpoints (API-ADM-19) of the M20 mock: the guards, the product list (global stats, filters, paging),
 * create / update / delete with the PRD field messages, the images (max 5, own delete, upload rules), the seller list
 * with global stats, the transition table (409 on an illegal one) and the pupil side effects (a suspended seller's
 * products leave the Marketplace at once).
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'

import m20 from '../../mock'
import { m20Hooks } from '../../mock/hooks'

const NOW = '2026-09-25T15:40:00+08:00'
const ADMIN = 1
const PELAJAR = 2
const A = '/api/admin/marketplace'

interface Answer<T = unknown> {
  status: number
  body: T
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

/* The tests read nested JSON bodies; a loose body type keeps them readable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  as: number | null,
  body?: unknown,
  query?: Record<string, string>,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) {
    headers.authorization = `Bearer ${issueSession(users.get(as) as never, false, Date.parse(NOW)).token}`
  }
  const res: TransportResponse = await runtime.transport.request({
    method,
    url,
    headers,
    ...(query ? { query } : {}),
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = <T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown, query?: Record<string, string>) =>
  call<T>(method, url, ADMIN, body, query)

const TOKEN_A = 'mockmpimg0000000000001'
const TOKEN_B = 'mockmpimg0000000000002'
const url = (t: string) => `/api/files/${t}`

const VALID = {
  sellerId: null,
  name: 'Pensel Warna 24 Batang',
  categoryId: '4',
  price: '12.50',
  condition: 'new',
  stockStatus: 'available',
  shippingMethod: 'postage',
  shippingFee: '5.00',
}

describe('guards', () => {
  it.each([
    ['GET', `${A}/products`],
    ['POST', `${A}/products`],
    ['GET', `${A}/seller-options`],
    ['GET', `${A}/sellers`],
    ['POST', `${A}/sellers/1/ban`],
  ] as const)('%s %s answers 401 to a guest and 403 to a pupil', async (method, path) => {
    expect((await call(method, path, null)).status).toBe(401)
    expect((await call(method, path, PELAJAR)).status).toBe(403)
  })
})

describe('products list (P12-01)', () => {
  it('lists every status with global stats and the card fields', async () => {
    const a = await admin('GET', `${A}/products`)
    expect(a.status).toBe(200)
    expect(a.body.meta).toMatchObject({ totalItems: 10, pageSize: 20, stats: { total: 10, active: 10 } })
    expect(a.body.data[0]).toMatchObject({
      sellerName: 'JomBelajar Official',
      status: 'active',
      stockStatus: 'available',
    })
    expect(typeof a.body.data[0].id).toBe('string')
  })

  it('filters by q, category and status; the stats stay global', async () => {
    await admin('PUT', `${A}/products/4`, { status: 'draft' })
    const draft = await admin('GET', `${A}/products`, undefined, { status: 'draft' })
    expect(draft.body.data.map((p: { id: string }) => p.id)).toEqual(['4'])
    expect(draft.body.meta.stats).toEqual({ total: 10, active: 9 })
    const q = await admin('GET', `${A}/products`, undefined, { q: 'BEG' })
    expect(q.body.data.length).toBeGreaterThan(0)
    expect(q.body.meta.stats.total).toBe(10)
    const cat = await admin('GET', `${A}/products`, undefined, { categoryId: '99' })
    expect(cat.body.data).toEqual([])
    expect((await admin('GET', `${A}/products`, undefined, { status: 'nope' })).status).toBe(422)
  })
})

describe('product create / update / delete (P12-02..11)', () => {
  it('creates an active product with 2 images; the first is the main one and the pupil list shows it', async () => {
    const a = await admin('POST', `${A}/products`, { ...VALID, images: [url(TOKEN_A), url(TOKEN_B)] })
    expect(a.status).toBe(201)
    expect(a.body.data).toMatchObject({ status: 'active', sellerName: 'PRESTASIPLUS Official', thumbnailUrl: url(TOKEN_A) })
    expect(a.body.data.images.map((i: { position: number }) => i.position)).toEqual([1, 2])
    const pupil = await call('GET', '/api/marketplace/products', PELAJAR, undefined, { q: '24 Batang' })
    expect(pupil.body.data).toHaveLength(1)
    expect(pupil.body.data[0].thumbnailUrl).toBe(url(TOKEN_A))
  })

  it('answers the PRD field messages', async () => {
    const a = await admin('POST', `${A}/products`, { ...VALID, name: '  ', categoryId: '', price: '10', originalPrice: '10.00' })
    expect(a.status).toBe(422)
    expect(a.body.error.fields).toMatchObject({
      name: 'Nama produk diperlukan.',
      categoryId: 'Kategori diperlukan.',
      originalPrice: 'Harga asal mesti lebih besar daripada harga.',
    })
    const noSeller = await admin('POST', `${A}/products`, { ...VALID, sellerId: undefined })
    expect(noSeller.body.error.fields.sellerId).toBe('Penjual diperlukan.')
    const range = await admin('POST', `${A}/products`, { ...VALID, price: '100000.01' })
    expect(range.body.error.fields.price).toBe('Harga mesti antara 0.01 dan 100000.')
  })

  it('refuses more than 5 images and a file that is not a marketplace upload', async () => {
    const six = Array.from({ length: 6 }, (_, i) => url(`mockmpimg000000000000${i + 1}`))
    const a = await admin('POST', `${A}/products`, { ...VALID, images: six })
    expect(a.body.error.fields.images).toBe('Maksimum 5 gambar.')
    const b = await admin('POST', `${A}/products`, { ...VALID, images: ['/images/x.jpg'] })
    expect(b.body.error.fields.images).toBe('Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.')
  })

  it('a partial PUT changes only the keys sent; Nyahaktif hides the product from pupils', async () => {
    const before = await admin('GET', `${A}/products/1`)
    const a = await admin('PUT', `${A}/products/1`, { status: 'draft' })
    expect(a.body.data).toMatchObject({ status: 'draft', name: before.body.data.name, price: before.body.data.price })
    const pupil = await call('GET', '/api/marketplace/products/beg-sekolah-anti-air-premium-vH1Fj', PELAJAR)
    expect(pupil.status).toBe(404)
    const back = await admin('PUT', `${A}/products/1`, { status: 'active' })
    expect(back.body.data.status).toBe('active')
  })

  it('checks the original price against the stored price on a PUT', async () => {
    const a = await admin('PUT', `${A}/products/1`, { originalPrice: '10.00' })
    expect(a.status).toBe(422)
    expect(a.body.error.fields.originalPrice).toBe('Harga asal mesti lebih besar daripada harga.')
  })

  it('deletes one image on its own: the product and the other images stay', async () => {
    const before = await admin('GET', `${A}/products/1`)
    const images = before.body.data.images as { id: string }[]
    expect(images.length).toBeGreaterThan(1)
    const a = await admin('DELETE', `${A}/products/1/images/${images[0]!.id}`)
    expect(a.status).toBe(200)
    expect(a.body.data.images).toHaveLength(images.length - 1)
    expect(a.body.data.name).toBe(before.body.data.name)
    expect((await admin('DELETE', `${A}/products/1/images/${images[0]!.id}`)).status).toBe(404)
  })

  it('appends newImages up to 5 in all', async () => {
    const created = await admin('POST', `${A}/products`, { ...VALID, images: [url(TOKEN_A)] })
    const id = created.body.data.id
    const ok = await admin('PUT', `${A}/products/${id}`, { newImages: [url(TOKEN_B)] })
    expect(ok.body.data.images.map((i: { position: number }) => i.position)).toEqual([1, 2])
    const many = Array.from({ length: 4 }, (_, i) => url(`mockmpimg000000000001${i}`))
    const bad = await admin('PUT', `${A}/products/${id}`, { newImages: many })
    expect(bad.body.error.fields.newImages).toBe('Maksimum 5 gambar.')
  })

  it('deletes a product (no order block) with its images', async () => {
    const a = await admin('DELETE', `${A}/products/1`)
    expect(a.body.data).toEqual({ id: '1' })
    expect((await admin('GET', `${A}/products/1`)).status).toBe(404)
    expect((await admin('GET', `${A}/products`)).body.meta.stats.total).toBe(9)
  })
})

describe('image upload', () => {
  it('registers no /api/files route, so other modules\' uploads are not captured (404 as on base)', async () => {
    const form = new FormData()
    form.append('file', new File(['x'], 'a.png', { type: 'image/png' }))
    for (const purpose of ['question_image', 'marketplace_image']) {
      expect((await call('POST', '/api/files', ADMIN, form, { purpose })).status).toBe(404)
    }
  })

  it('in mock mode uploadMarketplaceImage answers locally with a FileRef url the create accepts', async () => {
    const { uploadMarketplaceImage } = await import('../../api/marketplace')
    const url = await uploadMarketplaceImage(new File(['x'], 'a.png', { type: 'image/png' }))
    expect(url).toMatch(/^\/api\/files\/[A-Za-z0-9_-]{22}$/)
    const a = await admin('POST', `${A}/products`, { ...VALID, images: [url] })
    expect(a.status).toBe(201)
  })
})

describe('sellers (P2-13)', () => {
  it('seller-options: the official option first, then the active sellers', async () => {
    const a = await admin('GET', `${A}/seller-options`)
    expect(a.body.data[0]).toEqual({ id: null, label: 'PRESTASIPLUS Official (Admin)' })
    expect(a.body.data.map((o: { label: string }) => o.label)).toContain('JomBelajar Official')
    m20Hooks.m20LoadFixture('m20-seller-states')
    const b = await admin('GET', `${A}/seller-options`)
    expect(b.body.data).toHaveLength(2)
  })

  it('lists with global stats, the masked owner and the allowed actions; filters by status', async () => {
    m20Hooks.m20LoadFixture('m20-seller-states')
    const all = await admin('GET', `${A}/sellers`)
    expect(all.body.meta.stats).toEqual({ total: 4, active: 1, pending: 1 })
    expect(all.body.meta.totalItems).toBe(4)
    const row = all.body.data.find((s: { shopName: string }) => s.shopName === 'JomBelajar Official')
    expect(row.actions).toEqual(['suspend', 'ban'])
    expect(row.verified).toBe(true)
    expect(row.ownerMasked).toMatch(/^\S\*\*\*( \S\*\*\*)*$/)
    const pending = await admin('GET', `${A}/sellers`, undefined, { status: 'pending' })
    expect(pending.body.data.map((s: { shopName: string }) => s.shopName)).toEqual(['Kedai Menunggu'])
    expect(pending.body.data[0].actions).toEqual(['approve', 'ban'])
    expect(pending.body.meta.stats.total).toBe(4)
  })

  it('walks the machine: approve, verify (once), suspend, approve again, ban (terminal)', async () => {
    m20Hooks.m20LoadFixture('m20-seller-states')
    const post = (id: number, action: string) => admin('POST', `${A}/sellers/${id}/${action}`)
    const approved = await post(2, 'approve')
    expect(approved.body.data).toMatchObject({ status: 'active', verified: false, actions: ['verify', 'suspend', 'ban'] })
    const verified = await post(2, 'verify')
    expect(verified.body.data).toMatchObject({ status: 'active', verified: true, actions: ['suspend', 'ban'] })
    expect((await post(2, 'verify')).status).toBe(409)
    expect((await post(2, 'suspend')).body.data.status).toBe('suspended')
    expect((await post(2, 'approve')).body.data.status).toBe('active')
    const banned = await post(2, 'ban')
    expect(banned.body.data).toMatchObject({ status: 'banned', actions: [] })
    for (const action of ['approve', 'verify', 'suspend', 'ban']) {
      const refused = await post(2, action)
      expect(refused.status).toBe(409)
      expect(refused.body.error.message).toBe('Perubahan status ini tidak dibenarkan daripada status semasa.')
    }
  })

  it('refuses suspend from pending (409) and answers 404 for an unknown seller', async () => {
    m20Hooks.m20LoadFixture('m20-seller-states')
    expect((await admin('POST', `${A}/sellers/2/suspend`)).status).toBe(409)
    expect((await admin('POST', `${A}/sellers/99/approve`)).status).toBe(404)
    expect((await admin('GET', `${A}/sellers/99`)).status).toBe(404)
  })

  it('FR-ADM-P2-13.2: a suspended or banned seller\'s products leave the pupil Marketplace at once', async () => {
    const count = async () => (await call('GET', '/api/marketplace/products', PELAJAR)).body.meta.totalItems
    expect(await count()).toBe(10)
    await admin('POST', `${A}/sellers/1/suspend`)
    expect(await count()).toBe(0)
    await admin('POST', `${A}/sellers/1/approve`)
    expect(await count()).toBe(10)
    await admin('POST', `${A}/sellers/1/ban`)
    expect(await count()).toBe(0)
  })
})
