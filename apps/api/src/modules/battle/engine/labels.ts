/** "Darjah n" for grades 1 to 6, "Tingkatan n" for 7 to 11, "" otherwise (mock `gradeLabel`). */
export function gradeLabel(grade: number | null | undefined): string {
  if (grade === null || grade === undefined) return ''
  if (grade >= 1 && grade <= 6) return `Darjah ${String(grade)}`
  if (grade >= 7 && grade <= 11) return `Tingkatan ${String(grade - 6)}`
  return ''
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a uuid text; anything else is an unknown resource id (the not-found answer, never a database error). */
export const isUuid = (v: string): boolean => UUID.test(v)
