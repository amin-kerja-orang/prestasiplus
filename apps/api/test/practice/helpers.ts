import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { PracticeMode, StartSessionResponse } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import type { TxClient } from '../../src/db/client'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { idFromString } from '../../src/db/ids'
import type { Prng } from '../../src/db/prng'
import { AuthModule } from '../../src/modules/auth'
import {
  type AssignmentKind,
  type AssignmentResolution,
  PracticeModule,
  PracticePorts,
  type PracticeAssignmentSource,
  type PracticeQuestion,
  type PracticeQuestionSource,
  type PracticeRamalanSource,
  type PracticeRewardPort,
  type PracticeRewardResult,
  type PracticeSelection,
  type PracticeSessionCompleted,
  versionKey,
} from '../../src/modules/practice'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { DEMO_PASSWORD, chapterIdOf, dropDatabase, idOf, type Client } from '../curriculum/helpers'

export { chapterIdOf, dropDatabase, idOf, loginAs, type Client } from '../curriculum/helpers'
export { expectCsrfInvalid, expectError } from '../curriculum/helpers'
export const START = '2026-10-19T09:00:00+08:00'

/* ---------------------------------------------------------------------------------- fake bank */

export interface BankInit {
  subjectId: string
  levelId?: string | null
  chapterId?: string | null
  topicId?: string | null
  difficulty?: number | null
  spmPool?: boolean
  /** Zero-based index of the right option. */
  correct?: number
  options?: number
  text?: string
  explanation?: string | null
  contributor?: { name: string; profileUrl: string | null } | null
  hasDskp?: boolean
}

interface BankRow {
  versions: PracticeQuestion[]
  /** Version served to new sessions. */
  liveNo: number
  eligible: boolean
}

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/** In-memory stand-in for the BE-09 question source: versions, eligibility flags, SPM pool, chapters. */
export class FakeBank implements PracticeQuestionSource {
  private readonly rows = new Map<string, BankRow>()
  private next = 5000

  add(init: BankInit): string {
    const id = String(this.next++)
    const count = init.options ?? 4
    const correct = init.correct ?? 0
    const q: PracticeQuestion = {
      id,
      versionNo: 1,
      subjectId: init.subjectId,
      educationLevelId: init.levelId ?? null,
      chapterId: init.chapterId ?? null,
      topicId: init.topicId ?? null,
      difficulty: init.difficulty ?? null,
      questionType: 'mcq',
      spmPool: init.spmPool ?? false,
      questionText: init.text ?? `Soalan contoh ${id}`,
      textDirection: 'ltr',
      scriptType: 'rumi',
      hasDskp: init.hasDskp ?? init.chapterId != null,
      contributor: init.contributor ?? null,
      options: Array.from({ length: count }, (_, i) => ({ label: LABELS[i] as string, text: `Pilihan ${LABELS[i]} soalan ${id}` })),
      correctLabel: LABELS[correct] ?? 'A',
      explanation: init.explanation === undefined ? `Penjelasan soalan ${id}` : init.explanation,
    }
    this.rows.set(id, { versions: [q], liveNo: 1, eligible: true })
    return id
  }

  async spmServable(ids: readonly string[]): Promise<ReadonlySet<string>> {
    return new Set(ids.filter((id) => this.rows.get(id)?.eligible === true && this.get(id).spmPool))
  }

  /** Edits the question: a new version n+1 becomes the live one; older versions stay readable. */
  edit(id: string, patch: { correct?: number; text?: string; explanation?: string | null }): number {
    const row = this.row(id)
    const prev = row.versions[row.versions.length - 1] as PracticeQuestion
    const versionNo = prev.versionNo + 1
    row.versions.push({
      ...prev,
      versionNo,
      ...(patch.text !== undefined ? { questionText: patch.text } : {}),
      ...(patch.explanation !== undefined ? { explanation: patch.explanation } : {}),
      ...(patch.correct !== undefined ? { correctLabel: LABELS[patch.correct] ?? 'A' } : {}),
    })
    row.liveNo = versionNo
    return versionNo
  }

  /** Deactivated or unpublished: never served again. */
  deactivate(id: string): void {
    this.row(id).eligible = false
  }

  reactivate(id: string): void {
    this.row(id).eligible = true
  }

  /** The live version of a question (test oracle). */
  get(id: string): PracticeQuestion {
    const row = this.row(id)
    return row.versions[row.liveNo - 1] as PracticeQuestion
  }

  /** Index of the right option in the live version. */
  correctIndex(id: string): number {
    const q = this.get(id)
    return q.options.findIndex((o) => o.label === q.correctLabel)
  }

