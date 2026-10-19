import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolPackagesSeed } from '../../prisma/seed/core/school-packages'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { COMP_CLASSROOM_PORT, SubscriptionsModule, type CompClassroomPort } from '../../src/modules/subscriptions'
import { UsersModule } from '../../src/modules/users'
import { loginAs, START } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { apiOf, type Api, type LoggedIn, type UsersTestApp } from '../users/helpers'

export { ADMIN, SCHOOL_ADMIN, STUDENT, TEACHER, apiOf, expectError, fieldsOf, schoolIdOf, userIdOf, type Api, type LoggedIn } from '../users/helpers'
export { DEMO_PASSWORD, START } from '../auth/helpers'

export interface SubTestApp extends UsersTestApp {
  /** Resolves a provider of the booted app (for example `SubscriptionService`). */
  get<T>(token: abstract new (...args: never[]) => T): T
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  /** Replaces the classroom port of the complimentary register (BE-17 is not built yet). */
  classrooms?: CompClassroomPort
}

/** Nest app with auth, users and subscriptions on a private migrated database (identity + schools seeds + the 4 packages). */
export async function bootSubApp(opts: BootOptions = {}): Promise<SubTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, schoolPackagesSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_ADMIN_READ_PER_MINUTE: '100000',
    THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000',
    THROTTLE_IMPORT_PER_HOUR: '100000',
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
  let builder = Test.createTestingModule({ imports: [defineAppModule([AuthModule, UsersModule, SubscriptionsModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
  if (opts.classrooms) builder = builder.overrideProvider(COMP_CLASSROOM_PORT).useValue(opts.classrooms)
  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()

  return {
    app,
    db,
    clock,
    http: () => request(app.getHttpServer()) as unknown as ReturnType<UsersTestApp['http']>,
    agent: () => request.agent(app.getHttpServer()),
    get: <T>(token: abstract new (...args: never[]) => T): T => app.get(token as never),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export const login = (t: SubTestApp, identifier: string): Promise<LoggedIn> => loginAs(t as never, identifier)

export async function adminApi(t: SubTestApp): Promise<Api> {
  return apiOf(await login(t, 'admin@demo.test'))
}

let seq = 0

/** Inserts a subscription row (dates are `YYYY-MM-DD`); returns its id. */
export async function addSubscription(
  db: TestDatabase,
  o: {
    schoolId: string
    packageId?: string
    tier?: 'basic' | 'full'
    quota?: number | null
    status?: 'active' | 'grace' | 'expired' | 'cancelled'
    starts?: string
    ends?: string
    notes?: string | null
    questionLimit?: number | null
  },
): Promise<string> {
  const pkg = o.packageId ?? (await db.query<{ id: string }>(`select id::text from school_packages where code = 'T5'`))[0]?.id
  const rows = await db.query<{ id: string }>(
    `insert into school_subscriptions (school_id, school_package_id, package_tier, student_quota, status, starts_on, ends_on, question_limit, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id::text`,
    [
      o.schoolId,
      pkg,
      o.tier ?? 'full',
      o.quota === undefined ? 100 : o.quota,
      o.status ?? 'active',
      o.starts ?? '2026-10-01',
      o.ends ?? '2027-10-01',
      o.questionLimit ?? null,
      o.notes ?? null,
    ],
  )
  return rows[0]?.id as string
}

/** Inserts `n` students (role student) into a school; returns their ids. */
export async function addStudents(db: TestDatabase, schoolId: string, n: number, over: { grade?: number; active?: boolean; prefix?: string } = {}): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const [u] = await db.query<{ id: string }>(
      `insert into users (name, email, school_id, grade, is_active) values ($1, $2, $3, $4, $5) returning id::text`,
      [`${over.prefix ?? 'Murid Ujian'} ${String(++seq)}`, `murid.${String(seq)}@ujian.test`, schoolId, over.grade ?? 10, over.active ?? true],
    )
    await db.query(`insert into user_roles (user_id, role) values ($1, 'student')`, [u?.id])
    ids.push(u?.id as string)
  }
  return ids
}

export const dataOf = (res: Response): Record<string, unknown> => {
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  return res.body as Record<string, unknown>
}
