import { PerformanceLevelDetailSchema, PerformanceSchoolSchema } from '@pp/contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sessionTotalsOf } from '../../../../src/modules/reports/performance/services/support'

import { answers, ctxOf, item, sitting, world, type World } from '../fakes/fixtures'

let w: World
const national = { level: 'national', label: 'x' } as const

beforeEach(() => {
  w = world()
  w.directory.addSchool({ id: 's1' }).addSchool({ id: 's2', district: 'Daerah B' })
  for (const id of ['1', '2', '3', '4', '5', '6']) w.directory.addPupil({ id, name: `Murid Ujian ${id}`, schoolId: 's1' })
  w.directory.addPupil({ id: '7', name: 'Murid Ujian 7', schoolId: 's1', levelSlug: 't5' }).addPupil({ id: '9', name: 'Murid Ujian 9', schoolId: 's2' })
  w.directory.addTeacher('t1', 'Cikgu Satu', 's1').addTeacher('t2', 'Cikgu Dua', 's1')
  w.classes
    .add({ id: '10', schoolId: 's1', teacherId: 't1', teacherName: 'Cikgu Satu', subjectId: '1', subjectName: 'Bahasa Melayu' }, ['1', '2', '3', '4', '5', '6'])
    .add({ id: '11', schoolId: 's1', teacherId: 't2', teacherName: 'Cikgu Dua' }, ['1', '2'])
    .add({ id: '12', schoolId: 's1', kind: 'school_class', levelSlug: 't4' }, ['3'])
    .add({ id: '20', schoolId: 's1', teacherId: 't1', teacherName: 'Cikgu Satu', levelSlug: 't5', subjectId: '2', subjectName: 'Matematik' }, ['7'])
  // The figures come from the single answer store. Pupil 1: three sessions of 5 answers (3, 4, 5 right = 12 of 15); pupils 2 to 6: 3 of 5;
  // pupil 7: 9 of 10 in Matematik; pupil 9 (other school): 5 of 5.
  for (const right of [3, 4, 5]) answers(w, '1', 5, right)
  for (const id of ['2', '3', '4', '5', '6']) answers(w, id, 5, 3)
  answers(w, '7', 10, 9, { subjectId: '2' })
  answers(w, '9', 5, 5)
  // never counted
  w.answers.add({ userId: '1', mode: 'latih_tubi', isCorrect: true, answeredAt: new Date('2026-09-20T10:10:00+08:00'), isTest: true })
})

const admin = ctxOf('admin', 'a', national)
const schoolAdmin = ctxOf('school_admin', 'sa1')

