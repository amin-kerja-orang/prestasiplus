import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  MARKETPLACE_SELLER_ACTIONS,
  MARKETPLACE_SELLER_TRANSITIONS,
  MarketplaceAdminSellerListResponseSchema,
  MarketplaceAdminSellerOptionsResponseSchema,
  MarketplaceAdminSellerResponseSchema,
  type MarketplaceSellerAction,
  type MarketplaceSellerStatus,
} from '@pp/contract'

import { ACCOUNTS, auditRows, bootAdminApp, clientAs, count, expectError, insertSeller, type AdminClient, type MarketplaceTestApp } from './admin-helpers'

let t: MarketplaceTestApp
let admin: AdminClient
let student: AdminClient
const BASE = '/api/admin/marketplace'
const AUDIT: Record<MarketplaceSellerAction, string> = {
  approve: 'marketplace.seller.approved',
  verify: 'marketplace.seller.verified',
  suspend: 'marketplace.seller.suspended',
  ban: 'marketplace.seller.banned',
}
const STATUSES: MarketplaceSellerStatus[] = ['pending', 'active', 'suspended', 'banned']
const OWNERS = ['guru@demo.test', 'adminsekolah@demo.test', 'pelajar@demo.test', 'pelajarmaju@demo.test', 'pelajar2@demo.test', 'guruadmin@demo.test']

beforeAll(async () => {
  t = await bootAdminApp()
  admin = await clientAs(t, ACCOUNTS.admin)
  student = await clientAs(t, ACCOUNTS.student)
}, 120_000)
afterAll(async () => {
  await t.close()
})

let ownerIndex = 0
const newSeller = (status: string, shopName: string, verified = false) => {
  const owner = OWNERS[ownerIndex++]
  if (!owner) throw new Error('out of demo owners')
  return insertSeller(t, owner, status, shopName, verified)
}
const reset = async () => {
  await t.db.query(`delete from marketplace_products where seller_id <> 1`)
  await t.db.query(`delete from marketplace_sellers where id <> 1`)
  ownerIndex = 0
}
const act = (id: string, action: MarketplaceSellerAction) => admin.post(`${BASE}/sellers/${id}/${action}`)
const statusOf = async (id: string) => (await t.db.query<{ status: string; verified: boolean }>(`select status, verified_at is not null as verified from marketplace_sellers where id = $1`, [id]))[0]!

