import {
  CommandCenterClassResponseSchema,
  CommandCenterDailyActivityResponseSchema,
  CommandCenterGuruEvaluationSchema,
  CommandCenterGuruLiveDataSchema,
  CommandCenterLiveDataResponseSchema,
  CommandCenterSchoolResponseSchema,
  CommandCenterTeacherResponseSchema,
  SchoolAdminActivityReportSchema,
  SchoolAdminDashboardSchema,
  SchoolAdminMonthlyReportSchema,
  SchoolAdminUsageSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { AuthModule } from '../../src/modules/auth'
import { CommandCenterModule } from '../../src/modules/command-center'
import { AnswerFactsAdapter } from '../../src/modules/practice/reads/answer-facts.adapter'
import { CommandCenterRepository } from '../../src/modules/command-center/shared/command-center.repository'
import { SchoolAdminModule, SCHOOL_PERFORMANCE_PORT } from '../../src/modules/school-admin'
import { XS_ALL_TIME, XsQueries, xsAccuracy } from '../../src/modules/school-admin/xs-queries'
import { UsersModule } from '../../src/modules/users'
import { bootCommandCenterApp, type CcTestApp, createClass, createUser, enrol, getAs, login, type LoggedIn } from '../command-center/helpers'
import { FakePerformance, emptyView, insertPendingTeacher } from './helpers'
import { addSubject, suspend } from './reports-fixtures'

/**
 * AC-XS-1 to AC-XS-3 and AC-X4-2 (R1 card S6-T03): one fixture school, and every screen that shows XS-1..XS-5 and XS-7 shows the same
 * number as `XsQueries`. DB spec: needs Docker/Testcontainers (it runs in CI).
 *
 * The fixture school ("Sekolah Fixture XS", clock 2026-10-19 09:00 MYT, every answer at 08:00 that day so the day, week, month and
 * all-time windows hold the same rows):
 *
 *   pupils counted by XS-1 (6): P1 P2 P3 in Tingkatan 1 (grade 7) and P4 P5 P6 in Tingkatan 5 (grade 11), all active
 *   pupils NOT counted: a suspended one, a pending one (inactive, not suspended), a deactivated one (inactive and suspended) and a Darjah 6 pupil (grade 6);
 *                       all four have answers, which must never reach any figure
 *   teachers: one approved (TA, counted by XS-3), one pending ("Guru Menunggu", not counted); one school admin (not a teacher)
 *   answers (XS-4 = 24, correct 15, accuracy 62.5, XS-2 = 5 pupils, XS-7 = 19 distinct questions):
 *     P1 10 answers (7 correct) in a completed "chapter" session, questions 1-10
 *     P2  5 answers (2 correct) with no session, questions 1-5 (the same questions as P1: they count once in XS-7)
 *     P3  4 answers (4 correct) in a completed "ramalan" session (a non-latihan mode), questions 11-14
 *     P4  3 answers (1 correct) in an UNFINISHED session, questions 15-17
 *     P5  2 answers (1 correct) plus 40 is_test answers, questions 18-19
 *     P6  none
 *   the class of TA: P1 P2 P3 and the suspended and the pending pupil enrolled (the last two are not XS-1 in the teacher scope either)
 */
const AT = '2026-10-19T08:00:00+08:00'

let t: CcTestApp
let xs: XsQueries
let school: string
let teacherA: { id: string; email: string }
let classA: string
let p: Record<'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'susp' | 'pending' | 'deact' | 'darjah', string>
let schoolAdmin: LoggedIn
let admin: LoggedIn
let teacher: LoggedIn

async function pupil(name: string, grade: number, o: { isActive?: boolean } = {}): Promise<string> {
  return (await createUser(t.db, { role: 'student', schoolId: school, name, grade, ...(o.isActive === undefined ? {} : { isActive: o.isActive }) })).id
}

async function session(userId: string, mode: string, status: 'completed' | 'in_progress', questions: number, correct: number): Promise<string> {
  const rows = await t.db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, question_count, status, correct_count, time_spent_sec, started_at, completed_at)
     values ($1::bigint, $2, $3, $4, $5, 120, $6::timestamptz - interval '10 minutes', case when $4 = 'completed' then $6::timestamptz end) returning id::text`,
    [userId, mode, questions, status, correct, AT],
  )
  return rows[0]?.id as string
}

/** `n` answers one second apart from `AT`, the first `correct` correct, on questions `firstQuestion` .. `firstQuestion + n - 1` (no foreign key on question_id yet). */
async function answers(userId: string, n: number, correct: number, firstQuestion: number, o: { sessionId?: string; isTest?: boolean } = {}): Promise<void> {
  await t.db.query(
    `insert into practice_answers (user_id, session_id, question_id, is_correct, answered_at, is_test)
     select $1::bigint, $2::uuid, $3::bigint + g - 1, g <= $4, $5::timestamptz + (g || ' seconds')::interval, $6 from generate_series(1, $7::int) g`,
    [userId, o.sessionId ?? null, firstQuestion, correct, AT, o.isTest ?? false, n],
  )
}

const fake = new FakePerformance(emptyView({ stats: { students: 6, sessions: 2, answered: 999, accuracy: 11 } }))

beforeAll(async () => {
  t = await bootCommandCenterApp({
    modules: [AuthModule, UsersModule, SchoolAdminModule, CommandCenterModule],
    overrides: [{ token: SCHOOL_PERFORMANCE_PORT, useValue: fake }],
    env: { THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE: '100000' },
  })
  xs = t.app.get(XsQueries, { strict: false })
  school = (await t.db.query<{ id: string }>(`insert into schools (name, type) values ('Sekolah Fixture XS', 'SMK') returning id::text`))[0]?.id as string

  teacherA = await createUser(t.db, { role: 'teacher', schoolId: school, name: 'Guru Fixture' })
  await insertPendingTeacher(t.db, 'menunggu.xs@fixture.test', school)
  const sa = await createUser(t.db, { role: 'school_admin', schoolId: school, name: 'Admin Fixture' })

  p = {
    p1: await pupil('Murid XS Satu', 7),
    p2: await pupil('Murid XS Dua', 7),
    p3: await pupil('Murid XS Tiga', 7),
    p4: await pupil('Murid XS Empat', 11),
    p5: await pupil('Murid XS Lima', 11),
    p6: await pupil('Murid XS Enam', 11),
    susp: await pupil('Murid XS Digantung', 8),
    pending: await pupil('Murid XS Menunggu', 8, { isActive: false }),
    deact: await pupil('Murid XS Dinyahaktif', 9, { isActive: false }),
    darjah: await pupil('Murid XS Darjah', 6),
  }
  await suspend(t.db, p.susp)
  await suspend(t.db, p.deact)

  classA = await createClass(t.db, { teacherId: teacherA.id, schoolId: school, name: 'Kelas XS', grade: 7 })
  for (const id of [p.p1, p.p2, p.p3, p.susp, p.pending]) await enrol(t.db, classA, id)

  await answers(p.p1, 10, 7, 1, { sessionId: await session(p.p1, 'chapter', 'completed', 10, 7) })
  await answers(p.p2, 5, 2, 1)
  await answers(p.p3, 4, 4, 11, { sessionId: await session(p.p3, 'ramalan', 'completed', 4, 4) })
  await answers(p.p4, 3, 1, 15, { sessionId: await session(p.p4, 'chapter', 'in_progress', 10, 0) })
  await answers(p.p5, 2, 1, 18)
  await answers(p.p5, 40, 40, 100, { isTest: true })
  await answers(p.susp, 6, 6, 200)
  await answers(p.pending, 3, 3, 210)
  await answers(p.deact, 4, 4, 220)
  await answers(p.darjah, 5, 5, 230)

  schoolAdmin = await login(t, sa.email)
  admin = await login(t, 'admin@demo.test')
  teacher = await login(t, teacherA.email)
})
afterAll(async () => {
  await t.close()
})

const get = async (who: LoggedIn, path: string) => {
  const res = await getAs(who, path)
  expect(res.status, `${path} ${JSON.stringify(res.body)}`).toBe(200)
  return res.body as { data: unknown } & Record<string, unknown>
}
const SCHOOL = () => ({ kind: 'school', schoolId: school }) as const

describe('XsQueries on the fixture school (XS-1 to XS-5, XS-7, XS-8)', () => {
  it('XS-1: active, non-suspended pupils of Tingkatan 1-5 only', async () => {
    const r = await xs.pupils(SCHOOL())
    expect(r.count).toBe(6)
    expect(new Set(r.ids)).toEqual(new Set([p.p1, p.p2, p.p3, p.p4, p.p5, p.p6]))
    expect(await xs.pupilCount(SCHOOL())).toBe(6)
  })

  it('XS-2: distinct XS-1 pupils with an answer; XS-4 / XS-5 / XS-7 over the same rows, all modes, no is_test, no excluded pupil', async () => {
    expect((await xs.activePupils(SCHOOL())).count).toBe(5)
    expect(await xs.activePupilCount(SCHOOL(), XS_ALL_TIME)).toBe(5)
    // 24 rows: with and without a session, a "ramalan" session, an unfinished session; the 40 is_test rows and the 18 rows of the four excluded pupils are out.
    expect(await xs.answerTotals(SCHOOL())).toEqual({ answered: 24, correct: 15, accuracy: 62.5 })
    expect(await xs.answers(SCHOOL())).toBe(24)
    expect(await xs.questionsTested(SCHOOL())).toBe(19)
    expect(await xs.summary(SCHOOL())).toEqual({ pupils: 6, activePupils: 5, answers: 24, correct: 15, accuracy: 62.5, questionsTested: 19 })
  })

  it('XS-3: approved teachers only (a pending teacher and the school admin are out)', async () => {
    const r = await xs.teachers(school)
    expect(r).toEqual({ count: 1, ids: [teacherA.id] })
    expect(await xs.teacherCount(school)).toBe(1)
  })

  it('windows: [from, to] on answered_at; an empty window gives 0 answers and a null accuracy (never 0 %)', async () => {
    const day = { from: new Date('2026-10-19T00:00:00+08:00'), to: new Date('2026-10-19T09:00:00+08:00') }
    expect((await xs.summary(SCHOOL(), day)).answers).toBe(24)
    const before = { from: null, to: new Date('2026-10-18T23:59:59+08:00') }
    expect(await xs.answerTotals(SCHOOL(), before)).toEqual({ answered: 0, correct: 0, accuracy: null })
    expect((await xs.tallyByMonth(SCHOOL(), XS_ALL_TIME)).get('2026-10')).toEqual({ answered: 24, correct: 15, pupils: 5 })
    const byPupil = await xs.tallyByPupil(SCHOOL())
    expect(byPupil.size).toBe(5)
    expect(byPupil.get(p.p1)).toEqual({ answered: 10, correct: 7 })
    expect(byPupil.has(p.susp)).toBe(false)
  })

  it('teacher scope: an active enrolment AND an active, non-suspended account', async () => {
    const scope = { kind: 'teacher', teacherId: teacherA.id } as const
    // The suspended and the pending pupil are enrolled but not counted.
    expect((await xs.pupils(scope)).count).toBe(3)
    expect(await xs.answerTotals(scope)).toEqual({ answered: 19, correct: 13, accuracy: 68.4 })
    expect(await xs.questionsTested(scope)).toBe(14)
  })
})

describe('AC-XS-1: the same number on every screen of the school admin and the Command Center', () => {
  it('Dashboard: pupils and teachers; practice questions and accuracy are XS-4 / XS-5, not the S10 view (999 / 11)', async () => {
    const d = SchoolAdminDashboardSchema.parse((await get(schoolAdmin, '/admin-sekolah/dashboard')).data)
    expect(d.cards.pupils).toBe(6)
    expect(d.cards.teachers).toBe(1)
    expect(d.performance.practice).toEqual({ accuracy: 62.5, sessions: 2, questions: 24 })
  })

  it.each(['today', '7days', '30days'])('Statistik Penggunaan (%s)', async (period) => {
    const u = SchoolAdminUsageSchema.parse((await get(schoolAdmin, `/admin-sekolah/usage?period=${period}`)).data)
    // Sessions are session counts: the two completed ones (the unfinished session is not completed).
    expect(u.tiles).toMatchObject({ pupils: 6, teachers: 1, activePupils: 5, participationPct: 83, sessions: 2, answers: 24, accuracy: 62.5 })
    // The same values as XsQueries for the same scope and window.
    const sum = await xs.summary(SCHOOL(), { from: new Date('2026-10-01T00:00:00+08:00'), to: new Date('2026-10-19T09:00:00+08:00') })
    expect([u.tiles.pupils, u.tiles.activePupils, u.tiles.answers, u.tiles.accuracy]).toEqual([sum.pupils, sum.activePupils, sum.answers, sum.accuracy])
  })

  it('Laporan Aktiviti', async () => {
    const r = SchoolAdminActivityReportSchema.parse((await get(schoolAdmin, '/admin-sekolah/laporan-aktiviti?range=7')).data)
    expect(r.overview).toMatchObject({ pupils: 6, teachers: 1, practised: 5 })
    expect(r.tiles.pupils).toMatchObject({ total: 6, practised: 5, sessions: 2, accuracy: 62.5 })
    expect(r.tiles.teachers.total).toBe(1)
    // The excluded pupils are in no list; a pupil row carries XS-5 of its own rows.
    const names = r.pupils.semua.map((x) => x.name)
    for (const n of ['Murid XS Digantung', 'Murid XS Menunggu', 'Murid XS Dinyahaktif', 'Murid XS Darjah']) expect(names).not.toContain(n)
    expect(r.pupils.semua).toHaveLength(6)
    expect(r.pupils.semua.find((x) => x.userId === p.p1)?.accuracy).toBe(70)
    expect(r.pupils.semua.find((x) => x.userId === p.p2)?.accuracy).toBe(40)
    // P2's answers have no session: it is still "aktif" (answers are the activity).
    expect(r.pupils.aktif.map((x) => x.userId)).toContain(p.p2)
  })

  it('Laporan Bulanan', async () => {
    const r = SchoolAdminMonthlyReportSchema.parse((await get(schoolAdmin, '/admin-sekolah/laporan-bulanan')).data)
    expect(r.cards).toMatchObject({ registered: 6, active: 5, answers: 24, accuracy: 62.5, sessions: 2 })
  })

  it('Command Center board (school admin): live data and today', async () => {
    const live = CommandCenterLiveDataResponseSchema.parse(await get(schoolAdmin, '/admin/command-center/live-data')).data
    expect(live).toMatchObject({ scope: 'school', totalStudents: 6, activeStudents: 5, totalAnswered: 24, accuracy: 62.5 })
    const day = CommandCenterDailyActivityResponseSchema.parse(await get(schoolAdmin, '/command-center/daily-activity?period=today')).data
    expect(day.practice).toMatchObject({ totalAnswers: 24, correctAnswers: 15, accuracy: 62.5, activeStudents: 5 })
    expect(day.summary).toMatchObject({ totalStudents: 6, activeStudents: 5 })
  })

  it('Command Center board (platform): the same XS-1 / XS-4 / XS-5 as XsQueries for the platform scope', async () => {
    const platform = { kind: 'platform' } as const
    const live = CommandCenterLiveDataResponseSchema.parse(await get(admin, '/admin/command-center/live-data')).data
    const s = await xs.summary(platform)
    expect(live.scope).toBe('platform')
    expect(live.totalStudents).toBe(s.pupils)
    expect(live.activeStudents).toBe(s.activePupils)
    expect(live.totalAnswered).toBe(s.answers)
    expect(live.accuracy).toBe(s.accuracy ?? 0)
  })

  it('Command Center drill (admin): school page cards, teachers (XS-3) and the class roster', async () => {
    const page = CommandCenterSchoolResponseSchema.parse(await get(admin, `/command-center/school/${school}`)).data
    expect(page.cards).toEqual({ students: 6, active: 5, answers: 24, accuracy: 62.5 })
    // XS-3: the approved teacher; the pending teacher and the school admin are no rows.
    expect(page.teachers.map((x) => x.userId)).toEqual([teacherA.id])
    expect(page.teachers[0]).toMatchObject({ students: 3, classes: 1 })
    const cls = CommandCenterClassResponseSchema.parse(await get(admin, `/command-center/classroom/${classA}`)).data
    expect(cls.students.map((s) => s.userId).sort()).toEqual([p.p1, p.p2, p.p3].sort())
  })
})

describe('AC-XS-2: a pupil added to the teacher\'s class raises every teacher-scope count by exactly 1', () => {
  const read = async () => {
    const scope = { kind: 'teacher', teacherId: teacherA.id } as const
    const live = CommandCenterGuruLiveDataSchema.parse((await get(teacher, '/guru/command-center/live-data')) as unknown)
    const evaluate = CommandCenterGuruEvaluationSchema.parse((await get(teacher, '/guru/command-center/evaluate')) as unknown)
    const drill = CommandCenterSchoolResponseSchema.parse(await get(teacher, `/command-center/school/${school}`)).data
    const page = CommandCenterTeacherResponseSchema.parse(await get(teacher, `/command-center/school/${school}/teacher/${teacherA.id}`)).data
    const cls = CommandCenterClassResponseSchema.parse(await get(teacher, `/command-center/classroom/${classA}`)).data
    return {
      xs: (await xs.pupils(scope)).count,
      xsAnswers: (await xs.answerTotals(scope)).answered,
      guruTotal: live.totalStudentsRaw,
      guruClass: live.classes[0]?.studentCount ?? 0,
      guruAnswered: live.totalAnsweredRaw,
      evaluate: evaluate.summary.totalStudents,
      drill: drill.cards.students,
      drillTeacherRow: drill.teachers[0]?.students ?? 0,
      teacherPage: page.classes[0]?.students ?? 0,
      roster: cls.students.length,
    }
  }

  it('before: the teacher scope has 3 pupils everywhere; after enrolling P4 it has 4 (and its 3 answers join the answer count)', async () => {
    const before = await read()
    expect(before).toMatchObject({ xs: 3, guruTotal: 3, guruClass: 3, evaluate: 3, drill: 3, drillTeacherRow: 3, teacherPage: 3, roster: 3 })
    expect(before.xsAnswers).toBe(19)
    expect(before.guruAnswered).toBe(19)

    await enrol(t.db, classA, p.p4)
    const after = await read()
    for (const key of ['xs', 'guruTotal', 'guruClass', 'evaluate', 'drill', 'drillTeacherRow', 'teacherPage', 'roster'] as const) {
      expect(after[key] - before[key], key).toBe(1)
    }
    expect(after.xsAnswers - before.xsAnswers).toBe(3)
    expect(after.guruAnswered - before.guruAnswered).toBe(3)
  })
})

describe('AC-X4-2: pooled, never an average of rounded values', () => {
  it('three pupils with 1 / 2 / 7 answers and 1 / 1 / 4 correct: 100, 50 and 57 per pupil, 60 pooled for the class', async () => {
    const other = await t.db.query<{ id: string }>(`insert into schools (name, type) values ('Sekolah Fixture XS Kedua', 'SMK') returning id::text`)
    const schoolB = other[0]?.id as string
    const tb = await createUser(t.db, { role: 'teacher', schoolId: schoolB, name: 'Guru Fixture Kedua' })
    const klass = await createClass(t.db, { teacherId: tb.id, schoolId: schoolB, name: 'Kelas XS Kedua', grade: 8 })
    const spec = [
      { answers: 1, correct: 1, first: 300 },
      { answers: 2, correct: 1, first: 310 },
      { answers: 7, correct: 4, first: 320 },
    ]
    const ids: string[] = []
    for (const [i, s] of spec.entries()) {
      const id = (await createUser(t.db, { role: 'student', schoolId: schoolB, name: `Murid Kelas Dua ${i + 1}`, grade: 8 })).id
      await enrol(t.db, klass, id)
      await answers(id, s.answers, s.correct, s.first)
      ids.push(id)
    }
    const scope = { kind: 'teacher', teacherId: tb.id } as const
    const per = await xs.tallyByPupil(scope)
    const shown = ids.map((id) => Math.round(xsAccuracy(per.get(id)?.correct ?? 0, per.get(id)?.answered ?? 0) ?? -1))
    expect(shown).toEqual([100, 50, 57])
    // 6 / 10, not the mean of 100, 50 and 57.
    expect(await xs.answerTotals(scope)).toEqual({ answered: 10, correct: 6, accuracy: 60 })

    const who = await login(t, tb.email)
    const live = CommandCenterGuruLiveDataSchema.parse(await get(who, '/guru/command-center/live-data'))
    expect(live.classes[0]).toMatchObject({ studentCount: 3, accuracy: 60 })
    expect(live.accuracy).toBe(60)
  })
})

describe('XsQueries edge cases', () => {
  let e: string
  const mk = async (name: string, grade: number | null, o: { role?: 'student' | 'teacher'; isActive?: boolean } = {}) =>
    (await createUser(t.db, { role: o.role ?? 'student', schoolId: e, name, grade, ...(o.isActive === undefined ? {} : { isActive: o.isActive }) })).id
  const answerAt = async (userId: string, at: string, q: number) =>
    t.db.query(`insert into practice_answers (user_id, question_id, is_correct, answered_at) values ($1::bigint, $2::bigint, true, $3::timestamptz)`, [userId, q, at])

  beforeAll(async () => {
    e = (await t.db.query<{ id: string }>(`insert into schools (name, type) values ('Sekolah Fixture XS Tepi', 'SMK') returning id::text`))[0]?.id as string
  })

  it('grade 7 and 11 are in; grade 6, grade 1 and no grade are out; a student who is also a teacher is counted once', async () => {
    const g7 = await mk('Tepi G7', 7)
    const g11 = await mk('Tepi G11', 11)
    await mk('Tepi G6', 6)
    await mk('Tepi G1', 1) // grade 12 cannot exist: ck_users_grade allows 1..11
    await mk('Tepi Tiada Gred', null)
    const dual = await mk('Tepi Dwi Peranan', 9)
    await t.db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'teacher', now())`, [dual])
    const r = await xs.pupils({ kind: 'school', schoolId: e })
    expect(new Set(r.ids)).toEqual(new Set([g7, g11, dual]))
    expect(r.ids).toHaveLength(r.count)
    expect(r.count).toBe(3)
    // XS-3 sees the dual-role account as a teacher as well (it has no school-admin role).
    expect((await xs.teachers(e)).ids).toContain(dual)
  })

  it('XS-3 counts active approved teachers only: a deactivated and a suspended teacher are out (PO decision 2026-11-05, #503 batch 3)', async () => {
    const before = await xs.teacherCount(e)
    const on = await mk('Tepi Guru Aktif', null, { role: 'teacher' })
    const off = await mk('Tepi Guru Tidak Aktif', null, { role: 'teacher', isActive: false })
    const held = await mk('Tepi Guru Digantung', null, { role: 'teacher' })
    await suspend(t.db, held)
    const r = await xs.teachers(e)
    expect(r.ids).toContain(on)
    expect(r.ids).not.toContain(off)
    expect(r.ids).not.toContain(held)
    expect(await xs.teacherCount(e)).toBe(before + 1)
    // The Command Center teacher list of the school follows the same predicate.
    const repo = t.app.get(CommandCenterRepository, { strict: false })
    expect((await repo.teachersOfSchool(e)).map((x) => x.id).sort()).toEqual([...r.ids].sort())
  })

  // Lead ruling (#479): XS-4/XS-5 agree with the shared S10-T01 reader (AnswerFactsPort, #544) on the same pupils.
  it('XS-4/XS-5 equal the AnswerFactsPort sums of the XS-1 pupils', async () => {
    const port = new AnswerFactsAdapter(t.app.get(PrismaService, { strict: false }))
    const { ids } = await xs.pupils(SCHOOL())
    const facts = await port.answerFacts({ userIds: ids })
    const answered = facts.reduce((n, f) => n + f.attempts, 0)
    const correct = facts.reduce((n, f) => n + f.correct, 0)
    const totals = await xs.answerTotals(SCHOOL())
    expect(answered).toBeGreaterThan(0)
    expect(answered).toBe(totals.answered)
    expect(xsAccuracy(correct, answered)).toBe(totals.accuracy)
  })

  it('a pupil enrolled in two classes of the same teacher is counted once', async () => {
    const tc = await createUser(t.db, { role: 'teacher', schoolId: e, name: 'Tepi Guru Dua Kelas' })
    const c1 = await createClass(t.db, { teacherId: tc.id, schoolId: e, name: 'Tepi K1', grade: 7 })
    const c2 = await createClass(t.db, { teacherId: tc.id, schoolId: e, name: 'Tepi K2', grade: 7 })
    const a = await mk('Tepi Dua Kelas A', 7)
    const b = await mk('Tepi Dua Kelas B', 8)
    await enrol(t.db, c1, a)
    await enrol(t.db, c1, b)
    await enrol(t.db, c2, a)
    await answerAt(a, AT, 7001)
    const scope = { kind: 'teacher', teacherId: tc.id } as const
    expect((await xs.pupils(scope)).count).toBe(2)
    expect(await xs.pupilCount(scope)).toBe(2)
    expect(await xs.answerTotals(scope)).toEqual({ answered: 1, correct: 1, accuracy: 100 })
  })

  it('window bounds are inclusive: an answer exactly at from and one exactly at to are counted, one second outside is not', async () => {
    const u = await mk('Tepi Tepi Tetingkap', 10)
    const from = '2026-09-01T00:00:00+08:00'
    const to = '2026-09-02T00:00:00+08:00'
    await answerAt(u, '2026-08-31T23:59:59+08:00', 7101)
    await answerAt(u, from, 7102)
    await answerAt(u, to, 7103)
    await answerAt(u, '2026-09-02T00:00:01+08:00', 7104)
    const w = { from: new Date(from), to: new Date(to) }
    const scope = { kind: 'school', schoolId: e } as const
    expect(await xs.answers(scope, w)).toBe(2)
    expect(await xs.questionsTested(scope, w)).toBe(2)
    expect(await xs.activePupilCount(scope, w)).toBe(1)
  })
})

