import {
  PracticeReadCorrectionsSchema,
  PracticeReadHistoryResponseSchema,
  PracticeReadMasterySchema,
  PracticeReadProgressSchema,
  PracticeReadRevisionOverviewSchema,
  PracticeReadRevisionSubjectSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PracticeAnalyticsRepository } from '../../../src/modules/practice/reads/analytics'
import { masteryLevel, shiftMonth, weekStartOf } from '../../../src/modules/practice/reads/analytics/analytics.calc'
import { expectError } from '../../curriculum/helpers'
import {
  type Client,
  START,
  addAnswer,
  addQuestion,
  addSession,
  bootAnalyticsApp,
  chapterIdOf,
  clearPractice,
  idOf,
  loginAs,
  queue,
  userIdByEmail,
} from './helpers'

type T = Awaited<ReturnType<typeof bootAnalyticsApp>>

let t: T
let pelajar: Client
let maju: Client
let guru: Client
let me: string
let other: string
let math: string
let sej: string
let bm: string
let c1: string
let c2: string

beforeAll(async () => {
  t = await bootAnalyticsApp()
  pelajar = await loginAs(t, 'pelajar@demo.test')
  maju = await loginAs(t, 'pelajarmaju@demo.test')
  guru = await loginAs(t, 'guru@demo.test')
  me = await userIdByEmail(t.db, 'pelajar@demo.test')
  other = await userIdByEmail(t.db, 'pelajarmaju@demo.test')
  math = await idOf(t.db, 'subjects', 'MATH')
  sej = await idOf(t.db, 'subjects', 'SEJ')
  bm = await idOf(t.db, 'subjects', 'BM')
  c1 = await chapterIdOf(t.db, 'MATH', 'D1', 1)
  c2 = await chapterIdOf(t.db, 'MATH', 'D1', 2)
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await clearPractice(t.db)
})

const ROUTES = [
  '/api/practice/revision',
  '/api/practice/revision/MATH',
  '/api/practice/progress',
  '/api/practice/history',
  '/api/practice/corrections',
  '/api/practice/mastery',
]

describe('AC9: no session is 401', () => {
  it.each(ROUTES)('GET %s without a session is 401 UNAUTHORIZED', async (route) => {
    expectError(await t.http().get(route), 'UNAUTHORIZED')
  })
})

