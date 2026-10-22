import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { SponsorshipModule } from '../../src/modules/sponsorship'
import { DEMO_PASSWORD, START } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { START } from '../auth/helpers'

export interface SponsorshipTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  logStream?: NodeJS.WritableStream
}

/** Nest app with auth and the Sponsorship module on a private migrated and seeded database and a fixed clock. */
export async function bootSponsorshipApp(opts: BootOptions = {}): Promise<SponsorshipTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_FOSTER_APPLICATION_PER_MINUTE: '100000',
    THROTTLE_GLOBAL_PER_MINUTE: '100000',
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
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, SponsorshipModule], opts.logStream ? { logStream: opts.logStream } : {})],
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

export const STUDENT = 'pelajar@demo.test'
export const STUDENT_B = 'pelajar2@demo.test'
export const TEACHER = 'guru@demo.test'
export const ADMIN = 'admin@demo.test'
export const SCHOOL_ADMIN = 'adminsekolah@demo.test'
export const PATH = '/api/mohon-keluarga-angkat'

export interface Client {
  userId: string
  csrf: string
  post(body?: unknown): Promise<Response>
  postNoCsrf(body?: unknown): Promise<Response>
}

/** Logs in (optionally switching Mod Pelajar on) and returns a client that sends the CSRF header. */
export async function client(t: SponsorshipTestApp, identifier: string, opts: { modPelajar?: boolean } = {}): Promise<Client> {
  const agent = t.agent()
  const login = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  if (login.status !== 200) throw new Error(`login failed: ${String(login.status)}`)
  const first = login.body.data as { csrf: string; user: { id: string } }
  let csrf = first.csrf
  if (opts.modPelajar) {
    const mode = await agent.post('/api/session/mode').set('X-CSRF-Token', csrf).send({ mode: 'mod_pelajar' })
    if (mode.status !== 200) throw new Error(`mode failed: ${String(mode.status)}`)
    csrf = (mode.body.data as { csrf?: string }).csrf ?? csrf
  }
  return {
    userId: first.user.id,
    csrf,
    post: (body = {}) => agent.post(PATH).set('X-CSRF-Token', csrf).send(body as object),
    postNoCsrf: (body = {}) => agent.post(PATH).send(body as object),
  }
}

export const idOfEmail = async (t: SponsorshipTestApp, email: string): Promise<string> =>
  (await t.db.query<{ id: string }>(`select id::text from users where lower(email) = lower($1)`, [email]))[0]?.id as string

/** Gives an existing account another single role (test only). */
export async function reroleUser(t: SponsorshipTestApp, email: string, role: string): Promise<void> {
  const id = await idOfEmail(t, email)
  await t.db.query(`delete from user_roles where user_id = $1`, [id])
  await t.db.query(`delete from user_scopes where user_id = $1`, [id])
  await t.db.query(`insert into user_roles (user_id, role) values ($1, $2)`, [id, role])
  await t.db.query(`insert into user_scopes (user_id, role, level) values ($1, $2, 'self')`, [id, role])
}

export interface StoredApplication {
  id: string
  student_id: string
  applicant_user_id: string
  applicant_role: string
  student_category: string
  family_income_range: string | null
  reason: string
  status: string
  created_at: Date
  is_test: boolean
  legacy_source: string | null
  legacy_id: string | null
}

export const applications = (t: SponsorshipTestApp): Promise<StoredApplication[]> =>
  t.db.query<StoredApplication>(`select id::text, student_id::text, applicant_user_id::text, applicant_role, student_category, family_income_range, reason, status, created_at, is_test, legacy_source, legacy_id from foster_applications order by id`)

export const validBody = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  studentEmail: STUDENT,
  studentCategory: 'B40',
  familyIncomeRange: 'RM1,000 - RM2,500',
  reason: 'Pelajar tinggal bersama nenek.',
  ...over,
})
