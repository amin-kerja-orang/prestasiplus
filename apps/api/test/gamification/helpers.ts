import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { gamificationSeed } from '../../prisma/seed/gamification'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { PrismaService } from '../../src/db/prisma.service'
import { AuthModule, AuthPorts } from '../../src/modules/auth'
import { GamificationAdminService, GamificationModule, GamificationPorts, GamificationService, type PracticeDayFacts, type PracticeFactsProvider, type PracticeMasteryFact } from '../../src/modules/gamification'
import { WalletModule, WalletService } from '../../src/modules/wallet'
import { START, loginAs, type LoggedIn } from '../auth/helpers'
import { createTestDatabase } from '../support/db'
import type { UsersTestApp } from '../users/helpers'

export { ADMIN, STUDENT, TEACHER, apiOf, login } from '../users/helpers'
export { userIdOf } from '../auth/helpers'
export type { Api } from '../users/helpers'
export { START }

export const STUDENT_MAJU = 'pelajarmaju@demo.test'
export const STUDENT_EMPTY = 'pelajar2@demo.test'

/** A controllable stand-in for the practice facts BE-12/13 will provide. */
export class StubPracticeFacts implements PracticeFactsProvider {
  day: PracticeDayFacts = { sessions: [], chapterIds: [] }
  masteryRows: PracticeMasteryFact[] = []
  counts = { all: 0, practice: 0 }
  accurate = 0
  async dayFacts(): Promise<PracticeDayFacts> {
    return this.day
  }
  async mastery(): Promise<readonly PracticeMasteryFact[]> {
    return this.masteryRows
  }
  async sessionCounts(): Promise<{ all: number; practice: number }> {
    return this.counts
  }
  async accurateSessions(): Promise<number> {
    return this.accurate
  }
}

export interface GamificationTestApp extends UsersTestApp {
  wallet: WalletService
  gamification: GamificationService
  admin: GamificationAdminService
  prisma: PrismaService
  facts: StubPracticeFacts
}

export interface BootOptions {
  /** Keep the M14 login hook (streak + the daily +2) on form logins. Default false: the other specs read the seeded wallets as they are (the doc's `setUser` fast login calls no hook). */
  loginHook?: boolean
  seeds?: SeedModule[]
  env?: Record<string, string | undefined>
  start?: string
}

/** Nest app with the auth, wallet and gamification modules on a private migrated database; a fixed clock. */
export async function bootGamificationApp(opts: BootOptions = {}): Promise<GamificationTestApp> {
  const db = await createTestDatabase()
  await runSeeds(opts.seeds ?? [identitySeed, walletSeed, gamificationSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_WALLET_READ_PER_MINUTE: undefined,
    THROTTLE_ADMIN_READ_PER_MINUTE: undefined,
    THROTTLE_ADMIN_WRITE_PER_MINUTE: undefined,
    THROTTLE_GAMIFICATION_CONVERT_PER_MINUTE: undefined,
    TRUST_PROXY_HOPS: undefined,
    PUBLIC_BASE_URL: 'https://app.example.test',
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(opts.start ?? START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, WalletModule, GamificationModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  if (!opts.loginHook) app.get(AuthPorts).overrideLoginHook(null)
  const facts = new StubPracticeFacts()
  app.get(GamificationPorts).providePracticeFacts(facts)
  return {
    app,
    db,
    clock,
    wallet: app.get(WalletService),
    gamification: app.get(GamificationService),
    admin: app.get(GamificationAdminService),
    prisma: app.get(PrismaService),
    facts,
    http: () => request(app.getHttpServer()) as unknown as ReturnType<UsersTestApp['http']>,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

/** Asserts a contract error body with the exact status, code and (optionally) message; returns the error. */
export function fail(res: Response, status: number, code: string, message?: string): { code: string; message: string; fields?: Record<string, string> } {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  expect(parsed.error.code).toBe(code)
  if (message !== undefined) expect(parsed.error.message).toBe(message)
  return parsed.error
}

export const dataOf = <T = unknown>(res: Response): T => {
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  return (res.body as { data: T }).data
}

/** A client that sends the CSRF header on writes; `raw` keeps the header off. */
export function clientOf(who: LoggedIn) {
  return {
    get: (path: string) => who.agent.get(`/api${path}`),
    post: (path: string, body: object = {}, headers: Record<string, string> = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).set(headers).send(body),
    put: (path: string, body: object = {}) => who.agent.put(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body),
    del: (path: string) => who.agent.delete(`/api${path}`).set('X-CSRF-Token', who.csrf),
    noCsrfPost: (path: string, body: object = {}) => who.agent.post(`/api${path}`).send(body),
    noCsrfPut: (path: string, body: object = {}) => who.agent.put(`/api${path}`).send(body),
    noCsrfDel: (path: string) => who.agent.delete(`/api${path}`),
  }
}
export type Client = ReturnType<typeof clientOf>

/** Logs in and returns the CSRF-aware client. */
export async function signIn(t: GamificationTestApp, email: string): Promise<Client> {
  return clientOf(await loginAs(t as never, email))
}

export interface LedgerSql {
  id: string
  type: string
  source: string
  source_id: string | null
  tokens: number | null
  amount: number
  balance_after: number
  description: string
  is_test: boolean
}

export const ledgerOf = (t: GamificationTestApp, userId: string): Promise<LedgerSql[]> =>
  t.db.query<LedgerSql>(`select id::text, type, source, source_id, tokens, amount, balance_after, description, is_test from coin_ledger where user_id = $1 order by id`, [userId])

export async function walletOf(t: GamificationTestApp, userId: string) {
  const rows = await t.db.query<{ current_syiling: number; total_syiling_earned: number; token_balance: number; xp: number; level: number; tier_name: string | null }>(
    `select w.current_syiling, w.total_syiling_earned, w.token_balance, w.xp, w.level, t.tier_name from wallets w left join tiers t on t.id = w.tier_id where w.user_id = $1`,
    [userId],
  )
  return rows[0]
}

/** A bare user (no role, no wallet) for service tests. */
export async function bareUser(t: GamificationTestApp, label: string): Promise<string> {
  const rows = await t.db.query<{ id: string }>(`insert into users (name) values ($1) returning id::text`, [`Pengguna ${label}`])
  return rows[0]!.id
}

/** A bare pupil: a user holding the role `student` (only student wallets are ranked, FIX-3 D-08), no wallet. */
export async function bareStudent(t: GamificationTestApp, label: string): Promise<string> {
  const id = await bareUser(t, label)
  await t.db.query(`insert into user_roles (user_id, role) values ($1::bigint, 'student')`, [id])
  return id
}

export const challengeIdByTitle = async (t: GamificationTestApp, title: string): Promise<string> =>
  (await t.db.query<{ id: string }>(`select id::text from challenges where title = $1`, [title]))[0]!.id

/** An admin who has entered Mod Pelajar (`auth.mode !== null`): acts as a student, every write is stamped is_test. */
export async function signInMod(t: GamificationTestApp, email: string): Promise<Client> {
  const who = await loginAs(t as never, email)
  const res = await who.agent.post('/api/session/mode').set('X-CSRF-Token', who.csrf).send({ mode: 'mod_pelajar' })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return clientOf({ ...who, csrf: (res.body as { data: { csrf: string } }).data.csrf })
}
