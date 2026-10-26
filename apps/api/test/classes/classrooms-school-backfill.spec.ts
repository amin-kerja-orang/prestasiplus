import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * SW7-01, migration 0090: a one-off backfill of `classrooms.school_id` for teacher classes created without a school.
 * The test database already ran every migration (on empty tables), so the file is executed again on seeded rows; the
 * statement is idempotent, which the second run proves.
 */
const MIGRATION_0090 = fileURLToPath(
  new URL('../../prisma/migrations/0090_classrooms_school_backfill/migration.sql', import.meta.url),
)

describe('migration 0090 classrooms school backfill', () => {
  let db: TestDatabase
  let schoolId: string
  let levelId: string
  let teacherWithSchool: string
  let teacherNoSchool: string

  const user = async (name: string, school: string | null): Promise<string> =>
    (await db.query<{ id: string }>(`insert into users (name, school_id) values ($1, $2::bigint) returning id::text`, [name, school]))[0]!.id
  const klass = async (name: string, kind: 'classroom' | 'school_class', teacherId: string | null, school: string | null): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `insert into classrooms (kind, name, teacher_id, school_id, education_level_id, academic_year)
         values ($1, $2, $3::bigint, $4::bigint, $5::bigint, 2026) returning id::text`,
        [kind, name, teacherId, school, levelId],
      )
    )[0]!.id
  const snapshot = async (): Promise<Record<string, { school: string | null; updatedAt: string }>> =>
    Object.fromEntries(
      (await db.query<{ name: string; school: string | null; updated_at: string }>(`select name, school_id::text as school, updated_at::text from classrooms`)).map((r) => [
        r.name,
        { school: r.school, updatedAt: r.updated_at },
      ]),
    )

  beforeAll(async () => {
    db = await createTestDatabase()
    schoolId = (await db.query<{ id: string }>(`insert into schools (name, code) values ('Sekolah Contoh', 'BF0090') returning id::text`))[0]!.id
    levelId = (
      await db.query<{ id: string }>(
        `insert into education_levels (code, name, name_en, stage, curriculum, grade) values ('T4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'KSSM', 10) returning id::text`,
      )
    )[0]!.id
    teacherWithSchool = await user('Guru Contoh Satu', schoolId)
    teacherNoSchool = await user('Guru Contoh Dua', null)
  })
  afterAll(async () => {
    await db.drop()
  })

  it('gives a teacher class without a school its teacher\'s school and leaves everything else alone', async () => {
    const otherSchool = (await db.query<{ id: string }>(`insert into schools (name, code) values ('Sekolah Lain', 'BF0091') returning id::text`))[0]!.id
    await klass('Kelas tanpa sekolah', 'classroom', teacherWithSchool, null)
    await klass('Kelas guru tanpa sekolah', 'classroom', teacherNoSchool, null)
    await klass('Kelas sekolah', 'school_class', teacherWithSchool, null)
    await klass('Kelas yatim', 'classroom', null, null)
    await klass('Kelas sudah bersekolah', 'classroom', teacherWithSchool, otherSchool)
    const before = await snapshot()
    expect(before['Kelas tanpa sekolah']!.school).toBeNull()

    await db.query(readFileSync(MIGRATION_0090, 'utf8'))
    const after = await snapshot()
    expect(after['Kelas tanpa sekolah']!.school).toBe(schoolId)
    expect(after['Kelas guru tanpa sekolah']!.school).toBeNull()
    expect(after['Kelas sekolah']!.school).toBeNull()
    expect(after['Kelas yatim']!.school).toBeNull()
    expect(after['Kelas sudah bersekolah']!.school).toBe(otherSchool)
    // no row but the backfilled one changes, and updated_at is not touched
    for (const name of Object.keys(before)) expect(after[name]!.updatedAt).toBe(before[name]!.updatedAt)

    // idempotent: a second run changes nothing
    await db.query(readFileSync(MIGRATION_0090, 'utf8'))
    expect(await snapshot()).toEqual(after)
  })
})
