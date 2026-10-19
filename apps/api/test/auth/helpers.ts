import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_STATUS,
  ERROR_STATUS,
  ErrorBodySchema,
  SessionSchema,
  type Session,
} from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { type AppModuleOptions, defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { LegacyBcryptPool } from '../../src/modules/auth/legacy-bcrypt'
import { createTestDatabase, type TestDatabase } from '../support/db'

export const DEMO_PASSWORD = 'Demo1234'
export const COOKIE_NAME = 'pp_session'
/** A fixed "now" (Malaysia time) for the injected clock. */
export const START = '2026-10-19T09:00:00+08:00'

export interface AuthTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  /** A plain client with no cookie jar. */
  http(): TestAgent
  /** A client that keeps cookies, like a browser. */
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions extends AppModuleOptions {
  /** Environment for this app only (read when the module is built). `undefined` removes a key. */
  env?: Record<string, string | undefined>
  /** Reuse an existing seeded database. */
  db?: TestDatabase
  /** Run the identity seed (default true). */
  seed?: boolean
  /** Replace the legacy bcrypt pool (to saturate it in a test). */
  pool?: LegacyBcryptPool
  /** Keep the cookie `Secure` flag on (default off so the plain-http test client keeps the cookie). */
  secureCookie?: boolean
}

/** Nest app with the auth module on a private migrated + seeded database and a fixed clock. */
export async function bootAuthApp(opts: BootOptions = {}): Promise<AuthTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db && opts.seed !== false) await runSeeds([identitySeed], { prisma: db.prisma })

  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: opts.secureCookie ? undefined : 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    SESSION_REMEMBER_DAYS: undefined,
    SESSION_REMEMBER_DAYS_STAFF: undefined,
    TRUST_PROXY_HOPS: undefined,
    // Cheap dummy bcrypt work in tests; the timing test raises it.
    LEGACY_BCRYPT_DUMMY_COST: '4',
    // No artificial delay on failed logins in tests; the floor test raises it.
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  const clock = new FixedClock(START)
  const appOptions: AppModuleOptions = opts.logStream ? { logStream: opts.logStream } : {}
  let builder = Test.createTestingModule({
    imports: [defineAppModule([AuthModule], appOptions)],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
  if (opts.pool) builder = builder.overrideProvider(LegacyBcryptPool).useValue(opts.pool)
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
      if (!opts.db) await db.drop()
    },
  }
}

export interface LoggedIn {
  agent: TestAgent
  csrf: string
  session: Session
  /** The raw cookie value, for replaying an old session id. */
  token: string
  res: Response
}

/** The session cookie value from a `Set-Cookie` header, or undefined when none was set. */
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

export async function loginAs(
  t: AuthTestApp,
  identifier: string,
  extra: { password?: string; schoolId?: string; remember?: boolean } = {},
): Promise<LoggedIn> {
  const agent = t.agent()
  const res = await agent
    .post('/api/auth/login')
    .send({ identifier, password: extra.password ?? DEMO_PASSWORD, remember: extra.remember ?? false, ...(extra.schoolId ? { schoolId: extra.schoolId } : {}) })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const token = cookieValue(res)
  expect(token).toBeTruthy()
  return { agent, csrf: session.csrf, session, token: token as string, res }
}

/** Asserts an error response: contract shape, status of the contract table and exact BM message. */
export function expectError(
  res: Response,
  code: keyof typeof AUTH_ERROR_STATUS | keyof typeof ERROR_STATUS | 'RATE_LIMITED',
  message?: string,
): ReturnType<typeof ErrorBodySchema.parse>['error'] {
  const parsed = ErrorBodySchema.parse(res.body)
  const status =
    code in AUTH_ERROR_STATUS
      ? AUTH_ERROR_STATUS[code as keyof typeof AUTH_ERROR_STATUS]
      : ERROR_STATUS[code as keyof typeof ERROR_STATUS]
  expect(res.status).toBe(status)
  expect(parsed.error.code).toBe(code)
  expect(parsed.error.requestId).toBeTruthy()
  const expected = message ?? (AUTH_ERROR_MESSAGES as Record<string, string>)[code]
  if (expected) expect(parsed.error.message).toBe(expected)
  return parsed.error
}

export async function schoolIdOf(db: TestDatabase, code: string): Promise<string> {
  const rows = await db.query<{ id: string }>(`select id::text from schools where code = $1`, [code])
  return rows[0]?.id as string
}

export async function userIdOf(db: TestDatabase, email: string): Promise<string> {
  const rows = await db.query<{ id: string }>(`select id::text from users where lower(email) = lower($1)`, [email])
  return rows[0]?.id as string
}
