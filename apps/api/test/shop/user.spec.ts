import {
  RewardCabutanViewSchema,
  RewardMysteryBoxOpenedSchema,
  RewardMysteryBoxesViewSchema,
  RewardRedeemResultSchema,
  RewardTicketBoughtSchema,
  ShopDigitalItemsResponseSchema,
  ShopDigitalRedemptionsResponseSchema,
} from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, STUDENT_2, STUDENT_MAJU, actorFor, apiOf, bareUser, bootShopApp, expectError, fund, insertDraw, insertReward, login, refusal, stockOf, userIdOf, walletRow, type ShopTestApp } from './helpers'

describe('M15 student routes (BE-23)', () => {
  let t: ShopTestApp
  beforeAll(async () => {
    t = await bootShopApp()
  })
  afterAll(async () => {
    await t.close()
  })

  const as = async (who: string) => apiOf(await login(t, who))

  describe('session budget of a redeem (S7-T05, 48 GAME-21 step 4, ERR-GAME-22)', () => {
    const MESSAGE = 'Had tebusan sesi ini telah dicapai.'
    const setBudget = (sen: number, year = 2026) => t.db.query(`update reward_settings set redeem_budget_sen = $1, session_year = $2`, [sen, year])
    let n = 0
    const pupil = async (tokens = 100) => {
      const u = await bareUser(t, `Pelajar Bajet ${String(n++)}`)
      if (tokens > 0) await fund(t, u, { tokens }, 'budget')
      return u
    }
    const row = async (id: string) => (await t.db.query<{ token_cost: number; token_cost_snapshot: number; cost_value_sen_snapshot: number }>(`select token_cost, token_cost_snapshot, cost_value_sen_snapshot from reward_redemptions where id = $1`, [id]))[0]!

    beforeEach(async () => {
      await t.db.query(`update reward_redemptions set status = 'cancelled', cancelled_by = 'admin' where status <> 'cancelled'`)
      await setBudget(300)
    })
    afterAll(async () => {
      await setBudget(300)
    })

    it('AC-GM-21.3, AC-ADM-P2-09.1: a 1000-sen gift against a 300-sen budget answers 409 ERR-GAME-22 over HTTP and nothing moves', async () => {
      const uid = await userIdOf(t.db, STUDENT_2)
      await fund(t, uid, { tokens: 20 }, 'budget-http')
      const before = (await walletRow(t, uid)).tokens
      const reward = await insertReward(t, { tokenCost: 10, stock: 3, costSen: 1000 })
      const res = await (await as(STUDENT_2)).post('/hadiah/redemptions', { rewardId: reward })
      expectError(res, 409, 'REDEEM_BUDGET', MESSAGE)
      expect((await walletRow(t, uid)).tokens).toBe(before)
      expect(await stockOf(t, reward)).toBe(3)
      expect(await t.db.query(`select 1 from reward_redemptions where reward_id = $1`, [reward])).toHaveLength(0)
    })

    it('AC-GM-21.4: a digital gift (0 sen) succeeds when the budget is used up', async () => {
      await setBudget(0)
      const digital = await insertReward(t, { tokenCost: 10, stock: null })
      const u = await pupil()
      expect((await t.shop.redeem(actorFor(u), { rewardId: digital })).status).toBe('pending_admin')
    })

    it('allows up to exactly the budget, sums every pupil, and refuses the next sen', async () => {
      const a = await insertReward(t, { tokenCost: 1, stock: null, costSen: 200 })
      const b = await insertReward(t, { tokenCost: 1, stock: null, costSen: 100 })
      const c = await insertReward(t, { tokenCost: 1, stock: null, costSen: 1 })
      await t.shop.redeem(actorFor(await pupil()), { rewardId: a })
      await t.shop.redeem(actorFor(await pupil()), { rewardId: b })
      await expect(t.shop.redeem(actorFor(await pupil()), { rewardId: c })).rejects.toMatchObject({ code: 'REDEEM_BUDGET', message: MESSAGE })
    })

    it('writes both snapshots, and the sum reads the snapshot, not the cost the admin sets later', async () => {
      const reward = await insertReward(t, { tokenCost: 7, stock: null, costSen: 250 })
      const got = await t.shop.redeem(actorFor(await pupil()), { rewardId: reward })
      expect(await row(got.id)).toEqual({ token_cost: 7, token_cost_snapshot: 7, cost_value_sen_snapshot: 250 })
      await t.db.query(`update rewards set cost_value_sen = 0, token_cost = 99 where id = $1`, [reward])
      const other = await insertReward(t, { tokenCost: 1, stock: null, costSen: 51 })
      await expect(t.shop.redeem(actorFor(await pupil()), { rewardId: other })).rejects.toMatchObject({ code: 'REDEEM_BUDGET' })
      expect(await row(got.id)).toEqual({ token_cost: 7, token_cost_snapshot: 7, cost_value_sen_snapshot: 250 })
    })

    it('a digital redemption keeps snapshot 0; a delivered one counts; a cancelled one frees its budget', async () => {
      const digital = await insertReward(t, { tokenCost: 1, stock: null })
      const gift = await insertReward(t, { tokenCost: 1, stock: null, costSen: 300 })
      const free = await t.shop.redeem(actorFor(await pupil()), { rewardId: digital })
      expect((await row(free.id)).cost_value_sen_snapshot).toBe(0)
      const first = await t.shop.redeem(actorFor(await pupil()), { rewardId: gift })
      await t.db.query(`update reward_redemptions set status = 'delivered', voucher_code = 'KOD', delivered_at = now() where id = $1`, [first.id])
      await expect(t.shop.redeem(actorFor(await pupil()), { rewardId: gift })).rejects.toMatchObject({ code: 'REDEEM_BUDGET' })
      await (await as(ADMIN)).post(`/admin/hadiah/redemptions/${free.id}/cancel`)
      await expect(t.shop.redeem(actorFor(await pupil()), { rewardId: gift })).rejects.toMatchObject({ code: 'REDEEM_BUDGET' })
      await t.db.query(`update reward_redemptions set status = 'cancelled', cancelled_by = 'admin' where id = $1`, [first.id])
      expect((await t.shop.redeem(actorFor(await pupil()), { rewardId: gift })).status).toBe('pending_admin')
    })

    it('the window is the Malaysia calendar year of session_year, by created_at', async () => {
      const gift = await insertReward(t, { tokenCost: 1, stock: null, costSen: 300 })
      const first = await t.shop.redeem(actorFor(await pupil()), { rewardId: gift })
      const moveTo = (at: string) => t.db.query(`update reward_redemptions set created_at = $1::timestamptz where id = $2`, [at, first.id])
      await moveTo('2025-12-31T23:59:59+08:00')
      const second = await t.shop.redeem(actorFor(await pupil()), { rewardId: gift })
      await t.db.query(`update reward_redemptions set status = 'cancelled', cancelled_by = 'admin' where id = $1`, [second.id])
      await moveTo('2026-01-01T00:00:00+08:00')
      await expect(t.shop.redeem(actorFor(await pupil()), { rewardId: gift })).rejects.toMatchObject({ code: 'REDEEM_BUDGET' })
      await moveTo('2027-01-01T00:00:00+08:00')
      expect((await t.shop.redeem(actorFor(await pupil()), { rewardId: gift })).status).toBe('pending_admin')
    })

    it('runs in the order of GAME-21: stock, monthly cap, budget, then tokens', async () => {
      const u = await pupil(0)
      const outOfStock = await insertReward(t, { tokenCost: 1, stock: 0, costSen: 1000 })
      await expect(t.shop.redeem(actorFor(u), { rewardId: outOfStock })).rejects.toMatchObject({ code: 'OUT_OF_STOCK' })
      const overBudget = await insertReward(t, { tokenCost: 1, stock: 1, costSen: 1000 })
      await expect(t.shop.redeem(actorFor(u), { rewardId: overBudget })).rejects.toMatchObject({ code: 'REDEEM_BUDGET' })
      expect(await stockOf(t, overBudget)).toBe(1)
      const affordable = await insertReward(t, { tokenCost: 1, stock: 1, costSen: 300 })
      await expect(t.shop.redeem(actorFor(u), { rewardId: affordable })).rejects.toMatchObject({ code: 'INSUFFICIENT_TOKENS' })
      expect(await stockOf(t, affordable)).toBe(1)
      const capped = await insertReward(t, { tokenCost: 1, stock: 5, maxPerMonth: 0, costSen: 1000 })
      await expect(t.shop.redeem(actorFor(await pupil()), { rewardId: capped })).rejects.toMatchObject({ code: 'MONTHLY_CAP' })
    })

    it('a repeat with the same clientUuid answers the first redemption even when the budget is used up', async () => {
      const key = '7f3c2a10-5b1e-4c6d-9a2f-1e8b7c6d5a60'
      const gift = await insertReward(t, { tokenCost: 1, stock: null, costSen: 300 })
      const u = await pupil()
      const first = await t.shop.redeem(actorFor(u), { rewardId: gift, clientUuid: key })
      expect(await t.shop.redeem(actorFor(u), { rewardId: gift, clientUuid: key })).toEqual(first)
    })
  })

  describe('authentication, CSRF and the routes that are not built', () => {
    const reads = ['/cabutan', '/gamification/mystery-boxes', '/hadiah-digital/items', '/hadiah-digital/redemptions']
    it.each(reads)('GET %s is 401 for an anonymous caller', async (path) => {
      expectError(await t.http().get(`/api${path}`), 401, 'UNAUTHORIZED')
    })

    it.each(['/hadiah/redemptions', '/gamification/mystery-boxes/1/open', '/cabutan/1/tickets'])('POST %s is 401 anonymous and 403 CSRF_INVALID without the header', async (path) => {
      expectError(await t.http().post(`/api${path}`).send({}), 401, 'UNAUTHORIZED')
      const me = await login(t, STUDENT)
      expectError(await me.agent.post(`/api${path}`).send({}), 403, 'CSRF_INVALID')
    })

    it('answers every read for every role and sets no-store', async () => {
      for (const who of [STUDENT, 'guru@demo.test', ADMIN]) {
        const api = await as(who)
        for (const path of reads) {
          const res = await api.get(path)
          expect(res.status, `${who} ${path}`).toBe(200)
          expect(res.headers['cache-control']).toBe('no-store')
        }
      }
    })

    it('does not build the parent approval routes (UD-3): 404', async () => {
      const api = await as(STUDENT)
      expect((await api.get('/parent/hadiah-approvals')).status).toBe(404)
      expect((await api.post('/parent/hadiah-approvals/1/approve')).status).toBe(404)
      expect((await api.post('/parent/hadiah-approvals/1/reject')).status).toBe(404)
      const parent = await t.http().get('/api/parent/hadiah-approvals')
      expect([401, 404]).toContain(parent.status)
    })
  })

  describe('Kedai Hadiah Digital reads (always empty)', () => {
    it('lists nothing and reads the chip from cat', async () => {
      const api = await as(STUDENT)
      const all = ShopDigitalItemsResponseSchema.parse((await api.get('/hadiah-digital/items')).body)
      expect(all.data).toEqual([])
      expect(all.meta).toMatchObject({ page: 1, pageSize: 1, totalItems: 0, totalPages: 1, from: null, to: null, activeCat: 'all' })
      expect(ShopDigitalItemsResponseSchema.parse((await api.get('/hadiah-digital/items?cat=ewallet')).body).meta.activeCat).toBe('ewallet')
      expect(ShopDigitalItemsResponseSchema.parse((await api.get('/hadiah-digital/items?cat=nope')).body).meta.activeCat).toBeNull()
      expect(ShopDigitalItemsResponseSchema.parse((await api.get('/hadiah-digital/items?cat=ewallet&cat=telco')).body).meta.activeCat).toBeNull()
      const red = ShopDigitalRedemptionsResponseSchema.parse((await api.get('/hadiah-digital/redemptions')).body)
      expect(red.data).toEqual([])
    })
  })

  describe('POST /api/hadiah/redemptions', () => {
    it('redeems: 201, tokens debited once, stock taken and reserved, snapshot stored, ledger key redemption:{id}', async () => {
      const api = await as(STUDENT)
      const uid = await userIdOf(t.db, STUDENT)
      await fund(t, uid, { tokens: 50 }, 'redeem-happy')
      const before = await walletRow(t, uid)
      const reward = await insertReward(t, { title: 'Baucar Satu', tokenCost: 12, stock: 3 })
      const res = await api.post('/hadiah/redemptions', { rewardId: reward })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const data = RewardRedeemResultSchema.parse(res.body.data)
      expect(data.status).toBe('pending_admin')
      expect(data.tokenBalance).toBe(before.tokens - 12)
      expect((await walletRow(t, uid)).tokens).toBe(before.tokens - 12)
      expect(await stockOf(t, reward)).toBe(2)
      const [row] = await t.db.query<{ reward_title: string; token_cost: number; stock_reserved: boolean; user_id: string; voucher_code: string | null }>(
        `select reward_title, token_cost, stock_reserved, user_id::text, voucher_code from reward_redemptions where id = $1`,
        [data.id],
      )
      expect(row).toMatchObject({ reward_title: 'Baucar Satu', token_cost: 12, stock_reserved: true, user_id: uid, voucher_code: null })
      const moves = await t.db.query<{ delta: number; source: string; ref_id: string }>(`select delta, source, ref_id from token_movements where user_id = $1 and source = 'hadiah_redeem'`, [uid])
      expect(moves).toEqual([{ delta: -12, source: 'hadiah_redeem', ref_id: `redemption:${data.id}` }])
    })

    it('accepts a numeric rewardId, leaves unlimited stock alone and starts at pending_parent_consent when consent is required', async () => {
      const api = await as(STUDENT)
      const uid = await userIdOf(t.db, STUDENT)
      await fund(t, uid, { tokens: 30 }, 'redeem-consent')
      const reward = await insertReward(t, { tokenCost: 5, stock: null, consent: true })
      const res = await api.post('/hadiah/redemptions', { rewardId: Number(reward) })
      expect(res.status).toBe(201)
      expect(RewardRedeemResultSchema.parse(res.body.data).status).toBe('pending_parent_consent')
      expect(await stockOf(t, reward)).toBeNull()
      const [row] = await t.db.query<{ stock_reserved: boolean }>(`select stock_reserved from reward_redemptions where id = $1`, [res.body.data.id])
      expect(row!.stock_reserved).toBe(false)
    })

    it('422 for a missing, non-numeric or zero rewardId (the mock text), 404 for an unknown or inactive reward', async () => {
      const api = await as(STUDENT)
      for (const body of [{}, { rewardId: 'abc' }, { rewardId: 0 }, { rewardId: -3 }, { rewardId: 1.5 }]) {
        const res = await api.post('/hadiah/redemptions', body)
        const e = expectError(res, 422, 'VALIDATION_ERROR', 'The reward id field is required.')
        expect(e.fields).toEqual({ rewardId: 'The reward id field is required.' })
      }
      expectError(await api.post('/hadiah/redemptions', { rewardId: '999999' }), 404, 'NOT_FOUND', 'Hadiah tidak dijumpai.')
      const off = await insertReward(t, { active: false })
      expectError(await api.post('/hadiah/redemptions', { rewardId: off }), 404, 'NOT_FOUND', 'Hadiah tidak dijumpai.')
    })

    it('refuses in the order OUT_OF_STOCK, MONTHLY_CAP, INSUFFICIENT_TOKENS and changes nothing', async () => {
      const api = await as(STUDENT_MAJU)
      const uid = await userIdOf(t.db, STUDENT_MAJU)
      const empty = await insertReward(t, { stock: 0, maxPerMonth: 1 })
      expectError(await api.post('/hadiah/redemptions', { rewardId: empty }), 409, 'OUT_OF_STOCK', 'Stok hadiah telah habis.')

      await fund(t, uid, { tokens: 100 }, 'order')
      const capped = await insertReward(t, { tokenCost: 4, stock: 10, maxPerMonth: 1 })
      expect((await api.post('/hadiah/redemptions', { rewardId: capped })).status).toBe(201)
      const afterFirst = await walletRow(t, uid)
      expectError(await api.post('/hadiah/redemptions', { rewardId: capped }), 409, 'MONTHLY_CAP', 'Had tebusan bulanan dicapai.')
      expect(await walletRow(t, uid)).toEqual(afterFirst)
      expect(await stockOf(t, capped)).toBe(9)

      const dear = await insertReward(t, { tokenCost: 5_000, stock: 5 })
      expectError(await api.post('/hadiah/redemptions', { rewardId: dear }), 409, 'INSUFFICIENT_TOKENS', 'Token tidak mencukupi.')
      expect(await stockOf(t, dear)).toBe(5) // the stock taken before the token check was rolled back
      expect(await t.db.query(`select 1 from reward_redemptions where reward_id = $1`, [dear])).toHaveLength(0)
    })

    it('counts the monthly cap on the Malaysia calendar month: the next month resets it, a cancelled row does not count', async () => {
      const uid = await userIdOf(t.db, STUDENT_2)
      const actor = actorFor(uid)
      await fund(t, uid, { tokens: 100 }, 'month')
      const r = await insertReward(t, { tokenCost: 2, maxPerMonth: 1 })
      await t.shop.redeem(actor, { rewardId: r })
      expect((await refusal(t.shop.redeem(actor, { rewardId: r }))).code).toBe('MONTHLY_CAP')
      t.clock.set('2026-10-31T23:59:00+08:00') // still October in Malaysia
      expect((await refusal(t.shop.redeem(actor, { rewardId: r }))).code).toBe('MONTHLY_CAP')
      t.clock.set('2026-11-01T00:00:30+08:00') // November
      await t.shop.redeem(actor, { rewardId: r })
      t.clock.set('2026-10-19T09:00:00+08:00')
    })

    it('a cancelled redemption frees the monthly slot', async () => {
      const uid = await userIdOf(t.db, STUDENT_MAJU)
      await fund(t, uid, { tokens: 20 }, 'cancelfree')
      const r = await insertReward(t, { tokenCost: 3, maxPerMonth: 1 })
      const first = await t.shop.redeem(actorFor(uid), { rewardId: r })
      await t.db.query(`update reward_redemptions set status = 'cancelled' where id = $1`, [first.id])
      await t.shop.redeem(actorFor(uid), { rewardId: r })
    })
  })

  describe('Kotak Misteri', () => {
    it('lists the four boxes with the token balance and an empty history', async () => {
      const api = await as(STUDENT_2)
      const view = RewardMysteryBoxesViewSchema.parse((await api.get('/gamification/mystery-boxes')).body.data)
      expect(view.boxes.map((b) => [b.id, b.name, b.costTokens])).toEqual([
        ['1', 'Kotak Gangsa', 2],
        ['2', 'Kotak Perak', 5],
        ['3', 'Kotak Emas', 10],
        ['4', 'Kotak Legenda', 25],
      ])
      expect(view.history).toEqual([])
    })

    it('opens a box: 200, tokens debited, coins credited with the ledger text, xp added, deterministic under the seeded PRNG', async () => {
      const api = await as(STUDENT_MAJU)
      const uid = await userIdOf(t.db, STUDENT_MAJU)
      await fund(t, uid, { tokens: 40 }, 'box')
      const before = await walletRow(t, uid)
      const res = await api.post('/gamification/mystery-boxes/2/open')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const o = RewardMysteryBoxOpenedSchema.parse(res.body.data)
      expect(o).toMatchObject({ boxId: '2', boxName: 'Kotak Perak', icon: '🎁' })
      expect(o.coins).toBeGreaterThanOrEqual(10)
      expect(o.coins).toBeLessThanOrEqual(50)
      expect(o.xp).toBeGreaterThanOrEqual(5)
      expect(o.xp).toBeLessThanOrEqual(25)
      const after = await walletRow(t, uid)
      expect(after.tokens).toBe(before.tokens - 5)
      expect(after.syiling).toBe(before.syiling + o.coins)
      expect(after.xp).toBe(before.xp + o.xp)
      expect(o).toMatchObject({ tokenBalance: after.tokens, syilingBalance: after.syiling })
      const led = await t.db.query<{ type: string; description: string; amount: number; source_id: string }>(`select type, description, amount, source_id from coin_ledger where user_id = $1 and source = 'mystery_box'`, [uid])
      expect(led).toEqual([{ type: 'earn', description: 'Kotak Misteri: Kotak Perak', amount: o.coins, source_id: `opening:${o.openingId}` }])
      // Same (user, opening number) => same result: the stream depends only on the seed string.
      const { fnv1a32, mulberry32 } = await import('../../src/db/prng')
      const rng = mulberry32(fnv1a32(`m15-mystery:${uid}:0`))
      expect([o.coins, o.xp]).toEqual([rng.int(10, 50), rng.int(5, 25)])
      const view = RewardMysteryBoxesViewSchema.parse((await api.get('/gamification/mystery-boxes')).body.data)
      expect(view.history).toHaveLength(1)
      expect(view.history[0]).toMatchObject({ id: o.openingId, boxId: '2', boxName: 'Kotak Perak', coins: o.coins, xp: o.xp })
      expect(view.tokenBalance).toBe(after.tokens)
    })

    it('keeps at most the last 10 openings, newest first', async () => {
      const api = await as(STUDENT_MAJU)
      const uid = await userIdOf(t.db, STUDENT_MAJU)
      await fund(t, uid, { tokens: 60 }, 'box10')
      for (let i = 0; i < 11; i++) {
        t.clock.advance(1000)
        expect((await api.post('/gamification/mystery-boxes/1/open')).status).toBe(200)
      }
      const view = RewardMysteryBoxesViewSchema.parse((await api.get('/gamification/mystery-boxes')).body.data)
      expect(view.history).toHaveLength(10)
      const ids = view.history.map((h) => Number(h.id))
      expect(ids).toEqual([...ids].sort((a, b) => b - a))
    })

    it('404 for an unknown box (Kotak tidak dijumpai.) and a non-numeric id (Not Found.); 409 INSUFFICIENT_TOKENS writes nothing', async () => {
      const api = await as(STUDENT_2)
      const uid = await userIdOf(t.db, STUDENT_2)
      expectError(await api.post('/gamification/mystery-boxes/9/open'), 404, 'NOT_FOUND', 'Kotak tidak dijumpai.')
      expectError(await api.post('/gamification/mystery-boxes/abc/open'), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
      await t.db.query(`update wallets set token_balance = 3 where user_id = $1`, [uid]) // fixture: below the cost of the Legenda box
      const before = await walletRow(t, uid)
      expectError(await api.post('/gamification/mystery-boxes/4/open'), 409, 'INSUFFICIENT_TOKENS', 'Token tidak mencukupi.')
      expect(await walletRow(t, uid)).toEqual(before)
      expect(await t.db.query(`select 1 from mystery_box_openings where user_id = $1`, [uid])).toHaveLength(0)
    })
  })

  describe('mystery box randomness', () => {
    it('production binds the CSPRNG source: in range and not a function of the key', async () => {
      const { CsprngBoxRandom, SeededBoxRandom } = await import('../../src/modules/shop/box-random')
      const a = Array.from({ length: 40 }, () => CsprngBoxRandom.stream('same-key').int(1, 1000))
      expect(a.every((n) => n >= 1 && n <= 1000)).toBe(true)
      expect(new Set(a).size).toBeGreaterThan(1)
      const s1 = Array.from({ length: 5 }, ((st) => () => st.int(1, 1000))(SeededBoxRandom.stream('k')))
      const s2 = Array.from({ length: 5 }, ((st) => () => st.int(1, 1000))(SeededBoxRandom.stream('k')))
      expect(s1).toEqual(s2)
    })
  })

  describe('Cabutan Bertuah', () => {
    it('lists only open, not-yet-closed draws ordered by closing date (null last) then id, with own ticket counts and the prize pool', async () => {
      const api = await as(STUDENT_2)
      const late = await insertDraw(t, { title: 'Cabutan Lewat', closesOn: '2026-12-01' })
      const soon = await insertDraw(t, { title: 'Cabutan Awal', closesOn: '2026-10-25' })
      const today = await insertDraw(t, { title: 'Cabutan Hari Ini', closesOn: '2026-10-19' })
      await insertDraw(t, { title: 'Cabutan Tamat', closesOn: '2026-10-18' })
      await insertDraw(t, { title: 'Cabutan Draf', status: 'draft', closesOn: '2026-12-31' })
      await insertDraw(t, { title: 'Cabutan Tutup', status: 'closed', closesOn: '2026-12-31' })
      const never = await insertDraw(t, { title: 'Cabutan Tanpa Tarikh', closesOn: null })
      const view = RewardCabutanViewSchema.parse((await api.get('/cabutan')).body.data)
      const mine = view.draws.filter((d) => [late, soon, today, never].includes(d.id))
      expect(mine.map((d) => d.title)).toEqual(['Cabutan Hari Ini', 'Cabutan Awal', 'Cabutan Lewat', 'Cabutan Tanpa Tarikh'])
      expect(view.draws.map((d) => d.title)).not.toContain('Cabutan Tamat')
      expect(view.draws.map((d) => d.title)).not.toContain('Cabutan Draf')
      expect(mine[0]).toMatchObject({ closesAt: '2026-10-19', ticketsOwned: 0, ticketCostSyiling: 5, maxTicketsPerStudent: 3, prizePool: [{ label: 'Hadiah Utama', valueSen: 5000, qty: 1 }, { label: 'Hadiah Saguhati', valueSen: 1000, qty: 2 }] })
      expect(mine[3]!.closesAt).toBeNull()
      // The seeded demo draw is there too.
      expect(view.draws.some((d) => d.title === 'Cabutan Demo')).toBe(true)
    })

    it('sells tickets: 201, syiling debited per ticket with a ticket-specific ledger key, until TICKET_LIMIT', async () => {
      const api = await as(STUDENT_MAJU)
      const uid = await userIdOf(t.db, STUDENT_MAJU)
      await fund(t, uid, { syiling: 100 }, 'tickets')
      const draw = await insertDraw(t, { title: 'Cabutan Tiket', cost: 7, max: 2 })
      const before = await walletRow(t, uid)
      const a = await api.post(`/cabutan/${draw}/tickets`)
      expect(a.status, JSON.stringify(a.body)).toBe(201)
      expect(RewardTicketBoughtSchema.parse(a.body.data)).toEqual({ drawId: draw, ticketsOwned: 1, syilingBalance: before.syiling - 7 })
      const b = await api.post(`/cabutan/${draw}/tickets`)
      expect(RewardTicketBoughtSchema.parse(b.body.data)).toEqual({ drawId: draw, ticketsOwned: 2, syilingBalance: before.syiling - 14 })
      expectError(await api.post(`/cabutan/${draw}/tickets`), 409, 'TICKET_LIMIT', 'Had tiket dicapai.')
      expect((await walletRow(t, uid)).syiling).toBe(before.syiling - 14)
      const led = await t.db.query<{ type: string; amount: number; description: string }>(`select type, amount, description from coin_ledger where user_id = $1 and source = 'cabutan_ticket' order by id`, [uid])
      expect(led).toEqual([
        { type: 'spend', amount: -7, description: 'Tiket Cabutan: Cabutan Tiket' },
        { type: 'spend', amount: -7, description: 'Tiket Cabutan: Cabutan Tiket' },
      ])
      expect(await t.db.query(`select 1 from draw_tickets where draw_id = $1 and user_id = $2`, [draw, uid])).toHaveLength(2)
      const view = RewardCabutanViewSchema.parse((await api.get('/cabutan')).body.data)
      expect(view.draws.find((d) => d.id === draw)!.ticketsOwned).toBe(2)
      expect(view.syilingBalance).toBe(before.syiling - 14)
    })

    it('409 DRAW_CLOSED for a missing, draft, closed or date-expired draw; 409 INSUFFICIENT_BALANCE writes nothing; non-numeric id is 404', async () => {
      const api = await as(STUDENT_2)
      const uid = await userIdOf(t.db, STUDENT_2)
      expectError(await api.post('/cabutan/999999/tickets'), 409, 'DRAW_CLOSED', 'Cabutan ditutup.')
      for (const o of [{ status: 'draft' }, { status: 'closed' }, { closesOn: '2026-10-18' }]) {
        expectError(await api.post(`/cabutan/${await insertDraw(t, o)}/tickets`), 409, 'DRAW_CLOSED', 'Cabutan ditutup.')
      }
      expectError(await api.post('/cabutan/abc/tickets'), 404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
      const dear = await insertDraw(t, { cost: 99_999 })
      const before = await walletRow(t, uid)
      expectError(await api.post(`/cabutan/${dear}/tickets`), 409, 'INSUFFICIENT_BALANCE', 'Baki syiling tidak mencukupi.')
      expect(await walletRow(t, uid)).toEqual(before)
      expect(await t.db.query(`select 1 from draw_tickets where draw_id = $1`, [dear])).toHaveLength(0)
    })

    it('a draw that closes today still sells; the next Malaysia day it does not (the injected clock, not Date.now)', async () => {
      const uid = await userIdOf(t.db, STUDENT_MAJU)
      await fund(t, uid, { syiling: 50 }, 'closing')
      const draw = await insertDraw(t, { closesOn: '2026-10-19' })
      t.clock.set('2026-10-19T23:59:00+08:00')
      await t.shop.buyTicket(actorFor(uid), draw)
      t.clock.set('2026-10-20T00:00:30+08:00')
      expect((await refusal(t.shop.buyTicket(actorFor(uid), draw))).code).toBe('DRAW_CLOSED')
      t.clock.set('2026-10-19T09:00:00+08:00')
    })
  })

  describe('clientUuid over HTTP (S7-T05, DM-78)', () => {
    it('a repeated redeem and a repeated ticket answer 201 with the same result; a bad key is 422 fields.clientUuid', async () => {
      const api = await as(STUDENT_MAJU)
      const uid = await userIdOf(t.db, STUDENT_MAJU)
      await fund(t, uid, { tokens: 5, syiling: 10 }, 'http-key')
      const reward = await insertReward(t, { tokenCost: 5, stock: null })
      const body = { rewardId: reward, clientUuid: '0b9d6c1e-3f2a-4e7b-8c5d-2a1f0e9d8c7b' }
      const first = await api.post('/hadiah/redemptions', body)
      const second = await api.post('/hadiah/redemptions', body)
      expect(first.status, JSON.stringify(first.body)).toBe(201)
      expect(second.status).toBe(201)
      expect(RewardRedeemResultSchema.parse(second.body.data)).toEqual(RewardRedeemResultSchema.parse(first.body.data))
      expectError(await api.post('/hadiah/redemptions', { rewardId: reward, clientUuid: 'x' }), 422, 'VALIDATION_ERROR')
      const draw = await insertDraw(t, { cost: 1, max: 5 })
      const ticket = { clientUuid: '1c0e7d2f-4a3b-4f8c-9d6e-3b2a1f0e9d8c' }
      const a = await api.post(`/cabutan/${draw}/tickets`, ticket)
      const b = await api.post(`/cabutan/${draw}/tickets`, ticket)
      expect(a.status, JSON.stringify(a.body)).toBe(201)
      expect(RewardTicketBoughtSchema.parse(b.body.data)).toEqual(RewardTicketBoughtSchema.parse(a.body.data))
      expectError(await api.post(`/cabutan/${draw}/tickets`, { clientUuid: 'x' }), 422, 'VALIDATION_ERROR')
    })
  })

  describe('Mod Pelajar (admin acting as a student)', () => {
    it('refuses every spending write with 403 and writes nothing; reads still work', async () => {
      const me = await login(t, ADMIN)
      const entered = await me.agent.post('/api/session/mode').set('X-CSRF-Token', me.csrf).send({ mode: 'mod_pelajar' })
      expect(entered.status, JSON.stringify(entered.body)).toBeLessThan(300)
      const api = apiOf({ ...me, csrf: entered.body.data.csrf })
      const uid = await userIdOf(t.db, ADMIN)
      await fund(t, uid, { tokens: 100, syiling: 100 }, 'modp')
      const reward = await insertReward(t, { stock: 5, tokenCost: 3 })
      const draw = await insertDraw(t, { cost: 2 })
      const before = await walletRow(t, uid)
      const e1 = expectError(await api.post('/hadiah/redemptions', { rewardId: reward }), 403, 'FORBIDDEN', 'Tidak dibenarkan dalam Mod Pelajar.')
      expect(e1.code).toBe('FORBIDDEN')
      expectError(await api.post('/gamification/mystery-boxes/1/open'), 403, 'FORBIDDEN', 'Tidak dibenarkan dalam Mod Pelajar.')
      expectError(await api.post(`/cabutan/${draw}/tickets`), 403, 'FORBIDDEN', 'Tidak dibenarkan dalam Mod Pelajar.')
      expect(await walletRow(t, uid)).toEqual(before)
      expect(await stockOf(t, reward)).toBe(5)
      expect(await t.db.query(`select 1 from reward_redemptions where user_id = $1`, [uid])).toHaveLength(0)
      expect(await t.db.query(`select 1 from draw_tickets where user_id = $1`, [uid])).toHaveLength(0)
      expect(await t.db.query(`select 1 from mystery_box_openings where user_id = $1`, [uid])).toHaveLength(0)
      expect((await api.get('/cabutan')).status).toBe(200)
      expect((await api.get('/gamification/mystery-boxes')).status).toBe(200)
    })
  })

  describe('rate limit', () => {
    it('answers 429 RATE_LIMITED on the spending writes past the per-user ceiling', async () => {
      const limited = await bootShopApp({ env: { THROTTLE_SHOP_WRITE_PER_MINUTE: '3' } })
      try {
        const api = apiOf(await login(limited, STUDENT))
        for (let i = 0; i < 3; i++) await api.post('/cabutan/1/tickets')
        expectError(await api.post('/cabutan/1/tickets'), 429, 'RATE_LIMITED', 'Terlalu banyak percubaan. Sila cuba sebentar lagi.')
      } finally {
        await limited.close()
      }
    })
  })
})
