/**
 * Class transforms (BE-28, v2-data-migration.md 4.8): classrooms, enrolments, parent links.
 * Pure; the loader resolves parent ids.
 */
import { firstYear, ok, pairId, reject, squash, stamps, text, type Outcome, type Staged } from './common'

// ---------------------------------------------------------------- classrooms

export interface ClassroomValues {
  kind: 'classroom' | 'school_class'
  name: string
  teacher_id: string | null
  school_id: string | null
  subject_id: string | null
  education_level_id: string
  academic_year: number
  join_code: string | null
  created_at: string
  updated_at: string
}

/** `undefined` = the source id is set but its parent was not loaded. */
export interface ClassroomParents {
  teacherId: string | null | undefined
  schoolId: string | null | undefined
  subjectId: string | null | undefined
  /** The v2 level id derived by `deriveClassGrade` + the level lookup; null when none could be derived. */
  levelId: string | null
}

/** A class is a teacher class when it has a teacher, otherwise a school class (to confirm, section 4.8). */
export function transformClassroom(row: Staged, parents: ClassroomParents): Outcome<ClassroomValues> {
  if (parents.teacherId === undefined) return reject('ORPHAN_PARENT', 'teacher_id')
  if (parents.schoolId === undefined) return reject('ORPHAN_PARENT', 'school_id')
  if (parents.subjectId === undefined) return reject('ORPHAN_PARENT', 'subject_id')
  const name = squash(row.name)
  if (name === null || name.length > 255) return reject('INVALID_VALUE', 'name')
  const year = firstYear(row.session_year)
  if (year === null || year < 2000 || year > 2100) return reject('INVALID_VALUE', 'session_year')
  if (parents.levelId === null) return reject('INVALID_VALUE', 'education_level_id')
  return ok({
    kind: parents.teacherId === null ? 'school_class' : 'classroom',
    name,
    teacher_id: parents.teacherId,
    school_id: parents.schoolId,
    subject_id: parents.subjectId,
    education_level_id: parents.levelId,
    academic_year: year,
    join_code: text(row.code),
    ...stamps(row),
  })
}

/**
 * SW7-01 (mirrors migration 0090): a teacher class (`kind = 'classroom'`) whose source has NO school takes its teacher's v2 school,
 * so the school admin can see it. A school class, a class that has its own school, or a teacher without a school is returned as is.
 * Pure; the loader reads the teacher's school.
 */
export function withTeacherSchool(values: ClassroomValues, teacherSchoolId: string | null | undefined): ClassroomValues {
  if (values.kind !== 'classroom' || values.school_id !== null || !teacherSchoolId) return values
  return { ...values, school_id: teacherSchoolId }
}

/**
 * The grade (1..11) of a class, T-09: an explicit `Darjah / Tahun / Tingkatan / Form N` in its name wins;
 * otherwise the most common grade of its pupils (derived from their class labels by the user transform);
 * a tie goes to the lower grade. Null when neither exists.
 */
export function deriveClassGrade(name: string | null, pupilGrades: readonly (number | null)[]): number | null {
  const primary = /\b(?:darjah|tahun)\s*(\d)\b/i.exec(name ?? '')
  if (primary && Number(primary[1]) >= 1 && Number(primary[1]) <= 6) return Number(primary[1])
  const secondary = /\b(?:tingkatan|form)\s*(\d)\b/i.exec(name ?? '')
  if (secondary && Number(secondary[1]) >= 1 && Number(secondary[1]) <= 5) return 6 + Number(secondary[1])
  const counts = new Map<number, number>()
  for (const g of pupilGrades) if (g !== null) counts.set(g, (counts.get(g) ?? 0) + 1)
  let best: number | null = null
  let bestN = 0
  for (const [g, n] of [...counts].sort(([a], [b]) => a - b)) {
    if (n > bestN) {
      best = g
      bestN = n
    }
  }
  return best
}

/**
 * The v2 level of a class (BE-28, v2-backend-deviations.md). The level follows the pupils in staging; the one exception is a
 * class that is already loaded and has NO pupils in staging any more (all deleted at the source, and no grade in its name):
 * it keeps the level of its v2 row (`kept: true`) instead of being rejected. A class that was never loaded, or whose pupils exist
 * but give no level, gets `levelId: null` (INVALID_VALUE education_level_id) as before.
 */
export function resolveClassLevel(input: {
  grade: number | null
  pupilCount: number
  levelByGrade: ReadonlyMap<number, string>
  loadedLevelId: string | null | undefined
}): { levelId: string | null; kept: boolean } {
  if (input.grade !== null) return { levelId: input.levelByGrade.get(input.grade) ?? null, kept: false }
  if (input.pupilCount === 0 && input.loadedLevelId) return { levelId: input.loadedLevelId, kept: true }
  return { levelId: null, kept: false }
}

// ---------------------------------------------------------------- enrolments

export interface EnrolmentValues {
  classroom_id: string
  student_id: string
  status: 'active'
  source: 'code'
  joined_at: string
  is_test: false
  created_at: string
  updated_at: string
}

export function enrolmentLegacyId(row: Staged): string {
  return pairId(row.classroom_id, row.student_id)
}

export function transformEnrolment(
  row: Staged,
  parents: { classroomId: string | null | undefined; studentId: string | null | undefined },
): Outcome<EnrolmentValues> {
  if (!parents.classroomId) return reject('ORPHAN_PARENT', 'classroom_id')
  if (!parents.studentId) return reject('ORPHAN_PARENT', 'student_id')
  const stamp = stamps(row)
  return ok({
    classroom_id: parents.classroomId,
    student_id: parents.studentId,
    // .cloud has no status / source on the pivot (4.8): every row is an active join by code.
    status: 'active',
    source: 'code',
    joined_at: stamp.created_at,
    is_test: false,
    ...stamp,
  })
}

// ---------------------------------------------------------------- parent links

export interface ParentLinkValues {
  parent_id: string
  student_id: string
  relationship: string | null
  created_at: string
  updated_at: string
}

export function parentLinkLegacyId(row: Staged): string {
  return pairId(row.parent_id, row.student_id)
}

export function transformParentLink(
  row: Staged,
  parents: { parentId: string | null | undefined; studentId: string | null | undefined },
): Outcome<ParentLinkValues> {
  if (!parents.parentId) return reject('ORPHAN_PARENT', 'parent_id')
  if (!parents.studentId) return reject('ORPHAN_PARENT', 'student_id')
  if (parents.parentId === parents.studentId) return reject('INVALID_VALUE', 'parent_id')
  const relationship = squash(row.relationship)
  if (relationship !== null && relationship.length > 50) return reject('INVALID_VALUE', 'relationship')
  return ok({ parent_id: parents.parentId, student_id: parents.studentId, relationship, ...stamps(row) })
}
