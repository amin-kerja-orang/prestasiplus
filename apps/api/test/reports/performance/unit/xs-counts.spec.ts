import { PerformanceLevelDetailSchema, PerformanceSchoolSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import type { XsCountsPort } from '../../../../src/modules/reports/performance/ports'
import type { XsQueries } from '../../../../src/modules/school-admin/xs-queries'
import { ctxOf, world, type World } from '../fakes/fixtures'

/** Compile-time proof that the real XS queries of the school admin Dashboard satisfy the port (the same queries, not a copy). */
export const realQueriesAreThePort = (xs: XsQueries): XsCountsPort => xs

/**
 * R1 S10-T07 part 2b (FR-AS-4-1): the Murid and Guru numbers of Prestasi sekolah, Tingkatan and the teacher cards are the XS-1 and
 * XS-3 queries of S6-T03 (`school-admin/xs-queries.ts`), through `XS_COUNTS_PORT` (the fake `InMemoryXsCounts` writes the same rules
 * out for the fixture).
 *
 * Fixture school s1 (the 3 teachers / 17 pupils school of AC-AS-4-1):
 *   counted pupils (17): ids 101..109 in Tingkatan 4 (grade 10), 110..117 in Tingkatan 5 (grade 11)
 *   not counted: 201 suspended, 202 pending (inactive), 203 deactivated (inactive and suspended), 204 Darjah 6 (grade 6),
 *                205 without a grade (not a Tingkatan 1-5 member); every one of them is a member of a class
 *   counted teachers (3): t1 t2 t3; not counted: tp pending ("Guru Menunggu"), td deactivated, tx suspended, ts also a school admin
 * School s2 (other school, counted pupils 301..302 + one suspended 303, one teacher).
 */
let w: World

beforeEach(() => {
  w = world()
  w.directory.addSchool({ id: 's1' }).addSchool({ id: 's2', district: 'Daerah B' })
  const pupil = (id: string, grade: number | null, over: Record<string, unknown> = {}): void => {
    w.directory.addPupil({ id, name: `Murid Ujian ${id}`, schoolId: 's1', grade, levelSlug: grade === 11 ? 't5' : 't4', ...over })
  }
  for (let i = 101; i <= 109; i++) pupil(String(i), 10)
  for (let i = 110; i <= 117; i++) pupil(String(i), 11)
  pupil('201', 10, { isSuspended: true })
  pupil('202', 10, { isActive: false })
  pupil('203', 10, { isActive: false, isSuspended: true })
  pupil('204', 6, { levelSlug: null })
  pupil('205', null, { levelSlug: null })
  w.directory.addPupil({ id: '301', schoolId: 's2' }).addPupil({ id: '302', schoolId: 's2' }).addPupil({ id: '303', schoolId: 's2', isSuspended: true })
  w.directory
    .addTeacher('t1', 'Cikgu Satu', 's1')
    .addTeacher('t2', 'Cikgu Dua', 's1')
    .addTeacher('t3', 'Cikgu Tiga', 's1')
    .addTeacher('tp', 'Cikgu Menunggu', 's1', { pending: true })
    .addTeacher('td', 'Cikgu Nyahaktif', 's1', { isActive: false })
    .addTeacher('tx', 'Cikgu Digantung', 's1', { isSuspended: true })
    .addTeacher('ts', 'Cikgu Pentadbir', 's1', { isSchoolAdmin: true })
    .addTeacher('t9', 'Cikgu Sembilan', 's2')
  const t4 = [...Array.from({ length: 9 }, (_, i) => String(101 + i)), '201', '202', '203', '204', '205']
  const t5 = Array.from({ length: 8 }, (_, i) => String(110 + i))
  w.classes
    .add({ id: '10', schoolId: 's1', teacherId: 't1', teacherName: 'Cikgu Satu', levelSlug: 't4' }, t4)
    .add({ id: '20', schoolId: 's1', teacherId: 't2', teacherName: 'Cikgu Dua', levelSlug: 't5' }, [...t5, '201'])
    .add({ id: '90', schoolId: 's2', teacherId: 't9', teacherName: 'Cikgu Sembilan' }, ['301', '302', '303'])
})

const schoolAdmin = ctxOf('school_admin', 'sa1')
const admin = ctxOf('admin', 'a', { level: 'national', label: 'x' })

describe('Prestasi sekolah: Murid = XS-1, Guru = XS-3 (FR-AS-4-1, AC-AS-4-1)', () => {
  it('a school with 3 teachers and 17 pupils shows Guru 3 and Murid 17, equal to the XS queries of the school', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.stats.students).toBe(17)
    expect(r.stats.teachers).toBe(3)
    expect(r.header.studentCount).toBe(17)
    const xsPupils = await w.xs.pupils({ kind: 'school', schoolId: 's1' })
    expect(r.stats.students).toBe(xsPupils.count)
    expect(r.stats.teachers).toBe(await w.xs.teacherCount('s1'))
    PerformanceSchoolSchema.parse(r)
  })

  it('a suspended, a pending, a deactivated, a Darjah and a grade-less pupil are not Murid', async () => {
    const r = await w.school.school(schoolAdmin)
    // 22 pupil accounts in the school, every one of the 5 excluded ones sits in a class.
    expect(w.directory.pupilList.filter((p) => p.schoolId === 's1')).toHaveLength(22)
    expect(r.stats.students).toBe(17)
  })

  it('a pending teacher, a deactivated or suspended teacher and a school admin are not Guru', async () => {
    expect((await w.school.school(schoolAdmin)).stats.teachers).toBe(3)
  })

  it('a pupil that becomes pending or suspended leaves Murid, a teacher that is approved joins Guru', async () => {
    w.directory.addPupil({ id: '101', schoolId: 's1', grade: 10, isActive: false })
    w.directory.addPupil({ id: '102', schoolId: 's1', grade: 10, isSuspended: true })
    w.directory.addTeacher('tp', 'Cikgu Menunggu', 's1')
    const r = await w.school.school(schoolAdmin)
    expect(r.stats).toMatchObject({ students: 15, teachers: 4 })
  })

  it('the platform (admin) counts XS-1 pupils and XS-3 teachers of every school', async () => {
    const r = await w.school.school(admin)
    expect(r.scope).toBe('platform')
    expect(r.stats.students).toBe(17 + 2)
    expect(r.stats.teachers).toBe(3 + 1)
  })

  it('platform leaves out the pupils of primary schools (D72)', async () => {
    w.directory.addSchool({ id: 's3', type: 'SK' })
    w.directory.addPupil({ id: '401', schoolId: 's3', grade: 10 })
    const r = await w.school.school(admin)
    expect(r.stats.students).toBe(19)
  })

  it('a viewer without a school sees zero Murid and zero Guru', async () => {
    const noSchool = ctxOf('school_admin', 'sa9', { level: 'national', label: 'x' })
    const r = await w.school.school(noSchool)
    expect(r.stats).toMatchObject({ students: 0, teachers: 0 })
  })
})