describe('Laporan Bulanan on XS-4 (a month with answers but no completed session)', () => {
  it('lists the months by answers, totals equal XS-4 / XS-5 of the window, and subject rows sum to XS-4 (an unfinished session included)', async () => {
    const sc = (await t.db.query<{ id: string }>(`insert into schools (name, type) values ('Sekolah Fixture XS Bulanan', 'SMK') returning id::text`))[0]?.id as string
    const sa = await createUser(t.db, { role: 'school_admin', schoolId: sc, name: 'Admin Bulanan' })
    const subject = await addSubject(t.db, 'XSBLN', 'Subjek XS Bulanan')
    const ids: string[] = []
    const put = async (userId: string, n: number, correct: number, at: string, sessionId: string | null = null) =>
      t.db.query(
        `insert into practice_answers (user_id, session_id, subject_id, is_correct, answered_at)
         select $1::bigint, $2::uuid, $3::bigint, g <= $4, $5::timestamptz + (g || ' seconds')::interval from generate_series(1, $6::int) g`,
        [userId, sessionId, subject, correct, at, n],
      )
    for (let i = 1; i <= 5; i++) {
      const id = (await createUser(t.db, { role: 'student', schoolId: sc, name: `Murid Bulanan XS ${i}`, grade: 8 })).id
      ids.push(id)
      await put(id, 4, 3, '2026-10-10T10:00:00+08:00')
      await put(id, 2, 1, '2026-09-10T10:00:00+08:00')
    }
    await put(ids[0] as string, 2, 0, '2026-10-11T10:00:00+08:00', await session(ids[0] as string, 'chapter', 'in_progress', 2, 0))

    const who = await login(t, sa.email)
    const r = SchoolAdminMonthlyReportSchema.parse((await get(who, '/admin-sekolah/laporan-bulanan')).data)
    expect(r.cards).toMatchObject({ active: 5, answers: 22, sessions: 0, accuracy: 68.2 })
    expect(r.months.map((m) => [m.month, m.answers, m.correct])).toEqual([
      ['2026-09', 10, 5],
      ['2026-10', 22, 15],
    ])
    const sc1 = { kind: 'school', schoolId: sc } as const
    const window = await xs.answerTotals(sc1, { from: new Date('2025-11-01T00:00:00+08:00'), to: new Date('2026-10-31T23:59:59.999+08:00') })
    expect(r.total).toEqual({ answers: window.answered, correct: window.correct, accuracy: window.accuracy })
    expect(r.total).toEqual({ answers: 32, correct: 20, accuracy: 62.5 })
    // Subject rows: every answer has a subject, so the subject answers equal XS-4 of the month.
    const month = await xs.answers(sc1, { from: new Date('2026-10-01T00:00:00+08:00'), to: new Date('2026-10-31T23:59:59.999+08:00') })
    expect(r.subjects.rows.reduce((n, x) => n + x.answers, 0)).toBe(month)
    expect(r.subjects.rows).toEqual([{ name: 'Subjek XS Bulanan', accuracy: 68.2, answers: 22, pupils: 5 }])
  })
})
