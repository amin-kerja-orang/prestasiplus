import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { PrismaService } from '../../src/db/prisma.service'
import { AuthModule } from '../../src/modules/auth'
import { StreakService, WalletModule, WalletService } from '../../src/modules/wallet'
import { START } from '../auth/helpers'
import { createTestDatabase } from '../support/db'
import type { UsersTestApp } from '../users/helpers'

export { ADMIN, STUDENT, TEACHER, apiOf, login } from '../users/helpers'
export { expectError, userIdOf } from '../auth/helpers'
export type { Api } from '../users/helpers'

export const STUDENT_MAJU = 'pelajarmaju@demo.test'
export const STUDENT_EMPTY = 'pelajar2@demo.test'

export interface WalletTestApp extends UsersTestApp {
  wallet: WalletService
  streak: StreakService
  prisma: PrismaService
}

export interface BootOptions {
  /** Seeds to run on the private database (default: identity + wallet). */
  seeds?: SeedModule[]
  env?: Record<string, string | undefined>
  /** Start time of the fixed clock (default the shared START, 2026-10-19 09:00 +08:00). */
  start?: string
}

/** Nest app with the auth and wallet modules on a private migrated database; a fixed clock. */
export async function bootWalletApp(opts: BootOptions = {}): Promise<WalletTestApp> {
  const db = await createTestDatabase()
  await runSeeds(opts.seeds ?? [identitySeed, walletSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_WALLET_READ_PER_MINUTE: undefined,
    TRUST_PROXY_HOPS: undefined,
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
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, WalletModule])] })
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
    wallet: app.get(WalletService),
    streak: app.get(StreakService),
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()) as unknown as ReturnType<UsersTestApp['http']>,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

/** A user with no wallet and no role (a bare row), for service tests. */
export async function bareUser(t: WalletTestApp, label: string): Promise<string> {
  const rows = await t.db.query<{ id: string }>(`insert into users (name) values ($1) returning id::text`, [`Pengguna ${label}`])
  return rows[0]!.id
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

export const ledgerOf = (t: WalletTestApp, userId: string): Promise<LedgerSql[]> =>
  t.db.query<LedgerSql>(
    `select id::text, type, source, source_id, tokens, amount, balance_after, description, is_test from coin_ledger where user_id = $1 order by id`,
    [userId],
  )

export interface WalletSql {
  current_syiling: number
  total_syiling_earned: number
  token_balance: number
  xp: number
  level: number
  tier_name: string | null
}

export async function walletOf(t: WalletTestApp, userId: string): Promise<WalletSql | undefined> {
  const rows = await t.db.query<WalletSql>(
    `select w.current_syiling, w.total_syiling_earned, w.token_balance, w.xp, w.level, t.tier_name
       from wallets w left join tiers t on t.id = w.tier_id where w.user_id = $1`,
    [userId],
  )
  return rows[0]
}
