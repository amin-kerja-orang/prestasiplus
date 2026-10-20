import {
  CommandCenterSessionDetailResponseSchema,
  CommandCenterSessionListResponseSchema,
  CommandCenterStudentResponseSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AuthModule } from '../../src/modules/auth'
import { CommandCenterModule } from '../../src/modules/command-center'
import { PracticeModule, PracticePorts, type PracticeQuestion, type PracticeQuestionSource } from '../../src/modules/practice'
import { UsersModule } from '../../src/modules/users'
import { buildDrillWorld, type DrillWorld } from './drill-fixture'
import { bootCommandCenterApp, type CcTestApp, createAnswers, createSession, expectError, getAs, login, type LoggedIn, loginRole } from './helpers'

/** Drill-down routes 8 to 11: the student page, the subject and week session lists and the session detail. */
let t: CcTestApp
let w: DrillWorld
let admin: LoggedIn
let schoolAdmin: LoggedIn
let teacher: LoggedIn
let teacherB: LoggedIn
let student: LoggedIn
const ids: Record<string, string> = {}

const LONG = 'S'.repeat(200)
const question = (id: string, text: string): PracticeQuestion => ({
  id, versionNo: 3, subjectId: null, educationLevelId: null, chapterId: null, topicId: null, difficulty: 2, questionType: 'mcq', spmPool: false,
  questionText: text, textDirection: 'ltr', scriptType: 'rumi', hasDskp: false, contributor: null,
  options: [{ label: 'A', text: 'Satu' }, { label: 'B', text: 'Dua' }, { label: 'C', text: 'Tiga' }],
  correctLabel: 'A', explanation: null,
})

beforeAll(async () => {
  t = await bootCommandCenterApp({ modules: [AuthModule, UsersModule, PracticeModule, CommandCenterModule] })
  w = await buildDrillWorld(t)
  // The served-question source is owned by BE-09; a fake stands in for it.
  const bank = new Map([['9001@3', question('9001', LONG)], ['9002@3', question('9002', 'Pendek?')]])
  t.app.get(PracticePorts).provideQuestions({ versions: async (refs: readonly { questionId: string; versionNo: number }[]) => new Map(refs.flatMap((r) => { const q = bank.get(`${r.questionId}@${r.versionNo}`); return q ? [[`${r.questionId}@${r.versionNo}`, q] as const] : [] })) } as unknown as PracticeQuestionSource)

  const p1 = w.p.p1
  // p1: a BM session with 3 answers, a free-practice session, a MATH session, a late-night BM session; plus rows that must be hidden.
  ids.bm = await createSession(t.db, { userId: p1, completedAt: '2026-10-19T08:30:00+08:00', subjectCode: 'BM', questionCount: 3, correctCount: 2, timeSpentSec: 125 })
  await createAnswers(t.db, { userId: p1, sessionId: ids.bm, at: '2026-10-19T08:20:00+08:00', count: 3, correct: 2, subjectCode: 'BM' })
  ids.free = await createSession(t.db, { userId: p1, completedAt: '2026-10-14T10:00:00+08:00', questionCount: 10, correctCount: 5, timeSpentSec: 300 })
  ids.math = await createSession(t.db, { userId: p1, completedAt: '2026-10-15T10:00:00+08:00', subjectCode: 'MATH', questionCount: 20, correctCount: 15, timeSpentSec: 1250 })
  ids.late = await createSession(t.db, { userId: p1, completedAt: '2026-10-18T23:59:59+08:00', subjectCode: 'BM', questionCount: 5, correctCount: 5, timeSpentSec: 61 })
  ids.running = await createSession(t.db, { userId: p1, completedAt: '2026-10-16T10:00:00+08:00', status: 'in_progress' })
  ids.test = await createSession(t.db, { userId: p1, completedAt: '2026-10-16T11:00:00+08:00', isTest: true })
  await t.db.query(`insert into streaks (user_id, current, best) values ($1::bigint, 5, 9)`, [p1])

  // p3: a session with three answers for the detail page (two served questions, one answer without a question).
  ids.detail = await createSession(t.db, { userId: w.p.p3, completedAt: '2026-10-19T08:45:00+08:00', subjectCode: 'BM', questionCount: 3, correctCount: 1, timeSpentSec: 125 })
  await t.db.query(`insert into practice_session_questions (session_id, position, question_id, question_version_no) values ($1::uuid, 0, 9001, 3), ($1::uuid, 1, 9002, 3)`, [ids.detail])
  await t.db.query(
    `insert into practice_answers (user_id, session_id, question_id, question_version_no, subject_id, selected_label, is_correct, answered_at)
     values ($1::bigint, $2::uuid, 9001, 3, (select id from subjects where code = 'BM'), 'B', false, '2026-10-19T08:41:00+08:00'),
            ($1::bigint, $2::uuid, 9002, 3, (select id from subjects where code = 'BM'), 'A', true, '2026-10-19T08:42:00+08:00'),
            ($1::bigint, $2::uuid, null, null, (select id from subjects where code = 'BM'), null, false, '2026-10-19T08:43:00+08:00')`,
    [w.p.p3, ids.detail],
  )

  admin = await loginRole(t, 'admin')
  student = await loginRole(t, 'student')
  schoolAdmin = await login(t, w.schoolAdminA.email)
  teacher = await login(t, w.ta.email)
  teacherB = await login(t, w.tb.email)
})
afterAll(async () => {
  await t.close()
})

