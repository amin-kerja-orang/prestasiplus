import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../../support/db'

/** S6-T14: 0203 rename order and idempotence (DM-73) and the 0201 backfill (DM-46). Both run again on data written after the migrations. */
const sql = (dir: string): string => readFileSync(fileURLToPath(new URL(`../../../prisma/migrations/${dir}/migration.sql`, import.meta.url)), 'utf8')
const M0203 = sql('0203_s6_classroom_unique_name')
const M0201 = sql('0201_s6_question_set_assignments')

describe('migrations 0201 and 0203 (S6-T14)', () => {
  let db: TestDatabase
  let level: string
  let teacher: string
  let other: string

  const user = async (name: string): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ($1) returning id::text`, [name]))[0]!.id
  const klass = async (name: string, teacherId: string, year = 2026): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `insert into classrooms (kind, name, teacher_id, education_level_id, academic_year) values ('classroom', $1, $2::bigint, $3::bigint, $4) returning id::text`,
        [name, teacherId, level, year],
      )
    )[0]!.id
  const nameOf = async (id: string): Promise<string> => (await db.query<{ name: string }>(`select name from classrooms where id = $1::bigint`, [id]))[0]!.name

  beforeAll(async () => {
    db = await createTestDatabase()
    level = (
      await db.query<{ id: string }>(
        `insert into education_levels (code, name, name_en, stage, curriculum, grade) values ('T4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'KSSM', 10) returning id::text`,
      )
    )[0]!.id
    teacher = await user('Guru Satu')
    other = await user('Guru Dua')
  })
  afterAll(async () => {
    await db.drop()
  })

  it('0203 renames case/space variants in id order, skips a taken suffix, leaves other scopes alone, and a second run changes nothing', async () => {
    await db.query(`drop index uq_classrooms_teacher_year_name`)
    const a = await klass('5 Bestari', teacher)
    const b = await klass('5 bestari', teacher)
    const taken = await klass('5 Bestari (2)', teacher)
    const c = await klass(' 5 BESTARI ', teacher)
    const otherYear = await klass('5 Bestari', teacher, 2025)
    const otherTeacher = await klass('5 bestari', other)
    await db.query(M0203)
    expect(await nameOf(a)).toBe('5 Bestari')
    expect(await nameOf(taken)).toBe('5 Bestari (2)')
    expect(await nameOf(b)).toBe('5 bestari (3)')
    expect(await nameOf(c)).toBe('5 BESTARI (4)')
    expect(await nameOf(otherYear)).toBe('5 Bestari')
    expect(await nameOf(otherTeacher)).toBe('5 bestari')
    const before = await db.query(`select id, name, updated_at from classrooms order by id`)
    await db.query(`drop index uq_classrooms_teacher_year_name`)
    await db.query(M0203)
    expect(await db.query(`select id, name, updated_at from classrooms order by id`)).toEqual(before)
    await expect(klass('5 BESTARI', teacher)).rejects.toThrow(/uq_classrooms_teacher_year_name/)
  })

  it('0201 backfill: one row per set with a classroom_id, assigned_by the teacher, and a second run adds nothing', async () => {
    const cls = await klass('Kelas Set', teacher)
    const set = (await db.query<{ id: string }>(`insert into question_sets (teacher_id, classroom_id, title, status) values ($1::bigint, $2::bigint, 'Set Lama', 'published') returning id::text`, [teacher, cls]))[0]!.id
    await db.query(`insert into question_sets (teacher_id, title, status) values ($1::bigint, 'Set Draf', 'draft')`, [teacher])
    await db.query(`delete from question_set_classrooms`)
    const backfill = M0201.slice(M0201.indexOf('INSERT INTO "question_set_classrooms"'), M0201.indexOf('ALTER TABLE "question_sets" DROP CONSTRAINT'))
    expect(backfill).toContain('ON CONFLICT')
    await db.query(backfill)
    await db.query(backfill)
    expect(await db.query(`select question_set_id::text as s, classroom_id::text as c, assigned_by::text as a from question_set_classrooms`)).toEqual([{ s: set, c: cls, a: teacher }])
  })

  it('0201 leaves no classroom-or-migrated check, so a draft set may have no class', async () => {
    expect(await db.query(`select 1 from pg_constraint where conname = 'ck_question_sets_classroom_or_migrated'`)).toHaveLength(0)
    expect(await db.query(`select 1 from pg_indexes where indexname = 'ix_practice_sessions_question_set_id_status'`)).toHaveLength(1)
  })
})
