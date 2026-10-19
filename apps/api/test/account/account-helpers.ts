import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema, SessionSchema, type Session } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AccountModule } from '../../src/modules/account'
import {
  MAIL_PORT,
  NOTIFICATION_PORT,
  type AccountNotice,
  type MailPort,
  type NotificationPort,
  type PasswordResetMail,
} from '../../src/modules/account/ports'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { COOKIE_NAME, cookieValue, DEMO_PASSWORD, START } from '../auth/helpers'

export { COOKIE_NAME, cookieValue, DEMO_PASSWORD, START }

export class MailSpy implements MailPort {
  readonly sent: PasswordResetMail[] = []
  fail = false
  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    if (this.fail) return Promise.reject(new Error('mail down'))
    this.sent.push(mail)
    return Promise.resolve()
  }
  last(): PasswordResetMail {
    const m = this.sent.at(-1)
    if (!m) throw new Error('No mail was sent.')
    return m
  }
}

export class NoticeSpy implements NotificationPort {
  readonly pushed: { userId: string; notice: AccountNotice }[] = []
  fail = false
  push(userId: string, notice: AccountNotice): Promise<void> {
    if (this.fail) return Promise.reject(new Error('inbox down'))
    this.pushed.push({ userId, notice })
    return Promise.resolve()
  }
}

export interface AccountTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  mail: MailSpy
  notices: NoticeSpy
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  logStream?: NodeJS.WritableStream
  /** Keep the real logging MailPort instead of the spy. */
  realMail?: boolean
  db?: TestDatabase
}

/** Nest app with the account module (and what it imports) on a private migrated + seeded database and a fixed clock. */
export async function bootAccountApp(opts: BootOptions = {}): Promise<AccountTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) await runSeeds([identitySeed], { prisma: db.prisma })

  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_ACCOUNT_WRITE_PER_MINUTE: undefined,
    THROTTLE_PUBLIC_PER_MINUTE: undefined,
    MAIL_LOG_RESET_LINKS: undefined,
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
  const mail = new MailSpy()
  const notices = new NoticeSpy()
  let builder = Test.createTestingModule({
    imports: [defineAppModule([AccountModule], opts.logStream ? { logStream: opts.logStream } : {})],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(NOTIFICATION_PORT)
    .useValue(notices)
  if (!opts.realMail) builder = builder.overrideProvider(MAIL_PORT).useValue(mail)
  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()

  return {
    app,
    db,
    clock,
    mail,
    notices,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      if (!opts.db) await db.drop()
    },
  }
}

export interface Who {
  agent: TestAgent
  csrf: string
  session: Session
  token: string
}

export async function login(t: AccountTestApp, identifier: string, password = DEMO_PASSWORD): Promise<Who> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  return { agent, csrf: session.csrf, session, token: cookieValue(res) as string }
}

export const put = (w: Who, path: string, body: object = {}) => w.agent.put(`/api${path}`).set('X-CSRF-Token', w.csrf).send(body)
export const post = (w: Who, path: string, body: object = {}) => w.agent.post(`/api${path}`).set('X-CSRF-Token', w.csrf).send(body)
export const get = (w: Who, path: string) => w.agent.get(`/api${path}`)

/** The `fields` of a 422 and its code/status. */
export function fieldsOf(res: Response): Record<string, string> {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  expect(parsed.error.code).toBe('VALIDATION_ERROR')
  return parsed.error.fields ?? {}
}

export function errorOf(res: Response, status: number, code: string): ReturnType<typeof ErrorBodySchema.parse>['error'] {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  expect(parsed.error.code).toBe(code)
  return parsed.error
}

export async function userRow(db: TestDatabase, email: string) {
  const rows = await db.query<{ id: string; name: string; password_hash: string; must_reset_password: boolean; ic_hash: string | null; ic_masked: string | null; school_id: string | null; grade: number | null; phone: string | null; bio: string | null }>(
    `select id::text, name, password_hash, must_reset_password, ic_hash, ic_masked, school_id::text, grade, phone, bio from users where lower(email) = lower($1)`,
    [email],
  )
  return rows[0]
}

export const REGISTER_STUDENT = {
  name: 'Murid Baharu',
  email: 'murid.baharu@ujian.test',
  phone: '0191234567',
  role: 'student',
  grade: 3,
  icNumber: '100101140077',
  password: 'rahsia1',
  passwordConfirmation: 'rahsia1',
}