describe('S6 / S7 revision (AC3)', () => {
  it('counts distinct queued questions per active subject and drops an entry when its question is deactivated (AC3)', async () => {
    const q1 = await addQuestion(t.db)
    const q2 = await addQuestion(t.db)
    const q3 = await addQuestion(t.db)
    const q4 = await addQuestion(t.db)
    await queue(t.db, me, q1, math)
    await queue(t.db, me, q2, math, 3)
    await queue(t.db, me, q3, math)
    await queue(t.db, me, q4, sej)
    // Somebody else's queue never shows.
    await queue(t.db, other, q1, math)

    const res = await pelajar.get('/api/practice/revision')
    expect(res.status).toBe(200)
    const o = envelopeOf(PracticeReadRevisionOverviewSchema).parse(res.body).data
    expect(o.total).toBe(4)
    expect(o.subjects.map((s) => [s.code, s.count])).toEqual(expect.arrayContaining([['MATH', 3], ['SEJ', 1]]))
    expect(o.subjects).toHaveLength(2)
    expect(o.subjects.every((s) => s.count >= 1)).toBe(true)
    const one = envelopeOf(PracticeReadRevisionSubjectSchema).parse((await pelajar.get('/api/practice/revision/MATH')).body).data
    expect(one.count).toBe(3)
    expect(one.subject).toMatchObject({ code: 'MATH', id: math })

    await t.db.query('update questions set is_active = false where id = $1', [q1])
    const after = envelopeOf(PracticeReadRevisionOverviewSchema).parse((await pelajar.get('/api/practice/revision')).body).data
    expect(after.total).toBe(3)
    expect(after.subjects.find((s) => s.code === 'MATH')?.count).toBe(2)
    expect((await pelajar.get('/api/practice/revision/MATH')).body.data.count).toBe(2)
    // The other student still has one entry whose question is now inactive: none.
    expect((await maju.get('/api/practice/revision')).body.data.total).toBe(0)
  })

  it('also drops an entry whose live version is not published, or whose question does not exist', async () => {
    const draft = await addQuestion(t.db, { published: false })
    const live = await addQuestion(t.db)
    await queue(t.db, me, draft, math)
    await queue(t.db, me, live, math)
    await queue(t.db, me, '99999999', math)
    const o = (await pelajar.get('/api/practice/revision')).body.data
    expect(o.total).toBe(1)
    expect(o.subjects).toHaveLength(1)
  })

  it('S7 guard: count 0 is 200, the code is case-insensitive, an unknown or inactive subject is 404 "Rekod tidak dijumpai."', async () => {
    const zero = await pelajar.get('/api/practice/revision/sej')
    expect(zero.status).toBe(200)
    expect(zero.body.data.count).toBe(0)
    expect(zero.body.data.subject.code).toBe('SEJ')
    const missing = await pelajar.get('/api/practice/revision/TIADA')
    expectError(missing, 'NOT_FOUND', 'Rekod tidak dijumpai.')
    await t.db.query(`update subjects set is_active = false where code = 'BM'`)
    expectError(await pelajar.get('/api/practice/revision/BM'), 'NOT_FOUND', 'Rekod tidak dijumpai.')
  })

  it('an empty queue is total 0 and no subjects; an inactive subject has no card but its entries count in total (mock)', async () => {
    expect((await pelajar.get('/api/practice/revision')).body.data).toEqual({ total: 0, subjects: [] })
    const q = await addQuestion(t.db)
    await queue(t.db, me, q, bm)
    await t.db.query(`update subjects set is_active = false where code = 'BM'`)
    const o = (await pelajar.get('/api/practice/revision')).body.data
    expect(o).toEqual({ total: 1, subjects: [] })
  })
})

describe('S6 total definition', () => {
  it('total is the mock definition: every queued question with an active link (distinct, one row per user and question), including a subject that is now inactive; listed cards are the active subjects only', async () => {
    const [a, b, c, gone] = [await addQuestion(t.db), await addQuestion(t.db), await addQuestion(t.db), await addQuestion(t.db, { active: false })]
    await queue(t.db, me, a, math)
    await queue(t.db, me, b, sej)
    await queue(t.db, me, c, bm)
    await queue(t.db, me, gone, bm)
    await t.db.query(`update subjects set is_active = false where code = 'BM'`)
    const o = envelopeOf(PracticeReadRevisionOverviewSchema).parse((await pelajar.get('/api/practice/revision')).body).data
    const distinct = Number((await t.db.query<{ n: string }>('select count(distinct question_id)::text as n from revision_queue where user_id = $1 and question_id <> $2', [me, gone]))[0]?.n)
    expect(o.total).toBe(distinct)
    expect(o.total).toBe(3)
    expect(o.subjects.map((x) => x.code).sort()).toEqual(['MATH', 'SEJ'])
    expect(o.subjects.reduce((n, x) => n + x.count, 0)).toBe(2)
  })
})

