import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../../prisma/seed'
import { identitySeed } from '../../../../prisma/seed/core/identity'
import { curriculumSeed } from '../../../../prisma/seed/curriculum'
import { questionsSeed } from '../../../../prisma/seed/questions'
import { defineAppModule } from '../../../../src/app.module'
import { configureApp } from '../../../../src/configure-app'
import { CLOCK, FixedClock } from '../../../../src/db/clock'
import { AuthModule } from '../../../../src/modules/auth'
import { ClassesModule } from '../../../../src/modules/classes'
import { PracticeReadsModule } from '../../../../src/modules/practice/reads'
import { PerformanceModule } from '../../../../src/modules/reports/performance'
import { XsQueries } from '../../../../src/modules/school-admin/xs-queries'
import { START, loginAs, type AuthTestApp } from '../../../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../../../support/db'

/**
 * Staff (school_admin) all-levels view only: for non-staff the totals cover just the shown questions (`basis`, deliberate, no recovery by subtraction), so they
 * do not equal `XsQueries.summary`.
 *
 * S6-T03 (XS-1, XS-4, XS-5, XS-7, XS-8): the headline figures of Analisa Item (API-RPT-06) on the REAL answer store, no fake port.
 * One school: 2 counted pupils (16 answers, 1 right = 6.25 %, an exact half at one decimal) and three pupils XS-1 leaves out
 * (suspended, no Tingkatan, deactivated), each with only right answers that would lift the figures if they were counted.
 */
let db: TestDatabase
let t: AuthTestApp
let schoolId: string
let agent: TestAgent
let questionIds: string[]
let xs: XsQueries
let counter = 0
let subjectId: string

