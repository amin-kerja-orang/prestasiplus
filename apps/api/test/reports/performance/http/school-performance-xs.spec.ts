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
import { PracticeReadsModule } from '../../../../src/modules/practice/reads'
import { PerformanceModule } from '../../../../src/modules/reports/performance'
import { SchoolAdminModule } from '../../../../src/modules/school-admin'
import { XsQueries } from '../../../../src/modules/school-admin/xs-queries'
import { UsersModule } from '../../../../src/modules/users'
import { START, loginAs, type AuthTestApp } from '../../../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../../../support/db'

/**
 * S6-T03 (XS-1, XS-4, XS-5, XS-8, decision 11): the headline totals of Prestasi sekolah (`GET /api/performance/school`) on the REAL answer
 * store and the real `XsQueries`, no fake port. One school: 2 counted pupils (16 answers, 1 right = 6.25 %, an exact half at one decimal)
 * and three pupils XS-1 leaves out (suspended, no Tingkatan, deactivated), each with only right answers that would lift every figure if
 * they were counted. All five are enrolled in one Tingkatan 4 class. Rows are inserted by this fixture only, never by production code.
 */
let db: TestDatabase
let t: AuthTestApp
let agent: TestAgent
let xs: XsQueries
let schoolId: string
let subjectId: string
let counter = 0
let countedIds: string[] = []
/** Codes and emails are unique per run so a re-run on a shared database never collides. */
const RUN = Date.now().toString(36).toUpperCase()

async function pupil(school: string, opts: { suspended?: boolean; grade?: number | null; active?: boolean; answers: number; correct: number }): Promise<string> {
  counter += 1
  const grade = opts.grade === undefined ? 10 : opts.grade
  const [u] = await db.query<{ id: string }>(
    `insert into users (name, email, school_id, grade, is_active, is_suspended) values ($1, $2, $3::bigint, $4, $5, $6) returning id::text`,
    [`Murid Ujian ${counter}`, `xssp${counter}-${RUN}@demo.test`, school, grade, opts.active ?? true, opts.suspended ?? false],
  )
  await db.query(`insert into user_roles (user_id, role) values ($1::bigint, 'student')`, [u!.id])
  const [s] = await db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, subject_id, question_count, status, correct_count, started_at, completed_at, is_test)
     values ($1::bigint, 'latih_tubi', $4::bigint, $2, 'completed', $3, now() - interval '1 hour', now(), false) returning id::text`,
    [u!.id, opts.answers, opts.correct, subjectId],
  )
  await db.query(
    `insert into practice_answers (session_id, user_id, subject_id, selected_label, is_correct, answered_at, is_test, mode)
     select $1::uuid, $2::bigint, $3::bigint, case when n <= $4 then 'A' else 'B' end, n <= $4, now() - interval '1 hour' + n * interval '1 minute', false, 'latih_tubi'
       from generate_series(1, $5::int) n`,
    [s!.id, u!.id, subjectId, opts.correct, opts.answers],
  )
  return u!.id
}

async function school(tag: string): Promise<{ schoolId: string; agent: TestAgent }> {
  const code = `XSSP${tag}${RUN}`
  const [sc] = await db.query<{ id: string }>(`insert into schools (name, code, state, district) values ($1, $2, 'Negeri A', 'Daerah A') returning id::text`, [`Sekolah ${code}`, code])
  const email = `xssp-admin-${tag.toLowerCase()}-${RUN}@demo.test`.toLowerCase()
  await db.query(`insert into users (name, email, school_id, password_hash) select 'Admin Sekolah', $1, $2::bigint, password_hash from users where email = 'adminsekolah@demo.test'`, [email, sc!.id])
  await db.query(`insert into user_roles (user_id, role) select id, 'school_admin' from users where email = $1`, [email])
  return { schoolId: sc!.id, agent: (await loginAs(t, email)).agent }
}

/** A Tingkatan 4 classroom of the school with the given pupils enrolled. */
async function classOf(school: string, pupils: string[]): Promise<void> {
  counter += 1
  const [lv] = await db.query<{ id: string }>(`select id::text from education_levels where grade = 10 order by sort_order, id limit 1`)
  const [c] = await db.query<{ id: string }>(
    `insert into classrooms (name, school_id, education_level_id, academic_year, join_code) values ($1, $2::bigint, $3::bigint, 2026, $4) returning id::text`,
    [`Kelas XS ${counter}`, school, lv!.id, `XS${counter}${RUN}`],
  )
  for (const id of pupils) await db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1::bigint, $2::bigint, 'active', 'code')`, [c!.id, id])
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
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, UsersModule, SchoolAdminModule, PerformanceModule, PracticeReadsModule])] })
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
  subjectId = (await db.query<{ id: string }>(`select id::text from subjects order by id limit 1`))[0]!.id

  const main = await school('A')
  schoolId = main.schoolId
  agent = main.agent
  countedIds = [await pupil(schoolId, { answers: 10, correct: 1 }), await pupil(schoolId, { answers: 6, correct: 0 })]
  const excluded = [
    await pupil(schoolId, { suspended: true, answers: 5, correct: 5 }),
    await pupil(schoolId, { grade: null, answers: 5, correct: 5 }),
    await pupil(schoolId, { active: false, answers: 5, correct: 5 }),
  ]
  await classOf(schoolId, [...countedIds, ...excluded])
})

