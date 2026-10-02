/**
 * The `classrooms` repository (owner **M10**; D12, overview §6.7; SRS M10 v1.18 §6.2, §6.3):
 * classes keyed by (`kind`, `id`) and their enrolments keyed by (`classroomKind`, `classroomId`,
 * `studentId`). School class 419 and classroom 419 are different records (XL2-24, XL2-44); a bare
 * class id never identifies a class.
 *
 * Contract (M10 SRS v1.15 §7 repositories; F-30):
 * - reads: `get(kind, id)`, `list(filter)`, `forStudent(userId)`, `forTeacher(teacherId)`,
 *   `forSchool(schoolId)` (`ClassroomRef` views of M02 / M08 are these rows), `members(kind, id)`
 *   (active enrolments), `memberIds`, `memberCount`, `enrolmentsOf(studentId)`,
 *   `teacherStudentIds(teacherId)` (BR-M10-04), `findByJoinCode(code)`, `levelSummary(level)`
 *   (M08 level cards: classes and distinct students), `owners()`, `designation()`;
 * - writes (M10 S5 / S6 / S33; runtime class ids ≥ 9,000,001): `create`, `enrol`, `unenrol`.
 *
 * The class and enrolment rows are a pure function of the M01 users repository (owners, members),
 * so they are built in `finalise` by `compile()`; a read before that compiles them lazily (the
 * M05 finalise may read classes before the M10 finalise runs). `compile()` is owner-only.
 */

import { toIsoMyt } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { fnv1a32 } from '@/mock/determinism/hash'

import { buildClasses, type Designation } from '../build/classes'
import { checkClassBuild } from '../build/check'
import { loadPeople } from '../build/people'
import {
  ACADEMIC_YEAR,
  CLASSES_T4,
  CLASSES_T5,
  CLASSES_TOTAL,
  CLASSROOMS_TOTAL,
  CLASS_RUNTIME_FLOOR,
  LEVEL_SLUGS,
  classKey,
  enrolmentKey,
  levelIdOf,
} from '../data/spec'
import { classroomsTable, enrolmentsTable } from '../tables/tables'
import type {
  ClassroomKind,
  ClassroomRow,
  EducationLevelSlug,
  EnrolmentRow,
  EnrolmentSource,
} from './types'

/** Level cards of M08 S2 / S3: classes and distinct actively enrolled students. */
export interface LevelSummary {
  level: EducationLevelSlug
  classes: number
  students: number
  memberships: number
}

export interface ClassFilter {
  kind?: ClassroomKind
  teacherId?: number
  schoolId?: number
  educationLevel?: EducationLevelSlug
  subjectId?: number | null
  isActive?: boolean
}

export interface ClassInput {
  name: string
  teacherId: number
  schoolId?: number | null
  subjectId?: number | null
  educationLevel: EducationLevelSlug
  description?: string | null
  joinCode?: string
}

export interface EnrolInput {
  kind: ClassroomKind
  classId: number
  studentId: number
  source: EnrolmentSource
}

export const classQueries = defineNamedQueries(classroomsTable, {
  // Every record: classrooms + the 2 school classes.
  'CL-ALL': { expected: CLASSES_TOTAL, source: 'M10 §6.2.1 A (750 classrooms + 2 school classes)' },
  // M08 S1 "750 kelas", S10 750 cards, S11 750 chips, M18 S24: classrooms only.
  'CL-CLASSROOM': {
    where: { kind: 'classroom' as const },
    expected: CLASSROOMS_TOTAL,
    source: 'M10 §6.2.1 A (M08 S1 / S10 / S11, M18 S24)',
  },
  'CL-LEVEL': {
    where: (educationLevel: EducationLevelSlug) => ({ educationLevel }),
    expected: [
      { args: ['tingkatan-4'], value: CLASSES_T4 },
      { args: ['tingkatan-5'], value: CLASSES_T5 },
    ],
    source: 'M10 §6.2.1 A (M08 S2: T4 13, T5 645)',
  },
  'CL-KIND': {
    where: (kind: ClassroomKind) => ({ kind }),
    expected: [{ args: ['school_class'], value: 2 }],
    source: 'M10 §6.2.1 A (sc-419, sc-806)',
  },
  'CL-TEACHER': {
    where: (teacherId: number) => ({ teacherId }),
    source: 'M10 BR-M10-01 (own classes)',
  },
  'CL-SCHOOL': {
    where: (schoolId: number) => ({ schoolId }),
    source: 'M02 / M18 (classes of a school)',
  },
})

let compiled = false
let designation: Designation | null = null

