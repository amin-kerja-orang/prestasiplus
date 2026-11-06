import {
  PerformanceClassAnalyticsSchema,
  PerformanceClassDashboardSchema,
  PerformanceClassesAggregateSchema,
  PerformanceStudentSchema,
} from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { analyticsTrendOf, riskOfWholePercent } from '../../../../src/modules/reports/performance/domain'
import { answers, ctxOf, sitting, world, type World } from '../fakes/fixtures'

const d = (iso: string) => new Date(iso)
const round1 = (v: number): number => Math.round(v * 10) / 10

let w: World

beforeEach(() => {
  w = world()
  w.directory
    .addSchool({ id: 's1', name: 'Sekolah Contoh Satu' })
    .addSchool({ id: 's2', name: 'Sekolah Contoh Dua', district: 'Daerah B' })
    .addPupil({ id: '1', name: 'Aina Contoh', schoolId: 's1' })
    .addPupil({ id: '2', name: 'Bakar Contoh', schoolId: 's1' })
    .addPupil({ id: '3', name: 'Cahaya Contoh', schoolId: 's1' })
    .addPupil({ id: '9', name: 'Dewi Contoh', schoolId: 's2' })
  w.classes
    .add({ id: '10', schoolId: 's1', teacherId: 't1', teacherName: 'Cikgu Satu', subjectId: '1', subjectName: 'Bahasa Melayu' }, ['1', '2', '3'])
    .add({ id: '11', schoolId: 's1', teacherId: 't2', teacherName: 'Cikgu Dua' }, ['3'])
    .add({ id: '12', schoolId: 's1', kind: 'school_class', teacherId: 't1' }, ['1'])
})

const NOW_MONDAY = '2026-09-21'