  /** Empties the bank (ids keep counting up, so an old id never comes back). */
  reset(): void {
    this.rows.clear()
  }

  /** Counters of calls, for the tests that assert what was asked of the source. */
  readonly calls = { sample: 0, live: 0, versions: 0 }

  private row(id: string): BankRow {
    const row = this.rows.get(id)
    if (!row) throw new Error(`fake bank: unknown question ${id}`)
    return row
  }

  private eligibleIds(): string[] {
    return [...this.rows.entries()]
      .filter(([, r]) => r.eligible)
      .map(([id]) => id)
      .sort((a, b) => Number(BigInt(a) - BigInt(b)))
  }

  async sample(filter: PracticeSelection, n: number, rng: Prng): Promise<string[]> {
    this.calls.sample += 1
    const ids = this.eligibleIds().filter((id) => {
      const q = this.get(id)
      if (q.subjectId !== filter.subjectId) return false
      if (filter.educationLevelIds && !(q.educationLevelId && filter.educationLevelIds.includes(q.educationLevelId))) return false
      if (filter.difficulty !== undefined && q.difficulty !== filter.difficulty) return false
      if (filter.spmPool !== undefined && q.spmPool !== filter.spmPool) return false
      return true
    })
    // Fisher-Yates over the ascending list with the seeded stream, like QuestionsRepository.sample.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = rng.int(0, i)
      const tmp = ids[i] as string
      ids[i] = ids[j] as string
      ids[j] = tmp
    }
    return ids.slice(0, n)
  }

  async chapterCounts(chapterIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const out = new Map<string, number>()
    for (const c of new Set(chapterIds)) {
      const n = this.eligibleIds().filter((id) => this.get(id).chapterId === c).length
      if (n > 0) out.set(c, n)
    }
    return out
  }

  async chapterPage(chapterId: string, excludeIds: readonly string[], limit: number): Promise<string[]> {
    const skip = new Set(excludeIds)
    return this.eligibleIds()
      .filter((id) => this.get(id).chapterId === chapterId && !skip.has(id))
      .slice(0, limit)
  }

  async live(ids: readonly string[]): Promise<ReadonlyMap<string, PracticeQuestion>> {
    this.calls.live += 1
    const out = new Map<string, PracticeQuestion>()
    for (const id of ids) {
      const row = this.rows.get(id)
      if (row?.eligible) out.set(id, row.versions[row.liveNo - 1] as PracticeQuestion)
    }
    return out
  }

  async versions(refs: readonly { questionId: string; versionNo: number }[]): Promise<ReadonlyMap<string, PracticeQuestion>> {
    this.calls.versions += 1
    const out = new Map<string, PracticeQuestion>()
    for (const r of refs) {
      const q = this.rows.get(r.questionId)?.versions[r.versionNo - 1]
      if (q) out.set(versionKey(r.questionId, r.versionNo), q)
    }
    return out
  }
}

/* ------------------------------------------------------------------------------ other fakes */

export class FakeReward implements PracticeRewardPort {
  readonly calls: PracticeSessionCompleted[] = []
  /** Set to make the next calls throw (AC 1: a failing reward rolls the submit back). */
  failWith: Error | null = null
  /** True: the port writes a notification row through the transaction (proof that its writes roll back with the submit). */
  marker = false
  result: PracticeRewardResult = { coinsEarned: 7, streakCount: 3, totalBalance: 120 }
  /** Rows the fake "wallet" wrote through the transaction, to prove they roll back with the submit. */
  async onSessionCompleted(input: PracticeSessionCompleted, tx: TxClient): Promise<PracticeRewardResult> {
    this.calls.push(input)
    // A real adapter writes through `tx`; the marker proves the reward step ran inside the transaction.
    if (this.marker) {
      await tx.$executeRaw`INSERT INTO notifications (user_id, type, title, body) VALUES (${BigInt(input.userId)}::bigint, 'spaced_review', 'Ganjaran', 'Penanda ujian')`
    } else {
      await tx.$executeRaw`SELECT 1`
    }
    if (this.failWith) throw this.failWith
    return this.result
  }
}

export class FakeAssignments implements PracticeAssignmentSource {
  readonly items = new Map<string, AssignmentResolution>()
  readonly remedialCalls: { remedialTestId: string; userId: string; afterAccuracy: number; completedAt: Date; isTest: boolean }[] = []
  failRemedial: Error | null = null
  set(kind: AssignmentKind, id: string, value: AssignmentResolution): void {
    this.items.set(`${kind}:${id}`, value)
  }
  async resolve(kind: AssignmentKind, input: { userId: string; id: string; at: Date }): Promise<AssignmentResolution> {
    return this.items.get(`${kind}:${input.id}`) ?? { status: 'not_found' }
  }
  async remedialCompleted(input: (typeof this.remedialCalls)[number]): Promise<void> {
    this.remedialCalls.push(input)
    if (this.failRemedial) throw this.failRemedial
  }
}

