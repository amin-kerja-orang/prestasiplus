import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'

import { runSeeds } from '../../../../prisma/seed'
import { identitySeed } from '../../../../prisma/seed/core/identity'
import { curriculumSeed } from '../../../../prisma/seed/curriculum'
import { classesSeed } from '../../../../prisma/seed/poc/classes'
import { defineAppModule } from '../../../../src/app.module'
import { configureApp } from '../../../../src/configure-app'
import { CLOCK, FixedClock } from '../../../../src/db/clock'
import { AuthModule } from '../../../../src/modules/auth'
import { ClassesModule } from '../../../../src/modules/classes'
import { PerformanceModule } from '../../../../src/modules/reports/performance'
import { type CurriculumTestApp, dropDatabase } from '../../../curriculum/helpers'
import { createTestDatabase, type TestDatabase } from '../../../support/db'

/** 2026-10-19 09:00 MYT: the clock of the headcount specs (academic year 2026). */
export const HC_START = '2026-10-19T09:00:00+08:00'

export interface HeadcountWorld extends CurriculumTestApp {
  /** Database ids (decimal strings) by e-mail. */
  ids: Record<string, string>
  /** DEMO001 class of `guru@demo.test` (join code DEMO4S): pelajar, pelajar2 and ujian1 to ujian3. */
  classId: string
  /** Second class of `guru@demo.test` (a different subject), for the create and auto-setup specs. */
  classId2: string
  /** Class of `guru2@demo.test` (same school, other teacher): ujian1 is also a member. */
  otherClassId: string
  subjectId: string
  subjectId2: string
  /** Education level id of Tingkatan 4 (code T4). */
  levelId: string
  /** Education level id of Tingkatan 5 (code T5). */
  levelId5: string
}

export const PUPILS = ['ujian1', 'ujian2', 'ujian3'].map((n) => `${n}@demo.test`)

async function addUser(db: TestDatabase, email: string, name: string, role: string, schoolCode: string, grade: number | null): Promise<void> {
  await db.query(
    `insert into users (name, email, school_id, grade, password_hash)
       select $1, $2, s.id, $3, (select password_hash from users where email = 'guru@demo.test') from schools s where s.code = $4`,
    [name, email, grade, schoolCode],
  )
  await db.query(`insert into user_roles (user_id, role) select id, $2 from users where email = $1`, [email, role])
}

async function idOf(db: TestDatabase, sql: string, params: unknown[] = []): Promise<string> {
  const rows = await db.query<{ id: string }>(sql, params)
  const row = rows[0]
  if (!row) throw new Error(`No row for: ${sql}`)
  return row.id
}

/**
 * The auth, classes and performance modules (the real classes adapter feeds `PerformancePorts`) on a private migrated
 * database with the identity, curriculum and classes seeds, plus fictitious accounts: pupils `ujian1..3` and `ujian9`
 * (a pupil of the OTHER school DEMO002), a second teacher `guru2`, a school admin of DEMO002 (`admin2`).
 */