describe('Prestasi sekolah', () => {
  it('a school admin sees the own school: sums come from the aggregate and exclude test rows', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.scope).toBe('school')
    expect(r.header).toEqual({ classCount: 3, studentCount: 7 })
    expect(r.stats).toEqual({ students: 7, teachers: 2, classes: 3, subjects: 2, sessions: 9, answered: 50, accuracy: 72 })
    PerformanceSchoolSchema.parse(r)
  })

  it('platform scope for the admin covers every school', async () => {
    const r = await w.school.school(admin)
    expect(r.scope).toBe('platform')
    expect(r.stats).toMatchObject({ students: 8, teachers: 2, sessions: 10, answered: 55, accuracy: 74.5 })
  })

  it('level rows are the sums of their members', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.levels).toEqual([
      { code: 't4', accuracy: 67.5, classes: 3, students: 6, sessions: 8 },
      { code: 't5', accuracy: 90, classes: 1, students: 1, sessions: 1 },
    ])
  })

  it('subject rows come only from subjects with answers, by name; fields the slice cannot compute are neutral', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.subjects.map((s) => s.name)).toEqual(['Bahasa Melayu', 'Matematik'])
    expect(r.subjects[0]).toMatchObject({ gps: null, grade: null, entries: 0, onTrack: 0, below: 0, noTarget: 0, achievementPct: null })
    expect(r.gps).toEqual({ value: null, band: null, entries: 0 })
    expect(r.distribution).toHaveLength(10)
    expect(r.distribution.every((g) => g.count === 0 && g.pct === 0)).toBe(true)
    expect(r.trend).toEqual({ years: [], chart: { labels: [], overall: [], subjects: [] } })
  })

  it('teacher cards: one per teacher owning a classroom, by name, accuracy over distinct pupils', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.teachers).toEqual([
      { userId: 't2', name: 'Cikgu Dua', classCount: 1, studentCount: 2, accuracy: 75, onTrack: null, below: null },
      { userId: 't1', name: 'Cikgu Satu', classCount: 2, studentCount: 7, accuracy: 72, onTrack: null, below: null },
    ])
  })

  it('privacy: a student sees no teacher cards, and a level backed by fewer than 5 pupils is zeroed', async () => {
    const r = await w.school.school(ctxOf('student', '1'))
    expect(r.teachers).toEqual([])
    // t4 has a 2-pupil class (class 11), so it is hidden too: level minus shown classes would isolate it
    expect(r.levels[0]).toMatchObject({ code: 't4', accuracy: 0, sessions: 0 })
    expect(r.levels[1]).toEqual({ code: 't5', accuracy: 0, classes: 1, students: 1, sessions: 0 })
    const staff = await w.school.school(ctxOf('teacher', 't1'))
    expect(staff.levels[1]).toMatchObject({ accuracy: 90, sessions: 1 })
  })

  it('a caller without a school gets the empty payload, not an error', async () => {
    const r = await w.school.school(ctxOf('ppd_officer', 'o1', { level: 'district', districtCode: 'Daerah A', label: 'x' }))
    expect(r.stats).toEqual({ students: 0, teachers: 0, classes: 0, subjects: 0, sessions: 0, answered: 0, accuracy: 0 })
    // t4 and t5 are always listed, with zeros (as on the base).
    expect(r.levels).toEqual([t4zero, t5zero])
    PerformanceSchoolSchema.parse(r)
  })

  it('a school with classes but no answers has accuracy 0, never NaN', async () => {
    const e = world()
    e.directory.addSchool({ id: 's1' })
    e.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ['1'])
    const r = await e.school.school(schoolAdmin)
    expect(r.stats).toMatchObject({ sessions: 0, answered: 0, accuracy: 0 })
    expect(r.levels[0]).toMatchObject({ accuracy: 0, sessions: 0, students: 1 })
  })
})

describe('Cohort rules on the school totals (M1)', () => {
  const student = ctxOf('student', '1')

  it('a suppressed level also hides the totals, so subtraction recovers nothing', async () => {
    const r = await w.school.school(student)
    expect(r.levels[1]).toMatchObject({ code: 't5', accuracy: 0, sessions: 0 })
    expect(r.stats).toMatchObject({ sessions: 0, answered: 0, accuracy: 0 })
    // counts of structure stay
    expect(r.stats.students).toBe(7)
    const staff = await w.school.school(ctxOf('school_admin', 'sa1'))
    expect(staff.stats).toMatchObject({ sessions: 9, answered: 50, accuracy: 72 })
  })

  it('a small remainder outside the levels also hides the totals', async () => {
    // pupil 8 has a sitting but is in no class: remainder of 1 pupil
    w.directory.addPupil({ id: '8', schoolId: 's1' })
    for (const id of ['11', '12', '13', '14', '15']) {
      w.directory.addPupil({ id, schoolId: 's1' })
      answers(w, id, 5, 3)
    }
    w.classes.add({ id: '21', schoolId: 's1', levelSlug: 't5' }, ['11', '12', '13', '14', '15'])
    answers(w, '8', 5, 1)
    const r = await w.school.school(student)
    expect(r.stats).toMatchObject({ sessions: 0, answered: 0, accuracy: 0 })
    expect(r.levels.every((l) => l.sessions === 0)).toBe(true)
  })

  it('totals are shown when every level and the remainder meet the cohort', async () => {
    const big = world()
    big.directory.addSchool({ id: 's1' })
    const ids = ['1', '2', '3', '4', '5']
    big.classes.add({ id: '10', schoolId: 's1' }, ids)
    for (const id of ids) {
      big.directory.addPupil({ id, schoolId: 's1' })
      answers(big, id, 5, 3)
    }
    const r = await big.school.school(student)
    expect(r.stats).toMatchObject({ sessions: 5, answered: 25, accuracy: 60 })
  })

  it('subject rows backed by fewer than 5 pupils are dropped for non-staff only', async () => {
    expect((await w.school.school(student)).subjects.map((s) => s.name)).toEqual(['Bahasa Melayu'])
    expect((await w.school.school(ctxOf('school_admin', 'sa1'))).subjects.map((s) => s.name)).toEqual(['Bahasa Melayu', 'Matematik'])
  })

  it('a teacher sees top students with a redacted id and name when they are not their own (minor 6)', async () => {
    // A teacher of no class at the level sees no pupil at all (scoped to own classes).
    const r = await w.school.level(ctxOf('teacher', 't9'), 't4')
    expect(r.topStudents).toEqual([])
    const own = await w.school.level(ctxOf('teacher', 't2'), 't4')
    expect(own.topStudents[0]).toMatchObject({ userId: '1' })
  })
})

