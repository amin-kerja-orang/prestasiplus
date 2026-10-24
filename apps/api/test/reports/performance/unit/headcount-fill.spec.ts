import { PerformanceClassDashboardSchema, PerformanceLevelDetailSchema, PerformanceSchoolSchema, PerformanceStudentSchema } from '@pp/contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ctxOf, sitting, world, type World } from '../fakes/fixtures'
import { entry } from '../fakes/in-memory-headcount-facts'

/**
 * Part D: the fields of the existing services that the gamification port and the headcount facts now fill.
 * Class 10 (teacher t1, Bahasa Melayu) holds pupils 1 to 6; the AR of OTR2 against its target:
 * 1 on (85/80), 2 below (70/80), 3 below (55/60), 4 on (92/90), 5 below (45/50), 6 nothing keyed.
 */
let w: World

const marks: [string, number | null, number | null, number | null][] = [
  ['1', 85, 80, 60],
  ['2', 70, 80, 70],
  ['3', 55, 60, null],
  ['4', 92, 90, null],
  ['5', 45, 50, null],
  ['6', null, null, null],
]

const hcEntries = (skip: readonly string[] = []) =>
  marks
    .filter(([id]) => !skip.includes(id))
    .map(([studentId, ar, target, tov]) => entry({ studentId, tov, targets: [null, target], actuals: [null, ar] }))

beforeEach(() => {
  w = world()
  w.directory.addSchool({ id: 's1', name: 'Sekolah Contoh Satu' })
  for (const [id] of marks) w.directory.addPupil({ id, name: `Murid Ujian ${id}`, schoolId: 's1' })
  w.directory.addTeacher('t1', 'Cikgu Satu', 's1')
  w.classes.add(
    { id: '10', schoolId: 's1', name: 'Kelas 4A', teacherId: 't1', teacherName: 'Cikgu Satu', subjectId: '1', subjectName: 'Bahasa Melayu' },
    marks.map(([id]) => id),
  )
  for (const [id] of marks) w.bijak.addSitting(sitting({ userId: id, score: 6 }))
  w.facts.add(...hcEntries())
})

const teacher = ctxOf('teacher', 't1')
const admin = ctxOf('admin', 'a', { level: 'national', label: 'x' })
const schoolAdmin = ctxOf('school_admin', 'sa1')

describe('Prestasi 360: gamification and headcount cards', () => {
  it('streak, best streak, koin and badges come from the gamification port', async () => {
    w.gamification.add('2', { syiling: 120, streak: { current: 4, best: 9 } }).addBadge('2', { key: '7', name: 'Rajin', icon: 'R', earnedAt: new Date('2026-09-01T00:00:00Z') })
    const r = await w.student.student(admin, '2')
    expect(r.streak).toBe(4)
    expect(r.activity).toMatchObject({ streakCurrent: 4, streakBest: 9, koinTotal: 120, practiceDays: 1 })
    expect(r.badges).toEqual([{ icon: 'R', name: 'Rajin' }])
    PerformanceStudentSchema.parse(r)
  })

  it('a card per live entry with TOV, one chip per keyed AR and ETR, newest config first; dropped entries are left out', async () => {
    w.facts.add(
      entry({ studentId: '2', configId: '2', classroomId: '10', configUpdatedAt: new Date('2026-09-10T10:00:00+08:00'), tov: 50, etr: 85, targets: [75, 80], actuals: [72, 79] }),
      entry({ studentId: '2', configId: '3', dropped: true }),
    )
    const r = await w.student.student(admin, '2')
    expect(r.headcount.map((c) => c.configId)).toEqual(['2', '1'])
    expect(r.headcount[0]).toMatchObject({
      subject: 'Bahasa Melayu',
      className: 'Kelas 4A',
      year: 2026,
      status: 'below',
      tov: 50,
      etr: 85,
      chips: [
        { label: 'TOV', value: 50, tone: 'none' },
        { label: 'OTR1', value: 72, tone: 'below' },
        { label: 'OTR2', value: 79, tone: 'below' },
        { label: 'ETR', value: 85, tone: 'none' },
      ],
    })
    PerformanceStudentSchema.parse(r)
  })

  it('a teacher sees only the cards of the own configs', async () => {
    w.facts.add(entry({ studentId: '2', configId: '9', teacherId: 't2' }))
    const r = await w.student.student(teacher, '2')
    expect(r.headcount.map((c) => c.configId)).toEqual(['1'])
  })

  it('the pupil sees the own cards', async () => {
    const r = await w.student.student(ctxOf('student', '2'), '2')
    expect(r.headcount).toHaveLength(1)
  })
})

