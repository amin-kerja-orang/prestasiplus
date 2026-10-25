/**
 * Class and subscription steps of `migrate:core`: classrooms, enrolments and school subscriptions
 * (v2-data-migration.md 4.8, 4.1). The level of a classroom has no .cloud column; it is derived (T-09)
 * from the class name or from its pupils, and a class that cannot be placed is rejected (INVALID_VALUE).
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../kit/runner'
import { assertSurrogateLegacyId } from '../kit/sql'
import type { LegacyRow } from '../kit/upsert'
import { dropConflicts } from './claim'
import type { CoreContext } from './context'
import { rejectRow, upsertAndMap } from './helpers'
import { distinctValues, readById, readPairTable, resolveFk, type StagedRow } from './source'
import { STAGING_SCHEMA } from '../ddl/spec'
import { enumKey } from '../transform/common'
import { SCHOOL_TYPE_MAP } from '../transform/enums'
import {
  deriveClassGrade,
  resolveClassLevel,
  enrolmentLegacyId,
  transformClassroom,
  transformEnrolment,
  withTeacherSchool,
  type ClassroomValues,
} from '../transform/classes'
import { transformSubscription } from '../transform/subscriptions'
import { gradeFromClassLabel } from '../transform/users'
import { squash } from '../transform/common'

const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:core')
  return id
}

const CLASSROOM_COLUMNS = [
  'kind', 'name', 'teacher_id', 'school_id', 'subject_id', 'education_level_id', 'academic_year', 'join_code', 'created_at', 'updated_at',
] as const

/** The grades of the pupils of each class in the batch (derived from class labels, like the user transform). */
async function pupilGrades(core: CoreContext, classroomIds: readonly string[]): Promise<Map<string, (number | null)[]>> {
  const out = new Map<string, (number | null)[]>()
  if (classroomIds.length === 0) return out
  const res = await core.pool.query<{ classroom_id: string; kelas: string | null; type: string | null }>(
    `SELECT cs.classroom_id::text AS classroom_id, u.kelas::text AS kelas, s.type::text AS type
     FROM "${STAGING_SCHEMA}"."classroom_student" cs
     JOIN "${STAGING_SCHEMA}"."users" u ON u.id = cs.student_id
     LEFT JOIN "${STAGING_SCHEMA}"."schools" s ON s.id = u.school_id
     WHERE cs.classroom_id = ANY($1::bigint[]) AND lower(btrim(u.role)) = 'pelajar'`,
    [classroomIds],
  )
  for (const r of res.rows) {
    const typeKey = enumKey(r.type)
    const grade = gradeFromClassLabel(squash(r.kelas), typeKey === null ? null : (SCHOOL_TYPE_MAP[typeKey] ?? null))
    const list = out.get(r.classroom_id) ?? []
    list.push(grade)
    out.set(r.classroom_id, list)
  }
  return out
}

/** grade -> v2 level id (the lowest id when several levels share a grade). */
async function levelsByGrade(ctx: BatchContext): Promise<Map<number, string>> {
  const res = await ctx.db.query<{ id: string; grade: number }>(
    `SELECT DISTINCT ON (grade) id::text AS id, grade FROM education_levels WHERE grade IS NOT NULL ORDER BY grade, id`,
  )
  return new Map(res.rows.map((r) => [r.grade, r.id]))
}

/** The level of the v2 row of each class that is already loaded (by its legacy key), for the classes that lost all their pupils. */
async function loadedLevels(ctx: BatchContext, legacyIds: readonly string[]): Promise<Map<string, string>> {
  if (legacyIds.length === 0) return new Map()
  const res = await ctx.db.query<{ legacy_id: string; education_level_id: string }>(
    `SELECT legacy_id, education_level_id::text AS education_level_id FROM classrooms
     WHERE legacy_source = $1 AND legacy_id = ANY($2::text[]) AND education_level_id IS NOT NULL`,
    [ctx.source, legacyIds],
  )
  return new Map(res.rows.map((r) => [r.legacy_id, r.education_level_id]))
}

/** The current v2 school of each given v2 user (users without a school are left out). The source of 0090's backfill (`users.school_id`). */
async function teacherSchools(ctx: BatchContext, teacherIds: readonly string[]): Promise<Map<string, string>> {
  if (teacherIds.length === 0) return new Map()
  const res = await ctx.db.query<{ id: string; school_id: string }>(
    `SELECT id::text AS id, school_id::text AS school_id FROM users WHERE id = ANY($1::bigint[]) AND school_id IS NOT NULL`,
    [teacherIds],
  )
  return new Map(res.rows.map((r) => [r.id, r.school_id]))
}

