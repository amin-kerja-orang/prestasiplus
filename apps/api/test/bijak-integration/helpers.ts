import 'reflect-metadata'

import type { INestApplication, Type } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { SessionSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { questionsSeed } from '../../prisma/seed/questions'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { BijakIntegrationModule } from '../../src/modules/bijak/integration'
import { createTestDatabase, type TestDatabase } from '../support/db'

export const DEMO_PASSWORD = 'Demo1234'
export const START = '2026-10-20T09:00:00+08:00'
export const STUDENT = 'pelajar@demo.test'
export const TEACHER = 'guru@demo.test'
export const ADMIN = 'admin@demo.test'

export interface IntegrationApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  agent(): TestAgent
  close(): Promise<void>
}

/**
 * The real wiring: auth + `BijakIntegrationModule` (papers, attempts, practice, wallet, BE-09 question bridge).
 * No port is plugged by the test. The BE-09 question seed runs too, so every flow runs on the merged stack
 * (PoC papers on the reserved ids AND bank questions in `question_versions`).
 */
export async function bootIntegrationApp(opts: { pocQuestions?: boolean; extraModules?: Type<unknown>[]; extraSeeds?: SeedModule[] } = {}): Promise<IntegrationApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed, questionsSeed, examSeed, walletSeed, ...(opts.extraSeeds ?? [])], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    THROTTLE_BIJAK_ATTEMPT_SAVE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_ATTEMPT_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_CHECK_PER_MINUTE: '100000',
    THROTTLE_BIJAK_PHOTO_PER_MINUTE: '100000',
    THROTTLE_BIJAK_GENERATE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE: '100000',
    BIJAK_SWEEP_INTERVAL_SECONDS: '0',
    UPLOAD_RATE_PER_MINUTE: '1000',
    FILE_STORAGE_DIR: undefined,
    // The test boot runs the demo seed, as staging does: PoC questions on unless a spec asks for the production default.
    BIJAK_POC_QUESTIONS: opts.pocQuestions === false ? 'false' : 'true',
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, BijakIntegrationModule, ...(opts.extraModules ?? [])])] })
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
    agent: () => request.agent(app.getHttpServer()) as unknown as TestAgent,
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export interface Client {
  userId: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  put(url: string, body?: unknown): request.Test
}

export async function loginAs(t: IntegrationApp, identifier: string, mod = false): Promise<Client> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  let session = SessionSchema.parse(res.body.data)
  if (mod) {
    const m = await agent.post('/api/session/mode').set('X-CSRF-Token', session.csrf).send({ mode: 'mod_pelajar' })
    expect(m.status, JSON.stringify(m.body)).toBe(200)
    session = SessionSchema.parse(m.body.data)
  }
  const csrf = session.csrf
  return {
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('X-CSRF-Token', csrf).send(body as object),
    put: (url, body) => agent.put(url).set('X-CSRF-Token', csrf).send(body as object),
  }
}