export const classroomsRepo = defineRepository({
  owner: 'M10',
  name: 'classrooms',
  store: classroomsTable,
  stores: { enrolments: enrolmentsTable },
  queries: classQueries,
  methods: ({ store, stores, transaction, phase }) => {
    const enrolments = stores.enrolments
    const keyOf = classKey

    function compile(): void {
      if (compiled) return
      if (phase() === 'live') {
        throw new Error(
          'M10 classrooms: not compiled before the baseline (the M10 finalise compiles them)',
        )
      }
      const built = buildClasses(loadPeople())
      const now = Date.parse('2026-09-20T00:00:00+08:00')
      const rows: EnrolmentRow[] = []
      for (const c of built.classes) {
        const created = Date.parse(c.row.createdAt)
        c.members.forEach((studentId) => {
          const at = Math.min(
            created +
              (1 + (fnv1a32(`m10:joined:${c.row.id}:${String(studentId)}`) % 20)) * 86_400_000,
            now,
          )
          const code = fnv1a32(`m10:source:${c.row.id}:${String(studentId)}`) % 10 < 4
          rows.push({
            id: enrolmentKey(c.row.kind, c.row.classId, studentId),
            classroomKind: c.row.kind,
            classroomId: c.row.classId,
            classKey: c.row.id,
            studentId,
            status: 'active',
            source: c.source ?? (code ? 'code' : 'teacher'),
            joinedAt: toIsoMyt(at),
            educationLevel: c.row.educationLevel,
            levelId: c.row.levelId,
          })
        })
      }
      const issues = checkClassBuild(
        built.classes.map((c) => c.row),
        rows,
      )
      if (issues.length > 0) {
        throw new Error(`M10 class build check failed:\n${issues.map((m) => `- ${m}`).join('\n')}`)
      }
      transaction(() => {
        for (const c of built.classes) store.insert(c.row)
        for (const r of rows) enrolments.insert(r)
      })
      designation = built.designation
      compiled = true
    }

    /** Reads before the M10 plugin is booted (a boot without it) see empty stores. */
    const ensure = () => {
      if (!compiled && phase() !== null) compile()
    }

    const activeOf = (classKeyValue: string): EnrolmentRow[] =>
      enrolments.query({ where: { classKey: classKeyValue, status: 'active' } }).rows

    return {
      /** Seed phase: forgets the compiled state (every boot and every `mock.reset()`). */
      resetCompiled(): void {
        compiled = false
        designation = null
      },
      /** Finalise phase (owner only): builds the classes and enrolments from the users store. */
      compile,
      compiled: (): boolean => compiled,

      get(kind: ClassroomKind, id: number): ClassroomRow | undefined {
        ensure()
        return store.get(keyOf(kind, id))
      },

      list(filter: ClassFilter = {}): ClassroomRow[] {
        ensure()
        const where: Record<string, unknown> = {}
        if (filter.kind !== undefined) where.kind = filter.kind
        if (filter.teacherId !== undefined) where.teacherId = filter.teacherId
        if (filter.schoolId !== undefined) where.schoolId = filter.schoolId
        if (filter.educationLevel !== undefined) where.educationLevel = filter.educationLevel
        if (filter.subjectId !== undefined) where.subjectId = filter.subjectId
        if (filter.isActive !== undefined) where.isActive = filter.isActive
        return store.query({ where }).rows
      },

      /** The viewer's own classes (BR-M10-01), newest first (M08 BR-M08-30). */
      forTeacher(teacherId: number): ClassroomRow[] {
        ensure()
        return store
          .query({ where: { teacherId } })
          .rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.classId - b.classId)
      },

      /** Classes whose school is `schoolId` (a school admin's classes; M18 / M17 drill-downs). */
      forSchool(schoolId: number): ClassroomRow[] {
        ensure()
        return store
          .query({ where: { schoolId } })
          .rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.classId - b.classId)
      },

      /** The classes a student is actively enrolled in ("Kelas Saya", S33). */
      forStudent(userId: number): ClassroomRow[] {
        ensure()
        const ids = enrolments.query({ where: { studentId: userId, status: 'active' } }).rows
        return store
          .getMany(ids.map((e) => e.classKey))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.classId - b.classId)
      },

      /** Active enrolments of a class (M10 #74 members, "{n} pelajar"). */
      members(kind: ClassroomKind, id: number): EnrolmentRow[] {
        ensure()
        return activeOf(keyOf(kind, id)).sort((a, b) => a.studentId - b.studentId)
      },

      memberIds(kind: ClassroomKind, id: number): number[] {
        ensure()
        return activeOf(keyOf(kind, id))
          .map((e) => e.studentId)
          .sort((a, b) => a - b)
      },

      memberCount(kind: ClassroomKind, id: number): number {
        ensure()
        return enrolments.count({ classKey: keyOf(kind, id), status: 'active' })
      },

      /** All enrolments of a student (any status), for the M02 user detail and M05 Q-SESS-CLASS. */
      enrolmentsOf(studentId: number): EnrolmentRow[] {
        ensure()
        return enrolments.query({ where: { studentId } }).rows
      },

      /** BR-M10-04: distinct students actively enrolled in any active class the teacher owns. */
      teacherStudentIds(teacherId: number): number[] {
        ensure()
        const own = store.query({ where: { teacherId, isActive: true } }).rows
        const ids = new Set<number>()
        for (const c of own) for (const e of activeOf(c.id)) ids.add(e.studentId)
        return [...ids].sort((a, b) => a - b)
      },

      /** BR-M10-02: case-insensitive, trimmed code lookup among classrooms. */
      findByJoinCode(code: string): ClassroomRow | undefined {
        ensure()
        const wanted = code.trim().toUpperCase()
        if (wanted === '') return undefined
        return store.query({
          where: { kind: 'classroom' },
          match: (c) => c.joinCode.toUpperCase() === wanted,
        }).rows[0]
      },

      /** M08 level cards: class count, distinct actively enrolled students, memberships. */
      levelSummary(level: EducationLevelSlug): LevelSummary {
        ensure()
        const rows = enrolments.query({ where: { educationLevel: level, status: 'active' } }).rows
        return {
          level,
          classes: store.count({ educationLevel: level }),
          students: new Set(rows.map((r) => r.studentId)).size,
          memberships: rows.length,
        }
      },

      levels(): EducationLevelSlug[] {
        return [...LEVEL_SLUGS]
      },

      /** Distinct owners of at least one class (M08 S1 "Prestasi Guru": 310). */
      owners(): number[] {
        ensure()
        const set = new Set<number>()
        for (const c of store.query({}).rows) if (c.teacherId !== null) set.add(c.teacherId)
        return [...set].sort((a, b) => a - b)
      },

      /**
       * What the build decided for the other modules (M05 sessions of the T4 holders H1–H4 and of
       * class 228, the 21 joiners that hold no session, the pupils in no class, the T5 non-members).
       */
      designation(): Designation {
        ensure()
        return designation as Designation
      },

      // --- writes (runtime; M10-T1 handlers validate) -----------------------------------------

      /** S5: a class created by a teacher; ids from 9,000,001 upward (never below). */
      create(input: ClassInput, now: number): ClassroomRow {
        ensure()
        const used = store.query({ where: { kind: 'classroom' } }).rows.map((c) => c.classId)
        const id = Math.max(CLASS_RUNTIME_FLOOR, ...used.map((n) => n + 1))
        const code =
          input.joinCode ??
          (() => {
            for (let salt = 0; ; salt++) {
              const h = fnv1a32(`m10:runtime-code:${String(id)}:${String(salt)}`)
              const c = h.toString(36).toUpperCase().padStart(6, '0').slice(-6)
              if (store.count({ joinCode: c }) === 0) return c
            }
          })()
        return transaction(() =>
          store.insert({
            id: keyOf('classroom', id),
            kind: 'classroom',
            classId: id,
            name: input.name,
            teacherId: input.teacherId,
            schoolId: input.schoolId ?? null,
            subjectId: input.subjectId ?? null,
            educationLevel: input.educationLevel,
            levelId: levelIdOf(input.educationLevel),
            academicYear: ACADEMIC_YEAR,
            description: input.description ?? null,
            joinCode: code,
            isActive: true,
            createdAt: toIsoMyt(now),
          }),
        )
      },

      /** S33 / S6 join: a new active enrolment (BR-M10-02); a `removed` one is reactivated. */
      enrol(input: EnrolInput, now: number): EnrolmentRow {
        ensure()
        const cls = store.get(keyOf(input.kind, input.classId))
        if (!cls)
          throw new Error(`M10 classrooms.enrol: no class ${keyOf(input.kind, input.classId)}`)
        const id = enrolmentKey(input.kind, input.classId, input.studentId)
        const prev = enrolments.get(id)
        return transaction(() =>
          prev
            ? enrolments.update(id, {
                status: 'active',
                source: input.source,
                joinedAt: toIsoMyt(now),
              })
            : enrolments.insert({
                id,
                classroomKind: input.kind,
                classroomId: input.classId,
                classKey: cls.id,
                studentId: input.studentId,
                status: 'active',
                source: input.source,
                joinedAt: toIsoMyt(now),
                educationLevel: cls.educationLevel,
                levelId: cls.levelId,
              }),
        )
      },

      /** Removes a student from a class (status `removed`; the row stays for history). */
      unenrol(kind: ClassroomKind, classId: number, studentId: number): void {
        ensure()
        const id = enrolmentKey(kind, classId, studentId)
        if (!enrolments.get(id)) return
        transaction(() => void enrolments.update(id, { status: 'removed' }))
      },
    }
  },
})

export type ClassroomsRepository = typeof classroomsRepo
