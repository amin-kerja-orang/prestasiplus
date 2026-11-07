import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S3-T05, migration 0162 (DM-24, INV-26): a question sits in one Tracking A set per subject and year. The test database already ran
 * every migration on empty tables and the helper cannot stop part way, so each test rewinds the table to its pre-0162 shape (only
 * 0025 and 0162 touch it), inserts rows and runs the real file on them.
 */
const MIGRATION = fileURLToPath(new URL('../../prisma/migrations/0162_s3_tracking_sibling_unique/migration.sql', import.meta.url))
const REPORT = fileURLToPath(new URL('../../scripts/uat-ops/tracking-sibling-duplicates.sql', import.meta.url))
const INDEX = 'uq_spm_tracking_set_questions_subject_id_year_question_id'

interface Duplicate {
  subject_id: string
  year: number
  question_id: string
  keep_in_set_no: number
  remove_from_set_nos: number[]
}

describe('migration 0162 Tracking A sibling unique', () => {
  let db: TestDatabase
  let subjectA: string
  let subjectB: string
  let q1: string
  let q2: string
  let q3: string

  const question = async (): Promise<string> =>
    (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no) values ('manual', 1) returning id::text`))[0]!.id
  const subject = async (code: string): Promise<string> =>
    (await db.query<{ id: string }>(`insert into subjects (code, name, name_en, color) values ($1, $1, $1, '#000000') returning id::text`, [code]))[0]!.id

  /** A set with its member rows as they were written before 0162: no subject or year on the member. */
  const set = async (subjectId: string, year: number, setNo: number, questionIds: readonly string[]): Promise<string> => {
    const id = (await db.query<{ id: string }>(`insert into spm_tracking_sets (subject_id, year, set_no) values ($1::bigint, $2, $3) returning id::text`, [subjectId, year, setNo]))[0]!.id
    for (const [i, q] of questionIds.entries()) {
      await db.query(`insert into spm_tracking_set_questions (set_id, question_id, position) values ($1::bigint, $2::bigint, $3)`, [id, q, i + 1])
    }
    return id
  }
  const members = async (): Promise<{ set_id: string; question_id: string; position: number; subject_id: string | null; year: number | null }[]> =>
    db.query(`select set_id::text, question_id::text, position, subject_id::text, year from spm_tracking_set_questions order by set_id, position`)
  const baseRows = async (): Promise<{ set_id: string; question_id: string; position: number }[]> =>
    db.query(`select set_id::text, question_id::text, position from spm_tracking_set_questions order by set_id, position`)
  const columns = async (): Promise<string[]> =>
    (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'spm_tracking_set_questions' order by ordinal_position`)).map((r) => r.column_name)
  const hasIndex = async (): Promise<boolean> => (await db.query(`select 1 from pg_indexes where tablename = 'spm_tracking_set_questions' and indexname = $1`, [INDEX])).length === 1
  const migrate = async (): Promise<void> => {
    await db.query(readFileSync(MIGRATION, 'utf8'))
  }

  /** Runs the real report file, as psql would: `\echo` is a psql command, the rest is sent as it stands (BEGIN READ ONLY to ROLLBACK). */
  const report = async (): Promise<Duplicate[]> => {
    const sql = readFileSync(REPORT, 'utf8').replace(/^\\echo.*$/gm, '')
    const client = new pg.Client({ connectionString: db.url })
    await client.connect()
    try {
      const results = (await client.query(sql)) as unknown as pg.QueryResult<Duplicate>[]
      return results.find((r) => r.command === 'SELECT')!.rows
    } finally {
      await client.end()
    }
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    subjectA = await subject('M0162A')
    subjectB = await subject('M0162B')
    q1 = await question()
    q2 = await question()
    q3 = await question()
  })
  beforeEach(async () => {
    await db.query(`delete from spm_tracking_sets`)
    await db.query(`DROP INDEX IF EXISTS "${INDEX}"; ALTER TABLE spm_tracking_set_questions DROP COLUMN IF EXISTS subject_id, DROP COLUMN IF EXISTS year`)
    expect(await columns()).toEqual(['set_id', 'question_id', 'position'])
    expect(await hasIndex()).toBe(false)
  })
  afterAll(async () => {
    await db.drop()
  })

  it('gives every existing row the subject and year of its parent, and allows one question in another year or subject', async () => {
    const a2023 = await set(subjectA, 2023, 1, [q1, q2])
    const a2024 = await set(subjectA, 2024, 1, [q1])
    const b2023 = await set(subjectB, 2023, 1, [q1, q3])
    expect(await report()).toEqual([])

    await migrate()

    expect(await columns()).toEqual(['set_id', 'question_id', 'position', 'subject_id', 'year'])
    expect(await hasIndex()).toBe(true)
    expect(await members()).toEqual([
      { set_id: a2023, question_id: q1, position: 1, subject_id: subjectA, year: 2023 },
      { set_id: a2023, question_id: q2, position: 2, subject_id: subjectA, year: 2023 },
      { set_id: a2024, question_id: q1, position: 1, subject_id: subjectA, year: 2024 },
      { set_id: b2023, question_id: q1, position: 1, subject_id: subjectB, year: 2023 },
      { set_id: b2023, question_id: q3, position: 2, subject_id: subjectB, year: 2023 },
    ])
  })

  it('a sibling duplicate is listed by the report and stops the migration at CREATE UNIQUE INDEX, leaving nothing behind', async () => {
    await set(subjectA, 2023, 1, [q1, q2])
    const later = await set(subjectA, 2023, 2, [q3, q1])
    // The same question elsewhere is no duplicate, so neither of these may be listed.
    await set(subjectA, 2024, 1, [q1])
    await set(subjectB, 2023, 1, [q1])
    const before = await baseRows()

    expect(await report()).toEqual([{ subject_id: subjectA, year: 2023, question_id: q1, keep_in_set_no: 1, remove_from_set_nos: [2] }])

    await expect(migrate()).rejects.toMatchObject({ code: '23505', constraint: INDEX, message: expect.stringContaining('could not create unique index') })

    // The file is one implicit transaction: the columns and the backfill went with the failed index.
    expect(await columns()).toEqual(['set_id', 'question_id', 'position'])
    expect(await hasIndex()).toBe(false)
    expect(await baseRows()).toEqual(before)

    // The remedy the report names: take it out of the later sibling, then the report is empty and the migration runs.
    await db.query(`delete from spm_tracking_set_questions where set_id = $1::bigint and question_id = $2::bigint`, [later, q1])
    expect(await report()).toEqual([])
    await migrate()
    expect(await hasIndex()).toBe(true)
  })

  it('after the migration a duplicate in a sibling is refused, and the same question in another year or subject is not', async () => {
    const first = await set(subjectA, 2023, 1, [q1])
    const sibling = await set(subjectA, 2023, 2, [q2])
    const otherYear = await set(subjectA, 2024, 1, [])
    const otherSubject = await set(subjectB, 2023, 1, [])
    await migrate()

    const insert = (setId: string, questionId: string, position: number, subjectId: string, year: number): Promise<unknown> =>
      db.query(`insert into spm_tracking_set_questions (set_id, question_id, position, subject_id, year) values ($1::bigint, $2::bigint, $3, $4::bigint, $5)`, [setId, questionId, position, subjectId, year])

    await expect(insert(sibling, q1, 2, subjectA, 2023)).rejects.toMatchObject({ code: '23505', constraint: INDEX })
    await insert(otherYear, q1, 1, subjectA, 2024)
    await insert(otherSubject, q1, 1, subjectB, 2023)
    await insert(sibling, q3, 2, subjectA, 2023)

    expect((await members()).filter((m) => m.question_id === q1).map((m) => m.set_id).sort()).toEqual([first, otherYear, otherSubject].sort())
  })
})
