import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { CIKGU_RUBRICS } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { CIKGU_AI, CikguModule, type CikguAiPort } from '../../src/modules/cikgu'
import { loginAs, START, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { START, type LoggedIn } from '../auth/helpers'

export interface CikguTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  /** Extra seeds after identity, schools, population and curriculum. */
  seeds?: SeedModule[]
  /** Replaces the AI provider (a test double); the controllers and the service do not change. */
  ai?: CikguAiPort
  /** Where JSON log lines go (default stdout). */
  logStream?: NodeJS.WritableStream
}

/** Nest app with auth and Cikgu Alesa (classes, curriculum, practice and users come with it) on a private migrated and seeded database. */
export async function bootCikguApp(opts: BootOptions = {}): Promise<CikguTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, populationSeed, curriculumSeed, ...(opts.seeds ?? [])], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_CIKGU_SEND_PER_MINUTE: '100000',
    THROTTLE_CIKGU_READ_PER_MINUTE: '100000',
    THROTTLE_CIKGU_WRITE_PER_MINUTE: '100000',
    THROTTLE_CIKGU_EXPORT_PER_MINUTE: '100000',
    THROTTLE_GLOBAL_PER_MINUTE: '100000',
    THROTTLE_CLASSES_READ_PER_MINUTE: '100000',
    THROTTLE_CLASSES_WRITE_PER_MINUTE: '100000',
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
  const clock = new FixedClock(START)
  let builder = Test.createTestingModule({ imports: [defineAppModule([AuthModule, CikguModule], opts.logStream ? { logStream: opts.logStream } : {})] })
    .overrideProvider(CLOCK)
    .useValue(clock)
  if (opts.ai) builder = builder.overrideProvider(CIKGU_AI).useValue(opts.ai)
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

/** Accounts of the identity and population seeds. */
export const TEACHER_A = 'guru@demo.test' // DEMO001
export const TEACHER_B = 'guru.demo001.01@example.test' // DEMO001
export const STUDENT_1 = 'pelajar@demo.test'
export const STUDENT_2 = 'pelajar2@demo.test'
export const STUDENT_3 = 'pelajarmaju@demo.test'
export const SCHOOL_ADMIN = 'adminsekolah@demo.test'
export const ADMIN = 'admin@demo.test'

export interface Api {
  get(path: string): Promise<Response>
  post(path: string, body?: unknown): Promise<Response>
  /** A POST without the CSRF header. */
  postNoCsrf(path: string, body?: unknown): Promise<Response>
}

export type Client = Api & { who: LoggedIn }

/** A logged-in client that sends the CSRF header on writes. */
export async function client(t: CikguTestApp, identifier: string): Promise<Client> {
  const who = await loginAs(t as never, identifier)
  return {
    who,
    get: (path) => who.agent.get(`/api${path}`),
    post: (path, body = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body as object),
    postNoCsrf: (path, body = {}) => who.agent.post(`/api${path}`).send(body as object),
  }
}

export const idOfEmail = async (t: CikguTestApp, email: string): Promise<string> =>
  (await t.db.query<{ id: string }>(`select id::text from users where lower(email) = lower($1)`, [email]))[0]?.id as string

export const subjectIdOf = async (t: CikguTestApp, name: string): Promise<string> =>
  (await t.db.query<{ id: string }>(`select id::text from subjects where name = $1`, [name]))[0]?.id as string

/** A class of a teacher with a subject and the given active members (direct inserts: the Classes owner is not under test here). */
export async function makeClass(t: CikguTestApp, teacherId: string, subjectId: string | null, name: string, members: string[]): Promise<string> {
  const level = (await t.db.query<{ id: string }>(`select id::text from education_levels where grade = 10 limit 1`))[0]?.id as string
  const cls = await t.db.query<{ id: string }>(
    `insert into classrooms (name, teacher_id, subject_id, education_level_id, academic_year) values ($1, $2, $3, $4, 2026) returning id::text`,
    [name, teacherId, subjectId, level],
  )
  const id = (cls[0] as { id: string }).id
  for (const m of members) await t.db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1, $2, 'active', 'teacher')`, [id, m])
  return id
}

/** Inserts `correct` right and `wrong` wrong practice answers of a student in a subject. */
export async function addAnswers(t: CikguTestApp, userId: string, subjectId: string, correct: number, wrong: number, isTest = false): Promise<void> {
  const rows: boolean[] = [...Array<boolean>(correct).fill(true), ...Array<boolean>(wrong).fill(false)]
  for (const ok of rows) {
    await t.db.query(
      `insert into practice_answers (user_id, subject_id, is_correct, answered_at, is_test) values ($1, $2, $3, '2026-10-01T00:00:00Z', $4)`,
      [userId, subjectId, ok, isTest],
    )
  }
}

export interface Sent {
  thread_id: string
  reply: string
  tier: string
  turns_remaining: number
  tool_hops: number
  tokens: { in: number; out: number }
}

/** Gives an existing account another single role (test only), with a scope that fits the role. */
export async function reroleUser(t: CikguTestApp, email: string, role: string): Promise<void> {
  const id = await idOfEmail(t, email)
  await t.db.query(`delete from user_roles where user_id = $1`, [id])
  await t.db.query(`delete from user_scopes where user_id = $1`, [id])
  await t.db.query(`insert into user_roles (user_id, role) values ($1, $2)`, [id, role])
  const state = role === 'ppd_officer'
  await t.db.query(`insert into user_scopes (user_id, role, level, state_code) values ($1, $2, $3, $4)`, [id, role, state ? 'state' : 'self', state ? 'SGR' : null])
}

/** The message the screen builds for the hand-off (same markers as the frontend `buildHandoffMessage`). */
export function handoff(input: { rubric?: string; subject?: string; level?: string; student?: string; title?: string; essay: string }): string {
  const rubric = CIKGU_RUBRICS.find((r) => r.key === input.rubric) ?? (CIKGU_RUBRICS[0] as (typeof CIKGU_RUBRICS)[number])
  const part = (name: string, v: string | undefined): string => (v && v.trim() !== '' ? ` ${name}: ${v.trim()}.` : '')
  return (
    `Tolong mark karangan ini menggunakan rubric ${rubric.label}.` +
    part('Subjek', input.subject) +
    part('Level', input.level) +
    part('Pelajar', input.student) +
    part('Tajuk', input.title) +
    ` Karangan: ${input.essay.replace(/[\r\n]+/g, ' ').trim()}`
  )
}