export function classroomsStep(core: CoreContext): AnyEntityStep {
  const entity = 'classrooms'
  return {
    entity,
    source: core.source,
    extract: (after) => readById(core.pool, 'classrooms', after, core.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const teachers = await ctx.idMap.resolveMany('users', distinctValues(rows, 'teacher_id'))
      const schools = await ctx.idMap.resolveMany('schools', distinctValues(rows, 'school_id'))
      const subjects = await ctx.idMap.resolveMany('subjects', distinctValues(rows, 'subject_id'))
      const grades = await pupilGrades(core, rows.map((r) => idOf(r)))
      const levels = await levelsByGrade(ctx)
      // Only the classes without any pupil in staging can keep their level, so look up the loaded rows for those alone.
      const loaded = await loadedLevels(ctx, rows.map((r) => idOf(r)).filter((id) => (grades.get(id) ?? []).length === 0))

      // SW7-01: one read for the teachers of the classes that have no source school (a source school that is set but not loaded is an
      // orphan and is rejected by the transform, so it never gets here).
      const teacherSchoolOf = await teacherSchools(ctx, [...new Set(
        rows.flatMap((r) => {
          const teacher = resolveFk(r.teacher_id, teachers)
          return resolveFk(r.school_id, schools) === null && teacher ? [teacher] : []
        }),
      )])

      const kept = new Set<string>()
      const fromTeacher = new Set<string>()
      let items: { legacyId: string; values: ClassroomValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const grade = deriveClassGrade(squash(row.name), grades.get(legacyId) ?? [])
        const level = resolveClassLevel({
          grade,
          pupilCount: (grades.get(legacyId) ?? []).length,
          levelByGrade: levels,
          loadedLevelId: loaded.get(legacyId),
        })
        const out = transformClassroom(row, {
          teacherId: resolveFk(row.teacher_id, teachers),
          schoolId: resolveFk(row.school_id, schools),
          subjectId: resolveFk(row.subject_id, subjects),
          levelId: level.levelId,
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else {
          const values = withTeacherSchool(out.value, out.value.teacher_id === null ? null : teacherSchoolOf.get(out.value.teacher_id))
          if (values !== out.value) fromTeacher.add(legacyId)
          items.push({ legacyId, values })
          if (level.kept) kept.add(legacyId)
        }
      }
      items = await dropConflicts(ctx.db, items, {
        entity, table: 'classrooms', column: 'code', expr: 'upper(join_code)', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.values.join_code?.toUpperCase() ?? null,
      })
      // Counted once the class survives the join-code check: it is written with its old level.
      const keptCount = items.filter((i) => kept.has(i.legacyId)).length
      if (keptCount > 0) core.notes.count('classrooms.level_kept_no_pupils', keptCount)
      const fromTeacherCount = items.filter((i) => fromTeacher.has(i.legacyId)).length
      if (fromTeacherCount > 0) core.notes.count('classrooms.school_from_teacher', fromTeacherCount)
      return upsertAndMap(ctx, entity, 'classrooms', CLASSROOM_COLUMNS, items.map((i) => ({
        legacyId: i.legacyId,
        values: i.values as unknown as Record<string, unknown>,
      })))
    },
  }
}

export function enrolmentsStep(core: CoreContext): AnyEntityStep {
  const entity = 'enrolments'
  return {
    entity,
    source: core.source,
    extract: (after) => readPairTable(core.pool, 'classroom_student', 'classroom_id', 'student_id', after, core.pageSize),
    keyOf: enrolmentLegacyId,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const classrooms = await ctx.idMap.resolveMany('classrooms', distinctValues(rows, 'classroom_id'))
      const students = await ctx.idMap.resolveMany('users', distinctValues(rows, 'student_id'))
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = enrolmentLegacyId(row)
        const out = transformEnrolment(row, {
          classroomId: resolveFk(row.classroom_id, classrooms) ?? undefined,
          studentId: resolveFk(row.student_id, students) ?? undefined,
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(
        ctx, entity, 'enrolments',
        ['classroom_id', 'student_id', 'status', 'source', 'joined_at', 'is_test', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}

export function subscriptionsStep(core: CoreContext): AnyEntityStep {
  const entity = 'school_subscriptions'
  return {
    entity,
    source: core.source,
    extract: (after) => readById(core.pool, 'school_subscriptions', after, core.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const schools = await ctx.idMap.resolveMany('schools', distinctValues(rows, 'school_id'))
      const types = new Map<string, string | null>()
      if (schools.size > 0) {
        const res = await ctx.db.query<{ id: string; type: string | null }>(
          `SELECT id::text AS id, type FROM schools WHERE id = ANY($1::bigint[])`,
          [[...schools.values()]],
        )
        for (const r of res.rows) types.set(r.id, r.type)
      }
      const packages = new Map(
        (await ctx.db.query<{ code: string; id: string }>(`SELECT code, id::text AS id FROM school_packages`)).rows.map((r) => [r.code, r.id]),
      )
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const schoolId = resolveFk(row.school_id, schools) ?? undefined
        const out = transformSubscription(row, {
          schoolId,
          schoolType: schoolId === undefined ? null : (types.get(schoolId) ?? null),
          packageIds: packages,
          asOf: core.options.asOf,
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(
        ctx, entity, 'school_subscriptions',
        ['school_id', 'school_package_id', 'package_tier', 'student_quota', 'status', 'starts_on', 'ends_on', 'created_at', 'updated_at'],
        items, { register: false },
      )
    },
  }
}
