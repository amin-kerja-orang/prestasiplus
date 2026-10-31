import 'reflect-metadata'

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { SessionSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { walletTiersSeed } from '../../prisma/seed/core/wallet-tiers'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { spmSubjectConfigsSeed } from '../../prisma/seed/spm-subject-configs'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { featureModules } from '../../src/modules'
import { createTestDatabase, type TestDatabase } from '../support/db'

export const FULL_APP_START = '2026-10-19T09:00:00+08:00'
export const DEMO_PASSWORD = 'Demo1234'

/** The real application (every feature module) on a private migrated database seeded as the chain spec does (no question seed). */
export interface FullApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  close(): Promise<void>
}

export async function bootFullApp(env: Record<string, string> = {}): Promise<FullApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, walletTiersSeed, curriculumSeed, examSeed, walletSeed, spmSubjectConfigsSeed], { prisma: db.prisma })
  const full: Record<string, string> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    FILE_STORAGE_DIR: await mkdtemp(join(tmpdir(), 'pp-full-')),
    UPLOAD_RATE_PER_MINUTE: '1000',
    FILE_READS_PER_MINUTE: '10000',
    BIJAK_POC_QUESTIONS: 'false',
    SPM_POOL_CACHE_SECONDS: '0',
    THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_ATTEMPT_SAVE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_ATTEMPT_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_CHECK_PER_MINUTE: '100000',
    THROTTLE_BIJAK_GENERATE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_GENERATE_PER_MINUTE: '100000',
    BIJAK_SWEEP_INTERVAL_SECONDS: '0',
    ...env,
  }
  for (const [k, v] of Object.entries(full)) process.env[k] = v
  const clock = new FixedClock(FULL_APP_START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule(featureModules)] })
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
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export interface FullClient {
  csrf: string
  userId: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  put(url: string, body?: unknown): request.Test
  del(url: string): request.Test
  upload(url: string, file: Buffer): request.Test
  noCsrf(method: 'post' | 'put' | 'delete', url: string, body?: unknown): request.Test
}

export async function loginFull(t: FullApp, identifier: string): Promise<FullClient> {
  const agent = request.agent(t.app.getHttpServer()) as unknown as TestAgent
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const withBody = (r: request.Test, body: unknown) => (body === undefined ? r : r.send(body as object))
  const c: FullClient = {
    csrf: session.csrf,
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => withBody(agent.post(url).set('X-CSRF-Token', c.csrf), body),
    put: (url, body) => withBody(agent.put(url).set('X-CSRF-Token', c.csrf), body),
    del: (url) => agent.delete(url).set('X-CSRF-Token', c.csrf),
    upload: (url, file) => agent.post(url).set('X-CSRF-Token', c.csrf).attach('file', file, { filename: 'rujukan.png', contentType: 'image/png' }),
    noCsrf: (method, url, body) => withBody(agent[method](url), body),
  }
  return c
}