describe('S8 progress', () => {
  async function seed() {
    // Today is Monday 2026-10-19 (09:00 MYT on the frozen clock).
    await addAnswer(t.db, { user: me, subject: math, correct: true, at: '2026-10-19T08:00:00+08:00' })
    await addAnswer(t.db, { user: me, subject: math, correct: false, at: '2026-10-19T08:05:00+08:00' })
    await addAnswer(t.db, { user: me, question: '900', subject: null, correct: true, at: '2026-10-19T08:10:00+08:00' })
    await addAnswer(t.db, { user: me, subject: math, correct: true, at: '2026-10-18T10:00:00+08:00' })
    await addAnswer(t.db, { user: me, subject: sej, correct: false, at: '2026-10-18T10:01:00+08:00' })
    await addAnswer(t.db, { user: me, subject: sej, correct: false, at: '2026-10-18T10:02:00+08:00' })
    await addAnswer(t.db, { user: me, subject: sej, correct: true, at: '2026-10-10T10:00:00+08:00' })
    await addAnswer(t.db, { user: me, subject: math, correct: true, at: '2026-06-01T10:00:00+08:00' })
    // Mod Pelajar and other users never count.
    await addAnswer(t.db, { user: me, subject: math, correct: false, at: '2026-10-19T08:20:00+08:00', isTest: true })
    await addAnswer(t.db, { user: other, subject: math, correct: false, at: '2026-10-19T08:30:00+08:00' })
    await addSession(t.db, { user: me, count: 3, correct: 2, seconds: 125, completedAt: '2026-10-18T10:05:00+08:00' })
    await addSession(t.db, { user: me, count: 3, correct: 2, seconds: 130, completedAt: '2026-10-05T10:05:00+08:00' })
    await addSession(t.db, { user: me, count: 3, correct: 2, seconds: 600, completedAt: '2026-10-18T11:05:00+08:00', isTest: true })
    await addSession(t.db, { user: me, count: 3, correct: 2, seconds: 600, completedAt: null, status: 'in_progress' })
  }
  const get = async (q = '') => PracticeReadProgressSchema.parse((await pelajar.get(`/api/practice/progress${q}`)).body.data)

  it('default window is 30 days: answers with or without a session, daily chart, subjects, weak subjects, sessions and minutes', async () => {
    await seed()
    const p = await get()
    expect(p.period).toBe('30')
    expect(p.answered).toBe(7)
    expect(p.accuracyPct).toBe(57.1)
    expect(p.sessions).toBe(2)
    expect(p.minutes).toBe(4)
    expect(p.chart).toEqual({ labels: ['10/10', '18/10', '19/10'], accuracy: [100, 33.3, 66.7], counts: [1, 3, 3] })
    const m = p.subjects.find((s) => s.code === 'MATH')
    const s = p.subjects.find((x) => x.code === 'SEJ')
    expect(m).toMatchObject({ answered: 3, correct: 2, wrong: 1, accuracyPct: 66.7, trend: [100, 50] })
    expect(s).toMatchObject({ answered: 3, correct: 1, wrong: 2, accuracyPct: 33.3, trend: [100, 0] })
    expect(p.weakSubjects.map((w) => w.code)).toEqual(['SEJ'])
  })

  it('period 7, 90 and all narrow or widen the window', async () => {
    await seed()
    const p7 = await get('?period=7')
    expect([p7.period, p7.answered, p7.accuracyPct, p7.sessions, p7.minutes]).toEqual(['7', 6, 50, 1, 2])
    const p90 = await get('?period=90')
    expect(p90.answered).toBe(7)
    const all = await get('?period=all')
    expect([all.period, all.answered, all.accuracyPct]).toEqual(['all', 8, 62.5])
  })

  it('an unknown period is 200 with period null and zero figures, never 422', async () => {
    await seed()
    for (const q of ['?period=bogus', '?period=', '?period=14']) {
      const res = await pelajar.get(`/api/practice/progress${q}`)
      expect(res.status).toBe(200)
      expect(PracticeReadProgressSchema.parse(res.body.data)).toEqual({
        period: null,
        answered: 0,
        accuracyPct: null,
        sessions: 0,
        minutes: 0,
        chart: { labels: [], accuracy: [], counts: [] },
        weakSubjects: [],
        subjects: [],
      })
    }
  })

  it('a user with no answers gets accuracy null and an empty chart', async () => {
    const p = PracticeReadProgressSchema.parse((await maju.get('/api/practice/progress')).body.data)
    expect(p).toMatchObject({ period: '30', answered: 0, accuracyPct: null, sessions: 0, subjects: [] })
  })
})

