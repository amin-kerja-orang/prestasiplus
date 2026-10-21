import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { IntakeDashboardModule } from '../../src/modules/intake/dashboard'
import { UsersModule } from '../../src/modules/users'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { loginAs, START, type LoggedIn } from '../auth/helpers'

export { START, expectError } from '../auth/helpers'

export const ADMIN = 'admin@demo.test'
export const TEACHER = 'guru@demo.test'
export const SCHOOL_ADMIN = 'adminsekolah@demo.test'
export const STUDENT = 'pelajar@demo.test'

export interface DashTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

/** Nest app with auth, users and the BE-40 module on a private migrated database (identity + schools seeds), clock at START. */
export async function bootDashApp(env: Record<string, string | undefined> = {}): Promise<DashTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
  const all: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_INTAKE_DASHBOARD_READ_PER_MINUTE: '1000',
    AI_MONTHLY_BUDGET_SEN: undefined,
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...env,
  }
  for (const [k, v] of Object.entries(all)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, UsersModule, IntakeDashboardModule])] })
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
      await db.drop()
    },
  }
}

type AuthLike = Parameters<typeof loginAs>[0]
export const login = (t: DashTestApp, identifier: string): Promise<LoggedIn> => loginAs(t as unknown as AuthLike, identifier)
export const getAs = (who: LoggedIn, path: string): Promise<Response> => who.agent.get(`/api${path}`)

/**
 * TEST-ONLY stand-ins for the stores BE-40 reads, by the columns of v2-data-model.md 3.5. `intake_batches` matches BE-37's
 * migration (0020, PR #57) column for column on every NOT NULL column, and every statement is IF NOT EXISTS, so the fixtures
 * still apply unchanged once the real BE-36/37/38 tables are on the base (a column rename there makes these tests fail: the
 * intended signal). Only the columns the dashboard reads are created for the BE-36/38 stand-ins.
 */
export const STORE_DDL = `
CREATE TABLE IF NOT EXISTS intake_batches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_user_id bigint,
  status text NOT NULL DEFAULT 'submitted',
  paper_type text NOT NULL,
  subject text NOT NULL,
  kertas smallint NOT NULL,
  year smallint NOT NULL,
  source_text text NOT NULL,
  rights_status text NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS intake_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES intake_batches(id) ON DELETE CASCADE,
  review_state text NOT NULL DEFAULT 'generated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS intake_item_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES intake_items(id) ON DELETE CASCADE,
  actor_user_id bigint,
  event text NOT NULL,
  field text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS duplicate_links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES intake_items(id) ON DELETE CASCADE,
  matched_question_id bigint,
  matched_item_id bigint,
  kind text NOT NULL,
  decision text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint,
  batch_id bigint,
  actor_user_id bigint,
  provider text,
  model text,
  pages int,
  tokens_in int,
  tokens_out int,
  cost_sen int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_settings (
  id int PRIMARY KEY CHECK (id = 1),
  monthly_budget_sen int NOT NULL,
  warn_percent smallint NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`

export async function createStores(db: TestDatabase): Promise<void> {
  await db.query(STORE_DDL)
}

export async function insertBatch(db: TestDatabase, status: string, createdAt: string, isTest = false): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO intake_batches (status, paper_type, subject, kertas, year, source_text, rights_status, is_test, created_at, updated_at)
     VALUES ($1, 'trial', 'MT', 1, 2026, 'Ujian rekaan', 'own', $2, $3::timestamptz, $3::timestamptz) RETURNING id::text`,
    [status, isTest, createdAt],
  )
  return rows[0]?.id as string
}

/** A bare question row (all columns default), the target of an accepted item or a bank duplicate. */
async function bareQuestion(db: TestDatabase): Promise<string> {
  return (await db.query<{ id: string }>(`INSERT INTO questions DEFAULT VALUES RETURNING id::text`))[0]?.id as string
}

/**
 * BE-38 owns the real `intake_items` table (migration 0038): `position`, `item_type` and `payload` are required, a rejected
 * item keeps a reason and an accepted item points at its question (check constraints).
 */
export async function insertItem(db: TestDatabase, batchId: string, state: string, createdAt: string): Promise<string> {
  const questionId = state === 'accepted' ? await bareQuestion(db) : null
  const rows = await db.query<{ id: string }>(
    `INSERT INTO intake_items (batch_id, position, item_type, payload, review_state, reject_reason, question_id, created_at, updated_at)
     VALUES ($1::bigint, (SELECT COALESCE(MAX(position), 0) + 1 FROM intake_items WHERE batch_id = $1::bigint), 'short', '{}'::jsonb,
             $2, CASE WHEN $2 = 'rejected' THEN 'Sebab ujian' ELSE NULL END, $4::bigint, $3::timestamptz, $3::timestamptz)
     RETURNING id::text`,
    [batchId, state, createdAt, questionId],
  )
  return rows[0]?.id as string
}

export async function insertEvent(db: TestDatabase, itemId: string, event: string, at: string, field: string | null = null): Promise<void> {
  await db.query(`INSERT INTO intake_item_events (item_id, event, field, created_at) VALUES ($1::bigint, $2, $3, $4::timestamptz)`, [itemId, event, field, at])
}

export async function insertDuplicate(db: TestDatabase, itemId: string, kind: string, decision = 'pending'): Promise<void> {
  const questionId = await bareQuestion(db)
  await db.query(`INSERT INTO duplicate_links (item_id, matched_question_id, kind, decision) VALUES ($1::bigint, $4::bigint, $2, $3)`, [itemId, kind, decision, questionId])
}

export interface UsageRow {
  provider: string | null
  batchId: string | null
  costSen: number
  at: string
  pages?: number
  tokensIn?: number
  tokensOut?: number
}

export async function insertUsage(db: TestDatabase, u: UsageRow): Promise<void> {
  await db.query(
    `INSERT INTO ai_usage_logs (provider, model, batch_id, cost_sen, pages, tokens_in, tokens_out, created_at)
     VALUES ($1, 'model-x', $2::bigint, $3, $4, $5, $6, $7::timestamptz)`,
    [u.provider, u.batchId, u.costSen, u.pages ?? 1, u.tokensIn ?? 10, u.tokensOut ?? 5, u.at],
  )
}

export async function setBudget(db: TestDatabase, budgetSen: number | null): Promise<void> {
  await db.query(`DELETE FROM ai_settings`)
  if (budgetSen !== null) await db.query(`INSERT INTO ai_settings (id, monthly_budget_sen) VALUES (1, $1)`, [budgetSen])
}
