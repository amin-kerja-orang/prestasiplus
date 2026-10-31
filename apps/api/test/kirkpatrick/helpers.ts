import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { ClassesModule } from '../../src/modules/classes'
import { KirkpatrickModule } from '../../src/modules/reports/kirkpatrick'
import { type LoggedIn, loginAs, START } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import type { INestApplication } from '@nestjs/common'
import type { Writable } from 'node:stream'

export { START, type LoggedIn } from '../auth/helpers'

export interface KirkpatrickTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  logStream?: Writable
  /** The fixed clock's start; the default is `START` (2026-10-19 09:00 +08:00). */
  start?: string
}

/** Nest app with auth, classes and Kirkpatrick on a private migrated and seeded database. */
export async function bootKirkpatrickApp(opts: BootOptions = {}): Promise<KirkpatrickTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, populationSeed, curriculumSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_KIRKPATRICK_READ_PER_MINUTE: '100000',
    THROTTLE_KIRKPATRICK_WRITE_PER_MINUTE: '100000',
    THROTTLE_CLASSES_READ_PER_MINUTE: '100000',
    THROTTLE_CLASSES_WRITE_PER_MINUTE: '100000',
    PUBLIC_BASE_URL: 'https://app.example.test',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    LOG_LEVEL: process.env.PP_TEST_LOG_LEVEL ?? process.env.LOG_LEVEL,
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(opts.start ?? START)
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, ClassesModule, KirkpatrickModule], opts.logStream ? { logStream: opts.logStream } : {})],
  })
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
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export const TEACHER_A = 'guru@demo.test' // DEMO001
export const TEACHER_B = 'guru.demo001.01@example.test' // DEMO001, teaches the class of pelajarmaju
export const TEACHER_C = 'guru.demo002.01@example.test' // DEMO002, teaches the class of the DEMO002 pupil
export const STUDENT_1 = 'pelajar@demo.test' // DEMO001, grade 10
export const STUDENT_2 = 'pelajar2@demo.test' // DEMO001, grade 10, no practice
export const STUDENT_MAJU = 'pelajarmaju@demo.test' // DEMO001, grade 11
export const STUDENT_SUSPENDED = 'digantung@demo.test' // DEMO001, grade 10
export const STUDENT_B = 'murid.demo002.01@example.test' // DEMO002, grade 10
export const SCHOOL_ADMIN_A = 'adminsekolah@demo.test' // DEMO001
export const SCHOOL_ADMIN_B = 'adminsekolah.demo002@example.test' // DEMO002
export const ADMIN = 'admin@demo.test'

export interface Api {
  get(path: string): Promise<Response>
  post(path: string, body?: object): Promise<Response>
}

export function apiOf(who: LoggedIn): Api {
  return {
    get: (path) => who.agent.get(`/api${path}`),
    post: (path, body = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body),
  }
}

export type Client = Api & { who: LoggedIn }

export async function client(t: KirkpatrickTestApp, identifier: string): Promise<Client> {
  const who = await loginAs(t as never, identifier)
  return { ...apiOf(who), who }
}

export const idOfEmail = async (t: KirkpatrickTestApp, email: string): Promise<string> =>
  (await t.db.query<{ id: string }>(`select id::text from users where lower(email) = lower($1)`, [email]))[0]?.id as string

export const schoolOfCode = async (t: KirkpatrickTestApp, code: string): Promise<string> =>
  (await t.db.query<{ id: string }>(`select id::text from schools where code = $1`, [code]))[0]?.id as string

/** Asserts a contract error with the exact status and code (and message when given). */
export function errorIs(res: Response, status: number, code: string, message?: string): void {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  expect(parsed.error.code).toBe(code)
  if (message !== undefined) expect(parsed.error.message).toBe(message)
}

export function fieldsOf(res: Response): Record<string, string> {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  expect(parsed.error.code).toBe('VALIDATION_ERROR')
  return parsed.error.fields ?? {}
}

export interface SessionInput {
  userId: string
  subjectId: string
  /** MYT instant of completion and of every answer, e.g. `2026-10-05T10:00:00+08:00`. */
  at: string
  answered: number
  correct: number
  isTest?: boolean
  status?: 'completed' | 'in_progress'
}