describe('S9 history (AC1 paging, AC4, is_test)', () => {
  async function seed() {
    for (let i = 0; i < 17; i++) {
      await addSession(t.db, { user: me, mode: 'chapter', count: 10, correct: 5, coins: 5, seconds: 60, completedAt: `2026-09-01T${String(i).padStart(2, '0')}:00:00+08:00` })
    }
    await addSession(t.db, { user: me, mode: 'revision', count: 10, correct: 10, coins: 10, seconds: 60, completedAt: '2026-10-19T07:00:00+08:00' })
    await addSession(t.db, { user: me, count: 2, correct: 1, coins: 1, completedAt: '2026-10-19T06:00:00+08:00', isTest: true })
    await addSession(t.db, { user: me, count: 3, correct: 1, coins: 1, completedAt: '2025-12-30T10:00:00+08:00' })
    await addSession(t.db, { user: me, count: 0, correct: 0, coins: 0, completedAt: '2026-08-01T10:00:00+08:00' })
    await addSession(t.db, { user: me, count: 5, correct: 5, completedAt: null, status: 'in_progress' })
    await addSession(t.db, { user: other, count: 9, correct: 9, coins: 9, completedAt: '2026-10-19T05:00:00+08:00' })
  }
  const get = async (q = '') => PracticeReadHistoryResponseSchema.parse((await pelajar.get(`/api/practice/history${q}`)).body)

  it('newest first, 15 per page with meta and all-time totals; the own Mod Pelajar session is part of the own history', async () => {
    await seed()
    const p1 = await get()
    expect(p1.data).toHaveLength(15)
    expect(p1.meta).toMatchObject({ page: 1, pageSize: 15, totalItems: 21, totalPages: 2, from: 1, to: 15 })
    expect(p1.meta.totals).toEqual({ sessions: 21, answered: 185, avgAccuracyPct: 51.7, coins: 97 })
    expect(p1.data[0]).toMatchObject({
      mode: 'revision',
      badge: { label: 'Ulang Kaji', icon: 'fa-redo-alt', color: '#EA580C' },
      completedAt: '2026-10-19T07:00:00.000+08:00',
      questionCount: 10,
      correctCount: 10,
      wrongCount: 0,
      accuracyPct: 100,
      timeSpent: 60,
      coinsEarned: 10,
    })
    expect(p1.data[1]).toMatchObject({ questionCount: 2, correctCount: 1, accuracyPct: 50 })
    const p2 = await get('?page=2')
    expect(p2.data).toHaveLength(6)
    expect(p2.meta).toMatchObject({ page: 2, from: 16, to: 21 })
    expect(p2.data.at(-1)).toMatchObject({ completedAt: '2025-12-30T10:00:00.000+08:00', accuracyPct: 33.33, wrongCount: 2 })
    expect(p2.data[3]?.badge.label).toBe('Bab')
    const ids = new Set([...p1.data, ...p2.data].map((d) => d.id))
    expect(ids.size).toBe(21)
    const beyond = await get('?page=3')
    expect(beyond.data).toEqual([])
    expect(beyond.meta).toMatchObject({ page: 3, totalItems: 21, from: null, to: null })
  })

  it('period filters the page but never the totals (BR-21); an unknown period lists every session', async () => {
    await seed()
    for (const [q, n] of [['?period=week', 2], ['?period=month', 2], ['?period=year', 20], ['?period=bogus', 21], ['?period=', 21]] as const) {
      const r = await get(q)
      expect(r.meta.totalItems, q).toBe(n)
      expect(r.data.length, q).toBe(Math.min(15, n))
      expect(r.meta.totals.sessions, q).toBe(21)
    }
  })

  it('an invalid page means page 1 (never 422)', async () => {
    await seed()
    for (const q of ['?page=0', '?page=abc', '?page=-2', '?page=1.5', '?page=99999999999999999999']) {
      const res = await pelajar.get(`/api/practice/history${q}`)
      expect(res.status, q).toBe(200)
      expect(PracticeReadHistoryResponseSchema.parse(res.body).meta.page, q).toBe(1)
    }
  })

  it('AC4: a teacher sees only their own sessions, never a student\'s', async () => {
    await seed()
    const teacher = await userIdByEmail(t.db, 'guru@demo.test')
    expect((await guru.get('/api/practice/history')).body.data).toEqual([])
    await addSession(t.db, { user: teacher, mode: 'random', count: 4, correct: 3, coins: 3, completedAt: '2026-10-19T08:00:00+08:00' })
    const res = PracticeReadHistoryResponseSchema.parse((await guru.get('/api/practice/history')).body)
    expect(res.data).toHaveLength(1)
    expect(res.data[0]).toMatchObject({ questionCount: 4, correctCount: 3 })
    expect(res.meta.totals).toEqual({ sessions: 1, answered: 4, avgAccuracyPct: 75, coins: 3 })
    // The student's feed is untouched by the teacher's session.
    expect((await get()).meta.totals.sessions).toBe(21)
  })

  it('an empty history is an empty page with zero totals', async () => {
    const r = PracticeReadHistoryResponseSchema.parse((await maju.get('/api/practice/history')).body)
    expect(r.data).toEqual([])
    expect(r.meta).toMatchObject({ page: 1, pageSize: 15, totalItems: 0, totalPages: 1, from: null, to: null })
    expect(r.meta.totals).toEqual({ sessions: 0, answered: 0, avgAccuracyPct: 0, coins: 0 })
  })
})

