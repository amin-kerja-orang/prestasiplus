import { describe, expect, it } from 'vitest'

import type { ClassInfo, ClassesReadPort } from '../../../../src/modules/reports/performance/ports'

export interface SeedTeacher {
  key: string
  name: string
  school: string
}

export interface SeedClass {
  key: string
  kind?: 'classroom' | 'school_class'
  name: string
  school: string
  teacher: string | null
  subject: string | null
  /** M03 grade of the class level (10 = Tingkatan 4, 11 = Tingkatan 5). */
  grade: 10 | 11
  year: number
  active: boolean
  /** Active members (pupil keys). */
  members: string[]
  /** Pupils whose enrolment was removed: they must never appear. */
  removed?: string[]
}

export interface ClassesSeed {
  schools: string[]
  teachers: SeedTeacher[]
  pupils: string[]
  classes: SeedClass[]
}

/** The port plus the translation from the seed keys to the ids the implementation holds. */
export interface ClassesHarness {
  port: ClassesReadPort
  classId(key: string): string
  userId(key: string): string
  schoolId(key: string): string
  subject(key: string): { id: string; name: string }
  levelSlug(grade: 10 | 11): string
}

/** Builds a port holding exactly `seed`. The real adapter's factory inserts the rows into a seeded database. */
export type ClassesFactory = (seed: ClassesSeed) => Promise<ClassesHarness>

export const CLASSES_SEED: ClassesSeed = {
  schools: ['S1', 'S2'],
  teachers: [
    { key: 'T1', name: 'Cikgu Alfa Ujian', school: 'S1' },
    { key: 'T2', name: 'Cikgu Beta Ujian', school: 'S2' },
  ],
  pupils: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
  classes: [
    { key: 'C1', name: 'Kelas Satu', school: 'S1', teacher: 'T1', subject: 'SUB1', grade: 10, year: 2026, active: true, members: ['P1', 'P2'], removed: ['P3'] },
    { key: 'C2', name: 'Kelas Dua', school: 'S1', teacher: 'T1', subject: null, grade: 11, year: 2025, active: false, members: ['P2', 'P7'] },
    { key: 'C3', name: 'Kelas Tiga', school: 'S2', teacher: 'T2', subject: 'SUB1', grade: 10, year: 2026, active: true, members: ['P3', 'P4'] },
    { key: 'C4', kind: 'school_class', name: '4 Amanah', school: 'S1', teacher: null, subject: null, grade: 10, year: 2026, active: true, members: ['P1', 'P5'] },
  ],
}

const UNKNOWN = '999999999'
const sorted = (xs: readonly string[]) => [...xs].sort()

/**
 * The behaviour every `ClassesReadPort` must show: the in-memory fake passes it now, the real adapter over BE-17
 * must pass it on a seeded database.
 */
