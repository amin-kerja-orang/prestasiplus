import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { populationSeed } from '../../prisma/seed/core/population'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { ClassesModule } from '../../src/modules/classes'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { loginAs, START, type LoggedIn } from '../auth/helpers'

export { START, expectError, schoolIdOf, userIdOf, type LoggedIn } from '../auth/helpers'

export interface ClassesTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  get<T>(token: abstract new (...args: never[]) => T): T
  close(): Promise<void>
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  /** Extra seeds after identity, schools, population and curriculum. */
  seeds?: SeedModule[]
}

/** Nest app with auth and classes (curriculum comes with it) on a private migrated and seeded database. */
export async function bootClassesApp(opts: BootOptions = {}): Promise<ClassesTestApp> {
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
    THROTTLE_CLASSES_READ_PER_MINUTE: '100000',
    THROTTLE_CLASSES_WRITE_PER_MINUTE: '100000',
    THROTTLE_CLASS_JOIN_PER_MINUTE: '100000',
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
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, ClassesModule])] })
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

export const login = (t: ClassesTestApp, identifier: string): Promise<LoggedIn> => loginAs(t as never, identifier)

/** Accounts of the identity and population seeds. */
export const TEACHER_A = 'guru@demo.test' // DEMO001
export const TEACHER_B = 'guru.demo001.01@example.test' // DEMO001, same school as A
export const TEACHER_C = 'guru.demo002.01@example.test' // DEMO002
export const STUDENT_1 = 'pelajar@demo.test' // DEMO001, Form 4
export const STUDENT_2 = 'pelajar2@demo.test' // DEMO001, Form 4
export const STUDENT_MAJU = 'pelajarmaju@demo.test' // DEMO001, Form 5
export const STUDENT_INACTIVE = 'tidakaktif@demo.test' // DEMO001, inactive
export const STUDENT_OTHER_SCHOOL = 'murid.demo002.01@example.test' // DEMO002
export const SCHOOL_ADMIN = 'adminsekolah@demo.test'
export const ADMIN = 'admin@demo.test'

export interface Api {
  get(path: string): Promise<Response>
  post(path: string, body?: object): Promise<Response>
  put(path: string, body?: object): Promise<Response>
  del(path: string): Promise<Response>
}

/** A logged-in client that sends the CSRF header on writes. */
export function apiOf(who: LoggedIn): Api {
  return {
    get: (path) => who.agent.get(`/api${path}`),
    post: (path, body = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body),
    put: (path, body = {}) => who.agent.put(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body),
    del: (path) => who.agent.delete(`/api${path}`).set('X-CSRF-Token', who.csrf),
  }
}

export type Client = Api & { who: LoggedIn }

export async function client(t: ClassesTestApp, identifier: string): Promise<Client> {
  const who = await login(t, identifier)
  return { ...apiOf(who), who }
}

export function fieldsOf(res: Response): Record<string, string> {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  expect(parsed.error.code).toBe('VALIDATION_ERROR')
  return parsed.error.fields ?? {}
}

/** Asserts a contract error with the exact status, code and message. */
export function errorIs(res: Response, status: number, code: string, message: string): void {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  expect(parsed.error.code).toBe(code)
  expect(parsed.error.message).toBe(message)
}

export const idOfEmail = async (t: ClassesTestApp, email: string): Promise<string> =>
  (await t.db.query<{ id: string }>(`select id::text from users where lower(email) = lower($1)`, [email]))[0]?.id as string

export const schoolOfCode = async (t: ClassesTestApp, code: string): Promise<string> =>
  (await t.db.query<{ id: string }>(`select id::text from schools where code = $1`, [code]))[0]?.id as string

/** First active subject id (seeded curriculum). */
export const firstSubject = async (t: ClassesTestApp): Promise<{ id: string; name: string }> =>
  (await t.db.query<{ id: string; name: string }>(`select id::text, name from subjects where is_active order by sort_order, id limit 1`))[0] as { id: string; name: string }

/** Creates a class through the API as `api`; returns the created class. */
export async function createClass(
  t: ClassesTestApp,
  api: Api,
  over: Record<string, unknown> = {},
): Promise<{ id: string; joinCode: string; name: string; schoolId: string | null }> {
  const subject = await firstSubject(t)
  const res = await api.post('/guru/classes', { name: 'Kelas Ujian', subjectId: subject.id, educationLevel: 'tingkatan-4', ...over })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body.data
}
