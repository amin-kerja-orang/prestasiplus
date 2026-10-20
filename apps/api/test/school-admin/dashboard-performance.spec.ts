import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { SchoolAdminDashboardSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { questionsSeed } from '../../prisma/seed/questions'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { BijakIntegrationModule } from '../../src/modules/bijak/integration'
import { SchoolAdminModule } from '../../src/modules/school-admin'
import { UsersModule } from '../../src/modules/users'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { START } from '../auth/helpers'
import { apiOf, login, schoolIdOf, SCHOOL_ADMIN, type Api } from './helpers'

/**
 * The dashboard performance block over the REAL BE-19 `SchoolPerformanceService` and the real Bijak aggregate
 * (`BijakIntegrationModule`), no fake port. Sittings are `exam_attempts` + `attempt_results` rows, as in the BE-19
 * port-contract spec.
 */
let db: TestDatabase
let close: () => Promise<void>
let admin: Api
let s1: string
let s2: string
let counter = 0

async function boot(): Promise<void> {
  db = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed, questionsSeed, examSeed, walletSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE: undefined,
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    BIJAK_SWEEP_INTERVAL_SECONDS: '0',
    FILE_STORAGE_DIR: undefined,
    BIJAK_POC_QUESTIONS: 'false',
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, UsersModule, SchoolAdminModule, BijakIntegrationModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(new FixedClock(START))
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  const t = {
    app,
    db,
    clock: new FixedClock(START),
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    close: async () => undefined,
  }
  close = async () => {
    await app.close()
    await db.drop()
  }
  admin = apiOf(await login(t, SCHOOL_ADMIN))
}

/** A pupil of `schoolId`, optionally with one submitted, graded Bijak sitting (score 7 of 10). */
async function pupil(schoolId: string, sitting: boolean): Promise<string> {
  counter += 1
  const [u] = await db.query<{ id: string }>(`insert into users (name, email, school_id) values ($1, $2, $3::bigint) returning id::text`, [
    `Murid Ujian ${counter}`,
    `perf${counter}@demo.test`,
    schoolId,
  ])
  await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'student', now())`, [u!.id])
  if (!sitting) return u!.id
  const [a] = await db.query<{ id: string }>(
    `insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at, duration_min, submitted_at, is_test)
     values ($1::bigint, 'pilihan', 'Kertas ujian', 'matematik', 'Matematik', 1, 'UJ/1', 'exam', 'submitted', now() - interval '1 hour', 60, now(), false) returning id::text`,
    [u!.id],
  )
  await db.query(
    `insert into attempt_results (attempt_id, score, max_score, provisional, pending_review, graded) values ($1::uuid, 7, 10, false, 0, '{"sections":[],"questions":[]}'::jsonb)`,
    [a!.id],
  )
  return u!.id
}

/** A class of `schoolId` at the education level of `grade` (10 = Tingkatan 4), with the given pupils enrolled. Returns the level code. */
async function klass(schoolId: string, grade: number, opts: { active?: boolean; kind?: string; pupils?: string[] } = {}): Promise<string> {
  counter += 1
  const [lv] = await db.query<{ id: string; code: string }>(`select id::text, code from education_levels where grade = $1 order by sort_order, id limit 1`, [grade])
  const kind = opts.kind ?? 'classroom'
  const [c] = await db.query<{ id: string }>(
    `insert into classrooms (kind, name, school_id, education_level_id, academic_year, join_code, is_active) values ($1, $2, $3::bigint, $4::bigint, 2026, $5, $6) returning id::text`,
    [kind, `Kelas ${counter}`, schoolId, lv!.id, kind === 'classroom' ? `PF${counter}` : null, opts.active ?? true],
  )
  for (const id of opts.pupils ?? []) {
    await db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1::bigint, $2::bigint, 'active', 'code')`, [c!.id, id])
  }
  return lv!.code.toLowerCase()
}

const dashboard = async () => SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)

beforeAll(async () => {
  await boot()
  s1 = await schoolIdOf(db, 'DEMO001')
  s2 = await schoolIdOf(db, 'DEMO002')
})
afterAll(async () => {
  await close()
})
beforeEach(async () => {
  // Every case starts from a school with exactly the pupils it creates.
  await db.query(`delete from exam_attempts`)
  await db.query(`delete from enrolments`)
  await db.query(`delete from classrooms`)
  await db.query(`delete from user_roles where user_id in (select id from users where email like 'perf%@demo.test')`)
  await db.query(`delete from users where email like 'perf%@demo.test'`)
  await db.query(
    `update users set school_id = null where school_id in ($1::bigint, $2::bigint) and id in (select user_id from user_roles where role = 'student')`,
    [s1, s2],
  )
})

describe('GET /admin-sekolah/dashboard with the real BE-19 SchoolPerformanceService', () => {
  it('5 pupils with submitted sittings: the practice block carries BE-19 figures; levels and distribution keep their fixed rows', async () => {
    for (let i = 0; i < 5; i++) await pupil(s1, true)
    const d = await dashboard()
    expect(d.cards.pupils).toBe(5)
    expect(d.performance.practice).toEqual({ accuracy: 70, sessions: 5, questions: 50 })
    expect(d.performance.levels.map((l) => l.code)).toEqual(['t4', 't5'])
    // BE-19 has no per-level figures without BE-17 classes and no grade rows before the SPM slice: rows exist, counts stay 0.
    expect(d.performance.distribution.length).toBeGreaterThan(0)
    expect(d.performance.total).toBe(0)
  })

  it('fewer than 5 pupils: the practice block stays suppressed (k = 5)', async () => {
    for (let i = 0; i < 4; i++) await pupil(s1, true)
    const d = await dashboard()
    expect(d.cards.pupils).toBe(4)
    expect(d.performance.practice).toEqual({ accuracy: null, sessions: 0, questions: 0 })
    expect(d.performance.levels.every((l) => l.accuracy === 0)).toBe(true)
    expect(d.performance.total).toBe(0)
  })

  it('another school never leaks in: its sittings are not counted, whatever their number', async () => {
    for (let i = 0; i < 5; i++) await pupil(s1, i < 2) // own school: 5 pupils, only 2 sat
    for (let i = 0; i < 8; i++) await pupil(s2, true) // other school: 8 sittings
    const d = await dashboard()
    expect(d.cards.pupils).toBe(5)
    expect(d.performance.practice).toEqual({ accuracy: 70, sessions: 2, questions: 20 })
  })

  it('the class count is the number of ACTIVE classes of the own school (BE-17); another school and inactive classes are not counted', async () => {
    for (let i = 0; i < 3; i++) await klass(s1, 10)
    await klass(s1, 11, { kind: 'school_class' })
    await klass(s1, 10, { active: false })
    for (let i = 0; i < 4; i++) await klass(s2, 10)
    expect((await dashboard()).cards.activeClasses).toBe(4)
  })

  it('levels: 5 pupils with sittings in one class of the level are shown; a level with fewer than 5 pupils stays 0', async () => {
    const five: string[] = []
    for (let i = 0; i < 5; i++) five.push(await pupil(s1, true))
    const small: string[] = []
    for (let i = 0; i < 2; i++) small.push(await pupil(s1, true))
    const big = await klass(s1, 10, { pupils: five })
    const little = await klass(s1, 11, { pupils: small })
    const d = await dashboard()
    expect(d.performance.levels.find((l) => l.code === big)?.accuracy).toBe(70)
    expect(d.performance.levels.find((l) => l.code === little)?.accuracy).toBe(0)
  })
})