const NOT_FOUND = 'Not Found.'
const expect404 = async (who: LoggedIn, path: string): Promise<void> => {
  expectError(await getAs(who, path), 'NOT_FOUND', NOT_FOUND)
}

describe('GET /command-center/student/:id', () => {
  it('cards, subject split, 8 weeks, streak, insight and the first class the viewer may open', async () => {
    const res = await getAs(admin, `/command-center/student/${w.p.p1}`)
    expect(res.status).toBe(200)
    const { data } = CommandCenterStudentResponseSchema.parse(res.body)
    expect(data.student).toEqual({ id: w.p.p1, name: 'Murid Satu' })
    expect(data.school).toEqual({ id: w.schoolA, name: 'Sekolah Kajian A' })
    expect(data.teacher).toEqual({ id: w.ta.id, name: 'Guru Alpha' })
    expect(data.class).toEqual({ id: w.a1, name: 'Kelas A1', level: 'T4' })
    // 10 + 4 sessionless answers (7 + 4 correct) and 3 answers of the BM session (2 correct) = 17 answers, 13 correct.
    expect(data.cards).toEqual({ answers: 17, accuracy: 76.5, activeDays: 2, streak: 5, consistency: 4 })
    expect(data.subjects).toEqual([
      { code: 'UMUM', label: 'Latihan Bebas', correct: 11, total: 14, pct: 78.6 },
      { code: 'BM', label: expect.any(String), correct: 2, total: 3, pct: 66.7 },
    ])
    expect(data.weeks).toHaveLength(8)
    expect(data.weeks[0]).toMatchObject({ start: '2026-08-31', end: '2026-09-06', label: '31/08', count: 0 })
    expect(data.weeks[6]).toMatchObject({ start: '2026-10-12', end: '2026-10-18', label: '12/10', count: 4 })
    expect(data.weeks[7]).toMatchObject({ start: '2026-10-19', end: '2026-10-25', label: '19/10', count: 13 })
    expect(data.moodTrend).toEqual([])
    expect(data.headcount).toEqual([])
    expect(data.insight).toEqual({ texts: ['Konsistensi rendah (4%) - perlu usaha lebih.'], source: 'Rule-based Analysis' })
  })

  it('the first class is the first one the VIEWER may open; none gives null class and teacher', async () => {
    await t.db.query(`insert into enrolments (classroom_id, student_id, status, source, joined_at) values ($1::bigint, $2::bigint, 'active', 'teacher', '2026-02-01T08:00:00+08:00')`, [w.a2, w.p.p1])
    const asTeacher = CommandCenterStudentResponseSchema.parse((await getAs(teacher, `/command-center/student/${w.p.p1}`)).body).data
    expect(asTeacher.class?.id).toBe(w.a1)
    await t.db.query(`delete from enrolments where classroom_id = $1::bigint and student_id = $2::bigint`, [w.a2, w.p.p1])
    const loose = CommandCenterStudentResponseSchema.parse((await getAs(admin, `/command-center/student/${w.p.loose}`)).body).data
    expect(loose.class).toBeNull()
    expect(loose.teacher).toBeNull()
    expect(loose.school).toEqual({ id: w.schoolB, name: 'Sekolah Kajian B' })
    expect(loose.cards).toMatchObject({ answers: 2, accuracy: 50, streak: 0 })
  })

  it('a pupil with excellent accuracy gets the insight text', async () => {
    const data = CommandCenterStudentResponseSchema.parse((await getAs(admin, `/command-center/student/${w.p.p7}`)).body).data
    expect(data.cards.accuracy).toBe(100)
    expect(data.insight.texts[0]).toBe('Ketepatan cemerlang (100%).')
  })

  it('scope per role: 404 outside it, never 403', async () => {
    expect((await getAs(teacher, `/command-center/student/${w.p.p5}`)).status).toBe(200) // inactive but an active member
    await expect404(teacher, `/command-center/student/${w.p.p4}`)
    await expect404(teacher, `/command-center/student/${w.p.p7}`) // member of an inactive class only
    await expect404(teacher, `/command-center/student/${w.p.test}`) // is_test enrolment only
    await expect404(teacherB, `/command-center/student/${w.p.p1}`)
    expect((await getAs(schoolAdmin, `/command-center/student/${w.p.p5}`)).status).toBe(200)
    expect((await getAs(schoolAdmin, `/command-center/student/${w.p.p4}`)).status).toBe(200)
    await expect404(schoolAdmin, `/command-center/student/${w.p.q1}`)
    await expect404(schoolAdmin, `/command-center/student/${w.p.p7}`) // no school
    await expect404(admin, `/command-center/student/${w.ta.id}`) // a teacher is not a student
    await expect404(admin, '/command-center/student/999999999')
    await expect404(admin, '/command-center/student/abc')
    expectError(await getAs(student, `/command-center/student/${w.p.p1}`), 'FORBIDDEN')
  })
})

