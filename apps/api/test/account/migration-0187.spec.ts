import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S5-T04, migration 0187 (DM-84): the table `mood_checkins`. */
const MIGRATION = fileURLToPath(new URL('../../prisma/migrations/0187_s5_mood_checkins/migration.sql', import.meta.url))

describe('migration 0187 mood_checkins', () => {
  let db: TestDatabase
  let u: string
  let n = 0

  const user = async (): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna ${n++}') returning id::text`))[0]!.id
  const checkin = (uid: string, mood: string, day = '2026-11-05') => db.query(`insert into mood_checkins (user_id, mood, checked_on) values ($1::bigint, $2, $3::date)`, [uid, mood, day])

  beforeAll(async () => {
    db = await createTestDatabase()
    u = await user()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('has the DM-84 columns, with reason as varchar(255) null and created_at defaulted', async () => {
    const cols = await db.query<{ column_name: string; data_type: string; is_nullable: string; character_maximum_length: number | null }>(
      `select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_name = 'mood_checkins' order by ordinal_position`,
    )
    expect(cols.map((c) => c.column_name)).toEqual(['id', 'user_id', 'mood', 'checked_on', 'reason', 'is_test', 'created_at'])
    const by = Object.fromEntries(cols.map((c) => [c.column_name, c]))
    expect(by.checked_on).toMatchObject({ data_type: 'date', is_nullable: 'NO' })
    expect(by.reason).toMatchObject({ data_type: 'character varying', is_nullable: 'YES', character_maximum_length: 255 })
    await checkin(u, 'gembira')
    const [row] = await db.query<{ reason: string | null; is_test: boolean; created_at: Date }>(`select reason, is_test, created_at from mood_checkins where user_id = $1::bigint`, [u])
    expect(row!.reason).toBeNull()
    expect(row!.is_test).toBe(false)
    expect(row!.created_at).toBeInstanceOf(Date)
  })

  it('accepts the four values and refuses any other', async () => {
    for (const [i, m] of ['okay', 'sedih', 'tertekan'].entries()) await checkin(u, m, `2026-11-0${i + 1}`)
    for (const bad of ['happy', 'sad', 'stressed', 'ok', '']) await expect(checkin(u, bad, '2026-12-01')).rejects.toThrow(/ck_mood_checkins_mood/)
  })

  it('allows one row per user per day only, and another user the same day', async () => {
    await expect(checkin(u, 'sedih', '2026-11-05')).rejects.toThrow(/uq_mood_checkins_user_day/)
    await checkin(await user(), 'sedih', '2026-11-05')
  })

  it('deletes the rows with the user (ON DELETE CASCADE)', async () => {
    const v = await user()
    await checkin(v, 'okay')
    await db.query(`delete from users where id = $1::bigint`, [v])
    expect(Number((await db.query<{ n: string }>(`select count(*) n from mood_checkins where user_id = $1::bigint`, [v]))[0]!.n)).toBe(0)
  })

  it('is additive: the file carries a rollback line and creates nothing but the table', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toMatch(/-- rollback: DROP TABLE "mood_checkins";/)
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1)
    expect(sql).not.toMatch(/DROP |ALTER TABLE "(?!mood_checkins)/)
  })
})