afterAll(async () => {
  await t.app.close()
  await db.drop()
})

describe('GET /api/performance/school headline totals are the XS population (S6-T03)', () => {
  it('students, answered and accuracy equal XsQueries; the answers and sessions of suspended, grade-less and inactive pupils are not counted', async () => {
    const res = await agent.get('/api/performance/school')
    expect(res.status).toBe(200)
    const d = res.body.data
    const scope = { kind: 'school', schoolId } as const
    const totals = await xs.answerTotals(scope)

    expect(d.stats.students).toBe(await xs.pupilCount(scope))
    expect(d.stats.students).toBe(2)
    expect(d.stats.answered).toBe(totals.answered)
    // 16 answers, 1 right; the 15 right answers of the three excluded pupils are left out, and so are their 3 sessions.
    expect(d.stats.answered).toBe(16)
    expect(d.stats.sessions).toBe(2)
    expect(d.stats.accuracy).toBe(totals.accuracy)
    expect(d.stats.accuracy).toBe(6.3)
  })

  it('the Tingkatan row of the same pupils uses the same population and rounding', async () => {
    const d = (await agent.get('/api/performance/school')).body.data
    const t4 = d.levels.find((l: { code: string }) => l.code === 't4')
    expect(t4.students).toBe(2)
    expect(t4.sessions).toBe(2)
    expect(t4.accuracy).toBe(6.3)
    const detail = (await agent.get('/api/performance/levels/t4')).body.data
    expect(detail.students).toBe(2)
    expect(detail.accuracy).toBe(6.3)
    expect(detail.sessions).toBe(2)
    // The pupil lists name counted pupils only: the excluded pupils (all right, so otherwise top) never show, nor as "no answer" at risk.
    const listed = [...detail.topStudents, ...detail.atRisk].map((p: { userId: string }) => p.userId)
    expect(new Set(listed)).toEqual(new Set(countedIds))
    expect(detail.topStudents).toHaveLength(2)
    expect(detail.atRisk).toHaveLength(2)
  })

  it('the school admin Dashboard shows the same totals for the same data', async () => {
    const school = (await agent.get('/api/performance/school')).body.data
    const dash = (await agent.get('/api/admin-sekolah/dashboard')).body.data
    expect(dash.cards.pupils).toBe(school.stats.students)
    expect(dash.performance.practice).toEqual({ accuracy: school.stats.accuracy, sessions: school.stats.sessions, questions: school.stats.answered })
    expect(dash.performance.levels.find((l: { code: string }) => l.code === 't4').accuracy).toBe(school.levels.find((l: { code: string }) => l.code === 't4').accuracy)
  })
})

describe('one rounding (XS-5) across the payload', () => {
  it('23 of 80 is 28.75: the headline, the Tingkatan row and the level detail all show 28.8 (the old float rounding gave 28.7)', async () => {
    const { schoolId: sid, agent: a } = await school('B')
    await classOf(sid, [await pupil(sid, { answers: 80, correct: 23 })])
    const d = (await a.get('/api/performance/school')).body.data
    expect(d.stats.answered).toBe(80)
    expect(d.stats.accuracy).toBe(28.8)
    expect(d.levels.find((l: { code: string }) => l.code === 't4').accuracy).toBe(28.8)
    const detail = (await a.get('/api/performance/levels/t4')).body.data
    expect(detail.accuracy).toBe(28.8)
    expect(detail.classRows[0].accuracy).toBe(28.8)
    const dash = (await a.get('/api/admin-sekolah/dashboard')).body.data
    expect(dash.performance.practice.accuracy).toBe(28.8)
  })

  it('a school whose only pupil is outside XS-1 shows 0 students, 0 answered and 0 sessions', async () => {
    const { schoolId: sid, agent: a } = await school('C')
    await classOf(sid, [await pupil(sid, { grade: null, answers: 4, correct: 4 })])
    const d = (await a.get('/api/performance/school')).body.data
    expect(d.stats).toMatchObject({ students: 0, answered: 0, sessions: 0, accuracy: 0 })
  })
})