describe('GET /command-center/student/:id/subject', () => {
  it('lists the completed sessions of one subject newest first, totals over the list', async () => {
    const res = await getAs(admin, `/command-center/student/${w.p.p1}/subject?code=BM`)
    expect(res.status).toBe(200)
    const { data } = CommandCenterSessionListResponseSchema.parse(res.body)
    expect(data.sessions.map((s) => s.id)).toEqual([ids.bm, ids.late])
    expect(data.sessions[0]).toMatchObject({ total: 3, correct: 2, accuracy: 66.67, minutes: 2, topic: null })
    expect(data).toMatchObject({ totalAnswers: 8, totalSessions: 2, accuracy: 87.5, timeSpentMinutes: 3 })
  })

  it('UMUM is the free-practice sessions; an unknown or absent code is an empty 200', async () => {
    const free = CommandCenterSessionListResponseSchema.parse((await getAs(admin, `/command-center/student/${w.p.p1}/subject?code=%20UMUM%20`)).body).data
    expect(free.sessions).toHaveLength(1)
    expect(free.sessions[0]).toMatchObject({ id: ids.free, subjectLabel: 'Umum', topic: 'Latihan Bebas', accuracy: 50, minutes: 5 })
    for (const q of ['?code=NOPE', '', '?code=']) {
      const res = await getAs(admin, `/command-center/student/${w.p.p1}/subject${q}`)
      expect(res.status).toBe(200)
      expect(CommandCenterSessionListResponseSchema.parse(res.body).data).toEqual({ totalAnswers: 0, totalSessions: 0, accuracy: 0, timeSpentMinutes: 0, sessions: [] })
    }
  })

  it('running and is_test sessions are never listed; scope is checked', async () => {
    const all = CommandCenterSessionListResponseSchema.parse((await getAs(admin, `/command-center/student/${w.p.p1}/week?start=2026-10-01&end=2026-10-31`)).body).data
    expect(all.sessions.map((s) => s.id)).not.toContain(ids.running)
    expect(all.sessions.map((s) => s.id)).not.toContain(ids.test)
    await expect404(teacherB, `/command-center/student/${w.p.p1}/subject?code=BM`)
    await expect404(schoolAdmin, `/command-center/student/${w.p.q1}/subject?code=BM`)
  })
})

