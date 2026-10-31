import 'reflect-metadata'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { SessionSchema, type Session } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { featureModules } from '../../src/modules'
import { MAIL_PORT, type MailPort, type PasswordResetMail } from '../../src/modules/account/ports'
import { QuestionBankBuilderSource } from '../../src/modules/exam/builder'
import { PocBuilderQuestionSource } from '../support/poc/builder-source'
import { plugPocAttempts, plugPocPapers } from '../support/poc/plug'
import { conformanceEnv, CONFORMANCE_SEEDS, CONFORMANCE_START } from '../conformance/boot'
import { DEMO_PASSWORD } from '../conformance/accounts'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { DEMO_PASSWORD }
export const COOKIE_NAME = 'pp_session'

/** Records the reset mails so a test can redeem the token without reading a log. */
export class MailSpy implements MailPort {
  readonly sent: PasswordResetMail[] = []
  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.sent.push(mail)
    return Promise.resolve()
  }
  last(): PasswordResetMail {
    const m = this.sent.at(-1)
    if (!m) throw new Error('No mail was sent.')
    return m
  }
}

export interface SecurityApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  mail: MailSpy
  storageDir: string
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface SecurityBootOptions {
  /** Overrides on top of the conformance environment; `undefined` removes a key. */
  env?: Record<string, string | undefined>
  logStream?: NodeJS.WritableStream
}

/**
 * The whole API (every registered feature module) on a seeded private database, like the conformance
 * app, plus a mail spy and an optional log stream. Business behaviour is untouched.
 */
export async function bootSecurityApp(opts: SecurityBootOptions = {}): Promise<SecurityApp> {
  const db = await createTestDatabase()
  await runSeeds(CONFORMANCE_SEEDS, { prisma: db.prisma })
  const storageDir = await mkdtemp(join(tmpdir(), 'pp-security-'))
  for (const [k, v] of Object.entries({ ...conformanceEnv(db.url, storageDir), THROTTLE_GLOBAL_PER_MINUTE: '100000', ...opts.env })) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(CONFORMANCE_START)
  const mail = new MailSpy()
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule(featureModules, opts.logStream ? { logStream: opts.logStream } : {})],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(MAIL_PORT)
    .useValue(mail)
    .overrideProvider(QuestionBankBuilderSource)
    .useValue(new PocBuilderQuestionSource())
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  plugPocAttempts(app)
  plugPocPapers(app)
  ;(app.getHttpServer() as { setMaxListeners(n: number): void }).setMaxListeners(0)
  return {
    app,
    db,
    clock,
    mail,
    storageDir,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
      await rm(storageDir, { recursive: true, force: true })
    },
  }
}

export interface Login {
  agent: TestAgent
  csrf: string
  session: Session
  /** The raw session cookie value. */
  token: string
  res: Response
}

export function cookieValue(res: Response, name = COOKIE_NAME): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined
  const line = raw?.find((c) => c.startsWith(`${name}=`))
  if (!line) return undefined
  const value = line.slice(name.length + 1).split(';')[0]
  return value ? decodeURIComponent(value) : undefined
}

export function setCookieLine(res: Response, name = COOKIE_NAME): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined
  return raw?.find((c) => c.startsWith(`${name}=`))
}

/** Signs in (cookie jar kept in the agent). `ip` is the client address the app sees (TRUST_PROXY_HOPS=1). */
export async function loginAs(t: SecurityApp, identifier: string, extra: { password?: string; ip?: string; body?: Record<string, unknown> } = {}): Promise<Login> {
  const agent = t.agent()
  const res = await agent
    .post('/api/auth/login')
    .set('X-Forwarded-For', extra.ip ?? '10.9.0.1')
    .send({ identifier, password: extra.password ?? DEMO_PASSWORD, remember: false, ...extra.body })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const token = cookieValue(res)
  expect(token).toBeTruthy()
  return { agent, csrf: session.csrf, session, token: token as string, res }
}

export type Verb = 'post' | 'put' | 'patch' | 'delete' | 'get'

/** One call with the CSRF header of the login. */
export function call(l: Login, verb: Verb, path: string, body?: unknown): ReturnType<TestAgent['get']> {
  let req = l.agent[verb](`/api${path}`)
  if (verb !== 'get') req = req.set('X-CSRF-Token', l.csrf)
  return body === undefined ? req : req.send(body as object)
}

export async function count(db: TestDatabase, table: string): Promise<number> {
  const rows = await db.query<{ n: string }>(`select count(*)::text as n from ${table}`)
  return Number(rows[0]?.n ?? 0)
}