describe('Level detail: class remainder rule', () => {
  it('a hidden class of 3 pupils cannot be recovered as level total minus shown class rows', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    const a = ['21', '22', '23', '24', '25', '26', '27']
    const c = ['31', '32', '33']
    x.classes.add({ id: 'A', schoolId: 's1', name: 'Kelas A' }, a).add({ id: 'C', schoolId: 's1', name: 'Kelas C' }, c)
    for (const id of [...a, ...c]) {
      x.directory.addPupil({ id, schoolId: 's1' })
      answers(x, id, 5, 3)
    }
    const r = await x.school.level(ctxOf('student', '21'), 't4')
    expect(r.classRows.map((row) => [row.classId, row.sessions])).toEqual([['A', 7], ['C', 0]])
    expect(r).toMatchObject({ students: 10, sessions: 0, accuracy: 0 })
    const staff = await x.school.level(ctxOf('school_admin', 'sa1'), 't4')
    expect(staff).toMatchObject({ sessions: 10, accuracy: 60 })
    expect(staff.classRows.map((row) => row.sessions)).toEqual([7, 3])
  })
})

describe('Cross-endpoint differencing (school, levels, level)', () => {
  // T4: class A 9 pupils (shown), class B 3 pupils (hidden); 12 pupils in the level
  function build() {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    const a = Array.from({ length: 9 }, (_, i) => String(100 + i))
    const b = ['201', '202', '203']
    x.classes.add({ id: 'A', schoolId: 's1', name: 'Kelas A' }, a).add({ id: 'B', schoolId: 's1', name: 'Kelas B' }, b)
    for (const id of [...a, ...b]) {
      x.directory.addPupil({ id, schoolId: 's1' })
      answers(x, id, 5, b.includes(id) ? 1 : 4)
    }
    return x
  }
  const student = ctxOf('student', '100')

  it('no combination of school and level isolates class B for a non-staff viewer', async () => {
    const x = build()
    const school = await x.school.school(student)
    const level = await x.school.level(student, 't4')
    expect(school.levels[0]).toMatchObject({ code: 't4', sessions: 0, accuracy: 0 })
    expect(school.stats).toMatchObject({ sessions: 0, answered: 0, accuracy: 0 })
    expect(level).toMatchObject({ sessions: 0, accuracy: 0 })
    expect(level.classRows.map((r) => [r.classId, r.sessions])).toEqual([['A', 9], ['B', 0]])
  })

  it('staff still see everything, and the levels list and the level detail carry counts only', async () => {
    const x = build()
    const staff = ctxOf('school_admin', 'sa1')
    expect((await x.school.school(staff)).levels[0]).toMatchObject({ sessions: 12 })
    expect((await x.school.level(staff, 't4')).sessions).toBe(12)
    const list = await x.school.levels(student)
    expect(list[0]).toEqual({ code: 't4', name: 'Tingkatan 4', classes: 2, students: 12 })
    expect(Object.keys(list[0] as object).sort()).toEqual(['classes', 'code', 'name', 'students'])
  })

  it('the school item analysis headline equals the shown questions, so it cannot be differenced against the school totals', async () => {
    const x = build()
    x.bijak.addItem(item({ attemptId: 'at-x', userId: '201', questionId: '9', awarded: 0, chosenLetter: 'B' }))
    x.bijak.addSitting(sitting({ userId: '201', attemptId: 'at-x' }))
    // An officer is the non-staff reader of the school item analysis (a student is refused, AC-MUR-6-5).
    await expect(x.items.school(student, {})).rejects.toMatchObject({ status: 403 })
    const r = await x.items.school(ctxOf('ppd_officer', 'o', { level: 'state', stateCode: 'Negeri A', label: 'x' }), {}, 's1')
    // The item analysis reads the answer store now (S10-T03): the world's pupils answer q1 to q5, so the questions show, and the
    // headline is exactly the sum of the shown rows, never the school totals.
    expect(r.questions.length).toBeGreaterThan(0)
    expect(r.answers).toBe(r.questions.reduce((a, q) => a + q.attempts, 0))
    expect(r.questionsTested).toBe(r.questions.length)
    expect(r.questions.every((q) => q.pupils >= 5)).toBe(true)
  })
})

