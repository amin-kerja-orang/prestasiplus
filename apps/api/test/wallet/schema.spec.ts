import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { WALLET_LEDGER_TYPES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const MODELS_JSON = fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url))
/** One insert per migratable table with a legacy_source outside ('cloud', 'my'): the check must refuse it. */
const BAD_LEGACY_SOURCE: Record<string, string> = {
  coin_ledger: `insert into coin_ledger (user_id, type, source, amount, balance_after, description, legacy_source, legacy_id) values ((select min(id) from users), 'earn', 's', 1, 1, 'd', 'other', 'x')`,
  streaks: `insert into streaks (user_id, legacy_source, legacy_id) values ((select min(id) from users), 'other', 'x')`,
  tiers: `insert into tiers (tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order, legacy_source, legacy_id) values ('l', 'l', 'i', 'c', 0, 1, 1, 'other', 'x')`,
  wallets: `insert into wallets (user_id, legacy_source, legacy_id) values ((select min(id) from users), 'other', 'x')`,
}
const TABLES = ['tiers', 'wallets', 'coin_ledger', 'streaks', 'session_credits', 'daily_login_marks', 'token_movements']

describe('wallet schema (migration 0010_wallet_streak)', () => {
  let db: TestDatabase
  let n = 0

  const user = async (): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna ${String(n++)}') returning id::text`))[0]!.id
  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const ledger = (userId: string, type: string, amount: number, over: { source?: string; sourceId?: string | null } = {}) =>
    db.query(`insert into coin_ledger (user_id, type, source, source_id, amount, balance_after, description) values ($1, $2, $3, $4, $5, 0, 'd') returning id::text`, [
      userId,
      type,
      over.source ?? 'quiz_practice',
      over.sourceId === undefined ? null : over.sourceId,
      amount,
    ])

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('creates the seven tables with GENERATED ALWAYS identity keys', async () => {
    const rows = await db.query<{ table_name: string; identity_generation: string }>(
      `select table_name, identity_generation from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES' and table_name = any($1::text[])`,
      [TABLES],
    )
    expect(rows.map((r) => r.table_name).sort()).toEqual([...TABLES].sort())
    expect(new Set(rows.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
    expect(await rejects(`insert into tiers (id, tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order) values (99, 'x', 'x', 'x', 'x', 0, 1, 1)`)).toMatch(/non-DEFAULT/)
  })

  it('uses no Postgres enum type and stores the ledger type as text + check with the contract codes', async () => {
    expect(await db.query(`select 1 from pg_type where typtype = 'e'`)).toHaveLength(0)
    const u = await user()
    for (const type of WALLET_LEDGER_TYPES) await ledger(u, type, type === 'spend' || type === 'convert' ? -1 : 1)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description) values ($1, 'gift', 's', 1, 1, 'd')`, [u])).toMatch(/ck_coin_ledger_(type|amount_sign)/)
    const checks = await db.query<{ conname: string }>(`select conname from pg_constraint where conrelid = 'coin_ledger'::regclass and contype = 'c'`)
    expect(checks.map((c) => c.conname)).toContain('ck_coin_ledger_type')
  })

  it('the sign of a ledger amount follows the type (zero is allowed)', async () => {
    const u = await user()
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description) values ($1, 'earn', 's', -1, 0, 'd')`, [u])).toMatch(/ck_coin_ledger_amount_sign/)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description) values ($1, 'spend', 's', 1, 0, 'd')`, [u])).toMatch(/ck_coin_ledger_amount_sign/)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description) values ($1, 'convert', 's', 5, 0, 'd')`, [u])).toMatch(/ck_coin_ledger_amount_sign/)
    await ledger(u, 'earn', 0)
    await ledger(u, 'spend', 0)
  })

  it('credits are idempotent in the database: unique (user, source, source_id) where source_id is not null', async () => {
    const [a, b] = [await user(), await user()]
    await ledger(a, 'earn', 1, { sourceId: 'k1' })
    expect(await rejects(`insert into coin_ledger (user_id, type, source, source_id, amount, balance_after, description) values ($1, 'earn', 'quiz_practice', 'k1', 1, 2, 'd')`, [a])).toMatch(
      /uq_coin_ledger_user_source_source_id/,
    )
    await ledger(b, 'earn', 1, { sourceId: 'k1' }) // other user
    await ledger(a, 'earn', 1, { sourceId: 'k1', source: 'quiz_spm' }) // other source
    await ledger(a, 'earn', 1) // no key: any number of them
    await ledger(a, 'earn', 1)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, source_id, amount, balance_after, description) values ($1, 'earn', 's', '', 1, 1, 'd')`, [a])).toMatch(/ck_coin_ledger_source_id/)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description) values ($1, 'earn', '', 1, 1, 'd')`, [a])).toMatch(/ck_coin_ledger_source/)
  })

  it('L5: description is at most 500 characters; tokens belong to a convert row and are positive', async () => {
    const u = await user()
    const insert = (type: string, amount: number, tokens: number | null, description = 'd') =>
      db.query(`insert into coin_ledger (user_id, type, source, amount, balance_after, description, tokens) values ($1, $2, 's', $3, 0, $4, $5)`, [u, type, amount, description, tokens])
    await insert('earn', 1, null, 'x'.repeat(500))
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description) values ($1, 'earn', 's', 1, 0, $2)`, [u, 'x'.repeat(501)])).toMatch(/ck_coin_ledger_description/)
    await insert('convert', -100, 2)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description, tokens) values ($1, 'convert', 's', -100, 0, 'd', 0)`, [u])).toMatch(/ck_coin_ledger_tokens/)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description, tokens) values ($1, 'convert', 's', -100, 0, 'd', -2)`, [u])).toMatch(/ck_coin_ledger_tokens/)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description, tokens) values ($1, 'spend', 's', -100, 0, 'd', 2)`, [u])).toMatch(/ck_coin_ledger_tokens/)
    expect(await rejects(`insert into coin_ledger (user_id, type, source, amount, balance_after, description, tokens) values ($1, 'earn', 's', 1, 0, 'd', 2)`, [u])).toMatch(/ck_coin_ledger_tokens/)
  })

  it('M2: token movements are unique per (user, source, ref_id) when a ref_id is given; ref_id length is checked', async () => {
    const [a, b] = [await user(), await user()]
    await db.query(`insert into token_movements (user_id, delta, source, ref_id) values ($1, 2, 'hadiah_refund', 'r1')`, [a])
    expect(await rejects(`insert into token_movements (user_id, delta, source, ref_id) values ($1, 2, 'hadiah_refund', 'r1')`, [a])).toMatch(/uq_token_movements_user_source_ref_id/)
    await db.query(`insert into token_movements (user_id, delta, source, ref_id) values ($1, 2, 'hadiah_refund', 'r1')`, [b]) // other user
    await db.query(`insert into token_movements (user_id, delta, source, ref_id) values ($1, 2, 'other', 'r1')`, [a]) // other source
    await db.query(`insert into token_movements (user_id, delta, source) values ($1, 2, 'hadiah_refund')`, [a]) // no ref_id: outside the index
    await db.query(`insert into token_movements (user_id, delta, source) values ($1, 2, 'hadiah_refund')`, [a])
    expect(await rejects(`insert into token_movements (user_id, delta, source, ref_id) values ($1, 2, 's', '')`, [a])).toMatch(/ck_token_movements_ref_id/)
  })

  describe('coin_ledger is append-only in the database (AC2)', () => {
    it('refuses UPDATE and DELETE of a row born in v2', async () => {
      const u = await user()
      await ledger(u, 'earn', 5, { sourceId: 'ao' })
      expect(await rejects(`update coin_ledger set amount = 99 where user_id = $1`, [u])).toMatch(/append-only/)
      expect(await rejects(`update coin_ledger set description = 'x' where user_id = $1`, [u])).toMatch(/append-only/)
      expect(await rejects(`delete from coin_ledger where user_id = $1`, [u])).toMatch(/append-only/)
      expect(await db.query(`select amount from coin_ledger where user_id = $1`, [u])).toEqual([{ amount: 5 }])
    })

    it('allows the ETL to rewrite a migrated row (legacy_source set) but never to delete it', async () => {
      const u = await user()
      await db.query(
        `insert into coin_ledger (user_id, type, source, amount, balance_after, description, legacy_source, legacy_id) values ($1, 'earn', 'legacy', 5, 5, 'd', 'cloud', 'cl-1')`,
        [u],
      )
      await db.query(`update coin_ledger set description = 'corrigé by the ETL' where legacy_source = 'cloud' and legacy_id = 'cl-1'`)
      expect(await rejects(`delete from coin_ledger where legacy_id = 'cl-1'`)).toMatch(/append-only/)
    })

    it('a migrated row may be rewritten only while its identity (legacy_source, legacy_id, user_id) stays the same', async () => {
      const [u, other] = [await user(), await user()]
      await db.query(
        `insert into coin_ledger (user_id, type, source, amount, balance_after, description, legacy_source, legacy_id) values ($1, 'earn', 'legacy', 5, 5, 'd', 'cloud', 'cl-id')`,
        [u],
      )
      expect(await rejects(`update coin_ledger set legacy_id = 'cl-other' where legacy_id = 'cl-id'`)).toMatch(/append-only/)
      expect(await rejects(`update coin_ledger set legacy_source = 'my' where legacy_id = 'cl-id'`)).toMatch(/append-only/)
      expect(await rejects(`update coin_ledger set legacy_source = null, legacy_id = null where legacy_id = 'cl-id'`)).toMatch(/append-only/)
      expect(await rejects(`update coin_ledger set user_id = $1 where legacy_id = 'cl-id'`, [other])).toMatch(/append-only/)
      expect(await db.query(`select user_id::text from coin_ledger where legacy_id = 'cl-id'`)).toEqual([{ user_id: u }])
    })

    it('a DELETE is allowed only for the user cascade: a nested delete while the user exists is refused (no call-depth door)', async () => {
      const u = await user()
      await ledger(u, 'earn', 3, { sourceId: 'nested' })
      await db.query(`create table tmp_nested_probe (user_id bigint)`)
      await db.query(`create function tmp_nested_probe_fn() returns trigger language plpgsql as $$ begin delete from coin_ledger where user_id = new.user_id; return new; end; $$`)
      await db.query(`create trigger tmp_nested_probe_trg after insert on tmp_nested_probe for each row execute function tmp_nested_probe_fn()`)
      expect(await rejects(`insert into tmp_nested_probe (user_id) values ($1)`, [u])).toMatch(/append-only/)
      expect(await db.query(`select 1 from coin_ledger where user_id = $1`, [u])).toHaveLength(1)
      await db.query(`drop table tmp_nested_probe`)
      await db.query(`drop function tmp_nested_probe_fn()`)
    })

    it('refuses TRUNCATE of the ledger, also through a cascade from users', async () => {
      const u = await user()
      await ledger(u, 'earn', 1, { sourceId: 'trunc' })
      expect(await rejects(`truncate coin_ledger`)).toMatch(/cannot be truncated/)
      expect(await rejects(`truncate users cascade`)).toMatch(/cannot be truncated/)
      expect(await db.query(`select 1 from coin_ledger where user_id = $1`, [u])).toHaveLength(1)
      expect(await db.query(`select 1 from users where id = $1`, [u])).toHaveLength(1)
    })

    it('a user delete takes that user ledger with it (foreign key cascade), and only that', async () => {
      const [a, b] = [await user(), await user()]
      await ledger(a, 'earn', 1, { sourceId: 'c1' })
      await ledger(b, 'earn', 1, { sourceId: 'c1' })
      await db.query(`insert into wallets (user_id) values ($1)`, [a])
      await db.query(`delete from users where id = $1`, [a])
      expect(await db.query(`select 1 from coin_ledger where user_id = $1`, [a])).toHaveLength(0)
      expect(await db.query(`select 1 from wallets where user_id = $1`, [a])).toHaveLength(0)
      expect(await db.query(`select 1 from coin_ledger where user_id = $1`, [b])).toHaveLength(1)
    })
  })

  it('wallets: one per user, balances never negative (the token balance may be), level at least 1, tier restricted', async () => {
    const u = await user()
    await db.query(`insert into wallets (user_id) values ($1)`, [u])
    expect(await db.query(`select current_syiling, total_syiling_earned, token_balance, xp, level, tier_id from wallets where user_id = $1`, [u])).toEqual([
      { current_syiling: 0, total_syiling_earned: 0, token_balance: 0, xp: 0, level: 1, tier_id: null },
    ])
    expect(await rejects(`insert into wallets (user_id) values ($1)`, [u])).toMatch(/uq_wallets_user_id/)
    expect(await rejects(`update wallets set current_syiling = -1 where user_id = $1`, [u])).toMatch(/ck_wallets_current_syiling/)
    expect(await rejects(`update wallets set total_syiling_earned = -1 where user_id = $1`, [u])).toMatch(/ck_wallets_total_syiling_earned/)
    expect(await rejects(`update wallets set xp = -1 where user_id = $1`, [u])).toMatch(/ck_wallets_xp/)
    expect(await rejects(`update wallets set level = 0 where user_id = $1`, [u])).toMatch(/ck_wallets_level/)
    await db.query(`update wallets set token_balance = -4 where user_id = $1`, [u]) // DV-M14-10
    const [tier] = await db.query<{ id: string }>(`insert into tiers (tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order) values ('uji', 'Uji', 'i', '#000', 0, 50, 1) returning id::text`)
    await db.query(`update wallets set tier_id = $1 where user_id = $2`, [tier!.id, u])
    expect(await rejects(`delete from tiers where id = $1`, [tier!.id])).toMatch(/fk_wallets_tier_id/)
  })

  it('tiers: unique name, positive rate, rates stored as numeric(10,4), perks default to an empty array', async () => {
    await db.query(`insert into tiers (tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order) values ('t1', 'T1', 'i', '#000', 0, 12.5, 1)`)
    expect(await rejects(`insert into tiers (tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order) values ('t1', 'T1', 'i', '#000', 0, 1, 1)`)).toMatch(/uq_tiers_tier_name/)
    expect(await rejects(`insert into tiers (tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order) values ('t2', 'T', 'i', '#000', 0, 0, 1)`)).toMatch(/ck_tiers_conversion_rate/)
    expect(await rejects(`insert into tiers (tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order) values ('t3', 'T', 'i', '#000', -1, 1, 1)`)).toMatch(/ck_tiers_min_syiling/)
    const [r] = await db.query<{ perks: string[]; conversion_rate: string; quiz_reward_l5: number; is_active: boolean }>(
      `select perks, conversion_rate::text, quiz_reward_l5, is_active from tiers where tier_name = 't1'`,
    )
    expect(r).toEqual({ perks: [], conversion_rate: '12.5000', quiz_reward_l5: 0, is_active: true })
  })

  it('streaks: one row per user, counters not negative, last activity is a date', async () => {
    const u = await user()
    await db.query(`insert into streaks (user_id, current, best, last_activity_date, total_days) values ($1, 2, 2, '2026-10-19', 2)`, [u])
    expect(await rejects(`insert into streaks (user_id) values ($1)`, [u])).toMatch(/uq_streaks_user_id/)
    expect(await rejects(`update streaks set current = -1 where user_id = $1`, [u])).toMatch(/ck_streaks_counts/)
    expect(await rejects(`update streaks set last_activity_date = 'not a date' where user_id = $1`, [u])).toBeTruthy()
  })

  it('session_credits: a session credits once; daily_login_marks: once per user and day; token_movements: delta is never 0', async () => {
    const u = await user()
    const sid = '4f3b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59'
    const insert = `insert into session_credits (session_id, user_id, coins_earned, points_earned, streak_count, total_balance, completed_at) values ($1, $2, 1, 10, 1, 1, now())`
    await db.query(insert, [sid, u])
    expect(await rejects(insert, [sid, u])).toMatch(/uq_session_credits_session_id/)
    expect(await rejects(insert, ['not-a-uuid', u])).toBeTruthy()
    await db.query(`insert into daily_login_marks (user_id, mark_date) values ($1, '2026-10-19')`, [u])
    expect(await rejects(`insert into daily_login_marks (user_id, mark_date) values ($1, '2026-10-19')`, [u])).toMatch(/uq_daily_login_marks_user_date/)
    await db.query(`insert into daily_login_marks (user_id, mark_date) values ($1, '2026-10-20')`, [u])
    expect(await rejects(`insert into token_movements (user_id, delta, source) values ($1, 0, 'x')`, [u])).toMatch(/ck_token_movements_delta/)
    await db.query(`insert into token_movements (user_id, delta, source) values ($1, -2, 'hadiah_redeem')`, [u])
  })

  it('migration-first (plan 14.9): the migratable tables carry the legacy pair and unique, the others carry no legacy column', async () => {
    const listed: string[] = JSON.parse(readFileSync(MODELS_JSON, 'utf8'))
    for (const table of ['coin_ledger', 'streaks', 'tiers', 'wallets']) {
      expect(listed, table).toContain(table)
      const cols = (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = $1 and column_name like 'legacy_%'`, [table])).map((c) => c.column_name)
      expect(cols.sort(), table).toEqual(table === 'coin_ledger' ? ['legacy_hash', 'legacy_id', 'legacy_source'] : ['legacy_id', 'legacy_source'])
      expect(await db.query(`select 1 from pg_indexes where tablename = $1 and indexname = $2`, [table, `uq_${table}_legacy`]), table).toHaveLength(1)
      expect(await rejects(BAD_LEGACY_SOURCE[table]!), table).toMatch(/legacy_source/)
    }
    for (const table of ['session_credits', 'daily_login_marks', 'token_movements']) {
      expect(listed, table).not.toContain(table)
      expect(await db.query(`select 1 from information_schema.columns where table_name = $1 and column_name like 'legacy_%'`, [table]), table).toHaveLength(0)
    }
  })

  it('the ledger read path has an index: user, created_at desc, id desc', async () => {
    const [ix] = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_coin_ledger_user_id_created_at_id'`)
    expect(ix?.indexdef).toMatch(/\(user_id, created_at DESC, id DESC\)/)
  })
})