export class FakeRamalan implements PracticeRamalanSource {
  readonly sets = new Map<string, string[]>()
  set(subjectId: string, year: number, setNo: number, ids: string[]): void {
    this.sets.set(`${subjectId}:${String(year)}:${String(setNo)}`, ids)
  }
  async ramalanQuestionIds(subjectId: string, year: number, setNo: number): Promise<string[] | null> {
    return this.sets.get(`${subjectId}:${String(year)}:${String(setNo)}`) ?? null
  }
}

/* ------------------------------------------------------------------------------------- app */

export interface PracticeTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  bank: FakeBank
  reward: FakeReward
  assignments: FakeAssignments
  ramalan: FakeRamalan
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  /** Keep the real defaults of a port instead of the fake (the default-port tests). */
  defaults?: { assignments?: boolean; ramalan?: boolean; reward?: boolean; questions?: boolean }
  env?: Record<string, string>
  db?: TestDatabase
  /** Extra seeds run after identity + curriculum. */
  seeds?: SeedModule[]
}

/** Nest app with auth + practice (and the curriculum and subscriptions it needs) on a private seeded database. */
export async function bootPracticeApp(opts: BootOptions = {}): Promise<PracticeTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) await runSeeds([identitySeed, curriculumSeed, ...(opts.seeds ?? [])], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    // The clock is frozen, so a window never ends: lift the write limit unless a test asks for a low one.
    THROTTLE_PRACTICE_WRITE_PER_MINUTE: '100000',
    ...opts.env,
  })
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, PracticeModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  const bank = new FakeBank()
  const reward = new FakeReward()
  const assignments = new FakeAssignments()
  const ramalan = new FakeRamalan()
  const ports = app.get(PracticePorts)
  if (!opts.defaults?.questions) ports.provideQuestions(bank)
  if (!opts.defaults?.assignments) ports.provideAssignments(assignments)
  if (!opts.defaults?.ramalan) ports.provideRamalan(ramalan)
  if (!opts.defaults?.reward) ports.provideReward(reward)
  await app.init()
  return {
    app,
    db,
    clock,
    bank,
    reward,
    assignments,
    ramalan,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      if (!opts.db) await dropDatabase(db)
    },
  }
}

/* ---------------------------------------------------------------------------------- fixtures */

export interface World {
  /** Subject ids by code. */
  subject: { math: string; sej: string; bm: string; addmath: string }
  /** Level ids by code. */
  level: { d1: string; d2: string; t4: string; t3: string }
  /** MATH T4 chapters 1, 2, 3 (ids; T4 is the first offered level `d1` of the pre-secondary-only fixtures). */
  chapter: { c1: string; c2: string; c3: string }
}

export async function loadWorld(db: TestDatabase): Promise<World> {
  return {
    subject: {
      math: await idOf(db, 'subjects', 'MATH'),
      sej: await idOf(db, 'subjects', 'SEJ'),
      bm: await idOf(db, 'subjects', 'BM'),
      addmath: await idOf(db, 'subjects', 'ADDMATH'),
    },
    // Secondary-only (2026-10-29): d1 and d2 name the OFFERED levels T4 and T5 (BR-11); t3 is a level that is not offered.
    level: { d1: await idOf(db, 'education_levels', 'T4'), d2: await idOf(db, 'education_levels', 'T5'), t4: await idOf(db, 'education_levels', 'T4'), t3: await idOf(db, 'education_levels', 'T3') },
    chapter: {
      c1: await chapterIdOf(db, 'MATH', 'T4', 1),
      c2: await chapterIdOf(db, 'MATH', 'T4', 2),
      c3: await chapterIdOf(db, 'MATH', 'T4', 3),
    },
  }
}

