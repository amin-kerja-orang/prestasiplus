import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { QuestionPart } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { identitySeed } from '../../../prisma/seed/core/identity'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { questionsSeed } from '../../../prisma/seed/questions'
import { defineAppModule } from '../../../src/app.module'
import { configureApp } from '../../../src/configure-app'
import { CLOCK, FixedClock } from '../../../src/db/clock'
import { AuthModule } from '../../../src/modules/auth'
import { PracticeTargetsStructuredModule } from '../../../src/modules/practice/reads/writes/writes.module'
import { QuestionsService } from '../../../src/modules/questions'
import { adminActor, mcqInput, rich, tagBody, tagOf } from '../../questions/fixtures'
import { createTestDatabase, type TestDatabase } from '../../support/db'
import { DEMO_PASSWORD, dropDatabase, loginAs as loginWithIdentifier, type Client } from '../../curriculum/helpers'

export { dropDatabase, expectCsrfInvalid, expectError, type Client } from '../../curriculum/helpers'
export const START = '2026-10-19T09:00:00+08:00'

export interface WritesTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

/** Nest app with auth + the BE-13 writes module on a private migrated database seeded with identity, curriculum and questions. */
export async function bootWritesApp(opts: { env?: Record<string, string> } = {}): Promise<WritesTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed, questionsSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    // The clock is frozen, so a window never ends: lift both write limits unless a test asks for a low one.
    THROTTLE_SPM_TARGETS_WRITE_PER_MINUTE: '100000',
    THROTTLE_STRUCTURED_ATTEMPT_PER_MINUTE: '100000',
    ...opts.env,
  })
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, PracticeTargetsStructuredModule])] })
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
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await dropDatabase(db)
    },
  }
}

export const ACCOUNTS = {
  admin: 'admin@demo.test',
  teacher: 'guru@demo.test',
  student: 'pelajar@demo.test',
  student2: 'pelajarmaju@demo.test',
} as const

export const loginAs = (t: WritesTestApp, who: keyof typeof ACCOUNTS | string): Promise<Client> =>
  loginWithIdentifier(t as never, (ACCOUNTS as Record<string, string>)[who] ?? who)

/** Logs in and switches on Mod Pelajar (`POST /session/mode`); the CSRF token rotates with the session. */
export async function loginModPelajar(t: WritesTestApp, identifier: string): Promise<Client> {
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

export async function subjectIdOf(db: TestDatabase, code: string): Promise<string> {
  const row = (await db.query<{ id: string }>('select id::text id from subjects where code = $1', [code]))[0]
  if (!row) throw new Error(`no subject ${code}`)
  return row.id
}

export async function userIdOf(db: TestDatabase, email: string): Promise<string> {
  const row = (await db.query<{ id: string }>('select id::text id from users where email = $1', [email]))[0]
  if (!row) throw new Error(`no user ${email}`)
  return row.id
}

/** Decimal id of a seeded question by its `number_label`. */
export async function seededQuestion(db: TestDatabase, ref: string): Promise<string> {
  const row = (await db.query<{ id: string }>('select question_id::text id from question_versions where number_label = $1', [ref]))[0]
  if (!row) throw new Error(`no seeded question ${ref}`)
  return row.id
}

/** A leaf `short_text` part with the given marks. */
export const leaf = (label: string, marks: number): QuestionPart =>
  ({ label, prompt: rich(`Soalan ${label}`), mode: 'short_text', marks, key: { kind: 'accepted', values: [`jawapan ${label}`] } }) as QuestionPart

/**
 * Publishes one structured set through the real question service. `seedRef` borrows the curriculum tag
 * (unit and SP) of a seeded question of the same subject and level.
 */
export async function publishStructured(
  t: WritesTestApp,
  seedRef: string,
  opts: { stem: string; parts?: QuestionPart[]; cognitive?: number } ,
): Promise<string> {
  const svc = t.app.get(QuestionsService)
  const tag = await tagOf(t.db, seedRef)
  const admin = await adminActor(t.db)
  const q = await svc.create(
    mcqInput(tag, {
      questionType: 'essay',
      questionText: opts.stem,
      status: 'approved',
      tag: tagBody(tag, 3),
      parts: opts.parts ?? [leaf('(a)', 2), leaf('(b)', 3)],
    }),
    admin,
  )
  if (opts.cognitive !== undefined) await t.db.query('update question_versions set cognitive_level = $1 where question_id = $2', [opts.cognitive, q.id])
  return q.id
}

export const csrfHeader = (c: Client): Record<string, string> => ({ 'X-CSRF-Token': c.csrf })
