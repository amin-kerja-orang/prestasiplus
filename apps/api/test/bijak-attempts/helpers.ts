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
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { AttemptSweeper } from '../../src/modules/bijak/attempts/attempt-sweeper'
import { BijakAttemptsModule } from '../../src/modules/bijak/attempts'
import {
  BijakAttemptPorts,
  type BijakAttemptAggregateInput,
  type BijakAttemptAggregatePort,
  type BijakPaperSource,
  type BijakQuestionBundle,
  type BijakQuestionSource,
  type BijakRewardInput,
  type BijakRewardPort,
  type PaperResolution,
} from '../../src/modules/bijak/attempts/ports'
import { leavesOf, type PartAnswer } from '../../src/modules/bijak/attempts/exam-core.adapter'
import { BANK, PAPERS, subjectName } from '../../../../src/modules/m28-bijak-spm/data/registry'
import { createTestDatabase, type TestDatabase } from '../support/db'

export const DEMO_PASSWORD = 'Demo1234'
export const START = '2026-10-20T09:00:00+08:00'
export const MIN = 60_000

/** The PoC papers of the prototype under decimal paper ids (the API ids are bigint strings). */
export const PAPER = { matK1: '101', matK2: '102', sainsK2: '103', sejK2: '104', notEligible: '999' } as const
const SLUG: Record<string, string> = { [PAPER.matK1]: 'mat-k1-2025-a', [PAPER.matK2]: 'mat-k2-2025-a', [PAPER.sainsK2]: 'sn-k2-2025-a', [PAPER.sejK2]: 'sej-k2-2025-a' }

export class FakePaperSource implements BijakPaperSource {
  calls: { userId: string; paperId: string; isTest: boolean }[] = []
  async resolveForAttempt(input: { userId: string; paperId: string; isTest: boolean }): Promise<PaperResolution> {
    this.calls.push(input)
    if (input.paperId === PAPER.notEligible) return { ok: false, reason: 'not_eligible' }
    const def = PAPERS.find((p) => p.id === SLUG[input.paperId])
    if (!def) return { ok: false, reason: 'not_found' }
    return {
      ok: true,
      paper: {
        id: input.paperId,
        kind: 'pilihan',
        title: def.title,
        subject: def.subject,
        subjectName: subjectName(def.subject),
        kertas: def.kertas,
        code: def.code,
        durationMin: def.durationMin,
        sections: def.sections.map((s) => ({
          id: s.id,
          label: s.label,
          ...(s.instruction ? { instruction: s.instruction } : {}),
          ...(s.compulsory ? { compulsory: true } : {}),
          rule: s.rule,
          questionIds: [...s.questionIds],
        })),
      },
    }
  }
}

export class FakeQuestionSource implements BijakQuestionSource {
  loads = 0
  async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    this.loads += 1
    const out = new Map<string, BijakQuestionBundle>()
    for (const id of ids) {
      const q = BANK.questions.get(id)
      if (!q) continue
      const g = q.groupId ? BANK.groups.get(q.groupId) : undefined
      const leafIds = q.mcq ? [q.id] : leavesOf(q.parts ?? []).map((l) => l.id)
      out.set(id, {
        question: q,
        ...(g ? { group: { id: g.id, stimulus: BANK.stimuli.get(g.stimulusId)!, ...(g.optionBank ? { optionBank: g.optionBank } : {}) } } : {}),
        schemes: Object.fromEntries(leafIds.map((l) => [l, BANK.schemes.get(l)!])),
      })
    }
    return out
  }
}

export class SpyReward implements BijakRewardPort {
  calls: BijakRewardInput[] = []
  fail = false
  async award(input: BijakRewardInput): Promise<void> {
    this.calls.push(input)
    if (this.fail) throw new Error('wallet down')
  }
}

export class SpyAggregate implements BijakAttemptAggregatePort {
  calls: BijakAttemptAggregateInput[] = []
  async recordGraded(input: BijakAttemptAggregateInput): Promise<void> {
    this.calls.push(input)
  }
}

