import 'reflect-metadata'

import type { INestApplication, Type } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { CommandCenterModule } from '../../src/modules/command-center'
import { UsersModule } from '../../src/modules/users'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { expectError, loginAs, START, type LoggedIn } from '../auth/helpers'

export { DEMO_PASSWORD, START, expectError, schoolIdOf, userIdOf, type LoggedIn } from '../auth/helpers'

/** Demo accounts of the identity seed (password `Demo1234`). */
export const ADMIN = 'admin@demo.test'
export const SCHOOL_ADMIN = 'adminsekolah@demo.test' // DEMO001
export const TEACHER = 'guru@demo.test' // DEMO001
export const STUDENT = 'pelajar@demo.test' // DEMO001

export type CcRole = 'admin' | 'school_admin' | 'teacher' | 'student'
const EMAIL_OF: Record<CcRole, string> = { admin: ADMIN, school_admin: SCHOOL_ADMIN, teacher: TEACHER, student: STUDENT }

export interface CcTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  /** Feature modules to boot (default: auth, users and command-center). */
  modules?: Type<unknown>[]
  /** Replace a provider (e.g. a port) before the app compiles. */
  overrides?: { token: unknown; useValue: unknown }[]
}

/** Nest app with auth, users and the command-center module on a private migrated database (identity, schools and curriculum seeds), fixed clock `START`. */
export async function bootCommandCenterApp(opts: BootOptions = {}): Promise<CcTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, curriculumSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_PERFORMANCE_READ_PER_MINUTE: '100000',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  let builder = Test.createTestingModule({
    imports: [defineAppModule(opts.modules ?? [AuthModule, UsersModule, CommandCenterModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
  for (const o of opts.overrides ?? []) builder = builder.overrideProvider(o.token).useValue(o.useValue)
  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return {
    app,
    db,
    clock,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

type AuthLike = Parameters<typeof loginAs>[0]
export const login = (t: CcTestApp, identifier: string): Promise<LoggedIn> => loginAs(t as unknown as AuthLike, identifier)
export const loginRole = (t: CcTestApp, role: CcRole): Promise<LoggedIn> => login(t, EMAIL_OF[role])

export const getAs = (who: LoggedIn, path: string): Promise<Response> => who.agent.get(`/api${path}`)

// -------------------------------------------------------------------------------------------------------------------
// Fixtures (plain SQL, like the other modules' specs). Every id is a decimal string.
// -------------------------------------------------------------------------------------------------------------------

let seq = 0
const uniq = (): number => ++seq

export interface NewUser {
  name?: string
  role: 'student' | 'teacher' | 'school_admin' | 'admin'
  schoolId?: string | null
  isActive?: boolean
  /** Last login instant (for the daily board). */
  lastLoginAt?: Date | string | null
}

/** Inserts a user with one role. The password hash is copied from the demo admin, so `login(t, email)` works with `Demo1234`. */
export async function createUser(db: TestDatabase, u: NewUser): Promise<{ id: string; email: string }> {
  const n = uniq()
  const email = `cc${n}@fixture.test`
  const rows = await db.query<{ id: string }>(
    `insert into users (name, email, password_hash, is_active, school_id, last_login_at, created_at, updated_at)
     values ($1, $2, (select password_hash from users where email = $3), $4, $5::bigint, $6::timestamptz, now(), now()) returning id::text`,
    [u.name ?? `Pengguna ${n}`, email, ADMIN, u.isActive ?? true, u.schoolId ?? null, u.lastLoginAt ?? null],
  )
  const id = rows[0]?.id as string
  await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, $2, now())`, [id, u.role])
  return { id, email }
}

export interface NewClass {
  teacherId: string | null
  schoolId?: string | null
  name?: string
  kind?: 'classroom' | 'school_class'
  isActive?: boolean
  /** `education_levels.grade` (default 10 = Tingkatan 4). */
  grade?: number
}

export async function createClass(db: TestDatabase, c: NewClass): Promise<string> {
  const n = uniq()
  const rows = await db.query<{ id: string }>(
    `insert into classrooms (kind, name, teacher_id, school_id, education_level_id, academic_year, join_code, is_active)
     values ($1, $2, $3::bigint, $4::bigint, (select id from education_levels where grade = $5 order by id limit 1), 2026, $6, $7) returning id::text`,
    [c.kind ?? 'classroom', c.name ?? `Kelas ${n}`, c.teacherId, c.schoolId ?? null, c.grade ?? 10, `CC${String(n).padStart(6, '0')}`, c.isActive ?? true],
  )
  return rows[0]?.id as string
}

export async function enrol(db: TestDatabase, classId: string, studentId: string, o: { isTest?: boolean; status?: 'active' | 'removed'; joinedAt?: Date | string } = {}): Promise<void> {
  await db.query(
    `insert into enrolments (classroom_id, student_id, status, source, joined_at, is_test) values ($1::bigint, $2::bigint, $3, 'teacher', coalesce($4::timestamptz, now()), $5)`,
    [classId, studentId, o.status ?? 'active', o.joinedAt ?? null, o.isTest ?? false],
  )
}

export interface NewSession {
  userId: string
  completedAt: Date | string
  questionCount?: number
  correctCount?: number
  timeSpentSec?: number
  /** Subject code from the curriculum seed (e.g. `BM`); omit for free practice. */
  subjectCode?: string
  isTest?: boolean
  status?: 'completed' | 'in_progress'
  missionId?: string
}

export async function createSession(db: TestDatabase, s: NewSession): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, subject_id, question_count, status, correct_count, time_spent_sec, started_at, completed_at, is_test)
     values ($1::bigint, 'random', (select id from subjects where code = $2), $3, $4, $5, $6, $7::timestamptz - interval '10 minutes', case when $4 = 'completed' then $7::timestamptz end, $8) returning id::text`,
    [s.userId, s.subjectCode ?? null, s.questionCount ?? 10, s.status ?? 'completed', s.correctCount ?? 7, s.timeSpentSec ?? 600, s.completedAt, s.isTest ?? false],
  )
  return rows[0]?.id as string
}

export interface NewAnswers {
  userId: string
  at: Date | string
  count?: number
  correct?: number
  subjectCode?: string
  sessionId?: string | null
  isTest?: boolean
}

/** Inserts `count` answers at `at` (one second apart), the first `correct` of them correct. The table requires a subject or a question, so the subject defaults to `BM`. */
export async function createAnswers(db: TestDatabase, a: NewAnswers): Promise<void> {
  const count = a.count ?? 1
  await db.query(
    `insert into practice_answers (user_id, session_id, subject_id, is_correct, answered_at, is_test)
     select $1::bigint, $2::uuid, (select id from subjects where code = $3), g <= $4, $5::timestamptz + (g || ' seconds')::interval, $6
       from generate_series(1, $7::int) g`,
    [a.userId, a.sessionId ?? null, a.subjectCode ?? 'BM', a.correct ?? count, a.at, a.isTest ?? false, count],
  )
}

export interface World {
  school1: string
  school2: string
  adminId: string
  schoolAdminId: string
  teacherId: string
  /** A teacher of school 2 who owns a class there. */
  teacher2Id: string
  /** Class of `teacherId` at school 1 (Tingkatan 4). */
  class1: string
  /** Class of `teacherId` at school 1, INACTIVE. */
  classInactive: string
  /** Class of `teacher2Id` at school 2. */
  class2: string
  /** Active pupils of school 1 in class1 (each with answers). */
  pupils: string[]
  /** A pupil of school 1 in no class. */
  loosePupil: string
  /** A pupil of school 2 in class2. */
  otherPupil: string
  /** A pupil whose enrolment and answers are all `is_test` (Mod Pelajar); must never be counted. */
  testPupil: string
}

/**
 * A small deterministic world on top of the seeds, relative to the fixed clock `START` (2026-10-19 09:00 +08:00, a Monday):
 * 3 pupils in class1 with 10 answers each today, 2 yesterday; a loose pupil with 4 answers last week; a pupil at school 2 with
 * 6 answers today; an is_test pupil with 50 answers and an is_test enrolment. Sessions: one completed session for pupil 1.
 */
export async function buildWorld(t: CcTestApp): Promise<World> {
  const { db } = t
  const ids = await db.query<{ id: string; code: string }>(`select id::text, code from schools where code in ('DEMO001','DEMO002')`)
  const school1 = ids.find((r) => r.code === 'DEMO001')?.id as string
  const school2 = ids.find((r) => r.code === 'DEMO002')?.id as string
  const idOf = async (email: string): Promise<string> => (await db.query<{ id: string }>(`select id::text from users where email = $1`, [email]))[0]?.id as string
  const adminId = await idOf(ADMIN)
  const schoolAdminId = await idOf(SCHOOL_ADMIN)
  const teacherId = await idOf(TEACHER)
  const teacher2 = await createUser(db, { role: 'teacher', schoolId: school2, name: 'Guru Dua' })
  const class1 = await createClass(db, { teacherId, schoolId: school1, name: 'Kelas Satu', grade: 10 })
  const classInactive = await createClass(db, { teacherId, schoolId: school1, name: 'Kelas Lama', grade: 10, isActive: false })
  const class2 = await createClass(db, { teacherId: teacher2.id, schoolId: school2, name: 'Kelas Dua', grade: 7 })
  const today = '2026-10-19T08:00:00+08:00'
  const yesterday = '2026-10-18T10:00:00+08:00'
  const pupils: string[] = []
  for (let i = 1; i <= 3; i++) {
    const p = await createUser(db, { role: 'student', schoolId: school1, name: `Murid ${i}` })
    pupils.push(p.id)
    await enrol(db, class1, p.id)
    await createAnswers(db, { userId: p.id, at: today, count: 10, correct: 7 + (i % 2), subjectCode: 'BM' })
    await createAnswers(db, { userId: p.id, at: yesterday, count: 2, correct: 1, subjectCode: 'MATH' })
  }
  const loose = await createUser(db, { role: 'student', schoolId: school1, name: 'Murid Lepas' })
  await createAnswers(db, { userId: loose.id, at: '2026-10-13T10:00:00+08:00', count: 4, correct: 2 })
  const other = await createUser(db, { role: 'student', schoolId: school2, name: 'Murid Sekolah Dua' })
  await enrol(db, class2, other.id)
  await createAnswers(db, { userId: other.id, at: today, count: 6, correct: 3, subjectCode: 'BM' })
  const test = await createUser(db, { role: 'student', schoolId: school1, name: 'Murid Ujian' })
  await enrol(db, class1, test.id, { isTest: true })
  await createAnswers(db, { userId: test.id, at: today, count: 50, correct: 50, subjectCode: 'BM', isTest: true })
  await createSession(db, { userId: pupils[0] as string, completedAt: today, subjectCode: 'BM' })
  return { school1, school2, adminId, schoolAdminId, teacherId, teacher2Id: teacher2.id, class1, classInactive, class2, pupils, loosePupil: loose.id, otherPupil: other.id, testPupil: test.id }
}

// -------------------------------------------------------------------------------------------------------------------
// Route table and role matrix
// -------------------------------------------------------------------------------------------------------------------

export interface CcRoute {
  /** Path with example ids; relative to `/api`. */
  path: string
  /** Roles that pass the guard (the others get 403). */
  allowed: CcRole[]
  group: 'board' | 'drill' | 'guru'
}

const ATS: CcRole[] = ['admin', 'teacher', 'school_admin']

/** The 18 routes of BE-22 with the roles of the merged contract. */
export const CC_ROUTES: CcRoute[] = [
  { path: '/admin/command-center/live-data', allowed: ['admin', 'school_admin'], group: 'board' },
  { path: '/command-center/daily-activity', allowed: ['admin', 'school_admin'], group: 'board' },
  { path: '/command-center/daily-activity/school/1', allowed: ['admin'], group: 'board' },
  { path: '/admin/server-status', allowed: ['admin'], group: 'board' },
  { path: '/command-center/school/1', allowed: ATS, group: 'drill' },
  { path: '/command-center/school/1/teacher/1', allowed: ATS, group: 'drill' },
  { path: '/command-center/classroom/1', allowed: ATS, group: 'drill' },
  { path: '/command-center/headcount/1', allowed: ATS, group: 'drill' },
  { path: '/command-center/student/1', allowed: ATS, group: 'drill' },
  { path: '/command-center/student/1/subject', allowed: ATS, group: 'drill' },
  { path: '/command-center/student/1/week?start=2026-10-12&end=2026-10-18', allowed: ATS, group: 'drill' },
  { path: '/command-center/session/00000000-0000-4000-8000-000000000000', allowed: ATS, group: 'drill' },
  { path: '/guru/command-center/live-data', allowed: ['teacher', 'admin'], group: 'guru' },
  { path: '/guru/command-center/drill?type=students', allowed: ['teacher', 'admin'], group: 'guru' },
  { path: '/guru/command-center/evaluate', allowed: ['teacher', 'admin'], group: 'guru' },
  { path: '/guru/command-center/predictive', allowed: ['teacher', 'admin'], group: 'guru' },
  { path: '/guru/command-center/achievements', allowed: ['teacher', 'admin'], group: 'guru' },
  { path: '/guru/command-center/badge-holders?badgeId=1', allowed: ['teacher', 'admin'], group: 'guru' },
]

/**
 * Asserts the guard of one route: no session gives 401 UNAUTHORIZED, every role not in `allowed` gives 403 FORBIDDEN.
 * (The allowed roles are not exercised here: their answers are the route's own tests.)
 */
export async function expectGuards(t: CcTestApp, route: Pick<CcRoute, 'path' | 'allowed'>, sessions: Partial<Record<CcRole, LoggedIn>>): Promise<void> {
  const anon = await t.http().get(`/api${route.path}`)
  expectError(anon, 'UNAUTHORIZED', 'Unauthenticated.')
  for (const role of ['admin', 'school_admin', 'teacher', 'student'] as CcRole[]) {
    if (route.allowed.includes(role)) continue
    const who = sessions[role]
    if (!who) throw new Error(`no session for ${role}`)
    expectError(await getAs(who, route.path), 'FORBIDDEN', 'This action is unauthorized.')
  }
}
