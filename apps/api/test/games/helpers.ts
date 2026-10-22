import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { SessionSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolPackagesSeed } from '../../prisma/seed/core/school-packages'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import {
  GamesModule,
  GamesPorts,
  GameReadService,
  type BattleReadPort,
  type BotPoolPort,
  type GameRewardsPort,
  type PlatformAccuracySource,
  type WeeklyPracticeSource,
} from '../../src/modules/games'
import { DEMO_PASSWORD, dropDatabase } from '../curriculum/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { count, dropDatabase, expectCsrfInvalid, expectError, idOf, parseData } from '../curriculum/helpers'

/** Fixed "now" of the injected clock (Monday 19 October 2026, 09:00 Malaysia time). */
export const START = '2026-10-19T09:00:00+08:00'

/** Every games throttle lifted (the frozen clock never ends a window). A test lowers one to prove a 429. */
export const GAMES_THROTTLES_LIFTED: Record<string, string> = {
  THROTTLE_GAMES_WRITE_PER_MINUTE: '100000',
  THROTTLE_GAMES_READ_PER_MINUTE: '100000',
  THROTTLE_GAMES_SPIN_PER_MINUTE: '100000',
  THROTTLE_GAMES_SOLO_START_PER_MINUTE: '100000',
  THROTTLE_GAMES_SOLO_CHECK_PER_MINUTE: '100000',
}

export interface BootGamesOptions {
  /** Extra environment variables (for example a low `THROTTLE_GAMES_WRITE_PER_MINUTE`). */
  env?: Record<string, string>
  /** Extra seeds run after the defaults. */
  seeds?: SeedModule[]
  /** Replace the default seed list (identity, schools, packages, population, curriculum, questions, wallet). */
  baseSeeds?: SeedModule[]
  /** Port doubles, plugged before `app.init()` (each at most once). */
  ports?: {
    rewards?: GameRewardsPort
    weeklyPractice?: WeeklyPracticeSource
    platformAccuracy?: PlatformAccuracySource
    battle?: BattleReadPort
    botPool?: BotPoolPort
  }
  /** Start the clock somewhere else. */
  at?: string
  /** Reuse a database (the caller then drops it). */
  db?: TestDatabase
}

export interface GamesTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  ports: GamesPorts
  reads: GameReadService
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

/** A rewards double that can earn: records every report and credits `coins` (or 0). Plug with `ports.rewards`. */
export class FakeRewards implements GameRewardsPort {
  canEarn = true
  rates = { correct: 2, win: 10 }
  readonly calls: { userId: string; input: Parameters<GameRewardsPort['onGameResult']>[1]; isTest: boolean }[] = []
  async canEarnSyiling(): Promise<boolean> {
    return this.canEarn
  }
  async tierRates(): Promise<{ correct: number; win: number }> {
    return this.rates
  }
  async onGameResult(
    userId: string,
    input: Parameters<GameRewardsPort['onGameResult']>[1],
    options: { isTest: boolean },
  ): Promise<{ coinsCredited: number; xpAdded: number }> {
    this.calls.push({ userId, input, isTest: options.isTest })
    if (options.isTest || !this.canEarn) return { coinsCredited: 0, xpAdded: 0 }
    const coins = input.coins ?? (input.game === 'papan_bijak' ? (input.event === 'win' ? this.rates.win : this.rates.correct) : 0)
    return { coinsCredited: coins > 0 ? coins : 0, xpAdded: 0 }
  }
}

/**
 * Nest app with auth + `GamesModule` (and everything it needs) on a private migrated and seeded database, with a
 * frozen clock and the games throttles lifted. Port doubles are plugged before `init()`.
 */
export async function bootGamesApp(opts: BootGamesOptions = {}): Promise<GamesTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) {
    const base = opts.baseSeeds ?? [identitySeed, schoolsSeed, schoolPackagesSeed, populationSeed, curriculumSeed, questionsSeed, walletSeed]
    await runSeeds([...base, ...(opts.seeds ?? [])], { prisma: db.prisma })
  }
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    ...GAMES_THROTTLES_LIFTED,
    ...opts.env,
  })
  const clock = new FixedClock(opts.at ?? START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, GamesModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  const ports = app.get(GamesPorts, { strict: false })
  const p = opts.ports ?? {}
  if (p.rewards) ports.provideRewards(p.rewards)
  if (p.weeklyPractice) ports.provideWeeklyPractice(p.weeklyPractice)
  if (p.platformAccuracy) ports.providePlatformAccuracy(p.platformAccuracy)
  if (p.battle) ports.provideBattle(p.battle)
  if (p.botPool) ports.provideBotPool(p.botPool)
  await app.init()
  return {
    app,
    db,
    clock,
    ports,
    reads: app.get(GameReadService, { strict: false }),
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      if (!opts.db) await dropDatabase(db)
    },
  }
}

export interface Client {
  csrf: string
  userId: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  put(url: string, body?: unknown): request.Test
  patch(url: string, body?: unknown): request.Test
  delete(url: string): request.Test
  /** The same call without the CSRF header. */
  noCsrf: {
    post(url: string, body?: unknown): request.Test
    put(url: string, body?: unknown): request.Test
    patch(url: string, body?: unknown): request.Test
    delete(url: string): request.Test
  }
}