describe('Tingkatan', () => {
  it('cards list only the levels that have classes, with distinct active members', async () => {
    expect(await w.school.levels(schoolAdmin)).toEqual([
      { code: 't4', name: 'Tingkatan 4', classes: 3, students: 6 },
      { code: 't5', name: 'Tingkatan 5', classes: 1, students: 1 },
    ])
  })

  it('an unknown code is 404', async () => {
    await expect(w.school.level(schoolAdmin, 't6')).rejects.toMatchObject({ status: 404 })
    await expect(w.school.level(schoolAdmin, 'T4')).rejects.toMatchObject({ status: 404 })
  })

  it('detail: class rows ordered by accuracy descending (Perbandingan Kelas); figures are class sums', async () => {
    const r = await w.school.level(schoolAdmin, 't4')
    expect(r).toMatchObject({ code: 't4', name: 'Tingkatan 4', classes: 3, students: 6, subjects: 1, accuracy: 67.5, sessions: 8, onTrack: 0, below: 0, onTrackPct: 0, atRisk: [] })
    expect(r.classRows.map((c) => [c.classId, c.subject, c.students, c.sessions, c.accuracy, c.href])).toEqual([
      ['11', 'Tiada Subjek', 2, 4, 75, '/prestasi/kelas/11'],
      ['10', 'Bahasa Melayu', 6, 8, 67.5, '/prestasi/kelas/10'],
      ['12', 'Kelas Sekolah', 1, 1, 60, null],
    ])
    expect(r.classRows.map((c) => c.classId)).toEqual(['11', '10', '12'])
    expect(r.classRows[0]?.teacher).toBe('Cikgu Dua')
    PerformanceLevelDetailSchema.parse(r)
  })

  describe('SW5-04: href only where the viewer can open the class dashboard', () => {
    const hrefs = async (ctx: ReturnType<typeof ctxOf>) => Object.fromEntries((await w.school.level(ctx, 't4')).classRows.map((c) => [c.classId, c.href]))

    it('a teacher gets rows, and a link, for own classes only', async () => {
      expect(await hrefs(ctxOf('teacher', 't1'))).toEqual({ '10': '/prestasi/kelas/10' })
      expect(await hrefs(ctxOf('teacher', 't2'))).toEqual({ '11': '/prestasi/kelas/11' })
    })

    it('a school admin of the school and the platform admin keep a link for every classroom', async () => {
      const all = { '10': '/prestasi/kelas/10', '11': '/prestasi/kelas/11', '12': null }
      expect(await hrefs(schoolAdmin)).toEqual(all)
      expect(await hrefs(admin)).toEqual(all)
    })

    it('a pupil and a parent get no link', async () => {
      const none = { '10': null, '11': null, '12': null }
      expect(await hrefs(ctxOf('student', '1'))).toEqual(none)
      expect(await hrefs(ctxOf('parent', 'pa1'))).toEqual(none)
    })
  })

  it('top students need 5 answers, accuracy descending, ties by answers; a teacher sees names only of own pupils', async () => {
    const r = await w.school.level(schoolAdmin, 't4')
    expect(r.topStudents[0]).toEqual({ userId: '1', name: 'Murid Ujian 1', sessions: 3, answered: 15, accuracy: 80 })
    // pupils 2 to 6 tie at 60% with 5 answers: by id
    expect(r.topStudents.map((t) => t.userId)).toEqual(['1', '2', '3', '4', '5', '6'])
    const few = world()
    few.directory.addSchool({ id: 's1' }).addPupil({ id: '1', schoolId: 's1' }).addPupil({ id: '2', schoolId: 's1' })
    few.classes.add({ id: '10', schoolId: 's1' }, ['1', '2'])
    answers(few, '1', 4, 4)
    answers(few, '2', 6, 3)
    expect((await few.school.level(schoolAdmin, 't4')).topStudents.map((t) => [t.userId, t.answered])).toEqual([['2', 6]])
    const own = await w.school.level(ctxOf('teacher', 't2'), 't4')
    expect(own.topStudents[0]?.name).toBe('Murid Ujian 1')
    expect((await w.school.level(ctxOf('teacher', 't9'), 't4')).topStudents).toEqual([])
  })

  it('a teacher sees no pupil, class row or figure of another teacher class at the level view (R1-GUR-4)', async () => {
    // Own class 11 (t2): pupils 1 and 2, 3 of 5 right on the last two sittings. Class 10 (t1) and school class 12 belong to others.
    const own = await w.school.level(ctxOf('teacher', 't2'), 't4')
    expect(own.classRows.map((c) => c.classId)).toEqual(['11'])
    expect(own).toMatchObject({ classes: 1, students: 2, subjects: 0 })
    const ownIds = new Set(['1', '2'])
    expect(own.topStudents.every((t) => ownIds.has(t.userId))).toBe(true)
    expect(own.atRisk.every((t) => ownIds.has(t.userId))).toBe(true)
    expect(own.atRisk.map((r) => r.className).filter((n) => n !== 'Kelas 11' && n !== '')).toEqual([])
    // Figures equal the class-1-only figures the class row carries.
    expect(own.accuracy).toBe(own.classRows[0]?.accuracy)
    expect(own.sessions).toBe(own.classRows[0]?.sessions)
    // The school admin still sees every class and pupil.
    const all = await w.school.level(schoolAdmin, 't4')
    expect(all.classRows.map((c) => c.classId).sort()).toEqual(['10', '11', '12'])
    expect(all.students).toBe(6)
    // Teacher t1 sees class 10 only: no pupil of class 11 or the school class beyond the shared ones, and never class 11 / 12 rows.
    expect((await w.school.level(ctxOf('teacher', 't1'), 't4')).classRows.map((c) => c.classId)).toEqual(['10'])
    // The Tingkatan cards follow the same scope; t1 teaches a t5 class too.
    expect(await w.school.levels(ctxOf('teacher', 't2'))).toEqual([
      { code: 't4', name: 'Tingkatan 4', classes: 1, students: 2 },
      { code: 't5', name: 'Tingkatan 5', classes: 0, students: 0 },
    ])
    expect((await w.school.level(ctxOf('teacher', 't2'), 't5')).students).toBe(0)
  })

  it('students and officers get no pupil list', async () => {
    expect((await w.school.level(ctxOf('student', '1'), 't4')).topStudents).toEqual([])
    expect((await w.school.level(ctxOf('ppd_officer', 'o1'), 't4')).topStudents).toEqual([])
  })

  it('an empty level is a valid payload', async () => {
    const r = await world().school.level(schoolAdmin, 't5')
    expect(r).toMatchObject({ classes: 0, students: 0, accuracy: 0, sessions: 0, classRows: [], topStudents: [] })
    PerformanceLevelDetailSchema.parse(r)
  })
})