export interface AttemptsTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  papers: FakePaperSource
  questions: FakeQuestionSource
  reward: SpyReward
  aggregate: SpyAggregate
  sweeper: AttemptSweeper
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export async function bootAttemptsApp(env: Record<string, string | undefined> = {}, opts: { plugPorts?: boolean } = {}): Promise<AttemptsTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed], { prisma: db.prisma })
  const all: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
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
    BIJAK_SWEEP_INTERVAL_SECONDS: '0',
    UPLOAD_RATE_PER_MINUTE: '1000',
    FILE_STORAGE_DIR: undefined,
    ...env,
  }
  for (const [k, v] of Object.entries(all)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, BijakAttemptsModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  const ports = app.get(BijakAttemptPorts)
  const papers = new FakePaperSource()
  const questions = new FakeQuestionSource()
  const reward = new SpyReward()
  const aggregate = new SpyAggregate()
  if (opts.plugPorts !== false) {
    ports.providePaperSource(papers)
    ports.provideQuestionSource(questions)
    ports.provideReward(reward)
    ports.provideAggregate(aggregate)
  }
  await app.init()
  return {
    app,
    db,
    clock,
    papers,
    questions,
    reward,
    aggregate,
    sweeper: app.get(AttemptSweeper),
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export interface Client {
  csrf: string
  userId: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  put(url: string, body?: unknown): request.Test
  /** The same call without the CSRF header. */
  noCsrf: { post(url: string, body?: unknown): request.Test; put(url: string, body?: unknown): request.Test }
  /** Raw agent (multipart etc.). */
  agent: TestAgent
}

export async function loginAs(t: AttemptsTestApp, identifier: string, mod = false): Promise<Client> {
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
  const withCsrf = (r: request.Test) => r.set('X-CSRF-Token', csrf)
  return {
    csrf,
    userId: session.user.id,
    agent,
    get: (url) => agent.get(url),
    post: (url, body) => withCsrf(agent.post(url)).send(body as object),
    put: (url, body) => withCsrf(agent.put(url)).send(body as object),
    noCsrf: { post: (url, body) => agent.post(url).send(body as object), put: (url, body) => agent.put(url).send(body as object) },
  }
}

export function expectError(res: Response, code: keyof typeof ERROR_STATUS | 'NOT_SUBMITTED' | 'CSRF_INVALID', message?: string, status?: number) {
  const parsed = ErrorBodySchema.parse(res.body)
  const expected = status ?? (code === 'NOT_SUBMITTED' ? 409 : code === 'CSRF_INVALID' ? 403 : ERROR_STATUS[code as keyof typeof ERROR_STATUS])
  expect(res.status, JSON.stringify(res.body)).toBe(expected)
  expect(parsed.error.code).toBe(code)
  if (message !== undefined) expect(parsed.error.message).toBe(message)
  return parsed.error
}

export const STUDENT = 'pelajar@demo.test'
export const OTHER_STUDENT = 'pelajar2@demo.test'
export const TEACHER = 'guru@demo.test'
export const ADMIN = 'admin@demo.test'
export const SCHOOL_ADMIN = 'adminsekolah@demo.test'

/** An MCQ answer set helper: the correct choice of an MCQ question from the bank scheme. */
export function correctChoice(qid: string): string {
  const s = BANK.schemes.get(qid)
  if (!s || s.kind !== 'option') throw new Error(`not an mcq: ${qid}`)
  return s.correct
}

export const change = (partId: string, answer: PartAnswer, rev = 1, savedAt = START) => ({ partId, answer, rev, savedAt })

export interface StartedAttempt { attemptId: string }
export async function startAttempt(c: Client, paperId: string, mode: 'exam' | 'latihan' = 'exam', restart?: boolean): Promise<string> {
  const res = await c.post('/api/bijak/attempts', { paperId, mode, ...(restart ? { restart } : {}) })
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  return (res.body as { data: StartedAttempt }).data.attemptId
}

/** Question ids of a view, in paper order. */
export const questionIdsOfView = (view: { questions: { id: string }[] }): string[] => view.questions.map((q) => q.id)

/** The same JSON-key scan the reveal rules need: every key at any depth. */
export function allKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) allKeys(v, into)
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k)
      allKeys(v, into)
    }
  }
  return into
}
