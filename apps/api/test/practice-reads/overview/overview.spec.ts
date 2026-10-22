import {
  ErrorBodySchema,
  PracticeReadChapterSubjectDetailSchema,
  PracticeReadChapterSubjectListResponseSchema,
  PracticeReadDashboardSchema,
  PracticeReadSubjectConfigSchema,
  PracticeReadSubjectListResponseSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  type Client,
  START,
  addAnswer,
  addQuestion,
  addSession,
  bootOverviewApp,
  chapterIdOf,
  clearPractice,
  idOf,
  loginAs,
  queue,
  userIdByEmail,
} from './helpers'
import type { CurriculumTestApp } from '../../curriculum/helpers'
import { greetingPeriod } from '../../../src/modules/practice/reads/overview/rules'

const Dashboard = envelopeOf(PracticeReadDashboardSchema)
const SubjectConfig = envelopeOf(PracticeReadSubjectConfigSchema)
const ChapterDetail = envelopeOf(PracticeReadChapterSubjectDetailSchema)

let t: CurriculumTestApp
let pelajar: Client
let pelajar2: Client
let guru: Client
let admin: Client
let u: { pelajar: string; pelajar2: string; guru: string; admin: string }
let w: {
  math: string
  bm: string
  sej: string
  d1: string
  d2: string
  d3: string
  d4: string
  t4: string
  c1: string
  c2: string
  c3: string
  bmC1: string
}
let bankIds: string[] = []

