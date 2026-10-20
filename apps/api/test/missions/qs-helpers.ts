/**
 * Shared boot and fixtures of the BE-18 part B specs (question sets, papers, templates, DSKP picks).
 * Not a spec. The app is the classes helper's app plus the question sets module; sets and items are
 * inserted directly (no create route exists in this half), classes go through the BE-17 routes.
 */
import { expect } from 'vitest'
import { Test } from '@nestjs/testing'
import type { Response } from 'supertest'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { ClassesModule } from '../../src/modules/classes'
import { QuestionSetsModule } from '../../src/modules/classes/question-sets'
import { loginAs, START, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { createClass, apiOf, type Api } from '../classes/helpers'

export { START, createClass, apiOf, type Api }
export {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT_1,
  STUDENT_2,
  TEACHER_A,
  TEACHER_C,
  errorIs,
  fieldsOf,
  firstSubject,
  idOfEmail,
} from '../classes/helpers'

export interface QsTestApp {
  app: import('@nestjs/common').INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  get<T>(token: abstract new (...args: never[]) => T): T
  close(): Promise<void>
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  seeds?: SeedModule[]
}

/** Nest app with auth, classes and the question sets module on a private migrated and seeded database. */
export async function bootQsApp(opts: BootOptions = {}): Promise<QsTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, populationSeed, curriculumSeed, questionsSeed, ...(opts.seeds ?? [])], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_CLASSES_READ_PER_MINUTE: '100000',
    THROTTLE_CLASSES_WRITE_PER_MINUTE: '100000',
    THROTTLE_CLASS_JOIN_PER_MINUTE: '100000',
    PUBLIC_BASE_URL: 'https://app.example.test',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOG_LEVEL: process.env.PP_TEST_LOG_LEVEL ?? process.env.LOG_LEVEL,
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, ClassesModule, QuestionSetsModule])] })
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
    get: <T>(token: abstract new (...args: never[]) => T): T => app.get(token as never),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export const login = (t: QsTestApp, identifier: string): Promise<LoggedIn> => loginAs(t as never, identifier)

export type Client = Api & { who: LoggedIn }
export async function client(t: QsTestApp, identifier: string): Promise<Client> {
  const who = await login(t, identifier)
  return { ...apiOf(who), who }
}

/** A teacher creates a class and the given students join it by code. Returns the class. */
export async function classWith(
  t: QsTestApp,
  teacher: Client,
  students: Client[],
  name = 'Kelas Set Soalan',
): Promise<{ id: string; joinCode: string; name: string }> {
  const cls = await createClass(t as never, teacher, { name })
  for (const s of students) {
    const res = await s.post('/kelas-saya/join', { classCode: cls.joinCode })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  }
  return cls
}

/** Ids of published, active questions of the seed, ascending. */
export async function eligibleQuestionIds(t: QsTestApp, n: number): Promise<string[]> {
  const rows = await t.db.query<{ id: string }>(
    `select q.id::text id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
      where q.is_active and v.status = 'published' order by q.id limit $1`,
    [n],
  )
  expect(rows.length).toBe(n)
  return rows.map((r) => r.id)
}

export interface NewSet {
  teacherId: string
  classroomId: string
  title?: string
  status?: 'draft' | 'scheduled' | 'published'
  scheduledAt?: string | null
  timeLimitMinutes?: number | null
  maxAttempts?: number
  needsRebuild?: boolean
  questionIds?: string[]
  createdAt?: string
  subjectId?: string | null
}

/** Inserts a set (and its items in the given order) directly. Returns its id. */
export async function insertSet(t: QsTestApp, s: NewSet): Promise<string> {
  const rows = await t.db.query<{ id: string }>(
    `insert into question_sets (teacher_id, classroom_id, subject_id, title, time_limit_minutes, max_attempts, status, scheduled_at, needs_rebuild, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10::timestamptz, now()), now()) returning id::text id`,
    [
      s.teacherId,
      s.classroomId,
      s.subjectId ?? null,
      s.title ?? 'Set Ujian',
      s.timeLimitMinutes ?? null,
      s.maxAttempts ?? 1,
      s.status ?? 'published',
      s.scheduledAt ?? null,
      s.needsRebuild ?? false,
      s.createdAt ?? null,
    ],
  )
  const id = (rows[0] as { id: string }).id
  let position = 0
  for (const q of s.questionIds ?? []) {
    await t.db.query(`insert into question_set_items (question_set_id, position, question_id, question_version_no) values ($1, $2, $3, 1)`, [id, position++, q])
  }
  return id
}

/** Inserts a practice session linked to a set. */
export async function insertSession(
  t: QsTestApp,
  s: { userId: string; setId: string; status: 'in_progress' | 'completed'; isTest?: boolean },
): Promise<void> {
  await t.db.query(
    `insert into practice_sessions (user_id, mode, question_set_id, question_count, status, started_at, completed_at, is_test)
     values ($1, 'question_set', $2, 3, $3, now(), case when $3 = 'completed' then now() end, $4)`,
    [s.userId, s.setId, s.status, s.isTest ?? false],
  )
}

export const bytes = (n: number, fill = 0x61): Buffer => Buffer.alloc(n, fill)

export function expectNoStore(res: Response): void {
  expect(res.headers['cache-control']).toContain('no-store')
}