describe('S11 corrections', () => {
  async function seed() {
    const pastYear = await addSession(t.db, { user: me, mode: 'past_year', count: 1, correct: 0, completedAt: '2026-10-07T10:00:00+08:00' })
    const a = (question: string, subject: string | null, correct: boolean, at: string, extra: { session?: string; isTest?: boolean } = {}) =>
      addAnswer(t.db, { user: me, question, subject, correct, at, ...extra })
    await a('1', math, false, '2026-10-02T10:00:00+08:00')
    await a('1', math, true, '2026-10-05T10:00:00+08:00')
    await a('2', math, true, '2026-10-01T00:30:00+08:00')
    await a('2', math, false, '2026-10-06T10:00:00+08:00')
    await a('3', sej, false, '2026-10-04T10:00:00+08:00')
    await a('4', sej, false, '2026-09-30T23:30:00+08:00')
    await a('4', sej, true, '2026-10-05T11:00:00+08:00')
    await a('5', math, false, '2026-10-07T10:00:00+08:00', { session: pastYear })
    await a('6', math, true, '2026-10-08T10:00:00+08:00', { isTest: true })
    await a('7', null, true, '2026-10-08T10:00:00+08:00')
  }
  const get = async (q = '') => PracticeReadCorrectionsSchema.parse((await pelajar.get(`/api/practice/corrections${q}`)).body.data)

  it('first attempt versus later attempt per question in the month; past_year, test and subject-less answers are left out', async () => {
    await seed()
    const c = await get()
    expect(c).toEqual({
      month: '2026-10',
      prevMonth: '2026-09',
      nextMonth: null,
      summary: { before: 33.3, after: 66.7, delta: 33.3, questions: 3 },
      subjects: [
        { name: expect.any(String), color: expect.any(String), questions: 2, before: 50, after: 100, delta: 50 },
        { name: expect.any(String), color: expect.any(String), questions: 1, before: 0, after: 0, delta: 0 },
      ],
    })
  })

  it('a past month links forward; a question is counted in the month of its first attempt', async () => {
    await seed()
    const sep = await get('?month=2026-09')
    expect(sep).toMatchObject({ month: '2026-09', prevMonth: '2026-08', nextMonth: '2026-10' })
    expect(sep.summary).toEqual({ before: 0, after: 100, delta: 100, questions: 1 })
    const empty = await get('?month=2026-01')
    expect(empty.summary).toBeNull()
    expect(empty.subjects).toEqual([])
    expect(empty.nextMonth).toBe('2026-02')
  })

  it('a missing or malformed month shows the current one (never 422)', async () => {
    for (const q of ['', '?month=', '?month=2026-13', '?month=26-10', '?month=abc']) {
      const res = await pelajar.get(`/api/practice/corrections${q}`)
      expect(res.status, q).toBe(200)
      expect(res.body.data.month, q).toBe('2026-10')
    }
  })
})