beforeAll(async () => {
  t = await bootOverviewApp()
  pelajar = await loginAs(t, 'pelajar@demo.test')
  pelajar2 = await loginAs(t, 'pelajar2@demo.test')
  guru = await loginAs(t, 'guru@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
  u = {
    pelajar: await userIdByEmail(t.db, 'pelajar@demo.test'),
    pelajar2: await userIdByEmail(t.db, 'pelajar2@demo.test'),
    guru: await userIdByEmail(t.db, 'guru@demo.test'),
    admin: await userIdByEmail(t.db, 'admin@demo.test'),
  }
  w = {
    math: await idOf(t.db, 'subjects', 'MATH'),
    bm: await idOf(t.db, 'subjects', 'BM'),
    sej: await idOf(t.db, 'subjects', 'SEJ'),
    d1: await idOf(t.db, 'education_levels', 'D1'),
    d2: await idOf(t.db, 'education_levels', 'D2'),
    d3: await idOf(t.db, 'education_levels', 'D3'),
    d4: await idOf(t.db, 'education_levels', 'D4'),
    t4: await idOf(t.db, 'education_levels', 'T4'),
    c1: await chapterIdOf(t.db, 'MATH', 'D1', 1),
    c2: await chapterIdOf(t.db, 'MATH', 'D1', 2),
    c3: await chapterIdOf(t.db, 'MATH', 'D1', 3),
    bmC1: await chapterIdOf(t.db, 'BM', 'D1', 1),
  }
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await clearPractice(t.db)
  await t.db.query('delete from questions')
  await t.db.query('update subjects set is_active = true')
  bankIds = []
})

const q = async (opts: Parameters<typeof addQuestion>[1]) => {
  const id = await addQuestion(t.db, opts)
  bankIds.push(id)
  return id
}

/** START is Monday 2026-10-19 09:00 (+08). */
const MON = '2026-10-19T10:00:00+08:00'
const SUN_BEFORE = '2026-10-18T23:00:00+08:00'

describe('access (AC9, AC4)', () => {
  const routes = ['/api/dashboard', '/api/practice/subjects', '/api/practice/subjects/MATH', '/api/practice/chapter-subjects', '/api/practice/chapter-subjects/MATH']

  it('no session is 401 UNAUTHORIZED on every route', async () => {
    for (const url of routes) {
      const res = await t.http().get(url)
      expect(res.status, url).toBe(401)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('UNAUTHORIZED')
    }
  })

  it('every signed-in role may read (student, teacher, admin)', async () => {
    for (const c of [pelajar, guru, admin]) {
      for (const url of routes) {
        const res = await c.get(url)
        expect(res.status, `${url} ${JSON.stringify(res.body).slice(0, 200)}`).toBe(200)
      }
    }
  })

  it('a read needs no CSRF header and is not rate limited', async () => {
    for (let i = 0; i < 5; i++) expect((await pelajar.get('/api/dashboard')).status).toBe(200)
  })
})

describe('#1 GET /api/dashboard (S1)', () => {
  it('parses with the contract schema; own identity, role and the seeded wallet', async () => {
    const res = await pelajar.get('/api/dashboard')
    const d = Dashboard.parse(res.body).data
    expect(d.user).toEqual({ id: u.pelajar, name: expect.any(String), role: 'student' })
    expect(d.user.name).not.toBe('')
    const wallet = (await t.db.query<{ coins: number; xp: number; level: number }>('select current_syiling as coins, xp, level from wallets where user_id = $1', [u.pelajar]))[0]
    expect(d.wallet).toMatchObject({ coins: wallet?.coins, points: wallet?.xp, level: wallet?.level })
    expect(d.trial).toMatchObject({ limit: 50 })
    expect(d.trial.remaining).toBe(50 - d.trial.used)
    expect(d.quests).toEqual([])
    expect(d.badges).toEqual([])
    expect(d.questsCompleted).toBe(0)
  })

  it('a staff caller reads the same shape with its own role and no practice figures', async () => {
    const d = Dashboard.parse((await guru.get('/api/dashboard')).body).data
    expect(d.user.role).toBe('teacher')
    expect(d.week).toEqual({ sessions: 0, accuracyPct: 0 })
    expect(d.revisionTotal).toBe(0)
  })

  it('greeting follows the Malaysia hour (BR-02): 09:00 Pagi, 12:00 Tengah Hari, 15:40 Petang, 19:00 Malam', async () => {
    const cases: [string, string][] = [
      ['2026-10-19T09:00:00+08:00', 'Pagi'],
      ['2026-10-19T11:59:00+08:00', 'Pagi'],
      ['2026-10-19T12:00:00+08:00', 'Tengah Hari'],
      ['2026-10-19T14:59:00+08:00', 'Tengah Hari'],
      ['2026-10-19T15:40:00+08:00', 'Petang'],
      ['2026-10-19T18:59:00+08:00', 'Petang'],
      ['2026-10-19T19:00:00+08:00', 'Malam'],
      ['2026-10-19T00:30:00+08:00', 'Pagi'],
      ['2026-10-18T23:59:00Z', 'Pagi'], // 07:59 in Malaysia
      ['2026-10-19T11:30:00Z', 'Malam'], // 19:30 in Malaysia
    ]
    for (const [at, expected] of cases) expect(greetingPeriod(new Date(at)), at).toBe(expected)
  })

  it('the dashboard greets by the clock: 15:40 is Petang', async () => {
    t.clock.set('2026-10-19T15:40:00+08:00')
    const c = await loginAs(t, 'pelajarmaju@demo.test')
    const res = await c.get('/api/dashboard')
    expect(res.status).toBe(200)
    expect(Dashboard.parse(res.body).data.greetingPeriod).toBe('Petang')
  })

  it('this week is Monday to Sunday (BR-25): sessions finished and accuracy of the answers in the window', async () => {
    await addSession(t.db, { user: u.pelajar, count: 5, correct: 3, completedAt: MON })
    await addSession(t.db, { user: u.pelajar, count: 5, correct: 3, completedAt: '2026-10-21T12:00:00+08:00' })
    await addSession(t.db, { user: u.pelajar, count: 5, correct: 3, completedAt: SUN_BEFORE })
    await addSession(t.db, { user: u.pelajar, count: 5, correct: 3, completedAt: null, status: 'in_progress' })
    await addAnswer(t.db, { user: u.pelajar, subject: w.math, correct: true, at: MON })
    await addAnswer(t.db, { user: u.pelajar, subject: w.math, correct: true, at: '2026-10-20T10:00:00+08:00' })
    await addAnswer(t.db, { user: u.pelajar, subject: w.math, correct: false, at: '2026-10-25T23:59:00+08:00' })
    await addAnswer(t.db, { user: u.pelajar, subject: w.math, correct: false, at: SUN_BEFORE }) // last week
    await addAnswer(t.db, { user: u.pelajar, subject: w.sej, correct: false, at: MON, session: null }) // sessionless counts too
    const d = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
    expect(d.week).toEqual({ sessions: 2, accuracyPct: 50 }) // 2 correct of 4, integer
  })

  it('Mod Pelajar rows (is_test) never reach a real figure; another student rows neither (AC4)', async () => {
    await addSession(t.db, { user: u.pelajar, count: 5, correct: 5, completedAt: MON, isTest: true })
    await addAnswer(t.db, { user: u.pelajar, subject: w.math, correct: true, at: MON, isTest: true })
    await addAnswer(t.db, { user: u.pelajar2, subject: w.math, correct: true, at: MON })
    const d = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
    expect(d.week).toEqual({ sessions: 0, accuracyPct: 0 })
  })

  it('AC4: a teacher sees only its own figures, never the student rows', async () => {
    await addSession(t.db, { user: u.pelajar, count: 5, correct: 5, completedAt: MON })
    await addAnswer(t.db, { user: u.pelajar, subject: w.math, correct: true, at: MON })
    await addAnswer(t.db, { user: u.guru, subject: w.math, correct: false, at: MON })
    expect(Dashboard.parse((await guru.get('/api/dashboard')).body).data.week).toEqual({ sessions: 0, accuracyPct: 0 })
    expect(Dashboard.parse((await pelajar.get('/api/dashboard')).body).data.week).toEqual({ sessions: 1, accuracyPct: 100 })
  })

  it('banners follow the caller audience: a student gets ALL + STUDENT, a teacher ALL, an admin every active one', async () => {
    const titles = async (c: Client) => Dashboard.parse((await c.get('/api/dashboard')).body).data.banners.map((b) => b.title)
    expect(await titles(pelajar)).toEqual(['Contoh: Selamat datang', 'Contoh: Promosi pelajar'])
    expect(await titles(guru)).toEqual(['Contoh: Selamat datang'])
    expect(await titles(admin)).toEqual(['Contoh: Selamat datang', 'Contoh: Promosi pelajar'])
    const first = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data.banners[0]
    expect(first).toEqual({ type: 'HERO', title: 'Contoh: Selamat datang', body: 'Banner contoh untuk semua pengguna.' })
  })

  it('articles: the newest published ones through the content service (at most 5)', async () => {
    const d = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
    const published = await t.db.query<{ slug: string }>('select slug from articles where is_published order by published_at desc nulls last, id desc')
    expect(d.articles.length).toBe(Math.min(5, published.length))
    expect(d.articles.length).toBeGreaterThan(0)
    for (const a of d.articles) {
      expect(published.map((p) => p.slug)).toContain(a.slug)
      expect(a.category).not.toBe('')
    }
  })

  it('revisionTotal counts only queued questions that still have an active link (AC3)', async () => {
    const a = await q({ subject: w.math, level: w.d1 })
    const b = await q({ subject: w.math, level: w.d1 })
    const c = await q({ subject: w.math, level: w.d1 })
    for (const id of [a, b, c]) await queue(t.db, u.pelajar, id, w.math)
    expect(Dashboard.parse((await pelajar.get('/api/dashboard')).body).data.revisionTotal).toBe(3)
    await t.db.query('update questions set is_active = false where id = $1', [b])
    await t.db.query(`update question_versions set status = 'archived' where question_id = $1`, [c])
    expect(Dashboard.parse((await pelajar.get('/api/dashboard')).body).data.revisionTotal).toBe(1)
    // another student's queue does not count
    expect(Dashboard.parse((await pelajar2.get('/api/dashboard')).body).data.revisionTotal).toBe(0)
  })

  it('platform statistics are the bank counts (BR-05): totals, subject cards, level pills, difficulty chart (TP 6 reads as 5)', async () => {
    await q({ subject: w.math, level: w.d1, tp: 1 })
    await q({ subject: w.math, level: w.d1, tp: 2 })
    await q({ subject: w.math, level: w.d2, tp: 6 })
    await q({ subject: w.math, level: w.t4, tp: 4, type: 'structured' })
    await q({ subject: w.bm, level: w.d1, tp: 3 })
    await q({ subject: w.bm, level: w.d1, tp: 3, status: 'draft' }) // not served
    await q({ subject: w.bm, level: w.d1, tp: 3, active: false }) // inactive
    const d = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
    expect(d.stats.totalQuestions).toBe(5)
    expect(d.stats.approvedQuestions).toBe(5)
    expect(d.stats.activeSubjects).toBe(d.subjects.length)
    const card = (code: string) => d.subjects.find((s) => s.code === code)
    expect(card('MATH')).toMatchObject({ approvedCount: 4, bankCount: 4, id: w.math })
    expect(card('BM')).toMatchObject({ approvedCount: 1, bankCount: 1 })
    expect(card('SEJ')).toMatchObject({ approvedCount: 0, bankCount: 0 })
    const pill = (code: string) => d.levelPills.find((p) => p.code === code)
    expect(pill('D1')?.count).toBe(3)
    expect(pill('D2')?.count).toBe(1)
    expect(pill('T4')?.count).toBe(1)
    expect(d.levelPills.length).toBe(d.stats.activeLevels)
    expect(d.difficultyChart).toEqual([
      { level: 1, count: 1 },
      { level: 2, count: 1 },
      { level: 3, count: 1 },
      { level: 4, count: 1 },
      { level: 5, count: 1 },
    ])
    expect(d.difficultyChart.reduce((n, c) => n + c.count, 0)).toBe(d.stats.totalQuestions)
  })

  it('"Statistik Subjek": by bankCount descending, ties by id, mean difficulty 2 decimals, usedCount from the counter', async () => {
    await q({ subject: w.math, level: w.d1, tp: 1 })
    await q({ subject: w.math, level: w.d1, tp: 2 })
    await q({ subject: w.math, level: w.d1, tp: 2 })
    await q({ subject: w.bm, level: w.d1, tp: 5 })
    await t.db.query('insert into subject_usage (subject_id, used_count) values ($1, 7)', [w.math])
    const d = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
    expect(d.subjectStats.length).toBe(d.subjects.length)
    expect(d.subjectStats[0]).toMatchObject({ id: w.math, bankCount: 3, avgDifficulty: 1.67, usedCount: 7 })
    expect(d.subjectStats[1]).toMatchObject({ id: w.bm, bankCount: 1, avgDifficulty: 5, usedCount: 0 })
    const rest = d.subjectStats.slice(2)
    expect(rest.every((s) => s.bankCount === 0 && s.avgDifficulty === 0)).toBe(true)
    const ids = rest.map((s) => BigInt(s.id))
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : 1)))
  })

  it('"Soalan Terkini": the 5 newest published objective questions, text cut at 100 characters + "..."', async () => {
    const long = 'x'.repeat(140)
    for (let i = 0; i < 7; i++) await q({ subject: w.math, level: w.d1, stem: i === 6 ? long : `Soalan nombor ${i}` })
    await q({ subject: w.math, level: w.t4, type: 'structured', stem: 'Struktur' }) // not objective
    const off = await q({ subject: w.math, level: w.d1, stem: 'Dinyahaktif' })
    await t.db.query('update questions set is_active = false where id = $1', [off]) // deactivated: not shown
    await q({ subject: w.math, level: w.d1, status: 'draft', stem: 'Draf' })
    const d = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
    expect(d.recentQuestions.length).toBe(5)
    expect(d.recentQuestions[0]).toMatchObject({ id: bankIds[6], subjectName: expect.any(String), levelCode: 'D1', difficulty: 1 })
    expect(d.recentQuestions[0]?.text).toBe(`${'x'.repeat(100)}...`)
    expect(d.recentQuestions[1]?.text).toBe('Soalan nombor 5')
    expect(d.recentQuestions.map((r) => r.id)).toEqual([bankIds[6], bankIds[5], bankIds[4], bankIds[3], bankIds[2]])
  })

  it('AC2: figures from the answer dimensions do not change when question_id is cleared and rows are marked historical', async () => {
    const qs = [await q({ subject: w.math, level: w.d1, chapter: w.c1 }), await q({ subject: w.math, level: w.d1, chapter: w.c1 })]
    await addSession(t.db, { user: u.pelajar, count: 2, correct: 1, completedAt: MON })
    await addAnswer(t.db, { user: u.pelajar, question: qs[0], subject: w.math, chapter: w.c1, correct: true, at: MON })
    await addAnswer(t.db, { user: u.pelajar, question: qs[1], subject: w.math, chapter: w.c1, correct: false, at: MON })
    const before = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
    await t.db.query('update practice_answers set question_id = null, historical = true where user_id = $1', [u.pelajar])
    await t.db.query('delete from questions')
    const after = Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
    expect(before.week).toEqual({ sessions: 1, accuracyPct: 50 })
    expect(after.week).toEqual(before.week)
  })
})

