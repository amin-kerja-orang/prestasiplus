import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema, ERROR_STATUS, SessionSchema, envelopeOf } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'
import type { z } from 'zod'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { CurriculumModule } from '../../src/modules/curriculum'
import { QuestionWorkflowModule, QuestionWorkflowPorts, type QuestionBankPort } from '../../src/modules/questions/workflow'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { FakeQuestionBank } from './fake-question-bank'

export const DEMO_PASSWORD = 'Demo1234'
export const START = '2026-10-19T09:00:00+08:00'

/** The five demo accounts of the identity seed that this module's tests sign in as. */
export const ACCOUNTS = {
  admin: 'admin@demo.test', // Admin Pusat
  teacher: 'guru@demo.test', // Guru
  otherTeacher: 'guru2@demo.test', // second Guru, cloned from guru@demo.test by `bootWorkflowApp` (same password)
  schoolAdmin: 'adminsekolah@demo.test', // Admin Sekolah
  student: 'pelajar@demo.test',
} as const
export type AccountKey = keyof typeof ACCOUNTS

export interface WorkflowTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  /** The question bank the module uses: a fake unless `bank` was given. */
  bank: QuestionBankPort
  /** The same object typed as the fake (only when the default fake is used). */
  fake: FakeQuestionBank
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  db?: TestDatabase
  /** A bank to plug in instead of the default `FakeQuestionBank`; `null` keeps the empty default. */
  bank?: QuestionBankPort | null
  /** Extra environment variables (for example a low rate limit). */
  env?: Record<string, string>
}

/** Nest app with the auth, curriculum and question workflow modules on a private migrated and seeded database. */
export async function bootWorkflowApp(opts: BootOptions = {}): Promise<WorkflowTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) {
    await runSeeds([identitySeed, curriculumSeed], { prisma: db.prisma })
    await cloneTeacher(db)
  }
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000',
    ...opts.env,
  })
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, CurriculumModule, QuestionWorkflowModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  const fake = new FakeQuestionBank()
  const bank: QuestionBankPort = opts.bank === undefined ? fake : (opts.bank ?? app.get(QuestionWorkflowPorts).questionBank)
  if (opts.bank !== null) app.get(QuestionWorkflowPorts).provideQuestionBank(bank)
  await app.init()
  return {
    app,
    db,
    clock,
    bank,
    fake,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      if (!opts.db) await dropDatabase(db)
    },
  }
}

export interface Client {
  csrf: string
  userId: string
  /** Active role code of the session. */
  role: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  put(url: string, body?: unknown): request.Test
  patch(url: string, body?: unknown): request.Test
  delete(url: string): request.Test
  /** The same call without the CSRF header. */
  noCsrf: { post(url: string, body?: unknown): request.Test; put(url: string, body?: unknown): request.Test; patch(url: string, body?: unknown): request.Test; delete(url: string): request.Test }
}

/** Logs in with the demo password; mutating calls carry the CSRF token like the browser does. */
export async function loginAs(t: WorkflowTestApp, identifier: string): Promise<Client> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const csrf = session.csrf
  const withCsrf = (r: request.Test) => r.set('X-CSRF-Token', csrf)
  return {
    csrf,
    userId: session.user.id,
    role: session.active.role,
    get: (url) => agent.get(url),
    post: (url, body) => withCsrf(agent.post(url)).send(body as object),
    put: (url, body) => withCsrf(agent.put(url)).send(body as object),
    patch: (url, body) => withCsrf(agent.patch(url)).send(body as object),
    delete: (url) => withCsrf(agent.delete(url)),
    noCsrf: {
      post: (url, body) => agent.post(url).send(body as object),
      put: (url, body) => agent.put(url).send(body as object),
      patch: (url, body) => agent.patch(url).send(body as object),
      delete: (url) => agent.delete(url),
    },
  }
}

/** Signs in as every role this module distinguishes. Admin Sekolah must get 403 on every route. */
export async function loginAll(t: WorkflowTestApp): Promise<Record<AccountKey, Client>> {
  return {
    admin: await loginAs(t, ACCOUNTS.admin),
    teacher: await loginAs(t, ACCOUNTS.teacher),
    otherTeacher: await loginAs(t, ACCOUNTS.otherTeacher),
    schoolAdmin: await loginAs(t, ACCOUNTS.schoolAdmin),
    student: await loginAs(t, ACCOUNTS.student),
  }
}

/** Asserts a contract error body with the generic status table and, when given, the exact message. */
export function expectError(res: Response, code: keyof typeof ERROR_STATUS, message?: string) {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(ERROR_STATUS[code])
  expect(parsed.error.code).toBe(code)
  if (message !== undefined) expect(parsed.error.message).toBe(message)
  return parsed.error
}

export function expectCsrfInvalid(res: Response) {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(403)
  expect(parsed.error.code).toBe('CSRF_INVALID')
}

/** Parses `{ data }` with the contract schema and returns the parsed data. */
export function parseData<S extends z.ZodType>(res: Response, schema: S): z.output<S> {
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  return (envelopeOf(schema).parse(res.body) as { data: z.output<S> }).data
}

export const count = async (db: TestDatabase, sql: string, params: unknown[] = []): Promise<number> =>
  Number((await db.query<{ n: string }>(sql, params))[0]?.n)

/** Drops a test database after letting the Prisma pool finish (see the curriculum helper). */
export async function dropDatabase(db: TestDatabase): Promise<void> {
  await db.prisma.$disconnect()
  await new Promise((resolve) => setTimeout(resolve, 200))
  await db.drop()
}

/** Adds `guru2@demo.test`: a copy of `guru@demo.test` (same school, role, scope and password) with its own id. */
export async function cloneTeacher(db: TestDatabase): Promise<void> {
  const cols = (await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'users'
      and is_identity = 'NO' and is_generated = 'NEVER' and column_name not in ('email', 'name', 'username') order by ordinal_position`,
  )).map((c) => `"${c.column_name}"`).join(', ')
  const [row] = await db.query<{ id: string }>(
    `insert into users (name, email, ${cols}) select 'Guru Kedua Demo', 'guru2@demo.test', ${cols} from users where email = 'guru@demo.test' returning id::text`,
  )
  const id = row!.id
  await db.query(`insert into user_roles (user_id, role) select $1::bigint, role from user_roles where user_id = (select id from users where email = 'guru@demo.test')`, [id])
  await db.query(
    `insert into user_scopes (user_id, role, level, state_code, district_code, school_id)
     select $1::bigint, role, level, state_code, district_code, school_id from user_scopes where user_id = (select id from users where email = 'guru@demo.test')`,
    [id],
  )
}
