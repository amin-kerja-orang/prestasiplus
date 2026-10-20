import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { bareUser, bootWalletApp, type WalletTestApp } from './helpers'

/** wallets.current_syiling = sum(coin_ledger.amount) and every balance_after is the running sum, for every user of the database. */
async function reconcile(t: WalletTestApp): Promise<{ userId: string; balance: number; sum: number }[]> {
  return t.db.query(
    `select w.user_id::text as "userId", w.current_syiling as balance, coalesce(sum(l.amount), 0)::int as sum
       from wallets w left join coin_ledger l on l.user_id = w.user_id
      group by w.user_id, w.current_syiling`,
  )
}

async function brokenChains(t: WalletTestApp): Promise<number> {
  const rows = await t.db.query<{ n: number }>(
    `select count(*)::int as n from (
       select balance_after, sum(amount) over (partition by user_id order by created_at, id) as running from coin_ledger
     ) x where balance_after <> running`,
  )
  return rows[0]!.n
}

describe('ledger reconciliation (AC2)', () => {
  let t: WalletTestApp

  beforeAll(async () => {
    t = await bootWalletApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('seeded data reconciles: balance = sum of the ledger, balance_after = running sum, lifetime = positive sum', async () => {
    const rows = await reconcile(t)
    expect(rows.length).toBeGreaterThanOrEqual(3)
    for (const r of rows) expect(r.sum, `user ${r.userId}`).toBe(r.balance)
    expect(await brokenChains(t)).toBe(0)
    const life = await t.db.query<{ total_syiling_earned: number; pos: number }>(
      `select w.total_syiling_earned, coalesce(sum(l.amount) filter (where l.amount > 0), 0)::int as pos
         from wallets w left join coin_ledger l on l.user_id = w.user_id group by w.user_id, w.total_syiling_earned`,
    )
    for (const r of life) expect(r.pos).toBe(r.total_syiling_earned)
  })

  it('after 100 random credits and debits from a seeded PRNG the wallet still equals the ledger', async () => {
    const prng = prngStream('be11-reconcile', 11)
    const users = [await bareUser(t, 'rekon a'), await bareUser(t, 'rekon b'), await bareUser(t, 'rekon c')]
    let refused = 0
    let credits = 0
    let debits = 0
    for (let i = 0; i < 100; i++) {
      const userId = prng.pick(users)
      const amount = prng.int(1, 250)
      if (prng.next() < 0.6) {
        const type = prng.pick(['earn', 'earn', 'bonus', 'refund'] as const)
        await t.wallet.credit({ userId, amount, type, source: 'prng', sourceId: `c${String(i)}`, description: `Kredit ${String(i)}`, isTest: false })
        credits++
      } else {
        const type = prng.pick(['spend', 'convert'] as const)
        try {
          await t.wallet.debit({
            userId,
            amount,
            type,
            ...(type === 'convert' ? { tokens: prng.int(1, 5) } : {}),
            source: 'prng',
            sourceId: `d${String(i)}`,
            description: `Debit ${String(i)}`, isTest: false })
          debits++
        } catch (err) {
          expect(err).toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
          refused++
        }
      }
      // A replay of an earlier key in the middle of the run changes nothing.
      if (i % 10 === 9) await t.wallet.credit({ userId, amount: 999, source: 'prng', sourceId: `c${String(i - 9)}`, description: 'replay', isTest: false }).catch(() => undefined)
    }
    expect(credits + debits + refused).toBe(100)
    expect(credits).toBeGreaterThan(30)
    expect(debits).toBeGreaterThan(0)

    const mine = (await reconcile(t)).filter((r) => users.includes(r.userId))
    expect(mine).toHaveLength(3)
    for (const r of mine) {
      expect(r.sum, `user ${r.userId}`).toBe(r.balance)
      expect(r.balance).toBeGreaterThanOrEqual(0)
    }
    expect(await brokenChains(t)).toBe(0)
    // Every convert paid its tokens: token balance = sum of the tokens on convert rows.
    const tokens = await t.db.query<{ token_balance: number; paid: number }>(
      `select w.token_balance, coalesce(sum(l.tokens), 0)::int as paid
         from wallets w left join coin_ledger l on l.user_id = w.user_id where w.user_id = any($1::bigint[]) group by w.user_id, w.token_balance`,
      [users],
    )
    for (const r of tokens) expect(r.paid).toBe(r.token_balance)
  })

  it('the same seed gives the same run (the test is reproducible)', () => {
    const a = prngStream('be11-reconcile', 11)
    const b = prngStream('be11-reconcile', 11)
    expect(Array.from({ length: 10 }, () => a.int(1, 250))).toEqual(Array.from({ length: 10 }, () => b.int(1, 250)))
  })
})
