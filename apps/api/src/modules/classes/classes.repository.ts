import { randomInt } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { JOIN_CODE_ALPHABET, JOIN_CODE_ATTEMPTS, JOIN_CODE_LENGTH } from './classes.constants'
import { slugOfGrade } from './level-slug'
import { VISIBLE_USER_SQL } from '../command-center/shared/visibility'

export type ClassroomKind = 'classroom' | 'school_class'
export type EnrolmentStatus = 'active' | 'removed'
export type EnrolmentSource = 'code' | 'teacher' | 'school_admin' | 'complimentary'

/** Report label of a class (BE-19): level slug (`tahun-n` / `tingkatan-n`, null for other grades), owner's name and active real member count. */
export interface ClassLabel extends ClassRecord {
  levelSlug: string | null
  teacherName: string | null
  studentCount: number
}

/** A class as the other modules see it: decimal-string ids, no `legacy_*`. */
export interface ClassRecord {
  id: string
  kind: ClassroomKind
  teacherId: string | null
  schoolId: string | null
  subjectId: string | null
  educationLevelId: string
  name: string
  academicYear: number
  description: string | null
  joinCode: string | null
  isActive: boolean
  createdAt: Date
}

export interface EnrolmentRecord {
  classroomId: string
  studentId: string
  status: EnrolmentStatus
  source: EnrolmentSource
  joinedAt: Date
}

export interface NewClass {
  name: string
  teacherId: string
  schoolId: string | null
  subjectId: string | null
  educationLevelId: string
  academicYear: number
  description: string | null
  now: Date
}

export interface EnrolInput {
  classroomId: string
  studentId: string
  source: EnrolmentSource
  /** Written under Mod Pelajar: the row is test data and never counted. */
  isTest?: boolean
  now: Date
}

/** `created`: a new row; `reactivated`: a removed student joined again; `already`: an active member (nothing written). */
export type EnrolOutcome = 'created' | 'reactivated' | 'already'

export interface StudentLine {
  id: string
  name: string
  grade: number | null
}

export interface TeacherProfileRecord {
  userId: string
  subject: string | null
  qualification: string | null
  experienceYears: number
}

export interface TeacherProfilePatch {
  subject?: string | null
  qualification?: string | null
  experienceYears?: number
}

const toClass = (r: {
  id: bigint
  kind: string
  teacherId: bigint | null
  schoolId: bigint | null
  subjectId: bigint | null
  educationLevelId: bigint
  name: string
  academicYear: number
  description: string | null
  joinCode: string | null
  isActive: boolean
  createdAt: Date
}): ClassRecord => ({
  id: idToString(r.id),
  kind: r.kind as ClassroomKind,
  teacherId: r.teacherId === null ? null : idToString(r.teacherId),
  schoolId: r.schoolId === null ? null : idToString(r.schoolId),
  subjectId: r.subjectId === null ? null : idToString(r.subjectId),
  educationLevelId: idToString(r.educationLevelId),
  name: r.name,
  academicYear: r.academicYear,
  description: r.description,
  joinCode: r.joinCode,
  isActive: r.isActive,
  createdAt: r.createdAt,
})

const toEnrolment = (r: {
  classroomId: bigint
  studentId: bigint
  status: string
  source: string
  joinedAt: Date
}): EnrolmentRecord => ({
  classroomId: idToString(r.classroomId),
  studentId: idToString(r.studentId),
  status: r.status as EnrolmentStatus,
  source: r.source as EnrolmentSource,
  joinedAt: r.joinedAt,
})

/** Newest first, ties by id (mock: createdAt desc, then classId asc). */
const NEWEST_FIRST: Prisma.ClassroomOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'asc' }]

/** A decimal-string id as bigint, or null when it is not a canonical id (an unknown id, never an error). */
const idOf = (id: string): bigint | null => (isIdString(id) ? idFromString(id) : null)
const idsOf = (ids: readonly string[]): bigint[] => [...new Set(ids)].flatMap((i) => (isIdString(i) ? [idFromString(i)] : []))

