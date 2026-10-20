import { PerformanceLevelDetailSchema, PerformanceSchoolSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { ctxOf, item, sitting, world, type World } from '../fakes/fixtures'

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
  // pupil 1: three sittings (24 of 30 marks); pupils 2 to 6: 6 of 10; pupil 7: 9 of 10 in Matematik; pupil 9 (other school): 10 of 10
  for (const score of [6, 8, 10]) w.bijak.addSitting(sitting({ userId: '1', score }))
  for (const id of ['2', '3', '4', '5', '6']) w.bijak.addSitting(sitting({ userId: id, score: 6 }))
  w.bijak.addSitting(sitting({ userId: '7', score: 9, subjectId: '2', subjectCode: 'MT', subjectName: 'Matematik' }))
  w.bijak.addSitting(sitting({ userId: '9', schoolId: 's2', score: 10 }))
  // never counted
  w.bijak.addSitting(sitting({ userId: '1', score: 10 }), { isTest: true })
})

const admin = ctxOf('admin', 'a', national)
const schoolAdmin = ctxOf('school_admin', 'sa1')

describe('Prestasi sekolah', () => {
  it('a school admin sees the own school: sums come from the aggregate and exclude test rows', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.scope).toBe('school')
    expect(r.header).toEqual({ classCount: 3, studentCount: 7 })
    expect(r.stats).toEqual({ students: 7, teachers: 2, classes: 3, subjects: 2, sessions: 9, answered: 90, accuracy: 70 })
    PerformanceSchoolSchema.parse(r)
  })

  it('platform scope for the admin covers every school', async () => {
    const r = await w.school.school(admin)
    expect(r.scope).toBe('platform')
    expect(r.stats).toMatchObject({ students: 8, teachers: 2, sessions: 10, answered: 100, accuracy: 73 })
  })

  it('level rows are the sums of their members', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.levels).toEqual([
      { code: 't4', accuracy: 67.5, classes: 3, students: 6, sessions: 8 },
      { code: 't5', accuracy: 90, classes: 1, students: 1, sessions: 1 },
    ])
  })

  it('subject rows come only from subjects with sittings, by name; fields the slice cannot compute are neutral', async () => {
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
      { userId: 't1', name: 'Cikgu Satu', classCount: 2, studentCount: 7, accuracy: 70, onTrack: null, below: null },
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
    expect(r.levels.map((l) => l.classes)).toEqual([0, 0])
    PerformanceSchoolSchema.parse(r)
  })

  it('a school with classes but no sittings has accuracy 0, never NaN', async () => {
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
    expect(staff.stats).toMatchObject({ sessions: 9, answered: 90, accuracy: 70 })
  })

  it('a small remainder outside the levels also hides the totals', async () => {
    // pupil 8 has a sitting but is in no class: remainder of 1 pupil
    w.directory.addPupil({ id: '8', schoolId: 's1' })
    for (const id of ['11', '12', '13', '14', '15']) {
      w.directory.addPupil({ id, schoolId: 's1' })
      w.bijak.addSitting(sitting({ userId: id, score: 5 }))
    }
    w.classes.add({ id: '21', schoolId: 's1', levelSlug: 't5' }, ['11', '12', '13', '14', '15'])
    w.bijak.addSitting(sitting({ userId: '8', score: 1 }))
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
      big.bijak.addSitting(sitting({ userId: id, score: 5 }))
    }
    const r = await big.school.school(student)
    expect(r.stats).toMatchObject({ sessions: 5, answered: 50, accuracy: 50 })
  })

  it('subject rows backed by fewer than 5 pupils are dropped for non-staff only', async () => {
    expect((await w.school.school(student)).subjects.map((s) => s.name)).toEqual(['Bahasa Melayu'])
    expect((await w.school.school(ctxOf('school_admin', 'sa1'))).subjects.map((s) => s.name)).toEqual(['Bahasa Melayu', 'Matematik'])
  })

  it('a teacher sees top students with a redacted id and name when they are not their own (minor 6)', async () => {
    const r = await w.school.level(ctxOf('teacher', 't9'), 't4')
    expect(r.topStudents[0]).toMatchObject({ userId: '0', name: 'Murid' })
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
      x.bijak.addSitting(sitting({ userId: id, score: 5 }))
    }
    const r = await x.school.level(ctxOf('student', '21'), 't4')
    expect(r.classRows.map((row) => [row.classId, row.sessions])).toEqual([['A', 7], ['C', 0]])
    expect(r).toMatchObject({ students: 10, sessions: 0, accuracy: 0 })
    const staff = await x.school.level(ctxOf('school_admin', 'sa1'), 't4')
    expect(staff).toMatchObject({ sessions: 10, accuracy: 50 })
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
      x.bijak.addSitting(sitting({ userId: id, score: b.includes(id) ? 2 : 8 }))
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
    const r = await x.items.school(student, {})
    expect(r.questions).toEqual([])
    expect(r).toMatchObject({ answers: null, correct: null })
  })
})

describe('Tingkatan', () => {
  it('cards list t4 and t5 with distinct active members', async () => {
    expect(await w.school.levels(schoolAdmin)).toEqual([
      { code: 't4', name: 'Tingkatan 4', classes: 3, students: 6 },
      { code: 't5', name: 'Tingkatan 5', classes: 1, students: 1 },
    ])
  })

  it('an unknown code is 404', async () => {
    await expect(w.school.level(schoolAdmin, 't6')).rejects.toMatchObject({ status: 404 })
    await expect(w.school.level(schoolAdmin, 'T4')).rejects.toMatchObject({ status: 404 })
  })

  it('detail: class rows ordered no-subject, subject A-Z, school class last; figures are class sums', async () => {
    const r = await w.school.level(schoolAdmin, 't4')
    expect(r).toMatchObject({ code: 't4', name: 'Tingkatan 4', classes: 3, students: 6, subjects: 1, accuracy: 67.5, sessions: 8, onTrack: 0, below: 0, onTrackPct: 0, atRisk: [] })
    expect(r.classRows.map((c) => [c.classId, c.subject, c.students, c.sessions, c.accuracy, c.href])).toEqual([
      ['11', 'Tiada Subjek', 2, 4, 75, '/prestasi/kelas/11'],
      ['10', 'Bahasa Melayu', 6, 8, 67.5, '/prestasi/kelas/10'],
      ['12', 'Kelas Sekolah', 1, 1, 60, null],
    ])
    expect(r.classRows[0]?.teacher).toBe('Cikgu Dua')
    PerformanceLevelDetailSchema.parse(r)
  })

  it('top students need 3 sittings; a teacher sees names only of own pupils', async () => {
    const r = await w.school.level(schoolAdmin, 't4')
    expect(r.topStudents).toEqual([{ userId: '1', name: 'Murid Ujian 1', sessions: 3, answered: 30, accuracy: 80 }])
    const own = await w.school.level(ctxOf('teacher', 't2'), 't4')
    expect(own.topStudents[0]?.name).toBe('Murid Ujian 1')
    const other = await w.school.level(ctxOf('teacher', 't9'), 't4')
    expect(other.topStudents[0]?.name).toBe('Murid')
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