/** Fills the bank: `n` MATH D1 questions per chapter 1 to 3, `random` MATH D1 questions without chapter, SPM pool rows. */
export function fillBank(bank: FakeBank, w: World, opts: { perChapter?: number; random?: number; spm?: number } = {}) {
  const perChapter = opts.perChapter ?? 6
  const chapters = {
    c1: [] as string[],
    c2: [] as string[],
    c3: [] as string[],
  }
  for (const key of ['c1', 'c2', 'c3'] as const) {
    for (let i = 0; i < perChapter; i++) {
      chapters[key].push(bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter[key], difficulty: (i % 5) + 1, correct: i % 4 }))
    }
  }
  const random: string[] = []
  for (let i = 0; i < (opts.random ?? 12); i++) {
    random.push(bank.add({ subjectId: w.subject.math, levelId: w.level.d1, difficulty: (i % 5) + 1, correct: i % 4 }))
  }
  const spm: string[] = []
  for (let i = 0; i < (opts.spm ?? 12); i++) {
    spm.push(bank.add({ subjectId: w.subject.sej, levelId: w.level.t4, difficulty: (i % 4) + 2, spmPool: true, correct: i % 4 }))
  }
  return { chapters, random, spm }
}

/* ------------------------------------------------------------------------------------ flows */

export interface Started {
  sessionId: string
  questions: StartSessionResponse['questions']
  body: StartSessionResponse
}

export async function startSession(c: Client, body: Record<string, unknown>): Promise<Started> {
  const res = await c.post('/api/practice/sessions', body)
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  const data = res.body.data as StartSessionResponse
  return { sessionId: data.sessionId, questions: data.questions, body: data }
}

/** Posts one check; `right` picks the right option, otherwise the next one (wrong). */
export function checkAnswer(c: Client, sessionId: string, bank: FakeBank, questionId: string, right: boolean) {
  const key = bank.correctIndex(questionId)
  const count = bank.get(questionId).options.length
  return c.post(`/api/practice/sessions/${sessionId}/check-answer`, {
    questionId,
    selectedOptionId: right ? key : (key + 1) % count,
  })
}

/** Starts, checks every question (the first `correct` right) and submits. */
export async function play(
  c: Client,
  bank: FakeBank,
  startBody: Record<string, unknown>,
  correct: number,
  timeSpent: unknown = 120,
) {
  const started = await startSession(c, startBody)
  let i = 0
  for (const q of started.questions) {
    const res = await checkAnswer(c, started.sessionId, bank, q.id, i++ < correct)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
  }
  const submit = await c.post(`/api/practice/sessions/${started.sessionId}/submit`, { timeSpent })
  return { started, submit }
}

/** Clears everything the practice write path wrote (tests share one database per file). */
export async function resetPractice(db: TestDatabase): Promise<void> {
  await db.query('delete from practice_sessions')
  await db.query('delete from practice_answers')
  await db.query('delete from revision_queue')
  await db.query('delete from mastery')
  await db.query('update users set trial_questions_used = 0')
}

export async function userIdByEmail(db: TestDatabase, email: string): Promise<string> {
  const rows = await db.query<{ id: string }>('select id::text from users where email = $1', [email])
  const row = rows[0]
  if (!row) throw new Error(`no user ${email}`)
  return row.id
}

export const trialUsed = async (db: TestDatabase, userId: string): Promise<number> =>
  Number((await db.query<{ n: number }>('select trial_questions_used as n from users where id = $1', [idFromString(userId)]))[0]?.n)

export const countRows = async (db: TestDatabase, table: string, where = 'true', params: unknown[] = []): Promise<number> =>
  Number((await db.query<{ n: string }>(`select count(*)::text as n from ${table} where ${where}`, params))[0]?.n)

/** Makes the user a complimentary student, so `isSubscribed` is true on the test clock. */
export async function makeSubscribed(db: TestDatabase, userId: string): Promise<void> {
  await db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-12-31') on conflict do nothing`, [userId])
}

/** Asserts a response carries no key that could leak the answer. */
export function expectNoAnswerKeys(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => expectNoAnswerKeys(v, `${path}[${String(i)}]`))
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      expect(/^(correct|explanation|answer)/i.test(k), `${path}.${k} must not be served`).toBe(false)
      expectNoAnswerKeys(v, `${path}.${k}`)
    }
  }
}

export type ModeName = PracticeMode

/** Logs in and switches on Mod Pelajar (`POST /session/mode`); the CSRF token rotates with the session. */
export async function loginModPelajar(t: PracticeTestApp, identifier: string): Promise<Client> {
  const agent = t.agent()
  const login = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(login.status, JSON.stringify(login.body)).toBe(200)
  const first = login.body.data as { csrf: string; user: { id: string } }
  const mode = await agent.post('/api/session/mode').set('X-CSRF-Token', first.csrf).send({ mode: 'mod_pelajar' })
  expect(mode.status, JSON.stringify(mode.body)).toBe(200)
  const csrf = (mode.body.data as { csrf?: string }).csrf ?? first.csrf
  const withCsrf = (r: request.Test) => r.set('X-CSRF-Token', csrf)
  return {
    csrf,
    userId: first.user.id,
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
