import type { TeacherClass } from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import { levelLabelOfGrade, slugOfGrade } from './level-slug'
import type { ClassRecord } from './classes.repository'

/** M03 grade of a level: its `grade` column, else the digit of a `D1` / `T4` style code (a level created later has no grade). */
export function gradeOfLevel(level: { grade: number | null; code: string } | undefined): number | null {
  if (!level) return null
  if (level.grade !== null) return level.grade
  const m = /^([DT])(\d)$/.exec(level.code)
  if (!m) return null
  const n = Number(m[2])
  return m[1] === 'D' ? n : n + 6
}

export interface ClassNames {
  subjectNames: Map<string, string>
  levels: Map<string, { grade: number | null; code: string }>
}

/** The `TeacherClass` of the contract, or null when the class level has no usable grade (it cannot be shown with a slug). */
export function toTeacherClass(c: ClassRecord, studentCount: number, names: ClassNames): TeacherClass | null {
  const grade = gradeOfLevel(names.levels.get(c.educationLevelId))
  const slug = slugOfGrade(grade)
  if (grade === null || slug === null) return null
  return {
    id: c.id,
    kind: c.kind,
    teacherId: c.teacherId,
    schoolId: c.schoolId,
    name: c.name,
    subjectId: c.subjectId,
    subjectName: c.subjectId === null ? null : (names.subjectNames.get(c.subjectId) ?? null),
    educationLevel: slug,
    levelId: c.educationLevelId,
    levelLabel: levelLabelOfGrade(grade),
    academicYear: c.academicYear,
    description: c.description,
    joinCode: c.joinCode ?? '',
    isActive: c.isActive,
    createdAt: toMytTimestamp(c.createdAt),
    studentCount,
  }
}
