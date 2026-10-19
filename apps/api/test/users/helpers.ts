import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  AdminUserDetailSchema,
  ErrorBodySchema,
  type AdminUserDetail,
  type CreatedUser,
} from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { UsersModule } from '../../src/modules/users'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { DEMO_PASSWORD, loginAs, START, type LoggedIn } from '../auth/helpers'

export { DEMO_PASSWORD, START, expectError, schoolIdOf, userIdOf, type LoggedIn } from '../auth/helpers'

export interface UsersTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  /** Environment for this app only; `undefined` removes a key. */
  env?: Record<string, string | undefined>
  /** Log lines of this app go here (log-capture test). */
  logStream?: NodeJS.WritableStream
}

/** Nest app with the auth and users modules on a private migrated database (identity + schools seeds). */
export async function bootUsersApp(opts: BootOptions = {}): Promise<UsersTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })

  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_ADMIN_READ_PER_MINUTE: undefined,
    THROTTLE_ADMIN_WRITE_PER_MINUTE: undefined,
    THROTTLE_IMPORT_PER_HOUR: undefined,
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
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, UsersModule], opts.logStream ? { logStream: opts.logStream } : {})],
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

/** The shape `loginAs` of the auth helpers wants (it only uses `agent()`). */
type AuthLike = Parameters<typeof loginAs>[0]
export const login = (t: UsersTestApp, identifier: string, extra: Parameters<typeof loginAs>[2] = {}): Promise<LoggedIn> =>
  loginAs(t as unknown as AuthLike, identifier, extra)

export const ADMIN = 'admin@demo.test'
export const SCHOOL_ADMIN = 'adminsekolah@demo.test'
export const TEACHER = 'guru@demo.test'
export const STUDENT = 'pelajar@demo.test'

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

export function fieldsOf(res: Response): Record<string, string> {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  expect(parsed.error.code).toBe('VALIDATION_ERROR')
  return parsed.error.fields ?? {}
}

export function detailOf(res: Response): AdminUserDetail {
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  return AdminUserDetailSchema.parse(res.body.data)
}

/** A body that creates a teacher in the given school; override any field. */
let counter = 0
export function teacherBody(schoolId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  const n = String(++counter)
  return { roles: ['teacher'], name: 'Guru Ujian', email: `guru.${n}@ujian.test`, schoolId, ...over }
}

export type { CreatedUser }
export { DEMO_PASSWORD as PASSWORD }
