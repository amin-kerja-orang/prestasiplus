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
import { BijakPapersModule, BijakPapersPorts, bijakCodeOf, type BijakPoolSource, type BijakQuestionSource } from '../../src/modules/bijak/papers'
import { CompositeBijakPoolSource } from '../../src/modules/bijak/question-bridge/pool-composite'
import type { BijakServedSource } from '../../src/modules/bijak/papers'
import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import type { QuestionFacts } from '@pp/exam-core'
import { ExamBlueprintsModule } from '../../src/modules/exam/blueprints'
import { BijakBuilderPorts, type BuilderQuestionSource, ExamBuilderModule, QuestionBankBuilderSource } from '../../src/modules/exam/builder'
import { PocBuilderQuestionSource } from '../../src/modules/exam/builder/poc-builder-source'
import { questionsSeed } from '../../prisma/seed/questions'
import { createTestDatabase, type TestDatabase } from '../support/db'

export const DEMO_PASSWORD = 'Demo1234'
export const START = '2026-10-19T09:00:00+08:00'

/** Demo accounts of the identity seed (fictitious). */
export const ACCOUNTS = {
  admin: 'admin@demo.test',
  schoolAdmin: 'adminsekolah@demo.test',
  teacher: 'guru@demo.test',
  student: 'pelajar@demo.test',
} as const

export interface BuilderTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  builderPorts: BijakBuilderPorts
  papersPorts: BijakPapersPorts
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  /** Paper builder question port (default: the PoC fixture). */
  builderSource?: BuilderQuestionSource
  /** Keep the production BE-09 backed source (the wired-bank spec); also seeds the question bank. */
  realBank?: boolean
  /** BE-15 student-side question port (default: the PoC fixture). Pass the same fake to keep both sides in step. */
  papersSource?: BijakQuestionSource
  /** Environment overrides for this app (rate limits). */
  env?: Record<string, string>
  /**
   * Pool source of the standard check (a placed question missing from it is a Terbit blocker). `'builder-source'` derives the facts of the
   * candidates of the builder source (a fake bank), `'bank'` is the production BE-09 pool. Default: the PoC fixture pool.
   */
  pool?: 'builder-source' | 'bank'
}

/** Facts of every candidate of a builder question source, as the production pool would give them (no content, a key, one unit). */
export function poolFromBuilderSource(source: BuilderQuestionSource): BijakPoolSource {
  return {
    async candidates(scope) {
      const ids = await source.candidates({ subject: bijakCodeOf(scope.subjectCode), kertas: scope.kertas })
      const infos = await source.describe(ids.map((id) => ({ id })))
      const groups = await source.groups([...new Set([...infos.values()].flatMap((i) => (i.groupId ? [i.groupId] : [])))])
      return ids.flatMap((id): QuestionFacts[] => {
        const q = infos.get(id)
        if (!q) return []
        const members = q.groupId ? (groups.get(q.groupId)?.questionIds ?? [id]) : []
        return [
          {
            id,
            groupId: q.groupId,
            groupPosition: q.groupId ? members.indexOf(id) + 1 || 1 : null,
            ...(q.groupId ? { groupSize: members.length } : {}),
            versionNo: q.versionNo,
            tagReview: false,
            unit: { nodeId: '9001', level: 'T4' as const, code: '1.0' },
            formOrigin: 't4' as const,
            // tagged for every section of the scope, so the pool-membership note stays out of the way
            pools: ['A', 'B', 'C', 'D', 'E'].map((x) => `${bijakCodeOf(scope.subjectCode)}${String(scope.kertas)}-${x}`),
            leaves: [{ marks: q.marks, mode: 'mcq', tp: 2, kbat: false, hasKey: true, unit: { nodeId: '9001', level: 'T4' as const, code: '1.0' } }],
          },
        ]
      })
    },
    async seen() {
      return new Set<string>()
    },
  }
}

/**
 * Nest app with auth, the BE-15 papers module and the BE-39 builder and blueprint modules on a private
 * database seeded with identity, curriculum and exam (the four PoC blueprints and papers).
 */
