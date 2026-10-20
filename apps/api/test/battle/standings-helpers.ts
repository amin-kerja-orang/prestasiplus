import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { BattleStandingsModule } from '../../src/modules/battle/standings'
import { loginAs, schoolIdOf, userIdOf, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { schoolIdOf, userIdOf }

export interface StandingsApp {
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  login(email: string): Promise<LoggedIn>
  close(): Promise<void>
}

/** Nest app with auth + battle on a private migrated database seeded with identity, schools, population (+ extra seeds). */
export async function bootStandings(start: string, extraSeeds: SeedModule[] = []): Promise<StandingsApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, populationSeed, ...extraSeeds], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_BATTLE_READ_PER_MINUTE: '100000',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(start)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, BattleStandingsModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  const t: StandingsApp = {
    db,
    clock,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    login: (email) => loginAs({ app, db, clock, http: t.http, agent: () => request.agent(app.getHttpServer()), close: async () => undefined } as never, email),
    async close() {
      await app.close()
      await db.drop()
    },
  }
  return t
}

export interface FixtureBattle {
  a: string
  b: string
  scoreA: number
  scoreB: number
  at: string
  status?: string
  /** Defaults to the CURRENT school code of each student (stored school on the participant row). */
  schoolA?: string | null
  schoolB?: string | null
  winner?: 'A' | 'B' | null | 'auto'
  answered?: number
  correctA?: number
  correctB?: number
  isTest?: boolean
  partIsTest?: boolean
}

/** Inserts a battle with both participants; students and schools by e-mail / code. Returns the battle uuid. */
export async function addBattle(db: TestDatabase, f: FixtureBattle): Promise<string> {
  const userA = await userIdOf(db, f.a)
  const userB = await userIdOf(db, f.b)
  const schoolOfUser = async (email: string): Promise<string | null> => {
    const rows = await db.query<{ s: string | null }>(`select school_id::text s from users where lower(email) = lower($1)`, [email])
    return rows[0]?.s ?? null
  }
  const code = async (c: string | null | undefined, email: string): Promise<string | null> =>
    c === undefined ? schoolOfUser(email) : c === null ? null : await schoolIdOf(db, c)
  const winner = f.winner === undefined || f.winner === 'auto' ? (f.scoreA === 0 && f.scoreB === 0 ? 'B' : f.scoreA > f.scoreB ? 'A' : f.scoreB > f.scoreA ? 'B' : null) : f.winner
  const [row] = await db.query<{ id: string }>(
    `insert into battles (mode, question_type, status, answered, winner, is_test, created_at, finished_at)
     values ('quick_match', 'biasa', $1, $2, $3, $4, $5, $5) returning id::text`,
    [f.status ?? 'finished', f.answered ?? 10, winner, f.isTest ?? false, f.at],
  )
  const id = row!.id
  const part = f.partIsTest ?? false
  await db.query(
    `insert into battle_participants (battle_id, side, user_id, school_id, score, correct, is_test)
     values ($1, 'A', $2, $3, $4, $5, $9), ($1, 'B', $6, $7, $8, $10, $9)`,
    [id, userA, await code(f.schoolA, f.a), f.scoreA, f.correctA ?? 0, userB, await code(f.schoolB, f.b), f.scoreB, part, f.correctB ?? 0],
  )
  return id
}

/** Student accounts of the core seeds. */
export const S = {
  D1: (n: number): string => `murid.demo001.${String(n).padStart(2, '0')}@example.test`,
  D2: (n: number): string => `murid.demo002.${String(n).padStart(2, '0')}@example.test`,
  D3: (n: number): string => `murid.demo003.${String(n).padStart(2, '0')}@example.test`,
  D4: (n: number): string => `murid.demo004.${String(n).padStart(2, '0')}@example.test`,
  PELAJAR: 'pelajar@demo.test',
  PELAJAR2: 'pelajar2@demo.test',
  MAJU: 'pelajarmaju@demo.test',
  ADMIN: 'admin@demo.test',
  TEACHER: 'guru@demo.test',
} as const

export async function getAs(who: LoggedIn, path: string) {
  return who.agent.get(`/api${path}`)
}

export function expectNotFound(res: { status: number; body: unknown }, message: string): void {
  const parsed = ErrorBodySchema.parse(res.body)
  expect(res.status).toBe(404)
  expect(parsed.error.code).toBe('NOT_FOUND')
  expect(parsed.error.message).toBe(message)
}