describe('Class dashboard: headcount block', () => {
  it('counts above and on track as on, no AR or target as no data; dropped pupils are left out', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ['1', '2', '6'])
    x.facts.add(...hcEntries(['3', '4', '5', '6']), entry({ studentId: '6', dropped: true }))
    const r = await x.klass.classDashboard(teacher, '10')
    expect(r.headcount).toMatchObject({ configId: '1', onTrack: 1, below: 1, noData: 0, avgTov: 65, avgEtr: null })
    expect(r.headcount?.pct).toEqual({ on: 50, below: 50, none: 0 })
    PerformanceClassDashboardSchema.parse(r)
  })

  it('a teacher sees only the own configs: a co-teacher\'s newer config of the same class neither replaces the block nor the badges', async () => {
    w.facts.add(
      entry({ studentId: '1', configId: '8', teacherId: 't2', configUpdatedAt: new Date('2026-10-01T10:00:00+08:00'), targets: [null, 80], actuals: [null, 10] }),
    )
    const own = await w.klass.classDashboard(teacher, '10')
    expect(own.headcount).toMatchObject({ configId: '1', onTrack: 2, below: 3, noData: 1 })
    expect(own.ranking.find((x) => x.userId === '1')?.headcount).toBe('on')
    // Staff read the newest config of the class, whoever made it.
    const staff = await w.klass.classDashboard(schoolAdmin, '10')
    expect(staff.headcount?.configId).toBe('8')
  })

  it('ranking rows carry the pupil badge; a class without entries has no block', async () => {
    const r = await w.klass.classDashboard(teacher, '10')
    expect(r.headcount).toMatchObject({ onTrack: 2, below: 3, noData: 1 })
    expect(Object.fromEntries(r.ranking.map((x) => [x.userId, x.headcount]))).toEqual({ 1: 'on', 2: 'below', 3: 'below', 4: 'on', 5: 'below', 6: 'na' })
    const empty = world()
    empty.directory.addSchool({ id: 's1' })
    empty.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ['1'])
    expect((await empty.klass.classDashboard(teacher, '10')).headcount).toBeNull()
  })
})

