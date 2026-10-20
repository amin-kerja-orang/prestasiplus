import { ApiError } from '../../src/common/errors/api-error'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bareUser, bootWalletApp, ledgerOf, walletOf, type WalletTestApp } from './helpers'

async function refused(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError)
    return err as ApiError
  }
  throw new Error('Expected the call to be refused.')
}

describe('WalletService credit (AC1, AC4, AC5)', () => {
  let t: WalletTestApp
  let n = 0
  const fresh = () => bareUser(t, `kredit ${String(n++)}`)

  beforeAll(async () => {
    t = await bootWalletApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('creates the wallet on the first credit with the default tier, one ledger row, and balance_after = the balance', async () => {
    const u = await fresh()
    expect(await walletOf(t, u)).toBeUndefined() // nothing before the first credit
    const r = await t.wallet.credit({ userId: u, amount: 12, source: 'quiz_practice', sourceId: 's-1', description: 'Latih Tubi: 12 betul — 100%' })
    expect(r).toMatchObject({ replayed: false, type: 'earn', amount: 12, balanceAfter: 12, currentSyiling: 12, totalSyilingEarned: 12, tokenBalance: 0, tierKey: 'bronze' })
    expect(await walletOf(t, u)).toMatchObject({ current_syiling: 12, total_syiling_earned: 12, token_balance: 0, xp: 0, level: 1, tier_name: 'bronze' })
    const rows = await ledgerOf(t, u)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'earn', source: 'quiz_practice', source_id: 's-1', amount: 12, balance_after: 12, is_test: false, tokens: null })
    expect(rows[0]!.id).toBe(r.entryId)
    // Created at the injected clock, not the real time.
    const [row] = await t.db.query<{ created_at: Date }>(`select created_at from coin_ledger where id = $1`, [r.entryId])
    expect(row!.created_at.toISOString()).toBe(t.clock.now().toISOString())
  })

  it('balance_after is the running balance over several credits and debits', async () => {
    const u = await fresh()
    await t.wallet.credit({ userId: u, amount: 10, source: 'a', sourceId: '1', description: 'd' })
    await t.wallet.credit({ userId: u, amount: 5, source: 'a', sourceId: '2', description: 'd', type: 'bonus' })
    await t.wallet.debit({ userId: u, amount: 7, source: 'shop', sourceId: '3', description: 'd' })
    await t.wallet.credit({ userId: u, amount: 20, source: 'a', sourceId: '4', description: 'd', type: 'refund' })
    expect((await ledgerOf(t, u)).map((r) => [r.type, r.amount, r.balance_after])).toEqual([
      ['earn', 10, 10],
      ['bonus', 5, 15],
      ['spend', -7, 8],
      ['refund', 20, 28],
    ])
    expect(await walletOf(t, u)).toMatchObject({ current_syiling: 28, total_syiling_earned: 35 })
  })

  describe('idempotency per (user, source, source_id)', () => {
    it('a replay in a separate call returns the first result and writes no second row', async () => {
      const u = await fresh()
      const first = await t.wallet.credit({ userId: u, amount: 30, source: 'quiz_spm', sourceId: 'sess-9', description: 'SPM' })
      await t.wallet.credit({ userId: u, amount: 4, source: 'other', sourceId: 'x', description: 'later movement' })
      const again = await t.wallet.credit({ userId: u, amount: 30, source: 'quiz_spm', sourceId: 'sess-9', description: 'SPM' })
      expect(again).toMatchObject({ replayed: true, entryId: first.entryId, amount: 30, balanceAfter: 30, currentSyiling: 34 })
      expect(await ledgerOf(t, u)).toHaveLength(2)
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 34, total_syiling_earned: 34 })
    })

    it('a replay with different amount or text still returns the first result (the key decides)', async () => {
      const u = await fresh()
      const first = await t.wallet.credit({ userId: u, amount: 30, source: 'quiz_spm', sourceId: 'k', description: 'one' })
      const again = await t.wallet.credit({ userId: u, amount: 999, source: 'quiz_spm', sourceId: 'k', description: 'two' })
      expect(again).toMatchObject({ replayed: true, entryId: first.entryId, amount: 30, balanceAfter: 30 })
      expect((await walletOf(t, u))?.current_syiling).toBe(30)
    })

    it('two calls with one key in ONE transaction write one row', async () => {
      const u = await fresh()
      const [a, b] = await t.prisma.transaction(async () => [
        await t.wallet.credit({ userId: u, amount: 8, source: 'daily_login', sourceId: 'd-1', description: 'Streak activity (daily_login)' }),
        await t.wallet.credit({ userId: u, amount: 8, source: 'daily_login', sourceId: 'd-1', description: 'Streak activity (daily_login)' }),
      ])
      expect(a).toMatchObject({ replayed: false })
      expect(b).toMatchObject({ replayed: true, entryId: a!.entryId })
      expect(await ledgerOf(t, u)).toHaveLength(1)
      expect((await walletOf(t, u))?.current_syiling).toBe(8)
    })

    it('the key is scoped to the user and to the source; no key means no idempotency', async () => {
      const u1 = await fresh()
      const u2 = await fresh()
      await t.wallet.credit({ userId: u1, amount: 1, source: 'a', sourceId: 'same', description: 'd' })
      await t.wallet.credit({ userId: u2, amount: 1, source: 'a', sourceId: 'same', description: 'd' }) // other user
      await t.wallet.credit({ userId: u1, amount: 1, source: 'b', sourceId: 'same', description: 'd' }) // other source
      await t.wallet.credit({ userId: u1, amount: 1, source: 'c', description: 'd' })
      await t.wallet.credit({ userId: u1, amount: 1, source: 'c', sourceId: null, description: 'd' })
      expect(await ledgerOf(t, u1)).toHaveLength(4)
      expect(await ledgerOf(t, u2)).toHaveLength(1)
    })

    it('concurrent calls with one key write one row; concurrent distinct credits keep a consistent running balance', async () => {
      const u = await fresh()
      const same = await Promise.all(Array.from({ length: 8 }, () => t.wallet.credit({ userId: u, amount: 3, source: 'race', sourceId: 'one', description: 'd' })))
      expect(same.filter((r) => !r.replayed)).toHaveLength(1)
      expect(await ledgerOf(t, u)).toHaveLength(1)

      const v = await fresh()
      await Promise.all(Array.from({ length: 12 }, (_, i) => t.wallet.credit({ userId: v, amount: i + 1, source: 'race', sourceId: String(i), description: 'd' })))
      const rows = await ledgerOf(t, v)
      expect(rows).toHaveLength(12)
      let running = 0
      for (const r of rows) {
        running += r.amount
        expect(r.balance_after).toBe(running) // ids are in write order, so the chain must be unbroken
      }
      expect((await walletOf(t, v))?.current_syiling).toBe(78)
    })
  })

  describe('atomic with the caller transaction', () => {
    it('a throw after the credit rolls back the wallet row, the ledger row and the tier', async () => {
      const u = await fresh()
      await expect(
        t.prisma.transaction(async () => {
          await t.wallet.credit({ userId: u, amount: 600, source: 'quiz', sourceId: 'rb', description: 'd' })
          throw new Error('caller failed after the credit')
        }),
      ).rejects.toThrow('caller failed')
      expect(await walletOf(t, u)).toBeUndefined()
      expect(await ledgerOf(t, u)).toHaveLength(0)
    })

    it('an explicit transaction handle is used as given', async () => {
      const u = await fresh()
      await t.prisma.$transaction(async (tx) => {
        await t.wallet.credit({ userId: u, amount: 5, source: 'quiz', sourceId: 'tx-1', description: 'd' }, { tx })
        const replay = await t.wallet.credit({ userId: u, amount: 5, source: 'quiz', sourceId: 'tx-1', description: 'd' }, { tx })
        expect(replay.replayed).toBe(true)
      })
      expect(await ledgerOf(t, u)).toHaveLength(1)
      await expect(
        t.prisma.$transaction(async (tx) => {
          await t.wallet.credit({ userId: u, amount: 5, source: 'quiz', sourceId: 'tx-2', description: 'd' }, { tx })
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')
      expect(await ledgerOf(t, u)).toHaveLength(1)
    })

    it('a refused debit inside the caller transaction rolls back the caller work with it', async () => {
      const u = await fresh()
      await expect(
        t.prisma.transaction(async () => {
          await t.wallet.credit({ userId: u, amount: 10, source: 'quiz', sourceId: 'a', description: 'd' })
          await t.wallet.debit({ userId: u, amount: 11, source: 'shop', sourceId: 'b', description: 'd' })
        }),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
      expect(await walletOf(t, u)).toBeUndefined()
    })
  })

  describe('tier (BR-M14-08)', () => {
    it('moves up to the highest active tier reached by the current syiling and never down', async () => {
      const u = await fresh()
      expect((await t.wallet.credit({ userId: u, amount: 499, source: 't', sourceId: '1', description: 'd' })).tierKey).toBe('bronze')
      expect((await t.wallet.credit({ userId: u, amount: 1, source: 't', sourceId: '2', description: 'd' })).tierKey).toBe('silver')
      expect((await t.wallet.credit({ userId: u, amount: 1600, source: 't', sourceId: '3', description: 'd' })).tierKey).toBe('gold')
      // A big spend drops the balance under the gold threshold: the tier stays.
      const spent = await t.wallet.debit({ userId: u, amount: 2000, source: 'shop', sourceId: '4', description: 'd' })
      expect(spent).toMatchObject({ currentSyiling: 100, tierKey: 'gold' })
      expect((await t.wallet.credit({ userId: u, amount: 1, source: 't', sourceId: '5', description: 'd' })).tierKey).toBe('gold')
      expect((await walletOf(t, u))?.tier_name).toBe('gold')
    })

    it('skips tiers: a single large credit lands on the highest one reached', async () => {
      const u = await fresh()
      expect((await t.wallet.credit({ userId: u, amount: 6000, source: 't', sourceId: '1', description: 'd' })).tierKey).toBe('platinum')
    })

    it('an inactive tier is never a target', async () => {
      const u = await fresh()
      await t.db.query(`update tiers set is_active = false where tier_name = 'silver'`)
      try {
        expect((await t.wallet.credit({ userId: u, amount: 600, source: 't', sourceId: '1', description: 'd' })).tierKey).toBe('bronze')
        expect((await t.wallet.credit({ userId: u, amount: 1500, source: 't', sourceId: '2', description: 'd' })).tierKey).toBe('gold')
      } finally {
        await t.db.query(`update tiers set is_active = true where tier_name = 'silver'`)
      }
    })

    it('a debit changes neither the lifetime total nor the tier', async () => {
      const u = await fresh()
      await t.wallet.credit({ userId: u, amount: 700, source: 't', sourceId: '1', description: 'd' })
      await t.wallet.debit({ userId: u, amount: 300, source: 'shop', sourceId: '2', description: 'd' })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 400, total_syiling_earned: 700, tier_name: 'silver' })
    })
  })

  it('stamps Mod Pelajar writes (is_test) and keeps the balance consistent', async () => {
    const u = await fresh()
    await t.wallet.credit({ userId: u, amount: 10, source: 'quiz', sourceId: 'a', description: 'd' })
    await t.wallet.credit({ userId: u, amount: 10, source: 'quiz', sourceId: 'b', description: 'd', isTest: true })
    await t.wallet.debit({ userId: u, amount: 5, source: 'shop', sourceId: 'c', description: 'd', isTest: true })
    expect((await ledgerOf(t, u)).map((r) => r.is_test)).toEqual([false, true, true])
    expect((await walletOf(t, u))?.current_syiling).toBe(15)
    // The rule for totals shown to others (service comment): only is_test = false rows count.
    const [shown] = await t.db.query<{ total: number }>(`select coalesce(sum(amount) filter (where amount > 0), 0)::int as total from coin_ledger where user_id = $1 and not is_test`, [u])
    expect(shown!.total).toBe(10)
  })

  describe('debit (AC7)', () => {
    it('refuses more than the balance with 409 INSUFFICIENT_BALANCE and the exact BM message; nothing is written', async () => {
      const u = await fresh()
      await t.wallet.credit({ userId: u, amount: 50, source: 'quiz', sourceId: 'a', description: 'd' })
      const err = await refused(t.wallet.debit({ userId: u, amount: 51, source: 'shop', sourceId: 'z', description: 'd' }))
      expect(err.getStatus()).toBe(409)
      expect(err).toMatchObject({ code: 'INSUFFICIENT_BALANCE', message: 'Baki syiling tidak mencukupi.' })
      expect(await ledgerOf(t, u)).toHaveLength(1)
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 50, total_syiling_earned: 50 })
      // The exact balance is allowed and leaves 0.
      expect(await t.wallet.debit({ userId: u, amount: 50, source: 'shop', sourceId: 'ok', description: 'd' })).toMatchObject({ currentSyiling: 0, balanceAfter: 0 })
    })

    it('a user without a wallet is refused and no wallet is created', async () => {
      const u = await fresh()
      const err = await refused(t.wallet.debit({ userId: u, amount: 1, source: 'shop', sourceId: 'z', description: 'd' }))
      expect(err.message).toBe('Baki syiling tidak mencukupi.')
      expect(await walletOf(t, u)).toBeUndefined()
    })

    it('a replay of a debit returns the first result even when the balance would now be too small', async () => {
      const u = await fresh()
      await t.wallet.credit({ userId: u, amount: 10, source: 'quiz', sourceId: 'a', description: 'd' })
      const first = await t.wallet.debit({ userId: u, amount: 10, source: 'shop', sourceId: 'buy-1', description: 'd' })
      const again = await t.wallet.debit({ userId: u, amount: 10, source: 'shop', sourceId: 'buy-1', description: 'd' })
      expect(again).toMatchObject({ replayed: true, entryId: first.entryId, amount: -10 })
      expect(await ledgerOf(t, u)).toHaveLength(2)
    })

    it('concurrent debits never overdraw the wallet', async () => {
      const u = await fresh()
      await t.wallet.credit({ userId: u, amount: 25, source: 'quiz', sourceId: 'a', description: 'd' })
      const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => t.wallet.debit({ userId: u, amount: 10, source: 'shop', sourceId: `b${String(i)}`, description: 'd' })))
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2)
      expect((await walletOf(t, u))?.current_syiling).toBe(5)
    })

    it('a convert pays the tokens in the same step, stores them on the row and logs no token movement', async () => {
      const u = await fresh()
      await t.wallet.credit({ userId: u, amount: 120, source: 'quiz', sourceId: 'a', description: 'd' })
      const r = await t.wallet.debit({ userId: u, amount: 100, type: 'convert', tokens: 2, source: 'token_conversion', sourceId: 'c-1', description: 'Tukar 100 syiling → 2 token' })
      expect(r).toMatchObject({ type: 'convert', amount: -100, balanceAfter: 20, currentSyiling: 20, tokenBalance: 2 })
      expect((await ledgerOf(t, u)).at(-1)).toMatchObject({ type: 'convert', tokens: 2, amount: -100 })
      expect(await t.db.query(`select 1 from token_movements where user_id = $1`, [u])).toHaveLength(0)
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 20, token_balance: 2 })
    })

    it('programming errors are RangeErrors, not API errors', async () => {
      const u = await fresh()
      await expect(t.wallet.debit({ userId: u, amount: 5, type: 'convert', source: 's', description: 'd' })).rejects.toThrow(RangeError) // needs tokens
      await expect(t.wallet.debit({ userId: u, amount: 5, tokens: 1, source: 's', description: 'd' })).rejects.toThrow(RangeError) // spend with tokens
      await expect(t.wallet.debit({ userId: u, amount: 5, type: 'earn' as never, source: 's', description: 'd' })).rejects.toThrow(RangeError)
    })
  })

  describe('input checks (nothing is written)', () => {
    it.each([
      ['zero amount', { amount: 0 }],
      ['negative amount', { amount: -3 }],
      ['fractional amount', { amount: 1.5 }],
      ['NaN amount', { amount: Number.NaN }],
      ['amount beyond the safe range', { amount: Number.MAX_SAFE_INTEGER + 2 }],
      ['empty source', { source: '' }],
      ['over-long source', { source: 'x'.repeat(101) }],
      ['empty sourceId', { sourceId: '' }],
      ['over-long sourceId', { sourceId: 'x'.repeat(201) }],
      ['empty description', { description: '' }],
      ['a debit type used as credit', { type: 'spend' as never }],
      ['a malformed user id', { userId: '12abc' }],
    ])('credit rejects %s', async (_name, over) => {
      const u = await fresh()
      await expect(t.wallet.credit({ userId: u, amount: 1, source: 's', sourceId: 'k', description: 'd', ...over })).rejects.toThrow(RangeError)
      expect(await ledgerOf(t, u)).toHaveLength(0)
      expect(await walletOf(t, u)).toBeUndefined()
    })

    it('a credit that would pass the integer range is refused and rolls back', async () => {
      const u = await fresh()
      await t.wallet.credit({ userId: u, amount: 2_147_483_000, source: 'big', sourceId: '1', description: 'd' })
      await expect(t.wallet.credit({ userId: u, amount: 1000, source: 'big', sourceId: '2', description: 'd' })).rejects.toThrow(RangeError)
      expect((await walletOf(t, u))?.current_syiling).toBe(2_147_483_000)
    })

    it('an unknown user is a foreign-key error and leaves nothing behind', async () => {
      await expect(t.wallet.credit({ userId: '999999999', amount: 1, source: 's', sourceId: 'k', description: 'd' })).rejects.toThrow()
      expect(await t.db.query(`select 1 from wallets where user_id = 999999999`)).toHaveLength(0)
    })
  })

  describe('tokens and XP (BR-M14-22)', () => {
    it('token credit and debit move the balance and log token_movements, never the coin ledger', async () => {
      const u = await fresh()
      expect(await t.wallet.creditTokens({ userId: u, amount: 5, source: 'hadiah_refund', refId: 'r-1' })).toEqual({ tokenBalance: 5 })
      expect(await t.wallet.debitTokens({ userId: u, amount: 3, source: 'hadiah_redeem', refId: 'r-2' })).toEqual({ tokenBalance: 2 })
      const moves = await t.db.query<{ delta: number; source: string; ref_id: string | null; is_test: boolean }>(
        `select delta, source, ref_id, is_test from token_movements where user_id = $1 order by id`,
        [u],
      )
      expect(moves).toEqual([
        { delta: 5, source: 'hadiah_refund', ref_id: 'r-1', is_test: false },
        { delta: -3, source: 'hadiah_redeem', ref_id: 'r-2', is_test: false },
      ])
      expect(await ledgerOf(t, u)).toHaveLength(0)
      expect((await walletOf(t, u))?.token_balance).toBe(2)
    })

    it('a token debit over the balance is 409 INSUFFICIENT_BALANCE "Baki token tidak mencukupi." and writes nothing', async () => {
      const u = await fresh()
      await t.wallet.creditTokens({ userId: u, amount: 2, source: 'hadiah_refund' })
      const err = await refused(t.wallet.debitTokens({ userId: u, amount: 3, source: 'hadiah_redeem' }))
      expect(err.getStatus()).toBe(409)
      expect(err).toMatchObject({ code: 'INSUFFICIENT_BALANCE', message: 'Baki token tidak mencukupi.' })
      expect(await t.db.query(`select 1 from token_movements where user_id = $1`, [u])).toHaveLength(1)
      // No wallet at all: same refusal, no wallet created.
      const v = await fresh()
      expect((await refused(t.wallet.debitTokens({ userId: v, amount: 1, source: 'mystery_box' }))).message).toBe('Baki token tidak mencukupi.')
      expect(await walletOf(t, v)).toBeUndefined()
    })

    it('a seeded negative token balance can rise but is not debited', async () => {
      const u = await fresh()
      await t.wallet.creditTokens({ userId: u, amount: 1, source: 'hadiah_refund' })
      await t.db.query(`update wallets set token_balance = -3 where user_id = $1`, [u])
      await expect(t.wallet.debitTokens({ userId: u, amount: 1, source: 'hadiah_redeem' })).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
      expect(await t.wallet.creditTokens({ userId: u, amount: 2, source: 'hadiah_refund' })).toEqual({ tokenBalance: -1 })
    })

    it('token writes under Mod Pelajar are stamped', async () => {
      const u = await fresh()
      await t.wallet.creditTokens({ userId: u, amount: 1, source: 'hadiah_refund', isTest: true })
      expect((await t.db.query<{ is_test: boolean }>(`select is_test from token_movements where user_id = $1`, [u]))[0]?.is_test).toBe(true)
    })

    it('addXp adds without a ledger row; 0 creates nothing; the level never changes', async () => {
      const u = await fresh()
      expect(await t.wallet.addXp({ userId: u, amount: 0 })).toEqual({ xp: 0 })
      expect(await walletOf(t, u)).toBeUndefined()
      expect(await t.wallet.addXp({ userId: u, amount: 250 })).toEqual({ xp: 250 })
      expect(await t.wallet.addXp({ userId: u, amount: 10 })).toEqual({ xp: 260 })
      expect(await walletOf(t, u)).toMatchObject({ xp: 260, level: 1, current_syiling: 0 })
      expect(await ledgerOf(t, u)).toHaveLength(0)
      await expect(t.wallet.addXp({ userId: u, amount: -1 })).rejects.toThrow(RangeError)
    })

    it('token amounts must be positive integers', async () => {
      const u = await fresh()
      for (const amount of [0, -1, 1.2]) {
        await expect(t.wallet.creditTokens({ userId: u, amount, source: 's' })).rejects.toThrow(RangeError)
        await expect(t.wallet.debitTokens({ userId: u, amount, source: 's' })).rejects.toThrow(RangeError)
      }
    })
  })

  describe('session credits', () => {
    const sid = '3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59'

    it('stores the result once; a second call returns the stored result', async () => {
      const u = await fresh()
      const input = { sessionId: sid, userId: u, coinsEarned: 6, pointsEarned: 60, streakCount: 3, totalBalance: 239, completedAt: new Date('2026-10-19T01:15:00Z') }
      const first = await t.wallet.recordSessionCredit(input)
      expect(first).toEqual({ recorded: true, result: { sessionId: sid, coinsEarned: 6, pointsEarned: 60, streakCount: 3, totalBalance: 239 } })
      const again = await t.wallet.recordSessionCredit({ ...input, coinsEarned: 99 })
      expect(again).toEqual({ recorded: false, result: first.result })
      expect(await t.wallet.sessionCredit(sid)).toEqual(first.result)
      expect(await t.wallet.sessionCredit('3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a00')).toBeNull()
      expect(await t.wallet.sessionCredit('not-a-uuid')).toBeNull()
      expect(await t.db.query(`select 1 from session_credits where session_id = $1`, [sid])).toHaveLength(1)
    })

    it('stamps is_test and refuses bad input', async () => {
      const u = await fresh()
      const id = '3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a60'
      await t.wallet.recordSessionCredit({ sessionId: id, userId: u, coinsEarned: 0, pointsEarned: 0, streakCount: 1, totalBalance: 0, completedAt: new Date('2026-10-19T01:15:00Z'), isTest: true })
      expect((await t.db.query<{ is_test: boolean }>(`select is_test from session_credits where session_id = $1`, [id]))[0]?.is_test).toBe(true)
      await expect(t.wallet.recordSessionCredit({ sessionId: 'P1', userId: u, coinsEarned: 0, pointsEarned: 0, streakCount: 0, totalBalance: 0, completedAt: new Date() })).rejects.toThrow(RangeError)
      await expect(t.wallet.recordSessionCredit({ sessionId: id, userId: u, coinsEarned: -1, pointsEarned: 0, streakCount: 0, totalBalance: 0, completedAt: new Date() })).rejects.toThrow(RangeError)
    })
  })
})
