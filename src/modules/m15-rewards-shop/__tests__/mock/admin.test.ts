/**
 * M15-T1 admin endpoints #1–#8 (SRS M15 v1.4 §6.7, §6.8, §7; BR-M15-02, 04, 08–11, 14, 15, 24):
 * the seed values, the catalogue list and cards, create / edit / bulk, the redemption queue and its
 * deliver / cancel transitions. Every test starts from a fresh seed.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { wallet } from '@/modules/m14-gamification/mock'

import type {
  CancelResult,
  DeliverResult,
  HadiahBulkResult,
  HadiahListItem,
  HadiahListMeta,
  HadiahReward,
  RedemptionListItem,
  RedemptionListMeta,
} from '../../api/types'
import { hadiah } from '../../mock'
import { m15Hooks } from '../../mock/hooks'
import {
  ADMIN,
  bootM15,
  callAs,
  codeOf,
  GURU,
  PELAJAR,
  type Call,
  type ErrorBody,
  type ListBody,
} from './helpers'

let runtime: MockRuntime
let call: Call

beforeAll(async () => {
  runtime = await bootM15()
  call = callAs(runtime)
}, 120_000)

beforeEach(async () => {
  await runtime.reset()
})

type Rewards = ListBody<HadiahListItem, HadiahListMeta>
type Queue = ListBody<RedemptionListItem, RedemptionListMeta>

const MINIMAL = {
  category: 'gaming',
  vendor: 'Vendor',
  title: 'Hadiah Ujian',
  denominationRm: 5,
  tokenCost: 5,
}

describe('seed (§6.7, §6.8)', () => {
  it('has the 59 observed rewards, all Off, with the observed per-category counts', () => {
    expect(hadiah.cards()).toEqual({
      total: 59,
      active: 0,
      redemptionsThisMonth: 0,
      pendingAdmin: 0,
    })
    const counts: Record<string, number> = {}
    for (const r of hadiah.list()) {
      counts[r.category] = (counts[r.category] ?? 0) + 1
      expect(r.isActive).toBe(false)
      expect(r.deliveryMethod).toBe('manual')
      expect(r.tokenCost).toBe(r.denominationRm)
      expect(r.vendorSku).toBeNull()
      expect(r.imageUrl).toBeNull()
    }
    expect(counts).toEqual({
      flagship: 4,
      ewallet: 8,
      telco: 11,
      gaming: 8,
      streaming: 6,
      food_beverage: 8,
      ecommerce: 5,
      education: 6,
      entertainment: 3,
    })
    const all = hadiah.list()
    expect(all.filter((r) => r.requiresParentConsent).map((r) => r.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 56, 57, 58, 59,
    ])
    expect(all.filter((r) => r.stockQuantity !== null)).toHaveLength(19)
    expect(all.filter((r) => r.maxPerMonthPerStudent !== null)).toHaveLength(25)
    expect(new Set(all.map((r) => r.displayOrder)).size).toBe(59)
  })

  it('has the 3 observed cancelled redemptions, newest first (3, 2, 1)', () => {
    expect(hadiah.queue('all').map((r) => r.id)).toEqual([3, 2, 1])
    expect(hadiah.queue('cancelled')).toHaveLength(3)
    expect(hadiah.queue('pending_admin')).toHaveLength(0)
    expect(hadiah.historyCount(16)).toBe(2)
    expect(hadiah.historyCount(10)).toBe(1)
    expect(hadiah.redemptionCountOf(10)).toBe(0)
    expect(hadiah.redemptionCountOf(16)).toBe(0)
  })
})

describe('guards', () => {
  it.each([
    ['GET', '/api/admin/hadiah'],
    ['GET', '/api/admin/hadiah/1'],
    ['GET', '/api/admin/hadiah/redemptions'],
    ['POST', '/api/admin/hadiah/bulk'],
    ['POST', '/api/admin/hadiah/redemptions/1/cancel'],
  ] as const)('%s %s: guest 401, student and teacher 403', async (method, url) => {
    expect((await call(method, url, null)).status).toBe(401)
    expect((await call(method, url, PELAJAR)).status).toBe(403)
    expect((await call(method, url, GURU)).status).toBe(403)
  })
})

describe('#1 catalogue list', () => {
  it('pages by 50 in displayOrder then id, with the four cards', async () => {
    const p1 = await call<Rewards>('GET', '/api/admin/hadiah', ADMIN)
    expect(p1.status).toBe(200)
    expect(p1.body.data).toHaveLength(50)
    expect(p1.body.data[0]).toMatchObject({
      id: 1,
      categoryLabel: '🎮 Permainan',
      title: 'Roblox Gift Card RM10',
      iconEmoji: '🎮',
      stockQuantity: null,
      redemptionCount: 0,
      isActive: false,
    })
    expect(p1.body.meta).toMatchObject({
      page: 1,
      pageSize: 50,
      totalItems: 59,
      totalPages: 2,
      from: 1,
      to: 50,
      activeCat: 'all',
      cards: { total: 59, active: 0, redemptionsThisMonth: 0, pendingAdmin: 0 },
    })
    const p2 = await call<Rewards>('GET', '/api/admin/hadiah?page=2', ADMIN)
    expect(p2.body.data.map((r) => r.id)).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59])
    expect(p2.body.meta).toMatchObject({ from: 51, to: 59 })
  })

  it('a page beyond the last has no rows and from/to null (BR-M15-02)', async () => {
    const r = await call<Rewards>('GET', '/api/admin/hadiah?page=9', ADMIN)
    expect(r.body.data).toEqual([])
    expect(r.body.meta).toMatchObject({ from: null, to: null, totalItems: 59 })
  })

  it('filters by category; the cards do not follow the filter; an unknown key lists nothing', async () => {
    const telco = await call<Rewards>('GET', '/api/admin/hadiah?cat=telco', ADMIN)
    expect(telco.body.data).toHaveLength(11)
    expect(telco.body.data[0]).toMatchObject({
      id: 9,
      categoryLabel: '📱 Tambah Nilai Telekomunikasi',
      stockQuantity: 5,
    })
    expect(telco.body.meta).toMatchObject({ activeCat: 'telco', totalItems: 11 })
    expect(telco.body.meta.cards.total).toBe(59)
    const all = await call<Rewards>('GET', '/api/admin/hadiah?cat=all', ADMIN)
    expect(all.body.meta.activeCat).toBe('all')
    const bogus = await call<Rewards>('GET', '/api/admin/hadiah?cat=bogus', ADMIN)
    expect(bogus.status).toBe(200)
    expect(bogus.body.data).toEqual([])
    expect(bogus.body.meta).toMatchObject({ activeCat: null, totalItems: 0 })
  })
})

describe('#2–#4 create and edit', () => {
  it('creates with the BR-M15-13 defaults and id 60; deleted ids are never reused', async () => {
    const created = await call<{ data: HadiahReward }>('POST', '/api/admin/hadiah', ADMIN, MINIMAL)
    expect(created.status).toBe(201)
    expect(created.body.data).toMatchObject({
      id: 60,
      voucherValidityDays: 365,
      deliveryMethod: 'manual',
      displayOrder: 100,
      isActive: true,
      requiresParentConsent: false,
      stockQuantity: null,
      maxPerMonthPerStudent: null,
      description: null,
    })
    const del = await call<{ data: HadiahBulkResult }>('POST', '/api/admin/hadiah/bulk', ADMIN, {
      action: 'delete',
      ids: [60],
    })
    expect(del.body.data).toEqual({ affected: 1, keptIds: [] })
    const again = await call<{ data: HadiahReward }>('POST', '/api/admin/hadiah', ADMIN, MINIMAL)
    expect(again.body.data.id).toBe(61)
  })

  it('accepts digit strings for numbers and rejects bad input with 422 fields', async () => {
    const ok = await call<{ data: HadiahReward }>('POST', '/api/admin/hadiah', ADMIN, {
      ...MINIMAL,
      denominationRm: '10',
      tokenCost: '12',
      stockQuantity: '3',
    })
    expect(ok.status).toBe(201)
    expect(ok.body.data).toMatchObject({ denominationRm: 10, tokenCost: 12, stockQuantity: 3 })

    const bad = await call<ErrorBody>('POST', '/api/admin/hadiah', ADMIN, {
      category: 'nope',
      title: 'x'.repeat(201),
      denominationRm: 0,
      tokenCost: 10001,
      maxPerMonthPerStudent: 100,
      voucherValidityDays: 1826,
      displayOrder: 10000,
      imageUrl: 'ftp://x',
    })
    expect(bad.status).toBe(422)
    expect(Object.keys(bad.body.error.fields ?? {}).sort()).toEqual(
      [
        'category',
        'denominationRm',
        'displayOrder',
        'imageUrl',
        'maxPerMonthPerStudent',
        'title',
        'tokenCost',
        'vendor',
        'voucherValidityDays',
      ].sort(),
    )
    expect(hadiah.cards().total).toBe(60)
  })

  it('reads and replaces a reward; unknown ids are 404', async () => {
    const got = await call<{ data: HadiahReward }>('GET', '/api/admin/hadiah/9', ADMIN)
    expect(got.body.data).toMatchObject({
      id: 9,
      vendor: 'Hotlink',
      stockQuantity: 5,
      requiresParentConsent: false,
    })
    const put = await call<{ data: HadiahReward }>('PUT', '/api/admin/hadiah/9', ADMIN, {
      ...MINIMAL,
      title: 'Hotlink Baru',
      isActive: true,
    })
    expect(put.status).toBe(200)
    expect(put.body.data).toMatchObject({
      id: 9,
      title: 'Hotlink Baru',
      isActive: true,
      description: null,
    })
    expect((await call('GET', '/api/admin/hadiah/9999', ADMIN)).status).toBe(404)
    expect((await call('PUT', '/api/admin/hadiah/9999', ADMIN, MINIMAL)).status).toBe(404)
    expect(codeOf(await call('PUT', '/api/admin/hadiah/9', ADMIN, {}))).toBe('VALIDATION_ERROR')
  })
})

describe('#5 bulk actions (BR-M15-11, BR-M15-24)', () => {
  const bulk = (body: unknown) =>
    call<{ data: HadiahBulkResult }>('POST', '/api/admin/hadiah/bulk', ADMIN, body)

  it('activates and deactivates; unknown ids are ignored', async () => {
    const on = await bulk({ action: 'activate', ids: [1, 2, 9999] })
    expect(on.body.data).toEqual({ affected: 2 })
    expect(hadiah.cards().active).toBe(2)
    await bulk({ action: 'deactivate', ids: [1] })
    expect(hadiah.cards().active).toBe(1)
  })

  it('sets stock ("" = unlimited) and the monthly cap ("" and "0" = none)', async () => {
    await bulk({ action: 'set_stock', ids: [1], stockValue: '7' })
    expect(hadiah.get(1)?.stockQuantity).toBe(7)
    await bulk({ action: 'set_stock', ids: [1], stockValue: '' })
    expect(hadiah.get(1)?.stockQuantity).toBeNull()
    await bulk({ action: 'set_max_per_month', ids: [1], maxPerMonthValue: '5' })
    expect(hadiah.get(1)?.maxPerMonthPerStudent).toBe(5)
    await bulk({ action: 'set_max_per_month', ids: [1], maxPerMonthValue: '0' })
    expect(hadiah.get(1)?.maxPerMonthPerStudent).toBeNull()
    for (const bad of [
      { action: 'set_stock', stockValue: '1000000' },
      { action: 'set_stock', stockValue: '-1' },
      { action: 'set_stock', stockValue: '1.5' },
      { action: 'set_max_per_month', maxPerMonthValue: '100' },
    ]) {
      expect((await bulk({ ...bad, ids: [1] })).status).toBe(422)
    }
  })

  it('adjusts the token cost by parseInt(text) percent, half up, clamped (denomination unchanged)', async () => {
    await bulk({ action: 'set_token_cost', ids: [1, 9], tokenCostDeltaPct: '+50' })
    expect(hadiah.get(1)).toMatchObject({ tokenCost: 15, denominationRm: 10 })
    expect(hadiah.get(9)?.tokenCost).toBe(8) // 5 x 1.5 = 7.5 -> 8
    await bulk({ action: 'set_token_cost', ids: [4], tokenCostDeltaPct: '-25' })
    expect(hadiah.get(4)?.tokenCost).toBe(4) // 3.75 -> 4
    await bulk({ action: 'set_token_cost', ids: [5], tokenCostDeltaPct: '12.7' })
    expect(hadiah.get(5)?.tokenCost).toBe(11) // parseInt -> 12; 11.2 -> 11
    await bulk({ action: 'set_token_cost', ids: [2], tokenCostDeltaPct: '50%' })
    expect(hadiah.get(2)?.tokenCost).toBe(75)
    await bulk({ action: 'set_token_cost', ids: [3], tokenCostDeltaPct: '-90' })
    expect(hadiah.get(3)?.tokenCost).toBe(10)
    await bulk({ action: 'set_token_cost', ids: [57], tokenCostDeltaPct: '500' })
    expect(hadiah.get(57)?.tokenCost).toBe(6000)
    for (const bad of ['abc', '0', '', '-91', '501', '-0']) {
      const r = await bulk({ action: 'set_token_cost', ids: [1], tokenCostDeltaPct: bad })
      expect(r.status).toBe(422)
    }
  })

  it('rejects an unknown action and empty or invalid ids', async () => {
    expect((await bulk({ action: 'explode', ids: [1] })).status).toBe(422)
    expect((await bulk({ action: 'activate', ids: [] })).status).toBe(422)
    expect((await bulk({ action: 'activate' })).status).toBe(422)
    expect((await bulk({ action: 'activate', ids: ['x'] })).status).toBe(422)
  })

  it('deletes rewards without redemptions and keeps those with any (ids 10 and 16)', async () => {
    const created = await call<{ data: HadiahReward }>('POST', '/api/admin/hadiah', ADMIN, MINIMAL)
    const r = await bulk({ action: 'delete', ids: [10, 16, created.body.data.id, 1] })
    expect(r.body.data).toEqual({ affected: 2, keptIds: [10, 16] })
    expect(hadiah.get(10)).toBeDefined()
    expect(hadiah.get(16)).toBeDefined()
    expect(hadiah.get(1)).toBeUndefined()
    expect(hadiah.get(created.body.data.id)).toBeUndefined()
  })
})

describe('#6 redemption queue (BR-M15-15)', () => {
  const queue = (q = '') => call<Queue>('GET', `/api/admin/hadiah/redemptions${q}`, ADMIN)

  it('defaults to pending_admin (empty on the default seed); cancelled lists the 3 seeded rows', async () => {
    const d = await queue()
    expect(d.body.data).toEqual([])
    expect(d.body.meta).toMatchObject({ activeStatus: 'pending_admin', totalItems: 0 })
    const c = await queue('?status=cancelled')
    expect(c.body.data.map((r) => r.id)).toEqual([3, 2, 1])
    expect(c.body.data[0]).toMatchObject({
      rewardTitle: 'Hotlink Topup RM10',
      rewardVendor: 'Hotlink',
      denominationRm: 10,
      tokenCost: 10,
      status: 'cancelled',
      createdAt: '2026-04-30T14:11:00+08:00',
    })
    expect(c.body.data[0]?.user.id).toBe(3151)
    expect(c.body.data[0]?.user.name).not.toBe('')
    expect(c.body.meta.activeStatus).toBe('cancelled')
    const u = await queue('?status=bogus')
    expect(u.status).toBe(200)
    expect(u.body.data).toEqual([])
    expect(u.body.meta.activeStatus).toBeNull()
  })

  it('shows the queue fixture: all rows newest first, counts and cards follow', async () => {
    m15Hooks.m15LoadFixture('queue')
    m15Hooks.m15LoadFixture('queue') // idempotent
    const all = await queue('?status=all')
    expect(all.body.data.map((r) => r.id)).toEqual([15102, 15101, 15103, 3, 2, 1])
    expect((await queue()).body.data.map((r) => r.id)).toEqual([15101])
    expect(hadiah.cards()).toEqual({
      total: 59,
      active: 0,
      redemptionsThisMonth: 3,
      pendingAdmin: 1,
    })
    expect(hadiah.redemptionCountOf(40)).toBe(1)
    expect(hadiah.redemptionCountOf(1)).toBe(1)
    expect(hadiah.redemptionCountOf(26)).toBe(1)
    expect(hadiah.get(40)?.stockQuantity).toBe(4)
    expect(wallet.summary(2).tokenBalance).toBe(20)
    expect(wallet.summary(4).tokenBalance).toBe(15)
  })
})

describe('#7 deliver, #8 cancel (BR-M15-08…10)', () => {
  beforeEach(() => {
    m15Hooks.m15LoadFixture('queue')
  })

  it('delivers a pending_admin row: trimmed code, deliveredAt now, expiresAt = now + validity days', async () => {
    const r = await call<{ data: DeliverResult }>(
      'POST',
      '/api/admin/hadiah/redemptions/15101/deliver',
      ADMIN,
      { code: '  ABC-123  ' },
    )
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({
      id: 15101,
      status: 'delivered',
      deliveredAt: '2026-09-25T15:40:00+08:00',
      expiresAt: '2027-09-25T15:40:00+08:00', // reward 40: 365 days
    })
    expect(hadiah.getRedemption(15101)?.voucherCode).toBe('ABC-123')
    expect((await call('GET', '/api/admin/hadiah/redemptions', ADMIN)).status).toBe(200)
  })

  it('refuses a second delivery or a wrong state (409 CONFLICT), a bad code (422), an unknown id (404)', async () => {
    const url = (id: number) => `/api/admin/hadiah/redemptions/${String(id)}/deliver`
    expect((await call('POST', url(15101), ADMIN, { code: 'A' })).status).toBe(200)
    expect(codeOf(await call('POST', url(15101), ADMIN, { code: 'B' }))).toBe('CONFLICT')
    expect((await call('POST', url(15102), ADMIN, { code: 'B' })).status).toBe(409)
    expect((await call('POST', url(15103), ADMIN, { code: 'B' })).status).toBe(409)
    expect((await call('POST', url(3), ADMIN, { code: 'B' })).status).toBe(409)
    expect((await call('POST', url(15101), ADMIN, { code: '   ' })).status).toBe(422)
    expect((await call('POST', url(15101), ADMIN, { code: 'x'.repeat(101) })).status).toBe(422)
    expect((await call('POST', url(777), ADMIN, { code: 'A' })).status).toBe(404)
  })

  it('cancels once: tokens refunded to the student, reserved stock released', async () => {
    const r = await call<{ data: CancelResult }>(
      'POST',
      '/api/admin/hadiah/redemptions/15101/cancel',
      ADMIN,
    )
    expect(r.body.data).toEqual({ id: 15101, status: 'cancelled', refundedTokens: 10 })
    expect(wallet.summary(2).tokenBalance).toBe(30)
    expect(hadiah.get(40)?.stockQuantity).toBe(5)
    const row = hadiah.getRedemption(15101)
    expect(row).toMatchObject({ status: 'cancelled', cancelledBy: 'admin', stockReserved: false })
    expect(row?.cancelledAt).toBe('2026-09-25T15:40:00+08:00')
    expect(codeOf(await call('POST', '/api/admin/hadiah/redemptions/15101/cancel', ADMIN))).toBe(
      'CONFLICT',
    )
    expect(wallet.summary(2).tokenBalance).toBe(30)
    // a pending_parent_consent row is the parent's to decide, not the admin's
    expect((await call('POST', '/api/admin/hadiah/redemptions/15102/cancel', ADMIN)).status).toBe(
      409,
    )
    expect((await call('POST', '/api/admin/hadiah/redemptions/777/cancel', ADMIN)).status).toBe(404)
  })
})
