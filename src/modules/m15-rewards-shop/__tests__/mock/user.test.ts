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

describe('#10, #11 mystery box on the 0222 model (S7-T07 P8)', () => {
  let n = 0
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const open = (as = PELAJAR, clientUuid: string | null = uuid(), id = 5) =>
    call<{ data: MysteryBoxOpened }>(
      'POST',
      `/api/gamification/mystery-boxes/${String(id)}/open`,
      as,
      clientUuid === null ? {} : { clientUuid },
    )
  const view = async (as = PELAJAR) =>
    (await call<{ data: MysteryBoxesView }>('GET', '/api/gamification/mystery-boxes', as)).body.data
  const SEVEN_LABELS = [
    '10 syiling',
    '25 syiling',
    '60 syiling',
    '1 token',
    '150 syiling',
    '3 token',
    '500 syiling — jackpot!',
  ]

  // N5 first: a box nobody can win is refused before any debit or opening row.
  it('N5: every prize at stock 0 gives 409 BOX_UNAVAILABLE; no debit, no ledger row, no opening; GET says available:false', async () => {
    wallet.setFields(PELAJAR, { syiling: 80 })
    m15Hooks.m15SetMysteryBox({ stocks: Object.fromEntries(SEVEN_LABELS.map((l) => [l, 0])) })
    const ledger = coinLedger.forUser(PELAJAR).length
    const r = await open()
    expect(r.status).toBe(409)
    expect(codeOf(r)).toBe('BOX_UNAVAILABLE')
    expect((r.body as unknown as { error: { message: string } }).error.message).toBe(
      'Kotak tidak tersedia buat masa ini.',
    )
    expect(wallet.summary(PELAJAR).currentSyiling).toBe(80)
    expect(coinLedger.forUser(PELAJAR)).toHaveLength(ledger)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(0)
    const v = await view()
    expect(v).toMatchObject({ available: false })
    expect(v.box?.prizes).toEqual([])
  })

  it('N5: an inactive box is 404 "Kotak tidak dijumpai." and GET shows box:null; nothing is written', async () => {
    wallet.setFields(PELAJAR, { syiling: 80 })
    m15Hooks.m15SetMysteryBox({ isActive: false })
    const r = await open()
    expect(r.status).toBe(404)
    expect((r.body as unknown as { error: { message: string } }).error.message).toBe(
      'Kotak tidak dijumpai.',
    )
    expect(wallet.summary(PELAJAR).currentSyiling).toBe(80)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(0)
    expect(await view()).toMatchObject({ box: null, available: false })
  })

  it('lists the one box (id 5, cost 50) with seven prizes totalling 100, the daily numbers and an empty history; no XP', async () => {
    wallet.setFields(PELAJAR, { syiling: 12 })
    const r = await call<{ data: MysteryBoxesView }>(
      'GET',
      '/api/gamification/mystery-boxes',
      PELAJAR,
    )
    expect(r.status).toBe(200)
    const v = r.body.data
    expect(v).toMatchObject({
      available: true,
      syilingBalance: 12,
      dailyMax: 5,
      openedToday: 0,
      history: [],
    })
    expect(v).not.toHaveProperty('tokenBalance')
    expect(v.box).toMatchObject({ id: 5, label: 'Kotak Misteri', costSyiling: 50 })
    expect(v.box?.prizes.map((p) => [p.label, p.chance])).toEqual([
      ['10 syiling', 40],
      ['25 syiling', 25],
      ['60 syiling', 15],
      ['1 token', 10],
      ['150 syiling', 6],
      ['3 token', 3],
      ['500 syiling — jackpot!', 1],
    ])
    expect((await call('GET', '/api/gamification/mystery-boxes', null)).status).toBe(401)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(0)
  })

  it('opens at 80 syiling and cost 50: 30 plus the prize; ledger rows spend -50 and earn; the opening is stored', async () => {
    wallet.setFields(PELAJAR, { syiling: 80 })
    const before = wallet.summary(PELAJAR)
    m15Hooks.m15MysteryNext({ label: '25 syiling' })
    const r = await open()
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({
      boxId: 5,
      boxName: 'Kotak Misteri',
      prize: { label: '25 syiling', kind: 'syiling', amount: 25 },
      syilingBalance: 80 - 50 + 25,
      tokenBalance: before.tokenBalance,
    })
    const after = wallet.summary(PELAJAR)
    expect(after.xp).toBe(before.xp)
    const rows = coinLedger.forUser(PELAJAR).filter((row) => row.source === 'mystery_box')
    expect(rows.map((row) => [row.type, row.amount, row.description])).toEqual(
      expect.arrayContaining([
        ['spend', -50, 'Kotak Misteri: Kotak Misteri'],
        ['earn', 25, 'Kotak Misteri: 25 syiling'],
      ]),
    )
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(1)
    const v = await view()
    expect(v.openedToday).toBe(1)
    expect(v.history).toEqual([
      {
        id: r.body.data.openingId,
        boxId: 5,
        boxName: 'Kotak Misteri',
        prizeLabel: '25 syiling',
        prizeKind: 'syiling',
        prizeAmount: 25,
        createdAt: '2026-09-25T15:40:00+08:00',
      },
    ])
  })

  it('a token prize moves tokens only', async () => {
    wallet.setFields(PELAJAR, { syiling: 80, tokens: 1 })
    m15Hooks.m15MysteryNext({ label: '3 token' })
    const r = await open()
    expect(r.body.data).toMatchObject({
      prize: { label: '3 token', kind: 'token', amount: 3 },
      tokenBalance: 4,
      syilingBalance: 30,
    })
    expect(
      coinLedger.forUser(PELAJAR).some((row) => row.source === 'mystery_box' && row.type === 'earn'),
    ).toBe(false)
  })

  it('refuses below the cost (409 INSUFFICIENT_BALANCE) and ids 1 to 4, 9 (404); nothing is written', async () => {
    wallet.setFields(PELAJAR, { syiling: 20 })
    const r = await open()
    expect(r.status).toBe(409)
    expect(codeOf(r)).toBe('INSUFFICIENT_BALANCE')
    expect((r.body as unknown as { error: { message: string } }).error.message).toBe(
      'Baki syiling tidak mencukupi.',
    )
    for (const id of [1, 2, 3, 4, 9]) expect((await open(PELAJAR, uuid(), id)).status).toBe(404)
    expect(wallet.summary(PELAJAR).currentSyiling).toBe(20)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(0)
  })

  it('a missing or bad clientUuid is 422', async () => {
    wallet.setFields(PELAJAR, { syiling: 80 })
    const r = await open(PELAJAR, null)
    expect(r.status).toBe(422)
    expect((await open(PELAJAR, 'bukan-uuid')).status).toBe(422)
    expect(wallet.summary(PELAJAR).currentSyiling).toBe(80)
  })

  it('the same clientUuid twice makes one opening and one debit and answers the first opening', async () => {
    wallet.setFields(PELAJAR, { syiling: 120 })
    const key = uuid()
    const a = await open(PELAJAR, key)
    const b = await open(PELAJAR, key)
    expect(b.status).toBe(200)
    expect(b.body.data.openingId).toBe(a.body.data.openingId)
    expect(b.body.data.prize).toEqual(a.body.data.prize)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(1)
    expect(
      coinLedger.forUser(PELAJAR).filter((row) => row.source === 'mystery_box' && row.type === 'spend'),
    ).toHaveLength(1)
  })

  it('a clientUuid reused on another box is 422 on clientUuid like the API, not 404; nothing moves', async () => {
    wallet.setFields(PELAJAR, { syiling: 120 })
    const key = uuid()
    expect((await open(PELAJAR, key)).status).toBe(200)
    const before = wallet.summary(PELAJAR).currentSyiling
    const r = await open(PELAJAR, key, 6)
    expect(r.status).toBe(422)
    expect(
      (r.body as unknown as { error: { fields: Record<string, string> } }).error.fields.clientUuid,
    ).toBe('The client uuid field must be a valid UUID.')
    expect(wallet.summary(PELAJAR).currentSyiling).toBe(before)
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(1)
  })

  it('5 opens pass and the 6th is 429 MYSTERY_DAILY_LIMIT with the balance unchanged; the next Malaysia day passes again', async () => {
    wallet.setFields(PELAJAR, { syiling: 600 })
    m15Hooks.m15SetMysteryBox({ stocks: {} })
    for (let i = 0; i < 5; i++) expect((await open()).status).toBe(200)
    const before = wallet.summary(PELAJAR).currentSyiling
    const r = await open()
    expect(r.status).toBe(429)
    expect(codeOf(r)).toBe('MYSTERY_DAILY_LIMIT')
    expect((r.body as unknown as { error: { message: string } }).error.message).toBe(
      'Had kotak hari ini telah dicapai. Cuba lagi esok.',
    )
    expect(wallet.summary(PELAJAR).currentSyiling).toBe(before)
    expect((await view()).openedToday).toBe(5)
    // The next Malaysia day, through the repository (a session issued at the project clock would have expired). The
    // shared clock is put back so no other test inherits it.
    const offset = runtime.clock.getOffset()
    try {
      runtime.clock.advance(9 * 3600_000) // 00:40 the next day
      expect(mysteryBox.open(PELAJAR, 5, uuid()).opening.boxId).toBe(5)
      expect(mysteryBox.view(PELAJAR).openedToday).toBe(1)
    } finally {
      runtime.clock.setOffset(offset)
    }
  })

  it('a prize with stock 1 drops to 0 when won and is then left out; the chances are renormalised to one decimal', async () => {
    m15Hooks.m15SetMysteryBox({ stocks: { '10 syiling': 1, '25 syiling': 0 } })
    const v0 = await view()
    expect(v0.box?.prizes.map((p) => p.label)).not.toContain('25 syiling')
    expect(v0.box?.prizes.find((p) => p.label === '10 syiling')?.chance).toBe(
      Math.round((40 / 75) * 1000) / 10,
    )
    wallet.setFields(PELAJAR, { syiling: 200 })
    m15Hooks.m15MysteryNext({ label: '10 syiling' })
    expect((await open()).status).toBe(200)
    const v1 = await view()
    expect(v1.box?.prizes.map((p) => p.label)).not.toContain('10 syiling')
    expect(v1.box?.prizes.reduce((sum, p) => sum + p.chance, 0)).toBeCloseTo(100, 0)
  })

  it('draws a weighted prize from the seeded stream and lists at most 10 openings', async () => {
    wallet.setFields(PELAJAR, { syiling: 100_000 })
    m15Hooks.m15SetMysteryBox({ dailyMax: 20 })
    for (let i = 0; i < 12; i++) {
      const r = await open()
      expect(SEVEN_LABELS).toContain(r.body.data.prize.label)
    }
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(12)
    expect((await view()).history).toHaveLength(10)
  })

  it('an opening made before P8 reads with null prize fields and its retired box name', async () => {
    mysteryBox.seedOpenings([
      {
        id: 15301,
        userId: PELAJAR,
        boxId: 2,
        prizeLabel: null,
        prizeKind: null,
        prizeAmount: null,
        clientUuid: null,
        createdAt: '2026-09-24T10:00:00+08:00',
      },
    ])
    expect(mysteryBox.openingsCount(PELAJAR)).toBe(1)
    expect((await view()).history[0]).toMatchObject({
      boxId: 2,
      boxName: 'Kotak Perak',
      prizeLabel: null,
      prizeKind: null,
      prizeAmount: null,
    })
  })

  it('validates the hook input', () => {
    expect(() => m15Hooks.m15MysteryNext({ label: '' })).toThrow(RangeError)
    expect(() => m15Hooks.m15SetMysteryBox({ costSyiling: 0 })).toThrow(RangeError)
    expect(() => m15Hooks.m15SetMysteryBox({ stocks: { Tiada: 1 } })).toThrow(RangeError)
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

  it('approve / reject are parent-only: guest 401, student and admin 403, nothing changes (G4 F5)', async () => {
    for (const verb of ['approve', 'reject']) {
      const url = `/api/parent/hadiah-approvals/15102/${verb}`
      expect((await call('POST', url, null)).status).toBe(401)
      expect((await call('POST', url, PELAJAR)).status).toBe(403)
      expect((await call('POST', url, ADMIN)).status).toBe(403)
    }
    expect(hadiah.getRedemption(15102)?.status).toBe('pending_parent_consent')
  })

  it("answers 404 for a request that is not a linked child's (and for unknown ids)", async () => {
    for (const who of [IBU_BAPA_TANPA_ANAK]) {
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