const t4zero = { code: 't4', accuracy: 0, classes: 0, students: 0, sessions: 0 }
const t5zero = { ...t4zero, code: 't5' }

describe('Tingkatan T1 to T5 (DOC DEFECT 2)', () => {
  it('lower-case codes t1 to t5; t4 and t5 are always listed, t1 to t3 only with classes', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    x.classes.add({ id: 'A', schoolId: 's1', levelSlug: 't1' }, ['1']).add({ id: 'B', schoolId: 's1', levelSlug: 't3' }, ['2'])
    x.directory.addPupil({ id: '1', schoolId: 's1' }).addPupil({ id: '2', schoolId: 's1' })
    expect((await x.school.levels(schoolAdmin)).map((l) => [l.code, l.name])).toEqual([['t1', 'Tingkatan 1'], ['t3', 'Tingkatan 3'], ['t4', 'Tingkatan 4'], ['t5', 'Tingkatan 5']])
    expect((await x.school.school(schoolAdmin)).levels.map((l) => l.code)).toEqual(['t1', 't3', 't4', 't5'])
    expect((await x.school.level(schoolAdmin, 't1')).name).toBe('Tingkatan 1')
    await expect(x.school.level(schoolAdmin, 'T1')).rejects.toMatchObject({ status: 404 })
  })
})