describe('#2 / #3 practice subjects (S2, S3)', () => {
  it('#2: the active subjects in BR-08 order as an unpaged list with the two counts', async () => {
    await q({ subject: w.math, level: w.d1 })
    const res = await pelajar.get('/api/practice/subjects')
    const body = PracticeReadSubjectListResponseSchema.parse(res.body)
    expect(body.meta).toMatchObject({ page: 1, pageSize: body.data.length, totalItems: body.data.length, totalPages: 1, from: 1, to: body.data.length })
    expect(body.data.map((s) => s.code).slice(0, 4)).toEqual(['BM', 'BI', 'MATH', 'SCI'])
    expect(body.data.find((s) => s.code === 'MATH')).toMatchObject({ approvedCount: 1, bankCount: 1 })
  })

  it('#2: an inactive subject is left out', async () => {
    await t.db.query(`update subjects set is_active = false where code = 'SEJ'`)
    const body = PracticeReadSubjectListResponseSchema.parse((await pelajar.get('/api/practice/subjects')).body)
    expect(body.data.find((s) => s.code === 'SEJ')).toBeUndefined()
    expect((await pelajar.get('/api/practice/subjects/SEJ')).status).toBe(404)
  })

  it('#3 MATH: offered levels Darjah 1-4 with practice counts, difficulty splits overall and per level (BR-11, BR-12)', async () => {
    await q({ subject: w.math, level: w.d1, tp: 1 })
    await q({ subject: w.math, level: w.d1, tp: 2 })
    await q({ subject: w.math, level: w.d2, tp: 5 })
    await q({ subject: w.math, level: w.d2, tp: 6 })
    await q({ subject: w.math, level: w.d1, tp: 3, type: 'structured' }) // not practice (non-MCQ)
    await q({ subject: w.math, level: w.t4, tp: 3 }) // not an offered level
    const d = SubjectConfig.parse((await pelajar.get('/api/practice/subjects/MATH')).body).data
    expect(d.subject).toMatchObject({ code: 'MATH', approvedCount: 6, bankCount: 6 })
    expect(d.levels.map((l) => l.code)).toEqual(['D1', 'D2', 'D3', 'D4'])
    expect(d.levels.map((l) => l.count)).toEqual([2, 2, 0, 0])
    expect(d.total).toBe(4)
    expect(d.difficultyStats).toEqual({ '1': 1, '2': 1, '3': 0, '4': 0, '5': 2 })
    expect(d.difficultyByLevel[w.d1]).toEqual({ '1': 1, '2': 1, '3': 0, '4': 0, '5': 0 })
    expect(d.difficultyByLevel[w.d2]).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 2 })
    expect(Object.keys(d.difficultyByLevel).sort()).toEqual([w.d1, w.d2, w.d3, w.d4].sort())
    expect(d.subjectiveCounts).toEqual({})
    expect(d.trial.limit).toBe(50)
  })

  it('#3: the code is case-insensitive; an unknown code is 404 "Rekod tidak dijumpai."; a subject with only Tingkatan offers no level', async () => {
    expect(SubjectConfig.parse((await pelajar.get('/api/practice/subjects/math')).body).data.subject.code).toBe('MATH')
    const unknown = await pelajar.get('/api/practice/subjects/TIADA')
    expect(unknown.status).toBe(404)
    expect(ErrorBodySchema.parse(unknown.body).error).toMatchObject({ code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' })
    const long = await pelajar.get(`/api/practice/subjects/${'A'.repeat(40)}`)
    expect(long.status).toBe(404)
    const addmath = SubjectConfig.parse((await pelajar.get('/api/practice/subjects/ADDMATH')).body).data
    expect(addmath.levels).toEqual([])
    expect(addmath.total).toBe(0)
    expect(addmath.difficultyStats).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
  })

  it('#3: the trial block follows the caller (used count, remaining)', async () => {
    await t.db.query('update users set trial_questions_used = 18 where id = $1', [u.pelajar])
    const d = SubjectConfig.parse((await pelajar.get('/api/practice/subjects/MATH')).body).data
    expect(d.trial).toMatchObject({ used: 18, limit: 50, remaining: 32 })
  })
})