export async function bootBuilderApp(opts: BootOptions = {}): Promise<BuilderTestApp> {
  const db = await createTestDatabase()
  await runSeeds(opts.realBank ? [identitySeed, curriculumSeed, questionsSeed, examSeed] : [identitySeed, curriculumSeed, examSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    // Volume ceilings are raised so a test file can call freely; the rate-limit test lowers its own.
    THROTTLE_BIJAK_GENERATE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_GENERATE_PER_MINUTE: '100000',
    ...opts.env,
  })
  const clock = new FixedClock(START)
  // `ExamBuilderModule.onModuleInit` registers the BE-09 backed source once; the tests replace that provider.
  const builder = Test.createTestingModule({
    imports: [defineAppModule([AuthModule, BijakPapersModule, ExamBuilderModule, ExamBlueprintsModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
  if (!opts.realBank) builder.overrideProvider(QuestionBankBuilderSource).useValue(opts.builderSource ?? new PocBuilderQuestionSource())
  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  const builderPorts = app.get(BijakBuilderPorts)
  const papersPorts = app.get(BijakPapersPorts)
  if (opts.papersSource) papersPorts.provideQuestionSource(opts.papersSource)
  if (opts.pool === 'builder-source') papersPorts.providePoolSource(poolFromBuilderSource(opts.builderSource ?? new PocBuilderQuestionSource()))
  await app.init()
  if (opts.pool === 'bank') papersPorts.providePoolSource(new CompositeBijakPoolSource(null, app.get(QuestionsBijakPoolSource, { strict: false }), { servedQuestionIds: async () => new Set<string>() } as unknown as BijakServedSource))
  return {
    app,
    db,
    clock,
    builderPorts,
    papersPorts,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.prisma.$disconnect()
      await new Promise((resolve) => setTimeout(resolve, 200))
      await db.drop()
    },
  }
}

type Method = 'get' | 'post' | 'put' | 'delete'

export interface Client {
  csrf: string
  userId: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  put(url: string, body?: unknown): request.Test
  del(url: string): request.Test
  /** Multipart upload of one PNG-like file as field `file` (the Files API). */
  upload(url: string, file: Buffer): request.Test
  /** The same request without the CSRF header. */
  noCsrf(method: Method, url: string, body?: unknown): request.Test
  /** Enters Mod Pelajar (admin, school admin) and keeps the new CSRF token. */
  enterMod(): Promise<void>
}

export async function loginAs(t: BuilderTestApp, identifier: string): Promise<Client> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const withBody = (r: request.Test, body: unknown) => (body === undefined ? r : r.send(body as object))
  const client: Client = {
    csrf: session.csrf,
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => withBody(agent.post(url).set('X-CSRF-Token', client.csrf), body),
    put: (url, body) => withBody(agent.put(url).set('X-CSRF-Token', client.csrf), body),
    del: (url) => agent.delete(url).set('X-CSRF-Token', client.csrf),
    upload: (url, file) => agent.post(url).set('X-CSRF-Token', client.csrf).attach('file', file, { filename: 'rujukan.png', contentType: 'image/png' }),
    noCsrf: (method, url, body) => withBody(agent[method](url), body),
    async enterMod() {
      const r = await agent.post('/api/session/mode').set('X-CSRF-Token', client.csrf).send({ mode: 'mod_pelajar' })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      client.csrf = SessionSchema.parse(r.body.data).csrf
    },
  }
  return client
}

/** An anonymous agent (no session). */
export function anonymous(t: BuilderTestApp): TestAgent {
  return t.agent()
}

export function expectError(res: Response, code: string, status?: number, message?: string) {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(status ?? ERROR_STATUS[code as keyof typeof ERROR_STATUS])
  expect(parsed.error.code).toBe(code)
  if (message !== undefined) expect(parsed.error.message).toBe(message)
  return parsed.error
}

export const count = async (db: TestDatabase, sql: string, params: unknown[] = []): Promise<number> =>
  Number((await db.query<{ n: string }>(sql, params))[0]?.n)

/** Audit rows of one action, oldest first. */
export const auditRows = (db: TestDatabase, action: string) =>
  db.query<{ actor_user_id: string | null; target_type: string | null; target_id: string | null; detail: Record<string, unknown> | null; created_at: Date }>(
    `select actor_user_id::text, target_type, target_id, detail, created_at from audit_events where action = $1 order by id`,
    [action],
  )
