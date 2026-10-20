import 'reflect-metadata'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication, Type } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { contentSeed } from '../../prisma/seed/content'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { questionsSeed } from '../../prisma/seed/questions'
import { examSeed } from '../../prisma/seed/exam'
import { spmSeed } from '../../prisma/seed/spm'
import { walletSeed } from '../../prisma/seed/wallet'
import { gamificationSeed } from '../../prisma/seed/gamification'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { featureModules } from '../../src/modules'
import { QuestionBankBuilderSource } from '../../src/modules/exam/builder'
import { PocBuilderQuestionSource } from '../../src/modules/exam/builder/poc-builder-source'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** Fixed "now" (Malaysia time) of the injected clock, as the other integration suites use. */
export const CONFORMANCE_START = '2026-10-19T09:00:00+08:00'

/**
 * Seeds the conformance database is built from. HOOK FOR BE-07: add its demo-account seed here (and
 * update `accounts.ts`); the suite needs nothing else from the seed layer.
 */
export const CONFORMANCE_SEEDS: SeedModule[] = [identitySeed, schoolsSeed, curriculumSeed, questionsSeed, walletSeed, contentSeed, examSeed, gamificationSeed, spmSeed]

/**
 * Environment of the conformance app. Determinism, never weaker production code:
 *
 * - Every ceiling a scenario could trip by volume alone (public and admin throttles, import, file
 *   reads and uploads) is raised, because a whole suite signs in and calls from one process. The
 *   LOGIN ceilings stay at their defaults on purpose: the throttle scenario proves the 6th attempt
 *   gets 429.
 * - Each scenario gets its own client address (`X-Forwarded-For`, `TRUST_PROXY_HOPS=1`), so the
 *   per-address and per-identifier login counters of one scenario cannot reach another.
 * - No artificial failed-login delay and a cheap dummy bcrypt (as every other integration suite).
 */
export function conformanceEnv(dbUrl: string, storageDir: string): Record<string, string | undefined> {
  return {
    DATABASE_URL: dbUrl,
    COOKIE_SECURE: 'false', // the supertest client speaks plain http
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined, // default 5, asserted by the throttle scenario
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    SESSION_REMEMBER_DAYS: undefined,
    SESSION_REMEMBER_DAYS_STAFF: undefined,
    TRUST_PROXY_HOPS: '1',
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    IC_HASH_KEY: undefined,
    THROTTLE_PUBLIC_PER_MINUTE: '100000',
    THROTTLE_PUBLIC_SEARCH_PER_MINUTE: '100000',
    THROTTLE_ADMIN_READ_PER_MINUTE: '100000',
    THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000',
    THROTTLE_IMPORT_PER_HOUR: '100000',
    THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_GENERATE_PER_MINUTE: '100000',
    THROTTLE_CLASSES_READ_PER_MINUTE: '100000',
    THROTTLE_CLASSES_WRITE_PER_MINUTE: '100000',
    THROTTLE_CLASS_JOIN_PER_MINUTE: '100000',
    THROTTLE_KIRKPATRICK_READ_PER_MINUTE: '100000',
    THROTTLE_KIRKPATRICK_WRITE_PER_MINUTE: '100000',
    THROTTLE_ANALYTICS_READ_PER_MINUTE: '100000',
    THROTTLE_CIKGU_SEND_PER_MINUTE: '100000',
    THROTTLE_CIKGU_READ_PER_MINUTE: '100000',
    THROTTLE_CIKGU_WRITE_PER_MINUTE: '100000',
    THROTTLE_CIKGU_EXPORT_PER_MINUTE: '100000',
    FILE_STORAGE_DIR: storageDir,
    MAX_UPLOAD_MB: undefined,
    INTAKE_MAX_FILE_MB: undefined,
    UPLOAD_RATE_PER_MINUTE: '1000', // the schema maximum
    FILE_READS_PER_MINUTE: '10000', // the schema maximum
    BIJAK_POC_QUESTIONS: 'true', // the conformance seed is the demo seed (staging): PoC questions served
    // BE-37 intake: volume ceilings raised (a whole suite creates many batches as one teacher) and the job worker
    // ticks fast, so a scenario can wait for a batch to be read. OCR stays off (OCR_ENGINE unset).
    INTAKE_MAX_ACTIVE_BATCHES: '100',
    INTAKE_DAILY_PAGE_QUOTA: '100000',
    INTAKE_WRITES_PER_MINUTE: '1000',
    INTAKE_READS_PER_MINUTE: '10000',
    JOBS_WORKER_ENABLED: 'true',
    JOBS_POLL_MS: '100',
  }
}

export interface ConformanceApp {
  app: INestApplication
  db: TestDatabase
  close(): Promise<void>
}

export interface BootOptions {
  /** Extra Nest controllers (the negative test registers one that breaks its response schema). */
  controllers?: Type<unknown>[]
  /** Overrides on top of `conformanceEnv`; `undefined` removes a key. */
  env?: Record<string, string | undefined>
}

/** The whole API (every registered feature module) on a fresh seeded database, a temp upload folder and a fixed clock. */
export async function bootConformanceApp(opts: BootOptions = {}): Promise<ConformanceApp> {
  const db = await createTestDatabase()
  await runSeeds(CONFORMANCE_SEEDS, { prisma: db.prisma })
  const dir = await mkdtemp(join(tmpdir(), 'pp-conformance-'))

  for (const [k, v] of Object.entries({ ...conformanceEnv(db.url, dir), ...opts.env })) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule(featureModules)],
    controllers: opts.controllers ?? [],
  })
    .overrideProvider(CLOCK)
    .useValue(new FixedClock(CONFORMANCE_START))
    // The scenarios are shared with the mock and place the PoC questions (reserved ids, BE-15). The seed
    // does not load them into the BE-09 tables yet (no PocQuestionLoader), so the builder keeps serving
    // the PoC fixture here, like BE-15 does on the student side. The wired source is covered by
    // test/exam-builder/wired-bank.spec.ts.
    .overrideProvider(QuestionBankBuilderSource)
    .useValue(new PocBuilderQuestionSource())
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()

  return {
    app,
    db,
    async close() {
      await app.close()
      await db.drop()
      await rm(dir, { recursive: true, force: true })
    },
  }
}
