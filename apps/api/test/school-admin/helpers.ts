import 'reflect-metadata'

import type { INestApplication, Type } from '@nestjs/common'
import { Test } from '@nestjs/testing'
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
import {
  SCHOOL_CLASS_COUNT_PORT,
  SCHOOL_PERFORMANCE_PORT,
  SchoolAdminModule,
  type SchoolClassCountPort,
  type SchoolPerformanceCtx,
  type SchoolPerformancePort,
  type SchoolPerformanceView,
} from '../../src/modules/school-admin'
import { UsersModule } from '../../src/modules/users'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { loginAs, START, type LoggedIn } from '../auth/helpers'

export { DEMO_PASSWORD, START, expectError, schoolIdOf, userIdOf, type LoggedIn } from '../auth/helpers'

export const SCHOOL_ADMIN = 'adminsekolah@demo.test'
export const ADMIN = 'admin@demo.test'
export const TEACHER = 'guru@demo.test'
export const STUDENT = 'pelajar@demo.test'

/** A BE-19-shaped fake: records the ctx it was asked with and answers the configured view. */
export class FakePerformance implements SchoolPerformancePort {
  calls: SchoolPerformanceCtx[] = []
  constructor(public view: SchoolPerformanceView) {}
  async school(ctx: SchoolPerformanceCtx): Promise<SchoolPerformanceView> {
    this.calls.push(ctx)
    return this.view
  }
}

export interface SchoolAdminTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  performance?: SchoolPerformancePort
  classes?: SchoolClassCountPort
  /** Feature modules to boot (default: auth, users and school-admin). Pass `featureModules` for the real wiring. */
  modules?: Type<unknown>[]
}

/** Nest app with the auth, users and school-admin modules on a private migrated database (identity + schools seeds). */
export async function bootSchoolAdminApp(opts: BootOptions = {}): Promise<SchoolAdminTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE: undefined,
    THROTTLE_SCHOOL_ADMIN_WRITE_PER_MINUTE: undefined,
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
    imports: [defineAppModule(opts.modules ?? [AuthModule, UsersModule, SchoolAdminModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
  if (opts.performance) builder = builder.overrideProvider(SCHOOL_PERFORMANCE_PORT).useValue(opts.performance)
  if (opts.classes) builder = builder.overrideProvider(SCHOOL_CLASS_COUNT_PORT).useValue(opts.classes)
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
export const login = (t: SchoolAdminTestApp, identifier: string): Promise<LoggedIn> => loginAs(t as unknown as AuthLike, identifier)

export interface Api {
  get(path: string): Promise<Response>
  post(path: string, body?: object): Promise<Response>
}

/** A logged-in client that sends the CSRF header on writes. */
export function apiOf(who: LoggedIn): Api {
  return {
    get: (path) => who.agent.get(`/api${path}`),
    post: (path, body = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body),
  }
}

/** Inserts an unverified teacher exactly as BE-06 registration leaves one: inactive, no school, pending for `pendingSchoolId`. */
export async function insertPendingTeacher(db: TestDatabase, email: string, pendingSchoolId: string, name = 'Guru Menunggu'): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into users (name, email, is_active, school_id, pending_school_id, created_at, updated_at)
     values ($1, $2, false, null, $3::bigint, now(), now()) returning id::text`,
    [name, email, pendingSchoolId],
  )
  const id = rows[0]?.id as string
  await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'teacher', now())`, [id])
  return id
}

export const emptyView = (over: Partial<SchoolPerformanceView> = {}): SchoolPerformanceView => ({
  stats: { students: 0, sessions: 0, answered: 0, accuracy: 0 },
  distribution: [],
  levels: [],
  ...over,
})

export function expectOk(res: Response): void {
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}
