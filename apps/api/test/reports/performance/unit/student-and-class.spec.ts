import {
  PerformanceClassAnalyticsSchema,
  PerformanceClassDashboardSchema,
  PerformanceStudentSchema,
  PerformanceAnalyticsSchema,
} from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { ctxOf, sitting, world, type World } from '../fakes/fixtures'

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
        { spId: '104', label: 'Topik Banyak', code: '5.1', subjectCode: 'BM', levelId: 'lv-t4', attempts: 30, accuracy: 0, focusCount: 25 },
        { spId: '51', label: 'Bab Tanpa Topik', code: null, subjectCode: 'MT', levelId: null, attempts: 2, accuracy: 0, focusCount: 2 },
        { spId: '100', label: 'Topik Lemah', code: '5.1', subjectCode: 'BM', levelId: 'lv-t4', attempts: 4, accuracy: 25, focusCount: 3 },
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
      expect(near).toMatchObject({ attempts: 2500, accuracy: 60, focusCount: 25 })
    })
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
    w.bijak
      // pupil 1: 9/10 and 7/10 -> 80 percent; pupil 2: 3/10 -> 30 percent (needs attention); pupil 3: nothing
      .addSitting(sitting({ userId: '1', score: 9, maxScore: 10, durationSeconds: 600, submittedAt: d('2026-09-25T08:00:00+08:00') }))
      .addSitting(sitting({ userId: '1', score: 7, maxScore: 10, durationSeconds: 600, submittedAt: d('2026-09-10T08:00:00+08:00') }))
      .addSitting(sitting({ userId: '2', score: 3, maxScore: 10, durationSeconds: 1200, submittedAt: d('2026-09-25T09:00:00+08:00') }))
      // another subject: not in this class
      .addSitting(sitting({ userId: '1', score: 1, maxScore: 10, subjectId: '2', subjectCode: 'MT', subjectName: 'Matematik' }))
      .addSitting(sitting({ userId: '3', score: 10, maxScore: 10, subjectId: '2', subjectCode: 'MT', subjectName: 'Matematik' }))
      // test row of pupil 3 in the class subject
      .addSitting(sitting({ userId: '3', score: 10, maxScore: 10 }), { isTest: true })
  })

  const teacher = ctxOf('teacher', 't1')

  it('class figures are the sum of the members and only count the class subject', async () => {
    const r = await w.klass.classDashboard(teacher, '10')
    expect(r.stats).toEqual({ students: 3, accuracy: 63.3, sessions: 3, answered: 15, avgMinutes: 13.3, active7d: 2 })
    expect(r.class).toMatchObject({ id: '10', school: 'Sekolah Contoh Satu', subject: 'Bahasa Melayu' })
    expect(r.headcount).toBeNull()
    PerformanceClassDashboardSchema.parse(r)
  })

  it('ranks by accuracy, members without marks last; ties are not shared', async () => {
    const r = await w.klass.classDashboard(teacher, '10')
    expect(r.ranking.map((x) => [x.rank, x.userId, x.accuracy, x.headcount])).toEqual([
      [1, '1', 80, 'na'],
      [2, '2', 30, 'na'],
      [3, '3', null, 'na'],
    ])
    expect(r.ranking[0]?.lastActiveAt).toBe('2026-09-25T08:00:00.000+08:00')
    expect(r.ranking[2]?.lastActiveAt).toBeNull()
  })

  it('attention lists accuracy under 50 first, then members with no sittings', async () => {
    const r = await w.klass.classDashboard(teacher, '10')
    expect(r.attention.map((x) => [x.userId, x.accuracy, x.sessions])).toEqual([
      ['2', 30, 1],
      ['3', null, 0],
    ])
  })

  it('trend has one point per Malaysian day with sittings in the last 30 days', async () => {
    const r = await w.klass.classDashboard(teacher, '10')
    expect(r.trend).toEqual([
      { date: '2026-09-10', sessions: 1, avgAccuracy: 70, activeStudents: 1 },
      { date: '2026-09-25', sessions: 2, avgAccuracy: 60, activeStudents: 2 },
    ])
  })

  it('zero marks and no sittings give zeros, never NaN', async () => {
    w.classes.add({ id: '14', schoolId: 's1', teacherId: 't2' }, ['8'])
    const r = await w.klass.classDashboard(ctxOf('teacher', 't2'), '14')
    expect(r.stats).toEqual({ students: 1, accuracy: 0, sessions: 0, answered: 0, avgMinutes: 0, active7d: 0 })
    expect(r.trend).toEqual([])
  })

  it('a class without subject counts every subject', async () => {
    const r = await w.klass.classDashboard(ctxOf('teacher', 't2'), '11')
    expect(r.stats.sessions).toBe(1)
    w.bijak.addSitting(sitting({ userId: '3', score: 5, maxScore: 10, subjectId: '3', submittedAt: d('2026-09-25T08:00:00+08:00') }))
    expect((await w.klass.classDashboard(ctxOf('teacher', 't2'), '11')).stats.sessions).toBe(2)
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
})

