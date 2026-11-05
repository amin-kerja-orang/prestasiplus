import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { ANSWER_MODES } from '../../src/modules/practice/answer-log.port'
import { createTestDatabase, type TestDatabase } from '../support/db'

const DIR = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url))
const sql0181 = readFileSync(join(DIR, '0181_s5_answer_store_mode/migration.sql'), 'utf8')

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

const def = async (name: string) =>
  (await db.query<{ def: string; validated: boolean }>('select pg_get_constraintdef(oid) as def, convalidated as validated from pg_constraint where conname = $1', [name]))[0]
const quoted = (def: string): string[] => [...def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1] as string)

async function insertSession(mode: string, status = 'in_progress', completedAt: Date | null = null): Promise<string> {
  const id = randomUUID()
  await db.query(`insert into practice_sessions (id, user_id, mode, question_count, status, started_at, completed_at) values ($1, $2, $3, 1, $4, now(), $5)`, [id, uid, mode, status, completedAt])
  return id
}
const insertAnswer = (extra: Record<string, unknown> = {}) => {
  const cols = { user_id: uid, is_correct: true, answered_at: new Date(), ...extra }
  const keys = Object.keys(cols)
  return db.query(`insert into practice_answers (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(cols))
}

describe('0181 practice_answers', () => {
  it('ck_practice_answers_mode lists the 19 registry values and is NOT VALID', async () => {
    const c = await def('ck_practice_answers_mode')
    expect(c?.validated).toBe(false)
    expect(quoted(c?.def ?? '').sort()).toEqual([...ANSWER_MODES].sort())
    expect(ANSWER_MODES).toHaveLength(19)
    expect(c?.def).toMatch(/mode IS NULL/)
  })

  it('the unique index is partial and treats a null part_ref as an empty one', async () => {
    const [ix] = await db.query<{ def: string }>(`select indexdef as def from pg_indexes where indexname = 'uq_practice_answers_attempt_key'`)
    expect(ix?.def).toMatch(/UNIQUE INDEX/)
    expect(ix?.def).toMatch(/\(attempt_id, user_id, question_id, COALESCE\(part_ref, ''::text\)\)/)
    expect(ix?.def).toMatch(/WHERE \(attempt_id IS NOT NULL\)/)
    const a = randomUUID()
    await insertAnswer({ attempt_id: a, question_id: 1, mode: 'simulasi' })
    await expect(insertAnswer({ attempt_id: a, question_id: 1, mode: 'simulasi', part_ref: '' })).rejects.toThrow(/uq_practice_answers_attempt_key/)
    await insertAnswer({ attempt_id: a, question_id: 1, mode: 'simulasi', part_ref: '1.a' })
    await insertAnswer({ question_id: 1 }) // attempt_id null: outside the index
    await insertAnswer({ question_id: 1 })
  })

  it('the new columns exist with the right types and are nullable', async () => {
    const cols = await db.query<{ column_name: string; data_type: string; is_nullable: string; numeric_precision: number | null; numeric_scale: number | null }>(
      `select column_name, data_type, is_nullable, numeric_precision, numeric_scale from information_schema.columns
        where table_name = 'practice_answers' and column_name in ('mode', 'attempt_id', 'part_ref', 'marks_awarded', 'marks_max') order by column_name`,
    )
    expect(cols.map((c) => [c.column_name, c.data_type, c.is_nullable])).toEqual([
      ['attempt_id', 'uuid', 'YES'],
      ['marks_awarded', 'numeric', 'YES'],
      ['marks_max', 'numeric', 'YES'],
      ['mode', 'text', 'YES'],
      ['part_ref', 'text', 'YES'],
    ])
    expect(cols.filter((c) => c.column_name.startsWith('marks')).every((c) => c.numeric_precision === 6 && c.numeric_scale === 2)).toBe(true)
  })

  it('accepts a NULL mode and each registry value, rejects an unknown one', async () => {
    await insertAnswer({ question_id: 2 })
    for (const m of ANSWER_MODES) await insertAnswer({ question_id: 2, mode: m })
    await expect(insertAnswer({ question_id: 2, mode: 'bogus' })).rejects.toThrow(/ck_practice_answers_mode/)
  })

  it('0181 is DDL only: it has no UPDATE and leaves mode NULL on pre-existing rows', async () => {
    expect(sql0181).not.toMatch(/^\s*UPDATE\b/im)
    const chapter = await insertSession('chapter')
    await insertAnswer({ session_id: chapter, question_id: 10 })
    await insertAnswer({ question_id: 12 })
    const rows = await db.query<{ mode: string | null }>(`select mode from practice_answers where question_id in (10, 12)`)
    expect(rows.map((r) => r.mode)).toEqual([null, null])
  })
})

describe('0181 / 0182 practice_sessions', () => {
  it('mode check has 12 values: the old 10 plus databank and tracking_a', async () => {
    const c = await def('ck_practice_sessions_mode')
    expect(quoted(c?.def ?? '').sort()).toEqual(
      ['random', 'chapter', 'revision', 'past_year', 'latih_tubi', 'ramalan', 'mission', 'remedial', 'question_set', 'pksk', 'databank', 'tracking_a'].sort(),
    )
    await insertSession('databank')
    await insertSession('tracking_a')
    await expect(insertSession('kuiz')).rejects.toThrow(/ck_practice_sessions_mode/)
  })

  it('status check has in_progress, completed, abandoned', async () => {
    const c = await def('ck_practice_sessions_status')
    expect(quoted(c?.def ?? '').sort()).toEqual(['abandoned', 'completed', 'in_progress'])
    await expect(insertSession('chapter', 'deleted')).rejects.toThrow(/ck_practice_sessions_status/)
  })

  it('has the partial index the sweeper scans', async () => {
    const [ix] = await db.query<{ def: string }>(`select indexdef as def from pg_indexes where indexname = 'ix_practice_sessions_in_progress_started_at'`)
    expect(ix?.def).toMatch(/\(started_at\)/)
    expect(ix?.def).toMatch(/WHERE \(status = 'in_progress'::text\)/)
  })

  it('abandoned needs no completed_at: accepted without, rejected with (ck_practice_sessions_completed_at unchanged)', async () => {
    await insertSession('chapter', 'abandoned', null)
    await expect(insertSession('chapter', 'abandoned', new Date())).rejects.toThrow(/ck_practice_sessions_completed_at/)
    expect((await def('ck_practice_sessions_completed_at'))?.def).toMatch(/status = 'completed'::text\) = \(completed_at IS NOT NULL/)
  })
})