describe('list, detail, options and global stats', () => {
  const ids: Record<string, string> = {}
  beforeAll(async () => {
    ids.pending = await newSeller('pending', 'Kedai Pending')
    ids.suspended = await newSeller('suspended', 'Kedai Digantung')
    ids.banned = await newSeller('banned', 'Kedai Diharamkan')
  })

  it('lists sellers with global stat cards that ignore the filter', async () => {
    const all = MarketplaceAdminSellerListResponseSchema.parse((await admin.get(`${BASE}/sellers`)).body)
    expect(all.meta).toMatchObject({ totalItems: 4, stats: { total: 4, active: 1, pending: 1 } })
    const pending = MarketplaceAdminSellerListResponseSchema.parse((await admin.get(`${BASE}/sellers?status=pending`)).body)
    expect(pending.data.map((s) => s.shopName)).toEqual(['Kedai Pending'])
    expect(pending.meta.totalItems).toBe(1)
    expect(pending.meta.stats).toEqual({ total: 4, active: 1, pending: 1 })
    expect(MarketplaceAdminSellerListResponseSchema.parse((await admin.get(`${BASE}/sellers?status=`)).body).meta.totalItems).toBe(4)
    expect(MarketplaceAdminSellerListResponseSchema.parse((await admin.get(`${BASE}/sellers?status=banned`)).body).data).toHaveLength(1)
    expectError(await admin.get(`${BASE}/sellers?status=Aktif`), 422, 'VALIDATION_ERROR')
  })

  it('a row has the product count, a masked owner and the allowed actions', async () => {
    const list = MarketplaceAdminSellerListResponseSchema.parse((await admin.get(`${BASE}/sellers?status=active`)).body)
    const shop = list.data[0]!
    expect(shop).toMatchObject({ shopName: 'JomBelajar Official', initial: 'J', status: 'active', verified: true, productCount: 10, actions: ['suspend', 'ban'] })
    expect(shop.ownerMasked).toMatch(/^[A-Z]\*\*\*( [A-Z]\*\*\*)*$/)
    const pending = MarketplaceAdminSellerListResponseSchema.parse((await admin.get(`${BASE}/sellers?status=pending`)).body).data[0]!
    expect(pending.actions).toEqual(['approve', 'ban'])
    const banned = MarketplaceAdminSellerListResponseSchema.parse((await admin.get(`${BASE}/sellers?status=banned`)).body).data[0]!
    expect(banned.actions).toEqual([])
  })

  it('the owner is masked in the seller list and the detail (never the full account name)', async () => {
    const ownerName = async (id: string) =>
      (await t.db.query<{ name: string }>(`select u.name from marketplace_sellers s join users u on u.id = s.user_id where s.id = $1`, [id]))[0]!.name
    const mask = (name: string) => name.trim().split(/\s+/).map((w) => `${Array.from(w)[0]}***`).join(' ')
    const id = ids.pending!
    const full = await ownerName(id)
    const expected = mask(full)
    expect(expected).not.toBe(full)
    const row = MarketplaceAdminSellerListResponseSchema.parse((await admin.get(`${BASE}/sellers?status=pending`)).body).data.find((s) => s.id === id)!
    expect(row.ownerMasked).toBe(expected)
    const detail = MarketplaceAdminSellerResponseSchema.parse((await admin.get(`${BASE}/sellers/${id}`)).body).data
    expect(detail.ownerMasked).toBe(expected)
    for (const w of full.split(/\s+/).filter((x) => x.length > 1)) {
      expect(JSON.stringify(row)).not.toContain(w)
      expect(JSON.stringify(detail)).not.toContain(w)
    }
  })

  it('detail "Semak Penjual"; unknown and non-numeric ids are 404', async () => {
    const d = MarketplaceAdminSellerResponseSchema.parse((await admin.get(`${BASE}/sellers/${ids.pending}`)).body).data
    expect(d).toMatchObject({ shopName: 'Kedai Pending', description: 'Penerangan ujian', phone: '0111111111', whatsapp: '60111111111', verifiedAt: null, whatsappClicks: 0 })
    expectError(await admin.get(`${BASE}/sellers/999999`), 404, 'NOT_FOUND')
    expectError(await admin.get(`${BASE}/sellers/abc`), 404, 'NOT_FOUND')
  })

  it('seller options: the official seller first, then active sellers only', async () => {
    const o = MarketplaceAdminSellerOptionsResponseSchema.parse((await admin.get(`${BASE}/seller-options`)).body).data
    expect(o).toEqual([
      { id: null, label: 'PRESTASIPLUS Official (Admin)' },
      { id: '1', label: 'JomBelajar Official' },
    ])
  })
})

