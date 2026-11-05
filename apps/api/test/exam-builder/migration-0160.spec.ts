import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S3-T02, migration 0160 (DM-11): paper_placements.question_id gets its foreign key; DM-26 is the read-only report of group integrity. */
const MIGRATION = fileURLToPath(new URL('../../prisma/migrations/0160_s3_placement_question_fk/migration.sql', import.meta.url))
const REPORT = fileURLToPath(new URL('../../scripts/uat-ops/paper-group-integrity.sql', import.meta.url))
const DROP = `ALTER TABLE paper_placements DROP CONSTRAINT fk_paper_placements_question_id`

describe('migration 0160 placement question FK', () => {
  let db: TestDatabase
  let section: string
  let question: string

  const place = (qid: string, position: number): Promise<unknown> =>
    db.query(`insert into paper_placements (paper_section_id, question_id, position) values ($1::bigint, $2::bigint, $3)`, [section, qid, position])
  const fk = async (): Promise<{ convalidated: boolean; def: string }[]> =>
    db.query(`select convalidated, pg_get_constraintdef(oid) def from pg_constraint where conname = 'fk_paper_placements_question_id'`)
  const newQuestion = async (): Promise<string> => (await db.query<{ id: string }>(`insert into questions (source_type) values ('manual') returning id::text`))[0]!.id

  beforeAll(async () => {
    db = await createTestDatabase()
    const subject = (await db.query<{ id: string }>(`insert into subjects (code, name, name_en, color) values ('UJI160', 'Subjek ujian', 'Test subject', '#4f46e5') returning id::text`))[0]!.id
    const paper = (await db.query<{ id: string }>(`insert into papers (kind, title, subject_id, kertas, printed_duration_min) values ('pilihan', 'Kertas ujian', ${subject}, 1, 60) returning id::text`))[0]!.id
    section = (await db.query<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values (${paper}, 1, 'A', 9, 9) returning id::text`))[0]!.id
    question = await newQuestion()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('is on the migrated schema, validated, ON DELETE RESTRICT: an orphan cannot be written and a placed question cannot be deleted', async () => {
    const [c] = await fk()
    expect(c).toMatchObject({ convalidated: true })
    expect(c!.def).toContain('REFERENCES questions(id) ON DELETE RESTRICT')
    await place(question, 1)
    await expect(place('987654321', 2)).rejects.toThrow(/fk_paper_placements_question_id/)
    await expect(db.query(`delete from questions where id = $1::bigint`, [question])).rejects.toThrow(/fk_paper_placements_question_id/)
  })

  it('re-running the file on rows that already exist adds and validates the key and keeps the rows', async () => {
    await db.query(DROP)
    const before = await db.query(`select id from paper_placements order by id`)
    await db.query(readFileSync(MIGRATION, 'utf8'))
    expect(await db.query(`select id from paper_placements order by id`)).toEqual(before)
    expect((await fk())[0]).toMatchObject({ convalidated: true })
  })

  it('an orphan stops VALIDATE: the migration fails, the transaction leaves no key, and the orphan is not deleted', async () => {
    await db.query(DROP)
    await place('987654321', 3)
    await expect(db.query(`BEGIN; ${readFileSync(MIGRATION, 'utf8')} COMMIT;`)).rejects.toThrow(/fk_paper_placements_question_id/)
    await db.query('ROLLBACK')
    expect(await fk()).toEqual([])
    expect(await db.query(`select question_id::text q from paper_placements where question_id = 987654321`)).toEqual([{ q: '987654321' }])
    // Once the orphan is dealt with by hand the migration goes through.
    await db.query(`delete from paper_placements where question_id = 987654321`)
    await db.query(readFileSync(MIGRATION, 'utf8'))
    expect((await fk())[0]).toMatchObject({ convalidated: true })
  })
})

describe('DM-26 paper-group-integrity.sql', () => {
  let db: TestDatabase
  let paper: string
  let groupOf: string
  const members: string[] = []
  let single: string

  /** The SELECTs of the report, psql lines removed, in file order. */
  const checks = (): string[] =>
    readFileSync(REPORT, 'utf8')
      .split('\n')
      .filter((l) => !l.startsWith('--') && !l.startsWith('\\echo') && !/^(BEGIN READ ONLY|ROLLBACK);/.test(l))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  const counts = async (): Promise<number[]> => {
    const out: number[] = []
    for (const sql of checks()) out.push((await db.query(sql)).length)
    return out
  }
  const section = async (position: number): Promise<string> =>
    (await db.query<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values (${paper}, ${String(position)}, 'B${String(position)}', 4, 4) returning id::text`))[0]!.id
  const place = (sid: string, qid: string, position: number): Promise<unknown> =>
    db.query(`insert into paper_placements (paper_section_id, question_id, position) values ($1::bigint, $2::bigint, $3)`, [sid, qid, position])

  beforeAll(async () => {
    db = await createTestDatabase()
    const subject = (await db.query<{ id: string }>(`insert into subjects (code, name, name_en, color) values ('UJI26', 'Subjek ujian', 'Test subject', '#4f46e5') returning id::text`))[0]!.id
    paper = (await db.query<{ id: string }>(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', 'Kertas ujian', ${subject}, 1, 60, 'published', now()) returning id::text`))[0]!.id
    groupOf = (await db.query<{ id: string }>(`insert into stimulus_groups (label) values ('Rajah ujian') returning id::text`))[0]!.id
    for (const position of [1, 2, 3]) {
      members.push((await db.query<{ id: string }>(`insert into questions (source_type, group_id, group_position) values ('manual', ${groupOf}, ${String(position)}) returning id::text`))[0]!.id)
    }
    single = (await db.query<{ id: string }>(`insert into questions (source_type) values ('manual') returning id::text`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  it('does not read stimulus_policy (PO decision item 7) and changes nothing', () => {
    const sql = readFileSync(REPORT, 'utf8').split('\n').filter((l) => !l.startsWith('--')).join('\n')
    expect(sql).not.toContain('stimulus_policy')
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|drop)\b/i)
    expect(checks()).toHaveLength(5)
  })

  it('a whole group, contiguous and in order, in a full section reports nothing', async () => {
    const s = await section(1)
    for (const [i, m] of members.entries()) await place(s, m, i + 1)
    await place(s, single, 4)
    expect(await counts()).toEqual([0, 0, 0, 0, 0])
    await db.query(`delete from paper_sections where id = $1::bigint`, [s])
  })

  it('names a group that is incomplete, split, not contiguous, out of order, and a wrong section count', async () => {
    const a = await section(2)
    // A member missing from the section; the count of 4 is not met.
    await place(a, members[0]!, 1)
    await place(a, members[1]!, 2)
    expect(await counts()).toEqual([1, 0, 0, 0, 1])
    // The third member in another section: split as well, and each part still short.
    const b = await section(3)
    await place(b, members[2]!, 1)
    expect((await counts())[1]).toBe(1)
    await db.query(`delete from paper_placements where paper_section_id in ($1::bigint, $2::bigint)`, [a, b])
    // Another question between two members, and the members in the wrong order.
    await place(a, members[2]!, 1)
    await place(a, single, 2)
    await place(a, members[0]!, 3)
    await place(a, members[1]!, 4)
    const out = await counts()
    expect(out[2]).toBe(1)
    expect(out[3]).toBe(1)
  })
})