describe('Analitik', () => {
  it('me: per subject, trend compares the last 30 days with the 30 before; provisional never counts', async () => {
    w.bijak
      .addSitting(sitting({ userId: '1', score: 9, maxScore: 10, submittedAt: d('2026-09-20T08:00:00+08:00') }))
      .addSitting(sitting({ userId: '1', score: 6, maxScore: 10, submittedAt: d('2026-08-20T08:00:00+08:00') }))
      .addSitting(sitting({ userId: '1', score: 0, maxScore: 10, provisional: true, submittedAt: d('2026-09-21T08:00:00+08:00') }))
    const r = await w.analytics.me(ctxOf('student', '1'))
    expect(r.userLevelId).toBe('10')
    expect(r.subjects).toHaveLength(1)
    expect(r.subjects[0]).toMatchObject({ subjectId: '1', accuracy: 75, answered: 15, trend: 'up', projection: { low: 'B+', high: 'A' } })
    PerformanceAnalyticsSchema.parse(r)
  })

  describe('SW13-08: one subject is one row, whether a sitting stores the curriculum id or the Bijak code', () => {
    beforeEach(() => {
      w.directory.addSubject('MAT', '3')
      const mat = { subjectCode: 'MAT', subjectName: 'Matematik' }
      w.bijak
        .addSitting(sitting({ userId: '1', score: 9, maxScore: 10, answeredCount: 5, subjectId: '3', ...mat }))
        .addSitting(sitting({ userId: '1', score: 5, maxScore: 10, answeredCount: 4, subjectId: 'MAT', ...mat }))
    })

    it('me: exactly one row under the curriculum id, with the combined figures', async () => {
      const r = await w.analytics.me(ctxOf('student', '1'))
      expect(r.subjects).toHaveLength(1)
      expect(r.subjects[0]).toMatchObject({ subjectId: '3', name: 'Matematik', code: 'MAT', accuracy: 70, answered: 9 })
      PerformanceAnalyticsSchema.parse(r)
    })

    it('me: a code with no curriculum subject keeps the sitting id and stays its own row', async () => {
      w.bijak.addSitting(sitting({ userId: '1', score: 5, maxScore: 10, subjectId: 'XYZ', subjectCode: 'XYZ', subjectName: 'Lain' }))
      const r = await w.analytics.me(ctxOf('student', '1'))
      expect(r.subjects.map((x) => x.subjectId)).toEqual(['3', 'XYZ'])
    })

    describe("migrated 'legacy' sittings are no subject row but still count in the totals", () => {
      const legacy = { subjectId: 'legacy', subjectCode: 'legacy', subjectName: 'Tidak diketahui' }
      beforeEach(() => {
        w.bijak.addSitting(sitting({ userId: '1', score: 2, maxScore: 10, answeredCount: 3, ...legacy }))
      })

      it('me: one subject row (MAT to 3)', async () => {
        const r = await w.analytics.me(ctxOf('student', '1'))
        expect(r.subjects.map((x) => x.subjectId)).toEqual(['3'])
        expect(r.subjects[0]).toMatchObject({ accuracy: 70, answered: 9 })
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

  it('me with no sittings is the empty payload', async () => {
    const r = await w.analytics.me(ctxOf('student', '2'))
    expect(r.subjects).toEqual([])
    expect(r.topWeak).toEqual([])
    PerformanceAnalyticsSchema.parse(r)
  })

  describe('classes', () => {
    it('a class without members does not call the port (empty guard)', async () => {
      w.classes.add({ id: '70', schoolId: 's1', teacherId: 't8' }, [])
      let calls = 0
      const inner = w.ports.bijak.sittings.bind(w.ports.bijak)
      w.ports.bijak.sittings = async (q) => {
        calls++
        return inner(q)
      }
      const r = await w.analytics.classes(ctxOf('teacher', 't8'), {})
      expect(r.rows).toEqual([])
      expect(calls).toBe(0)
      await w.klass.classDashboard(ctxOf('teacher', 't8'), '70')
      expect(calls).toBe(0)
    })

    beforeEach(() => {
      w.bijak
        .addSitting(sitting({ userId: '1', score: 9, maxScore: 10 }))
        .addSitting(sitting({ userId: '2', score: 3, maxScore: 10 }))
        .addSitting(sitting({ userId: '3', score: 5, maxScore: 10 }))
        .addSitting(sitting({ userId: '3', score: 10, maxScore: 10 }), { isTest: true })
    })

    it('a teacher defaults to the first own class and subject; risk comes from the accuracy grade', async () => {
      const r = await w.analytics.classes(ctxOf('teacher', 't1'), {})
      expect(r.options.selected).toEqual({ classroomId: '10', subjectId: '1', riskLevel: '' })
      expect(r.options.classes).toEqual([{ id: '10', name: 'Kelas 10' }])
      expect(r.rows.map((x) => [x.userId, x.accuracy, x.riskLevel])).toEqual([
        ['1', 90, 'low'],
        ['2', 30, 'critical'],
        ['3', 50, 'medium'],
      ])
      expect(r.summary).toEqual({ students: 3, accuracy: 56.7, atRisk: 1, good: 1 })
      PerformanceClassAnalyticsSchema.parse(r)
    })

    it('filters by risk level; an unknown level means all', async () => {
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), { riskLevel: 'critical' })).rows.map((x) => x.userId)).toEqual(['2'])
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), { riskLevel: 'bogus' })).rows).toHaveLength(3)
      expect((await w.analytics.classes(ctxOf('teacher', 't1'), { riskLevel: 'bogus' })).options.selected.riskLevel).toBe('')
    })

    it('an unknown classroom and another teacher class give the same 403 (M3); other roles are 403', async () => {
      const unknown = await w.analytics.classes(ctxOf('teacher', 't1'), { classroomId: '999' }).catch((e: unknown) => e)
      const forbidden = await w.analytics.classes(ctxOf('teacher', 't2'), { classroomId: '10' }).catch((e: unknown) => e)
      expect(unknown).toMatchObject({ status: 403, message: 'Anda tidak dibenarkan melakukan tindakan ini.' })
      expect(forbidden).toMatchObject({ status: 403, message: 'Anda tidak dibenarkan melakukan tindakan ini.' })
      await expect(w.analytics.classes(ctxOf('teacher', 't2'), { classroomId: '10' })).rejects.toMatchObject({ status: 403 })
      await expect(w.analytics.classes(ctxOf('student', '1'), {})).rejects.toMatchObject({ status: 403 })
      await expect(w.analytics.classes(ctxOf('school_admin', 'sa1'), {})).rejects.toMatchObject({ status: 403 })
    })

    describe('SW5-05: a sitting stores the Bijak subject code, a class stores the curriculum subject id', () => {
      beforeEach(() => {
        w.directory.addSubject('MAT', '3')
        w.directory.addPupil({ id: '4', name: 'Eman Contoh', schoolId: 's1' }).addPupil({ id: '5', name: 'Farah Contoh', schoolId: 's1' })
        w.classes.add({ id: '20', schoolId: 's1', teacherId: 't5', subjectId: '3', subjectName: 'Matematik' }, ['4', '5'])
        const mat = { subjectId: 'MAT', subjectCode: 'MAT', subjectName: 'Matematik' }
        w.bijak
          .addSitting(sitting({ userId: '4', score: 9, maxScore: 10, ...mat }))
          .addSitting(sitting({ userId: '5', score: 3, maxScore: 10, ...mat }))
      })

      it('facts of code MAT land under the curriculum id, with one option per subject', async () => {
        const r = await w.analytics.classes(ctxOf('teacher', 't5'), {})
        expect(r.options.subjects).toEqual([{ id: '3', name: 'Matematik' }])
        expect(r.options.selected.subjectId).toBe('3')
        expect(r.rows.map((x) => [x.userId, x.accuracy])).toEqual([
          ['4', 90],
          ['5', 30],
        ])
      })

      it("a migrated 'legacy' sitting is not a subject option", async () => {
        w.bijak.addSitting(sitting({ userId: '4', score: 5, maxScore: 10, subjectId: 'legacy', subjectCode: 'legacy', subjectName: 'Tidak diketahui' }))
        const r = await w.analytics.classes(ctxOf('teacher', 't5'), {})
        expect(r.options.subjects).toEqual([{ id: '3', name: 'Matematik' }])
        expect(r.rows.map((x) => [x.userId, x.accuracy])).toEqual([
          ['4', 90],
          ['5', 30],
        ])
      })

      it('filtering by the curriculum id returns data', async () => {
        const r = await w.analytics.classes(ctxOf('teacher', 't5'), { classroomId: '20', subjectId: '3' })
        expect(r.summary).toEqual({ students: 2, accuracy: 60, atRisk: 1, good: 1 })
      })

      it('a code with no curriculum subject keeps the sitting id; other subjects stay separate options', async () => {
        w.bijak.addSitting(sitting({ userId: '4', score: 5, maxScore: 10, subjectId: 'XYZ', subjectCode: 'XYZ', subjectName: 'Lain' }))
        const r = await w.analytics.classes(ctxOf('teacher', 't5'), {})
        expect(r.options.subjects).toEqual([
          { id: '3', name: 'Matematik' },
          { id: 'XYZ', name: 'Lain' },
        ])
      })
    })

    it('an admin names a class; members without graded marks are not rows', async () => {
      w.bijak.addSitting(sitting({ userId: '2', score: 2, maxScore: 10, subjectId: '2', subjectCode: 'MT', subjectName: 'Matematik', provisional: true }))
      const admin = ctxOf('admin', 'a', { level: 'national', label: 'x' })
      expect((await w.analytics.classes(admin, {})).options.selected.classroomId).toBeNull()
      const r = await w.analytics.classes(admin, { classroomId: '10', subjectId: '2' })
      expect(r.rows).toEqual([])
      expect(r.options.subjects.map((s) => s.id)).toEqual(['1', '2'])
    })
  })
})

