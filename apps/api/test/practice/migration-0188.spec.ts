import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { createTestDatabase, type TestDatabase } from '../support/db'

const sql = readFileSync(join(fileURLToPath(new URL('../../prisma/migrations/', import.meta.url)), '0188_s5_answer_store_validate/migration.sql'), 'utf8')

let db: TestDatabase
let uid: string

beforeAll(async () => {
  db = await createTestDatabase()
  await runSeeds([identitySeed], { prisma: db.prisma })
  uid = (await db.query<{ id: string }>('select id::text from users order by id limit 1'))[0]?.id as string
}, 120_000)

afterAll(async () => {
  await db.drop()
})

const insert = (mode: string | null) =>
  db.query(`insert into practice_answers (user_id, question_id, is_correct, answered_at, mode) values ($1, 1, true, now(), $2)`, [uid, mode])

describe('0188 practice_answers.mode validated and NOT NULL (DM-44)', () => {
  it('ck_practice_answers_mode is validated', async () => {
    const [c] = await db.query<{ validated: boolean }>(`select convalidated as validated from pg_constraint where conname = 'ck_practice_answers_mode'`)
    expect(c?.validated).toBe(true)
  })

  it('mode is NOT NULL', async () => {
    const [c] = await db.query<{ is_nullable: string }>(`select is_nullable from information_schema.columns where table_name = 'practice_answers' and column_name = 'mode'`)
    expect(c?.is_nullable).toBe('NO')
  })

  it('an insert with a NULL mode fails, a valid or an unknown mode behaves as before', async () => {
    await expect(insert(null)).rejects.toThrow(/null value in column "mode"/)
    await insert('latih_tubi')
    await expect(insert('bogus')).rejects.toThrow(/ck_practice_answers_mode/)
  })

  it('the migration backfills, validates, sets NOT NULL and has the reverse note', () => {
    expect(sql).toMatch(/UPDATE "practice_answers"[\s\S]*WHERE a\."mode" IS NULL/)
    expect(sql).toMatch(/VALIDATE CONSTRAINT "ck_practice_answers_mode"/)
    expect(sql).toMatch(/ALTER COLUMN "mode" SET NOT NULL/)
    expect(sql).not.toMatch(/RAISE EXCEPTION/)
    expect(sql).toMatch(/Reversible:.*DROP NOT NULL/s)
  })

  it('a re-run on a table with NULL modes backfills them itself (no manual U-OP-20): session mode as stored, else latih_tubi', async () => {
    await db.query('alter table practice_answers alter column mode drop not null')
    try {
      const [sess] = await db.query<{ id: string }>(
        `insert into practice_sessions (user_id, mode, question_count, started_at) values ($1, 'random', 1, now()) returning id::text`,
        [uid],
      )
      await db.query(`insert into practice_answers (user_id, question_id, is_correct, answered_at, mode, session_id) values ($1, 1, true, now(), null, $2::uuid)`, [uid, sess?.id])
      await db.query(`insert into practice_answers (user_id, question_id, is_correct, answered_at, mode) values ($1, 2, true, now(), null)`, [uid])
      await db.query(sql)
      const rows = await db.query<{ question_id: string; mode: string }>(
        `select question_id::text, mode from practice_answers where question_id in (1, 2) and user_id = $1 order by question_id, mode`,
        [uid],
      )
      expect(rows.filter((r) => r.question_id === '1').map((r) => r.mode)).toContain('random')
      expect(rows.filter((r) => r.question_id === '2').map((r) => r.mode)).toContain('latih_tubi')
      const [c] = await db.query<{ n: string }>('select count(*)::text as n from practice_answers where mode is null')
      expect(c?.n).toBe('0')
      const [col] = await db.query<{ is_nullable: string }>(`select is_nullable from information_schema.columns where table_name = 'practice_answers' and column_name = 'mode'`)
      expect(col?.is_nullable).toBe('NO')
    } finally {
      await db.query('alter table practice_answers alter column mode set not null')
    }
  })
})
