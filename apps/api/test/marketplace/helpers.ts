import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema, SessionSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { marketplaceSeed } from '../../prisma/seed/marketplace'
import { marketplaceCategoriesSeed } from '../../prisma/seed/core/marketplace-categories'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { MarketplaceModule } from '../../src/modules/marketplace'
import { createTestDatabase, type TestDatabase } from '../support/db'

export const DEMO_PASSWORD = 'Demo1234'
export const START = '2026-10-19T09:00:00+08:00'

export interface MarketplaceTestApp {
  app: INestApplication
  db: TestDatabase
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

/** Nest app with the auth and marketplace modules on a private migrated database seeded with identity + marketplace. */
export async function bootMarketplaceApp(env: Record<string, string> = {}): Promise<MarketplaceTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, marketplaceCategoriesSeed, marketplaceSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    ...env,
  })
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, MarketplaceModule])] })
    .overrideProvider(CLOCK)
    .useValue(new FixedClock(START))
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return {
    app,
    db,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.prisma.$disconnect()
      await new Promise((resolve) => setTimeout(resolve, 200))
      await db.drop()
      for (const k of Object.keys(env)) delete process.env[k]
    },
  }
}

export interface Client {
  csrf: string
  get(url: string): request.Test
  post(url: string): request.Test
  /** A POST without the CSRF header. */
  postNoCsrf(url: string): request.Test
}

export const ACCOUNTS = {
  student: 'pelajar@demo.test',
  teacher: 'guru@demo.test',
  admin: 'admin@demo.test',
  schoolAdmin: 'adminsekolah@demo.test',
} as const

/** Logs in with the demo password; POSTs carry the CSRF token like the browser does. */
export async function loginAs(t: MarketplaceTestApp, identifier: string): Promise<Client> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const csrf = SessionSchema.parse(res.body.data).csrf
  return {
    csrf,
    get: (url) => agent.get(url),
    post: (url) => agent.post(url).set('X-CSRF-Token', csrf),
    postNoCsrf: (url) => agent.post(url),
  }
}

export function expectError(res: Response, status: number, code: string, message?: string) {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  expect(parsed.error.code).toBe(code)
  if (message !== undefined) expect(parsed.error.message).toBe(message)
  return parsed.error
}

export const count = async (db: TestDatabase, sql: string, params: unknown[] = []): Promise<number> =>
  Number((await db.query<{ n: string }>(sql, params))[0]?.n)

/** Adds a generated set of products (all active, seller 1 unless given) through SQL. Names `Produk Ujian N`. */
export async function insertProducts(
  db: TestDatabase,
  n: number,
  opts: { sellerId?: string | null; categoryId?: number; status?: string; prefix?: string; at?: string } = {},
): Promise<void> {
  const seller = opts.sellerId === undefined ? '1' : opts.sellerId
  await db.query(
    `insert into marketplace_products (seller_id, name, slug, category_id, price, original_price, condition, stock_status, status, shipping_method, created_at)
     select $1::bigint, $4 || ' ' || g, lower($4) || '-' || g, $2::bigint, 10 + (g % 7) * 3.5, case when g % 2 = 0 then 40 else null end,
            case when g % 3 = 0 then 'used' else 'new' end, 'available', $3, 'postage', $5::timestamptz + (g % 5) * interval '1 minute'
       from generate_series(1, $6) g`,
    [seller, opts.categoryId ?? 1, opts.status ?? 'active', opts.prefix ?? 'Produk Ujian', opts.at ?? '2026-03-01T10:00:00+08:00', n],
  )
}
