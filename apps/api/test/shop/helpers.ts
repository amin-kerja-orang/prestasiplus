import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { gamificationSeed } from '../../prisma/seed/gamification'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { PrismaService } from '../../src/db/prisma.service'
import { AuthModule } from '../../src/modules/auth'
import { BOX_RANDOM, SeededBoxRandom } from '../../src/modules/shop/box-random'
import { ShopModule } from '../../src/modules/shop'
import { ShopAdminService } from '../../src/modules/shop/admin.service'
import { ShopService } from '../../src/modules/shop/shop.service'
import { WalletModule, WalletService } from '../../src/modules/wallet'
import { START } from '../auth/helpers'
import { ErrorBodySchema } from '@pp/contract'
import { expect } from 'vitest'
import { ApiError } from '../../src/common/errors/api-error'
import type { Response } from 'supertest'
import { createTestDatabase } from '../support/db'
import type { UsersTestApp } from '../users/helpers'

export { ADMIN, STUDENT, TEACHER, apiOf, login } from '../users/helpers'
export { userIdOf } from '../auth/helpers'
export type { Api } from '../users/helpers'

export const STUDENT_MAJU = 'pelajarmaju@demo.test'
export const STUDENT_2 = 'pelajar2@demo.test'

export interface ShopTestApp extends UsersTestApp {
  wallet: WalletService
  prisma: PrismaService
  shop: ShopService
  admin: ShopAdminService
}

/** Nest app with auth + wallet + shop on a private migrated database (identity, wallet and gamification seeds). */
export async function bootShopApp(opts: { env?: Record<string, string | undefined> } = {}): Promise<ShopTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, walletSeed, gamificationSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_WALLET_READ_PER_MINUTE: undefined,
    THROTTLE_SHOP_WRITE_PER_MINUTE: '1000',
    THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000',
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
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, WalletModule, ShopModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(BOX_RANDOM)
    .useValue(SeededBoxRandom)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return {
    app,
    db,
    clock,
    wallet: app.get(WalletService),
    prisma: app.get(PrismaService),
    shop: app.get(ShopService),
    admin: app.get(ShopAdminService),
    http: () => request(app.getHttpServer()) as unknown as ReturnType<UsersTestApp['http']>,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

/** A user with no password and no role (a bare row): for service-level concurrency tests. */
export async function bareUser(t: ShopTestApp, label: string): Promise<string> {
  const rows = await t.db.query<{ id: string }>(`insert into users (name) values ($1) returning id::text`, [`Pengguna ${label}`])
  return rows[0]!.id
}

export const actorFor = (userId: string, isTest = false) => ({ userId, role: 'student', requestId: null, ip: null, isTest })

export interface RewardSeed {
  title?: string
  tokenCost?: number
  stock?: number | null
  maxPerMonth?: number | null
  active?: boolean
  consent?: boolean
  category?: string
  validityDays?: number
}

/** Inserts an own reward row (the seeded Hadiah are all inactive). Returns its id. */
export async function insertReward(t: ShopTestApp, o: RewardSeed = {}): Promise<string> {
  const rows = await t.db.query<{ id: string }>(
    `insert into rewards (category, vendor, title, denomination_rm, token_cost, stock_quantity, max_per_month_per_student, is_active, requires_parent_consent, voucher_validity_days, display_order)
     values ($1, 'Vendor Ujian', $2, 10, $3, $4, $5, $6, $7, $8, 100) returning id::text`,
    [o.category ?? 'ewallet', o.title ?? 'Baucar Ujian', o.tokenCost ?? 10, o.stock === undefined ? null : o.stock, o.maxPerMonth === undefined ? null : o.maxPerMonth, o.active ?? true, o.consent ?? false, o.validityDays ?? 365],
  )
  return rows[0]!.id
}

export interface DrawSeed {
  title?: string
  cost?: number
  max?: number
  status?: string
  /** Closing date as a Malaysia calendar day (null = no closing date). */
  closesOn?: string | null
}

export async function insertDraw(t: ShopTestApp, o: DrawSeed = {}): Promise<string> {
  const rows = await t.db.query<{ id: string }>(
    `insert into draws (title, description, ticket_cost_syiling, max_tickets_per_student, status, closes_at)
     values ($1, 'Cabutan ujian', $2, $3, $4, $5::timestamptz) returning id::text`,
    [o.title ?? 'Cabutan Ujian', o.cost ?? 5, o.max ?? 3, o.status ?? 'open', o.closesOn === undefined || o.closesOn === null ? null : `${o.closesOn}T00:00:00+08:00`],
  )
  const id = rows[0]!.id
  await t.db.query(`insert into draw_prizes (draw_id, label, value_sen, qty, position) values ($1, 'Hadiah Utama', 5000, 1, 0), ($1, 'Hadiah Saguhati', 1000, 2, 1)`, [id])
  return id
}

export const fund = async (t: ShopTestApp, userId: string, o: { syiling?: number; tokens?: number }, key = 'fund'): Promise<void> => {
  if (o.syiling) await t.wallet.credit({ userId, amount: o.syiling, source: 'admin_award', sourceId: `${key}:s`, description: 'Ujian', isTest: false })
  if (o.tokens) await t.wallet.creditTokens({ userId, amount: o.tokens, source: 'admin_award', refId: `${key}:t`, isTest: false })
}

export const walletRow = async (t: ShopTestApp, userId: string): Promise<{ syiling: number; tokens: number; xp: number }> => {
  const r = await t.db.query<{ current_syiling: number; token_balance: number; xp: number }>(`select current_syiling, token_balance, xp from wallets where user_id = $1`, [userId])
  return { syiling: r[0]?.current_syiling ?? 0, tokens: r[0]?.token_balance ?? 0, xp: r[0]?.xp ?? 0 }
}

export const stockOf = async (t: ShopTestApp, rewardId: string): Promise<number | null> => {
  const r = await t.db.query<{ stock_quantity: number | null }>(`select stock_quantity from rewards where id = $1`, [rewardId])
  return r[0]!.stock_quantity
}

/** Asserts a contract error body with the exact status, module/generic code and (when given) BM message. */
export function expectError(res: Response, status: number, code: string, message?: string) {
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  const parsed = ErrorBodySchema.parse(res.body)
  expect(parsed.error.code).toBe(code)
  expect(parsed.error.requestId).toBeTruthy()
  if (message !== undefined) expect(parsed.error.message).toBe(message)
  return parsed.error
}

/** The ApiError a service call is refused with (service-level tests). */
export async function refusal(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError)
    return err as ApiError
  }
  throw new Error('Expected the call to be refused.')
}
