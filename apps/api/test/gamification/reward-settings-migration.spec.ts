import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T05, DM-48, migration 0223: the singleton `reward_settings` and the copy of the four values out of
 * `gamification_settings`. The test database already ran every migration (on empty tables), so each case drops the
 * table and runs the file again on the rows it set up.
 */
const MIGRATION_0223 = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0223_s7_reward_settings/migration.sql', import.meta.url)), 'utf8')
const FOUR_KEYS = ['flat_quiz_reward', 'reward_budget_sen_session', 'current_session_year', 'games_award_syiling']

describe('migration 0223 reward_settings', () => {
  let db: TestDatabase

  const setting = (key: string, value: number) => db.query(`insert into gamification_settings (key, value, label) values ($1, $2, 'Label')`, [key, value])
  const row = async () => {
    const rows = await db.query<{ id: number; coins_per_correct: number; redeem_budget_sen: number; session_year: number; mini_games_give_coins: boolean; updated_by: string | null }>(
      `select id, coins_per_correct, redeem_budget_sen, session_year, mini_games_give_coins, updated_by::text from reward_settings`,
    )
    expect(rows).toHaveLength(1)
    return rows[0]!
  }
  const rerun = async () => {
    await db.query('drop table reward_settings')
    await db.query(MIGRATION_0223)
  }
  const rejects = async (sql: string): Promise<string> => {
    try {
      await db.query(sql)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })
  beforeEach(async () => {
    await db.query('delete from gamification_settings')
  })

  it('fresh install: one row with the DM-48 defaults (rate 1, RM3.00, 2026, games XP only), so the helper reads 1', async () => {
    await rerun()
    expect(await row()).toEqual({ id: 1, coins_per_correct: 1, redeem_budget_sen: 300, session_year: 2026, mini_games_give_coins: false, updated_by: null })
  })

  it('copies the four values of gamification_settings and leaves the source rows in place', async () => {
    await setting('flat_quiz_reward', 3)
    await setting('reward_budget_sen_session', 500)
    await setting('current_session_year', 2027)
    await setting('games_award_syiling', 1)
    await rerun()
    expect(await row()).toMatchObject({ coins_per_correct: 3, redeem_budget_sen: 500, session_year: 2027, mini_games_give_coins: true })
    const kept = await db.query<{ key: string }>(`select key from gamification_settings where key = any($1::text[]) order by key`, [FOUR_KEYS])
    expect(kept.map((r) => r.key)).toEqual([...FOUR_KEYS].sort())
  })

  it('a stored rate of 0 is copied, not replaced by the default', async () => {
    await setting('flat_quiz_reward', 0)
    await rerun()
    expect((await row()).coins_per_correct).toBe(0)
  })

  it('a value outside its range takes the default, so the deploy never stops on a bad row', async () => {
    await setting('flat_quiz_reward', 21)
    await setting('reward_budget_sen_session', 100001)
    await setting('current_session_year', 40000)
    await rerun()
    expect(await row()).toMatchObject({ coins_per_correct: 1, redeem_budget_sen: 300, session_year: 2026 })
  })

  it('accepts the inclusive bounds and rounds before it checks the range', async () => {
    await setting('flat_quiz_reward', 20.4)
    await setting('reward_budget_sen_session', 100000)
    await setting('current_session_year', 2100)
    await rerun()
    expect(await row()).toMatchObject({ coins_per_correct: 20, redeem_budget_sen: 100000, session_year: 2100 })
    await db.query('delete from gamification_settings')
    await setting('flat_quiz_reward', 20.5)
    await setting('reward_budget_sen_session', 0)
    await setting('current_session_year', 2020)
    await rerun()
    expect(await row()).toMatchObject({ coins_per_correct: 1, redeem_budget_sen: 0, session_year: 2020 })
  })

  it('a key with no row takes its default while the others are copied', async () => {
    await setting('flat_quiz_reward', 5)
    await rerun()
    expect(await row()).toMatchObject({ coins_per_correct: 5, redeem_budget_sen: 300, session_year: 2026, mini_games_give_coins: false })
  })

  it('the games toggle is on only for a stored 1', async () => {
    await setting('games_award_syiling', 0)
    await rerun()
    expect((await row()).mini_games_give_coins).toBe(false)
    await db.query(`update gamification_settings set value = 1 where key = 'games_award_syiling'`)
    await rerun()
    expect((await row()).mini_games_give_coins).toBe(true)
  })

  it('keeps exactly one row and the rate inside 0..20', async () => {
    await rerun()
    expect(await rejects(`insert into reward_settings (id, session_year) values (2, 2026)`)).toMatch(/ck_reward_settings_singleton/)
    expect(await rejects(`insert into reward_settings (session_year) values (2026)`)).toMatch(/reward_settings_pkey/)
    expect(await rejects(`update reward_settings set coins_per_correct = 21`)).toMatch(/ck_reward_settings_coins_per_correct/)
    expect(await rejects(`update reward_settings set coins_per_correct = -1`)).toMatch(/ck_reward_settings_coins_per_correct/)
    await db.query(`update reward_settings set coins_per_correct = 20`)
    expect((await row()).coins_per_correct).toBe(20)
  })

  it('updated_by follows the user and is cleared when the user goes', async () => {
    await rerun()
    const [user] = await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Contoh') returning id::text`)
    await db.query(`update reward_settings set updated_by = $1::bigint`, [user!.id])
    expect((await row()).updated_by).toBe(user!.id)
    await db.query(`delete from users where id = $1::bigint`, [user!.id])
    expect((await row()).updated_by).toBeNull()
  })
})
