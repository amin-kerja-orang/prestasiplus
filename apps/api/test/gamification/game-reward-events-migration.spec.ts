import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S7-T01, migration 0233: DM-87. Each case runs the reversal written in the file's own comment and then the file again. */
const MIGRATION = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0233_s7_game_reward_events/migration.sql', import.meta.url)), 'utf8')
const REVERSE = MIGRATION.split('\n')
  .filter((line) => /^-- {3}(DELETE|ALTER|DROP) /.test(line))
  .map((line) => line.slice(5))
  .join('\n')

const SESSION_A = '00000000-0000-4000-8000-00000000000a'
const SESSION_B = '00000000-0000-4000-8000-00000000000b'

describe('migration 0233 game reward events', () => {
  let db: TestDatabase

  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const addUser = async () => {
    const [user] = await db.query<{ id: string }>(`insert into users (name) values ('Pengguna') returning id::text`)
    return user!.id
  }
  const insert = `insert into game_reward_events (game_session_id, user_id, xp, syiling, capped_reason) values ($1::uuid, $2::bigint, $3, $4, $5)`

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })
  beforeEach(async () => {
    await db.query(REVERSE)
    await db.query(MIGRATION)
  })

  it('has the columns of DM-87 and the first result, with their types', async () => {
    const rows = await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `select column_name, data_type, is_nullable from information_schema.columns where table_name = 'game_reward_events' order by ordinal_position`,
    )
    expect(rows.map((r) => [r.column_name, r.data_type, r.is_nullable])).toEqual([
      ['id', 'bigint', 'NO'],
      ['game_session_id', 'uuid', 'NO'],
      ['user_id', 'bigint', 'NO'],
      ['xp', 'integer', 'NO'],
      ['syiling', 'integer', 'NO'],
      ['capped_reason', 'text', 'YES'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ])
  })

  it('is unique on (game_session_id, user_id): a second row of the pair is refused, another pupil or session is not', async () => {
    const [u, other] = [await addUser(), await addUser()]
    await db.query(insert, [SESSION_A, u, 1, 1, null])
    expect(await rejects(insert, [SESSION_A, u, 2, 2, null])).toMatch(/uq_game_reward_events_game_session_id_user_id/)
    await db.query(insert, [SESSION_A, other, 1, 1, null])
    await db.query(insert, [SESSION_B, u, 1, 1, null])
    expect(await db.query(`select 1 from game_reward_events`)).toHaveLength(3)
  })

  it('refuses a negative amount and an unknown reason; allows every known reason', async () => {
    const u = await addUser()
    expect(await rejects(insert, [SESSION_A, u, -1, 0, null])).toMatch(/ck_game_reward_events_amounts/)
    expect(await rejects(insert, [SESSION_A, u, 0, -1, null])).toMatch(/ck_game_reward_events_amounts/)
    expect(await rejects(insert, [SESSION_A, u, 0, 0, 'other'])).toMatch(/ck_game_reward_events_capped_reason/)
    for (const [i, reason] of ['xp_cap', 'syiling_cap', 'xp_and_syiling_cap'].entries()) {
      await db.query(insert, [`00000000-0000-4000-8000-00000000000${String(i)}`, u, 0, 0, reason])
    }
  })

  it('refuses an unknown user, and the rows go with their user', async () => {
    expect(await rejects(insert, [SESSION_A, '999999999', 0, 0, null])).toMatch(/fk_game_reward_events_user_id/)
    const u = await addUser()
    await db.query(insert, [SESSION_A, u, 0, 0, null])
    await db.query(`delete from users where id = $1::bigint`, [u])
    expect(await db.query(`select 1 from game_reward_events`)).toHaveLength(0)
  })

  it('has the index the daily caps read', async () => {
    const rows = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_game_reward_events_user_id_created_at'`)
    expect(rows[0]?.indexdef).toMatch(/\(user_id, created_at\)/)
  })

  it('the reversal in the comment removes the table, and the file applies again', async () => {
    await db.query(REVERSE)
    expect(await rejects('select 1 from game_reward_events')).toMatch(/game_reward_events/)
    await db.query(MIGRATION)
    expect(await db.query(`select 1 from game_reward_events`)).toHaveLength(0)
  })
})
