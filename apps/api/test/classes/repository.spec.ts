import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { classesSeed, DEMO_CLASS_CODE } from '../../prisma/seed/poc/classes'
import { ClassesRepository } from '../../src/modules/classes'
import { CompClassroomAdapter } from '../../src/modules/classes/comp-classroom.adapter'
import { gradeOfSlug, levelLabelOfGrade, slugOfGrade } from '../../src/modules/classes/level-slug'
import { PrismaService } from '../../src/db/prisma.service'
import { STUDENT_1, STUDENT_2, TEACHER_A, bootClassesApp, idOfEmail, schoolOfCode, type ClassesTestApp } from './helpers'

describe('level slugs (pure)', () => {
  it('maps grades and slugs both ways', () => {
    expect(slugOfGrade(1)).toBe('tahun-1')
    expect(slugOfGrade(6)).toBe('tahun-6')
    expect(slugOfGrade(7)).toBe('tingkatan-1')
    expect(slugOfGrade(11)).toBe('tingkatan-5')
    expect([0, 12, null, 2.5].map((g) => slugOfGrade(g))).toEqual([null, null, null, null])
    expect(gradeOfSlug('tingkatan-4')).toBe(10)
    expect(gradeOfSlug('tahun-3')).toBe(3)
    expect(gradeOfSlug('tingkatan-6')).toBeNull()
    expect(gradeOfSlug('x')).toBeNull()
    expect(levelLabelOfGrade(3)).toBe('Tahun 3')
    expect(levelLabelOfGrade(10)).toBe('Ting. 4')
  })
})