describe('S12 mastery', () => {
  const bulk = (subject: string, answered: number, correct: number) =>
    t.db.query(
      `insert into practice_answers (user_id, question_id, subject_id, is_correct, answered_at)
       select $1, g, $2, g <= $4, '2026-10-01T10:00:00+08:00'::timestamptz from generate_series(1, $3::int) g`,
      [me, subject, answered, correct],
    )
  const get = async () => PracticeReadMasterySchema.parse((await pelajar.get('/api/practice/mastery')).body.data)

  it('without stored counters the level comes from the answer log, in M03 order, with the L0-L10 scale', async () => {
    await bulk(math, 30, 12)
    await bulk(sej, 60, 55)
    await addAnswer(t.db, { user: me, subject: sej, correct: true, at: '2026-10-02T10:00:00+08:00', isTest: true })
    const m = await get()
    expect(m.scale).toHaveLength(11)
    expect(m.scale[0]).toEqual({ level: 0, label: 'Pemula' })
    expect(m.scale[10]).toEqual({ level: 10, label: 'Mythical' })
    expect(m.subjects.map((s) => s.code)).toEqual(expect.arrayContaining(['MATH', 'SEJ']))
    expect(m.subjects).toHaveLength(2)
    const mat = m.subjects.find((s) => s.code === 'MATH')
    const sejCard = m.subjects.find((s) => s.code === 'SEJ')
    expect(mat).toMatchObject({ level: 1, label: 'Mula Belajar', correct: 12, answered: 30, accuracyPct: 40, nextLevel: 2, nextThreshold: 25, barPct: 13.3, xpMultiplier: null })
    expect(sejCard).toMatchObject({ level: 3, label: 'Tekun', correct: 55, answered: 60, accuracyPct: 91.7, nextLevel: 4, nextThreshold: 100, barPct: 10, xpMultiplier: 1.1 })
    expect(sejCard?.lastAnsweredAt).toBe('2026-10-01T10:00:00.000+08:00')
  })

  it('stored counters win when the user has any; an inactive subject has no card', async () => {
    await bulk(math, 30, 12)
    await t.db.query(`insert into mastery (user_id, subject_id, correct, answered, last_answered_at) values ($1, $2, 1600, 1700, '2026-10-03T10:00:00+08:00')`, [me, math])
    await t.db.query(`insert into mastery (user_id, subject_id, correct, answered) values ($1, $2, 5, 9)`, [me, bm])
    await t.db.query(`update subjects set is_active = false where code = 'BM'`)
    const m = await get()
    expect(m.subjects.map((s) => s.code)).toEqual(['MATH'])
    expect(m.subjects[0]).toMatchObject({ level: 10, label: 'Mythical', nextLevel: null, nextThreshold: null, barPct: 100, xpMultiplier: 1.45, lastAnsweredAt: '2026-10-03T10:00:00.000+08:00' })
  })

  it('a user who answered nothing has the scale and no cards', async () => {
    const m = PracticeReadMasterySchema.parse((await maju.get('/api/practice/mastery')).body.data)
    expect(m.subjects).toEqual([])
    expect(m.scale).toHaveLength(11)
  })
})