export function describeClassesReadPort(name: string, factory: ClassesFactory): void {
  describe(`ClassesReadPort contract: ${name}`, () => {
    const ids = (h: ClassesHarness, ...keys: string[]) => sorted(keys.map((k) => h.classId(k)))
    const idsOf = (infos: ClassInfo[]) => sorted(infos.map((c) => c.id))

    it('lists every class of both kinds, and the classes of one school', async () => {
      const h = await factory(CLASSES_SEED)
      expect(idsOf(await h.port.allClasses())).toEqual(ids(h, 'C1', 'C2', 'C3', 'C4'))
      expect(idsOf(await h.port.classesOfSchool(h.schoolId('S1')))).toEqual(ids(h, 'C1', 'C2', 'C4'))
      expect(idsOf(await h.port.classesOfSchool(h.schoolId('S2')))).toEqual(ids(h, 'C3'))
      expect(await h.port.classesOfSchool(UNKNOWN)).toEqual([])
    })

    it('lists the active classes of a teacher, and the inactive ones only on request', async () => {
      const h = await factory(CLASSES_SEED)
      const t1 = h.userId('T1')
      expect(idsOf(await h.port.classesForTeacher(t1))).toEqual(ids(h, 'C1'))
      expect(idsOf(await h.port.classesForTeacher(t1, { includeInactive: false }))).toEqual(ids(h, 'C1'))
      expect(idsOf(await h.port.classesForTeacher(t1, { includeInactive: true }))).toEqual(ids(h, 'C1', 'C2'))
      expect(idsOf(await h.port.classesForTeacher(h.userId('T2')))).toEqual(ids(h, 'C3'))
      expect(await h.port.classesForTeacher(UNKNOWN)).toEqual([])
    })

    it('describes a class: owner name, subject, level slug, year, state and the active member count', async () => {
      const h = await factory(CLASSES_SEED)
      const c1 = await h.port.classById(h.classId('C1'))
      expect(c1).toMatchObject({
        id: h.classId('C1'),
        kind: 'classroom',
        name: 'Kelas Satu',
        schoolId: h.schoolId('S1'),
        teacherId: h.userId('T1'),
        teacherName: 'Cikgu Alfa Ujian',
        subjectId: h.subject('SUB1').id,
        subjectName: h.subject('SUB1').name,
        levelSlug: h.levelSlug(10),
        year: 2026,
        isActive: true,
        studentCount: 2,
      })
      expect(c1?.createdAt).toBeInstanceOf(Date)
      expect(typeof c1?.joinCode).toBe('string')
    })

    it('answers an inactive class, a class without subject and a school class without owner', async () => {
      const h = await factory(CLASSES_SEED)
      expect(await h.port.classById(h.classId('C2'))).toMatchObject({ isActive: false, subjectId: null, subjectName: null, levelSlug: h.levelSlug(11), studentCount: 2 })
      expect(await h.port.classById(h.classId('C4'))).toMatchObject({ kind: 'school_class', teacherId: null, teacherName: null, studentCount: 2 })
    })

    it('returns null for an unknown or malformed class id', async () => {
      const h = await factory(CLASSES_SEED)
      expect(await h.port.classById(UNKNOWN)).toBeNull()
      expect(await h.port.classById('not-an-id')).toBeNull()
    })

    it('gives the same classes for the batch read and skips unknown ids', async () => {
      const h = await factory(CLASSES_SEED)
      const got = await h.port.classesByIds([h.classId('C3'), UNKNOWN, h.classId('C1'), h.classId('C1')])
      expect(idsOf(got)).toEqual(ids(h, 'C1', 'C3'))
      expect(await h.port.classesByIds([])).toEqual([])
      expect(got.find((c) => c.id === h.classId('C3'))).toEqual(await h.port.classById(h.classId('C3')))
    })

    it('lists only ACTIVE members of a class (removed pupils never appear)', async () => {
      const h = await factory(CLASSES_SEED)
      expect(sorted(await h.port.memberIds(h.classId('C1')))).toEqual(sorted([h.userId('P1'), h.userId('P2')]))
      expect(sorted(await h.port.memberIds(h.classId('C2')))).toEqual(sorted([h.userId('P2'), h.userId('P7')]))
      expect(await h.port.memberIds(UNKNOWN)).toEqual([])
    })

    it('batches the members of many classes and keeps unknown classes as empty lists', async () => {
      const h = await factory(CLASSES_SEED)
      const m = await h.port.membersOf([h.classId('C1'), h.classId('C3'), UNKNOWN])
      expect(m.size).toBe(3)
      expect(sorted(m.get(h.classId('C1')) ?? ['x'])).toEqual(sorted([h.userId('P1'), h.userId('P2')]))
      expect(sorted(m.get(h.classId('C3')) ?? ['x'])).toEqual(sorted([h.userId('P3'), h.userId('P4')]))
      expect(m.get(UNKNOWN)).toEqual([])
      expect((await h.port.membersOf([])).size).toBe(0)
    })

    it('lists the classes of a pupil, one and in batch, with [] for a pupil without classes', async () => {
      const h = await factory(CLASSES_SEED)
      expect(sorted(await h.port.classIdsOfStudent(h.userId('P1')))).toEqual(ids(h, 'C1', 'C4'))
      expect(sorted(await h.port.classIdsOfStudent(h.userId('P3')))).toEqual(ids(h, 'C3'))
      expect(await h.port.classIdsOfStudent(h.userId('P6'))).toEqual([])
      expect(await h.port.classIdsOfStudent(UNKNOWN)).toEqual([])
      const m = await h.port.classIdsOfStudents([h.userId('P1'), h.userId('P2'), h.userId('P6'), UNKNOWN])
      expect(m.size).toBe(4)
      expect(sorted(m.get(h.userId('P1')) ?? ['x'])).toEqual(ids(h, 'C1', 'C4'))
      expect(sorted(m.get(h.userId('P2')) ?? ['x'])).toEqual(ids(h, 'C1', 'C2'))
      expect(m.get(h.userId('P6'))).toEqual([])
      expect(m.get(UNKNOWN)).toEqual([])
      expect((await h.port.classIdsOfStudents([])).size).toBe(0)
    })

    it('isMemberOfTeacher: an active member of an ACTIVE class owned by that teacher, and nothing else', async () => {
      const h = await factory(CLASSES_SEED)
      const is = (t: string, p: string) => h.port.isMemberOfTeacher(h.userId(t), h.userId(p))
      expect(await is('T1', 'P1')).toBe(true)
      expect(await is('T1', 'P2')).toBe(true) // also in an inactive class, but C1 is active
      expect(await is('T2', 'P3')).toBe(true)
      expect(await is('T1', 'P7')).toBe(false) // member of an INACTIVE class only
      expect(await is('T1', 'P3')).toBe(false) // removed from C1; belongs to another teacher
      expect(await is('T1', 'P5')).toBe(false) // school class without owner
      expect(await is('T2', 'P1')).toBe(false)
      expect(await is('T1', 'P6')).toBe(false)
      expect(await h.port.isMemberOfTeacher(UNKNOWN, h.userId('P1'))).toBe(false)
    })
  })
}