async function pupil(opts: { school?: string; suspended?: boolean; grade?: number | null; active?: boolean; answers: number; correct: number; oneQuestion?: boolean }): Promise<string> {
  counter += 1
  const grade = opts.grade === undefined ? 10 : opts.grade
  const [u] = await db.query<{ id: string }>(
    `insert into users (name, email, school_id, grade, is_active, is_suspended) values ($1, $2, $3::bigint, $4, $5, $6) returning id::text`,
    [`Murid Ujian ${counter}`, `xsia${counter}@demo.test`, opts.school ?? schoolId, grade, opts.active ?? true, opts.suspended ?? false],
  )
  await db.query(`insert into user_roles (user_id, role) values ($1::bigint, 'student')`, [u!.id])
  const [s] = await db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, question_count, status, correct_count, started_at, completed_at, is_test)
     values ($1::bigint, 'latih_tubi', $2, 'completed', $3, now() - interval '1 hour', now(), false) returning id::text`,
    [u!.id, opts.answers, opts.correct],
  )
  for (let n = 1; n <= opts.answers; n++) {
    await db.query(
      `insert into practice_answers (session_id, user_id, question_id, subject_id, selected_label, is_correct, answered_at, is_test, mode)
       values ($1::uuid, $2::bigint, $3::bigint, $7::bigint, $4, $5, now() - interval '1 hour' + $6 * interval '1 minute', false, 'latih_tubi')`,
      [s!.id, u!.id, questionIds[opts.oneQuestion ? 0 : n % questionIds.length], n <= opts.correct ? 'A' : 'B', n <= opts.correct, n, subjectId],
    )
  }
  return u!.id
}

beforeAll(async () => {
  db = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed, questionsSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    BIJAK_POC_QUESTIONS: 'false',
  })
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, PerformanceModule, PracticeReadsModule, ClassesModule])] })
    .overrideProvider(CLOCK)
    .useValue(new FixedClock(START))
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  t = {
    app,
    db,
    clock: new FixedClock(START),
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    close: async () => undefined,
  }
  xs = app.get(XsQueries)

  const [school] = await db.query<{ id: string }>(`insert into schools (name, code, state, district) values ('Sekolah XS Ujian', 'XSIA001', 'Negeri A', 'Daerah A') returning id::text`)
  schoolId = school!.id
  subjectId = (await db.query<{ id: string }>(`select id::text from subjects order by id limit 1`))[0]!.id
  questionIds = (await db.query<{ id: string }>(`select id::text from questions order by id limit 3`)).map((r) => r.id)
  expect(questionIds.length).toBe(3)
  await db.query(
    `insert into users (name, email, school_id, password_hash) select 'Admin Sekolah XS', 'xsia-admin@demo.test', $1::bigint, password_hash from users where email = 'adminsekolah@demo.test'`,
    [schoolId],
  )
  await db.query(`insert into user_roles (user_id, role) select id, 'school_admin' from users where email = 'xsia-admin@demo.test'`)

  await pupil({ answers: 10, correct: 1 })
  await pupil({ answers: 6, correct: 0 })
  await pupil({ suspended: true, answers: 5, correct: 5 })
  await pupil({ grade: null, answers: 5, correct: 5 })
  await pupil({ active: false, answers: 5, correct: 5 })

  agent = (await loginAs(t, 'xsia-admin@demo.test')).agent
})

afterAll(async () => {
  await t.app.close()
  await db.drop()
})

describe('GET /api/item-analysis/school headline figures are the XS definitions (S6-T03)', () => {
  it('Murid, Jawapan, Betul and Ketepatan equal XsQueries for the school; the excluded pupils answers are not counted', async () => {
    const res = await agent.get('/api/item-analysis/school')
    expect(res.status).toBe(200)
    const d = res.body.data
    const scope = { kind: 'school', schoolId } as const
    const totals = await xs.answerTotals(scope)
    const summary = await xs.summary(scope)

    expect(d.students).toBe(await xs.pupilCount(scope))
    expect(d.students).toBe(2)
    expect(d.answers).toBe(totals.answered)
    expect(d.correct).toBe(totals.correct)
    expect(d.accuracy).toBe(totals.accuracy)
    expect(d.questionsTested).toBe(summary.questionsTested)
    // 16 answers, 1 right; the 15 answers (all right) of the suspended, grade-less and deactivated pupils are left out.
    expect(d.answers).toBe(16)
    expect(d.correct).toBe(1)
  })

  it('an exact half at one decimal rounds half up: 1 of 16 is 6.25 %, shown 6.3', async () => {
    const res = await agent.get('/api/item-analysis/school')
    expect(res.body.data.accuracy).toBe(6.3)
  })
})

/** A second school: one pupil, 23 of 80 right on one question = 28.75 %, a half that the old float rounding showed as 28.7. */
async function adminOfNewSchool(code: string): Promise<{ schoolId: string; agent: TestAgent }> {
  const [sc] = await db.query<{ id: string }>(`insert into schools (name, code, state, district) values ($1, $2, 'Negeri A', 'Daerah A') returning id::text`, [`Sekolah ${code}`, code])
  const email = `${code.toLowerCase()}-admin@demo.test`
  await db.query(`insert into users (name, email, school_id, password_hash) select 'Admin Sekolah', $1, $2::bigint, password_hash from users where email = 'adminsekolah@demo.test'`, [email, sc!.id])
  await db.query(`insert into user_roles (user_id, role) select id, 'school_admin' from users where email = $1`, [email])
  return { schoolId: sc!.id, agent: (await loginAs(t, email)).agent }
}

describe('one rounding (XS-5) across the headline, the subject row and the question accuracy', () => {
  it('23 of 80 is 28.75: headline, subject row and class question accuracy all show 28.8', async () => {
    const { schoolId: sid, agent: a } = await adminOfNewSchool('XSIA002')
    const pupilId = await pupil({ school: sid, answers: 80, correct: 23, oneQuestion: true })
    const [lv] = await db.query<{ id: string }>(`select id::text from education_levels where grade = 10 order by sort_order, id limit 1`)
    const [c] = await db.query<{ id: string }>(
      `insert into classrooms (name, school_id, education_level_id, academic_year, join_code) values ('Kelas XS', $1::bigint, $2::bigint, 2026, 'XSIA2') returning id::text`,
      [sid, lv!.id],
    )
    await db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1::bigint, $2::bigint, 'active', 'code')`, [c!.id, pupilId])

    const d = (await a.get('/api/item-analysis/school')).body.data
    expect(d.answers).toBe(80)
    expect(d.accuracy).toBe(28.8)
    expect(d.subjects).toHaveLength(1)
    expect(d.subjects[0].accuracy).toBe(28.8)

    const admin = (await loginAs(t, 'admin@demo.test')).agent
    const cls = (await admin.get(`/api/item-analysis/classes/${c!.id}`)).body.data
    expect(cls.analysis.difficulty).toHaveLength(1)
    expect(cls.analysis.difficulty[0].accuracy).toBe(28.8)
  })

  it('a school with no XS pupil and no answers: students 0, answers and accuracy null (never 0 %)', async () => {
    const { agent: a } = await adminOfNewSchool('XSIA003')
    const d = (await a.get('/api/item-analysis/school')).body.data
    expect(d.students).toBe(0)
    expect(d.answers).toBeNull()
    expect(d.accuracy).toBeNull()
    expect(d.questionsTested).toBeNull()
  })

  it('a school whose only pupils are outside XS-1 (no Tingkatan) shows 0 students and null figures', async () => {
    const { schoolId: sid, agent: a } = await adminOfNewSchool('XSIA004')
    await pupil({ school: sid, grade: null, answers: 4, correct: 4 })
    const d = (await a.get('/api/item-analysis/school')).body.data
    expect(d.students).toBe(0)
    expect(d.answers).toBeNull()
    expect(d.accuracy).toBeNull()
  })
})