describe('Murid Berisiko (DOC DEFECT 5)', () => {
  it('whole-number accuracy below 50 or no answer in the last 7 days; accuracy ascending, no answer last, 10 rows', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    const ids = Array.from({ length: 14 }, (_, i) => String(i + 1))
    for (const id of ids) x.directory.addPupil({ id, schoolId: 's1' })
    x.classes.add({ id: 'A', schoolId: 's1', name: 'Kelas A' }, ids)
    answers(x, '1', 10, 5) // 50: not at risk
    answers(x, '2', 200, 99) // 49.5 rounds to 50: not at risk
    answers(x, '3', 10, 4) // 40
    answers(x, '4', 10, 1) // 10
    // 5 answered long ago and fine: inactive
    answers(x, '5', 10, 9, { answeredAt: new Date('2026-09-10T10:00:00+08:00') })
    // pupils 6 to 14 have no answer at all
    const r = await x.school.level(schoolAdmin, 't4')
    expect(r.atRisk.map((a) => [a.userId, a.accuracy, a.className])).toEqual([
      ['4', 10, 'Kelas A'],
      ['3', 40, 'Kelas A'],
      ['5', 90, 'Kelas A'],
      ...['6', '7', '8', '9', '10', '11', '12'].map((id) => [id, null, 'Kelas A']),
    ])
    expect(r.atRisk).toHaveLength(10)
    PerformanceLevelDetailSchema.parse(r)
  })
})

describe('one answer read per request (S10-T07 M1)', () => {
  it('school(), level() and levels() each read the answer reader once for answers and once for sessions, with no pupil id list', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    x.classes.add({ id: 'A', schoolId: 's1', levelSlug: 't4' }, ['1', '2'])
    x.directory.addPupil({ id: '1', schoolId: 's1' }).addPupil({ id: '2', schoolId: 's1' })
    answers(x, '1', 10, 8)
    answers(x, '2', 10, 6)
    const facts = vi.spyOn(x.answers, 'answerFacts')
    const sessions = vi.spyOn(x.answers, 'sessionCounts')
    const sc = await x.school.school(schoolAdmin)
    expect(sc.levels.find((l) => l.code === 't4')).toMatchObject({ classes: 1, students: 2, accuracy: 70 })
    await x.school.level(schoolAdmin, 't4')
    expect(facts).toHaveBeenCalledTimes(2)
    expect(sessions).toHaveBeenCalledTimes(2)
    for (const call of facts.mock.calls) {
      expect(call[0].userIds).toBeUndefined()
      expect(call[0]).toMatchObject({ schoolIds: ['s1'], grain: 'user-subject' })
    }
    facts.mockClear()
    await x.school.levels(schoolAdmin)
    expect(facts).not.toHaveBeenCalled()
  })

  it('platform scope passes no filter at all', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    x.classes.add({ id: 'A', schoolId: 's1', levelSlug: 't4' }, ['1'])
    x.directory.addPupil({ id: '1', schoolId: 's1' })
    answers(x, '1', 5, 5)
    const facts = vi.spyOn(x.answers, 'answerFacts')
    await x.school.school(ctxOf('admin', 'ad1', { level: 'national', label: 'x' }))
    expect(facts).toHaveBeenCalledTimes(1)
    expect(facts.mock.calls[0]?.[0].userIds).toBeUndefined()
    expect(facts.mock.calls[0]?.[0].schoolIds).toBeUndefined()
  })
})

describe('sessionTotalsOf (S10-T07 m1)', () => {
  it('takes the per-pupil total row, not the sum of two null-subject rows', () => {
    // An answer stored without a subject makes a second (user, null) row from the grouping sets; the total contains it.
    const rows = [
      { userId: '1', subjectId: null, sessions: 5 },
      { userId: '1', subjectId: null, sessions: 2 },
      { userId: '1', subjectId: '4', sessions: 3 },
      { userId: '2', subjectId: '4', sessions: 1 },
      { userId: '2', subjectId: null, sessions: 1 },
    ]
    expect([...sessionTotalsOf(rows)]).toEqual([['1', 5], ['2', 1]])
    expect([...sessionTotalsOf([...rows].reverse())]).toEqual([['2', 1], ['1', 5]])
  })
})