describe('#7 / #8 chapter mode (S4, S5; BR-15, BR-16)', () => {
  it('#7 lists only the subjects with a chapter that has chapter questions, with chapter and question counts', async () => {
    expect(PracticeReadChapterSubjectListResponseSchema.parse((await pelajar.get('/api/practice/chapter-subjects')).body).data).toEqual([])
    await q({ subject: w.math, level: w.d1, chapter: w.c1 })
    await q({ subject: w.math, level: w.d1, chapter: w.c1 })
    await q({ subject: w.math, level: w.d1, chapter: w.c2 })
    await q({ subject: w.math, level: w.d1 }) // no chapter: counts as a practice question only
    await q({ subject: w.bm, level: w.d1, chapter: w.bmC1, status: 'draft' }) // not served: BM has no chapter practice
    const body = PracticeReadChapterSubjectListResponseSchema.parse((await pelajar.get('/api/practice/chapter-subjects')).body)
    expect(body.data.map((s) => s.code)).toEqual(['MATH'])
    expect(body.data[0]).toMatchObject({ chapterCount: 2, questionCount: 4 })
    expect(body.meta).toMatchObject({ page: 1, pageSize: 1, totalItems: 1, totalPages: 1 })
    expect((await guru.get('/api/practice/chapter-subjects')).status).toBe(200)
  })

  it('#8 chapter 1 is open; chapter k opens when chapter k-1 is complete with a score of at least 70 (BR-16)', async () => {
    const c1 = [await q({ subject: w.math, level: w.d1, chapter: w.c1 }), await q({ subject: w.math, level: w.d1, chapter: w.c1 }), await q({ subject: w.math, level: w.d1, chapter: w.c1 }), await q({ subject: w.math, level: w.d1, chapter: w.c1 })]
    const c2 = [await q({ subject: w.math, level: w.d1, chapter: w.c2 }), await q({ subject: w.math, level: w.d1, chapter: w.c2 })]
    await q({ subject: w.math, level: w.d1, chapter: w.c3 })
    const none = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/MATH')).body).data
    expect(none.chapters.map((c) => c.state)).toEqual(['open', 'locked', 'locked'])
    expect(none.chapters[0]).toMatchObject({ id: w.c1, number: 1, total: 4, answered: 0, correct: 0, scorePct: 0, remaining: 4, complete: false })

    // chapter 1: 3 of 4 right (75 %), complete -> chapter 2 opens
    for (const [i, id] of c1.entries()) await addAnswer(t.db, { user: u.pelajar, question: id, subject: w.math, chapter: w.c1, correct: i !== 3, at: MON })
    const open2 = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/MATH')).body).data
    expect(open2.chapters.map((c) => c.state)).toEqual(['open', 'open', 'locked'])
    expect(open2.chapters[0]).toMatchObject({ answered: 4, correct: 3, scorePct: 75, remaining: 0, complete: true })

    // chapter 2: one of two answered -> not complete -> chapter 3 stays locked
    await addAnswer(t.db, { user: u.pelajar, question: c2[0], subject: w.math, chapter: w.c2, correct: true, at: MON })
    const part = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/MATH')).body).data
    expect(part.chapters[1]).toMatchObject({ answered: 1, correct: 1, scorePct: 100, remaining: 1, complete: false })
    expect(part.chapters[2]?.state).toBe('locked')

    // complete but 50 % -> chapter 3 stays locked
    await addAnswer(t.db, { user: u.pelajar, question: c2[1], subject: w.math, chapter: w.c2, correct: false, at: MON })
    const low = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/MATH')).body).data
    expect(low.chapters[1]).toMatchObject({ complete: true, scorePct: 50 })
    expect(low.chapters[2]?.state).toBe('locked')

    // the latest answer of a question counts: the wrong one is answered again, right
    await addAnswer(t.db, { user: u.pelajar, question: c2[1], subject: w.math, chapter: w.c2, correct: true, at: '2026-10-19T11:00:00+08:00' })
    const fixed = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/MATH')).body).data
    expect(fixed.chapters[1]).toMatchObject({ answered: 2, correct: 2, scorePct: 100, complete: true })
    expect(fixed.chapters[2]?.state).toBe('open')
  })

  it('#8 score is rounded to 1 decimal; the unlock test uses the exact score', async () => {
    const ids: string[] = []
    for (let i = 0; i < 3; i++) ids.push(await q({ subject: w.math, level: w.d1, chapter: w.c1 }))
    await q({ subject: w.math, level: w.d1, chapter: w.c2 })
    for (const [i, id] of ids.entries()) await addAnswer(t.db, { user: u.pelajar, question: id, subject: w.math, chapter: w.c1, correct: i < 2, at: MON })
    const d = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/MATH')).body).data
    expect(d.chapters[0]?.scorePct).toBe(66.7)
    expect(d.chapters[1]?.state).toBe('locked') // 66.7 < 70
  })

  it('#8 reads the caller own answers only (AC4) and in the caller mode (Mod Pelajar rows are not counted)', async () => {
    const id = await q({ subject: w.math, level: w.d1, chapter: w.c1 })
    await q({ subject: w.math, level: w.d1, chapter: w.c2 })
    await addAnswer(t.db, { user: u.pelajar2, question: id, subject: w.math, chapter: w.c1, correct: true, at: MON })
    await addAnswer(t.db, { user: u.pelajar, question: id, subject: w.math, chapter: w.c1, correct: true, at: MON, isTest: true })
    const d = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/MATH')).body).data
    expect(d.chapters[0]).toMatchObject({ answered: 0, correct: 0 })
    expect(d.chapters[1]?.state).toBe('locked')
    // a teacher may open it (no role rule)
    expect((await guru.get('/api/practice/chapter-subjects/MATH')).status).toBe(200)
  })

  it('#8 ?levelId= picks an offered level; an unknown, non-offered or non-numeric level falls back to the first offered one', async () => {
    const d2c1 = await chapterIdOf(t.db, 'MATH', 'D2', 1)
    await q({ subject: w.math, level: w.d1, chapter: w.c1 })
    await q({ subject: w.math, level: w.d2, chapter: d2c1 })
    await q({ subject: w.math, level: w.d2, chapter: d2c1 })
    const get = async (qs: string) => ChapterDetail.parse((await pelajar.get(`/api/practice/chapter-subjects/MATH${qs}`)).body).data
    const first = await get('')
    expect(first.levelId).toBe(w.d1)
    expect(first.levels).toEqual([
      { id: w.d1, name: expect.any(String), count: 1 },
      { id: w.d2, name: expect.any(String), count: 2 },
      { id: w.d3, name: expect.any(String), count: 0 },
      { id: w.d4, name: expect.any(String), count: 0 },
    ])
    expect(first.subject).toMatchObject({ code: 'MATH' })
    const second = await get(`?levelId=${w.d2}`)
    expect(second.levelId).toBe(w.d2)
    expect(second.chapters.map((c) => c.id)).toEqual([d2c1])
    for (const bad of ['?levelId=999999', `?levelId=${w.t4}`, '?levelId=abc', '?levelId=']) expect((await get(bad)).levelId, bad).toBe(w.d1)
  })

  it('#8 a subject offering no level answers empty levels and chapters; an unknown code is 404', async () => {
    const d = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/ADDMATH')).body).data
    expect(d).toMatchObject({ levels: [], levelId: null, chapters: [] })
    const unknown = await pelajar.get('/api/practice/chapter-subjects/TIADA')
    expect(unknown.status).toBe(404)
    expect(ErrorBodySchema.parse(unknown.body).error.message).toBe('Rekod tidak dijumpai.')
  })

  it('#8 AC2 note: rows without a question link are left out of the per-question chapter score (as BE-12), not guessed', async () => {
    const id = await q({ subject: w.math, level: w.d1, chapter: w.c1 })
    await addAnswer(t.db, { user: u.pelajar, question: id, subject: w.math, chapter: w.c1, correct: true, at: MON })
    await addAnswer(t.db, { user: u.pelajar, question: null, subject: w.math, chapter: w.c1, correct: false, at: MON, historical: true })
    const d = ChapterDetail.parse((await pelajar.get('/api/practice/chapter-subjects/MATH')).body).data
    expect(d.chapters[0]).toMatchObject({ answered: 1, correct: 1 })
  })
})
