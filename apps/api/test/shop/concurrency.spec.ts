import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, STUDENT_2, STUDENT_MAJU, actorFor, apiOf, bareUser, bootShopApp, fund, insertDraw, insertReward, login, stockOf, userIdOf, walletRow, type ShopTestApp } from './helpers'

/** Settles the calls and splits them into fulfilled values and refusal codes. */
async function settle<T>(calls: Promise<T>[]): Promise<{ ok: T[]; codes: string[] }> {
  const results = await Promise.allSettled(calls)
  const ok: T[] = []
  const codes: string[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') ok.push(r.value)
    else codes.push((r.reason as { code?: string }).code ?? `unexpected:${String(r.reason)}`)
  }
  return { ok, codes }
}

const tokenSum = async (t: ShopTestApp, userId: string): Promise<number> =>
  Number((await t.db.query<{ s: string }>(`select coalesce(sum(delta), 0)::text as s from token_movements where user_id = $1`, [userId]))[0]!.s)

describe('M15 concurrency (BE-23, AC1)', () => {
  let t: ShopTestApp
  beforeAll(async () => {
    t = await bootShopApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('(a) 8 buyers for 7 items: exactly 7 succeed, 1 is OUT_OF_STOCK, stock ends at 0 and every ledger agrees', async () => {
    const reward = await insertReward(t, { tokenCost: 5, stock: 7 })
    const buyers: string[] = []
    for (let i = 0; i < 8; i++) {
      const u = await bareUser(t, `pembeli ${String(i)}`)
      await fund(t, u, { tokens: 5 }, 'a')
      buyers.push(u)
    }
    const { ok, codes } = await settle(buyers.map((u) => t.shop.redeem(actorFor(u), { rewardId: reward })))
    expect(ok).toHaveLength(7)
    expect(codes).toEqual(['OUT_OF_STOCK'])
    expect(await stockOf(t, reward)).toBe(0)
    expect(await t.db.query(`select 1 from reward_redemptions where reward_id = $1`, [reward])).toHaveLength(7)
    expect(await t.db.query(`select 1 from token_movements where source = 'hadiah_redeem' and user_id = any($1::bigint[])`, [buyers])).toHaveLength(7)
    let paid = 0
    for (const u of buyers) {
      const w = await walletRow(t, u)
      expect(w.tokens === 0 || w.tokens === 5).toBe(true) // paid 5 or was refused untouched
      paid += 5 - w.tokens
      expect(await tokenSum(t, u)).toBe(5 + (w.tokens - 5)) // movements = credit 5 minus the spend
    }
    expect(paid).toBe(35)
  })

  it('(a) over HTTP: 3 signed-in students race for 2 items: exactly 2 succeed', async () => {
    const reward = await insertReward(t, { tokenCost: 3, stock: 2 })
    const apis = []
    for (const who of [STUDENT, STUDENT_MAJU, STUDENT_2]) {
      const uid = await userIdOf(t.db, who)
      await fund(t, uid, { tokens: 3 }, 'a-http')
      apis.push(apiOf(await login(t, who)))
    }
    const res = await Promise.all(apis.map((a) => a.post('/hadiah/redemptions', { rewardId: reward })))
    expect(res.map((r) => r.status).sort()).toEqual([201, 201, 409])
    expect(res.find((r) => r.status === 409)!.body.error.code).toBe('OUT_OF_STOCK')
    expect(await stockOf(t, reward)).toBe(0)
  })

  it('(b) one user fires 6 parallel redemptions with tokens for only one: exactly one succeeds, the balance never goes negative, stock of the refused ones is intact', async () => {
    const u = await bareUser(t, 'satu baki')
    await fund(t, u, { tokens: 10 }, 'b')
    const rewards = []
    for (let i = 0; i < 6; i++) rewards.push(await insertReward(t, { tokenCost: 10, stock: 4 }))
    const { ok, codes } = await settle(rewards.map((r) => t.shop.redeem(actorFor(u), { rewardId: r })))
    expect(ok).toHaveLength(1)
    expect(codes).toEqual(Array(5).fill('INSUFFICIENT_TOKENS'))
    expect((await walletRow(t, u)).tokens).toBe(0)
    expect(await tokenSum(t, u)).toBe(0)
    const stocks = await Promise.all(rewards.map((r) => stockOf(t, r)))
    expect(stocks.filter((s) => s === 3)).toHaveLength(1)
    expect(stocks.filter((s) => s === 4)).toHaveLength(5)
    expect(await t.db.query(`select 1 from reward_redemptions where user_id = $1`, [u])).toHaveLength(1)
  })

  it('(b) over HTTP: parallel requests of one session on the same reward with balance for one', async () => {
    const uid = await userIdOf(t.db, STUDENT)
    const before = (await walletRow(t, uid)).tokens
    await t.db.query(`update wallets set token_balance = 0 where user_id = $1`, [uid]) // fixture
    await fund(t, uid, { tokens: 8 }, 'b-http')
    const reward = await insertReward(t, { tokenCost: 8, stock: 10 })
    const api = apiOf(await login(t, STUDENT))
    const res = await Promise.all(Array.from({ length: 5 }, () => api.post('/hadiah/redemptions', { rewardId: reward })))
    expect(res.filter((r) => r.status === 201)).toHaveLength(1)
    expect(res.filter((r) => r.status === 409).every((r) => r.body.error.code === 'INSUFFICIENT_TOKENS')).toBe(true)
    expect((await walletRow(t, uid)).tokens).toBe(0)
    expect(before).toBeGreaterThanOrEqual(0)
  })

  it('the monthly cap holds under parallel requests of one user (cap 1, 6 requests)', async () => {
    const u = await bareUser(t, 'had bulanan')
    await fund(t, u, { tokens: 100 }, 'cap')
    const reward = await insertReward(t, { tokenCost: 2, stock: 50, maxPerMonth: 1 })
    const { ok, codes } = await settle(Array.from({ length: 6 }, () => t.shop.redeem(actorFor(u), { rewardId: reward })))
    expect(ok).toHaveLength(1)
    expect(codes).toEqual(Array(5).fill('MONTHLY_CAP'))
    expect(await stockOf(t, reward)).toBe(49)
    expect((await walletRow(t, u)).tokens).toBe(98)
  })

  it('(c) parallel ticket purchases cannot exceed the ticket limit (max 3, 9 requests) and the syiling matches the tickets', async () => {
    const u = await bareUser(t, 'tiket')
    await fund(t, u, { syiling: 200 }, 'c')
    const draw = await insertDraw(t, { cost: 10, max: 3 })
    const { ok, codes } = await settle(Array.from({ length: 9 }, () => t.shop.buyTicket(actorFor(u), draw)))
    expect(ok).toHaveLength(3)
    expect(codes).toEqual(Array(6).fill('TICKET_LIMIT'))
    expect(await t.db.query(`select 1 from draw_tickets where draw_id = $1 and user_id = $2`, [draw, u])).toHaveLength(3)
    expect((await walletRow(t, u)).syiling).toBe(170)
    expect(ok.map((r) => r.ticketsOwned).sort()).toEqual([1, 2, 3])
    const led = await t.db.query<{ source_id: string }>(`select source_id from coin_ledger where user_id = $1 and source = 'cabutan_ticket'`, [u])
    expect(new Set(led.map((l) => l.source_id)).size).toBe(3) // one key per ticket
  })

  it('(c) over HTTP: parallel ticket purchases of one session', async () => {
    const uid = await userIdOf(t.db, STUDENT_MAJU)
    await fund(t, uid, { syiling: 100 }, 'c-http')
    const draw = await insertDraw(t, { cost: 3, max: 2 })
    const api = apiOf(await login(t, STUDENT_MAJU))
    const res = await Promise.all(Array.from({ length: 6 }, () => api.post(`/cabutan/${draw}/tickets`)))
    expect(res.filter((r) => r.status === 201)).toHaveLength(2)
    expect(res.filter((r) => r.status === 409).every((r) => r.body.error.code === 'TICKET_LIMIT')).toBe(true)
  })

  it('parallel ticket buys with syiling for one ticket: exactly one succeeds, the balance never goes negative', async () => {
    const u = await bareUser(t, 'tiket baki')
    await fund(t, u, { syiling: 10 }, 'cb')
    const draw = await insertDraw(t, { cost: 10, max: 5 })
    const { ok, codes } = await settle(Array.from({ length: 4 }, () => t.shop.buyTicket(actorFor(u), draw)))
    expect(ok).toHaveLength(1)
    expect(codes).toEqual(Array(3).fill('INSUFFICIENT_BALANCE'))
    expect((await walletRow(t, u)).syiling).toBe(0)
    expect(await t.db.query(`select 1 from draw_tickets where draw_id = $1 and user_id = $2`, [draw, u])).toHaveLength(1)
  })

  it('parallel box openings with tokens for one: exactly one succeeds', async () => {
    const u = await bareUser(t, 'kotak')
    await fund(t, u, { tokens: 5 }, 'box')
    const { ok, codes } = await settle(Array.from({ length: 4 }, () => t.shop.openBox(actorFor(u), '2')))
    expect(ok).toHaveLength(1)
    expect(codes).toEqual(Array(3).fill('INSUFFICIENT_TOKENS'))
    expect((await walletRow(t, u)).tokens).toBe(0)
    expect(await t.db.query(`select 1 from mystery_box_openings where user_id = $1`, [u])).toHaveLength(1)
    expect(await t.db.query(`select 1 from coin_ledger where user_id = $1 and source = 'mystery_box'`, [u])).toHaveLength(1)
  })

  it('cancel is idempotent under parallel calls: one 200, the rest 409, tokens refunded once, stock restored once', async () => {
    const u = await bareUser(t, 'batal')
    await fund(t, u, { tokens: 20 }, 'cancel')
    const reward = await insertReward(t, { tokenCost: 20, stock: 2 })
    const r = await t.shop.redeem(actorFor(u), { rewardId: reward })
    expect(await stockOf(t, reward)).toBe(1)
    const admin = apiOf(await login(t, ADMIN))
    const res = await Promise.all(Array.from({ length: 5 }, () => admin.post(`/admin/hadiah/redemptions/${r.id}/cancel`)))
    expect(res.filter((x) => x.status === 200)).toHaveLength(1)
    expect(res.filter((x) => x.status === 409).every((x) => x.body.error.code === 'CONFLICT')).toBe(true)
    expect((await walletRow(t, u)).tokens).toBe(20)
    expect(await stockOf(t, reward)).toBe(2)
    expect(await t.db.query(`select 1 from token_movements where user_id = $1 and source = 'hadiah_refund'`, [u])).toHaveLength(1)
  })

  it('cancel and deliver racing on one redemption: exactly one wins and the state is consistent', async () => {
    const u = await bareUser(t, 'lumba')
    await fund(t, u, { tokens: 4 }, 'race')
    const reward = await insertReward(t, { tokenCost: 4, stock: 3 })
    const r = await t.shop.redeem(actorFor(u), { rewardId: reward })
    const admin = apiOf(await login(t, ADMIN))
    const [c, d] = await Promise.all([admin.post(`/admin/hadiah/redemptions/${r.id}/cancel`), admin.post(`/admin/hadiah/redemptions/${r.id}/deliver`, { code: 'KOD-LUMBA' })])
    expect([c.status, d.status].sort()).toEqual([200, 409])
    const [row] = await t.db.query<{ status: string; voucher_code: string | null }>(`select status, voucher_code from reward_redemptions where id = $1`, [r.id])
    if (c.status === 200) {
      expect(row).toEqual({ status: 'cancelled', voucher_code: null })
      expect((await walletRow(t, u)).tokens).toBe(4)
      expect(await stockOf(t, reward)).toBe(3)
    } else {
      expect(row).toEqual({ status: 'delivered', voucher_code: 'KOD-LUMBA' })
      expect((await walletRow(t, u)).tokens).toBe(0)
      expect(await stockOf(t, reward)).toBe(2)
    }
  })

  it('a user redeeming reward R in parallel with the admin cancelling an earlier reserved redemption of R: no 500, stock and tokens consistent', async () => {
    const u = await bareUser(t, 'redeem lawan batal')
    await fund(t, u, { tokens: 40 }, 'dl')
    const reward = await insertReward(t, { tokenCost: 10, stock: 5 })
    const admin = apiOf(await login(t, ADMIN))
    for (let round = 0; round < 6; round++) {
      const earlier = await t.shop.redeem(actorFor(u), { rewardId: reward })
      const [again, cancel] = await Promise.all([settle([t.shop.redeem(actorFor(u), { rewardId: reward })]), admin.post(`/admin/hadiah/redemptions/${earlier.id}/cancel`)])
      expect(cancel.status).toBe(200)
      expect(again.codes).toEqual([])
      // Free the new one again so every round starts from the same balance.
      const [row] = await t.db.query<{ id: string }>(`select id::text from reward_redemptions where user_id = $1 and status = 'pending_admin'`, [u])
      await admin.post(`/admin/hadiah/redemptions/${row!.id}/cancel`)
    }
    expect(await stockOf(t, reward)).toBe(5)
    expect((await walletRow(t, u)).tokens).toBe(40)
    expect(await tokenSum(t, u)).toBe(40)
  })

  it('a ticket sale waits for a draw run holding the draw row (FOR UPDATE) and re-checks the status afterwards', async () => {
    const u = await bareUser(t, 'tiket lawan undi')
    await fund(t, u, { syiling: 50 }, 'run')
    const draw = await insertDraw(t, { cost: 5, max: 3 })
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    let locked!: () => void
    const isLocked = new Promise<void>((r) => (locked = r))
    const run = t.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM draws WHERE id = ${BigInt(draw)} FOR UPDATE`
      locked()
      await held
      await tx.$executeRaw`UPDATE draws SET status = 'closed' WHERE id = ${BigInt(draw)}`
    })
    await isLocked
    let done = false
    const sale = settle([t.shop.buyTicket(actorFor(u), draw)]).then((r) => ((done = true), r))
    await new Promise((r) => setTimeout(r, 400))
    expect(done).toBe(false) // blocked behind the draw run
    release()
    await run
    const { ok, codes } = await sale
    expect(ok).toHaveLength(0)
    expect(codes).toEqual(['DRAW_CLOSED'])
    expect(await t.db.query(`select 1 from draw_tickets where draw_id = $1`, [draw])).toHaveLength(0)
    expect((await walletRow(t, u)).syiling).toBe(50)
  })
})
