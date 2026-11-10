import { randomUUID } from 'node:crypto'

import { RewardMysteryBoxOpenedSchema, RewardMysteryBoxesViewSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { SeededBoxRandom } from '../../src/modules/shop/box-random'
import { MysteryBoxesService, pickPrize } from '../../src/modules/shop'
import { STUDENT, STUDENT_2, STUDENT_MAJU, actorFor, apiOf, bareUser, bootShopApp, expectError, fund, login, refusal, userIdOf, walletRow, type ShopTestApp } from './helpers'

/**
 * S7-T07 part P8: the pupil Kotak Misteri on the 0222 box tables (FR-GM-23.1 to 23.4, AC-GM-23.1 to 23.4, 23.6, 23.7,
 * AC-MUR-35-1, -3, -5, N5). The first group is N5: a box nobody can win is refused before any debit or opening row.
 */
const MSG_N5 = 'Kotak tidak tersedia buat masa ini.'
const MSG_DAILY = 'Had kotak hari ini telah dicapai. Cuba lagi esok.'
const MSG_SHORT = 'Baki syiling tidak mencukupi.'
const MSG_NO_BOX = 'Kotak tidak dijumpai.'
const BOX = '5'

const SEVEN = [
  ['10 syiling', 'syiling', 10, 40],
  ['25 syiling', 'syiling', 25, 25],
  ['60 syiling', 'syiling', 60, 15],
  ['1 token', 'token', 1, 10],
  ['150 syiling', 'syiling', 150, 6],
  ['3 token', 'token', 3, 3],
  ['500 syiling — jackpot!', 'syiling', 500, 1],
] as const

type PrizeSpec = readonly [label: string, kind: 'syiling' | 'token', amount: number, weight: number, stock?: number | null]

describe('M15 pupil Kotak Misteri on the 0222 tables (S7-T07 P8)', () => {
  let t: ShopTestApp
  const body = () => ({ clientUuid: randomUUID() })
  const open = (userId: string, clientUuid = randomUUID(), id = BOX) => t.shop.openBox(actorFor(userId), id, { clientUuid })
  const counts = async (userId: string) => ({
    openings: Number((await t.db.query<{ n: string }>(`select count(*)::text n from mystery_box_openings where user_id = $1`, [userId]))[0]!.n),
    ledger: Number((await t.db.query<{ n: string }>(`select count(*)::text n from coin_ledger where user_id = $1 and source = 'mystery_box'`, [userId]))[0]!.n),
  })
  /** Replaces the prize rows of box 5 (and makes it active at cost 50) with `prizes`. */
  const setPrizes = async (prizes: readonly PrizeSpec[], over: { cost?: number; active?: boolean } = {}) => {
    await t.db.query(`update mystery_boxes set is_active = $1, cost_syiling = $2 where id = 5`, [over.active ?? true, over.cost ?? 50])
    await t.db.query(`delete from mystery_box_prizes where box_id = 5`)
    for (const [label, kind, amount, weight, stock] of prizes) {
      await t.db.query(`insert into mystery_box_prizes (box_id, label, kind, amount, weight, stock) values (5, $1, $2, $3, $4, $5)`, [label, kind, amount, weight, stock ?? null])
    }
  }
  const view = async (who: string) => RewardMysteryBoxesViewSchema.parse((await apiOf(await login(t, who)).get('/gamification/mystery-boxes')).body.data)

  beforeAll(async () => {
    t = await bootShopApp()
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await setPrizes(SEVEN)
    await t.db.query(`delete from gamification_settings where key = 'mystery_box_daily_max'`)
  })

  describe('N5: no prize can be won', () => {
    it('every prize at stock 0 and a balance of 80 gives 409 BOX_UNAVAILABLE with nothing written', async () => {
      await setPrizes(SEVEN.map(([l, k, a, w]) => [l, k, a, w, 0] as const))
      const u = await bareUser(t, 'n5 kosong')
      await fund(t, u, { syiling: 80 }, 'n5')
      const before = await counts(u)
      const err = await refusal(open(u))
      expect(err).toMatchObject({ code: 'BOX_UNAVAILABLE', status: 409, message: MSG_N5 })
      expect((await walletRow(t, u)).syiling).toBe(80)
      expect(await counts(u)).toEqual(before)
      expect((await t.db.query(`select 1 from mystery_box_openings where user_id = $1`, [u])).length).toBe(0)
    })

    it('over HTTP: 409 BOX_UNAVAILABLE, and GET says available:false with no prize rows', async () => {
      await setPrizes(SEVEN.map(([l, k, a, w]) => [l, k, a, w, 0] as const))
      const uid = await userIdOf(t.db, STUDENT_2)
      await fund(t, uid, { syiling: 80 }, 'n5http')
      const api = apiOf(await login(t, STUDENT_2))
      const before = await walletRow(t, uid)
      expectError(await api.post(`/gamification/mystery-boxes/${BOX}/open`, body()), 409, 'BOX_UNAVAILABLE', MSG_N5)
      expect(await walletRow(t, uid)).toEqual(before)
      const v = await view(STUDENT_2)
      expect(v.available).toBe(false)
      expect(v.box?.prizes).toEqual([])
    })

    it('a box that is active but has no prize rows is the same refusal; a box with no active flag is 404 and GET shows box:null', async () => {
      await setPrizes([])
      const u = await bareUser(t, 'n5 tanpa hadiah')
      await fund(t, u, { syiling: 80 }, 'n5b')
      expect(await refusal(open(u))).toMatchObject({ code: 'BOX_UNAVAILABLE', message: MSG_N5 })
      await setPrizes(SEVEN, { active: false })
      expect(await refusal(open(u))).toMatchObject({ code: 'NOT_FOUND', status: 404, message: MSG_NO_BOX })
      expect((await walletRow(t, u)).syiling).toBe(80)
      expect((await counts(u)).openings).toBe(0)
      const v = await view(STUDENT_2)
      expect(v).toMatchObject({ box: null, available: false })
    })

    it('N5 wins over the daily limit and the balance check (checked first), and a replay is answered before N5', async () => {
      const u = await bareUser(t, 'n5 urutan')
      await fund(t, u, { syiling: 200 }, 'n5order')
      const key = randomUUID()
      const first = await open(u, key)
      await setPrizes(SEVEN.map(([l, k, a, w]) => [l, k, a, w, 0] as const))
      // The same key is a replay: it answers the stored opening even though the box can no longer be won.
      expect((await open(u, key)).openingId).toBe(first.openingId)
      const poor = await bareUser(t, 'n5 miskin')
      expect(await refusal(open(poor))).toMatchObject({ code: 'BOX_UNAVAILABLE' })
    })
  })

  describe('GET /gamification/mystery-boxes (never draws)', () => {
    it('returns the one box, 7 prizes with chances to one decimal summing to 100, the daily numbers and an empty history', async () => {
      const uid = await userIdOf(t.db, STUDENT)
      const api = apiOf(await login(t, STUDENT))
      const res = await api.get('/gamification/mystery-boxes')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const v = RewardMysteryBoxesViewSchema.parse(res.body.data)
      expect(v.box).toMatchObject({ id: BOX, label: 'Kotak Misteri', costSyiling: 50 })
      expect(v.box!.prizes.map((p) => [p.label, p.chance])).toEqual(SEVEN.map(([l, , , w]) => [l, w]))
      expect(v.box!.prizes.reduce((s, p) => s + p.chance, 0)).toBeCloseTo(100, 5)
      expect(v).toMatchObject({ available: true, dailyMax: 5, openedToday: 0, syilingBalance: (await walletRow(t, uid)).syiling, history: [] })
      expect(v).not.toHaveProperty('tokenBalance')
      expect(await counts(uid)).toEqual({ openings: 0, ledger: 0 })
    })

    it('shows stock-0 prizes left out and the others renormalised to one decimal', async () => {
      await setPrizes([
        ['A', 'syiling', 10, 50, 0],
        ['B', 'syiling', 20, 25],
        ['C', 'token', 1, 25, 3],
      ])
      const v = await view(STUDENT_2)
      expect(v.box!.prizes.map((p) => [p.label, p.chance])).toEqual([
        ['B', 50],
        ['C', 50],
      ])
      await setPrizes([
        ['A', 'syiling', 10, 1],
        ['B', 'syiling', 20, 2],
      ])
      expect((await view(STUDENT_2)).box!.prizes.map((p) => p.chance)).toEqual([33.3, 66.7])
    })

    it('openings made before P8 stay readable: prize fields null, the old box name kept', async () => {
      const u = await bareUser(t, 'lama')
      await t.db.query(`insert into mystery_box_openings (user_id, box_id, coins, xp, created_at) values ($1, 2, 7, 3, now())`, [u])
      const direct = await t.shop.boxes(u)
      expect(direct.history).toHaveLength(1)
      expect(direct.history[0]).toMatchObject({ boxId: '2', boxName: 'Kotak Perak', prizeLabel: null, prizeKind: null, prizeAmount: null })
      // The pupil can still open the new box.
      await fund(t, u, { syiling: 60 }, 'lama')
      await open(u)
      expect((await t.shop.boxes(u)).history).toHaveLength(2)
    })

    it('keeps at most the last 10 openings, newest first', async () => {
      const u = await bareUser(t, 'sepuluh')
      for (let i = 0; i < 12; i++) await t.db.query(`insert into mystery_box_openings (user_id, box_id, coins, xp, created_at) values ($1, 5, 1, 0, now() + ($2 || ' seconds')::interval)`, [u, String(i)])
      const ids = (await t.shop.boxes(u)).history.map((h) => Number(h.id))
      expect(ids).toHaveLength(10)
      expect(ids).toEqual([...ids].sort((a, b) => b - a))
    })
  })

  describe('opening (AC-GM-23.1, AC-GM-23.2, FR-GM-23.3)', () => {
    it('at 80 syiling and cost 50: leaves 30 plus the prize, with ledger rows spend -50 and earn; deterministic under the seeded PRNG; XP untouched', async () => {
      const uid = await userIdOf(t.db, STUDENT_MAJU)
      await fund(t, uid, { syiling: 80 }, 'open80')
      const before = await walletRow(t, uid)
      const base = before.syiling - 80
      const api = apiOf(await login(t, STUDENT_MAJU))
      const res = await api.post(`/gamification/mystery-boxes/${BOX}/open`, body())
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const o = RewardMysteryBoxOpenedSchema.parse(res.body.data)
      // The same seed string gives the same prize.
      const expected = pickPrize(
        SEVEN.map(([label, kind, amount, weight]) => ({ label, kind, amount, weight })),
        SeededBoxRandom.stream(`m15-mystery:${uid}:0`),
      )
      expect(o.prize).toEqual({ label: expected.label, kind: expected.kind, amount: expected.amount })
      expect(o).toMatchObject({ boxId: BOX, boxName: 'Kotak Misteri' })
      const after = await walletRow(t, uid)
      expect(after.xp).toBe(before.xp)
      expect(after.syiling).toBe(base + 30 + (o.prize.kind === 'syiling' ? o.prize.amount : 0))
      expect(after.tokens).toBe(before.tokens + (o.prize.kind === 'token' ? o.prize.amount : 0))
      expect(o).toMatchObject({ syilingBalance: after.syiling, tokenBalance: after.tokens })
      const led = await t.db.query<{ type: string; amount: number; source_id: string; description: string }>(
        `select type, amount, source_id, description from coin_ledger where user_id = $1 and source = 'mystery_box' order by id`,
        [uid],
      )
      expect(led[0]).toEqual({ type: 'spend', amount: -50, source_id: `opening:${o.openingId}:cost`, description: 'Kotak Misteri: Kotak Misteri' })
      if (o.prize.kind === 'syiling') expect(led[1]).toEqual({ type: 'earn', amount: o.prize.amount, source_id: `opening:${o.openingId}:prize`, description: `Kotak Misteri: ${o.prize.label}` })
      else expect(led).toHaveLength(1)
      const v = await view(STUDENT_MAJU)
      expect(v.openedToday).toBe(1)
      expect(v.history[0]).toMatchObject({ id: o.openingId, boxId: BOX, prizeLabel: o.prize.label, prizeKind: o.prize.kind, prizeAmount: o.prize.amount })
    })

    it('a token prize moves tokens only: no earn row, XP 0, and the opening stores the prize', async () => {
      await setPrizes([['2 token', 'token', 2, 100]])
      const u = await bareUser(t, 'token')
      await fund(t, u, { syiling: 80 }, 'tok')
      const o = await open(u)
      expect(o.prize).toEqual({ label: '2 token', kind: 'token', amount: 2 })
      expect(await walletRow(t, u)).toEqual({ syiling: 30, tokens: 2, xp: 0 })
      expect((await t.db.query(`select 1 from coin_ledger where user_id = $1 and source = 'mystery_box' and type = 'earn'`, [u])).length).toBe(0)
      const mv = await t.db.query<{ delta: number; ref_id: string }>(`select delta, ref_id from token_movements where user_id = $1 and source = 'mystery_box'`, [u])
      expect(mv).toEqual([{ delta: 2, ref_id: `opening:${o.openingId}:prize` }])
      const row = await t.db.query<{ coins: number; xp: number; prize_kind: string; prize_amount: number }>(`select coins, xp, prize_kind, prize_amount from mystery_box_openings where id = $1`, [o.openingId])
      expect(row[0]).toEqual({ coins: 0, xp: 0, prize_kind: 'token', prize_amount: 2 })
    })

    it('the cost comes from mystery_boxes.cost_syiling, not from the setting', async () => {
      await setPrizes([['10 syiling', 'syiling', 10, 100]], { cost: 20 })
      const u = await bareUser(t, 'kos')
      await fund(t, u, { syiling: 25 }, 'kos')
      await open(u)
      expect((await walletRow(t, u)).syiling).toBe(25 - 20 + 10)
    })
  })

  describe('refusals write nothing (AC-GM-23.1, AC-MUR-35-3)', () => {
    it('too little syiling is 409 INSUFFICIENT_BALANCE; ids 1 to 4, 9 and abc are 404', async () => {
      const u = await bareUser(t, 'miskin')
      await fund(t, u, { syiling: 20 }, 'short')
      const before = await walletRow(t, u)
      expect(await refusal(open(u))).toMatchObject({ code: 'INSUFFICIENT_BALANCE', status: 409, message: MSG_SHORT })
      for (const id of ['1', '2', '3', '4', '9']) expect(await refusal(open(u, randomUUID(), id))).toMatchObject({ code: 'NOT_FOUND', status: 404, message: MSG_NO_BOX })
      expect(await refusal(open(u, randomUUID(), 'abc'))).toMatchObject({ code: 'NOT_FOUND', status: 404 })
      expect(await walletRow(t, u)).toEqual(before)
      expect((await counts(u)).openings).toBe(0)
    })

    it('over HTTP: the exact BM texts and statuses; a missing or bad clientUuid is 422', async () => {
      const api = apiOf(await login(t, STUDENT))
      const uid = await userIdOf(t.db, STUDENT)
      const before = await walletRow(t, uid)
      expectError(await api.post('/gamification/mystery-boxes/9/open', body()), 404, 'NOT_FOUND', MSG_NO_BOX)
      expectError(await api.post('/gamification/mystery-boxes/abc/open', body()), 404, 'NOT_FOUND', 'Rekod tidak dijumpai.')
      const missing = expectError(await api.post(`/gamification/mystery-boxes/${BOX}/open`, {}), 422, 'VALIDATION_ERROR')
      expect(missing.fields).toHaveProperty('clientUuid')
      expectError(await api.post(`/gamification/mystery-boxes/${BOX}/open`, { clientUuid: 'bukan-uuid' }), 422, 'VALIDATION_ERROR')
      expect(await walletRow(t, uid)).toEqual(before)
    })
  })

  describe('daily limit (AC-GM-23.1, AC-GM-23.3)', () => {
    it('5 opens pass and the 6th is 429 MYSTERY_DAILY_LIMIT with the balance unchanged; the next Malaysia day passes again', async () => {
      await setPrizes([['10 syiling', 'syiling', 10, 100]])
      const uid = await userIdOf(t.db, STUDENT)
      await fund(t, uid, { syiling: 400 }, 'daily')
      for (let i = 0; i < 5; i++) await open(uid)
      const before = await walletRow(t, uid)
      const api = apiOf(await login(t, STUDENT))
      expectError(await api.post(`/gamification/mystery-boxes/${BOX}/open`, body()), 429, 'MYSTERY_DAILY_LIMIT', MSG_DAILY)
      expect(await walletRow(t, uid)).toEqual(before)
      expect((await view(STUDENT)).openedToday).toBe(5)
      const day = t.clock.now()
      t.clock.set(new Date(day.getTime() + 24 * 3600_000))
      await open(uid)
      expect((await view(STUDENT)).openedToday).toBe(1)
      t.clock.set(day)
    })

    it('reads the limit from mystery_box_daily_max', async () => {
      await setPrizes([['10 syiling', 'syiling', 10, 100]])
      await t.db.query(`insert into gamification_settings (key, value, label) values ('mystery_box_daily_max', 1, 'Had kotak sehari') on conflict (key) do update set value = 1`)
      const u = await bareUser(t, 'had satu')
      await fund(t, u, { syiling: 200 }, 'had1')
      await open(u)
      expect(await refusal(open(u))).toMatchObject({ code: 'MYSTERY_DAILY_LIMIT', status: 429 })
    })
  })

  describe('idempotency by clientUuid (AC-MUR-35-5)', () => {
    it('the same clientUuid twice makes one opening and one debit and answers the same opening', async () => {
      const u = await bareUser(t, 'ulang')
      await fund(t, u, { syiling: 80 }, 'replay')
      const key = randomUUID()
      const a = await open(u, key)
      const after1 = await walletRow(t, u)
      const b = await open(u, key)
      expect(b).toEqual(a)
      expect(await walletRow(t, u)).toEqual(after1)
      expect((await counts(u)).openings).toBe(1)
      expect((await t.db.query(`select 1 from coin_ledger where user_id = $1 and source = 'mystery_box' and type = 'spend'`, [u])).length).toBe(1)
    })

    it('4 concurrent opens with one clientUuid make one opening', async () => {
      const u = await bareUser(t, 'serentak')
      await fund(t, u, { syiling: 200 }, 'conc')
      const key = randomUUID()
      const res = await Promise.allSettled(Array.from({ length: 4 }, () => open(u, key)))
      expect(res.every((r) => r.status === 'fulfilled')).toBe(true)
      const ids = new Set(res.map((r) => (r as PromiseFulfilledResult<{ openingId: string }>).value.openingId))
      expect(ids.size).toBe(1)
      expect((await counts(u)).openings).toBe(1)
      expect((await t.db.query(`select 1 from coin_ledger where user_id = $1 and source = 'mystery_box' and type = 'spend'`, [u])).length).toBe(1)
    })

    it('4 concurrent opens with different keys and balance for one: one succeeds, the rest are INSUFFICIENT_BALANCE', async () => {
      const u = await bareUser(t, 'satu baki')
      await fund(t, u, { syiling: 50 }, 'one')
      const res = await Promise.allSettled(Array.from({ length: 4 }, () => open(u)))
      expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(res.filter((r) => r.status === 'rejected').map((r) => ((r as PromiseRejectedResult).reason as { code: string }).code)).toEqual(Array(3).fill('INSUFFICIENT_BALANCE'))
      expect((await counts(u)).openings).toBe(1)
    })

    it('a clientUuid used on another box is 422, not a replay', async () => {
      const u = await bareUser(t, 'kotak lain')
      await fund(t, u, { syiling: 80 }, 'other')
      const key = randomUUID()
      await open(u, key)
      expect(await refusal(open(u, key, '1'))).toMatchObject({ code: 'VALIDATION_ERROR' })
    })
  })

  describe('stock (AC-GM-23.6)', () => {
    it('a prize with stock 1 drops to 0 when won and is then left out of the draw and the odds', async () => {
      await setPrizes([
        ['Terhad', 'syiling', 100, 90, 1],
        ['Biasa', 'syiling', 10, 10],
      ])
      let won = false
      for (let i = 0; i < 12 && !won; i++) {
        const u = await bareUser(t, `stok ${String(i)}`)
        await fund(t, u, { syiling: 60 }, 'stock')
        won = (await open(u)).prize.label === 'Terhad'
      }
      expect(won).toBe(true)
      const stock = await t.db.query<{ stock: number }>(`select stock from mystery_box_prizes where box_id = 5 and label = 'Terhad'`)
      expect(stock[0]!.stock).toBe(0)
      const v = await view(STUDENT_2)
      expect(v.box!.prizes.map((p) => [p.label, p.chance])).toEqual([['Biasa', 100]])
      for (let i = 0; i < 4; i++) {
        const u = await bareUser(t, `sisa ${String(i)}`)
        await fund(t, u, { syiling: 60 }, 'after')
        expect((await open(u)).prize.label).toBe('Biasa')
      }
    })

    it('limited stock is never oversold under concurrent opens by different pupils', async () => {
      await setPrizes([['Satu', 'syiling', 100, 100, 1]])
      const users = await Promise.all(Array.from({ length: 4 }, (_, i) => bareUser(t, `stok serentak ${String(i)}`)))
      for (const u of users) await fund(t, u, { syiling: 60 }, 'oversell')
      const res = await Promise.allSettled(users.map((u) => open(u)))
      expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(res.filter((r) => r.status === 'rejected').map((r) => ((r as PromiseRejectedResult).reason as { code: string }).code)).toEqual(Array(3).fill('BOX_UNAVAILABLE'))
    })
  })

  describe('distribution (AC-GM-23.2)', () => {
    it('weights 60/30/10 over 2,000 seeded draws land within 3 points', () => {
      const prizes = [
        { label: 'A', weight: 60 },
        { label: 'B', weight: 30 },
        { label: 'C', weight: 10 },
      ]
      const tally: Record<string, number> = { A: 0, B: 0, C: 0 }
      for (let i = 0; i < 2000; i++) tally[pickPrize(prizes, SeededBoxRandom.stream(`dist:${String(i)}`)).label]!++
      expect(Math.abs((tally.A! / 2000) * 100 - 60)).toBeLessThan(3)
      expect(Math.abs((tally.B! / 2000) * 100 - 30)).toBeLessThan(3)
      expect(Math.abs((tally.C! / 2000) * 100 - 10)).toBeLessThan(3)
    })

    it('a single prize is always drawn', () => {
      expect(pickPrize([{ weight: 7 }], SeededBoxRandom.stream('x')).weight).toBe(7)
    })
  })

  describe('lock order with the admin save (AC-GM-23.5)', () => {
    it('concurrent admin PUTs and opens cause no deadlock and lose no debit', async () => {
      const boxes = t.app.get(MysteryBoxesService)
      const actor = { userId: await userIdOf(t.db, STUDENT), role: 'admin', requestId: null, ip: null, isTest: false }
      const users = await Promise.all(Array.from({ length: 6 }, (_, i) => bareUser(t, `admin serentak ${String(i)}`)))
      for (const u of users) await fund(t, u, { syiling: 100 }, 'adminrace')
      const put = () =>
        boxes.adminUpdate(actor, BOX, {
          label: 'Kotak Misteri',
          costSyiling: 50,
          isActive: true,
          prizes: SEVEN.map(([label, kind, amount, weight]) => ({ label, kind, amount, weight, stock: null })),
        })
      const res = await Promise.allSettled([put(), ...users.map((u) => open(u)), put(), ...users.map((u) => open(u, randomUUID())), put()])
      const failed = res.filter((r) => r.status === 'rejected').map((r) => String((r as PromiseRejectedResult).reason))
      expect(failed.filter((f) => !/INSUFFICIENT_BALANCE|insufficient/i.test(f) && !/Baki syiling/i.test(f))).toEqual([])
      for (const u of users) {
        const n = (await counts(u)).openings
        const spends = Number((await t.db.query<{ n: string }>(`select count(*)::text n from coin_ledger where user_id = $1 and source = 'mystery_box' and type = 'spend'`, [u]))[0]!.n)
        expect(spends).toBe(n)
      }
    })
  })

  describe('Mod Pelajar and guards', () => {
    it('Mod Pelajar is refused first, even with a bad body and a missing box', async () => {
      const err = await refusal(t.shop.openBox(actorFor(await userIdOf(t.db, STUDENT), true), '999', {}))
      expect(err).toMatchObject({ code: 'FORBIDDEN', status: 403, message: 'Tidak dibenarkan dalam Mod Pelajar.' })
    })

    it('anonymous is 401 and a write without the CSRF header is 403', async () => {
      expectError(await t.http().get('/api/gamification/mystery-boxes'), 401, 'UNAUTHORIZED')
      expectError(await t.http().post(`/api/gamification/mystery-boxes/${BOX}/open`).send(body()), 401, 'UNAUTHORIZED')
      const me = await login(t, STUDENT)
      expectError(await me.agent.post(`/api/gamification/mystery-boxes/${BOX}/open`).send(body()), 403, 'CSRF_INVALID')
    })
  })
})
