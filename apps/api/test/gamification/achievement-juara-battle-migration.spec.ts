import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T04 part 4, DM-38, migration 0234 (ruling 22): `battle_wins` in `ck_achievements_criterion_kind` and badge #26
 * "Juara Battle". The test database already ran the file on empty tables, so each case clears `achievements`, sets up
 * its rows and runs the file again.
 */
const MIGRATION_0234 = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0234_s7_achievement_juara_battle/migration.sql', import.meta.url)), 'utf8')

interface Row {
  name: string
  description: string
  icon: string
  rarity: string
  reward_syiling: number
  reward_xp: number
  criterion_kind: string | null
  criterion_min: number | null
  legacy_criteria_text: string | null
}

describe('migration 0234 achievement Juara Battle', () => {
  let db: TestDatabase

  const rows = () =>
    db.query<Row>(
      `select name, description, icon, rarity, reward_syiling, reward_xp, criterion_kind, criterion_min, legacy_criteria_text from achievements where lower(btrim(name)) = 'juara battle'`,
    )
  const rerun = () => db.query(MIGRATION_0234)
  const rejects = async (sql: string): Promise<string> => {
    try {
      await db.query(sql)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const BADGE = { criterion_kind: 'battle_wins', criterion_min: 10, rarity: 'rare', reward_syiling: 30, reward_xp: 20 }

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })
  beforeEach(async () => {
    await db.query('delete from achievements')
  })

  it('the check accepts battle_wins, keeps the old kinds and still rejects an unknown kind', async () => {
    await rerun()
    await db.query(`insert into achievements (name, criterion_kind, criterion_min) values ('A', 'battle_wins', 1)`)
    await db.query(`insert into achievements (name, criterion_kind, criterion_min) values ('B', 'perfect_days', 1)`)
    expect(await rejects(`insert into achievements (name, criterion_kind, criterion_min) values ('C', 'battle_win', 1)`)).toMatch(/ck_achievements_criterion_kind/)
  })

  it('updates a legacy row with a null criterion instead of duplicating it', async () => {
    await db.query(`insert into achievements (name, description, rarity, legacy_criteria_text) values ('  JUARA battle ', 'Teks lama', 'common', 'Menang 10 battle')`)
    await rerun()
    const r = await rows()
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ ...BADGE, description: 'Teks lama', legacy_criteria_text: 'Menang 10 battle' })
  })

  it('leaves a row that already has a criterion alone', async () => {
    await db.query(`insert into achievements (name, rarity, reward_syiling, reward_xp, criterion_kind, criterion_min) values ('Juara Battle', 'epic', 99, 88, 'streak', 7)`)
    await rerun()
    const r = await rows()
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ criterion_kind: 'streak', criterion_min: 7, rarity: 'epic', reward_syiling: 99, reward_xp: 88 })
  })

  it('inserts the row when none exists', async () => {
    await rerun()
    const r = await rows()
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ ...BADGE, name: 'Juara Battle', description: 'Menang 10 battle', legacy_criteria_text: null })
    expect(r[0]!.icon).not.toBe('')
  })

  it('is idempotent: a second and third run leave one row', async () => {
    await rerun()
    await rerun()
    await rerun()
    expect(await rows()).toHaveLength(1)
    const n = (await db.query<{ n: string }>(`select count(*)::text as n from achievements`))[0]!.n
    expect(n).toBe('1')
  })
})