describe('Prestasi 360 (student)', () => {
  const answer = (userId: string, n: number, correct: number, over: Parameters<World['answers']['addMany']>[3]) => w.answers.addMany(userId, n, correct, over)

  beforeEach(() => {
    w.directory.addSubject('BM', '1', 'Bahasa Melayu').addSubject('MT', '2', 'Matematik')
  })

  describe('pooled figures come from the one answer store (the Bijak port no longer feeds them)', () => {
    beforeEach(() => {
      answer('1', 10, 8, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
      answer('1', 5, 2, { mode: 'simulasi', subjectId: '2', sessionId: 'sB', answeredAt: d('2026-09-23T11:00:00+08:00') })
      // never counted: a Mod Pelajar answer
      w.answers.add({ userId: '1', subjectId: '1', questionId: 'x', mode: 'latih_tubi', isCorrect: true, answeredAt: d('2026-09-22T10:30:00+08:00'), sessionId: 'sA', isTest: true })
      // a Bijak sitting only serves the day map, the practice days and the time spent: it adds no answer and no session
      w.bijak.addSitting(sitting({ userId: '1', score: 8, maxScore: 10, durationSeconds: 600, submittedAt: d('2026-09-24T10:00:00+08:00') }))
    })

    it('answered is the sum of attempts, accuracy is correct over answered (one decimal), sessions are distinct sessions', async () => {
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.stats).toEqual({ sessions: 2, accuracy: 66.7, answered: 15, seconds: 600 })
      expect(r.heroAccuracy).toBe(67)
      expect(r.activity.practiceDays).toBe(1)
      PerformanceStudentSchema.parse(r)
    })

    it('mastery per subject (pooled accuracy, answered, sessions), most answered first', async () => {
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.mastery.map((m) => [m.subjectCode, m.subjectName, m.accuracy, m.sessions, m.answered])).toEqual([
        ['BM', 'Bahasa Melayu', 80, 1, 10],
        ['MT', 'Matematik', 40, 1, 5],
      ])
    })

    it('heatmap is 90 Malaysian days ending today', async () => {
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.heatmap).toHaveLength(90)
      expect(r.heatmap.at(-1)).toEqual({ date: '2026-09-25', sessions: 0 })
      expect(r.heatmap.at(-2)).toEqual({ date: '2026-09-24', sessions: 1 })
    })

    it('suggests a focus session for a subject under 70 percent', async () => {
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.suggestions).toEqual([{ kind: 'subject', text: 'Tingkatkan prestasi Matematik (purata 40%) dengan 3 sesi latihan fokus minggu ini.' }])
    })
  })

  it('AC-X4-1: 10 Latih Tubi (7 correct) and one Bijak sitting of 40 (30 correct) are 50 answered, 74, 2 sessions; battle rows add answers, never a session', async () => {
    answer('1', 10, 7, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
    answer('1', 40, 30, { mode: 'simulasi', subjectId: '1', sessionId: 'sB', answeredAt: d('2026-09-23T10:00:00+08:00') })
    const base = await w.student.student(ctxOf('student', '1'), '1')
    expect(base.stats).toMatchObject({ answered: 50, accuracy: 74, sessions: 2 })
    expect(base.heroAccuracy).toBe(74)

    answer('1', 5, 3, { mode: 'battle', subjectId: '1', sessionId: 'sC', answeredAt: d('2026-09-24T10:00:00+08:00') })
    answer('1', 4, 4, { mode: 'game', subjectId: '1', answeredAt: d('2026-09-24T11:00:00+08:00') })
    const withGames = await w.student.student(ctxOf('student', '1'), '1')
    expect(withGames.stats).toMatchObject({ answered: 59, accuracy: round1((44 / 59) * 100), sessions: 2 })
    expect(withGames.trend.at(-1)?.sessions).toBe(2)
  })

  it('AC-MUR-4-5: 26 of 30 is 86.7 on the wire and 87 in the hero', async () => {
    answer('1', 30, 26, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
    const r = await w.student.student(ctxOf('student', '1'), '1')
    expect(r.stats.accuracy).toBe(86.7)
    expect(r.heroAccuracy).toBe(87)
  })

  describe('XS rounding (S6-T03): one decimal half up on integers, hero rounded once', () => {
    const one = async (n: number, correct: number) => {
      answer('1', n, correct, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
      return w.student.student(ctxOf('student', '1'), '1')
    }

    it('an exact tie for one decimal stays: 1 of 8 is 12.5', async () => {
      const r = await one(8, 1)
      expect(r.stats.accuracy).toBe(12.5)
      expect(r.mastery[0]?.accuracy).toBe(12.5)
    })

    it('a one-decimal half-up case: 1 of 16 is 6.25 shown 6.3, hero 6', async () => {
      const r = await one(16, 1)
      expect(r.stats.accuracy).toBe(6.3)
      expect(r.heroAccuracy).toBe(6)
    })

    it('hero rounds once from the raw ratio: 35 of 47 (74.468) is 74.5 on the wire and 74 in the hero, not 75', async () => {
      const r = await one(47, 35)
      expect(r.stats.accuracy).toBe(74.5)
      expect(r.heroAccuracy).toBe(74)
    })

    it('hero at exactly 74.5 (149 of 200) is 75', async () => {
      const r = await one(200, 149)
      expect(r.stats.accuracy).toBe(74.5)
      expect(r.heroAccuracy).toBe(75)
    })

    it('0 answers gives null accuracy and a null hero', async () => {
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.stats.accuracy).toBeNull()
      expect(r.heroAccuracy).toBeNull()
    })
  })

  describe('trend (AC-MUR-4-4)', () => {
    it('12 Monday weeks, oldest "Mgg 1" to the current "Mgg 12"; answers of this and last week land at index 11 and 10', async () => {
      answer('1', 4, 3, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
      answer('1', 2, 1, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sB', answeredAt: d('2026-09-15T10:00:00+08:00') })
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.trend).toHaveLength(12)
      expect(r.trend.map((t) => t.label)).toEqual(Array.from({ length: 12 }, (_, i) => `Mgg ${String(i + 1)}`))
      expect(r.trend[0]?.week).toBe('2026-07-06')
      expect(r.trend[10]).toEqual({ week: '2026-09-14', label: 'Mgg 11', accuracy: 50, sessions: 1 })
      expect(r.trend[11]).toEqual({ week: NOW_MONDAY, label: 'Mgg 12', accuracy: 75, sessions: 1 })
      expect(r.trend.slice(0, 10).every((t) => t.accuracy === null && t.sessions === 0)).toBe(true)
      PerformanceStudentSchema.parse(r)
    })

    it('weeks start on Monday in Malaysian time: Sunday 23:30 is the old week, Monday 00:10 the new one; older than 12 weeks is out of the trend only', async () => {
      answer('1', 1, 1, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-20T23:30:00+08:00') })
      answer('1', 1, 0, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sB', answeredAt: d('2026-09-21T00:10:00+08:00') })
      answer('1', 2, 2, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sC', answeredAt: d('2026-06-01T10:00:00+08:00') })
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.trend[10]).toMatchObject({ week: '2026-09-14', accuracy: 100, sessions: 1 })
      expect(r.trend[11]).toMatchObject({ week: NOW_MONDAY, accuracy: 0, sessions: 1 })
      expect(r.stats).toMatchObject({ answered: 4, sessions: 3 })
    })

    it('a week with answers only in a game mode has an accuracy and no session', async () => {
      answer('1', 2, 1, { mode: 'battle', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.trend[11]).toEqual({ week: NOW_MONDAY, label: 'Mgg 12', accuracy: 50, sessions: 0 })
      expect(r.stats.sessions).toBe(0)
    })
  })

  it('wire precision: every accuracy is a JSON number with at most one decimal, and a whole value has no fraction', async () => {
    answer('1', 3, 2, { mode: 'latih_tubi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
    answer('1', 3, 1, { mode: 'latih_tubi', subjectId: '2', sessionId: 'sB', answeredAt: d('2026-09-16T10:00:00+08:00') })
    answer('1', 2, 1, { mode: 'latih_tubi', subjectId: '2', topicId: '100', chapterId: '50', sessionId: 'sB', answeredAt: d('2026-09-16T10:00:00+08:00') })
    w.answers.addChapter('50', { name: 'Bab Lima', subjectCode: 'MT', levelId: 'lv-t4' }).addTopic('100', { name: 'Topik Seratus', chapterId: '50' })
    const r = await w.student.student(ctxOf('student', '1'), '1')
    const wire = JSON.parse(JSON.stringify(r)) as typeof r
    const values = [wire.stats.accuracy, ...wire.mastery.map((m) => m.accuracy), ...wire.trend.map((t) => t.accuracy), ...wire.weakTopics.map((x) => x.accuracy)].filter((v): v is number => v !== null)
    expect(values.length).toBeGreaterThan(4)
    for (const v of values) expect(v).toBe(round1(v))
    expect(wire.stats.accuracy).toBe(round1((4 / 8) * 100))
    expect(JSON.stringify(wire.stats.accuracy)).toBe('50')
    expect(wire.mastery.find((m) => m.subjectCode === 'BM')?.accuracy).toBe(66.7)
    expect(Number.isInteger(wire.heroAccuracy)).toBe(true)
  })

  describe('weak topics (FR-MUR-4-8)', () => {
    const at2 = d('2026-09-22T10:00:00+08:00')
    beforeEach(() => {
      w.answers
        .addChapter('50', { name: 'Bab Lima', dskpCode: '5.1', subjectCode: 'BM', levelId: 'lv-t4' })
        .addChapter('51', { name: 'Bab Tanpa Topik', dskpCode: '6.1', subjectCode: 'MT', levelId: null })
        .addTopic('100', { name: 'Topik Lemah', chapterId: '50' })
        .addTopic('101', { name: 'Topik Sekali', chapterId: '50' })
        .addTopic('102', { name: 'Topik Kuat', chapterId: '50' })
        .addTopic('103', { name: 'Topik Enam Puluh', chapterId: '50' })
        .addTopic('104', { name: 'Topik Banyak', chapterId: '50' })
      const put = (topicId: string | null, chapterId: string | null, questions: string[], correct: number) =>
        questions.forEach((q, i) => w.answers.add({ userId: '1', subjectId: '1', questionId: q, topicId, chapterId, mode: 'latih_tubi', isCorrect: i < correct, answeredAt: at2, sessionId: 'sA' }))
      put('100', '50', ['a', 'b', 'c'], 1) // 33.3, in
      put('101', '50', ['a'], 0) // one attempt: out
      put('102', '50', ['a', 'b'], 2) // 100: out
      put('103', '50', ['a', 'b', 'c', 'd', 'e'], 3) // exactly 60: out
      put('104', '50', Array.from({ length: 30 }, (_, i) => `q${String(i)}`), 0) // 0, 30 questions: focus capped at 25
      put(null, '51', ['a', 'b'], 0) // chapter fallback: in, no code
      put(null, null, ['a', 'b', 'c'], 0) // no topic and no chapter: skipped, but still answered
      // the same topic in another mode pools with the first
      w.answers.add({ userId: '1', subjectId: '1', questionId: 'a', topicId: '100', chapterId: '50', mode: 'simulasi', isCorrect: false, answeredAt: at2, sessionId: 'sB' })
    })

    it('all time, at least 2 attempts and under 60 percent; topic else chapter; rows with neither are skipped; lowest first', async () => {
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.weakTopics).toEqual([
        { spId: '104', label: 'Topik Banyak', code: '5.1', subjectCode: 'BM', levelId: 'lv-t4', attempts: 30, accuracy: 0, focusCount: 0 },
        { spId: '51', label: 'Bab Tanpa Topik', code: null, subjectCode: 'MT', levelId: null, attempts: 2, accuracy: 0, focusCount: 0 },
        { spId: '100', label: 'Topik Lemah', code: '5.1', subjectCode: 'BM', levelId: 'lv-t4', attempts: 4, accuracy: 25, focusCount: 0 },
      ])
      expect(r.stats.answered).toBe(3 + 1 + 2 + 5 + 30 + 2 + 3 + 1)
      PerformanceStudentSchema.parse(r)
    })

    it('the < 60 rule uses the exact ratio: 1499 of 2500 (59.96, shown 60.0 on the wire) is still weak', async () => {
      w.answers.addTopic('105', { name: 'Topik Hampir', chapterId: '50' })
      for (let i = 0; i < 2500; i++)
        w.answers.add({ userId: '1', subjectId: '1', questionId: `h${String(i)}`, topicId: '105', chapterId: '50', mode: 'latih_tubi', isCorrect: i < 1499, answeredAt: at2, sessionId: 'sC' })
      const r = await w.student.student(ctxOf('student', '1'), '1')
      const near = r.weakTopics.find((t) => t.spId === '105')
      expect(near).toMatchObject({ attempts: 2500, accuracy: 60, focusCount: 0 })
    })
  })

  it('a session that crosses Monday 00:00 is one session in stats, and one in each of the two trend weeks', async () => {
    w.answers.add({ userId: '1', subjectId: '1', questionId: 'a', mode: 'latih_tubi', isCorrect: true, answeredAt: d('2026-09-20T23:50:00+08:00'), sessionId: 'sX' })
    w.answers.add({ userId: '1', subjectId: '1', questionId: 'b', mode: 'latih_tubi', isCorrect: false, answeredAt: d('2026-09-21T00:10:00+08:00'), sessionId: 'sX' })
    const r = await w.student.student(ctxOf('student', '1'), '1')
    expect(r.stats.sessions).toBe(1)
    expect(r.trend[10]).toMatchObject({ week: '2026-09-14', sessions: 1 })
    expect(r.trend[11]).toMatchObject({ week: NOW_MONDAY, sessions: 1 })
    expect(r.mastery.map((m) => m.sessions)).toEqual([1])
  })

  it('a Latih Tubi only pupil (no Bijak sitting) has a heatmap, practice days and study time from practice_sessions', async () => {
    w.practice.addPupil({ id: '1' })
    w.practice.addSession({ userId: '1', completedAt: d('2026-09-24T10:00:00+08:00'), questionCount: 10, correctCount: 7, coins: 0, seconds: 300 })
    w.practice.addSession({ userId: '1', completedAt: d('2026-09-24T18:00:00+08:00'), questionCount: 10, correctCount: 5, coins: 0, seconds: 200 })
    w.practice.addSession({ userId: '1', completedAt: d('2026-09-25T09:00:00+08:00'), questionCount: 10, correctCount: 5, coins: 0, seconds: 100, isTest: true })
    w.practice.addSession({ userId: '1', completedAt: d('2026-09-22T09:00:00+08:00'), questionCount: 10, correctCount: 5, coins: 0, seconds: 50 })
    // plus one Bijak sitting on a shared day: added, not merged away
    w.bijak.addSitting(sitting({ userId: '1', durationSeconds: 60, submittedAt: d('2026-09-24T12:00:00+08:00') }))
    const r = await w.student.student(ctxOf('student', '1'), '1')
    expect(r.stats.seconds).toBe(300 + 200 + 50 + 60)
    expect(r.activity.practiceDays).toBe(2)
    expect(r.heatmap.find((h) => h.date === '2026-09-24')?.sessions).toBe(3)
    expect(r.heatmap.find((h) => h.date === '2026-09-22')?.sessions).toBe(1)
    expect(r.heatmap.find((h) => h.date === '2026-09-25')?.sessions).toBe(0)
  })

  it('a pupil with no answers gets null accuracy, zeros, 12 empty weeks and the start suggestion (neutral values, not invented)', async () => {
    const r = await w.student.student(ctxOf('admin', '99', { level: 'national', label: 'Nasional' }), '2')
    expect(r.stats).toEqual({ sessions: 0, accuracy: null, answered: 0, seconds: 0 })
    expect(r.heroAccuracy).toBeNull()
    expect(r.suggestions).toEqual([{ kind: 'start', text: 'Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!' }])
    expect(r.mastery).toEqual([])
    expect(r.weakTopics).toEqual([])
    expect(r.badges).toEqual([])
    expect(r.trend).toHaveLength(12)
    expect(r.trend.every((t) => t.accuracy === null && t.sessions === 0)).toBe(true)
    expect(r.trend.map((t) => t.label)).toEqual(Array.from({ length: 12 }, (_, i) => `Mgg ${String(i + 1)}`))
    PerformanceStudentSchema.parse(r)
  })

  it.each([
    ['admin', '99', 'national', true],
    ['student', '1', 'self', true],
    ['student', '2', 'self', false],
    ['teacher', 't1', 'school', true],
    ['teacher', 't3', 'school', false],
    ['school_admin', 'sa1', 'school', true],
    ['parent', 'pa1', 'self', false],
    ['sponsor', 'sp1', 'self', false],
  ] as const)('%s %s opens pupil 1: %s', async (role, userId, level, allowed) => {
    const scope = level === 'national' ? ({ level, label: 'x' } as const) : level === 'self' ? ({ level, label: 'x' } as const) : ({ level, schoolId: 's1', label: 'x' } as const)
    const call = w.student.student(ctxOf(role, userId, scope), '1')
    if (allowed) await expect(call).resolves.toBeTruthy()
    else await expect(call).rejects.toMatchObject({ status: 404 })
  })

  it('a school admin of another school and a pupil of another school see 404', async () => {
    await expect(w.student.student(ctxOf('school_admin', 'sa2', { level: 'school', schoolId: 's2', label: 'x' }), '1')).rejects.toMatchObject({ status: 404 })
  })

  it('an unknown pupil and a hidden pupil give the same outcome', async () => {
    const hidden = await w.student.student(ctxOf('student', '2'), '1').catch((e: unknown) => e)
    const unknown = await w.student.student(ctxOf('student', '2'), '12345').catch((e: unknown) => e)
    expect(hidden).toMatchObject({ status: 404, message: 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?' })
    expect(unknown).toMatchObject({ status: 404, message: 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?' })
  })

  it('an officer never opens a pupil, in or out of the district (H1)', async () => {
    const inside = ctxOf('ppd_officer', 'o1', { level: 'district', stateCode: 'Negeri A', districtCode: 'Daerah A', label: 'x' })
    const state = ctxOf('ppd_officer', 'o2', { level: 'state', stateCode: 'Negeri A', label: 'x' })
    await expect(w.student.student(inside, '1')).rejects.toMatchObject({ status: 404 })
    await expect(w.student.student(state, '1')).rejects.toMatchObject({ status: 404 })
  })

  it('a target that is not a student account is 404, even for the admin or the owner (L2)', async () => {
    w.directory.addPupil({ id: '50', name: 'Guru Ujian', schoolId: 's1', isStudent: false })
    await expect(w.student.student(ctxOf('admin', 'a', { level: 'national', label: 'x' }), '50')).rejects.toMatchObject({ status: 404 })
    await expect(w.student.student(ctxOf('teacher', '50'), '50')).rejects.toMatchObject({ status: 404 })
  })

  it('a teacher opens only pupils of an ACTIVE class of their own (L2)', async () => {
    w.classes.add({ id: '60', schoolId: 's1', teacherId: 't7', isActive: false }, ['1'])
    await expect(w.student.student(ctxOf('teacher', 't7'), '1')).rejects.toMatchObject({ status: 404 })
    w.classes.add({ id: '61', schoolId: 's1', teacherId: 't7' }, ['1'])
    await expect(w.student.student(ctxOf('teacher', 't7'), '1')).resolves.toBeTruthy()
  })
})

describe('Class dashboard', () => {
  beforeEach(() => {
    // The figures come from the single answer store (every mode); one session per call.
    // pupil 1: 9/10 today and 7/10 on 10 September -> 80 percent; pupil 2: 3/10 -> 30 percent (needs attention); pupil 3: nothing in the class subject
    answers(w, '1', 10, 9, { answeredAt: d('2026-09-25T08:00:00+08:00') })
    answers(w, '1', 10, 7, { answeredAt: d('2026-09-10T08:00:00+08:00') })
    answers(w, '2', 10, 3, { answeredAt: d('2026-09-25T09:00:00+08:00') })
    // another subject: not in this class
    answers(w, '1', 10, 1, { subjectId: '2' })
    answers(w, '3', 10, 10, { subjectId: '2' })
    // test row of pupil 3 in the class subject
    w.answers.add({ userId: '3', mode: 'latih_tubi', isCorrect: true, answeredAt: d('2026-09-25T08:00:00+08:00'), isTest: true })
  })

  const teacher = ctxOf('teacher', 't1')

  it('class figures are the sum of the members and only count the class subject', async () => {
    const r = await w.klass.classDashboard(teacher, '10')
    // no finished session row in this world: Purata Masa/Sesi is null
    expect(r.stats).toEqual({ students: 3, accuracy: 63.3, sessions: 3, answered: 30, avgMinutes: null, active7d: 2 })
    expect(r.class).toMatchObject({ id: '10', school: 'Sekolah Contoh Satu', subject: 'Bahasa Melayu' })
    expect(r.headcount).toBeNull()
    PerformanceClassDashboardSchema.parse(r)
  })

  it('ranks by accuracy, members without answers last; ties by answers descending then name', async () => {
    const r = await w.klass.classDashboard(teacher, '10')
    expect(r.ranking.map((x) => [x.rank, x.userId, x.accuracy, x.headcount])).toEqual([
      [1, '1', 80, 'na'],
      [2, '2', 30, 'na'],
      [3, '3', null, 'na'],
    ])
    expect(r.ranking[0]?.lastActiveAt).toBe('2026-09-25T08:00:00.000+08:00')
    expect(r.ranking[2]?.lastActiveAt).toBeNull()
    // two pupils at 50%: the one with more answers first, then by name
    answers(w, '4', 4, 2)
    answers(w, '5', 8, 4)
    answers(w, '6', 4, 2)
    w.directory.addPupil({ id: '4', name: 'Zainal Contoh', schoolId: 's1' }).addPupil({ id: '5', name: 'Yati Contoh', schoolId: 's1' }).addPupil({ id: '6', name: 'Azman Contoh', schoolId: 's1' })
    w.classes.add({ id: '15', schoolId: 's1', teacherId: 't1' }, ['4', '5', '6'])
    const tie = await w.klass.classDashboard(teacher, '15')
    expect(tie.ranking.map((x) => x.userId)).toEqual(['5', '6', '4'])
  })

  it('attention lists accuracy under 50 first, then members with no answers', async () => {
    const r = await w.klass.classDashboard(teacher, '10')
    expect(r.attention.map((x) => [x.userId, x.accuracy, x.sessions])).toEqual([
      ['2', 30, 1],
      ['3', null, 0],
    ])
  })

  describe('trend: 30 Malaysian days, zero-filled (R1-GUR-4)', () => {
    it('is 30 points, oldest first, ending today; days without an answer are zeros and a day of answers carries sessions, accuracy and active pupils', async () => {
      answers(w, '1', 10, 5, { answeredAt: d('2026-06-01T08:00:00+08:00') }) // older than 30 days: not in the trend
      const r = await w.klass.classDashboard(teacher, '10')
      expect(r.trend).toHaveLength(30)
      expect(r.trend[0]?.date).toBe('2026-08-27')
      expect(r.trend[29]?.date).toBe('2026-09-25')
      expect(r.trend.map((t) => t.date)).toEqual([...r.trend.map((t) => t.date)].sort())
      expect(r.trend.find((t) => t.date === '2026-09-10')).toEqual({ date: '2026-09-10', sessions: 1, avgAccuracy: 70, activeStudents: 1 })
      // 9/10 + 3/10 on the 25th: 12/20
      expect(r.trend[29]).toEqual({ date: '2026-09-25', sessions: 2, avgAccuracy: 60, activeStudents: 2 })
      expect(r.trend.filter((t) => t.activeStudents === 0).every((t) => t.sessions === 0 && t.avgAccuracy === 0)).toBe(true)
      expect(r.trend.filter((t) => t.activeStudents > 0)).toHaveLength(2)
      PerformanceClassDashboardSchema.parse(r)
    })

    it('the day is the Malaysian day: 23:30 +08:00 and 00:30 +08:00 are two different days', async () => {
      answers(w, '1', 4, 4, { answeredAt: d('2026-09-20T23:30:00+08:00') })
      answers(w, '1', 4, 0, { answeredAt: d('2026-09-21T00:30:00+08:00') })
      const r = await w.klass.classDashboard(teacher, '10')
      expect(r.trend.find((t) => t.date === '2026-09-20')).toMatchObject({ avgAccuracy: 100, activeStudents: 1 })
      expect(r.trend.find((t) => t.date === '2026-09-21')).toMatchObject({ avgAccuracy: 0, activeStudents: 1 })
    })

    it('the 30th day back is in and the 31st is out (the window starts at 00:00 +08:00)', async () => {
      answers(w, '1', 2, 2, { answeredAt: d('2026-08-27T00:00:01+08:00') })
      answers(w, '1', 2, 2, { answeredAt: d('2026-08-26T23:59:59+08:00') })
      const r = await w.klass.classDashboard(teacher, '10')
      expect(r.trend[0]).toMatchObject({ date: '2026-08-27', activeStudents: 1 })
      expect(r.trend.some((t) => t.date === '2026-08-26')).toBe(false)
    })

    it('game modes add answers (accuracy, active pupils) but no session', async () => {
      answers(w, '2', 4, 4, { mode: 'battle', answeredAt: d('2026-09-12T10:00:00+08:00') })
      const r = await w.klass.classDashboard(teacher, '10')
      expect(r.trend.find((t) => t.date === '2026-09-12')).toEqual({ date: '2026-09-12', sessions: 0, avgAccuracy: 100, activeStudents: 1 })
    })

    it('a class with no answers still has 30 zero days', async () => {
      w.classes.add({ id: '14', schoolId: 's1', teacherId: 't2' }, ['8'])
      const r = await w.klass.classDashboard(ctxOf('teacher', 't2'), '14')
      expect(r.trend).toHaveLength(30)
      expect(r.trend.every((t) => t.sessions === 0 && t.avgAccuracy === 0 && t.activeStudents === 0)).toBe(true)
    })
  })

  describe('Purata Masa/Sesi (stats.avgMinutes)', () => {
    const finished = (userId: string, timeSpentSec: number, over: Partial<Parameters<World['answers']['addSession']>[0]> = {}): void => {
      w.answers.addSession({ userId, subjectId: '1', mode: 'latih_tubi', status: 'completed', timeSpentSec, completedAt: d('2026-09-25T09:00:00+08:00'), ...over })
    }

    it('is seconds over finished sessions over 60, one decimal', async () => {
      finished('1', 600)
      finished('2', 625) // (600 + 625) / 2 / 60 = 10.208...
      expect((await w.klass.classDashboard(teacher, '10')).stats.avgMinutes).toBe(10.2)
    })

    it('rounds half up at one decimal: 3 sessions of 90 s, 91 s and 92 s are 1.5 minutes', async () => {
      finished('1', 90)
      finished('1', 91)
      finished('2', 92)
      expect((await w.klass.classDashboard(teacher, '10')).stats.avgMinutes).toBe(1.5)
      finished('3', 600)
      // (90 + 91 + 92 + 600) / 4 / 60 = 3.6375
      expect((await w.klass.classDashboard(teacher, '10')).stats.avgMinutes).toBe(3.6)
    })

    it('is null when no session has finished (in-progress, test and other-class rows do not count)', async () => {
      finished('1', 600, { status: 'in_progress' })
      finished('1', 600, { isTest: true })
      finished('9', 600) // not a member
      const r = await w.klass.classDashboard(teacher, '10')
      expect(r.stats.avgMinutes).toBeNull()
      PerformanceClassDashboardSchema.parse(r)
    })

    it('leaves game modes and other subjects out, and a class without subject takes every subject', async () => {
      finished('1', 600)
      finished('1', 6000, { mode: 'battle' })
      finished('2', 6000, { subjectId: '2' })
      expect((await w.klass.classDashboard(teacher, '10')).stats.avgMinutes).toBe(10)
      finished('3', 120, { subjectId: '3' })
      expect((await w.klass.classDashboard(ctxOf('teacher', 't2'), '11')).stats.avgMinutes).toBe(2)
    })

    it('a finished session of 0 seconds counts as a session (0 minutes, not null)', async () => {
      finished('1', 0)
      expect((await w.klass.classDashboard(teacher, '10')).stats.avgMinutes).toBe(0)
    })
  })

  it('zero answers give zeros, never NaN', async () => {
    w.classes.add({ id: '14', schoolId: 's1', teacherId: 't2' }, ['8'])
    const r = await w.klass.classDashboard(ctxOf('teacher', 't2'), '14')
    expect(r.stats).toEqual({ students: 1, accuracy: 0, sessions: 0, answered: 0, avgMinutes: null, active7d: 0 })
  })

  it('a class without subject counts every subject', async () => {
    const r = await w.klass.classDashboard(ctxOf('teacher', 't2'), '11')
    expect(r.stats.sessions).toBe(1)
    answers(w, '3', 5, 2, { subjectId: '3', answeredAt: d('2026-09-25T08:00:00+08:00') })
    expect((await w.klass.classDashboard(ctxOf('teacher', 't2'), '11')).stats.sessions).toBe(2)
  })

  it('AC-X4-1: 10 latihan answers (7 right) and one simulasi of 40 (30 right) are 50 answers and 37 right on the class dashboard and the school page', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' }).addPupil({ id: '1', schoolId: 's1' }).addTeacher('t1', 'Cikgu Satu', 's1')
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ['1'])
    answers(x, '1', 10, 7, { mode: 'latih_tubi' })
    answers(x, '1', 40, 30, { mode: 'simulasi', subjectId: '2' })
    const cls = await x.klass.classDashboard(ctxOf('teacher', 't1'), '10')
    expect(cls.stats).toMatchObject({ answered: 50, sessions: 2, accuracy: 74 })
    expect(cls.ranking[0]).toMatchObject({ answered: 50, accuracy: 74 })
    const school = await x.school.school(ctxOf('school_admin', 'sa1'))
    expect(school.stats).toMatchObject({ answered: 50, sessions: 2, accuracy: 74 })
    // 37 / 50 = 74: the same figure on both pages
    expect(cls.stats.accuracy).toBe(school.stats.accuracy)
  })

  it('game modes add answers but never a session', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' }).addPupil({ id: '1', schoolId: 's1' })
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ['1'])
    answers(x, '1', 10, 5, { mode: 'battle' })
    const cls = await x.klass.classDashboard(ctxOf('teacher', 't1'), '10')
    expect(cls.stats).toMatchObject({ answered: 10, sessions: 0 })
  })

  it.each([
    ['teacher', 't3', 404],
    ['student', '1', 404],
    ['ppd_officer', 'o1', 404],
  ] as const)('%s %s: %s', async (role, id, status) => {
    await expect(w.klass.classDashboard(ctxOf(role, id), '10')).rejects.toMatchObject({ status })
  })

  it('unknown and school-kind classes are 404; school admin opens own school classrooms only', async () => {
    await expect(w.klass.classDashboard(teacher, '999')).rejects.toMatchObject({ status: 404 })
    await expect(w.klass.classDashboard(ctxOf('admin', 'a', { level: 'national', label: 'x' }), '12')).rejects.toMatchObject({ status: 404 })
    await expect(w.klass.classDashboard(ctxOf('school_admin', 'sa1'), '10')).resolves.toBeTruthy()
    await expect(w.klass.classDashboard(ctxOf('school_admin', 'sa2', { level: 'school', schoolId: 's2', label: 'x' }), '10')).rejects.toMatchObject({ status: 404 })
  })

  it('own classes: active classrooms of the teacher only', async () => {
    w.classes.add({ id: '13', schoolId: 's1', teacherId: 't1', isActive: false })
    expect((await w.klass.ownClasses(teacher)).map((c) => c.id)).toEqual(['10'])
    expect(await w.klass.ownClasses(ctxOf('admin', 'a', { level: 'national', label: 'x' }))).toEqual([])
    expect((await w.klass.ownClasses(teacher))[0]).toMatchObject({ color: '#6366F1', students: 3 })
  })

  it('own classes: a school admin gets the active classrooms of the own school (not school classes, not another school)', async () => {
    w.classes.add({ id: '13', schoolId: 's1', teacherId: 't1', isActive: false }).add({ id: '30', schoolId: 's2', teacherId: 't9' })
    expect((await w.klass.ownClasses(ctxOf('school_admin', 'sa1'))).map((c) => c.id)).toEqual(['10', '11'])
    expect(await w.klass.ownClasses(ctxOf('school_admin', 'sa0', { level: 'national', label: 'x' }))).toEqual([])
  })

  it('classes aggregate: Pelajar Terbaik (5+ answers) and Prestasi Mengikut Subjek over the pupils of the own classes', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' }).addSubject('BM', '1', 'Bahasa Melayu').addSubject('MT', '2', 'Matematik')
    for (const id of ['1', '2', '3', '9']) x.directory.addPupil({ id, name: `Murid ${id}`, schoolId: 's1' })
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ['1', '2', '3']).add({ id: '90', schoolId: 's1', teacherId: 't9' }, ['9'])
    answers(x, '1', 10, 9)
    answers(x, '2', 10, 9)
    answers(x, '2', 4, 4, { subjectId: '2' })
    answers(x, '3', 4, 4) // fewer than 5 answers: not a top student
    answers(x, '9', 10, 10) // not a pupil of the teacher's classes
    const r = await x.klass.classesAggregate(teacher)
    expect(r.classes.map((c) => c.id)).toEqual(['10'])
    // 2 has 13 of 14 right (92.9%); 1 has 90%; 3 has 4 answers and is left out; 9 is not a pupil of the own classes
    expect(r.topStudents.map((t) => [t.userId, t.answered, t.accuracy])).toEqual([['2', 14, 92.9], ['1', 10, 90]])
    // Matematik: 4 of 4 = 100; Bahasa Melayu: 9 + 9 + 4 = 22 of 24 = 91.7
    expect(r.subjects.map((v) => [v.subjectId, v.name, v.answered, v.accuracy])).toEqual([['2', 'Matematik', 4, 100], ['1', 'Bahasa Melayu', 24, 91.7]])
    PerformanceClassesAggregateSchema.parse(r)
    expect(await x.klass.classesAggregate(ctxOf('teacher', 'nobody'))).toEqual({ classes: [], topStudents: [], subjects: [] })
  })
})

describe('Analitik', () => {
  describe('SW13-08: one subject is one row, whether a sitting stores the curriculum id or the Bijak code', () => {
    beforeEach(() => {
      w.directory.addSubject('MAT', '3')
      const mat = { subjectCode: 'MAT', subjectName: 'Matematik' }
      w.bijak
        .addSitting(sitting({ userId: '1', score: 9, maxScore: 10, answeredCount: 5, subjectId: '3', ...mat }))
        .addSitting(sitting({ userId: '1', score: 5, maxScore: 10, answeredCount: 4, subjectId: 'MAT', ...mat }))
    })

    describe("migrated 'legacy' sittings are no subject row but still count in the totals", () => {
      const legacy = { subjectId: 'legacy', subjectCode: 'legacy', subjectName: 'Tidak diketahui' }
      beforeEach(() => {
        w.bijak.addSitting(sitting({ userId: '1', score: 2, maxScore: 10, answeredCount: 3, ...legacy }))
      })

      it('student: one mastery row, while stats still include answers that carry no curriculum subject', async () => {
        w.answers.addMany('1', 5, 4, { mode: 'latih_tubi', subjectId: '3', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
        w.answers.addMany('1', 4, 3, { mode: 'latih_tubi', subjectId: '3', sessionId: 'sB', answeredAt: d('2026-09-23T10:00:00+08:00') })
        w.answers.addMany('1', 3, 1, { mode: 'latih_tubi', sessionId: 'sC', answeredAt: d('2026-09-24T10:00:00+08:00') })
        const r = await w.student.student(ctxOf('student', '1'), '1')
        expect(r.mastery.map((m) => m.subjectCode)).toEqual(['MAT'])
        expect(r.stats.answered).toBe(12)
        expect(r.stats.sessions).toBe(3)
      })
    })

    it('student mastery: one row per subject as well', async () => {
      w.answers.addMany('1', 5, 4, { mode: 'latih_tubi', subjectId: '3', sessionId: 'sA', answeredAt: d('2026-09-22T10:00:00+08:00') })
      w.answers.addMany('1', 4, 3, { mode: 'latih_tubi', subjectId: '3', sessionId: 'sB', answeredAt: d('2026-09-23T10:00:00+08:00') })
      const r = await w.student.student(ctxOf('student', '1'), '1')
      expect(r.mastery).toHaveLength(1)
      expect(r.mastery[0]).toMatchObject({ subjectCode: 'MAT', accuracy: 77.8, sessions: 2, answered: 9 })
    })
  })

  describe('classes (Analitik Adaptif, S10-T04 part 2: the shared answer reader, all modes)', () => {
    const THIS_WEEK = d('2026-09-23T10:00:00+08:00') // inside [2026-09-19, 2026-09-26)
    const LAST_WEEK = d('2026-09-15T10:00:00+08:00') // inside [2026-09-12, 2026-09-19)
    const OLD = d('2026-08-01T10:00:00+08:00')
    const put = (userId: string, n: number, correct: number, over: Partial<{ mode: string; subjectId: string; answeredAt: Date; isTest: boolean }> = {}) =>
      w.answers.addMany(userId, n, correct, { mode: 'latih_tubi', subjectId: '1', answeredAt: OLD, ...over })

    beforeEach(() => {
      w.directory.addSubject('BM', '1', 'Bahasa Melayu').addSubject('MT', '2', 'Matematik')
      put('1', 10, 9)
      put('2', 10, 3)
      put('3', 10, 5)
    })

    it('a class without members does not call the answer reader (empty guard)', async () => {
      w.classes.add({ id: '70', schoolId: 's1', teacherId: 't8' }, [])
      let calls = 0
      const inner = w.ports.answerFacts.answerFacts.bind(w.ports.answerFacts)
      w.ports.answerFacts.answerFacts = async (q) => {
        calls++
        return inner(q)
      }
      const r = await w.analytics.classes(ctxOf('teacher', 't8'), {})
      expect(r.rows).toEqual([])
      expect(r.summary).toBeNull()
      expect(calls).toBe(0)
    })

    it('Semua Kelas and Semua Subjek by default: every own class, every active subject; sorted by accuracy; pooled Purata Ketepatan', async () => {
      const r = await w.analytics.classes(ctxOf('teacher', 't1'), {})
      expect(r.options.selected).toEqual({ classroomId: null, subjectId: null, riskLevel: '' })
      expect(r.options.classes).toEqual([{ id: '10', name: 'Kelas 10' }])
      expect(r.options.subjects).toEqual([
        { id: '1', name: 'Bahasa Melayu' },
        { id: '2', name: 'Matematik' },
      ])
      expect(r.rows.map((x) => [x.userId, x.accuracy, x.riskLevel, x.classes])).toEqual([
        ['2', 30, 'critical', []],
        ['3', 50, 'high', []],
        ['1', 90, 'low', []],
      ])
      expect(r.summary).toEqual({ students: 3, accuracy: 56.7, atRisk: 2, good: 1 })
      PerformanceClassAnalyticsSchema.parse(r)
    })

    it('AC-GUR-5-7: answers of every mode count (Latih Tubi 7 of 10 plus Battle 30 of 40 = 37 of 50 = 74%, Rendah); test rows never count', async () => {
      w.directory.addPupil({ id: '5', name: 'Eman Contoh', schoolId: 's1' })
      w.classes.add({ id: '30', schoolId: 's1', teacherId: 't3' }, ['5'])
      put('5', 10, 7)
      put('5', 40, 30, { mode: 'battle' })
      put('5', 10, 10, { isTest: true })
      const r = await w.analytics.classes(ctxOf('teacher', 't3'), {})
      expect(r.rows).toHaveLength(1)
      expect(r.rows[0]).toMatchObject({ userId: '5', accuracy: 74, answered: 50, riskLevel: 'low' })
    })

    it('AC-GUR-5-3: a pupil with no answers is Belum Bermula (none, no accuracy, no projection), last, counted in Jumlah Pelajar, not in the average', async () => {
      w.directory.addPupil({ id: '4', name: 'Aaa Contoh', schoolId: 's1' })
      w.classes.add({ id: '14b', schoolId: 's1', teacherId: 't1' }, ['4'])
      const r = await w.analytics.classes(ctxOf('teacher', 't1'), {})
      expect(r.rows.map((x) => x.userId)).toEqual(['2', '3', '1', '4'])
      expect(r.rows.at(-1)).toMatchObject({ userId: '4', accuracy: null, answered: 0, trend: 'stable', projection: null, riskLevel: 'none' })
      expect(r.summary).toEqual({ students: 4, accuracy: 56.7, atRisk: 2, good: 1 })
      // an inactive account and a non-student are not on the roster
      w.directory.addPupil({ id: '6', name: 'Off Contoh', schoolId: 's1', isActive: false }).addPupil({ id: '7', name: 'Guru Contoh', schoolId: 's1', isStudent: false })
      w.classes.add({ id: '15b', schoolId: 's1', teacherId: 't1' }, ['6', '7'])
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), {})).summary?.students).toBe(4)
      // "Semua Risiko" shows them; a risk filter never does; nobody is Belum Bermula-only: summary accuracy is null
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), { riskLevel: 'low' })).rows.map((x) => x.userId)).toEqual(['1'])
    })

    it('only Belum Bermula pupils: a summary with null accuracy', async () => {
      w.directory.addPupil({ id: '4', name: 'Aaa Contoh', schoolId: 's1' })
      w.classes.add({ id: '31', schoolId: 's1', teacherId: 't4' }, ['4'])
      const r = await w.analytics.classes(ctxOf('teacher', 't4'), {})
      expect(r.summary).toEqual({ students: 1, accuracy: null, atRisk: 0, good: 0 })
      PerformanceClassAnalyticsSchema.parse(r)
    })

    it('a pupil in two own classes is one row and one in Jumlah Pelajar', async () => {
      w.classes.add({ id: '16', schoolId: 's1', teacherId: 't1' }, ['1', '2'])
      const r = await w.analytics.classes(ctxOf('teacher', 't1'), {})
      expect(r.rows).toHaveLength(3)
      expect(r.summary?.students).toBe(3)
    })

    it('a named class narrows the roster; a subject narrows the answers', async () => {
      w.classes.add({ id: '16', schoolId: 's1', teacherId: 't1' }, ['1'])
      put('1', 10, 1, { subjectId: '2' })
      const one = await w.analytics.classes(ctxOf('teacher', 't1'), { classroomId: '16' })
      expect(one.options.selected.classroomId).toBe('16')
      expect(one.rows.map((x) => [x.userId, x.accuracy, x.answered])).toEqual([['1', 50, 20]])
      const bm = await w.analytics.classes(ctxOf('teacher', 't1'), { classroomId: '16', subjectId: '1' })
      expect(bm.rows.map((x) => [x.accuracy, x.answered])).toEqual([[90, 10]])
      const mt = await w.analytics.classes(ctxOf('teacher', 't1'), { subjectId: '2' })
      expect(mt.rows.map((x) => [x.userId, x.accuracy, x.riskLevel])).toEqual([
        ['1', 10, 'critical'],
        ['2', null, 'none'],
        ['3', null, 'none'],
      ])
    })

    describe('risk bands on the whole-number accuracy (AC-GUR-5-2, AC-GUR-5-8)', () => {
      it.each([
        [39, 'critical'],
        [40, 'high'],
        [54, 'high'],
        [55, 'medium'],
        [69, 'medium'],
        [70, 'low'],
        [39.5, 'high'],
        [54.5, 'medium'],
        [69.5, 'low'],
        [0, 'critical'],
        [100, 'low'],
      ])('%s%% is %s', (value, level) => {
        expect(riskOfWholePercent(value)).toBe(level)
      })

      it('8 of 20 is Tinggi, 7 of 20 Kritikal, 14 of 20 Rendah; the filter lists exactly the band', async () => {
        const accuracies: [string, number][] = [['21', 39], ['22', 40], ['23', 54], ['24', 55], ['25', 69], ['26', 70]]
        for (const [id, acc] of accuracies) {
          w.directory.addPupil({ id, name: `P${id} Contoh`, schoolId: 's1' })
          put(id, 100, acc)
        }
        w.classes.add({ id: '40', schoolId: 's1', teacherId: 't5' }, accuracies.map(([id]) => id))
        const ids = async (riskLevel: string) => (await w.analytics.classes(ctxOf('teacher', 't5'), { riskLevel })).rows.map((x) => x.userId).sort()
        expect(await ids('critical')).toEqual(['21'])
        expect(await ids('high')).toEqual(['22', '23'])
        expect(await ids('medium')).toEqual(['24', '25'])
        expect(await ids('low')).toEqual(['26'])
        w.directory.addPupil({ id: '31', name: 'Q31 Contoh', schoolId: 's1' }).addPupil({ id: '32', name: 'Q32 Contoh', schoolId: 's1' }).addPupil({ id: '33', name: 'Q33 Contoh', schoolId: 's1' })
        put('31', 20, 8)
        put('32', 20, 7)
        put('33', 20, 14)
        w.classes.add({ id: '41', schoolId: 's1', teacherId: 't6' }, ['31', '32', '33'])
        const r = await w.analytics.classes(ctxOf('teacher', 't6'), {})
        expect(r.rows.map((x) => [x.userId, x.riskLevel])).toEqual([
          ['32', 'critical'],
          ['31', 'high'],
          ['33', 'low'],
        ])
        // 14 of 20 is 70%: Rendah
        expect(r.rows.find((x) => x.userId === '33')).toMatchObject({ accuracy: 70, riskLevel: 'low' })
      })
    })

    it('R-2: the band is applied to the whole-number accuracy rounded half up from the UNROUNDED percentage (39.46 is 39 Kritikal; 39.5 is 40 Tinggi)', async () => {
      w.directory.addPupil({ id: '61', name: 'B61 Contoh', schoolId: 's1' }).addPupil({ id: '62', name: 'B62 Contoh', schoolId: 's1' })
      w.classes.add({ id: '62c', schoolId: 's1', teacherId: 't9' }, ['61', '62'])
      put('61', 5000, 1973) // 39.46%: shown 39.5 at one decimal, but the band uses 39.46 -> 39
      put('62', 200, 79) // 39.5% -> 40
      const r = await w.analytics.classes(ctxOf('teacher', 't9'), {})
      expect(r.rows.map((x) => [x.userId, x.accuracy, x.riskLevel])).toEqual([
        ['61', 39.5, 'critical'],
        ['62', 39.5, 'high'],
      ])
    })

    it('R-2: the roster is the XS-1 pupils; a suspended pupil and a non-Tingkatan 1-5 member are out of the cards and the table', async () => {
      w.directory
        .addPupil({ id: '71', name: 'X71 Contoh', schoolId: 's1' })
        .addPupil({ id: '72', name: 'X72 Contoh', schoolId: 's1', isSuspended: true })
        .addPupil({ id: '73', name: 'X73 Contoh', schoolId: 's1', grade: 12, levelSlug: 't6' })
        .addPupil({ id: '74', name: 'X74 Contoh', schoolId: 's1', grade: 6, levelSlug: null })
      w.classes.add({ id: '71c', schoolId: 's1', teacherId: 't10' }, ['71', '72', '73', '74'])
      put('71', 10, 9)
      put('72', 10, 1) // would be Pelajar Berisiko if counted
      put('73', 10, 1)
      put('74', 10, 1)
      for (const [role, id] of [['teacher', 't10'], ['school_admin', 'sa1']] as const) {
        const r = await w.analytics.classes(ctxOf(role, id), role === 'school_admin' ? { classroomId: '71c' } : {})
        expect(r.rows.map((x) => x.userId)).toEqual(['71'])
        expect(r.summary).toEqual({ students: 1, accuracy: 90, atRisk: 0, good: 1 })
      }
    })

    describe('trend: last 7 days against the 7 before (strict +/-3 points), BARU for first-week activity', () => {
      const trendOf = async (userId: string) => (await w.analytics.classes(ctxOf('teacher', 't7'), {})).rows.find((x) => x.userId === userId)?.trend
      beforeEach(() => {
        for (const id of ['41', '42', '43', '44', '45', '46']) w.directory.addPupil({ id, name: `T${id} Contoh`, schoolId: 's1' })
        w.classes.add({ id: '50', schoolId: 's1', teacherId: 't7' }, ['41', '42', '43', '44', '45', '46'])
        // 41: 50% last week, 60% this week (+10): up
        put('41', 10, 5, { answeredAt: LAST_WEEK })
        put('41', 10, 6, { answeredAt: THIS_WEEK })
        // 42: 60 then 50: down
        put('42', 10, 6, { answeredAt: LAST_WEEK })
        put('42', 10, 5, { answeredAt: THIS_WEEK })
        // 43: 50 then 80 on the same questions is up, but +3 exactly (100 answers 50 then 53) is stable
        put('43', 100, 50, { answeredAt: LAST_WEEK })
        put('43', 100, 53, { answeredAt: THIS_WEEK })
        // 44: -3 exactly: stable
        put('44', 100, 53, { answeredAt: LAST_WEEK })
        put('44', 100, 50, { answeredAt: THIS_WEEK })
        // 45: only this week: BARU
        put('45', 10, 5, { answeredAt: THIS_WEEK })
        // 46: only before: stable (nothing this week)
        put('46', 10, 5, { answeredAt: LAST_WEEK })
      })

      it('up above +3, down below -3, exactly 3 is stable', async () => {
        expect(await trendOf('41')).toBe('up')
        expect(await trendOf('42')).toBe('down')
        expect(await trendOf('43')).toBe('stable')
        expect(await trendOf('44')).toBe('stable')
      })

      it('only this week is new; nothing this week is stable', async () => {
        expect(await trendOf('45')).toBe('new')
        expect(await trendOf('46')).toBe('stable')
      })

      it('the pure rule: no earlier answers is new, no recent answers is stable', () => {
        expect(analyticsTrendOf({ correct: 1, attempts: 1 }, { correct: 0, attempts: 0 })).toBe('new')
        expect(analyticsTrendOf({ correct: 0, attempts: 0 }, { correct: 1, attempts: 1 })).toBe('stable')
      })
    })

    it('an unknown risk level means all', async () => {
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), { riskLevel: 'critical' })).rows.map((x) => x.userId)).toEqual(['2'])
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), { riskLevel: 'bogus' })).rows).toHaveLength(3)
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), { riskLevel: 'bogus' })).options.selected.riskLevel).toBe('')
      // Belum Bermula is not a filter value
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), { riskLevel: 'none' })).rows).toHaveLength(3)
    })

    it('an unknown classroom and another teacher class give the same 403 (M3); other roles are 403', async () => {
      const unknown = await w.analytics.classes(ctxOf('teacher', 't1'), { classroomId: '999' }).catch((e: unknown) => e)
      const forbidden = await w.analytics.classes(ctxOf('teacher', 't2'), { classroomId: '10' }).catch((e: unknown) => e)
      expect(unknown).toMatchObject({ status: 403, message: 'Anda tidak dibenarkan melakukan tindakan ini.' })
      expect(forbidden).toMatchObject({ status: 403, message: 'Anda tidak dibenarkan melakukan tindakan ini.' })
      await expect(w.analytics.classes(ctxOf('student', '1'), {})).rejects.toMatchObject({ status: 403 })
      await expect(w.analytics.classes(ctxOf('ppd_officer', 'o1', { level: 'national', label: 'Nasional' }), {})).rejects.toMatchObject({ status: 403 })
    })

    it('a teacher never sees a pupil of a class of another teacher (own classes only)', async () => {
      const r = await w.analytics.classes(ctxOf('teacher', 't2'), {})
      expect(r.rows.map((x) => x.userId)).toEqual(['3'])
    })

    it('an admin without a classroom gets no roster; with a classroom reads it like its teacher', async () => {
      const admin = ctxOf('admin', 'a', { level: 'national', label: 'x' })
      const none = await w.analytics.classes(admin, {})
      expect(none.options.selected.classroomId).toBeNull()
      expect(none.rows).toEqual([])
      const r = await w.analytics.classes(admin, { classroomId: '10' })
      expect(r.rows.map((x) => x.userId)).toEqual(['2', '3', '1'])
      expect(r.rows.every((x) => x.classes.length === 0)).toBe(true)
    })

    describe('S10-T04 Change (2) and part 2: a school admin reads the own school only (API-AS-16, R1-AS-5)', () => {
      beforeEach(() => {
        // another school: a pupil at 20% and a class
        w.classes.add({ id: '80', schoolId: 's2', teacherId: 't9' }, ['9'])
        put('9', 10, 2)
        // own school: pupil 2 is at 30%
        w.classes.add({ id: '13', schoolId: 's1', teacherId: 't1', levelSlug: 't5', name: 'A Kelas' }, ['1'])
        w.classes.add({ id: '14', schoolId: 's1', teacherId: 't1', levelSlug: 't4', name: 'B Kelas' }, ['2'])
        w.classes.add({ id: '15', schoolId: 's1', teacherId: 't1', levelSlug: 't4', name: 'A Kelas' }, [])
      })

      it('AC-AS-5-6: Kritikal lists only the own school pupil at 30%, not the other school pupil at 20%', async () => {
        const r = await w.analytics.classes(ctxOf('school_admin', 'sa1'), { riskLevel: 'critical' })
        expect(r.rows.map((x) => [x.userId, x.accuracy])).toEqual([['2', 30]])
        expect(r.rows.map((x) => x.userId)).not.toContain('9')
      })

      it('lists the school classes by Tingkatan then name, defaults to Semua Kelas, and gives each pupil the Kelas names', async () => {
        const r = await w.analytics.classes(ctxOf('school_admin', 'sa1'), {})
        expect(r.options.classes.map((c) => c.id)).toEqual(['15', '14', '10', '11', '13'])
        expect(r.options.selected.classroomId).toBeNull()
        expect(r.options.classes.map((c) => c.id)).not.toContain('80')
        expect(r.rows.map((x) => x.userId)).not.toContain('9')
        expect(r.rows.find((x) => x.userId === '1')?.classes).toEqual(['Kelas 10', 'A Kelas'])
        expect(r.rows.find((x) => x.userId === '2')?.classes).toEqual(['B Kelas', 'Kelas 10'])
        expect(r.summary?.students).toBe(3)
        PerformanceClassAnalyticsSchema.parse(r)
      })

      it('one class narrows to that class; same rules as a teacher on the same class', async () => {
        const own = await w.analytics.classes(ctxOf('school_admin', 'sa1'), { classroomId: '10' })
        const teacher = await w.analytics.classes(ctxOf('teacher', 't1'), { classroomId: '10' })
        expect(own.rows.map((r) => ({ ...r, classes: [] }))).toEqual(teacher.rows)
        expect(own.summary).toEqual(teacher.summary)
        expect(own.rows.every((x) => x.classes.join() === 'Kelas 10')).toBe(true)
      })

      it('a class of another school is 403, the same answer as an unknown class', async () => {
        await expect(w.analytics.classes(ctxOf('school_admin', 'sa1'), { classroomId: '80' })).rejects.toMatchObject({ status: 403 })
        await expect(w.analytics.classes(ctxOf('school_admin', 'sa1'), { classroomId: '999' })).rejects.toMatchObject({ status: 403 })
      })

      it('a school admin without a school in scope gets no class and no rows', async () => {
        const r = await w.analytics.classes(ctxOf('school_admin', 'sa1', { level: 'national', label: 'Nasional' }), {})
        expect(r.options.classes).toEqual([])
        expect(r.rows).toEqual([])
        await expect(w.analytics.classes(ctxOf('school_admin', 'sa1', { level: 'national', label: 'Nasional' }), { classroomId: '10' })).rejects.toMatchObject({ status: 403 })
      })
    })
  })
})