describe('transitions: every status times every action', () => {
  const cases = STATUSES.flatMap((from) =>
    MARKETPLACE_SELLER_ACTIONS.map((action) => {
      const rule = MARKETPLACE_SELLER_TRANSITIONS[action]
      const legal = rule.from.includes(from)
      return { from, action, legal, to: rule.to }
    }),
  )

  it.each(cases)('$action from $from: legal=$legal', async ({ from, action, legal, to }) => {
    // Sellers are owned by distinct users and the demo set is small, so each case reuses a fresh owner after clearing.
    await reset()
    const id = await newSeller(from, `Kedai ${from} ${action}`)
    const auditBefore = (await auditRows(t, AUDIT[action])).length
    const res = await act(id, action)
    const after = await statusOf(id)
    if (legal) {
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const body = MarketplaceAdminSellerResponseSchema.parse(res.body).data
      expect(body.status).toBe(to)
      expect(after.status).toBe(to)
      expect(after.verified).toBe(action === 'verify')
      const rows = await auditRows(t, AUDIT[action])
      expect(rows).toHaveLength(auditBefore + 1)
      expect(rows.at(-1)).toMatchObject({ target_type: 'marketplace_seller', target_id: id, detail: { statusFrom: from, statusTo: to } })
    } else {
      expectError(res, 409, 'CONFLICT', 'Perubahan status ini tidak dibenarkan daripada status semasa.')
      expect(after).toEqual({ status: from, verified: false })
      expect(await auditRows(t, AUDIT[action])).toHaveLength(auditBefore)
    }
  })

  it('the decision-6 table in words', () => {
    const ok = (from: MarketplaceSellerStatus, a: MarketplaceSellerAction) => MARKETPLACE_SELLER_TRANSITIONS[a].from.includes(from)
    expect(ok('pending', 'approve') && ok('suspended', 'approve') && !ok('active', 'approve') && !ok('banned', 'approve')).toBe(true)
    expect(STATUSES.filter((s) => ok(s, 'ban'))).toEqual(['pending', 'active', 'suspended'])
    expect(STATUSES.filter((s) => ok(s, 'verify'))).toEqual(['active'])
    expect(STATUSES.filter((s) => ok(s, 'suspend'))).toEqual(['active'])
    expect(MARKETPLACE_SELLER_ACTIONS.some((a) => ok('banned', a))).toBe(false)
  })

  it('Sahkan sets verified_at once; a second Sahkan is 409 and does not move it', async () => {
    await reset()
    const id = await newSeller('active', 'Kedai Sahkan')
    const first = await act(id, 'verify')
    expect(first.status).toBe(200)
    expect(first.body.data.verified).toBe(true)
    const stamp = (await t.db.query<{ v: string }>(`select verified_at::text as v from marketplace_sellers where id = $1`, [id]))[0]!.v
    expectError(await act(id, 'verify'), 409, 'CONFLICT')
    expect((await t.db.query<{ v: string }>(`select verified_at::text as v from marketplace_sellers where id = $1`, [id]))[0]!.v).toBe(stamp)
    expect(first.body.data.actions).toEqual(['suspend', 'ban'])
  })

  it('Gantung and Haramkan take the products off the pupil Marketplace at once; Luluskan brings them back', async () => {
    const visible = async () => (await student.get('/api/marketplace/sellers/1')).status
    expect(await visible()).toBe(200)
    expect((await act('1', 'suspend')).status).toBe(200)
    expect(await visible()).toBe(404)
    expect((await student.get('/api/marketplace/products?q=Beg Sekolah Anti-Air')).body.data).toHaveLength(0)
    expect((await act('1', 'approve')).status).toBe(200)
    expect(await visible()).toBe(200)
    expect((await student.get('/api/marketplace/products?q=Beg Sekolah Anti-Air')).body.data).toHaveLength(1)
  })

  it('Haramkan is terminal: every action afterwards is 409, and the products stay hidden', async () => {
    await reset()
    const id = await newSeller('active', 'Kedai Haram')
    await t.db.query(`insert into marketplace_products (seller_id, name, slug, category_id, price, condition, stock_status, status, shipping_method) values ($1, 'Produk Haram', 'produk-haram-aaaaa', 1, 5, 'new', 'available', 'active', 'pickup')`, [id])
    expect((await student.get('/api/marketplace/products?q=Produk Haram')).body.data).toHaveLength(1)
    expect((await act(id, 'ban')).status).toBe(200)
    expect((await student.get('/api/marketplace/products?q=Produk Haram')).body.data).toHaveLength(0)
    for (const a of MARKETPLACE_SELLER_ACTIONS) expectError(await act(id, a), 409, 'CONFLICT')
    expect((await statusOf(id)).status).toBe('banned')
  })

  it('two parallel Haramkan: exactly one wins, one audit row', async () => {
    await reset()
    const id = await newSeller('active', 'Kedai Selari')
    const before = (await auditRows(t, AUDIT.ban)).length
    const [a, b] = await Promise.all([act(id, 'ban'), act(id, 'ban')])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(await auditRows(t, AUDIT.ban)).toHaveLength(before + 1)
  })

  it('unknown and non-numeric seller ids are 404; the admin audit actor is recorded', async () => {
    expectError(await act('999999', 'ban'), 404, 'NOT_FOUND')
    expectError(await act('abc', 'approve'), 404, 'NOT_FOUND')
    const actor = (await t.db.query<{ id: string }>(`select id::text from users where lower(email) = 'admin@demo.test'`))[0]!.id
    expect((await auditRows(t, AUDIT.ban))[0]!.actor_user_id).toBe(actor)
    expect(await count(t.db, `select count(*) as n from audit_events where action like 'marketplace.seller.%' and actor_user_id is null`)).toBe(0)
  })
})