describe('Soalan Dijawab counts answered questions, not the paper marks (issue 61 m1)', () => {
  // Three 10-mark papers; the pupil answered 3, 0 and 2 questions (marks per question are not 1).
  beforeEach(() => {
    w.bijak
      .addSitting(sitting({ userId: '1', score: 6, maxScore: 10, answeredCount: 3, submittedAt: d('2026-09-24T10:00:00+08:00') }))
      .addSitting(sitting({ userId: '1', score: 0, maxScore: 10, answeredCount: 0, submittedAt: d('2026-09-24T11:00:00+08:00') }))
      .addSitting(sitting({ userId: '1', score: 4, maxScore: 10, answeredCount: 2, subjectId: '2', subjectCode: 'MT', subjectName: 'Matematik', submittedAt: d('2026-09-25T09:00:00+08:00') }))
  })

  it('student: stats.answered and mastery.answered are the answered questions of the answer store, not the paper marks', async () => {
    w.directory.addSubject('BM', '1', 'Bahasa Melayu').addSubject('MT', '2', 'Matematik')
    w.answers.addMany('1', 3, 2, { mode: 'simulasi', subjectId: '1', sessionId: 'sA', answeredAt: d('2026-09-24T10:00:00+08:00') })
    w.answers.addMany('1', 2, 1, { mode: 'simulasi', subjectId: '2', sessionId: 'sB', answeredAt: d('2026-09-25T09:00:00+08:00') })
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

  it('analytics: per-subject answered', async () => {
    const r = await w.analytics.me(ctxOf('student', '1'))
    expect(r.subjects.map((s) => [s.code, s.answered])).toEqual([
      ['BM', 3],
      ['MT', 2],
    ])
  })
})