describe('Soalan Dijawab counts answered questions, not the paper marks (issue 61 m1)', () => {
  // The pupil answered 3 and 2 questions in two subjects (the single answer store; marks per question are not 1).
  beforeEach(() => {
    // Analitik still reads the Bijak sittings (not part of S10-T07).
    w.bijak
      .addSitting(sitting({ userId: '1', score: 6, maxScore: 10, answeredCount: 3, submittedAt: d('2026-09-24T10:00:00+08:00') }))
      .addSitting(sitting({ userId: '1', score: 0, maxScore: 10, answeredCount: 0, submittedAt: d('2026-09-24T11:00:00+08:00') }))
      .addSitting(sitting({ userId: '1', score: 4, maxScore: 10, answeredCount: 2, subjectId: '2', subjectCode: 'MT', subjectName: 'Matematik', submittedAt: d('2026-09-25T09:00:00+08:00') }))
    w.directory.addSubject('BM', '1', 'Bahasa Melayu').addSubject('MT', '2', 'Matematik')
    w.answers.addMany('1', 3, 2, { mode: 'simulasi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-24T10:00:00+08:00') })
    w.answers.addMany('1', 2, 1, { mode: 'simulasi', subjectId: '2', sessionId: 'sB', answeredAt: d('2026-09-25T09:00:00+08:00') })
  })

  it('student: stats.answered and mastery.answered are the answered questions of the answer store, not the paper marks', async () => {
    const r = await w.student.student(ctxOf('student', '1'), '1')
    expect(r.stats.answered).toBe(5)
    expect(r.mastery.map((m) => [m.subjectCode, m.answered])).toEqual([
      ['BM', 3],
      ['MT', 2],
    ])
  })

  it('class dashboard: stats.answered and the ranking rows', async () => {
    const r = await w.klass.classDashboard(ctxOf('teacher', 't1'), '10')
    expect(r.stats.answered).toBe(3)
    expect(r.ranking.find((x) => x.userId === '1')?.answered).toBe(3)
  })

  it('school dashboard: stats.answered', async () => {
    const r = await w.school.school(ctxOf('school_admin', 'sa1'))
    expect(r.stats.answered).toBe(5)
  })

})
