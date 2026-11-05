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

  it('FR-GM-18.1: the debit is tokens x rate, the remainder stays, and the GET view follows the new balance', async () => {
    const before = await walletOf(t, studentId)
    const d = GamificationConvertResultSchema.parse(dataOf(await student.post('/gamification/convert', { syilingAmount: 99 })))
    expect(d).toMatchObject({ syilingDebited: 50, tokensCredited: 1, currentSyiling: before!.current_syiling - 50 })
    const rows = await ledgerOf(t, studentId)
    expect(rows.find((r) => r.id === d.transactionId)).toMatchObject({ amount: -50, tokens: 1, description: 'Tukar 50 syiling → 1 token', balance_after: d.currentSyiling })
    const view = GamificationConvertViewSchema.parse(dataOf(await student.get('/gamification/convert')))
    expect(view).toMatchObject({ currentSyiling: before!.current_syiling - 50, tokenBalance: before!.token_balance + 1 })
    expect(view.quick).toEqual([50, 250, before!.current_syiling - 50])
  })

  it('the rate itself is the smallest amount (1 token); a numeric string and the exact balance are accepted, and only the multiple is debited', async () => {
    expect(dataOf<{ tokensCredited: number }>(await student.post('/gamification/convert', { syilingAmount: 50 })).tokensCredited).toBe(1)
    const balance = (await walletOf(t, studentId))!.current_syiling
    const res = await student.post('/gamification/convert', { syilingAmount: String(balance) })
    expect(res.status).toBe(200)
    expect(dataOf<{ currentSyiling: number }>(res).currentSyiling).toBe(balance % 50)
  })

  it('AC-GM-18.1, AC-MUR-29-1, AC-MUR-29-4: 120 syiling at rate 50, as "Semua" (100) or as typed (120), debits 100, pays 2 tokens and leaves 20', async () => {
    for (const syilingAmount of [100, 120]) {
      const id = await bareUser(t, 'Baki Seratus Dua Puluh')
      await t.wallet.credit({ userId: id, amount: 120, source: 'quiz_practice', sourceId: 'ac-18-1', description: 'Latih Tubi: 12 betul', isTest: false })
      const d = await t.gamification.convert({ userId: id, isTest: false }, syilingAmount, null)
      expect(d).toMatchObject({ syilingDebited: 100, tokensCredited: 2, currentSyiling: 20, tokenBalance: 2 })
    }
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

  it('AC-GM-18.4: the rate is read from the database tier at each request: an admin edit applies at once; silver pays at its own rate', async () => {
    // maju (267, bronze) converts at 50, then a credit lifts the tier to silver (rate 40) before the next conversion.
    const atBronze = GamificationConvertResultSchema.parse(dataOf(await maju.post('/gamification/convert', { syilingAmount: 100 })))
    expect(atBronze).toMatchObject({ syilingDebited: 100, tokensCredited: 2 })
    await t.wallet.credit({ userId: majuId, amount: 400, source: 'quiz_practice', sourceId: 'conv-up', description: 'Latih Tubi: 40 betul', isTest: false })
    expect((await walletOf(t, majuId))!.tier_name).toBe('silver')
    const d = GamificationConvertResultSchema.parse(dataOf(await maju.post('/gamification/convert', { syilingAmount: 100 })))
    expect(d).toMatchObject({ syilingDebited: 80, tokensCredited: 2 }) // floor(100 / 40) x 40
    await admin.put(`/admin/gamification/tiers/${(await t.db.query<{ id: string }>(`select id::text from tiers where tier_name = 'silver'`))[0]!.id}`, {
      labelMs: 'Perak', icon: '🥈', minSyiling: 500, conversionRate: 25, sortOrder: 2, quizRewardL1: 1, quizRewardL2: 2, quizRewardL3: 3, quizRewardL4: 4, quizRewardL5: 5, pkskRewardCorrect: 5, boardGameRewardCorrect: 5, boardGameRewardWin: 25,
    })
    expect(dataOf<{ tokensCredited: number }>(await maju.post('/gamification/convert', { syilingAmount: 100 })).tokensCredited).toBe(4)
  })

  // FR-GM-17.3, FR-ERR-9, DM-79; rulings 1 and 2 on #500: the key is the body clientUuid, per user, and there is no header.
  describe('idempotency per (user, clientUuid)', () => {
    const KEY = '3f2b8c1e-5a47-4d0b-9c36-7e1f0a2b4c5d'
    const funded = async (name: string, amount: number): Promise<string> => {
      const id = await bareUser(t, name)
      await t.wallet.credit({ userId: id, amount, source: 'quiz_practice', sourceId: 'idem-fund', description: 'Latih Tubi: 10 betul', isTest: false })
      return id
    }
    const convertRows = async (id: string) => (await ledgerOf(t, id)).filter((r) => r.type === 'convert')

    it('without a key two identical conversions both run (no key, no cap)', async () => {
      const id = await funded('Dua Kali', 500)
      const a = await t.gamification.convert({ userId: id, isTest: false }, 100, null)
      const b = await t.gamification.convert({ userId: id, isTest: false }, 100, null)
      expect(a.transactionId).not.toBe(b.transactionId)
      expect((await walletOf(t, id))!.current_syiling).toBe(300)
    })

    it('a repeat returns the FIRST result and debits once; the key is stored on the one ledger row', async () => {
      const before = (await walletOf(t, majuId))!
      const first = await maju.post('/gamification/convert', { syilingAmount: 100, clientUuid: KEY })
      const second = await maju.post('/gamification/convert', { syilingAmount: 100, clientUuid: KEY.toUpperCase() })
      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(dataOf(second)).toEqual(dataOf(first))
      const debited = dataOf<{ syilingDebited: number }>(first).syilingDebited
      expect((await walletOf(t, majuId))!.current_syiling).toBe(before.current_syiling - debited)
      expect(await t.db.query(`select id from coin_ledger where user_id = $1 and client_uuid = $2::uuid`, [majuId, KEY])).toHaveLength(1)
    })

    it('a repeat answers before any check: the balance no longer covers it, or the amount differs, and nothing moves', async () => {
      const id = await funded('Ulang Baki', 120)
      const first = await t.gamification.convert({ userId: id, isTest: false }, 120, KEY)
      expect(first).toMatchObject({ syilingDebited: 100, tokensCredited: 2, currentSyiling: 20, tokenBalance: 2 })
      expect(await t.gamification.convert({ userId: id, isTest: false }, 120, KEY)).toEqual(first)
      expect(await t.gamification.convert({ userId: id, isTest: false }, 50, KEY)).toEqual(first)
      expect(await walletOf(t, id)).toMatchObject({ current_syiling: 20, token_balance: 2 })
      expect(await convertRows(id)).toHaveLength(1)
    })

    it('a repeat carries the current balances, and the key belongs to one user only', async () => {
      const a = await funded('Kunci Satu', 300)
      const b = await funded('Kunci Dua', 300)
      const first = await t.gamification.convert({ userId: a, isTest: false }, 100, KEY)
      await t.gamification.convert({ userId: a, isTest: false }, 100, null)
      const repeat = await t.gamification.convert({ userId: a, isTest: false }, 100, KEY)
      expect(repeat).toMatchObject({ transactionId: first.transactionId, syilingDebited: 100, tokensCredited: 2, currentSyiling: 100, tokenBalance: 4 })
      const other = await t.gamification.convert({ userId: b, isTest: false }, 100, KEY)
      expect(other.transactionId).not.toBe(first.transactionId)
      expect((await walletOf(t, b))!.current_syiling).toBe(200)
    })

    it('AC-GM-18.3: simultaneous requests with one key move the wallet once and all answer the first result', async () => {
      const id = await funded('Dua Tekan', 300)
      const results = await Promise.all(Array.from({ length: 8 }, () => t.gamification.convert({ userId: id, isTest: false }, 100, KEY)))
      expect(new Set(results.map((r) => r.transactionId)).size).toBe(1)
      expect(await walletOf(t, id)).toMatchObject({ current_syiling: 200, token_balance: 2 })
      expect(await convertRows(id)).toHaveLength(1)

      const before = (await walletOf(t, studentId))!
      const key = '9a1c4e77-2b3d-4f60-8a15-c6d7e8f90a1b'
      await t.wallet.credit({ userId: studentId, amount: 200, source: 'quiz_practice', sourceId: 'idem-double', description: 'Latih Tubi: 20 betul', isTest: false })
      const [one, two] = await Promise.all([
        student.post('/gamification/convert', { syilingAmount: 100, clientUuid: key }),
        student.post('/gamification/convert', { syilingAmount: 100, clientUuid: key }),
      ])
      expect([one!.status, two!.status]).toEqual([200, 200])
      expect(dataOf<{ transactionId: string }>(one!).transactionId).toBe(dataOf<{ transactionId: string }>(two!).transactionId)
      expect((await walletOf(t, studentId))!.current_syiling).toBe(before.current_syiling + 100)
    })

    it('422 on fields.clientUuid for a bad key, and nothing moves; a key held by another movement is the same 422', async () => {
      const id = await funded('Kunci Rosak', 300)
      const start = (await walletOf(t, majuId))!
      for (const clientUuid of ['bad key!', 'k-0001', 7, true, {}]) {
        const err = fail(await maju.post('/gamification/convert', { syilingAmount: 100, clientUuid }), 422, 'VALIDATION_ERROR')
        expect(err.fields).toEqual({ clientUuid: 'Medan ini tidak sah.' })
      }
      expect(await walletOf(t, majuId)).toEqual(start)
      await t.wallet.debit({ userId: id, amount: 10, source: 'shop', sourceId: 'held', description: 'Belanja', isTest: false, clientUuid: KEY })
      await expect(t.gamification.convert({ userId: id, isTest: false }, 100, KEY)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fields: { clientUuid: 'Medan ini tidak sah.' } })
      expect(await convertRows(id)).toHaveLength(0)
    })

    it('ruling 2 on #500: the Idempotency-Key header is not a mechanism here: it is ignored, whatever it holds', async () => {
      const before = (await walletOf(t, majuId))!
      const one = await maju.post('/gamification/convert', { syilingAmount: 100 }, { 'Idempotency-Key': 'k-0001' })
      const two = await maju.post('/gamification/convert', { syilingAmount: 100 }, { 'Idempotency-Key': 'bad key!' })
      expect([one.status, two.status]).toEqual([200, 200])
      expect(dataOf<{ transactionId: string }>(one).transactionId).not.toBe(dataOf<{ transactionId: string }>(two).transactionId)
      expect((await walletOf(t, majuId))!.current_syiling).toBeLessThan(before.current_syiling)
    })

    it('WalletService.debit with a client key: the same movement is a replay, another is a 409 and nothing is written', async () => {
      const id = await funded('Dompet Kunci', 300)
      const input = { userId: id, amount: 100, source: 'token_conversion', description: 'Tukar 100 syiling → 2 token', type: 'convert' as const, tokens: 2, isTest: false, sourceId: null, noKeyReason: 'test', clientUuid: KEY }
      const first = await t.wallet.debit(input)
      expect(first.replayed).toBe(false)
      const again = await t.wallet.debit(input)
      expect(again).toMatchObject({ replayed: true, entryId: first.entryId, currentSyiling: 200, tokenBalance: 2 })
      await expect(t.wallet.debit({ ...input, amount: 50, tokens: 1 })).rejects.toMatchObject({ code: 'CONFLICT', details: { reason: 'IDEMPOTENCY_MISMATCH' } })
      await expect(t.wallet.debit({ ...input, source: 'other' })).rejects.toMatchObject({ code: 'CONFLICT', details: { reason: 'IDEMPOTENCY_MISMATCH' } })
      await expect(t.wallet.debit({ ...input, clientUuid: 'not-a-uuid' })).rejects.toThrow(RangeError)
      expect(await walletOf(t, id)).toMatchObject({ current_syiling: 200, token_balance: 2 })
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
    it('convert is refused with 403 FORBIDDEN before anything is written; the admin routes are closed while the mode is on', async () => {
      const adminId = await userIdOf(t.db, ADMIN)
      const start = (await walletOf(t, adminId))!
      const rows = (await ledgerOf(t, adminId)).length
      const mod = await signInMod(t, ADMIN)
      fail(await mod.post('/gamification/convert', { syilingAmount: 100 }), 403, 'FORBIDDEN', 'Tidak dibenarkan dalam Mod Pelajar.')
      fail(await mod.post('/gamification/convert', { syilingAmount: 'abc' }), 403, 'FORBIDDEN', 'Tidak dibenarkan dalam Mod Pelajar.')
      expect(await walletOf(t, adminId)).toEqual(start)
      expect(await ledgerOf(t, adminId)).toHaveLength(rows)
      fail(await mod.get('/admin/gamification/overview'), 403, 'FORBIDDEN')
    })
  })
})
