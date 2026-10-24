/**
 * M05-T1: the dashboard and read handlers (SRS M05 v1.17 §7 #1–#3, #7–#14) against the §6.12
 * "Resulting anchors" (admin, pelajar, pelajarmaju) and the empty-state figures of pelajar2, the
 * teacher (5) and the school admin (8). Booted with the real core, M01, M02, M03, M04, M05, M09 and
 * M14 at the project clock 2026-09-25 15:40 MYT. The canonical sessions and answers are F-26's;
 * nothing is re-contributed here. Read-only: the hook tests live in `hooks.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'

import type {
  ChapterSubject,
  ChapterSubjectDetail,
  Corrections,
  Dashboard,
  HistoryItem,
  HistoryTotals,
  Mastery,
  PracticeSubject,
  Progress,
  RevisionOverview,
  RevisionSubject,
  SubjectConfig,
} from '../../api/types'
import { greetingPeriod } from '../../mock/handlers/dashboard'
import { masteryLevel } from '../../mock/handlers/learner'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  MAJU,
  MemoryStorage,
  PELAJAR,
  type ErrorBody,
  type ListBody,
  PELAJAR2,
  bootAll,
  getAs,
} from './boot-all'
import { request } from './helpers'

type HistoryBody = ListBody<HistoryItem, { totals: HistoryTotals }>

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootAll()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const data = async <T>(userId: number, url: string): Promise<T> => {
  const r = await getAs<{ data: T }>(runtime, userId, url)
  expect(r.status, url).toBe(200)
  return r.body.data
}
const dash = (userId: number) => data<Dashboard>(userId, '/api/dashboard')

// ---------------------------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------------------------

describe('access (FR-M05-130)', () => {
  it.each([
    '/api/dashboard',
    '/api/practice/subjects',
    '/api/practice/subjects/BM',
    '/api/practice/chapter-subjects',
    '/api/practice/chapter-subjects/MATH',
    '/api/practice/revision',
    '/api/practice/revision/BM',
    '/api/practice/progress',
    '/api/practice/history',
    '/api/practice/corrections',
    '/api/practice/mastery',
  ])('%s answers 401 UNAUTHORIZED without a session', async (url) => {
    const res = await runtime.transport.request({
      method: 'GET',
      url,
      headers: { accept: 'application/json' },
    })
    expect(res.status).toBe(401)
    expect((res.body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED')
  })
})

// ---------------------------------------------------------------------------------------------
// #1 Dashboard
// ---------------------------------------------------------------------------------------------

describe('#1 GET /api/dashboard (S1)', () => {
  it('account 2 (pelajar): 370 syiling / 916 xp, streak 2, trial 18 of 50, week 4 sessions', async () => {
    const d = await dash(PELAJAR)
    expect(d.user).toEqual({ id: 2, name: 'Pelajar Demo', role: 'student' })
    expect(d.wallet).toEqual({ coins: 370, points: 916, level: 1, levelProgressPct: 100 })
    expect(d.streak.count).toBe(2)
    expect(d.trial).toEqual({ active: true, used: 32, limit: 50, remaining: 18 })
    // Week 21–27 Sep: P1 (22 Sep), P2, P3 (24 Sep), P4 (25 Sep) = 94 answers, 70 correct → 74 %.
    expect(d.week).toEqual({ sessions: 4, accuracyPct: 74 })
    expect(d.revisionTotal).toBe(24)
    expect(d.badges).toEqual([])
  })

  it('account 4 (pelajarmaju): streak 3, week 4 sessions / 70 %, quests 4 of 10, revision badge 4, subscribed', async () => {
    const d = await dash(MAJU)
    expect(d.wallet).toEqual({ coins: 267, points: 432, level: 3, levelProgressPct: 100 })
    expect(d.streak.count).toBe(3)
    expect(d.week).toEqual({ sessions: 4, accuracyPct: 70 })
    expect(d.questsCompleted).toBe(4)
    expect(d.quests).toHaveLength(10)
    expect(d.revisionTotal).toBe(4)
    expect(d.trial.active).toBe(false)
  })

  it('account 1 (admin): 256 / 8 / level 2 / 7 %, streak 1, trial 0 of 50, revision 72, no week activity', async () => {
    const d = await dash(ADMIN)
    expect(d.wallet).toEqual({ coins: 256, points: 8, level: 2, levelProgressPct: 7 })
    expect(d.streak).toEqual({ count: 1, practisedToday: false })
    expect(d.trial).toEqual({ active: true, used: 50, limit: 50, remaining: 0 })
    expect(d.revisionTotal).toBe(72)
    expect(d.week).toEqual({ sessions: 0, accuracyPct: 0 })
  })

  it.each([
    ['pelajar2', PELAJAR2],
    ['teacher', GURU],
    ['school admin', ADMIN_SEKOLAH],
  ])('%s: the empty-state figures (BR-25 defaults)', async (_name, id) => {
    const d = await dash(id)
    expect(d.wallet).toEqual({ coins: 0, points: 0, level: 1, levelProgressPct: 0 })
    expect(d.streak).toEqual({ count: 0, practisedToday: false })
    expect(d.trial).toEqual({ active: true, used: 0, limit: 50, remaining: 50 })
    expect(d.week).toEqual({ sessions: 0, accuracyPct: 0 })
    expect(d.questsCompleted).toBe(0)
    expect(d.quests.every((q) => q.progress === 0 && !q.completed)).toBe(true)
    expect(d.revisionTotal).toBe(0)
    expect(d.badges).toEqual([])
  })

  it('the 10 quests of the M14 catalogue, in order, with the chip label and the syiling reward', async () => {
    const d = await dash(PELAJAR2)
    expect(d.quests.map((q) => q.title)).toEqual([
      'Rajin Berlatih',
      'Si Tepat',
      'Penjelajah Topik',
      'Kilat Matematik',
      'Mula Hari Ini',
      'Jawab 5 Betul',
      'Latihan 10 Minit',
      'Kombo 2 Hari',
      'Ketepatan 90%',
      'Cabaran Kilat',
    ])
    expect(d.quests.map((q) => q.reward)).toEqual([15, 20, 25, 30, 10, 12, 20, 25, 35, 40])
    expect(d.quests[0]).toMatchObject({
      key: '1',
      emoji: '📝',
      difficulty: 'easy',
      target: 3,
    })
    expect(d.quests.map((q) => q.difficulty)).toContain('hard')
    expect(d.quests[0]).not.toHaveProperty('difficultyLabel')
  })

  it('greeting period follows the local hour (BR-02); 15:40 is Petang', async () => {
    expect((await dash(PELAJAR)).greetingPeriod).toBe('Petang')
    const at = (hhmm: string) => Date.parse(`2026-09-25T${hhmm}:00+08:00`)
    expect(greetingPeriod(at('00:00'))).toBe('Pagi')
    expect(greetingPeriod(at('11:59'))).toBe('Pagi')
    expect(greetingPeriod(at('12:00'))).toBe('Tengah Hari')
    expect(greetingPeriod(at('14:59'))).toBe('Tengah Hari')
    expect(greetingPeriod(at('15:00'))).toBe('Petang')
    expect(greetingPeriod(at('18:59'))).toBe('Petang')
    expect(greetingPeriod(at('19:00'))).toBe('Malam')
    expect(greetingPeriod(at('23:59'))).toBe('Malam')
  })

  it('banners: the 5 live announcements for a student, filtered by audience for the teacher; articles: 5 newest', async () => {
    const d = await dash(PELAJAR)
    expect(d.banners).toHaveLength(5)
    expect(d.banners[0]).toEqual({
      type: 'HERO',
      title: 'Selamat Datang ke PRESTASIPLUS',
      body: expect.any(String),
    })
    expect((await dash(GURU)).banners.length).toBeLessThan(5)
    expect(d.articles).toHaveLength(5)
    expect(d.articles[0]).toEqual({
      slug: expect.any(String),
      title: expect.any(String),
      category: expect.any(String),
      publishedAt: expect.stringMatching(/\+08:00$/),
    })
    const dates = d.articles.map((a) => a.publishedAt ?? '')
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('platform statistics are the M04 named queries (BR-05, FR-M05-24, FR-M05-27)', async () => {
    const d = await dash(PELAJAR)
    expect(d.stats).toEqual({
      totalQuestions: 130_152,
      activeSubjects: 31,
      activeLevels: 11,
      approvedQuestions: 129_752,
    })
    expect(d.difficultyChart).toEqual([
      { level: 1, count: 39_694 },
      { level: 2, count: 47_138 },
      { level: 3, count: 33_720 },
      { level: 4, count: 9_600 },
      { level: 5, count: 0 },
    ])
    expect(d.difficultyChart.reduce((a, r) => a + r.count, 0)).toBe(d.stats.totalQuestions)
    expect(d.levelPills).toHaveLength(11)
    expect(d.levelPills.reduce((a, l) => a + l.count, 0)).toBe(129_380)
  })

  it('subject cards: 31 in BR-01 order; Q-ELIGIBLE / Q-ACTIVE counts (Pendidikan Moral 15,014 vs 15,414)', async () => {
    const d = await dash(PELAJAR)
    expect(d.subjects).toHaveLength(31)
    expect(d.subjects.slice(0, 3).map((s) => s.code)).toEqual(['BM', 'BI', 'MATH'])
    const math = d.subjects.find((s) => s.code === 'MATH')
    expect(math).toMatchObject({ approvedCount: 13_872, bankCount: 13_872, isCore: true })
    const pm = d.subjects.find((s) => s.code === 'PM')
    expect(pm).toMatchObject({ approvedCount: 15_014, bankCount: 15_414 })
    expect(d.subjects.reduce((a, s) => a + s.approvedCount, 0)).toBe(128_989)
    expect(d.subjects.reduce((a, s) => a + s.bankCount, 0)).toBe(129_389)
  })

  it('"Statistik Subjek": by bankCount descending (ties by id), stars from the mean difficulty, usedCount 0', async () => {
    const d = await dash(PELAJAR)
    const counts = d.subjectStats.map((s) => s.bankCount)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
    expect(d.subjectStats[0]).toMatchObject({ name: 'Pendidikan Moral', bankCount: 15_414 })
    for (const s of d.subjectStats) {
      expect(s.usedCount).toBe(0)
      // 0 filled stars when the subject has no question (BR-29); else a mean of difficulty 1–4.
      if (s.bankCount === 0) expect(s.avgDifficulty).toBe(0)
      else {
        expect(s.avgDifficulty).toBeGreaterThanOrEqual(1)
        expect(s.avgDifficulty).toBeLessThanOrEqual(4)
      }
    }
  })

  it('"Soalan Terkini": the 5 newest approved questions (BR-29), text cut at 100 characters, no practice anchor', async () => {
    const d = await dash(PELAJAR)
    expect(d.recentQuestions).toHaveLength(5)
    const created = d.recentQuestions.map((q) => q.createdAt)
    expect([...created].sort().reverse()).toEqual(created)
    for (const q of d.recentQuestions) {
      expect(q.text.length).toBeLessThanOrEqual(103)
      if (q.text.length > 100) expect(q.text.endsWith('...')).toBe(true)
      expect(q.subjectName).not.toBe('')
      expect(q.levelCode).not.toBe('')
      expect(q.difficulty).toBeGreaterThanOrEqual(1)
      expect(q.id < 600_001 || q.id > 600_065).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// #2, #3 Practice subjects
// ---------------------------------------------------------------------------------------------

describe('#2 / #3 practice subjects (S2, S3)', () => {
  it('#2: 31 subjects in BR-01 order as an unpaged list', async () => {
    const r = await getAs<ListBody<PracticeSubject>>(runtime, PELAJAR, '/api/practice/subjects')
    expect(r.status).toBe(200)
    expect(r.body.data).toHaveLength(31)
    expect(r.body.meta).toMatchObject({ page: 1, totalPages: 1, totalItems: 31 })
    expect(r.body.data[2]).toMatchObject({ code: 'MATH', approvedCount: 13_872 })
  })

  it('#3 BM: T4–T5 counts 256 / 385 = 641 and the difficulty splits (BR-11 reversed by D54, BR-12)', async () => {
    const c = await data<SubjectConfig>(PELAJAR, '/api/practice/subjects/BM')
    // Table A 257 + 387 minus the 3 non-MCQ teacher-databank rows at T4/T5.
    expect(c.total).toBe(641)
    expect(c.levels.map((l) => [l.id, l.code, l.count])).toEqual([
      [10, 'T4', 256],
      [11, 'T5', 385],
    ])
    const stats = Object.values(c.difficultyStats)
    expect(stats.reduce((a, b) => a + b, 0)).toBe(641)
    for (const l of c.levels) {
      const byLevel = Object.values(c.difficultyByLevel[String(l.id)] ?? {})
      expect(byLevel.reduce((a, b) => a + b, 0)).toBe(l.count)
    }
    expect(c.subjectiveCounts).toEqual({})
    expect(c.trial).toEqual({ active: true, used: 32, limit: 50, remaining: 18 })
  })

  it('#3 MATH total 2,601 with T4 1,511; the code is case-insensitive', async () => {
    const c = await data<SubjectConfig>(PELAJAR, '/api/practice/subjects/math')
    expect(c.total).toBe(2_601)
    expect(c.levels[0]).toMatchObject({ id: 10, code: 'T4', name: 'Tingkatan 4', count: 1_511 })
    expect(c.levels[1]).toMatchObject({ id: 11, code: 'T5', count: 1_090 })
  })

  it('#3 SK offers T4 and T5 with 0 questions (BR-11, D54); a subject linked only to Darjah offers none', async () => {
    const sk = await data<SubjectConfig>(PELAJAR, '/api/practice/subjects/SK')
    expect(sk.levels).toEqual([
      { id: 10, code: 'T4', name: 'Tingkatan 4', count: 0 },
      { id: 11, code: 'T5', name: 'Tingkatan 5', count: 0 },
    ])
    expect(sk.total).toBe(0)
    const jawi = await data<SubjectConfig>(PELAJAR, '/api/practice/subjects/JAWI')
    expect(jawi.levels).toEqual([])
    expect(jawi.total).toBe(0)
  })

  it('#3 an unknown code is 404 NOT_FOUND', async () => {
    const r = await getAs<ErrorBody>(runtime, PELAJAR, '/api/practice/subjects/ZZZ')
    expect(r.status).toBe(404)
    expect(r.body.error.code).toBe('NOT_FOUND')
  })

  it('#3 the trial block follows the caller: subscribed pelajarmaju has none active', async () => {
    const c = await data<SubjectConfig>(MAJU, '/api/practice/subjects/BM')
    expect(c.trial.active).toBe(false)
  })
})

// ---------------------------------------------------------------------------------------------
// #7, #8 Chapters
// ---------------------------------------------------------------------------------------------

describe('#7 / #8 chapter mode (S4, S5; BR-15, BR-16)', () => {
  it('#7 lists the subjects with chapters, with chapter and question counts (MATH 2,601; D54)', async () => {
    const r = await getAs<ListBody<ChapterSubject>>(runtime, GURU, '/api/practice/chapter-subjects')
    expect(r.status).toBe(200)
    const codes = r.body.data.map((s) => s.code)
    expect(codes.slice(0, 3)).toEqual(['BM', 'BI', 'MATH'])
    const math = r.body.data.find((s) => s.code === 'MATH')
    expect(math?.questionCount).toBe(2_601)
    expect(math?.chapterCount).toBe(11)
    // Subjects with no chapter at an offered level are not listed (BR-15).
    expect(codes).not.toContain('JAWI')
    expect(r.body.data.every((s) => s.chapterCount > 0)).toBe(true)
  })

  it('#8 pelajarmaju MATH T4: Bab 1 20 answered at 95 % open, Bab 2 5 at 60 %, Bab 3 5 at 80 %, all others locked (D54)', async () => {
    const c = await data<ChapterSubjectDetail>(MAJU, '/api/practice/chapter-subjects/MATH')
    expect(c.subject).toEqual({ code: 'MATH', name: 'Matematik', color: '#EF4444' })
    expect(c.levelId).toBe(10)
    expect(c.levels.map((l) => [l.id, l.name])).toEqual([
      [10, 'Tingkatan 4'],
      [11, 'Tingkatan 5'],
    ])
    // The option count is the level's chapter questions (BR-15): the sum of its chapters.
    expect(c.levels[0]?.count).toBe(c.chapters.reduce((a, ch) => a + ch.total, 0))
    const [b1, b2, b3, ...rest] = c.chapters
    expect(b1).toMatchObject({
      id: 91,
      number: 1,
      answered: 20,
      correct: 19,
      scorePct: 95,
      state: 'open',
      complete: false,
    })
    expect(b1?.remaining).toBe((b1?.total ?? 0) - 20)
    expect(b2).toMatchObject({ id: 92, answered: 5, scorePct: 60, state: 'locked' })
    expect(b3).toMatchObject({ id: 220, answered: 5, scorePct: 80, state: 'locked' })
    expect(rest).toHaveLength(7)
    for (const ch of rest) {
      expect(ch).toMatchObject({ answered: 0, correct: 0, scorePct: 0, state: 'locked' })
      expect(ch.total).toBeGreaterThan(0)
      expect(ch.name).not.toBe('')
    }
    for (const ch of c.chapters) expect(ch.total).toBeGreaterThanOrEqual(25)
  })

  it('#8 admin BM: T4 Bab 1 (5 answered, 0 correct, A5) and T5 (38 answered, 12 correct, A3 + A4); the Darjah 1 chapters are not offered (D54)', async () => {
    const c = await data<ChapterSubjectDetail>(ADMIN, '/api/practice/chapter-subjects/BM')
    expect(c.levelId).toBe(10)
    expect(c.chapters).toHaveLength(1)
    expect(c.chapters[0]).toMatchObject({
      id: 87,
      answered: 5,
      correct: 0,
      scorePct: 0,
      state: 'open',
    })
    const t5 = await data<ChapterSubjectDetail>(
      ADMIN,
      '/api/practice/chapter-subjects/BM?levelId=11',
    )
    expect(t5.levelId).toBe(11)
    expect(t5.chapters).toHaveLength(1)
    expect(t5.chapters[0]).toMatchObject({ id: 413, answered: 38, correct: 12, state: 'open' })
    const d1 = await data<ChapterSubjectDetail>(
      ADMIN,
      '/api/practice/chapter-subjects/BM?levelId=1',
    )
    expect(d1.levelId).toBe(10)
  })

  it('#8 a user with no answer sees chapter 1 open and the rest locked; the teacher may open it too', async () => {
    const c = await data<ChapterSubjectDetail>(GURU, '/api/practice/chapter-subjects/MATH')
    expect(c.chapters[0]).toMatchObject({ answered: 0, state: 'open' })
    expect(c.chapters.slice(1).every((ch) => ch.state === 'locked')).toBe(true)
  })

  it('#8 ?levelId= picks a level; an unknown or not offered level falls back to the first offered', async () => {
    const t5 = await data<ChapterSubjectDetail>(
      MAJU,
      '/api/practice/chapter-subjects/MATH?levelId=11',
    )
    expect(t5.levelId).toBe(11)
    expect(t5.chapters[0]).toMatchObject({ number: 1, state: 'open' })
    for (const asked of [99, 2, 1]) {
      const bad = await data<ChapterSubjectDetail>(
        MAJU,
        `/api/practice/chapter-subjects/MATH?levelId=${String(asked)}`,
      )
      expect(bad.levelId).toBe(10)
    }
  })

  it('#8 a subject offering no level answers empty levels and chapters; an unknown code is 404', async () => {
    const jawi = await data<ChapterSubjectDetail>(MAJU, '/api/practice/chapter-subjects/JAWI')
    expect(jawi).toMatchObject({ levels: [], levelId: null, chapters: [] })
    const r = await getAs<ErrorBody>(runtime, MAJU, '/api/practice/chapter-subjects/ZZZ')
    expect(r.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------------------------
// #9, #10 Revision
// ---------------------------------------------------------------------------------------------

describe('#9 / #10 revision (S6, S7 guard; BR-14)', () => {
  it('#9 admin: BM 46, SEJ 26, total 72 (47 wrong BM answers → 46 distinct questions)', async () => {
    const r = await data<RevisionOverview>(ADMIN, '/api/practice/revision')
    expect(r.total).toBe(72)
    expect(r.subjects.map((s) => [s.code, s.count])).toEqual([
      ['BM', 46],
      ['SEJ', 26],
    ])
    expect(r.subjects[0]).toMatchObject({ name: 'Bahasa Melayu', nameEn: 'Malay Language' })
  })

  it('#9 pelajar: BM 8, MATH 6, SEJ 4, AKAUN 6 (24); pelajarmaju MATH 4; pelajar2 none', async () => {
    const r = await data<RevisionOverview>(PELAJAR, '/api/practice/revision')
    expect(r.total).toBe(24)
    expect(Object.fromEntries(r.subjects.map((s) => [s.code, s.count]))).toEqual({
      BM: 8,
      MATH: 6,
      SEJ: 4,
      AKAUN: 6,
    })
    const maju = await data<RevisionOverview>(MAJU, '/api/practice/revision')
    expect(maju.total).toBe(4)
    expect(maju.subjects.map((s) => [s.code, s.count])).toEqual([['MATH', 4]])
    expect(await data(PELAJAR2, '/api/practice/revision')).toEqual({ total: 0, subjects: [] })
  })

  it('#10 returns the subject and the queued count; 0 is a 200; an unknown code is 404', async () => {
    expect(await data(ADMIN, '/api/practice/revision/BM')).toEqual({
      subject: { id: 1, code: 'BM', name: 'Bahasa Melayu', color: '#3B82F6' },
      count: 46,
    })
    expect((await data<RevisionSubject>(ADMIN, '/api/practice/revision/MATH')).count).toBe(0)
    expect((await getAs(runtime, ADMIN, '/api/practice/revision/ZZZ')).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------------------------
// #11 Progress
// ---------------------------------------------------------------------------------------------

describe('#11 GET /api/practice/progress (S8; BR-19)', () => {
  it('admin `all`: 119 answers, 38.7 %, 4 sessions, "4" minutes; chart 19/02 57.1 (35), 11/05 33.8 (74), 19/05 10.0 (10)', async () => {
    const p = await data<Progress>(ADMIN, '/api/practice/progress?period=all')
    expect(p).toMatchObject({
      period: 'all',
      answered: 119,
      accuracyPct: 38.7,
      sessions: 4,
      minutes: 4,
    })
    expect(p.chart).toEqual({
      labels: ['19/02', '11/05', '19/05'],
      accuracy: [57.1, 33.8, 10],
      counts: [35, 74, 10],
    })
  })

  it('admin subjects: BM 79 / 32 / 47 with the sparkline points 57.1 / 32.4 / 10.0, SEJ 40 / 14 / 26; both weak', async () => {
    const p = await data<Progress>(ADMIN, '/api/practice/progress?period=all')
    expect(p.subjects).toHaveLength(2)
    expect(p.subjects[0]).toMatchObject({
      code: 'BM',
      answered: 79,
      correct: 32,
      wrong: 47,
      accuracyPct: 40.5,
      trend: [57.1, 32.4, 10],
    })
    expect(p.subjects[1]).toMatchObject({
      code: 'SEJ',
      answered: 40,
      correct: 14,
      wrong: 26,
      accuracyPct: 35,
    })
    expect(p.weakSubjects.map((s) => s.code)).toEqual(['BM', 'SEJ'])
  })

  it('admin 30 / 7 / 90 days: no answer in the window → zero figures with `accuracyPct` null', async () => {
    for (const period of ['30', '7', '90']) {
      const p = await data<Progress>(ADMIN, `/api/practice/progress?period=${period}`)
      expect(p).toMatchObject({ period, answered: 0, accuracyPct: null, sessions: 0, minutes: 0 })
      expect(p.chart.labels).toEqual([])
      expect(p.subjects).toEqual([])
    }
  })

  it('the default period is 30; pelajar 30 days: 94 answers, 74.5 %, 4 sessions, "30" minutes', async () => {
    const p = await data<Progress>(PELAJAR, '/api/practice/progress')
    expect(p).toMatchObject({
      period: '30',
      answered: 94,
      accuracyPct: 74.5,
      sessions: 4,
      minutes: 30,
    })
    expect(p.chart.labels).toEqual(['22/09', '24/09', '25/09'])
    expect(p.weakSubjects.map((s) => s.code)).toEqual(['MATH'])
  })

  it('pelajarmaju 30 days: 37 answers, 70.3 %, 4 sessions, "15" minutes; no weak subject', async () => {
    const p = await data<Progress>(MAJU, '/api/practice/progress?period=30')
    expect(p).toMatchObject({ answered: 37, accuracyPct: 70.3, sessions: 4, minutes: 15 })
    expect(p.subjects.map((s) => [s.code, s.answered, s.correct])).toEqual([['MATH', 37, 26]])
    expect(p.weakSubjects).toEqual([])
  })

  it('the window is the last N days including today: 7 days keeps 22 Sep, a 2-day window would not', async () => {
    const p = await data<Progress>(PELAJAR, '/api/practice/progress?period=7')
    expect(p.answered).toBe(94)
  })

  it('an unknown period is no active chip and zero figures (`period` null)', async () => {
    const p = await data<Progress>(ADMIN, '/api/practice/progress?period=zz')
    expect(p).toEqual({
      period: null,
      answered: 0,
      accuracyPct: null,
      sessions: 0,
      minutes: 0,
      chart: { labels: [], accuracy: [], counts: [] },
      weakSubjects: [],
      subjects: [],
    })
  })

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'a prototype key (%s) is not a period',
    async (key) => {
      const p = await data<Progress>(ADMIN, `/api/practice/progress?period=${key}`)
      expect(p).toMatchObject({ period: null, answered: 0, accuracyPct: null })
    },
  )

  it('pelajar2 has no data', async () => {
    const p = await data<Progress>(PELAJAR2, '/api/practice/progress?period=all')
    expect(p).toMatchObject({ answered: 0, accuracyPct: null, sessions: 0, subjects: [] })
  })
})

// ---------------------------------------------------------------------------------------------
// #12 History
// ---------------------------------------------------------------------------------------------

describe('#12 GET /api/practice/history (S9; BR-21)', () => {
  it('admin: totals 4 sessions / 84 answered / 21.8 % / 26 coins (as live), newest first, all "Latihan"', async () => {
    const r = await getAs<HistoryBody>(runtime, ADMIN, '/api/practice/history')
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({
      page: 1,
      pageSize: 15,
      totalItems: 4,
      totalPages: 1,
      totals: { sessions: 4, answered: 84, avgAccuracyPct: 21.8, coins: 26 },
    })
    const items = r.body.data
    expect(items.map((s) => s.id)).toEqual(['A5', 'A4', 'A3', 'A2'])
    expect(items.every((s) => s.badge.label === 'Latihan' && s.badge.color === '#6B7280')).toBe(
      true,
    )
    expect(items[2]).toMatchObject({
      mode: 'latih_tubi',
      questionCount: 34,
      correctCount: 11,
      wrongCount: 23,
      accuracyPct: 32.35,
      timeSpent: 105,
      coinsEarned: 11,
      completedAt: '2026-05-11T14:27:00+08:00',
    })
  })

  it('pelajar: 4 / 94 / 65.4 % / 70; the badges follow §6.10 (ramalan "Tracking A")', async () => {
    const r = await getAs<HistoryBody>(runtime, PELAJAR, '/api/practice/history')
    expect(r.body.meta.totals).toEqual({
      sessions: 4,
      answered: 94,
      avgAccuracyPct: 65.4,
      coins: 70,
    })
    expect(r.body.data.find((s) => s.id === 'P4')?.badge.label).toBe('Tracking A')
  })

  it('period filters use Monday–Sunday / calendar month / calendar year; totals stay all-time', async () => {
    const week = await getAs<HistoryBody>(runtime, PELAJAR, '/api/practice/history?period=week')
    expect(week.body.meta.totalItems).toBe(4)
    const admin = await getAs<HistoryBody>(runtime, ADMIN, '/api/practice/history?period=week')
    expect(admin.body.data).toEqual([])
    expect(admin.body.meta.totals.sessions).toBe(4)
    const month = await getAs<HistoryBody>(runtime, ADMIN, '/api/practice/history?period=month')
    expect(month.body.meta.totalItems).toBe(0)
    const year = await getAs<HistoryBody>(runtime, ADMIN, '/api/practice/history?period=year')
    expect(year.body.meta.totalItems).toBe(4)
  })

  it('an unknown period lists every session', async () => {
    const r = await getAs<HistoryBody>(runtime, ADMIN, '/api/practice/history?period=decade')
    expect(r.body.meta.totalItems).toBe(4)
  })

  it('pelajarmaju M1–M4 carry the chapter / random / revision badges', async () => {
    const r = await getAs<HistoryBody>(runtime, MAJU, '/api/practice/history')
    const labels = Object.fromEntries(r.body.data.map((s) => [s.id, s.badge.label]))
    expect(labels).toEqual({ M1: 'Bab', M2: 'Bab', M3: 'Latihan', M4: 'Ulang Kaji' })
  })

  it('a user with no session: empty list, zero totals', async () => {
    const r = await getAs<HistoryBody>(runtime, PELAJAR2, '/api/practice/history')
    expect(r.body.data).toEqual([])
    expect(r.body.meta.totals).toEqual({ sessions: 0, answered: 0, avgAccuracyPct: 0, coins: 0 })
  })
})

// ---------------------------------------------------------------------------------------------
// #13 Corrections
// ---------------------------------------------------------------------------------------------

describe('#13 GET /api/practice/corrections (S11; BR-18)', () => {
  it('admin May 2026: 74 questions, 33.8 / 33.8 / 0.0; Sejarah 40 · 35.0, Bahasa Melayu 34 · 32.4 (past_year not counted)', async () => {
    const c = await data<Corrections>(ADMIN, '/api/practice/corrections?month=2026-05')
    expect(c.summary).toEqual({ before: 33.8, after: 33.8, delta: 0, questions: 74 })
    expect(c.subjects.map((s) => [s.name, s.questions, s.before, s.after, s.delta])).toEqual([
      ['Sejarah', 40, 35, 35, 0],
      ['Bahasa Melayu', 34, 32.4, 32.4, 0],
    ])
    expect(c.month).toBe('2026-05')
    expect(c.prevMonth).toBe('2026-04')
    expect(c.nextMonth).toBe('2026-06')
  })

  it('pelajarmaju September 2026: 30 questions, 76.7 → 86.7, +10.0; › is off in the current month', async () => {
    const c = await data<Corrections>(MAJU, '/api/practice/corrections')
    expect(c.month).toBe('2026-09')
    expect(c.prevMonth).toBe('2026-08')
    expect(c.nextMonth).toBeNull()
    expect(c.summary).toEqual({ before: 76.7, after: 86.7, delta: 10, questions: 30 })
    expect(c.subjects).toEqual([
      expect.objectContaining({
        name: 'Matematik',
        questions: 30,
        before: 76.7,
        after: 86.7,
        delta: 10,
      }),
    ])
  })

  it('a malformed month shows the current month (DV-M05-13); month 13 too', async () => {
    for (const month of ['bad', '2026-13', '2026-5', '']) {
      const c = await data<Corrections>(MAJU, `/api/practice/corrections?month=${month}`)
      expect(c.month).toBe('2026-09')
    }
  })

  it('a month with no first answer is the empty state (`summary` null); the year rolls over', async () => {
    const c = await data<Corrections>(ADMIN, '/api/practice/corrections?month=2026-01')
    expect(c.summary).toBeNull()
    expect(c.subjects).toEqual([])
    expect(c.prevMonth).toBe('2025-12')
    expect(c.nextMonth).toBe('2026-02')
  })

  it('admin February 2026: 35 questions from the sessionless 19/02 answers (20 correct = 57.1 %)', async () => {
    const c = await data<Corrections>(ADMIN, '/api/practice/corrections?month=2026-02')
    expect(c.summary).toMatchObject({ questions: 35, before: 57.1, after: 57.1, delta: 0 })
  })
})

// ---------------------------------------------------------------------------------------------
// #14 Mastery
// ---------------------------------------------------------------------------------------------

describe('#14 GET /api/practice/mastery (S12; BR-20)', () => {
  it('the scale has the 11 levels of §6.10', async () => {
    const m = await data<Mastery>(ADMIN, '/api/practice/mastery')
    expect(m.scale).toHaveLength(11)
    expect(m.scale[0]).toEqual({ level: 0, label: 'Pemula' })
    expect(m.scale[10]).toEqual({ level: 10, label: 'Mythical' })
  })

  it('admin: BM L2 46/94 = 48.9 % ("46/50", bar 84 %, x1.05), SEJ L1 14/40 = 35.0 % ("14/25", bar 26.7 %)', async () => {
    const m = await data<Mastery>(ADMIN, '/api/practice/mastery')
    expect(m.subjects).toHaveLength(2)
    expect(m.subjects[0]).toMatchObject({
      code: 'BM',
      level: 2,
      label: 'Aktif',
      correct: 46,
      answered: 94,
      accuracyPct: 48.9,
      nextLevel: 3,
      nextThreshold: 50,
      barPct: 84,
      xpMultiplier: 1.05,
      lastAnsweredAt: '2026-05-19T03:49:00+08:00',
    })
    expect(m.subjects[1]).toMatchObject({
      code: 'SEJ',
      level: 1,
      label: 'Mula Belajar',
      correct: 14,
      answered: 40,
      accuracyPct: 35,
      nextLevel: 2,
      nextThreshold: 25,
      barPct: 26.7,
      xpMultiplier: null,
    })
  })

  it('pelajar: BM L2 "26/50", MATH L0 "4/10", SEJ L0, AKAUN L2; pelajarmaju MATH L2 26/37', async () => {
    const m = await data<Mastery>(PELAJAR, '/api/practice/mastery')
    const by = Object.fromEntries(m.subjects.map((s) => [s.code, s]))
    expect(by.BM).toMatchObject({ level: 2, correct: 26, answered: 34, nextThreshold: 50 })
    expect(by.MATH).toMatchObject({ level: 0, correct: 4, answered: 10, nextThreshold: 10 })
    expect(by.SEJ?.level).toBe(0)
    expect(by.AKAUN).toMatchObject({ level: 2, correct: 34, answered: 40 })
    const maju = await data<Mastery>(MAJU, '/api/practice/mastery')
    expect(maju.subjects).toHaveLength(1)
    expect(maju.subjects[0]).toMatchObject({ code: 'MATH', level: 2, correct: 26, answered: 37 })
  })

  it('subjects come in BR-01 (M03) order, not by count', async () => {
    const m = await data<Mastery>(PELAJAR, '/api/practice/mastery')
    expect(m.subjects.map((s) => s.code)).toEqual(['BM', 'MATH', 'SEJ', 'AKAUN'])
  })

  it('a user with no answer gets the scale card only (FR-M05-114)', async () => {
    const m = await data<Mastery>(PELAJAR2, '/api/practice/mastery')
    expect(m.subjects).toEqual([])
    expect(m.scale).toHaveLength(11)
  })

  it('level thresholds: L0 0–9, L1 ≥ 10, L2 ≥ 25, L3 ≥ 50 and the placeholders up to L10 ≥ 1,500', () => {
    const at = (n: number) => masteryLevel(n)
    expect([at(0), at(9), at(10), at(24), at(25), at(49), at(50), at(99), at(100)]).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4,
    ])
    expect([
      at(199),
      at(200),
      at(350),
      at(550),
      at(800),
      at(1_100),
      at(1_499),
      at(1_500),
      at(9_999),
    ]).toEqual([4, 5, 6, 7, 8, 9, 9, 10, 10])
  })
})

// ---------------------------------------------------------------------------------------------
// The session calls still work beside the new routes (#4–#6, #23 are F-26's)
// ---------------------------------------------------------------------------------------------

describe('#23 stays served beside the new routes', () => {
  it('admin SPM history: 4 sessions, 84 answered, 21.8 %, 26 coins', async () => {
    const r = await request(
      runtime,
      'GET',
      '/api/practice/sessions?modes=past_year,latih_tubi,ramalan',
      setUser(ADMIN).token,
    )
    expect(r.status).toBe(200)
    expect((r.body as ListBody<unknown, { stats: object }>).meta.stats).toEqual({
      sessions: 4,
      avgAccuracyPct: 21.8,
      coins: 26,
      answered: 84,
    })
  })
})
