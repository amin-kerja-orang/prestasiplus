import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ERROR_STATUS, ErrorBodySchema, SessionSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { BijakPapersModule, BijakPapersPorts, type BijakProgressSource, type BijakQuestionSource, type BijakServedSource } from '../../src/modules/bijak/papers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export const DEMO_PASSWORD = 'Demo1234'
export const START = '2026-10-19T09:00:00+08:00'

export interface PapersTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  ports: BijakPapersPorts
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  db?: TestDatabase
  questionSource?: BijakQuestionSource
  progress?: BijakProgressSource
  served?: BijakServedSource
  /** Environment overrides for this app (rate limits). */
  env?: Record<string, string>
}

/** Nest app with the auth and Bijak papers modules on a private database seeded with identity, curriculum and exam. */
export async function bootPapersApp(opts: BootOptions = {}): Promise<PapersTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) await runSeeds([identitySeed, curriculumSeed, examSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    // Volume-based ceilings are raised so a test file can call freely; the rate-limit test lowers its own.
    THROTTLE_BIJAK_GENERATE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE: '100000',
    ...opts.env,
  })
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, BijakPapersModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  const ports = app.get(BijakPapersPorts)
  if (opts.questionSource) ports.provideQuestionSource(opts.questionSource)
  if (opts.progress) ports.provideProgress(opts.progress)
  if (opts.served) ports.provideServed(opts.served)
  await app.init()
  return {
    app,
    db,
    clock,
    ports,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      if (!opts.db) {
        await db.prisma.$disconnect()
        await new Promise((resolve) => setTimeout(resolve, 200))
        await db.drop()
      }
    },
  }
}

export interface Client {
  csrf: string
  userId: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  /** The same POST without the CSRF header. */
  postNoCsrf(url: string, body?: unknown): request.Test
  /** Enters Mod Pelajar (admin, school admin) and keeps the new CSRF token. */
  enterMod(): Promise<void>
}

export async function loginAs(t: PapersTestApp, identifier: string): Promise<Client> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const client: Client = {
    csrf: session.csrf,
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('X-CSRF-Token', client.csrf).send(body as object),
    postNoCsrf: (url, body) => agent.post(url).send(body as object),
    async enterMod() {
      const r = await agent.post('/api/session/mode').set('X-CSRF-Token', client.csrf).send({ mode: 'mod_pelajar' })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      client.csrf = SessionSchema.parse(r.body.data).csrf
    },
  }
  return client
}

export function expectError(res: Response, code: string, status?: number, message?: string) {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(status ?? ERROR_STATUS[code as keyof typeof ERROR_STATUS])
  expect(parsed.error.code).toBe(code)
  if (message !== undefined) expect(parsed.error.message).toBe(message)
  return parsed.error
}

/** Every key name found anywhere in a JSON value. */
export function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) allKeys(v, out)
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      allKeys(v, out)
    }
  }
  return out
}

export { serveSeededBlueprints } from '../support/serve-blueprints'

export const count = async (db: TestDatabase, sql: string, params: unknown[] = []): Promise<number> =>
  Number((await db.query<{ n: string }>(sql, params))[0]?.n)
