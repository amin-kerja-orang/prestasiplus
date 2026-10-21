import 'reflect-metadata'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { PracticeAggregateService, type BijakAttemptAggregateInput } from '../../src/modules/practice/aggregate'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * BE-12 follow-up, migration 0018 (LEAD decision 4, 2026-10-20 16:00): `practice_attempt_aggregates.school_id`
 * is the student's school snapshot at write time, and the readers filter on it with `schoolId`.
 */
const MIGRATION_0018 = fileURLToPath(
  new URL('../../prisma/migrations/0018_aggregate_school_id/migration.sql', import.meta.url),
)
/** AZ-22: 0041 renames the 0018 index (its 66-character name was truncated by Postgres). */
const MIGRATION_0041 = fileURLToPath(
  new URL('../../prisma/migrations/0041_aggregate_school_index_name/migration.sql', import.meta.url),
)

let n = 0
const uuid = (): string => `00000000-0000-4000-8018-${String(++n).padStart(12, '0')}`

function input(userId: string, over: Partial<BijakAttemptAggregateInput> = {}): BijakAttemptAggregateInput {
  return {
    attemptId: uuid(),
    userId,
    isTest: false,
    paperId: '77',
    subject: 'MAT',
    kertas: 1,
    mode: 'exam',
    status: 'submitted',
    score: 5,
    max: 8,
    provisional: false,
    regraded: false,
    questions: [
      { questionId: 'q1', marks: 3, awarded: 3, attempted: true, counted: true },
      { questionId: 'q2', marks: 5, awarded: 2, attempted: true, counted: true },
    ],
    submittedAt: new Date('2026-10-20T03:00:00Z'),
    ...over,
  }
}