describe('School: GPS, distribution, subjects and teachers', () => {
  it('GPS is the mean grade point of the graded entries, with its band, distribution and subject row', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.gps).toEqual({ value: 3, band: 'Baik', entries: 5 })
    expect(r.distribution.filter((g) => g.count > 0).map((g) => [g.grade, g.count, g.pct])).toEqual([
      ['A+', 1, 20],
      ['A', 1, 20],
      ['A-', 1, 20],
      ['C+', 1, 20],
      ['D', 1, 20],
    ])
    expect(r.subjects).toEqual([
      { subjectId: '1', name: 'Bahasa Melayu', gps: 3, grade: 'B+', entries: 5, onTrack: 2, below: 3, noTarget: 0, achievementPct: 68 },
    ])
    expect(r.teachers[0]).toMatchObject({ userId: 't1', onTrack: 2, below: 3 })
    PerformanceSchoolSchema.parse(r)
  })

  it('the same scope is read once per request (the Ctx object), a new request reads again', async () => {
    const spy = vi.spyOn(w.facts, 'entriesInScope')
    const ctx = ctxOf('school_admin', 'sa1')
    await w.school.school(ctx)
    await w.school.level(ctx, 't4')
    await w.school.level(ctx, 't5')
    expect(spy).toHaveBeenCalledTimes(1)
    await w.school.school(ctxOf('school_admin', 'sa1'))
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('platform scope reads every school', async () => {
    expect((await w.school.school(admin)).gps).toMatchObject({ value: 3, entries: 5 })
  })

  it('a pair without a target counts as no target; the band follows the GPS', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1', subjectId: '1', subjectName: 'Bahasa Melayu' }, ['1'])
    x.facts.add(entry({ studentId: '1', targets: [null, null], actuals: [null, 30] }))
    const r = await x.school.school(schoolAdmin)
    expect(r.gps).toEqual({ value: 9, band: 'Perlu Perhatian', entries: 1 })
    expect(r.subjects[0]).toMatchObject({ grade: 'G', noTarget: 1, onTrack: 0, below: 0, achievementPct: 5 })
  })

  it('privacy (test 15): non-staff get no GPS, distribution or subject figures below 5 graded pupils; staff and 5 pupils see them', async () => {
    const small = world()
    small.directory.addSchool({ id: 's1' })
    small.classes.add(
      { id: '10', schoolId: 's1', teacherId: 't1', subjectId: '1', subjectName: 'Bahasa Melayu' },
      marks.map(([id]) => id),
    )
    for (const [id] of marks) small.bijak.addSitting(sitting({ userId: id, score: 6 }))
    small.facts.add(...hcEntries(['5']))
    const student = ctxOf('student', '1')
    const hidden = await small.school.school(student)
    expect(hidden.gps).toEqual({ value: null, band: null, entries: 0 })
    expect(hidden.distribution.every((g) => g.count === 0 && g.pct === 0)).toBe(true)
    expect(hidden.subjects[0]).toMatchObject({ gps: null, grade: null, entries: 0, onTrack: 0, below: 0, noTarget: 0, achievementPct: null })
    expect((await small.school.school(schoolAdmin)).gps).toMatchObject({ entries: 4 })
    small.facts.add(...hcEntries().filter((e) => e.studentId === '5'))
    // A new request is a new Ctx object; the per-request memo would otherwise return the first read.
    expect((await small.school.school(ctxOf('student', '1'))).gps).toMatchObject({ value: 3, entries: 5 })
  })

  it('privacy (test 15): a headcount-only subject row below 5 pupils is not listed to non-staff', async () => {
    w.facts.add(entry({ studentId: '1', configId: '7', subjectId: '2', subjectName: 'Matematik', actuals: [null, 60], targets: [null, 60] }))
    expect((await w.school.school(ctxOf('student', '1'))).subjects.map((s) => s.name)).toEqual(['Bahasa Melayu'])
    expect((await w.school.school(schoolAdmin)).subjects.map((s) => s.name)).toEqual(['Bahasa Melayu', 'Matematik'])
  })
})

describe('SW13-08: school GPS by subject keys the practice rows by the curriculum subject, not the Bijak code', () => {
  beforeEach(() => {
    // The aggregate stores the Bijak code MAT; classes and headcount entries know Matematik as curriculum id 3.
    w.directory.addSubject('MAT', '3')
    w.classes.add({ id: '11', schoolId: 's1', name: 'Kelas 4B', teacherId: 't1', teacherName: 'Cikgu Satu', subjectId: '3', subjectName: 'Matematik' }, ['1', '2'])
    w.bijak.addSitting(sitting({ userId: '1', score: 7, subjectId: 'MAT', subjectCode: 'MAT', subjectName: 'Matematik BM' }))
    w.facts.add(
      ...['1', '2'].map((studentId) =>
        entry({ studentId, configId: '5', classroomId: '11', subjectId: '3', subjectName: 'Matematik', targets: [null, 60], actuals: [null, 65] }),
      ),
    )
  })

  it('one Matematik row, with the headcount figures, under the curriculum id', async () => {
    const r = await w.school.school(schoolAdmin)
    const mat = r.subjects.filter((s) => s.name.startsWith('Matematik'))
    expect(mat).toHaveLength(1)
    expect(mat[0]).toMatchObject({ subjectId: '3', name: 'Matematik', entries: 2, onTrack: 2 })
    expect(mat[0]?.gps).not.toBeNull()
    expect(r.subjects.map((s) => s.subjectId)).not.toContain('MAT')
    PerformanceSchoolSchema.parse(r)
  })

  it("a migrated 'legacy' sitting is no subject row but stays in the school totals", async () => {
    const before = (await w.school.school(schoolAdmin)).stats
    w.bijak.addSitting(sitting({ userId: '3', score: 5, subjectId: 'legacy', subjectCode: 'legacy', subjectName: 'Tidak diketahui' }))
    const r = await w.school.school(schoolAdmin)
    expect(r.subjects.map((s) => s.subjectId)).not.toContain('legacy')
    expect(r.subjects.filter((s) => s.name.startsWith('Matematik'))).toHaveLength(1)
    expect(r.stats.sessions).toBe(before.sessions + 1)
    expect(r.stats.answered).toBeGreaterThan(before.answered)
  })

  it('a code with no curriculum subject keeps its own row', async () => {
    w.bijak.addSitting(sitting({ userId: '3', score: 5, subjectId: 'XYZ', subjectCode: 'XYZ', subjectName: 'Lain' }))
    const r = await w.school.school(schoolAdmin)
    expect(r.subjects.map((s) => s.subjectId)).toContain('XYZ')
  })
})

