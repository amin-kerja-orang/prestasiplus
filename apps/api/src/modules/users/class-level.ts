import { SCHOOL_CLASS_LEVELS } from '@pp/contract'

type ClassLevel = (typeof SCHOOL_CLASS_LEVELS)[number]

/** Grade 1..6 is D1..D6 (primary), 7..11 is T1..T5 (secondary), as the mock `gradeOfClassLevel`. */
export function classLevelOfGrade(grade: number | null): ClassLevel | null {
  if (grade === null) return null
  if (grade >= 1 && grade <= 6) return `D${String(grade)}` as ClassLevel
  if (grade >= 7 && grade <= 11) return `T${String(grade - 6)}` as ClassLevel
  return null
}

/** Inverse of `classLevelOfGrade`; null for anything that is not a class level. */
export function gradeOfClassLevel(level: string): number | null {
  const m = /^([DT])([1-6])$/.exec(level)
  if (!m) return null
  const n = Number(m[2])
  if (m[1] === 'D') return n
  return n <= 5 ? n + 6 : null
}
