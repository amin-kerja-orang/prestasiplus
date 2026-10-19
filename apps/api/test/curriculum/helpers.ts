import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema, ERROR_STATUS, SessionSchema, curriculumStatusEnvelopeOf, listEnvelopeOf, envelopeOf } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'
import type { z } from 'zod'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { CurriculumModule } from '../../src/modules/curriculum'
import { QUESTION_COUNT_PROVIDER, TOPIC_PROGRESS_PROVIDER } from '../../src/modules/curriculum/providers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export const DEMO_PASSWORD = 'Demo1234'
export const START = '2026-10-19T09:00:00+08:00'

export interface CurriculumTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  db?: TestDatabase
  /** Provider overrides (BE-13 and BE-09 stand-ins). */
  progress?: unknown
  questionCounts?: unknown
}

/** Nest app with the auth and curriculum modules on a private migrated and seeded database. */
export async function bootCurriculumApp(opts: BootOptions = {}): Promise<CurriculumTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) await runSeeds([identitySeed, curriculumSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
  })
  const clock = new FixedClock(START)
  let builder = Test.createTestingModule({ imports: [defineAppModule([AuthModule, CurriculumModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
  if (opts.progress) builder = builder.overrideProvider(TOPIC_PROGRESS_PROVIDER).useValue(opts.progress)
  if (opts.questionCounts) builder = builder.overrideProvider(QUESTION_COUNT_PROVIDER).useValue(opts.questionCounts)
  const moduleRef = await builder.compile()
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
  noCsrf: { post(url: string, body?: unknown): request.Test; put(url: string, body?: unknown): request.Test; patch(url: string, body?: unknown): request.Test; delete(url: string): request.Test }
}

/** Logs in with the demo password; mutating calls carry the CSRF token like the browser does. */
export async function loginAs(t: CurriculumTestApp, identifier: string): Promise<Client> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
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

/** Asserts a contract error body with the generic status table and, when given, the exact message. */
export function expectError(res: Response, code: keyof typeof ERROR_STATUS, message?: string) {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(ERROR_STATUS[code])
  expect(parsed.error.code).toBe(code)
  if (message !== undefined) expect(parsed.error.message).toBe(message)
  return parsed.error
}

export function expectCsrfInvalid(res: Response) {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(403)
  expect(parsed.error.code).toBe('CSRF_INVALID')
}

/** Parses `{ data }` with the contract schema and returns the parsed data. */
export function parseData<S extends z.ZodType>(res: Response, schema: S): z.output<S> {
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  return (envelopeOf(schema).parse(res.body) as { data: z.output<S> }).data
}

/** Parses a mutation response `{ data, status }` and returns both parts. */
export function parseStatus<S extends z.ZodType>(res: Response, schema: S, status?: number): { data: z.output<S>; status: string } {
  if (status !== undefined) expect(res.status, JSON.stringify(res.body)).toBe(status)
  return curriculumStatusEnvelopeOf(schema).parse(res.body) as { data: z.output<S>; status: string }
}

export function parseList<S extends z.ZodType>(res: Response, schema: S): z.output<S>[] {
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return listEnvelopeOf(schema).parse(res.body).data
}

/** Database id (decimal string) of a row by a unique code. */
export async function idOf(db: TestDatabase, table: 'subjects' | 'education_levels', code: string): Promise<string> {
  const rows = await db.query<{ id: string }>(`select id::text from ${table} where code = $1`, [code])
  const row = rows[0]
  if (!row) throw new Error(`${table} ${code} not found`)
  return row.id
}

/** Id of the in-tree chapter of subject + level with the given printed number. */
export async function chapterIdOf(db: TestDatabase, subject: string, level: string, chapterNumber: number): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `select c.id::text from chapters c join subjects s on s.id = c.subject_id join education_levels l on l.id = c.education_level_id
      where s.code = $1 and l.code = $2 and c.chapter_number = $3 and c.in_tree order by c.id limit 1`,
    [subject, level, chapterNumber],
  )
  const row = rows[0]
  if (!row) throw new Error(`chapter ${subject} ${level} ${chapterNumber} not found`)
  return row.id
}

export const count = async (db: TestDatabase, sql: string, params: unknown[] = []): Promise<number> =>
  Number((await db.query<{ n: string }>(sql, params))[0]?.n)

/**
 * Drops a test database. The Prisma pool ends its connections without awaiting them, and
 * `DROP DATABASE ... WITH (FORCE)` racing that shutdown can raise an unhandled "terminating
 * connection" error under a loaded run, so the client is disconnected and given a moment first.
 */
export async function dropDatabase(db: TestDatabase): Promise<void> {
  await db.prisma.$disconnect()
  await new Promise((resolve) => setTimeout(resolve, 200))
  await db.drop()
}