describe('Level detail: on track, below, at risk', () => {
  it('counts every pair, per class and for the level; at risk is the lowest gaps first with names for the own pupils', async () => {
    const r = await w.school.level(teacher, 't4')
    expect(r).toMatchObject({ onTrack: 2, below: 4, onTrackPct: 33 })
    expect(r.classRows[0]).toMatchObject({ onTrack: 2, below: 3 })
    expect(r.atRisk).toEqual([
      { userId: '2', name: 'Murid Ujian 2', className: 'Kelas 4A', checkpoint: 2, ar: 70, target: 80, gap: -10 },
      { userId: '3', name: 'Murid Ujian 3', className: 'Kelas 4A', checkpoint: 2, ar: 55, target: 60, gap: -5 },
      { userId: '5', name: 'Murid Ujian 5', className: 'Kelas 4A', checkpoint: 2, ar: 45, target: 50, gap: -5 },
    ])
    PerformanceLevelDetailSchema.parse(r)
  })

  it('a teacher of other classes gets redacted ids and names; a school admin sees them', async () => {
    const other = await w.school.level(ctxOf('teacher', 't9'), 't4')
    expect(other.atRisk.map((a) => [a.userId, a.name])).toEqual([
      ['0', 'Murid'],
      ['0', 'Murid'],
      ['0', 'Murid'],
    ])
    expect((await w.school.level(schoolAdmin, 't4')).atRisk[0]).toMatchObject({ userId: '2', name: 'Murid Ujian 2' })
  })

  it('privacy (test 14): at risk stays empty for students and officers', async () => {
    expect((await w.school.level(ctxOf('student', '1'), 't4')).atRisk).toEqual([])
    expect((await w.school.level(ctxOf('ppd_officer', 'o1'), 't4')).atRisk).toEqual([])
  })

  it('privacy (test 14): the level rule also gates the headcount numbers, and no combination isolates a class of fewer than 5 pupils', async () => {
    for (const id of ['7', '8', '9']) w.directory.addPupil({ id, schoolId: 's1' })
    w.classes.add({ id: '11', schoolId: 's1', name: 'Kelas 4B', teacherId: 't2', subjectId: '1', subjectName: 'Bahasa Melayu' }, ['7', '8', '9'])
    w.facts.add(...['7', '8', '9'].map((studentId) => entry({ studentId, configId: '2', classroomId: '11', targets: [null, 50], actuals: [null, 40] })))
    const student = ctxOf('student', '1')
    const hidden = await w.school.level(student, 't4')
    expect(hidden).toMatchObject({ onTrack: 0, below: 0, onTrackPct: 0 })
    expect(hidden.classRows.map((c) => [c.classId, c.onTrack, c.below])).toEqual([
      ['10', 2, 3],
      ['11', 0, 0],
    ])
    const staff = await w.school.level(schoolAdmin, 't4')
    expect(staff).toMatchObject({ onTrack: 2, below: 7 })
    expect(staff.classRows.map((c) => [c.classId, c.onTrack, c.below])).toEqual([
      ['10', 2, 3],
      ['11', 0, 3],
    ])
  })
})