/** Demo accounts used by the games tests (identity seed + population seed). */
export const ACCOUNTS = {
  /** Grade 10 (Tingkatan 4), DEMO001. */
  student: 'pelajar@demo.test',
  /** Grade 11 (Tingkatan 5), DEMO001. */
  studentMaju: 'pelajarmaju@demo.test',
  /** Grade 10, DEMO001; no wallet or history. */
  student2: 'pelajar2@demo.test',
  teacher: 'guru@demo.test',
  schoolAdmin: 'adminsekolah@demo.test',
  admin: 'admin@demo.test',
} as const

/** Logs in with the demo password; `mod: true` also switches to Mod Pelajar (admin or school admin): rows are then `is_test`. */
export async function loginAs(t: GamesTestApp, identifier: string, opts: { mod?: boolean } = {}): Promise<Client> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  let session = SessionSchema.parse(res.body.data)
  if (opts.mod) {
    const m = await agent.post('/api/session/mode').set('X-CSRF-Token', session.csrf).send({ mode: 'mod_pelajar' })
    expect(m.status, JSON.stringify(m.body)).toBe(200)
    session = SessionSchema.parse(m.body.data)
  }
  const csrf = session.csrf
  const withCsrf = (r: request.Test) => r.set('X-CSRF-Token', csrf)
  return {
    csrf,
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => withCsrf(agent.post(url)).send(body as object),
    put: (url, body) => withCsrf(agent.put(url)).send(body as object),
    patch: (url, body) => withCsrf(agent.patch(url)).send(body as object),
    delete: (url) => withCsrf(agent.delete(url)),
    noCsrf: {
      post: (url, body) => agent.post(url).send(body as object),
      put: (url, body) => agent.put(url).send(body as object),
      patch: (url, body) => agent.patch(url).send(body as object),
      delete: (url) => agent.delete(url),
    },
  }
}

/* ------------------------------------------------------------------------------------ questions */

export interface McqInsertOptions {
  /** Curriculum subject code (BE-08 seed): MATH, BM, BI, SCI, SEJ, ... */
  subject: string
  /** Education-level code: D1..D6, T1..T5. */
  level: string
  count: number
  /** Difficulty TP 1..6: a number, or a function of the zero-based index (default: cycles 1..4). */
  difficultyTp?: number | ((index: number) => number)
  /** Unique label prefix (the `number_label`); default `GM`. Use another prefix for a second batch. */
  prefix?: string
  /** `published` (default) is servable; `draft` is not. */
  status?: 'published' | 'draft'
  /** Number of options (2..4, default 4). */
  options?: number
}

export interface InsertedMcq {
  id: string
  /** Zero-based index of the correct option (oracle for tests). */
  keyIndex: number
  difficultyTp: number
  text: string
  optionTexts: string[]
}

/**
 * Inserts published single-part MCQ questions (fictitious text) straight into the question tables, the way the
 * questions seed does, so tests can have 40+ questions for one subject and level or 15 across difficulties.
 * The option order is fixed; the key rotates A, B, C, D by index.
 */
export async function insertMcqQuestions(db: TestDatabase, opts: McqInsertOptions): Promise<InsertedMcq[]> {
  const prefix = opts.prefix ?? 'GM'
  const status = opts.status ?? 'published'
  const optionCount = opts.options ?? 4
  const out: InsertedMcq[] = []
  const now = new Date(START)
  await db.prisma.$transaction(
    async (tx) => {
      const subject = await tx.subject.findUnique({ where: { code: opts.subject } })
      const level = await tx.educationLevel.findUnique({ where: { code: opts.level } })
      const owner = await tx.userRole.findFirst({ where: { role: 'admin' }, orderBy: { userId: 'asc' } })
      if (!subject || !level || !owner) throw new Error(`insertMcqQuestions: unknown subject ${opts.subject}, level ${opts.level} or no admin`)
      for (let i = 0; i < opts.count; i++) {
        const tp = typeof opts.difficultyTp === 'function' ? opts.difficultyTp(i) : (opts.difficultyTp ?? (i % 4) + 1)
        const label = `${prefix}-${opts.subject}-${opts.level}-${String(i + 1).padStart(3, '0')}`
        const text = `Soalan permainan contoh ${label}`
        const keyIndex = i % optionCount
        const published = status === 'published'
        const question = await tx.question.create({
          data: { sourceType: 'manual', createdById: owner.userId, latestVersionNo: 1, liveVersionNo: published ? 1 : null, isActive: true, createdAt: now, updatedAt: now },
        })
        const version = await tx.questionVersion.create({
          data: {
            questionId: question.id, versionNo: 1, status, publishedAt: published ? now : null, type: 'mcq', stemMs: text, numberLabel: label,
            language: 'ms', subjectId: subject.id, educationLevelId: level.id, formOrigin: 't4', difficultyTp: tp,
            sourceKind: 'publisher', rightsStatus: 'own', createdAt: now, updatedAt: now,
          },
        })
        const part = await tx.questionPart.create({
          data: {
            questionVersionId: version.id, parentPartId: null, position: 1, depth: 1, label: '', promptMs: text, marks: 1, mode: 'mcq', reveal: 'after_submit',
          },
        })
        const optionTexts = Array.from({ length: optionCount }, (_, k) => `Pilihan ${'ABCD'[k] as string} ${label}`)
        await tx.partOption.createMany({
          data: optionTexts.map((bodyMs, k) => ({ partId: part.id, label: 'ABCD'[k] as string, bodyMs, position: k + 1 })),
        })
        const key = { kind: 'option', correct: 'ABCD'[keyIndex] as string }
        await tx.answerKey.create({ data: { partId: part.id, kind: 'option', content: key } })
        out.push({ id: String(question.id), keyIndex, difficultyTp: tp, text, optionTexts })
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  )
  return out
}
