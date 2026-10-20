import { CLASS_EDUCATION_LEVELS } from '@pp/contract'

type Slug = (typeof CLASS_EDUCATION_LEVELS)[number]

/** BR-M10-03: the slug of an M03 level grade (1 to 6 is `tahun-n`, 7 to 11 is `tingkatan-(n - 6)`); null for any other grade. */
export function slugOfGrade(grade: number | null | undefined): Slug | null {
  if (grade === null || grade === undefined || !Number.isInteger(grade) || grade < 1 || grade > 11) return null
  return (grade <= 6 ? `tahun-${grade}` : `tingkatan-${grade - 6}`) as Slug
}

/** The M03 grade of a slug (inverse of `slugOfGrade`). */
export function gradeOfSlug(slug: string): number | null {
  const m = /^(tahun|tingkatan)-(\d)$/.exec(slug)
  if (!m) return null
  const n = Number(m[2])
  const grade = m[1] === 'tahun' ? n : n + 6
  return (CLASS_EDUCATION_LEVELS as readonly string[]).includes(slug) ? grade : null
}

/** FR-M10-29: "Tahun n" or "Ting. n". */
export function levelLabelOfGrade(grade: number): string {
  return grade <= 6 ? `Tahun ${grade}` : `Ting. ${grade - 6}`
}
