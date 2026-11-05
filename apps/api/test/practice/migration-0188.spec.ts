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

  it('the migration has the two statements, the precondition and the reverse note', () => {
    expect(sql).toMatch(/VALIDATE CONSTRAINT "ck_practice_answers_mode"/)
    expect(sql).toMatch(/ALTER COLUMN "mode" SET NOT NULL/)
    expect(sql).toMatch(/Precondition:/)
    expect(sql).toMatch(/Reversible:.*DROP NOT NULL/s)
  })
})
