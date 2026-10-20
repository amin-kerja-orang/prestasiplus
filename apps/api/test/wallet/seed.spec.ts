import { identitySeed } from '../../prisma/seed/core/identity'
import { DEMO_WALLETS, WALLET_TIERS, walletSeed } from '../../prisma/seed/wallet'
import { runSeeds, seedModules } from '../../prisma/seed'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

describe('wallet seed (BE-11)', () => {
  let db: TestDatabase

  const counts = async (): Promise<Record<string, number>> => {
    const out: Record<string, number> = {}
    for (const table of ['tiers', 'wallets', 'coin_ledger', 'streaks', 'session_credits', 'daily_login_marks', 'token_movements']) {
      out[table] = Number((await db.query<{ n: string }>(`select count(*)::text as n from ${table}`))[0]!.n)
    }
    return out
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, walletSeed], { prisma: db.prisma })
  })
  afterAll(async () => {
    await db.drop()
  })

  it('is registered once in the seed list, after the identity seeds, as a demo module', () => {
    expect(seedModules.filter((m) => m.name === 'wallet')).toHaveLength(1)
    expect(seedModules.map((m) => m.name).indexOf('wallet')).toBeGreaterThan(seedModules.map((m) => m.name).indexOf('core-identity'))
    expect(walletSeed.kind).toBe('demo')
  })

  it('loads the four mock tiers with the mock values', async () => {
    const tiers = await db.query<{ tier_name: string; label_ms: string; min_syiling: number; conversion_rate: string; sort_order: number; is_active: boolean; quiz_reward_l3: number; board_game_reward_win: number; perks: string[] }>(
      `select tier_name, label_ms, min_syiling, conversion_rate::text, sort_order, is_active, quiz_reward_l3, board_game_reward_win, perks from tiers order by sort_order`,
    )
    expect(tiers.map((t) => [t.tier_name, t.label_ms, t.min_syiling, Number(t.conversion_rate)])).toEqual([
      ['bronze', 'Gangsa', 0, 50],
      ['silver', 'Perak', 500, 40],
      ['gold', 'Emas', 2000, 30],
      ['platinum', 'Platinum', 5000, 20],
    ])
    expect(tiers.every((t) => t.is_active && t.quiz_reward_l3 === 3 && t.board_game_reward_win === 25)).toBe(true)
    expect(tiers.map((t) => t.perks.length)).toEqual([3, 4, 5, 6])
    expect(WALLET_TIERS).toHaveLength(4)
  })

  it('gives the three demo accounts with mock wallet data their observed wallets, ledgers and streaks; the empty account has none', async () => {
    const rows = await db.query<{ email: string; syiling: number; lifetime: number; tokens: number; xp: number; level: number; tier: string; rows: number; current: number; best: number; last: string; total_days: number }>(
      `select u.email, w.current_syiling as syiling, w.total_syiling_earned as lifetime, w.token_balance as tokens, w.xp, w.level, t.tier_name as tier,
              (select count(*)::int from coin_ledger l where l.user_id = u.id) as rows,
              s."current" as current, s.best, s.last_activity_date::text as last, s.total_days
         from users u join wallets w on w.user_id = u.id join tiers t on t.id = w.tier_id join streaks s on s.user_id = u.id order by u.email`,
    )
    expect(rows).toEqual([
      { email: 'admin@demo.test', syiling: 256, lifetime: 256, tokens: 0, xp: 8, level: 2, tier: 'bronze', rows: 14, current: 1, best: 5, last: '2026-05-19', total_days: 0 },
      { email: 'pelajar@demo.test', syiling: 370, lifetime: 370, tokens: 0, xp: 916, level: 1, tier: 'bronze', rows: 20, current: 2, best: 2, last: '2026-09-25', total_days: 0 },
      { email: 'pelajarmaju@demo.test', syiling: 267, lifetime: 267, tokens: 0, xp: 432, level: 3, tier: 'bronze', rows: 19, current: 3, best: 3, last: '2026-09-25', total_days: 0 },
    ])
    expect(await db.query(`select 1 from wallets w join users u on u.id = w.user_id where u.email = 'pelajar2@demo.test'`)).toHaveLength(0)
    expect(await db.query(`select 1 from streaks s join users u on u.id = s.user_id where u.email = 'pelajar2@demo.test'`)).toHaveLength(0)
  })

  it('every seeded ledger row is an earn whose balance_after is the running balance and ends at the wallet balance', async () => {
    const rows = await db.query<{ email: string; type: string; amount: number; balance_after: number; created_at: Date }>(
      `select u.email, l.type, l.amount, l.balance_after, l.created_at from coin_ledger l join users u on u.id = l.user_id order by u.email, l.id`,
    )
    const byUser = new Map<string, typeof rows>()
    for (const r of rows) byUser.set(r.email, [...(byUser.get(r.email) ?? []), r])
    for (const [email, list] of byUser) {
      let running = 0
      for (const r of list) {
        running += r.amount
        expect(r.type).toBe('earn')
        expect(r.balance_after, email).toBe(running)
      }
      const [w] = await db.query<{ current_syiling: number }>(`select w.current_syiling from wallets w join users u on u.id = w.user_id where u.email = $1`, [email])
      expect(running).toBe(w!.current_syiling)
    }
    // The observed mock instants are kept (pelajar: first row 22/09/2026 19:00, last 25/09/2026 08:30 Malaysia time).
    const pelajar = byUser.get('pelajar@demo.test')!
    expect(pelajar[0]!.created_at.toISOString()).toBe('2026-09-22T11:00:00.000Z')
    expect(pelajar.at(-1)!.created_at.toISOString()).toBe('2026-09-25T00:30:00.000Z')
  })

  it('keeps the mock reference as source_id; a daily-challenge reference carries its Malaysia day so the key is unique', async () => {
    const rows = await db.query<{ source: string; source_id: string | null }>(
      `select l.source, l.source_id from coin_ledger l join users u on u.id = l.user_id where u.email = 'pelajar@demo.test' and l.source_id is not null order by l.id`,
    )
    expect(rows.filter((r) => r.source === 'quiz_spm').map((r) => r.source_id)).toEqual(['P1', 'P2', 'P3', 'P4'])
    const challenges = rows.filter((r) => r.source === 'daily_challenge').map((r) => r.source_id)
    expect(challenges).toContain('challenge:5:2026-09-22')
    expect(challenges).toContain('challenge:5:2026-09-24')
    expect(new Set(challenges).size).toBe(challenges.length)
    // Rows with no reference in the mock have none here.
    expect((await db.query(`select 1 from coin_ledger l where l.source = 'spm' and l.source_id is not null`))).toHaveLength(0)
  })

  it('never sets legacy_* and seeds no session credit, login mark or token movement', async () => {
    for (const table of ['tiers', 'wallets', 'coin_ledger', 'streaks']) {
      expect(await db.query(`select 1 from ${table} where legacy_source is not null or legacy_id is not null`), table).toHaveLength(0)
    }
    const c = await counts()
    expect([c.session_credits, c.daily_login_marks, c.token_movements]).toEqual([0, 0, 0])
  })

  it('is idempotent: a second run changes nothing, and a user that already has a wallet is left alone', async () => {
    const before = await counts()
    await runSeeds([identitySeed, walletSeed], { prisma: db.prisma })
    expect(await counts()).toEqual(before)

    // A wallet that is not the seeded one (for example loaded by the migration) is never touched.
    await db.query(`update wallets set current_syiling = 999, xp = 1 where user_id = (select id from users where email = 'pelajarmaju@demo.test')`)
    await runSeeds([walletSeed], { prisma: db.prisma })
    expect(await counts()).toEqual(before)
    expect((await db.query<{ current_syiling: number; xp: number }>(`select current_syiling, xp from wallets w join users u on u.id = w.user_id where u.email = 'pelajarmaju@demo.test'`))[0]).toEqual({ current_syiling: 999, xp: 1 })
    await db.query(`update wallets set current_syiling = 267, xp = 432 where user_id = (select id from users where email = 'pelajarmaju@demo.test')`)
  })

  it('an existing tier (edited by an admin, or loaded) is not overwritten by a re-run', async () => {
    await db.query(`update tiers set label_ms = 'Gangsa (ubah)' where tier_name = 'bronze'`)
    await runSeeds([walletSeed], { prisma: db.prisma })
    expect((await db.query<{ label_ms: string }>(`select label_ms from tiers where tier_name = 'bronze'`))[0]?.label_ms).toBe('Gangsa (ubah)')
    await db.query(`update tiers set label_ms = 'Gangsa' where tier_name = 'bronze'`)
  })

  it('is a demo module: refused in production without ALLOW_DEMO_SEED, and it checks the gate itself', async () => {
    const empty = await createTestDatabase()
    try {
      const done = await runSeeds([walletSeed], { prisma: empty.prisma, env: { NODE_ENV: 'production' } })
      expect(done).toEqual([]) // skipped by the runner
      expect(await empty.query('select 1 from tiers')).toHaveLength(0)
      const saved = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      delete process.env.ALLOW_DEMO_SEED
      try {
        await expect(walletSeed.run({ profile: 'poc', clock: { now: () => new Date('2026-09-25T07:40:00Z') }, prng: () => { throw new Error('unused') }, prisma: empty.prisma })).rejects.toThrow(/Refusing to seed demo data/)
      } finally {
        process.env.NODE_ENV = saved
      }
      expect(await empty.query('select 1 from tiers')).toHaveLength(0)
    } finally {
      await empty.drop()
    }
  })

  it('keeps fictitious data only: demo e-mails on demo.test, no real person name in the seed table', () => {
    for (const w of DEMO_WALLETS) expect(w.email).toMatch(/@demo\.test$/)
    const text = JSON.stringify(DEMO_WALLETS) + JSON.stringify(WALLET_TIERS)
    expect(text).not.toMatch(/@(?!demo\.test)\w+\.\w+/)
  })
})