describe('AC2: figures come from the answer rows, not from the question bank', () => {
  it('setting question_id null and historical true on every answer of a student leaves mastery, accuracy and progress identical', async () => {
    const q = [await addQuestion(t.db), await addQuestion(t.db)]
    await addAnswer(t.db, { user: me, question: q[0], subject: math, chapter: c1, correct: true, at: '2026-10-19T08:00:00+08:00' })
    await addAnswer(t.db, { user: me, question: q[1], subject: math, chapter: c1, correct: false, at: '2026-10-18T08:00:00+08:00' })
    await addAnswer(t.db, { user: me, question: q[1], subject: sej, chapter: null, correct: true, at: '2026-10-17T08:00:00+08:00' })
    await addSession(t.db, { user: me, count: 2, correct: 1, seconds: 90, completedAt: '2026-10-18T09:00:00+08:00' })
    const snap = async () => ({
      progress30: (await pelajar.get('/api/practice/progress')).body,
      progressAll: (await pelajar.get('/api/practice/progress?period=all')).body,
      mastery: (await pelajar.get('/api/practice/mastery')).body,
      history: (await pelajar.get('/api/practice/history')).body,
      chapters: await t.app.get(PracticeAnalyticsRepository).chapterAnswerCounts(me, 1),
    })
    const before = await snap()
    expect(before.progress30.data.answered).toBe(3)
    expect(before.mastery.data.subjects).toHaveLength(2)
    const changed = await t.db.query('update practice_answers set question_id = null, historical = true where user_id = $1 returning id', [me])
    expect(changed).toHaveLength(3)
    // Even deleting the questions themselves changes nothing.
    await t.db.query('delete from questions')
    expect(await snap()).toEqual(before)
  })
})

describe('chapterAnswerCounts (for BE-48)', () => {
  it('groups the answer rows by chapter with a minimum attempt count; no question join, no test rows, own rows only', async () => {
    const repo = t.app.get(PracticeAnalyticsRepository)
    const add = (chapter: string | null, correct: boolean, extra: { isTest?: boolean; user?: string } = {}) =>
      addAnswer(t.db, { user: extra.user ?? me, subject: math, chapter, correct, at: '2026-10-10T10:00:00+08:00', isTest: extra.isTest })
    for (const ok of [true, true, true, false, false]) await add(c1, ok)
    for (const ok of [true, true]) await add(c2, ok)
    for (const ok of [true, false, true]) await add(null, ok)
    await add(c1, false, { isTest: true })
    await add(c1, true, { user: other })
    expect(await repo.chapterAnswerCounts(me, 3)).toEqual([{ chapterId: c1, attempts: 5, correct: 3 }])
    expect(await repo.chapterAnswerCounts(me, 1)).toEqual(
      [
        { chapterId: c1, attempts: 5, correct: 3 },
        { chapterId: c2, attempts: 2, correct: 2 },
      ].sort((a, b) => Number(BigInt(a.chapterId) - BigInt(b.chapterId))),
    )
    expect(await repo.chapterAnswerCounts(me, 6)).toEqual([])
    expect(await repo.chapterAnswerCounts(other, 1)).toEqual([{ chapterId: c1, attempts: 1, correct: 1 }])
  })
})

describe('pure helpers', () => {
  it('masteryLevel follows the BR-20 thresholds', () => {
    expect([0, 9, 10, 24, 25, 49, 50, 99, 100, 1499, 1500, 99999].map(masteryLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 9, 10, 10])
  })
  it('shiftMonth crosses year ends and weekStartOf is Monday 00:00 in Malaysia time', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    // Sunday 2026-10-18 23:00 +08:00 belongs to the week starting Monday 2026-10-12.
    expect(new Date(weekStartOf(new Date('2026-10-18T23:00:00+08:00').getTime())).toISOString()).toBe('2026-10-11T16:00:00.000Z')
  })
})