describe('ClassesRepository, the COMP_CLASSROOM_PORT adapter and the seed (AC 5)', () => {
  let t: ClassesTestApp
  let repo: ClassesRepository
  let teacherId: string
  let s1: string
  let s2: string
  let school1: string
  let levelId: string
  const now = new Date('2026-10-19T01:00:00Z')

  beforeAll(async () => {
    t = await bootClassesApp({ seeds: [classesSeed] })
    repo = t.get(ClassesRepository)
    teacherId = await idOfEmail(t, TEACHER_A)
    s1 = await idOfEmail(t, STUDENT_1)
    s2 = await idOfEmail(t, STUDENT_2)
    school1 = await schoolOfCode(t, 'DEMO001')
    levelId = (await t.db.query<{ id: string }>(`select id::text from education_levels where grade = 10`))[0]?.id as string
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('the seed made the demo class and generated classes; a second run changes nothing', async () => {
    const counts = async () => ({
      classes: (await t.db.query<{ n: number }>(`select count(*)::int n from classrooms`))[0]?.n,
      enrolments: (await t.db.query<{ n: number }>(`select count(*)::int n from enrolments`))[0]?.n,
      legacy: (await t.db.query<{ n: number }>(`select count(*)::int n from classrooms where legacy_source is not null or legacy_id is not null`))[0]?.n,
    })
    const first = await counts()
    expect(first.classes).toBeGreaterThan(3)
    expect(first.legacy).toBe(0)
    const demo = await repo.findByJoinCode(`  ${DEMO_CLASS_CODE.toLowerCase()} `)
    expect(demo).toMatchObject({ name: 'Kelas Demo Tingkatan 4', teacherId, kind: 'classroom' })
    expect(await repo.memberIds((demo as { id: string }).id)).toEqual([s1, s2].sort((x, y) => Number(x) - Number(y)))
    await runSeeds([classesSeed], { prisma: t.db.prisma })
    expect(await counts()).toEqual(first)
  })

  it('createClass, get, forTeacher, schoolClasses, findByJoinCode', async () => {
    const c = await repo.createClass({ name: 'Repo Satu', teacherId, schoolId: school1, subjectId: null, educationLevelId: levelId, academicYear: 2026, description: null, now })
    expect(c).toMatchObject({ kind: 'classroom', teacherId, schoolId: school1, subjectId: null, isActive: true })
    expect(c.joinCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
    expect(await repo.get(c.id)).toMatchObject({ id: c.id, name: 'Repo Satu' })
    expect(await repo.get('abc')).toBeNull()
    expect((await repo.forTeacher(teacherId)).map((x) => x.id)).toContain(c.id)
    expect(await repo.forTeacher('x')).toEqual([])
    expect((await repo.schoolClasses(school1)).map((x) => x.id)).toContain(c.id)
    expect((await repo.findByJoinCode(c.joinCode as string))?.id).toBe(c.id)
    expect(await repo.findByJoinCode('   ')).toBeNull()
    expect(await repo.findByJoinCode('NOSUCH')).toBeNull()
  })

  it('enrol reports created, already and reactivated; unenrol and memberIds follow', async () => {
    const c = await repo.createClass({ name: 'Repo Dua', teacherId, schoolId: school1, subjectId: null, educationLevelId: levelId, academicYear: 2026, description: null, now })
    expect((await repo.enrol({ classroomId: c.id, studentId: s1, source: 'code', now })).outcome).toBe('created')
    expect((await repo.enrol({ classroomId: c.id, studentId: s1, source: 'teacher', now })).outcome).toBe('already')
    expect(await repo.memberIds(c.id)).toEqual([s1])
    expect(await repo.isMember(c.id, s1)).toBe(true)
    expect([...(await repo.memberCounts([c.id, '999999'])).entries()]).toEqual([[c.id, 1], ['999999', 0]])
    expect((await repo.forStudent(s1)).map((x) => x.id)).toContain(c.id)
    expect(await repo.unenrol(c.id, s1, now)).toBe(true)
    expect(await repo.unenrol(c.id, s1, now)).toBe(false)
    expect(await repo.memberIds(c.id)).toEqual([])
    expect((await repo.forStudent(s1)).map((x) => x.id)).not.toContain(c.id)
    const back = await repo.enrol({ classroomId: c.id, studentId: s1, source: 'code', now })
    expect(back.outcome).toBe('reactivated')
    expect(back.enrolment).toMatchObject({ status: 'active', source: 'code' })
    expect(await repo.roster(c.id)).toHaveLength(1)
    expect(await repo.teacherStudentIds(teacherId)).toContain(s1)
  })

  it('parallel enrols of one pair end in one row', async () => {
    const c = await repo.createClass({ name: 'Repo Selari', teacherId, schoolId: school1, subjectId: null, educationLevelId: levelId, academicYear: 2026, description: null, now })
    const outcomes = await Promise.all(Array.from({ length: 6 }, () => repo.enrol({ classroomId: c.id, studentId: s2, source: 'code', now })))
    expect(outcomes.filter((o) => o.outcome === 'created')).toHaveLength(1)
    expect(await t.db.query(`select 1 from enrolments where classroom_id = $1`, [c.id])).toHaveLength(1)
  })

  it('a rolled back transaction leaves no class behind', async () => {
    const prisma = t.get(PrismaService)
    await expect(
      prisma.transaction(async () => {
        await repo.createClass({ name: 'Batal', teacherId, schoolId: null, subjectId: null, educationLevelId: levelId, academicYear: 2026, description: null, now })
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await t.db.query(`select 1 from classrooms where name = 'Batal'`)).toHaveLength(0)
  })

  it('the join code is unique ignoring case at the database', async () => {
    await t.db.query(`insert into classrooms (name, education_level_id, academic_year, join_code) values ('A', $1, 2026, 'DUPCODE')`, [levelId])
    await expect(t.db.query(`insert into classrooms (name, education_level_id, academic_year, join_code) values ('B', $1, 2026, 'dupcode')`, [levelId])).rejects.toThrow(/uq_classrooms_join_code_upper/)
    await expect(t.db.query(`insert into classrooms (name, education_level_id, academic_year, kind) values ('C', $1, 2026, 'weird')`, [levelId])).rejects.toThrow(/ck_classrooms_kind/)
    await expect(t.db.query(`insert into classrooms (name, education_level_id, academic_year, legacy_source) values ('D', $1, 2026, 'x')`, [levelId])).rejects.toThrow(/ck_classrooms_legacy_source/)
  })

  it('teacher profile: none, created on first save, updated after', async () => {
    expect(await repo.teacherProfile(teacherId)).toBeNull()
    expect(await repo.saveTeacherProfile(teacherId, { subject: 'Sejarah', experienceYears: 3 }, now)).toEqual({ userId: teacherId, subject: 'Sejarah', qualification: null, experienceYears: 3 })
    expect(await repo.saveTeacherProfile(teacherId, { qualification: 'Sarjana Muda' }, now)).toEqual({ userId: teacherId, subject: 'Sejarah', qualification: 'Sarjana Muda', experienceYears: 3 })
    expect(await t.db.query(`select 1 from teacher_profiles where user_id = $1`, [teacherId])).toHaveLength(1)
  })

  describe('COMP_CLASSROOM_PORT adapter (BE-25)', () => {
    it('find: only an active teacher class, with school name and grade', async () => {
      const port = t.get(CompClassroomAdapter)
      const demo = await repo.findByJoinCode(DEMO_CLASS_CODE)
      expect(await port.find((demo as { id: string }).id)).toEqual({ id: demo?.id, schoolId: school1, schoolName: 'SMK Demo Satu', grade: 10 })
      expect(await port.find('999999')).toBeNull()
      expect(await port.find('abc')).toBeNull()
      await t.db.query(`update classrooms set is_active = false where id = $1`, [demo?.id])
      expect(await port.find((demo as { id: string }).id)).toBeNull()
      await t.db.query(`update classrooms set is_active = true, kind = 'school_class' where id = $1`, [demo?.id])
      expect(await port.find((demo as { id: string }).id)).toBeNull()
      await t.db.query(`update classrooms set kind = 'classroom' where id = $1`, [demo?.id])
    })

    it('enrol adds source "complimentary" rows (idempotent) and describe shows the class, teacher and code', async () => {
      const port = t.get(CompClassroomAdapter)
      const c = await repo.createClass({ name: 'Kelas Komp', teacherId, schoolId: school1, subjectId: null, educationLevelId: levelId, academicYear: 2026, description: null, now })
      const [x] = await t.db.query<{ id: string }>(`insert into users (name) values ('Murid Komp Ujian') returning id::text`)
      await port.enrol(c.id, [x?.id as string])
      await port.enrol(c.id, [x?.id as string])
      expect(await t.db.query(`select source from enrolments where classroom_id = $1`, [c.id])).toEqual([{ source: 'complimentary' }])
      const view = (await port.describe([x?.id as string, '999999'])).get(x?.id as string)
      expect(view).toEqual({
        classLabel: 'Kelas Komp',
        teacherName: 'Guru Demo',
        classes: [{ name: 'Kelas Komp', classCode: c.joinCode, subjectName: null, teacherName: 'Guru Demo', status: 'active' }],
      })
      expect((await port.describe(['999999'])).size).toBe(0)
      await repo.unenrol(c.id, x?.id as string, now)
      const removed = (await port.describe([x?.id as string])).get(x?.id as string)
      expect(removed?.classLabel).toBe('')
      expect(removed?.classes[0]?.status).toBe('removed')
    })
  })
})