describe('Tingkatan rows and teacher cards count XS-1 pupils only', () => {
  it('the level rows of the school page count the pupils of the level that are XS-1', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.levels.map((l) => [l.code, l.students])).toEqual([
      ['t4', 9],
      ['t5', 8],
    ])
    // the two level counts add up to Murid (every counted pupil is in one of the two levels)
    expect(r.levels.reduce((a, l) => a + l.students, 0)).toBe(r.stats.students)
  })

  it('the teacher cards count the XS-1 pupils of the own classes', async () => {
    const r = await w.school.school(schoolAdmin)
    expect(r.teachers.map((t) => [t.userId, t.studentCount])).toEqual([
      ['t2', 8],
      ['t1', 9],
    ])
  })

  it('the Tingkatan cards (levels) carry the same counts as the school page', async () => {
    const cards = await w.school.levels(schoolAdmin)
    expect(cards.map((c) => [c.code, c.students])).toEqual([
      ['t4', 9],
      ['t5', 8],
    ])
  })

  it('a teacher sees XS-1 pupils of the own classes only (own-class scope of #857 stays)', async () => {
    const cards = await w.school.levels(ctxOf('teacher', 't2'))
    expect(cards.find((c) => c.code === 't5')?.students).toBe(8)
    expect(cards.find((c) => c.code === 't4')?.students).toBe(0)
  })

  it('the Tingkatan detail: students and class rows are XS-1 counts', async () => {
    const d = await w.school.level(schoolAdmin, 't4')
    expect(d.students).toBe(9)
    expect(d.classRows.map((c) => c.students)).toEqual([9])
    PerformanceLevelDetailSchema.parse(d)
  })

  it('a Tingkatan of the teacher scope names its subset: t2 owns t5 only', async () => {
    const d = await w.school.level(ctxOf('teacher', 't2'), 't5')
    expect(d.students).toBe(8)
  })
})
