import { GamificationConvertResultSchema, GamificationConvertViewSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, STUDENT_MAJU, bareUser, bootGamificationApp, dataOf, fail, ledgerOf, signIn, signInMod, userIdOf, walletOf, type Client, type GamificationTestApp } from './helpers'

const MSG = 'Jumlah syiling tidak sah.'

describe('POST /api/gamification/convert (AC3, AC4)', () => {
  let t: GamificationTestApp
  let student: Client
  let maju: Client
  let admin: Client
  let studentId: string
  let majuId: string

  beforeAll(async () => {
    t = await bootGamificationApp()
    student = await signIn(t, STUDENT)
    maju = await signIn(t, STUDENT_MAJU)
    admin = await signIn(t, ADMIN)
    studentId = await userIdOf(t.db, STUDENT)
    majuId = await userIdOf(t.db, STUDENT_MAJU)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('converts 100 syiling at the bronze rate 50: 2 tokens, the ledger row, lifetime and tier unchanged (mock replay)', async () => {
    const before = await walletOf(t, studentId)
    const res = await student.post('/gamification/convert', { syilingAmount: 100 })
    expect(res.status).toBe(200)
    const d = GamificationConvertResultSchema.parse(dataOf(res))
    expect(d).toMatchObject({ syilingDebited: 100, tokensCredited: 2, currentSyiling: before!.current_syiling - 100, tokenBalance: before!.token_balance + 2 })
    const rows = await ledgerOf(t, studentId)
    const row = rows.find((r) => r.id === d.transactionId)!
    expect(row).toMatchObject({ type: 'convert', source: 'token_conversion', amount: -100, tokens: 2, description: 'Tukar 100 syiling → 2 token', balance_after: d.currentSyiling, is_test: false })
    const after = await walletOf(t, studentId)
    expect(after).toMatchObject({ total_syiling_earned: before!.total_syiling_earned, tier_name: 'bronze', current_syiling: d.currentSyiling, token_balance: d.tokenBalance })
    expect(res.headers['cache-control']).toMatch(/no-store/)
  })

  it('the remainder is not refunded (floor) and the GET view follows the new balance', async () => {
    const before = await walletOf(t, studentId)
    const d = GamificationConvertResultSchema.parse(dataOf(await student.post('/gamification/convert', { syilingAmount: 99 })))
    expect(d).toMatchObject({ syilingDebited: 99, tokensCredited: 1 })
    const view = GamificationConvertViewSchema.parse(dataOf(await student.get('/gamification/convert')))
    expect(view).toMatchObject({ currentSyiling: before!.current_syiling - 99, tokenBalance: before!.token_balance + 1 })
    expect(view.quick).toEqual([50, 250, before!.current_syiling - 99])
  })

  it('the rate itself is the smallest amount (1 token); a numeric string and the exact balance are accepted', async () => {
    expect(dataOf<{ tokensCredited: number }>(await student.post('/gamification/convert', { syilingAmount: 50 })).tokensCredited).toBe(1)
    const balance = (await walletOf(t, studentId))!.current_syiling
    const res = await student.post('/gamification/convert', { syilingAmount: String(balance) })
    expect(res.status).toBe(200)
    expect(dataOf<{ currentSyiling: number }>(res).currentSyiling).toBe(0)
  })

  it('422 "Jumlah syiling tidak sah." with fields.syilingAmount for every bad amount, and nothing changes', async () => {
    const before = await walletOf(t, majuId)
    const rows = (await ledgerOf(t, majuId)).length
    for (const body of [{ syilingAmount: 49 }, { syilingAmount: 9_999_999 }, { syilingAmount: 100.5 }, { syilingAmount: 'abc' }, { syilingAmount: -50 }, { syilingAmount: 0 }, { syilingAmount: 268 }, { syilingAmount: null }, {}]) {
      const err = fail(await maju.post('/gamification/convert', body), 422, 'VALIDATION_ERROR', MSG)
      expect(err.fields).toEqual({ syilingAmount: MSG })
    }
    expect(await walletOf(t, majuId)).toEqual(before)
    expect(await ledgerOf(t, majuId)).toHaveLength(rows)
  })

  it('a user without a wallet cannot convert (balance 0) and no wallet is created', async () => {
    const id = await bareUser(t, 'Tanpa Dompet')
    const out = t.gamification.convert({ userId: id, isTest: false }, 50, null)
    await expect(out).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fields: { syilingAmount: MSG } })
    expect(await walletOf(t, id)).toBeUndefined()
  })

  it('the rate is read from the database tier: an admin edit of the rate applies at once; silver pays at its own rate', async () => {
    // maju (267, bronze) is lifted over 500 by a credit: the tier moves up to silver (rate 40).
    await t.wallet.credit({ userId: majuId, amount: 300, source: 'quiz_practice', sourceId: 'conv-up', description: 'Latih Tubi: 30 betul', isTest: false })
    expect((await walletOf(t, majuId))!.tier_name).toBe('silver')
    const d = GamificationConvertResultSchema.parse(dataOf(await maju.post('/gamification/convert', { syilingAmount: 100 })))
    expect(d.tokensCredited).toBe(2) // floor(100 / 40)
    await admin.put(`/admin/gamification/tiers/${(await t.db.query<{ id: string }>(`select id::text from tiers where tier_name = 'silver'`))[0]!.id}`, {
      labelMs: 'Perak', icon: '🥈', minSyiling: 500, conversionRate: 25, sortOrder: 2, quizRewardL1: 1, quizRewardL2: 2, quizRewardL3: 3, quizRewardL4: 4, quizRewardL5: 5, pkskRewardCorrect: 5, boardGameRewardCorrect: 5, boardGameRewardWin: 25,
    })
    expect(dataOf<{ tokensCredited: number }>(await maju.post('/gamification/convert', { syilingAmount: 100 })).tokensCredited).toBe(4)
  })

  describe('idempotency (documented choice)', () => {
    it('without a header two identical conversions both run (no key, no cap)', async () => {
      const id = await bareUser(t, 'Dua Kali')
      await t.wallet.credit({ userId: id, amount: 500, source: 'quiz_practice', sourceId: 'twice', description: 'Latih Tubi: 50 betul', isTest: false })
      const a = await t.gamification.convert({ userId: id, isTest: false }, 100, null)
      const b = await t.gamification.convert({ userId: id, isTest: false }, 100, null)
      expect(a.transactionId).not.toBe(b.transactionId)
      expect((await walletOf(t, id))!.current_syiling).toBe(300)
    })

    it('with Idempotency-Key a repeat returns the FIRST result and debits once; another amount under the key is 409', async () => {
      await t.wallet.credit({ userId: majuId, amount: 400, source: 'quiz_practice', sourceId: 'idem-up', description: 'Latih Tubi: 40 betul', isTest: false })
      const before = (await walletOf(t, majuId))!
      const first = await maju.post('/gamification/convert', { syilingAmount: 100 }, { 'Idempotency-Key': 'k-0001' })
      const second = await maju.post('/gamification/convert', { syilingAmount: 100 }, { 'Idempotency-Key': 'k-0001' })
      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(dataOf<{ transactionId: string }>(second).transactionId).toBe(dataOf<{ transactionId: string }>(first).transactionId)
      expect(dataOf<{ tokensCredited: number }>(second).tokensCredited).toBe(dataOf<{ tokensCredited: number }>(first).tokensCredited)
      expect((await walletOf(t, majuId))!.current_syiling).toBe(before.current_syiling - 100)
      expect((await ledgerOf(t, majuId)).filter((r) => r.source_id === 'convert:k-0001')).toHaveLength(1)
      fail(await maju.post('/gamification/convert', { syilingAmount: 120 }, { 'Idempotency-Key': 'k-0001' }), 409, 'CONFLICT')
      expect((await maju.post('/gamification/convert', { syilingAmount: 100 }, { 'Idempotency-Key': 'bad key!' })).status).toBe(422)
    })
  })

  it('concurrency: parallel conversions of one wallet never drive the balance negative or pay twice', async () => {
    const id = await bareUser(t, 'Selari')
    await t.wallet.credit({ userId: id, amount: 1000, source: 'quiz_practice', sourceId: 'conc', description: 'Latih Tubi: 100 betul', isTest: false })
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => t.gamification.convert({ userId: id, isTest: false }, 300, null)))
    const done = results.filter((r) => r.status === 'fulfilled')
    const refused = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(done).toHaveLength(3) // 3 x 300 = 900 fit; the 4th would need 300 of the 100 left, so it is refused
    expect(refused.every((r) => r.reason.code === 'VALIDATION_ERROR')).toBe(true)
    const w = (await walletOf(t, id))!
    expect(w.current_syiling).toBeGreaterThanOrEqual(0)
    const rows = (await ledgerOf(t, id)).filter((r) => r.type === 'convert')
    expect(w.token_balance).toBe(rows.reduce((a, r) => a + (r.tokens ?? 0), 0))
    expect(rows.reduce((a, r) => a - r.amount, 0)).toBe(1000 - w.current_syiling)
  })

  describe('Mod Pelajar (admin impersonating a student)', () => {
    it('the conversion is allowed and every row it writes is stamped is_test; the admin routes are closed while the mode is on', async () => {
      const adminId = await userIdOf(t.db, ADMIN)
      const start = (await walletOf(t, adminId))!
      const mod = await signInMod(t, ADMIN)
      const res = await mod.post('/gamification/convert', { syilingAmount: 100 })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const d = GamificationConvertResultSchema.parse(dataOf(res))
      expect(d).toMatchObject({ tokensCredited: 2, currentSyiling: start.current_syiling - 100 })
      const row = (await ledgerOf(t, adminId)).find((r) => r.id === d.transactionId)!
      expect(row).toMatchObject({ type: 'convert', is_test: true })
      fail(await mod.get('/admin/gamification/overview'), 403, 'FORBIDDEN')
    })
  })
})