describe('PracticeAggregateService school_id snapshot (0018)', () => {
  let db: TestDatabase
  let prisma: PrismaService
  let svc: PracticeAggregateService
  let schoolA: string
  let schoolB: string

  const school = async (code: string): Promise<string> =>
    (await db.query<{ id: string }>(`insert into schools (name, code) values ($1, $2) returning id::text`, [`Sekolah ${code}`, code]))[0]!.id
  const user = async (schoolId: string | null): Promise<string> =>
    (await db.query<{ id: string }>(`insert into users (name, school_id) values ('Murid Contoh', $1) returning id::text`, [schoolId]))[0]!.id
  const schoolOf = async (attemptId: string): Promise<string | null> =>
    (await db.query<{ school_id: string | null }>(`select school_id::text from practice_attempt_aggregates where attempt_id = $1`, [attemptId]))[0]!.school_id

  beforeAll(async () => {
    db = await createTestDatabase()
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: db.url }) as never)
    svc = new PracticeAggregateService(prisma)
    schoolA = await school('AGG018A')
    schoolB = await school('AGG018B')
  })
  afterAll(async () => {
    await prisma.onModuleDestroy()
    await db.drop()
  })

  it('sets the snapshot on write; the read rows carry it', async () => {
    const s = await user(schoolA)
    const a = input(s)
    await svc.recordGraded(a)
    expect(await schoolOf(a.attemptId)).toBe(schoolA)
    const [row] = await svc.forStudents({ userIds: [s] })
    expect(row).toMatchObject({ attemptId: a.attemptId, schoolId: schoolA })
  })

  it('a later school move changes neither old rows nor a regrade of them; new rows take the new school', async () => {
    const s = await user(schoolA)
    const old = input(s)
    await svc.recordGraded(old)
    await db.query('update users set school_id = $1 where id = $2', [schoolB, s])
    await svc.recordGraded({ ...old, regraded: true, score: 7 })
    expect(await schoolOf(old.attemptId)).toBe(schoolA)
    const fresh = input(s)
    await svc.recordGraded(fresh)
    expect(await schoolOf(fresh.attemptId)).toBe(schoolB)
    expect((await svc.forStudents({ schoolId: schoolA, userIds: [s] })).map((r) => r.attemptId)).toEqual([old.attemptId])
    expect((await svc.forStudents({ schoolId: schoolB, userIds: [s] })).map((r) => r.attemptId)).toEqual([fresh.attemptId])
  })

  it('a student with no school writes NULL and is never in a school read', async () => {
    const s = await user(null)
    const a = input(s)
    await svc.recordGraded(a)
    expect(await schoolOf(a.attemptId)).toBeNull()
    expect((await svc.forStudents({ userIds: [s] }))[0]).toMatchObject({ schoolId: null })
    for (const sc of [schoolA, schoolB]) {
      expect((await svc.forStudents({ schoolId: sc })).map((r) => r.userId)).not.toContain(s)
    }
  })

  it('the schoolId filter returns only that school on every reader, and excludes test rows', async () => {
    const c = await school('AGG018C')
    const d = await school('AGG018D')
    const s1 = await user(c)
    const s2 = await user(c)
    const other = await user(d)
    const r1 = input(s1, { subject: 'SCH' })
    const r2 = input(s2, { subject: 'SCH', score: 8 })
    const t1 = input(s1, { subject: 'SCH', isTest: true })
    const o1 = input(other, { subject: 'SCH' })
    for (const x of [r1, r2, t1, o1]) await svc.recordGraded(x)
    expect(await schoolOf(t1.attemptId)).toBe(c) // stored and flagged, but never read

    expect((await svc.forStudents({ schoolId: c })).map((r) => r.attemptId).sort()).toEqual([r1.attemptId, r2.attemptId].sort())
    expect((await svc.forStudents({ schoolId: c, userIds: [s2, other] })).map((r) => r.attemptId)).toEqual([r2.attemptId])
    expect(await svc.forStudents({ schoolId: c, subjectCode: 'NONE' })).toEqual([])

    expect(await svc.subjectSummary({ schoolId: c })).toEqual(
      [
        { userId: s1, subjectCode: 'SCH', sittings: 1, unitsAwarded: 5, unitsMax: 8, percent: 62.5 },
        { userId: s2, subjectCode: 'SCH', sittings: 1, unitsAwarded: 8, unitsMax: 8, percent: 100 },
      ].sort((x, y) => (BigInt(x.userId) < BigInt(y.userId) ? -1 : 1)),
    )
    expect(await svc.itemStats({ schoolId: c, subjectCode: 'SCH' })).toEqual([
      { questionId: 'q1', sittings: 2, attempted: 2, awarded: 6, marks: 6, facilityPercent: 100 },
      { questionId: 'q2', sittings: 2, attempted: 2, awarded: 4, marks: 10, facilityPercent: 40 },
    ])
    expect((await svc.forStudents({ schoolId: d })).map((r) => r.attemptId)).toEqual([o1.attemptId])
    // ownHistory still includes the owner's own test row
    expect((await svc.ownHistory(s1)).map((r) => r.attemptId).sort()).toEqual([r1.attemptId, t1.attemptId].sort())
  })

  it('refuses a read with no scope and a bad schoolId; userIds-only reads still work', async () => {
    await expect(svc.forStudents({})).rejects.toBeInstanceOf(RangeError)
    await expect(svc.subjectSummary({})).rejects.toBeInstanceOf(RangeError)
    await expect(svc.itemStats({})).rejects.toBeInstanceOf(RangeError)
    for (const bad of ['', 'x', '-1', '1.5', '1; drop']) {
      await expect(svc.forStudents({ schoolId: bad })).rejects.toBeInstanceOf(RangeError)
      await expect(svc.subjectSummary({ schoolId: bad })).rejects.toBeInstanceOf(RangeError)
      await expect(svc.itemStats({ schoolId: bad })).rejects.toBeInstanceOf(RangeError)
    }
    await expect(svc.forStudents({ schoolId: 7 as never })).rejects.toBeInstanceOf(RangeError)
    expect(await svc.forStudents({ schoolId: schoolA, userIds: [] })).toEqual([])
    expect(await svc.forStudents({ schoolId: '999999999' })).toEqual([])
  })

  it('removing a school sets the snapshot to NULL and keeps the sitting', async () => {
    const e = await school('AGG018E')
    const s = await user(e)
    const a = input(s)
    await svc.recordGraded(a)
    await db.query('update users set school_id = null where id = $1', [s]) // users.school_id is RESTRICT
    await db.query('delete from schools where id = $1', [e])
    expect(await schoolOf(a.attemptId)).toBeNull()
    expect((await svc.forStudents({ userIds: [s] })).map((r) => r.attemptId)).toEqual([a.attemptId])
  })

  it('the migration backfills existing rows from the student current users.school_id and adds the partial index', async () => {
    const f = await school('AGG018F')
    const withSchool = await user(f)
    const noSchool = await user(null)
    const a = input(withSchool)
    const b = input(noSchool)
    const t = input(withSchool, { isTest: true })
    // Roll 0041 and 0018 back (0018's documented reverse, on the index's name since 0041), write rows as the
    // pre-0018 code did, then apply 0018 and 0041 again.
    await db.query('DROP INDEX "ix_practice_attempt_aggregates_school_subject_submitted"')
    await db.query('ALTER TABLE "practice_attempt_aggregates" DROP COLUMN "school_id"')
    for (const x of [a, b, t]) {
      await db.query(
        `insert into practice_attempt_aggregates (source, attempt_id, user_id, subject_code, kertas, mode, status, units_awarded, units_max, is_test)
         values ('bijak', $1, $2, 'MAT', 1, 'exam', 'submitted', 1, 2, $3)`,
        [x.attemptId, x.userId, x.isTest],
      )
    }
    await db.query(readFileSync(MIGRATION_0018, 'utf8'))
    await db.query(readFileSync(MIGRATION_0041, 'utf8'))
    expect(await schoolOf(a.attemptId)).toBe(f)
    expect(await schoolOf(b.attemptId)).toBeNull()
    expect(await schoolOf(t.attemptId)).toBe(f)
    const [idx] = await db.query<{ indexdef: string }>(
      `select indexdef from pg_indexes where indexname = 'ix_practice_attempt_aggregates_school_subject_submitted'`,
    )
    expect(idx!.indexdef).toMatch(/\(school_id, subject_code, submitted_at DESC\) WHERE \(NOT is_test\)/)
    const [fk] = await db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'fk_practice_attempt_aggregates_school_id'`,
    )
    expect(fk!.def).toMatch(/REFERENCES schools\(id\) ON UPDATE CASCADE ON DELETE SET NULL/)
    // the service still writes after the re-apply
    const later = input(withSchool)
    await svc.recordGraded(later)
    expect(await schoolOf(later.attemptId)).toBe(f)
  })
})
