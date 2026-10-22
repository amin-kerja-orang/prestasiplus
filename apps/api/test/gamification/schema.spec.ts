import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const MODELS_JSON = fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url))
const TABLES = [
  'challenges',
  'challenge_completions',
  'achievements',
  'user_achievements',
  'learner_badges',
  'learner_badge_holdings',
  'referral_codes',
  'referrals',
  'draws',
  'draw_prizes',
  'draw_tickets',
  'syiling_rewards',
  'reward_claims',
  'rewards',
  'reward_redemptions',
  'mystery_box_openings',
  'gamification_settings',
]
/** Tables the data model marks LEG: they carry legacy_source/legacy_id and are listed for the ETL. */
const LEGACY = ['achievements', 'challenge_completions', 'challenges', 'draws', 'gamification_settings', 'referral_codes', 'referrals', 'reward_claims', 'reward_redemptions', 'rewards', 'syiling_rewards', 'user_achievements']

describe('gamification schema (migration 0019_gamification_shop)', () => {
  let db: TestDatabase
  let n = 0

  const user = async (): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna ${String(n++)}') returning id::text`))[0]!.id
  const one = async (sql: string, params: unknown[] = []): Promise<string> => (await db.query<{ id: string }>(sql, params))[0]!.id
  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const challenge = () => one(`insert into challenges (title, challenge_type, target_value) values ('Cabaran', 'quiz_count', 1) returning id::text`)
  const draw = () => one(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student) values ('Cabutan', 10, 2) returning id::text`)
  const reward = (stock: number | null = null) =>
    one(`insert into rewards (category, vendor, title, denomination_rm, token_cost, stock_quantity) values ('telco', 'V', 'T' || gen_random_uuid()::text, 10, 10, $1) returning id::text`, [stock])

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('creates the seventeen tables with GENERATED ALWAYS identity keys and no Postgres enum type', async () => {
    const rows = await db.query<{ table_name: string; identity_generation: string }>(
      `select table_name, identity_generation from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES' and table_name = any($1::text[])`,
      [TABLES],
    )
    expect(rows.map((r) => r.table_name).sort()).toEqual([...TABLES].sort())
    expect(new Set(rows.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
    expect(await db.query(`select 1 from pg_type where typtype = 'e'`)).toHaveLength(0)
  })

  it('carries legacy_source/legacy_id, the unique pair and the cloud/my check on exactly the LEG tables, all listed for the ETL', async () => {
    const listed: string[] = JSON.parse(readFileSync(MODELS_JSON, 'utf8'))
    for (const t of LEGACY) expect(listed).toContain(t)
    const withLegacy = await db.query<{ table_name: string }>(
      `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'legacy_source' and table_name = any($1::text[])`,
      [TABLES],
    )
    expect(withLegacy.map((r) => r.table_name).sort()).toEqual([...LEGACY].sort())
    for (const t of LEGACY) {
      const idx = await db.query(`select 1 from pg_indexes where tablename = $1 and indexname = $2`, [t, `uq_${t}_legacy`])
      expect(idx, t).toHaveLength(1)
      const ck = await db.query(`select 1 from pg_constraint where conrelid = $1::regclass and conname = $2`, [t, `ck_${t}_legacy_source`])
      expect(ck, t).toHaveLength(1)
    }
    expect(await rejects(`insert into rewards (category, vendor, title, denomination_rm, token_cost, legacy_source, legacy_id) values ('telco', 'V', 'T', 1, 1, 'other', 'x')`)).toMatch(/ck_rewards_legacy_source/)
    // The legacy pair is unique, but v2-born rows (null pair) never clash.
    await db.query(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student, legacy_source, legacy_id) values ('A', 1, 1, 'cloud', '7')`)
    expect(await rejects(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student, legacy_source, legacy_id) values ('B', 1, 1, 'cloud', '7')`)).toMatch(/uq_draws_legacy/)
    await draw()
    await draw()
  })

  it('checks the enum codes of challenges, achievements, draws, syiling rewards, rewards and redemptions', async () => {
    expect(await rejects(`insert into challenges (title, challenge_type, target_value) values ('x', 'bogus', 1)`)).toMatch(/ck_challenges_challenge_type/)
    expect(await rejects(`insert into challenges (title, challenge_type, metric, target_value) values ('x', 'accuracy', 'bestAccuracy', 1)`)).toMatch(/ck_challenges_metric/)
    expect(await rejects(`insert into challenges (title, challenge_type, target_value, difficulty) values ('x', 'accuracy', 1, 'extreme')`)).toMatch(/ck_challenges_difficulty/)
    expect(await rejects(`insert into challenges (title, challenge_type, target_value) values ('x', 'accuracy', 0)`)).toMatch(/ck_challenges_amounts/)
    await db.query(`insert into challenges (title, challenge_type, metric, target_value) values ('ok', 'accuracy', 'best_accuracy', 80)`)
    // a migrated challenge may have no metric (OD-25)
    await db.query(`insert into challenges (title, challenge_type, target_value) values ('legacy', 'accuracy', 80)`)

    expect(await rejects(`insert into achievements (name, rarity) values ('x', 'mythic')`)).toMatch(/ck_achievements_rarity/)
    expect(await rejects(`insert into achievements (name, criterion_kind, criterion_min) values ('x', 'practiceSessions', 1)`)).toMatch(/ck_achievements_criterion_kind/)
    expect(await rejects(`insert into achievements (name, criterion_kind) values ('x', 'streak')`)).toMatch(/ck_achievements_criterion_pair/)
    expect(await rejects(`insert into achievements (name, criterion_kind, criterion_min, criterion_accuracy) values ('x', 'streak', 3, 85)`)).toMatch(/ck_achievements_criterion_accuracy/)
    await db.query(`insert into achievements (name, criterion_kind, criterion_min, criterion_accuracy) values ('acc', 'answers_accuracy', 1000, 85)`)
    await db.query(`insert into achievements (name, legacy_criteria_text) values ('legacy', 'Jawab banyak')`)

    expect(await rejects(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student, status) values ('x', 1, 1, 'done')`)).toMatch(/ck_draws_status/)
    expect(await rejects(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student) values ('x', 1, 0)`)).toMatch(/ck_draws_amounts/)
    expect((await db.query<{ status: string }>(`select status from draws limit 1`))[0]!.status).toBe('draft')

    expect(await rejects(`insert into syiling_rewards (name, type, price_syiling, cost_value_sen) values ('x', 'VOUCHER', 1, 1)`)).toMatch(/ck_syiling_rewards_type/)
    expect(await rejects(`insert into rewards (category, vendor, title, denomination_rm, token_cost) values ('bogus', 'V', 'T', 1, 1)`)).toMatch(/ck_rewards_category/)
    expect(await rejects(`insert into rewards (category, vendor, title, denomination_rm, token_cost, delivery_method) values ('telco', 'V', 'T', 1, 1, 'post')`)).toMatch(/ck_rewards_delivery_method/)

    const u = await user()
    expect(await rejects(`insert into reward_redemptions (user_id, reward_title, reward_vendor, denomination_rm, token_cost, status) values ($1, 'T', 'V', 1, 1, 'shipped')`, [u])).toMatch(/ck_reward_redemptions_status/)
    expect(await rejects(`insert into reward_redemptions (user_id, reward_title, reward_vendor, denomination_rm, token_cost, status, cancelled_by) values ($1, 'T', 'V', 1, 1, 'cancelled', 'user')`, [u])).toMatch(/ck_reward_redemptions_cancelled_by/)

    expect(await rejects(`insert into gamification_settings (key, value, label) values ('unknown_key', 1, 'x')`)).toMatch(/ck_gamification_settings_key/)
  })

  it('completes a challenge once per user, challenge and Malaysia day (idempotency key)', async () => {
    const [u, other] = [await user(), await user()]
    const c = await challenge()
    const insert = (uid: string, day: string) =>
      db.query(`insert into challenge_completions (user_id, challenge_id, completion_date) values ($1, $2, $3)`, [uid, c, day])
    await insert(u, '2026-09-25')
    expect(await rejects(`insert into challenge_completions (user_id, challenge_id, completion_date) values ($1, $2, '2026-09-25')`, [u, c])).toMatch(/uq_challenge_completions_user_challenge_date/)
    // the conditional insert a service uses: second call adds nothing
    const again = await db.query(
      `insert into challenge_completions (user_id, challenge_id, completion_date) values ($1, $2, '2026-09-25') on conflict (user_id, challenge_id, completion_date) do nothing returning id`,
      [u, c],
    )
    expect(again).toHaveLength(0)
    await insert(u, '2026-09-26')
    await insert(other, '2026-09-25')
    expect(await db.query(`select 1 from challenge_completions`)).toHaveLength(3)
    // is_test defaults to false
    expect((await db.query<{ is_test: boolean }>(`select is_test from challenge_completions limit 1`))[0]!.is_test).toBe(false)
  })

  it('unlocks an achievement and awards a learner badge once per user', async () => {
    const u = await user()
    const a = await one(`insert into achievements (name) values ('Langkah') returning id::text`)
    await db.query(`insert into user_achievements (user_id, achievement_id) values ($1, $2)`, [u, a])
    expect(await rejects(`insert into user_achievements (user_id, achievement_id) values ($1, $2)`, [u, a])).toMatch(/uq_user_achievements_user_achievement/)
    const b = await one(`insert into learner_badges (name, icon) values ('Lencana', 'fa-star') returning id::text`)
    await db.query(`insert into learner_badge_holdings (user_id, badge_id) values ($1, $2)`, [u, b])
    expect(await rejects(`insert into learner_badge_holdings (user_id, badge_id) values ($1, $2)`, [u, b])).toMatch(/uq_learner_badge_holdings_user_badge/)
  })

  it('keeps one referral code per user and per code, and one referral per referee', async () => {
    const [a, b, c] = [await user(), await user(), await user()]
    await db.query(`insert into referral_codes (user_id, code) values ($1, 'KODA')`, [a])
    expect(await rejects(`insert into referral_codes (user_id, code) values ($1, 'KODB')`, [a])).toMatch(/uq_referral_codes_user_id/)
    expect(await rejects(`insert into referral_codes (user_id, code) values ($1, 'KODA')`, [b])).toMatch(/uq_referral_codes_code/)
    await db.query(`insert into referrals (referrer_id, referee_id, code_used) values ($1, $2, 'KODA')`, [a, b])
    expect(await rejects(`insert into referrals (referrer_id, referee_id, code_used) values ($1, $2, 'KODA')`, [c, b])).toMatch(/uq_referrals_referee_id/)
    expect(await rejects(`insert into referrals (referrer_id, referee_id, code_used) values ($1, $1, 'KODA')`, [c])).toMatch(/ck_referrals_not_self/)
    expect((await db.query<{ rewarded: boolean }>(`select rewarded from referrals`))[0]!.rewarded).toBe(false)
  })

  it('stores a draw prize pool as ordered rows and deleting the draw cascades to them (OD-28)', async () => {
    const d = await draw()
    await db.query(`insert into draw_prizes (draw_id, label, value_sen, qty, position) values ($1, 'Hadiah Pertama', 1000, 1, 0), ($1, 'Baucar RM5', 500, 10, 1)`, [d])
    const pool = await db.query<{ label: string; value_sen: number; qty: number; position: number }>(`select label, value_sen, qty, position from draw_prizes where draw_id = $1 order by position`, [d])
    expect(pool.map((p) => [p.label, p.value_sen, p.qty, p.position])).toEqual([['Hadiah Pertama', 1000, 1, 0], ['Baucar RM5', 500, 10, 1]])
    expect(await rejects(`insert into draw_prizes (draw_id, label, value_sen, qty, position) values ($1, 'Dup', 1, 1, 1)`, [d])).toMatch(/uq_draw_prizes_draw_position/)
    expect(await rejects(`insert into draw_prizes (draw_id, label, value_sen, qty, position) values ($1, 'Zero', 1, 0, 2)`, [d])).toMatch(/ck_draw_prizes_amounts/)
    expect(await rejects(`insert into draw_prizes (draw_id, label, value_sen, qty, position) values ($1, 'Neg', -1, 1, 2)`, [d])).toMatch(/ck_draw_prizes_amounts/)
    await db.query(`delete from draws where id = $1`, [d])
    expect(await db.query(`select 1 from draw_prizes where draw_id = $1`, [d])).toHaveLength(0)
  })

  it('counts draw tickets per draw and user, and refuses to delete a draw that has tickets', async () => {
    const [d, u, v] = [await draw(), await user(), await user()]
    await db.query(`insert into draw_tickets (draw_id, user_id) values ($1, $2), ($1, $2), ($1, $3)`, [d, u, v])
    const counts = await db.query<{ user_id: string; n: string }>(`select user_id::text, count(*)::text as n from draw_tickets where draw_id = $1 group by user_id order by user_id`, [d])
    expect(counts.map((c) => Number(c.n)).sort()).toEqual([1, 2])
    expect(await rejects(`delete from draws where id = $1`, [d])).toMatch(/fk_draw_tickets_draw_id/)
  })

  it('takes stock with a conditional decrement that never goes below zero; null stock is unlimited', async () => {
    const r = await reward(2)
    const take = async (id: string) =>
      (await db.query(`update rewards set stock_quantity = stock_quantity - 1 where id = $1 and (stock_quantity is null or stock_quantity > 0) returning id`, [id])).length
    expect([await take(r), await take(r), await take(r)]).toEqual([1, 1, 0])
    expect((await db.query<{ stock_quantity: number }>(`select stock_quantity from rewards where id = $1`, [r]))[0]!.stock_quantity).toBe(0)
    expect(await rejects(`update rewards set stock_quantity = -1 where id = $1`, [r])).toMatch(/ck_rewards_stock_quantity/)
    const unlimited = await reward(null)
    const unlimitedTake = (
      await db.query(`update rewards set stock_quantity = stock_quantity - 1 where id = $1 and (stock_quantity is null or stock_quantity > 0) returning id`, [unlimited])
    ).length
    expect(unlimitedTake).toBe(1)
    expect((await db.query<{ stock_quantity: number | null }>(`select stock_quantity from rewards where id = $1`, [unlimited]))[0]!.stock_quantity).toBeNull()
  })

  it('N concurrent buyers of N-1 units get exactly N-1 successes', async () => {
    const r = await reward(4)
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        db.query(`update rewards set stock_quantity = stock_quantity - 1 where id = $1 and (stock_quantity is null or stock_quantity > 0) returning id`, [r]),
      ),
    )
    expect(results.filter((x) => x.length === 1)).toHaveLength(4)
  })

  it('snapshots a redemption and keeps it when the reward is deleted (reward_id set null); counts a monthly cap by user and reward', async () => {
    const [u, r] = [await user(), await reward()]
    await db.query(
      `insert into reward_redemptions (user_id, reward_id, reward_title, reward_vendor, denomination_rm, token_cost, status, voucher_code) values ($1, $2, 'T', 'V', 10, 10, 'pending_admin', null), ($1, $2, 'T', 'V', 10, 10, 'cancelled', null)`,
      [u, r],
    )
    const month = await db.query<{ n: string }>(
      `select count(*)::text as n from reward_redemptions where user_id = $1 and reward_id = $2 and status <> 'cancelled' and created_at >= date_trunc('month', now())`,
      [u, r],
    )
    expect(month[0]!.n).toBe('1')
    await db.query(`delete from rewards where id = $1`, [r])
    const rows = await db.query<{ reward_id: string | null; reward_title: string }>(`select reward_id, reward_title from reward_redemptions where user_id = $1`, [u])
    expect(rows).toHaveLength(2)
    expect(rows.every((x) => x.reward_id === null && x.reward_title === 'T')).toBe(true)
  })

  it('records claims against Syiling rewards (a reward with claims cannot be deleted) and mystery box openings', async () => {
    const u = await user()
    const s = await one(`insert into syiling_rewards (name, type, price_syiling, cost_value_sen) values ('Baucar', 'voucher', 500, 1000) returning id::text`)
    await db.query(`insert into reward_claims (user_id, reward_id, cost_value_sen) values ($1, $2, 1000)`, [u, s])
    expect(await rejects(`delete from syiling_rewards where id = $1`, [s])).toMatch(/fk_reward_claims_reward_id/)
    await db.query(`insert into mystery_box_openings (user_id, box_id, coins, xp) values ($1, 2, 30, 12)`, [u])
    expect(await rejects(`insert into mystery_box_openings (user_id, box_id, coins, xp) values ($1, 0, 1, 1)`, [u])).toMatch(/ck_mystery_box_openings_amounts/)
  })

  it('upserts a setting by its unique key and keeps a numeric(12,2) value', async () => {
    await db.query(`insert into gamification_settings (key, value, label) values ('cash_rate_sen', 8, 'Sen') on conflict (key) do update set value = excluded.value`)
    await db.query(`insert into gamification_settings (key, value, label) values ('cash_rate_sen', 9.5, 'Sen') on conflict (key) do update set value = excluded.value`)
    const rows = await db.query<{ value: string }>(`select value::text from gamification_settings where key = 'cash_rate_sen'`)
    expect(rows).toEqual([{ value: '9.50' }])
  })

  it('erasing a user removes their completions, unlocks, tickets and redemptions', async () => {
    const u = await user()
    const c = await challenge()
    await db.query(`insert into challenge_completions (user_id, challenge_id, completion_date) values ($1, $2, '2026-10-01')`, [u, c])
    await db.query(`insert into draw_tickets (draw_id, user_id) values ($1, $2)`, [await draw(), u])
    await db.query(`insert into reward_redemptions (user_id, reward_title, reward_vendor, denomination_rm, token_cost, status) values ($1, 'T', 'V', 1, 1, 'pending_admin')`, [u])
    await db.query(`delete from users where id = $1`, [u])
    for (const t of ['challenge_completions', 'draw_tickets', 'reward_redemptions']) expect(await db.query(`select 1 from ${t} where user_id = $1`, [u]), t).toHaveLength(0)
  })
})
