/**
 * PoC classes seed (BE-17, demo): classes and rosters for the BE-07 population. One class per grade group of a
 * school's generated pupils, handed out round-robin to that school's generated teachers, plus one explicit demo class
 * (`DEMO4S`) for `guru@demo.test` with the two Form 4 demo pupils.
 *
 * Rules: fictitious data only (names `Kelas Contoh ...`; the accounts come from the identity and population seeds);
 * deterministic (sorted by id, join codes `KLS001`, `KLS002`, ... in that order) and idempotent (a class is found by its
 * join code, an enrolment by class + pupil; an existing enrolment keeps its status); `legacy_*` is never set and a
 * migrated class (legacy_source set) is never touched. Runs after the curriculum seed (levels and subjects).
 */
import { mytDay } from '../../../src/db/clock'
import { assertSeedAllowed } from '../guard'
import type { SeedModule } from '../index'

export const DEMO_CLASS_CODE = 'DEMO4S'
const DEMO_TEACHER = 'guru@demo.test'
const DEMO_PUPILS = ['pelajar@demo.test', 'pelajar2@demo.test']
const DEMO_GRADE = 10

const levelLabel = (grade: number): string => (grade <= 6 ? `Tahun ${grade}` : `Tingkatan ${grade - 6}`)

interface PlannedClass {
  code: string
  name: string
  teacherId: bigint
  schoolId: bigint
  grade: number
  studentIds: bigint[]
}

export const classesSeed: SeedModule = {
  name: 'poc-classes',
  kind: 'demo',
  async run(ctx) {
    assertSeedAllowed()
    const { prisma } = ctx
    const now = ctx.clock.now()
    const academicYear = Number(mytDay(now).slice(0, 4))

    const levels = new Map<number, bigint>()
    for (const l of await prisma.educationLevel.findMany({ where: { grade: { not: null } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })) {
      if (l.grade !== null && !levels.has(l.grade)) levels.set(l.grade, l.id)
    }
    if (levels.size === 0) throw new Error('Classes seed needs the education levels; run the curriculum seed first.')
    const subjects = await prisma.subject.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } })

    // Generated pupils and teachers (example.test); the demo accounts (demo.test) are handled by the explicit class.
    const people = await prisma.user.findMany({
      where: { email: { endsWith: '@example.test' }, isActive: true, isSuspended: false, schoolId: { not: null } },
      select: { id: true, schoolId: true, grade: true, roles: { select: { role: true } } },
      orderBy: { id: 'asc' },
    })
    interface SchoolPeople {
      teachers: bigint[]
      pupils: Map<number, bigint[]>
    }
    const bySchool = new Map<bigint, SchoolPeople>()
    for (const p of people) {
      if (p.schoolId === null) continue
      const entry: SchoolPeople = bySchool.get(p.schoolId) ?? { teachers: [], pupils: new Map<number, bigint[]>() }
      bySchool.set(p.schoolId, entry)
      const roles = p.roles.map((r) => r.role)
      if (roles.includes('teacher')) entry.teachers.push(p.id)
      else if (roles.includes('student') && p.grade !== null && levels.has(p.grade)) {
        const group = entry.pupils.get(p.grade) ?? []
        group.push(p.id)
        entry.pupils.set(p.grade, group)
      }
    }

    const planned: PlannedClass[] = []
    const demoTeacher = await prisma.user.findFirst({ where: { email: { equals: DEMO_TEACHER, mode: 'insensitive' } }, select: { id: true, schoolId: true } })
    if (demoTeacher?.schoolId != null) {
      const pupils = await prisma.user.findMany({
        where: { email: { in: DEMO_PUPILS }, isActive: true, isSuspended: false },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      planned.push({ code: DEMO_CLASS_CODE, name: 'Kelas Demo Tingkatan 4', teacherId: demoTeacher.id, schoolId: demoTeacher.schoolId, grade: DEMO_GRADE, studentIds: pupils.map((p) => p.id) })
    }
    let seq = 0
    for (const [schoolId, entry] of [...bySchool.entries()].sort((a, b) => Number(a[0] - b[0]))) {
      if (entry.teachers.length === 0) continue
      const grades = [...entry.pupils.keys()].sort((a, b) => a - b)
      grades.forEach((grade, i) => {
        seq += 1
        planned.push({
          code: `KLS${String(seq).padStart(3, '0')}`,
          name: `Kelas Contoh ${levelLabel(grade)}`,
          teacherId: entry.teachers[i % entry.teachers.length] as bigint,
          schoolId,
          grade,
          studentIds: entry.pupils.get(grade) ?? [],
        })
      })
    }

    let skippedMigrated = 0
    for (const [index, c] of planned.entries()) {
      const existing = await prisma.classroom.findFirst({ where: { joinCode: { equals: c.code, mode: 'insensitive' } } })
      if (existing?.legacySource != null) {
        skippedMigrated += 1
        continue
      }
      const data = {
        kind: 'classroom',
        name: c.name,
        teacherId: c.teacherId,
        schoolId: c.schoolId,
        subjectId: subjects.length === 0 ? null : (subjects[index % subjects.length] as { id: bigint }).id,
        educationLevelId: levels.get(c.grade) as bigint,
        academicYear,
        isActive: true,
      }
      const row = existing
        ? await prisma.classroom.update({ where: { id: existing.id }, data })
        : await prisma.classroom.create({ data: { ...data, joinCode: c.code, createdAt: now, updatedAt: now } })
      for (const [n, studentId] of c.studentIds.entries()) {
        await prisma.enrolment.upsert({
          where: { classroomId_studentId: { classroomId: row.id, studentId } },
          create: { classroomId: row.id, studentId, status: 'active', source: n % 3 === 0 ? 'code' : 'teacher', joinedAt: now, createdAt: now, updatedAt: now },
          update: {},
        })
      }
    }
    if (skippedMigrated > 0) console.warn(`seed poc-classes: skipped ${skippedMigrated} class(es) whose join code belongs to a migrated class (legacy_source set).`)
  },
}
