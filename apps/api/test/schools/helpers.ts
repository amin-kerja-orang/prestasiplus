import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { SchoolsModule } from '../../src/modules/schools'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { SessionSchema } from '@pp/contract'
import { expect } from 'vitest'

import { cookieValue, DEMO_PASSWORD, START, type LoggedIn } from '../auth/helpers'

export { cookieValue, DEMO_PASSWORD, expectError, type LoggedIn, schoolIdOf, START, userIdOf } from '../auth/helpers'

export interface SchoolsTestApp {
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  /** Environment for this app only; `undefined` removes a key. */
  env?: Record<string, string | undefined>
}

/** Nest app with the auth and schools modules on a private migrated database (identity + schools seeds). */
export async function bootSchoolsApp(opts: BootOptions = {}): Promise<SchoolsTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })

  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_PUBLIC_PER_MINUTE: undefined,
    THROTTLE_ADMIN_READ_PER_MINUTE: undefined,
    THROTTLE_ADMIN_WRITE_PER_MINUTE: undefined,
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, SchoolsModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()

  return {
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

/** Adds `n` active SK schools in Perak (no JPN/PPD link) named "SK Contoh 001"..., codes "CTH001"... */
export async function insertFillerSchools(db: TestDatabase, n: number): Promise<void> {
  await db.query(
    `insert into schools (name, code, type, state, district, city, is_active)
     select 'SK Contoh ' || lpad(i::text, 3, '0'), 'CTH' || lpad(i::text, 3, '0'), 'SK', 'Perak', 'PPD KINTA', 'Ipoh', (i % 10 <> 0)
       from generate_series(1, $1::int) as i`,
    [n],
  )
}

/** Logs in through the real endpoint and keeps the cookie jar and the CSRF token. */
export async function loginAs(t: SchoolsTestApp, identifier: string): Promise<LoggedIn> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const token = cookieValue(res)
  expect(token).toBeTruthy()
  return { agent, csrf: session.csrf, session, token: token as string, res }
}