/** Ids per `IN (...)` list of the batch reads. */
const READ_CHUNK = 1000

function drawJoinCode(): string {
  let code = ''
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)]
  return code
}

/**
 * The only doorway to `classrooms`, `enrolments` and `teacher_profiles` (ADR-0014). Other cards call
 * `forTeacher`, `forStudent`, `roster`, `schoolClasses`, `findByJoinCode`, `memberIds` and `enrol`; they never
 * query these tables. Scope is applied by the caller's choice of method (a teacher id, a school id, a student
 * id): the service resolves those from the session and never from the request. Ids are decimal strings.
 *
 * Every method uses `prisma.client`, so it joins the transaction a service opened with `prisma.transaction(...)`.
 * Rows of Mod Pelajar (`enrolments.is_test`) are left out of every roster, count and member list.
 *
 * The lookups at the end read `users`, `schools`, `subjects` and `education_levels` for display names (the card
 * lists them as read tables); they never write.
 */
@Injectable()
export class ClassesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- classes ----------------------------------------------------------------------------------

  /** One class (any kind) or null; a malformed id is "not found". */
  async get(id: string): Promise<ClassRecord | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.classroom.findUnique({ where: { id: key } })
    return row ? toClass(row) : null
  }

  /** Every class (any kind) of a secondary level, newest first (Darjah classes are hidden, D72). Read accessor for reports (BE-19). */
  async all(): Promise<ClassRecord[]> {
    const rows = await this.db.classroom.findMany({ where: { educationLevelId: { notIn: await this.primaryLevelIds() } }, orderBy: NEWEST_FIRST })
    return rows.map(toClass)
  }

  /** Alias of `get` under the name BE-19 uses. */
  async byId(id: string): Promise<ClassRecord | null> {
    return this.get(id)
  }

  /** Classes by id with `levelSlug`, `teacherName` and `studentCount` (BE-19 report labels); unknown ids are absent from the map, and so is a Darjah (primary-level) class (secondary-only, D72). */
  async labels(ids: readonly string[]): Promise<Map<string, ClassLabel>> {
    const keys = idsOf(ids)
    const rows = keys.length === 0 ? [] : await this.db.classroom.findMany({ where: { id: { in: keys }, educationLevelId: { notIn: await this.primaryLevelIds() } } })
    const records = rows.map(toClass)
    const [levels, teachers, counts] = await Promise.all([
      this.levelGrades([...new Set(records.map((r) => r.educationLevelId))]),
      this.userNames(records.map((r) => r.teacherId)),
      this.memberCounts(records.map((r) => r.id)),
    ])
    return new Map(
      records.map((r): [string, ClassLabel] => [
        r.id,
        {
          ...r,
          levelSlug: slugOfGrade(levels.get(r.educationLevelId)?.grade),
          teacherName: r.teacherId ? (teachers.get(r.teacherId) ?? null) : null,
          studentCount: counts.get(r.id) ?? 0,
        },
      ]),
    )
  }

  /** Ids of the primary-stage education levels: their classes are hidden (secondary-only, 2026-10-29). */
  private async primaryLevelIds(): Promise<bigint[]> {
    return (await this.db.educationLevel.findMany({ where: { stage: 'primary' }, select: { id: true } })).map((l) => l.id)
  }

  /** The classes a teacher owns (active and inactive), newest first. */
  async forTeacher(teacherId: string): Promise<ClassRecord[]> {
    const key = idOf(teacherId)
    if (key === null) return []
    const rows = await this.db.classroom.findMany({ where: { teacherId: key, educationLevelId: { notIn: await this.primaryLevelIds() } }, orderBy: NEWEST_FIRST })
    return rows.map(toClass)
  }

  /** The classes of a school (a school admin's list), newest first. */
  async schoolClasses(schoolId: string): Promise<ClassRecord[]> {
    const key = idOf(schoolId)
    if (key === null) return []
    const rows = await this.db.classroom.findMany({ where: { schoolId: key, educationLevelId: { notIn: await this.primaryLevelIds() } }, orderBy: NEWEST_FIRST })
    return rows.map(toClass)
  }

  /** The classes a student is actively enrolled in, newest first. `isTest` selects the Mod Pelajar rows instead of the real ones. */
  async forStudent(studentId: string, opts: { isTest?: boolean } = {}): Promise<ClassRecord[]> {
    const key = idOf(studentId)
    if (key === null) return []
    const rows = await this.db.classroom.findMany({
      where: { enrolments: { some: { studentId: key, status: 'active', isTest: opts.isTest ?? false } } },
      orderBy: NEWEST_FIRST,
    })
    return rows.map(toClass)
  }

  /** BR-M10-02: the teacher class with this join code, trimmed and compared ignoring case. */
  async findByJoinCode(code: string): Promise<ClassRecord | null> {
    const wanted = code.trim().toUpperCase()
    if (wanted === '') return null
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM classrooms WHERE kind = 'classroom' AND upper(join_code) = ${wanted} LIMIT 1`
    const first = rows[0]
    return first ? this.get(idToString(first.id)) : null
  }

  /**
   * Creates a teacher class with a fresh unique join code. The insert is `ON CONFLICT DO NOTHING`, so a code
   * collision (or a race on the case-insensitive unique index) draws a new code instead of aborting a surrounding
   * transaction.
   */
  async createClass(input: NewClass): Promise<ClassRecord> {
    for (let attempt = 0; attempt < JOIN_CODE_ATTEMPTS; attempt++) {
      const joinCode = drawJoinCode()
      const rows = await this.db.$queryRaw<{ id: bigint }[]>`
        INSERT INTO classrooms (kind, name, teacher_id, school_id, subject_id, education_level_id, academic_year, description, join_code, is_active, created_at, updated_at)
        VALUES ('classroom', ${input.name}, ${idFromString(input.teacherId)}, ${input.schoolId === null ? null : idFromString(input.schoolId)},
                ${input.subjectId === null ? null : idFromString(input.subjectId)}, ${idFromString(input.educationLevelId)}, ${input.academicYear},
                ${input.description}, ${joinCode}, true, ${input.now}, ${input.now})
        ON CONFLICT DO NOTHING
        RETURNING id`
      const first = rows[0]
      if (first) {
        const row = await this.db.classroom.findUniqueOrThrow({ where: { id: first.id } })
        return toClass(row)
      }
    }
    throw new Error('classes: no free join code after several draws')
  }

  /**
   * Number of active, real (not Mod Pelajar) enrolments per class id, for pupils whose account is active (SW7-06: a
   * deactivated pupil keeps the enrolment row, so reactivating brings them back, but is not counted); a class without
   * members is 0. Secondary-only (D72): a hidden Darjah pupil (`VISIBLE_USER_SQL`) is not counted.
   */
  async memberCounts(classIds: readonly string[]): Promise<Map<string, number>> {
    const keys = idsOf(classIds)
    const out = new Map<string, number>(classIds.map((id) => [id, 0]))
    for (let i = 0; i < keys.length; i += READ_CHUNK) {
      const groups = await this.db.$queryRaw<{ classroom_id: bigint; n: number }[]>`
        SELECT e.classroom_id, count(*)::int AS n
          FROM enrolments e JOIN users u ON u.id = e.student_id
         WHERE e.classroom_id = ANY(${keys.slice(i, i + READ_CHUNK)}::bigint[]) AND e.status = 'active' AND e.is_test = false AND u.is_active
           AND ${VISIBLE_USER_SQL}
         GROUP BY e.classroom_id`
      for (const g of groups) out.set(idToString(g.classroom_id), g.n)
    }
    return out
  }

  /** Classes by id in chunked single queries (BE-19 batch read); unknown and malformed ids are skipped. Newest first. */
  async byIds(ids: readonly string[]): Promise<ClassRecord[]> {
    const keys = idsOf(ids)
    const out: ClassRecord[] = []
    for (let i = 0; i < keys.length; i += READ_CHUNK) {
      const rows = await this.db.classroom.findMany({ where: { id: { in: keys.slice(i, i + READ_CHUNK) } }, orderBy: NEWEST_FIRST })
      out.push(...rows.map(toClass))
    }
    return out
  }

  /**
   * Active, real member ids per class id, ACTIVE accounts only (SW7-06: a deactivated pupil keeps the row but is not a
   * member for reports and games); student id ascending; every asked class is present, with [] when empty. One query per 1000 classes.
   */
  async memberIdsOf(classIds: readonly string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>(classIds.map((id) => [id, []]))
    const keys = idsOf(classIds)
    for (let i = 0; i < keys.length; i += READ_CHUNK) {
      const rows = await this.db.$queryRaw<{ classroom_id: bigint; student_id: bigint }[]>`
        SELECT e.classroom_id, e.student_id
          FROM enrolments e JOIN users u ON u.id = e.student_id
         WHERE e.classroom_id = ANY(${keys.slice(i, i + READ_CHUNK)}::bigint[]) AND e.status = 'active' AND e.is_test = false AND u.is_active
           AND ${VISIBLE_USER_SQL}
         ORDER BY e.classroom_id, e.student_id`
      for (const r of rows) out.get(idToString(r.classroom_id))?.push(idToString(r.student_id))
    }
    return out
  }

  /** Class ids (ascending) of each student's active, real enrolments; every asked student is present, with [] when none. One query per 1000 students. */
  async classIdsOfStudents(studentIds: readonly string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>(studentIds.map((id) => [id, []]))
    const keys = idsOf(studentIds)
    for (let i = 0; i < keys.length; i += READ_CHUNK) {
      const rows = await this.db.enrolment.findMany({
        where: { studentId: { in: keys.slice(i, i + READ_CHUNK) }, status: 'active', isTest: false },
        select: { classroomId: true, studentId: true },
        orderBy: [{ studentId: 'asc' }, { classroomId: 'asc' }],
      })
      for (const r of rows) out.get(idToString(r.studentId))?.push(idToString(r.classroomId))
    }
    return out
  }

  /** True when the student, with an ACTIVE account (SW7-06), is an active, real member of an ACTIVE class owned by the teacher (one query). */
  async isMemberOfTeacher(teacherId: string, studentId: string): Promise<boolean> {
    const t = idOf(teacherId)
    const s = idOf(studentId)
    if (t === null || s === null) return false
    const rows = await this.db.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok
        FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id JOIN users u ON u.id = e.student_id
       WHERE e.student_id = ${s} AND e.status = 'active' AND e.is_test = false AND c.teacher_id = ${t} AND c.is_active AND u.is_active
       LIMIT 1`
    return rows.length > 0
  }

  // --- enrolments -------------------------------------------------------------------------------

  /** Active enrolment rows of a class, student id ascending, whatever the state of the pupil's account (enrolment management). */
  async roster(classroomId: string): Promise<EnrolmentRecord[]> {
    const key = idOf(classroomId)
    if (key === null) return []
    const rows = await this.db.enrolment.findMany({
      where: { classroomId: key, status: 'active', isTest: false },
      orderBy: { studentId: 'asc' },
    })
    return rows.map(toEnrolment)
  }

  /**
   * Student ids actively enrolled in a class, ascending by number, ACTIVE accounts only (SW7-06). The member list of
   * class reports; `roster` stays the raw enrolment rows.
   */
  async memberIds(classroomId: string): Promise<string[]> {
    const key = idOf(classroomId)
    if (key === null) return []
    const rows = await this.db.$queryRaw<{ student_id: bigint }[]>`
      SELECT e.student_id
        FROM enrolments e JOIN users u ON u.id = e.student_id
       WHERE e.classroom_id = ${key} AND e.status = 'active' AND e.is_test = false AND u.is_active AND ${VISIBLE_USER_SQL}
       ORDER BY e.student_id`
    return rows.map((r) => idToString(r.student_id))
  }

  /** True when the student is an active member of the class (a Mod Pelajar row does not count unless `isTest`). */
  async isMember(classroomId: string, studentId: string, isTest = false): Promise<boolean> {
    const c = idOf(classroomId)
    const s = idOf(studentId)
    if (c === null || s === null) return false
    return (await this.db.enrolment.count({ where: { classroomId: c, studentId: s, status: 'active', isTest } })) > 0
  }

  /**
   * BR-M10-04: distinct ACTIVE-account students actively enrolled in any ACTIVE class the teacher owns, id ascending (SW7-06).
   * Secondary-only (D72): a hidden Darjah pupil (`VISIBLE_USER_SQL`) is left out, so every reader of the teacher's pupil set
   * (dashboard, roster, remedial, reports) agrees with the class cards (`memberCounts`).
   */
  async teacherStudentIds(teacherId: string): Promise<string[]> {
    const key = idOf(teacherId)
    if (key === null) return []
    const rows = await this.db.$queryRaw<{ student_id: bigint }[]>`
      SELECT DISTINCT e.student_id
        FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id JOIN users u ON u.id = e.student_id
       WHERE e.status = 'active' AND e.is_test = false AND c.teacher_id = ${key} AND c.is_active AND u.is_active AND ${VISIBLE_USER_SQL}
       ORDER BY e.student_id`
    return rows.map((r) => idToString(r.student_id))
  }

  /**
   * The teacher's active classes per ACTIVE-account student (the "Pelajar Saya" chips), in class creation order (newest
   * first; SW7-06: a deactivated pupil is left out; D72: so is a hidden Darjah pupil). One query; the id travels with the name because class names are not
   * unique (SW5-03).
   */
  async classesByStudent(teacherId: string): Promise<Map<string, { id: string; name: string }[]>> {
    const key = idOf(teacherId)
    const out = new Map<string, { id: string; name: string }[]>()
    if (key === null) return out
    const rows = await this.db.$queryRaw<{ student_id: bigint; class_id: bigint; name: string; created_at: Date }[]>`
      SELECT e.student_id, c.id AS class_id, c.name, c.created_at
        FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id JOIN users u ON u.id = e.student_id
       WHERE e.status = 'active' AND e.is_test = false AND c.teacher_id = ${key} AND c.is_active AND u.is_active AND ${VISIBLE_USER_SQL}`
    rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || Number(a.class_id - b.class_id))
    for (const r of rows) {
      const id = idToString(r.student_id)
      const entry = { id: idToString(r.class_id), name: r.name }
      const list = out.get(id)
      if (list) list.push(entry)
      else out.set(id, [entry])
    }
    return out
  }

  /**
   * Adds the student to the class, or reactivates a removed row. An active member is left as it is and the
   * outcome says so, so the caller answers 409. Two parallel calls end in one row (unique pair).
   */
  async enrol(input: EnrolInput): Promise<{ outcome: EnrolOutcome; enrolment: EnrolmentRecord }> {
    const classroomId = idFromString(input.classroomId)
    const studentId = idFromString(input.studentId)
    const existing = await this.db.enrolment.findUnique({ where: { classroomId_studentId: { classroomId, studentId } } })
    if (existing?.status === 'active') return { outcome: 'already', enrolment: toEnrolment(existing) }
    if (existing) {
      const row = await this.db.enrolment.update({
        where: { id: existing.id },
        data: { status: 'active', source: input.source, joinedAt: input.now, isTest: input.isTest ?? false, updatedAt: input.now },
      })
      return { outcome: 'reactivated', enrolment: toEnrolment(row) }
    }
    // ON CONFLICT DO NOTHING: a parallel insert of the same pair neither throws nor aborts a surrounding transaction.
    const res = await this.db.enrolment.createMany({
      data: [
        {
          classroomId,
          studentId,
          status: 'active',
          source: input.source,
          joinedAt: input.now,
          isTest: input.isTest ?? false,
          createdAt: input.now,
          updatedAt: input.now,
        },
      ],
      skipDuplicates: true,
    })
    const row = await this.db.enrolment.findUniqueOrThrow({ where: { classroomId_studentId: { classroomId, studentId } } })
    return { outcome: res.count === 1 ? 'created' : 'already', enrolment: toEnrolment(row) }
  }

  /** Enrols new students (complimentary register, one transaction): rows that exist already are skipped. Returns the number added. */
  async enrolMany(classroomId: string, studentIds: readonly string[], source: EnrolmentSource, now: Date): Promise<number> {
    const classKey = idFromString(classroomId)
    const keys = idsOf(studentIds)
    if (keys.length === 0) return 0
    const res = await this.db.enrolment.createMany({
      data: keys.map((studentId) => ({ classroomId: classKey, studentId, status: 'active', source, joinedAt: now, createdAt: now, updatedAt: now })),
      skipDuplicates: true,
    })
    return res.count
  }

  /** Marks an active enrolment as removed (the row stays for history). False when the student is not an active member. */
  async unenrol(classroomId: string, studentId: string, now: Date): Promise<boolean> {
    const c = idOf(classroomId)
    const s = idOf(studentId)
    if (c === null || s === null) return false
    const res = await this.db.enrolment.updateMany({
      where: { classroomId: c, studentId: s, status: 'active', isTest: false },
      data: { status: 'removed', updatedAt: now },
    })
    return res.count > 0
  }

  /** Every enrolment of the given students in teacher classes, for the complimentary views (any status, real rows only). */
  async enrolmentsOfStudents(studentIds: readonly string[]): Promise<{ studentId: string; status: EnrolmentStatus; classroom: ClassRecord }[]> {
    const keys = idsOf(studentIds)
    if (keys.length === 0) return []
    const rows = await this.db.enrolment.findMany({
      where: { studentId: { in: keys }, isTest: false, classroom: { kind: 'classroom' } },
      include: { classroom: true },
      orderBy: [{ classroomId: 'asc' }],
    })
    return rows.map((r) => ({ studentId: idToString(r.studentId), status: r.status as EnrolmentStatus, classroom: toClass(r.classroom) }))
  }

  // --- teacher profile --------------------------------------------------------------------------

  async teacherProfile(userId: string): Promise<TeacherProfileRecord | null> {
    const key = idOf(userId)
    if (key === null) return null
    const row = await this.db.teacherProfile.findUnique({ where: { userId: key } })
    return row ? { userId, subject: row.subject, qualification: row.qualification, experienceYears: row.experienceYears } : null
  }

  /** Creates the profile on first save or updates the given fields. */
  async saveTeacherProfile(userId: string, patch: TeacherProfilePatch, now: Date): Promise<TeacherProfileRecord> {
    const key = idFromString(userId)
    const row = await this.db.teacherProfile.upsert({
      where: { userId: key },
      create: { userId: key, ...patch, createdAt: now, updatedAt: now },
      update: { ...patch, updatedAt: now },
    })
    return { userId, subject: row.subject, qualification: row.qualification, experienceYears: row.experienceYears }
  }

  // --- read-only lookups of other owners' tables (names for the views, student rows for the roster) ----

  async subjectNames(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const keys = idsOf(ids.filter((i): i is string => i !== null))
    if (keys.length === 0) return new Map()
    const rows = await this.db.subject.findMany({ where: { id: { in: keys } }, select: { id: true, name: true } })
    return new Map(rows.map((r) => [idToString(r.id), r.name]))
  }

  async schoolNames(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const keys = idsOf(ids.filter((i): i is string => i !== null))
    if (keys.length === 0) return new Map()
    const rows = await this.db.school.findMany({ where: { id: { in: keys } }, select: { id: true, name: true } })
    return new Map(rows.map((r) => [idToString(r.id), r.name]))
  }

  async userNames(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const keys = idsOf(ids.filter((i): i is string => i !== null))
    if (keys.length === 0) return new Map()
    const rows = await this.db.user.findMany({ where: { id: { in: keys } }, select: { id: true, name: true } })
    return new Map(rows.map((r) => [idToString(r.id), r.name]))
  }

  /** `grade` and display facts of M03 levels by id. */
  async levelGrades(ids: readonly string[]): Promise<Map<string, { grade: number | null; code: string }>> {
    const keys = idsOf(ids)
    if (keys.length === 0) return new Map()
    const rows = await this.db.educationLevel.findMany({ where: { id: { in: keys } }, select: { id: true, grade: true, code: true } })
    return new Map(rows.map((r) => [idToString(r.id), { grade: r.grade, code: r.code }]))
  }

  /** An active subject by id, or null (the class form accepts only active subjects). */
  async activeSubjectExists(id: string): Promise<boolean> {
    const key = idOf(id)
    if (key === null) return false
    return (await this.db.subject.count({ where: { id: key, isActive: true } })) > 0
  }

  async schoolExists(id: string): Promise<boolean> {
    const key = idOf(id)
    if (key === null) return false
    return (await this.db.school.count({ where: { id: key } })) > 0
  }

  /** The user as the roster rules need it: an ACTIVE student account, its school and state; null for any other user (inactive included). */
  async studentFacts(id: string): Promise<{ id: string; name: string; schoolId: string | null } | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.user.findFirst({
      where: { id: key, isActive: true, roles: { some: { role: 'student' } } },
      select: { id: true, name: true, schoolId: true },
    })
    return row ? { id: idToString(row.id), name: row.name, schoolId: row.schoolId === null ? null : idToString(row.schoolId) } : null
  }

  /** Students by id with their grade (pupils of "Pelajar Saya" / mine), name A to Z then id. Secondary-only (D72): a hidden Darjah pupil is left out. */
  async studentLines(ids: readonly string[], term: string): Promise<StudentLine[]> {
    const keys = idsOf(ids)
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ id: bigint; name: string; grade: number | null }[]>`
      SELECT u.id, u.name, u.grade
        FROM users u
       WHERE u.id = ANY(${keys}::bigint[]) AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')
         AND ${VISIBLE_USER_SQL} ${nameFilter(term)}
       ORDER BY u.name ASC, u.id ASC`
    return rows.map((r) => ({ id: idToString(r.id), name: r.name, grade: r.grade }))
  }

  /**
   * Active students of one school matching the name filter, name A to Z then id: the page (capped) and the total before the cap.
   * Secondary-only (D72): a hidden Darjah pupil is neither listed nor counted.
   */
  async schoolStudentLines(schoolId: string, term: string, limit: number): Promise<{ rows: StudentLine[]; total: number }> {
    const key = idOf(schoolId)
    if (key === null) return { rows: [], total: 0 }
    const where = Prisma.sql`u.school_id = ${key} AND u.is_active AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')
         AND ${VISIBLE_USER_SQL} ${nameFilter(term)}`
    const [rows, totals] = await Promise.all([
      this.db.$queryRaw<{ id: bigint; name: string; grade: number | null }[]>`
        SELECT u.id, u.name, u.grade FROM users u WHERE ${where} ORDER BY u.name ASC, u.id ASC LIMIT ${limit}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM users u WHERE ${where}`,
    ])
    return { rows: rows.map((r) => ({ id: idToString(r.id), name: r.name, grade: r.grade })), total: totals[0]?.n ?? 0 }
  }
}

/** Case-insensitive "name contains" with LIKE wildcards neutralised (backslash escape); an empty term matches everything. */
function nameFilter(term: string): Prisma.Sql {
  const t = term.trim()
  if (t === '') return Prisma.empty
  return Prisma.sql`AND u.name ILIKE ${`%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`
}
