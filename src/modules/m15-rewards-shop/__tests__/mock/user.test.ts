/**
 * M15-T1 endpoints #9–#16 and #19–#20 (SRS M15 v1.6 §6.8, §6.9, §7; BR-M15-05…09, 17…20, 26…28):
 * the redemption rule over the M14 wallet, the mystery box, the draws, the parent consent and the
 * L43 digital-shop reads. Every test starts from a fresh seed.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { coinLedger, draws, wallet } from '@/modules/m14-gamification/mock'

import type {
  ApproveResult,
  CabutanView,
  CancelResult,
  DigitalItemsMeta,
  MysteryBoxOpened,
  MysteryBoxesView,
  ParentApprovalsView,
  RedeemResult,
  TicketBought,
} from '../../api/types'
import { hadiah, mysteryBox } from '../../mock'
import { m15Hooks } from '../../mock/hooks'
import {
  ADMIN,
  bootM15,
  callAs,
  codeOf,
  IBU_BAPA,
  IBU_BAPA_TANPA_ANAK,
  PELAJAR,
  PELAJAR_4,
  type Call,
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

const redeem = (userId: number, rewardId: number) => m15Hooks.m15Redeem({ userId, rewardId })

describe('#9 redemption rule (BR-M15-05…07, hook m15Redeem)', () => {
  it('refuses an inactive or unknown reward with NOT_FOUND and changes nothing', () => {
    wallet.setFields(PELAJAR, { tokens: 100 })
    expect(redeem(PELAJAR, 9)).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(redeem(PELAJAR, 9999)).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(wallet.summary(PELAJAR).tokenBalance).toBe(100)
    expect(hadiah.redemptionTotal()).toBe(3)
  })

  it('refuses in the order OUT_OF_STOCK, MONTHLY_CAP, INSUFFICIENT_TOKENS', () => {
    m15Hooks.m15SetReward(9, { isActive: true, stockQuantity: 0 })
    expect(redeem(PELAJAR, 9)).toMatchObject({ ok: false, code: 'OUT_OF_STOCK' })

    m15Hooks.m15SetReward(26, { isActive: true, maxPerMonthPerStudent: 1 })
    wallet.setFields(PELAJAR, { tokens: 100 })
    expect(redeem(PELAJAR, 26)).toMatchObject({ ok: true })
    expect(redeem(PELAJAR, 26)).toMatchObject({ ok: false, code: 'MONTHLY_CAP' })

    m15Hooks.m15SetReward(36, { isActive: true }) // RM100
    expect(redeem(PELAJAR, 36)).toMatchObject({ ok: false, code: 'INSUFFICIENT_TOKENS' })
    expect(wallet.summary(PELAJAR).tokenBalance).toBe(90)
    expect(hadiah.redemptionTotal()).toBe(4)
  })

  it('redeems atomically: tokens debited, stock decremented and reserved, snapshot stored', () => {
    m15Hooks.m15SetReward(9, { isActive: true }) // Hotlink RM5, stock 5, no cap, no consent
    wallet.setFields(PELAJAR, { tokens: 8 })
    const r = redeem(PELAJAR, 9)
    expect(r).toMatchObject({ ok: true, data: { status: 'pending_admin', tokenBalance: 3 } })
    const id = (r as { data: RedeemResult }).data.id
    expect(id).toBeGreaterThanOrEqual(9_000_001)
    expect(hadiah.get(9)?.stockQuantity).toBe(4)
    expect(hadiah.getRedemption(id)).toMatchObject({
      userId: PELAJAR,
      rewardId: 9,
      rewardTitle: 'Hotlink Topup RM5',
      rewardVendor: 'Hotlink',
      rewardIcon: '📱',
      denominationRm: 5,
      tokenCost: 5,
      stockReserved: true,
    })
    expect(hadiah.cards()).toMatchObject({ redemptionsThisMonth: 1, pendingAdmin: 1 })
    // A later price change does not alter the stored snapshot (BR-M15-06).
    m15Hooks.m15SetReward(9, { tokenCost: 50, title: 'Berubah' })
    expect(hadiah.getRedemption(id)).toMatchObject({
      tokenCost: 5,
      rewardTitle: 'Hotlink Topup RM5',
    })
  })

  it('starts at pending_parent_consent when the reward requires consent; unlimited stock is not reserved', () => {
    m15Hooks.m15SetReward(1, { isActive: true }) // Roblox RM10, consent, stock null
    wallet.setFields(PELAJAR_4, { tokens: 10 })
    const r = redeem(PELAJAR_4, 1)
    expect(r).toMatchObject({
      ok: true,
      data: { status: 'pending_parent_consent', tokenBalance: 0 },
    })
    expect(hadiah.getRedemption((r as { data: RedeemResult }).data.id)?.stockReserved).toBe(false)
    expect(hadiah.get(1)?.stockQuantity).toBeNull()
  })

  it('serves the endpoint to any logged-in user (guest 401, bad body 422)', async () => {
    m15Hooks.m15SetReward(9, { isActive: true })
    wallet.setFields(PELAJAR, { tokens: 5 })
    expect((await call('POST', '/api/hadiah/redemptions', null, { rewardId: 9 })).status).toBe(401)
    expect((await call('POST', '/api/hadiah/redemptions', PELAJAR, {})).status).toBe(422)
    const r = await call<{ data: RedeemResult }>('POST', '/api/hadiah/redemptions', PELAJAR, {
      rewardId: 9,
    })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({ status: 'pending_admin', tokenBalance: 0 })
    const again = await call('POST', '/api/hadiah/redemptions', PELAJAR, { rewardId: 9 })
    expect(again.status).toBe(409)
    expect(codeOf(again)).toBe('INSUFFICIENT_TOKENS')
    expect(
      codeOf(await call('POST', '/api/hadiah/redemptions', PELAJAR, { rewardId: 12345 })),
    ).toBe('NOT_FOUND')
  })
})

describe('#10, #11 mystery box (BR-M15-17, BR-M15-18)', () => {
  it('lists the four observed boxes with the viewer token balance and no history', async () => {
    wallet.setFields(PELAJAR, { tokens: 7 })
    const r = await call<{ data: MysteryBoxesView }>(
      'GET',
      '/api/gamification/mystery-boxes',
      PELAJAR,
    )
    expect(r.status).toBe(200)
    expect(r.body.data.tokenBalance).toBe(7)
    expect(r.body.data.history).toEqual([])
    expect(
      r.body.data.boxes.map((b) => [b.id, b.name, b.costTokens, b.coinMin, b.coinMax]),
    ).toEqual([
      [1, 'Kotak Gangsa', 2, 1, 20],
      [2, 'Kotak Perak', 5, 10, 50],
      [3, 'Kotak Emas', 10, 25, 150],
      [4, 'Kotak Legenda', 25, 100, 500],
    ])
    expect((await call('GET', '/api/gamification/mystery-boxes', null)).status).toBe(401)
  })

  it('refuses below the cost (409 INSUFFICIENT_TOKENS) and an unknown box (404); nothing is written', async () => {
    wallet.setFields(PELAJAR, { tokens: 1 })
    const r = await call('POST', '/api/gamification/mystery-boxes/1/open', PELAJAR)
    expect(r.status).toBe(409)
    expect(codeOf(r)).toBe('INSUFFICIENT_TOKENS')
    expect((await call('POST', '/api/gamification/mystery-boxes/9/open', PELAJAR)).status).toBe(404)
    expect(wallet.summary(PELAJAR).tokenBalance).toBe(1)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(0)
  })

  it('opens a box: M14 debits tokens, credits coins with the ledger text and XP; the opening is stored', async () => {
    wallet.setFields(PELAJAR, { tokens: 30 })
    const before = wallet.summary(PELAJAR)
    m15Hooks.m15MysteryNext({ coins: 7, xp: 3 })
    const r = await call<{ data: MysteryBoxOpened }>(
      'POST',
      '/api/gamification/mystery-boxes/1/open',
      PELAJAR,
    )
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({
      boxId: 1,
      boxName: 'Kotak Gangsa',
      icon: '📦',
      coins: 7,
      xp: 3,
      tokenBalance: 28,
      syilingBalance: before.currentSyiling + 7,
    })
    const after = wallet.summary(PELAJAR)
    expect(after.xp).toBe(before.xp + 3)
    expect(
      coinLedger.forUser(PELAJAR).some((row) => row.description === 'Kotak Misteri: Kotak Gangsa'),
    ).toBe(true)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(1)
    const list = await call<{ data: MysteryBoxesView }>(
      'GET',
      '/api/gamification/mystery-boxes',
      PELAJAR,
    )
    expect(list.body.data.history).toEqual([
      {
        id: r.body.data.openingId,
        boxId: 1,
        boxName: 'Kotak Gangsa',
        coins: 7,
        xp: 3,
        createdAt: '2026-09-25T15:40:00+08:00',
      },
    ])
  })

  it('draws coins and xp inside the box ranges when no result is fixed, and lists at most 10', async () => {
    wallet.setFields(PELAJAR, { tokens: 1000 })
    for (let i = 0; i < 12; i++) {
      const r = await call<{ data: MysteryBoxOpened }>(
        'POST',
        '/api/gamification/mystery-boxes/4/open',
        PELAJAR,
      )
      expect(r.body.data.coins).toBeGreaterThanOrEqual(100)
      expect(r.body.data.coins).toBeLessThanOrEqual(500)
      expect(r.body.data.xp).toBeGreaterThanOrEqual(25)
      expect(r.body.data.xp).toBeLessThanOrEqual(100)
    }
    expect(wallet.summary(PELAJAR).tokenBalance).toBe(1000 - 12 * 25)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(12)
    const list = await call<{ data: MysteryBoxesView }>(
      'GET',
      '/api/gamification/mystery-boxes',
      PELAJAR,
    )
    expect(list.body.data.history).toHaveLength(10)
  })

  it('validates the hook input', () => {
    expect(() => m15Hooks.m15MysteryNext({ coins: 0, xp: 1 })).toThrow(RangeError)
    expect(() => m15Hooks.m15MysteryNext({ coins: 1, xp: -1 })).toThrow(RangeError)
  })
})

describe('#12, #13 Cabutan Bertuah over M14 draws (BR-M15-19)', () => {
  it('shows the syiling balance and no draw when none is open', async () => {
    const r = await call<{ data: CabutanView }>('GET', '/api/cabutan', PELAJAR)
    expect(r.status).toBe(200)
    expect(r.body.data.draws).toEqual([])
    expect(r.body.data.syilingBalance).toBe(wallet.summary(PELAJAR).currentSyiling)
    expect((await call('GET', '/api/cabutan', null)).status).toBe(401)
  })

  it('lists the fixture draw and sells tickets until a refusal; M14 debits the syiling', async () => {
    m15Hooks.m15LoadFixture('draw')
    m15Hooks.m15LoadFixture('draw') // idempotent
    expect(draws.list()).toHaveLength(1)
    wallet.setFields(PELAJAR, { syiling: 120 })
    const view = await call<{ data: CabutanView }>('GET', '/api/cabutan', PELAJAR)
    expect(view.body.data.syilingBalance).toBe(120)
    expect(view.body.data.draws).toEqual([
      {
        id: 1,
        title: 'Cabutan Demo',
        description: 'Cabutan ujian.',
        ticketCostSyiling: 50,
        maxTicketsPerStudent: 10,
        ticketsOwned: 0,
        closesAt: '2026-09-30',
        prizePool: [
          { label: 'Baucar Topup RM50', valueSen: 5000, qty: 1 },
          { label: 'Baucar RM5', valueSen: 500, qty: 10 },
        ],
      },
    ])
    const t1 = await call<{ data: TicketBought }>('POST', '/api/cabutan/1/tickets', PELAJAR)
    expect(t1.status).toBe(201)
    expect(t1.body.data).toEqual({ drawId: 1, ticketsOwned: 1, syilingBalance: 70 })
    expect(
      coinLedger.forUser(PELAJAR).some((row) => row.description === 'Tiket Cabutan: Cabutan Demo'),
    ).toBe(true)
    await call('POST', '/api/cabutan/1/tickets', PELAJAR)
    const poor = await call('POST', '/api/cabutan/1/tickets', PELAJAR)
    expect(poor.status).toBe(409)
    expect(codeOf(poor)).toBe('INSUFFICIENT_BALANCE')
    expect(wallet.summary(PELAJAR).currentSyiling).toBe(20)
    const open = await call<{ data: CabutanView }>('GET', '/api/cabutan', PELAJAR)
    expect(open.body.data.draws[0]?.ticketsOwned).toBe(2)
  })

  it('refuses a missing draw (DRAW_CLOSED) and the ticket cap (TICKET_LIMIT)', async () => {
    expect(codeOf(await call('POST', '/api/cabutan/77/tickets', PELAJAR))).toBe('DRAW_CLOSED')
    m15Hooks.m15LoadFixture('draw')
    wallet.setFields(PELAJAR, { syiling: 10_000 })
    for (let i = 0; i < 10; i++) {
      expect((await call('POST', '/api/cabutan/1/tickets', PELAJAR)).status).toBe(201)
    }
    const r = await call('POST', '/api/cabutan/1/tickets', PELAJAR)
    expect(r.status).toBe(409)
    expect(codeOf(r)).toBe('TICKET_LIMIT')
    expect(wallet.summary(PELAJAR).currentSyiling).toBe(10_000 - 500)
  })
})

describe('#14–#16 parent consent (BR-M15-20)', () => {
  beforeEach(() => {
    m15Hooks.m15LoadFixture('queue')
  })

  it("lists the linked children's pending requests and history, newest first", async () => {
    const r = await call<{ data: ParentApprovalsView }>(
      'GET',
      '/api/parent/hadiah-approvals',
      IBU_BAPA,
    )
    expect(r.status).toBe(200)
    expect(r.body.data.pending.map((p) => p.id)).toEqual([15102])
    expect(r.body.data.pending[0]).toMatchObject({
      child: { id: PELAJAR_4 },
      rewardTitle: 'Roblox Gift Card RM10',
      rewardIcon: '🎮',
      tokenCost: 10,
      status: 'pending_parent_consent',
    })
    expect(r.body.data.pending[0]?.child.name).not.toBe('')
    expect(r.body.data.history.map((p) => p.id)).toEqual([15101, 15103])
    expect((await call('GET', '/api/parent/hadiah-approvals', null)).status).toBe(401)
  })

  it('is empty for a parent without links, a student and the admin', async () => {
    for (const who of [IBU_BAPA_TANPA_ANAK, PELAJAR, ADMIN]) {
      const r = await call<{ data: ParentApprovalsView }>(
        'GET',
        '/api/parent/hadiah-approvals',
        who,
      )
      expect(r.body.data).toEqual({ pending: [], history: [] })
    }
  })

  it('approves: pending_parent_consent becomes pending_admin with the decision stored', async () => {
    const r = await call<{ data: ApproveResult }>(
      'POST',
      '/api/parent/hadiah-approvals/15102/approve',
      IBU_BAPA,
    )
    expect(r.body.data).toEqual({ id: 15102, status: 'pending_admin' })
    expect(hadiah.getRedemption(15102)).toMatchObject({
      status: 'pending_admin',
      parentDecisionBy: IBU_BAPA,
      parentDecidedAt: '2026-09-25T15:40:00+08:00',
    })
    expect(codeOf(await call('POST', '/api/parent/hadiah-approvals/15102/approve', IBU_BAPA))).toBe(
      'CONFLICT',
    )
    expect(codeOf(await call('POST', '/api/parent/hadiah-approvals/15102/reject', IBU_BAPA))).toBe(
      'CONFLICT',
    )
    expect(hadiah.cards().pendingAdmin).toBe(2)
  })

  it('rejects once: cancelled by the parent, the child gets the tokens back', async () => {
    const r = await call<{ data: CancelResult }>(
      'POST',
      '/api/parent/hadiah-approvals/15102/reject',
      IBU_BAPA,
    )
    expect(r.body.data).toEqual({ id: 15102, status: 'cancelled', refundedTokens: 10 })
    expect(wallet.summary(PELAJAR_4).tokenBalance).toBe(25)
    expect(hadiah.getRedemption(15102)).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'parent',
      parentDecisionBy: IBU_BAPA,
    })
    expect((await call('POST', '/api/parent/hadiah-approvals/15102/reject', IBU_BAPA)).status).toBe(
      409,
    )
    expect(wallet.summary(PELAJAR_4).tokenBalance).toBe(25)
  })

  it("answers 404 for a request that is not a linked child's (and for unknown ids)", async () => {
    for (const who of [IBU_BAPA_TANPA_ANAK, PELAJAR, ADMIN]) {
      expect((await call('POST', '/api/parent/hadiah-approvals/15102/approve', who)).status).toBe(
        404,
      )
      expect((await call('POST', '/api/parent/hadiah-approvals/15102/reject', who)).status).toBe(
        404,
      )
    }
    expect((await call('POST', '/api/parent/hadiah-approvals/999/approve', IBU_BAPA)).status).toBe(
      404,
    )
    // the seeded cancelled rows belong to users linked to no parent
    expect((await call('POST', '/api/parent/hadiah-approvals/1/approve', IBU_BAPA)).status).toBe(
      404,
    )
    expect(hadiah.getRedemption(15102)?.status).toBe('pending_parent_consent')
  })
})

describe('#19, #20 L43 digital shop reads (BR-M15-26…28)', () => {
  type Items = ListBody<never, DigitalItemsMeta>

  it('lists nothing for every account and every cat, even with rewards active', async () => {
    m15Hooks.m15SetReward(9, { isActive: true })
    await call('POST', '/api/admin/hadiah/bulk', ADMIN, { action: 'activate', ids: [1, 2, 3] })
    for (const who of [ADMIN, PELAJAR, IBU_BAPA]) {
      const r = await call<Items>('GET', '/api/hadiah-digital/items', who)
      expect(r.status).toBe(200)
      expect(r.body.data).toEqual([])
      expect(r.body.meta).toMatchObject({ totalItems: 0, activeCat: 'all' })
      const t = await call<Items>('GET', '/api/hadiah-digital/items?cat=telco', who)
      expect(t.body.data).toEqual([])
      expect(t.body.meta).toMatchObject({ totalItems: 0, activeCat: 'telco' })
    }
  })

  it('reads the chip from cat: all, every known key, unknown and repeated values (BR-M15-27)', async () => {
    const chip = async (q: string) =>
      (await call<Items>('GET', `/api/hadiah-digital/items${q}`, PELAJAR)).body.meta.activeCat
    expect(await chip('?cat=all')).toBe('all')
    for (const key of [
      'flagship',
      'ewallet',
      'telco',
      'gaming',
      'streaming',
      'food_beverage',
      'ecommerce',
      'education',
      'entertainment',
    ]) {
      expect(await chip(`?cat=${key}`)).toBe(key)
    }
    expect(await chip('?cat=bogus')).toBeNull()
    expect(await chip('?cat=')).toBeNull()
    expect(await chip('?cat=gaming&cat=telco')).toBeNull()
    expect(await chip('?other=1')).toBe('all')
    expect((await call('GET', '/api/hadiah-digital/items?cat=bogus', PELAJAR)).status).toBe(200)
  })

  it('lists no redemption for any account, whatever HadiahRedemption holds', async () => {
    m15Hooks.m15LoadFixture('queue')
    for (const who of [ADMIN, PELAJAR, PELAJAR_4, IBU_BAPA]) {
      const r = await call<ListBody<never>>('GET', '/api/hadiah-digital/redemptions', who)
      expect(r.status).toBe(200)
      expect(r.body.data).toEqual([])
      expect(r.body.meta.totalItems).toBe(0)
    }
  })

  it('needs a session (guest 401)', async () => {
    expect((await call('GET', '/api/hadiah-digital/items', null)).status).toBe(401)
    expect((await call('GET', '/api/hadiah-digital/redemptions', null)).status).toBe(401)
  })
})

describe('hooks and fixtures', () => {
  it('m15LoadFixture rejects an unknown name; m15SetReward an unknown reward', () => {
    expect(() => m15Hooks.m15LoadFixture('nope')).toThrow(RangeError)
    expect(() => m15Hooks.m15SetReward(9999, { isActive: true })).toThrow(RangeError)
  })

  it('the default seed never holds fixture rows', () => {
    expect(hadiah.getRedemption(15101)).toBeUndefined()
    expect(draws.list()).toHaveLength(0)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(0)
  })
})