/** One practice session and its answer log, written straight into the tables (the practice module is not under test). */
export async function addSession(t: KirkpatrickTestApp, s: SessionInput): Promise<string> {
  const status = s.status ?? 'completed'
  const rows = await t.db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, subject_id, question_count, status, correct_count, started_at, completed_at, is_test)
     values ($1, 'random', $2, $3, $4, $5, $6::timestamptz, case when $4 = 'completed' then $6::timestamptz else null end, $7)
     returning id::text`,
    [s.userId, s.subjectId, s.answered, status, s.correct, s.at, s.isTest ?? false],
  )
  const id = (rows[0] as { id: string }).id
  await t.db.query(
    `insert into practice_answers (session_id, user_id, subject_id, is_correct, answered_at, is_test)
     select $1::uuid, $2, $3, g <= $4, $5::timestamptz, $6 from generate_series(1, $7) g`,
    [id, s.userId, s.subjectId, s.correct, s.at, s.isTest ?? false, s.answered],
  )
  return id
}

export interface World {
  schoolA: string
  schoolB: string
  subjects: [string, string]
  ids: Record<'p1' | 'p2' | 'maju' | 'susp' | 'pb' | 'teacherA' | 'teacherB' | 'teacherC', string>
}

/**
 * The shared fixture (school A = DEMO001 "SMK Demo Satu", school B = DEMO002 "SK Demo Dua"). T4/T5 pupils:
 * A has pelajar, pelajar2, pelajarmaju and digantung (4), B has one (1). Practice (clock 2026-10-19):
 *   pelajar   2026-09-10 subject 1: 8 answered 6 correct;  2026-10-05 subject 2: 10 answered 5 correct
 *   maju      2026-10-10 subject 1: 50 answered 40 correct
 *   pupil B   2026-10-12 subject 1: 5 answered 5 correct
 * plus rows that must not count: a test session (20 answers) and an in-progress session of pelajar.
 * School A totals: 3 sessions, 68 answered, 51 correct (75.0%), 2 active. Platform: 73 answered, 56 correct (76.7%).
 * Teacher A teaches a class with pelajar and pelajar2 (not maju); teacher B (same school) teaches maju; teacher C teaches pupil B.
 */
export async function buildWorld(t: KirkpatrickTestApp): Promise<World> {
  const q = t.db.query.bind(t.db)
  const schoolA = await schoolOfCode(t, 'DEMO001')
  const schoolB = await schoolOfCode(t, 'DEMO002')
  // Only the named pupils are T4/T5; every generated pupil is moved out of the segment.
  await q(`update users set grade = 8 where grade in (10, 11) and email like 'murid.demo001.%'`)
  await q(`update users set grade = 10 where email = $1`, [STUDENT_B])
  await q(`update users set last_login_at = $1::timestamptz where email in ($2, $3)`, ['2026-10-18T08:00:00+08:00', STUDENT_1, TEACHER_A])
  const subjects = (await q<{ id: string }>(`select id::text from subjects order by id limit 2`)).map((r) => r.id) as [string, string]
  const ids = {
    p1: await idOfEmail(t, STUDENT_1),
    p2: await idOfEmail(t, STUDENT_2),
    maju: await idOfEmail(t, STUDENT_MAJU),
    susp: await idOfEmail(t, STUDENT_SUSPENDED),
    pb: await idOfEmail(t, STUDENT_B),
    teacherA: await idOfEmail(t, TEACHER_A),
    teacherB: await idOfEmail(t, TEACHER_B),
    teacherC: await idOfEmail(t, TEACHER_C),
  }
  await addSession(t, { userId: ids.p1, subjectId: subjects[0], at: '2026-09-10T10:00:00+08:00', answered: 8, correct: 6 })
  await addSession(t, { userId: ids.p1, subjectId: subjects[1], at: '2026-10-05T10:00:00+08:00', answered: 10, correct: 5 })
  await addSession(t, { userId: ids.maju, subjectId: subjects[0], at: '2026-10-10T10:00:00+08:00', answered: 50, correct: 40 })
  await addSession(t, { userId: ids.pb, subjectId: subjects[0], at: '2026-10-12T10:00:00+08:00', answered: 5, correct: 5 })
  await addSession(t, { userId: ids.p1, subjectId: subjects[0], at: '2026-10-18T10:00:00+08:00', answered: 20, correct: 20, isTest: true })
  await addSession(t, { userId: ids.p1, subjectId: subjects[0], at: '2026-10-18T11:00:00+08:00', answered: 4, correct: 4, status: 'in_progress' })

  const level = (await q<{ id: string }>(`select id::text from education_levels where stage <> 'primary' order by id limit 1`))[0] as { id: string }
  const cls = await q<{ id: string }>(
    `insert into classrooms (name, teacher_id, school_id, education_level_id, academic_year) values ('Kelas Kirkpatrick', $1, $2, $3, 2026) returning id::text`,
    [ids.teacherA, schoolA, level.id],
  )
  for (const student of [ids.p1, ids.p2]) {
    await q(`insert into enrolments (classroom_id, student_id) values ($1, $2)`, [(cls[0] as { id: string }).id, student])
  }
  // Teacher B (same school) teaches maju; teacher C (school B) teaches the school B pupil.
  for (const [teacher, school, student] of [
    [ids.teacherB, schoolA, ids.maju],
    [ids.teacherC, schoolB, ids.pb],
  ] as const) {
    const other = await q<{ id: string }>(
      `insert into classrooms (name, teacher_id, school_id, education_level_id, academic_year) values ('Kelas Lain', $1, $2, $3, 2026) returning id::text`,
      [teacher, school, level.id],
    )
    await q(`insert into enrolments (classroom_id, student_id) values ($1, $2)`, [(other[0] as { id: string }).id, student])
  }
  return { schoolA, schoolB, subjects, ids }
}
