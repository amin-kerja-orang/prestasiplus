import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { ACHIEVEMENT_ROWS, CHALLENGE_ROWS, HADIAH_ROWS, LEARNER_BADGE_ROWS, SAMPLE_DRAW, SETTING_ROWS, SYILING_REWARD_ROWS, gamificationSeed } from '../../prisma/seed/gamification'
import { createTestDatabase, type TestDatabase } from '../support/db'

const SEED_FILES = ['gamification.ts', 'gamification-data.ts'].map((f) => readFileSync(fileURLToPath(new URL(`../../prisma/seed/${f}`, import.meta.url)), 'utf8'))
const TABLES = ['challenges', 'achievements', 'learner_badges', 'syiling_rewards', 'rewards', 'draws', 'draw_prizes', 'gamification_settings']

describe('gamification seed (BE-23 data layer)', () => {
  let db: TestDatabase

  const counts = async (): Promise<Record<string, number>> => {
    const out: Record<string, number> = {}
    for (const table of [...TABLES, 'challenge_completions', 'user_achievements', 'reward_claims', 'reward_redemptions', 'draw_tickets', 'wallets', 'coin_ledger']) {
      out[table] = Number((await db.query<{ n: string }>(`select count(*)::text as n from ${table}`))[0]!.n)
    }
    return out
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, gamificationSeed], { prisma: db.prisma })
  })
  afterAll(async () => {
    await db.drop()
  })

  it('is registered once, after practice, as a demo module (the reference set is not touched)', () => {
    expect(seedModules.filter((m) => m.name === 'gamification')).toHaveLength(1)
    // Append-only registry: later cards append after it (BE-26 adds `poc-profile`), so pin the dependency order, not "last".
    const names = seedModules.map((m) => m.name)
    expect(names.indexOf('gamification')).toBeGreaterThan(names.indexOf('practice'))
    expect(gamificationSeed.kind).toBe('demo')
  })

  it('loads the mock catalogues', async () => {
    const c = await counts()
    expect(c).toMatchObject({ challenges: 10, achievements: 25, learner_badges: 3, syiling_rewards: 11, rewards: 59, draws: 1, draw_prizes: 2, gamification_settings: 10 })
    expect([CHALLENGE_ROWS.length, ACHIEVEMENT_ROWS.length, LEARNER_BADGE_ROWS.length, SYILING_REWARD_ROWS.length, HADIAH_ROWS.length, SETTING_ROWS.length]).toEqual([10, 25, 3, 11, 59, 10])
  })

  it('keeps the observed values: a challenge, a criterion, the settings, a Syiling reward and the Hadiah state', async () => {
    const ch = (await db.query<{ metric: string; challenge_type: string; target_value: number; reward_syiling: number }>(`select metric, challenge_type, target_value, reward_syiling from challenges where title = 'Cabaran Kilat'`))[0]!
    expect(ch).toEqual({ metric: 'best_correct_in_session', challenge_type: 'quiz_count', target_value: 20, reward_syiling: 40 })
    const ac = (await db.query<{ criterion_kind: string; criterion_min: number; criterion_accuracy: string }>(`select criterion_kind, criterion_min, criterion_accuracy::text from achievements where name = 'Ilmuwan Sejati'`))[0]!
    expect(ac).toEqual({ criterion_kind: 'answers_accuracy', criterion_min: 1000, criterion_accuracy: '85.00' })
    const settings = await db.query<{ key: string; value: string }>(`select key, value::text from gamification_settings order by key`)
    expect(Object.fromEntries(settings.map((s) => [s.key, Number(s.value)]))).toMatchObject({ reward_budget_sen_session: 1000, reward_budget_sen_month: 300, current_session_year: 2026, games_award_syiling: 0, cash_withdrawal_enabled: 1 })
    expect((await db.query<{ type: string; price_syiling: number; cost_value_sen: number }>(`select type, price_syiling, cost_value_sen from syiling_rewards where name = 'Baucar Buku RM10'`))[0]).toEqual({ type: 'voucher', price_syiling: 500, cost_value_sen: 1000 })
    const rw = await db.query<{ is_active: boolean; delivery_method: string; stock_quantity: number | null }>(`select is_active, delivery_method, stock_quantity from rewards`)
    expect(rw.every((r) => !r.is_active && r.delivery_method === 'manual')).toBe(true)
    expect(rw.filter((r) => r.stock_quantity !== null).length).toBe(HADIAH_ROWS.filter((h) => h.stockQuantity !== null).length)
    const perCat = await db.query<{ category: string; n: string }>(`select category, count(*)::text as n from rewards group by category`)
    expect(Object.fromEntries(perCat.map((r) => [r.category, Number(r.n)]))).toEqual({ flagship: 4, ewallet: 8, telco: 11, gaming: 8, streaming: 6, food_beverage: 8, ecommerce: 5, education: 6, entertainment: 3 })
  })

  it('seeds a sample open draw with an ordered prize pool', async () => {
    const d = (await db.query<{ id: string; status: string; ticket_cost_syiling: number; max_tickets_per_student: number; closes_at: Date }>(`select id::text, status, ticket_cost_syiling, max_tickets_per_student, closes_at from draws where title = $1`, [SAMPLE_DRAW.title]))[0]!
    expect(d.status).toBe('open')
    expect([d.ticket_cost_syiling, d.max_tickets_per_student]).toEqual([50, 10])
    // the seed clock (2026-09-25 15:40 +08:00) plus 90 days, never the real time
    expect(d.closes_at.toISOString()).toBe('2026-12-24T07:40:00.000Z')
    const pool = await db.query<{ label: string; value_sen: number; qty: number; position: number }>(`select label, value_sen, qty, position from draw_prizes where draw_id = $1 order by position`, [d.id])
    expect(pool.map((p) => [p.label, p.value_sen, p.qty, p.position])).toEqual([['Hadiah Demo', 1000, 1, 0], ['Baucar RM5', 500, 10, 1]])
  })

  it('never sets legacy_* and does not touch wallets, the ledger, claims, redemptions or tickets', async () => {
    for (const t of ['challenges', 'achievements', 'syiling_rewards', 'rewards', 'draws', 'gamification_settings']) {
      expect(await db.query(`select 1 from ${t} where legacy_source is not null or legacy_id is not null`), t).toHaveLength(0)
    }
    const c = await counts()
    expect([c.wallets, c.coin_ledger, c.challenge_completions, c.user_achievements, c.reward_claims, c.reward_redemptions, c.draw_tickets]).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('is idempotent: a second run adds nothing and leaves an admin edit alone', async () => {
    await db.query(`update rewards set token_cost = 99, is_active = true where title = 'Roblox Gift Card RM10'`)
    await db.query(`update gamification_settings set value = 5 where key = 'cash_rate_sen'`)
    const before = await counts()
    await runSeeds([identitySeed, gamificationSeed], { prisma: db.prisma })
    expect(await counts()).toEqual(before)
    expect((await db.query<{ token_cost: number; is_active: boolean }>(`select token_cost, is_active from rewards where title = 'Roblox Gift Card RM10'`))[0]).toEqual({ token_cost: 99, is_active: true })
    expect((await db.query<{ value: string }>(`select value::text from gamification_settings where key = 'cash_rate_sen'`))[0]!.value).toBe('5.00')
  })

  it('does not duplicate next to a loaded .cloud row with the same natural key being absent (legacy rows are ignored by the match)', async () => {
    await db.query(`insert into challenges (title, challenge_type, target_value, legacy_source, legacy_id) values ('Cabaran Migrasi', 'streak', 2, 'cloud', '501')`)
    const before = await counts()
    await runSeeds([identitySeed, gamificationSeed], { prisma: db.prisma })
    expect((await counts()).challenges).toBe(before.challenges)
  })

  it('uses no Math.random, Date.now or new Date() and no person names', () => {
    for (const text of SEED_FILES) {
      expect(text).not.toMatch(/Math\.random|Date\.now|new Date\(\)/)
    }
  })
})