describe('GET /command-center/student/:id/week', () => {
  it('lists the sessions completed in [start 00:00, end + 1 day 00:00) MYT, oldest first', async () => {
    const res = await getAs(admin, `/command-center/student/${w.p.p1}/week?start=2026-10-12&end=2026-10-18`)
    expect(res.status).toBe(200)
    const { data } = CommandCenterSessionListResponseSchema.parse(res.body)
    expect(data.sessions.map((s) => s.id)).toEqual([ids.free, ids.math, ids.late]) // 23:59:59 on the end day is inside, 19 Oct 08:30 is out
    expect(data.sessions[1]).toMatchObject({ subjectLabel: expect.any(String), topic: null, total: 20, correct: 15, accuracy: 75, minutes: 20 })
    expect(data).toMatchObject({ totalAnswers: 35, totalSessions: 3, accuracy: 71.4, timeSpentMinutes: 26 })
    const one = CommandCenterSessionListResponseSchema.parse((await getAs(admin, `/command-center/student/${w.p.p1}/week?start=2026-10-19&end=2026-10-19`)).body).data
    expect(one.sessions.map((s) => s.id)).toEqual([ids.bm])
  })

  it('an invalid range is 422 with fields.start, after the scope check', async () => {
    for (const q of ['', '?start=2026-10-12', '?end=2026-10-12', '?start=2026-10-18&end=2026-10-12', '?start=2026-02-30&end=2026-03-01', '?start=12-10-2026&end=2026-10-18', '?start=a&end=b']) {
      const error = expectError(await getAs(admin, `/command-center/student/${w.p.p1}/week${q}`), 'VALIDATION_ERROR', 'Julat tarikh tidak sah.')
      expect(error.fields).toEqual({ start: 'Julat tarikh tidak sah.' })
    }
    await expect404(teacherB, `/command-center/student/${w.p.p1}/week?start=bad&end=bad`)
  })
})

describe('GET /command-center/session/:sessionId', () => {
  it('serves the answers with the question text of the served version, cut at 150 characters', async () => {
    const res = await getAs(admin, `/command-center/session/${ids.detail}`)
    expect(res.status).toBe(200)
    const { data } = CommandCenterSessionDetailResponseSchema.parse(res.body)
    const name = (await t.db.query<{ name: string }>(`select name from subjects where code = 'BM'`))[0]?.name
    expect(data).toMatchObject({ subjectLabel: name, topic: null, total: 3, correctCount: 1, wrongCount: 2, accuracy: 33.33, timeSpent: { m: 2, s: 5 }, difficulty: null })
    expect(data.answers).toHaveLength(3)
    expect(data.answers[0]).toMatchObject({ no: 1, correct: false, questionText: `${'S'.repeat(150)}...`, selectedAnswer: 'B) Dua', correctAnswer: 'A) Satu' })
    expect(data.answers[1]).toMatchObject({ no: 2, correct: true, questionText: 'Pendek?', selectedAnswer: 'A) Satu', correctAnswer: 'A) Satu' })
    expect(data.answers[2]).toMatchObject({ no: 3, correct: false, questionText: '', selectedAnswer: null, correctAnswer: null })
    expect(data.answers[0]?.answeredAt).toMatch(/^2026-10-19T08:41:00(\.000)?\+08:00$/)
  })

  it('a free-practice session is labelled Latihan Bebas', async () => {
    const data = CommandCenterSessionDetailResponseSchema.parse((await getAs(admin, `/command-center/session/${ids.free}`)).body).data
    expect(data).toMatchObject({ subjectLabel: 'Latihan Bebas', topic: 'Latihan Bebas', answers: [] })
  })

  it('the owner must be in the viewer scope; running, is_test, unknown and malformed ids are 404', async () => {
    expect((await getAs(teacher, `/command-center/session/${ids.detail}`)).status).toBe(200)
    expect((await getAs(schoolAdmin, `/command-center/session/${ids.detail}`)).status).toBe(200)
    await expect404(teacherB, `/command-center/session/${ids.detail}`)
    await expect404(admin, `/command-center/session/${ids.running}`)
    await expect404(admin, `/command-center/session/${ids.test}`)
    await expect404(admin, '/command-center/session/00000000-0000-4000-8000-000000000000')
    await expect404(admin, '/command-center/session/abc')
    await expect404(admin, '/command-center/session/a.b')
    expectError(await getAs(student, `/command-center/session/${ids.detail}`), 'FORBIDDEN')
  })
})
