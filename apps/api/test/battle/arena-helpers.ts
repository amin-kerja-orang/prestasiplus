/**
 * Boot and fixtures of the queue / invitation / forfeit / arena / lobby specs (BE-44): the real Nest app (auth + battle)
 * on a private migrated database seeded with identity, schools, population, curriculum and the question bank, a
 * recording M14 port, and published MCQs added straight to the tables (the bank seed has only six).
 */
import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { SessionSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { PrismaService } from '../../src/db/prisma.service'
import { BattleDeps } from '../../src/modules/battle/battle.deps'
import { AuthModule } from '../../src/modules/auth'
import { BattleModule } from '../../src/modules/battle'
import { GamesPorts, type GameResultOutcome, type GameRewardsPort } from '../../src/modules/games'
import { loginAs, START, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { START }

/** The database of the app this spec file booted (one per file). */
let entries: TestDatabase

/** What a battle reported to the rewards port (FR-GM-00.3). */
export interface GameResultReport {
  userId: string
  game: string
  event: string
  coins: number | undefined
  xp: number
  correct: number | undefined
  total: number | undefined
  session: string | undefined
}

export interface BattleTestApp {
  db: TestDatabase
  clock: FixedClock
  reports: GameResultReport[]
  http(): TestAgent
  agent(): TestAgent
  get<T>(token: abstract new (...args: never[]) => T): T
  close(): Promise<void>
}

export interface Subjects {
  math: string
  sci: string
  bm: string
  t4: string
  t5: string
}

/** Boots the app; `questions` = how many published MCQs per (MATH, T4) / (SCI, T4) to add (default 12). */
export async function bootBattleApp(opts: { env?: Record<string, string | undefined> } = {}): Promise<BattleTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, populationSeed, curriculumSeed, questionsSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_BATTLE_READ_PER_MINUTE: '100000',
    THROTTLE_BATTLE_WRITE_PER_MINUTE: '100000',
    THROTTLE_BATTLE_POLL_PER_MINUTE: '100000',
    THROTTLE_BATTLE_SEARCH_PER_MINUTE: '100000',
    PUBLIC_BASE_URL: 'https://app.example.test',
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
  const reports: GameResultReport[] = []
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, BattleModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  // A double that records each report and keeps the first result per session and pupil (the real one: rewards-binding.spec).
  const first = new Map<string, GameResultOutcome>()
  const rewards: GameRewardsPort = {
    canEarnSyiling: async () => true,
    tierRates: async () => ({ correct: 0, win: 0 }),
    onGameResult: async (userId, input) => {
      reports.push({ userId, game: input.game, event: input.event, coins: input.coins, xp: input.xp, correct: input.correct, total: input.total, session: input.session?.id })
      const out = { coinsCredited: input.coins ?? 0, xpAdded: input.xp, cappedReason: null }
      first.set(`${input.session?.id ?? ''}:${userId}`, out)
      return out
    },
    firstGameResult: async (sessionId, userId) => first.get(`${sessionId}:${userId}`) ?? null,
  }
  app.get(GamesPorts, { strict: false }).provideRewards(rewards)
  await app.init()
  entries = db
  // Most specs answer on a frozen clock; the pace guard has its own spec (game-rules.spec).
  await db.query(`update gamification_settings set value = 0 where key = 'games_min_ms_per_answer'`)
  return {
    db,
    clock,
    reports,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    get: <T>(token: abstract new (...args: never[]) => T): T => app.get(token as never, { strict: false }),
    async close() {
      // Every connection must be closed before the database is dropped (DROP ... FORCE would kill an open one and
      // pg would report 57P01 as an unhandled error): the app's own client first, then the seed client and the query pool.
      const prisma = app.get(PrismaService, { strict: false })
      await app.close()
      await prisma.$disconnect()
      await new Promise((resolve) => setTimeout(resolve, 25))
      await db.drop()
    },
  }
}

export interface Client {
  who: LoggedIn
  id: string
  get(path: string): Promise<Response>
  post(path: string, body?: object): Promise<Response>
}

export async function client(t: BattleTestApp, identifier: string, opts: { modPelajar?: boolean } = {}): Promise<Client> {
  const who = await loginAs(t as never, identifier)
  let csrf = who.csrf
  if (opts.modPelajar) {
    const res = await who.agent.post('/api/session/mode').set('X-CSRF-Token', csrf).send({ mode: 'mod_pelajar' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    csrf = SessionSchema.parse(res.body.data).csrf
  }
  const id = (await t.db.query<{ id: string }>(`select id::text from users where lower(email) = lower($1)`, [identifier]))[0]?.id as string
  return {
    who,
    id,
    get: (path) => who.agent.get(`/api${path}`),
    post: (path, body = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', csrf).send(body),
  }
}

export async function subjectsOf(t: BattleTestApp): Promise<Subjects> {
  const one = async (sql: string): Promise<string> => (await t.db.query<{ id: string }>(sql))[0]?.id as string
  return {
    math: await one(`select id::text from subjects where code = 'MATH'`),
    sci: await one(`select id::text from subjects where code = 'SCI'`),
    bm: await one(`select id::text from subjects where code = 'BM'`),
    t4: await one(`select id::text from education_levels where code = 'T4'`),
    t5: await one(`select id::text from education_levels where code = 'T5'`),
  }
}

let counter = 0

/**
 * Adds `n` published, active single-answer MCQs (right option B, label index 1) of a subject and level. R1-B06: a question is in
 * the SPM pool by what it is (an offered level T4/T5 of a linked subject), not by a tag, so there is no `spm` option.
 */
export async function addMcqs(t: BattleTestApp, subjectId: string, levelId: string, n: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    counter += 1
    const q = await t.db.prisma.question.create({
      data: {
        sourceType: 'manual',
        latestVersionNo: 1,
        liveVersionNo: 1,
        isActive: true,
      },
    })
    const v = await t.db.prisma.questionVersion.create({
      data: {
        questionId: q.id,
        versionNo: 1,
        status: 'approved',
        publishedAt: new Date(START),
        type: 'mcq',
        stemMs: `Soalan battle ujian ${counter}`,
        numberLabel: `BT-${counter}`,
        language: 'ms',
        subjectId: BigInt(subjectId),
        educationLevelId: BigInt(levelId),
        formOrigin: 't4',
        sourceKind: 'publisher',
        rightsStatus: 'own',
      },
    })
    const part = await t.db.prisma.questionPart.create({
      data: { questionVersionId: v.id, position: 1, depth: 1, label: '1', promptMs: `Soalan battle ujian ${counter}`, marks: 1, mode: 'mcq', reveal: 'after_submit' },
    })
    await t.db.prisma.partOption.createMany({
      data: ['Satu', 'Dua', 'Tiga', 'Empat'].map((body, j) => ({ partId: part.id, label: 'ABCD'[j] as string, bodyMs: body, position: j + 1 })),
    })
    await t.db.prisma.answerKey.create({ data: { partId: part.id, kind: 'option', content: { kind: 'option', correct: 'B' } } })
    ids.push(String(q.id))
  }
  t.get(BattleDeps).invalidateCache()
  return ids
}

/** Students of the population seed by grade (fictitious). */
export const STUDENT_G10 = 'pelajar@demo.test'
export const STUDENT_G10_B = 'pelajar2@demo.test'
export const STUDENT_G11 = 'pelajarmaju@demo.test'

/** Parses a response body with its contract schema (fails the test with the body when it does not match). */
export function parse<T>(schema: { parse(v: unknown): T }, res: Response): T {
  try {
    return schema.parse(res.body)
  } catch (e) {
    throw new Error(`response ${res.status} does not match its schema: ${JSON.stringify(res.body)} (${String(e)})`)
  }
}

export const QUICK = '/battle/quick-match'

/** Starts a quick-match queue of `owner` (biasa MATH) and returns its id. */
export async function startQueue(owner: Client, subjectId: string, over: Record<string, unknown> = {}, path = QUICK): Promise<string> {
  const res = await owner.post(path, { question_type: 'biasa', subject_id: subjectId, ...over })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.queue_id as string
}

/** Polls three times: the third poll matches a bot. Returns the battle uuid. */
export async function matchBot(owner: Client, queueId: string): Promise<string> {
  // The entry has waited `battle_bot_fallback_seconds` (48 GAME-01), without moving the clock of the test.
  await entries.query(`update battle_queues set created_at = created_at - interval '30 seconds' where id = $1`, [queueId])
  let last: Response | null = null
  last = await owner.get(`/battle/poll-match/${queueId}`)
  expect((last as Response).body.status, JSON.stringify((last as Response).body)).toBe('matched')
  return (last as Response).body.battle_uuid as string
}

/** A quick-match battle of `owner` against a bot. */
export async function botBattle(owner: Client, subjectId: string): Promise<string> {
  return matchBot(owner, await startQueue(owner, subjectId))
}

/** Parses an `{ data }` envelope response: the body has only `data`, and `data` matches the schema. */
export function parseData<T>(schema: { parse(v: unknown): T }, res: Response): T {
  expect(Object.keys(res.body as object), JSON.stringify(res.body)).toEqual(['data'])
  return parse(schema, { body: res.body.data, status: res.status } as Response)
}