export async function bootHeadcountWorld(env: Record<string, string> = {}): Promise<HeadcountWorld> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed, classesSeed], { prisma: db.prisma })
  for (const [i, email] of PUPILS.entries()) await addUser(db, email, `Murid Ujian ${i + 1}`, 'student', 'DEMO001', 10)
  await addUser(db, 'ujian9@demo.test', 'Murid Ujian Sembilan', 'student', 'DEMO002', 10)
  await addUser(db, 'guru2@demo.test', 'Guru Dua Ujian', 'teacher', 'DEMO001', null)
  await addUser(db, 'admin2@demo.test', 'Admin Sekolah Dua', 'school_admin', 'DEMO002', null)
  await addUser(db, 'ibubapa@demo.test', 'Ibu Bapa Ujian', 'parent', 'DEMO001', null)

  const rows = await db.query<{ id: string; email: string }>(`select id::text, email from users where email is not null`)
  const ids: Record<string, string> = Object.fromEntries(rows.map((r) => [r.email, r.id]))
  const classId = await idOf(db, `select id::text from classrooms where upper(join_code) = 'DEMO4S'`)
  const levelId = await idOf(db, `select id::text from education_levels where code = 'T4'`)
  const levelId5 = await idOf(db, `select id::text from education_levels where code = 'T5'`)
  // The subject of the demo class, and another active one.
  const subjectId = await idOf(db, `select subject_id::text as id from classrooms where id = $1`, [classId])
  const subjectId2 = await idOf(db, `select id::text from subjects where is_active and id <> $1 order by id limit 1`, [subjectId])

  const classroom = async (name: string, code: string, teacher: string, subject: string): Promise<string> =>
    idOf(
      db,
      `insert into classrooms (name, teacher_id, school_id, subject_id, education_level_id, academic_year, join_code)
         select $1, $2::bigint, s.id, $3::bigint, $4::bigint, 2026, $5 from schools s where s.code = 'DEMO001' returning id::text`,
      [name, teacher, subject, levelId, code],
    )
  const classId2 = await classroom('Kelas Contoh Dua', 'HCCLS2', ids['guru@demo.test'] as string, subjectId2)
  const otherClassId = await classroom('Kelas Guru Dua', 'HCCLS3', ids['guru2@demo.test'] as string, subjectId)
  const enrol = async (cls: string, email: string): Promise<void> => {
    await db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1, $2, 'active', 'teacher') on conflict do nothing`, [cls, ids[email]])
  }
  for (const email of PUPILS) await enrol(classId, email)
  await enrol(classId2, 'pelajar@demo.test')
  await enrol(otherClassId, PUPILS[0] as string)

  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    THROTTLE_PERFORMANCE_READ_PER_MINUTE: '100000',
    ...env,
  })
  const clock = new FixedClock(HC_START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, ClassesModule, PerformanceModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()

  return {
    app,
    db,
    clock,
    ids,
    classId,
    classId2,
    otherClassId,
    subjectId,
    subjectId2,
    levelId,
    levelId5,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await dropDatabase(db)
    },
  }
}

/** A config (SQL, no API) for a teacher and class; returns its id. */
export async function insertConfig(
  w: HeadcountWorld,
  o: { teacher: string; classroomId: string; subjectId?: string; levelId?: string; year?: number; mode?: 'auto' | 'manual'; otrs?: number },
): Promise<string> {
  return idOf(
    w.db,
    `insert into headcount_configs (teacher_id, classroom_id, subject_id, education_level_id, academic_year, active_otrs, mode)
       values ($1, $2, $3, $4, $5, $6, $7) returning id::text`,
    [w.ids[o.teacher], o.classroomId, o.subjectId ?? w.subjectId, o.levelId ?? w.levelId, o.year ?? 2026, o.otrs ?? 3, o.mode ?? 'auto'],
  )
}

/** An entry with marks `[target, actual]` per checkpoint (SQL, no API). */
export async function insertEntry(
  w: HeadcountWorld,
  configId: string,
  email: string,
  o: { tov?: number | null; etr?: number | null; rs?: number | null; dropped?: boolean; marks?: readonly (readonly [number | null, number | null])[] } = {},
): Promise<string> {
  const entry = await idOf(
    w.db,
    `insert into headcount_entries (config_id, student_id, tov, etr, rs, dropped) values ($1, $2, $3, $4, $5, $6) returning id::text`,
    [configId, w.ids[email], o.tov ?? null, o.etr ?? null, o.rs ?? null, o.dropped ?? false],
  )
  for (const [i, [target, actual]] of (o.marks ?? []).entries()) {
    await w.db.query(`insert into headcount_entry_marks (entry_id, checkpoint, target, actual) values ($1, $2, $3, $4)`, [entry, i + 1, target, actual])
  }
  return entry
}
