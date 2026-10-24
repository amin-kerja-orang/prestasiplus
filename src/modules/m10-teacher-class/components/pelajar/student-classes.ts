/**
 * Class chips of an S6 student row, keyed by class id (SW5-03). Class names are not unique, so the
 * id is the only safe key; an API that predates `classes` only lists names and the name is used.
 */
import type { GuruStudent } from '../../api/types'

export interface StudentChip {
  /** Stable v-for key. */
  key: string
  /** Class id, or `null` when the API sent only names. */
  id: number | null
  name: string
}

/** The chips of a student, in display order. */
export function chipsOf(student: GuruStudent): StudentChip[] {
  if (student.classes) {
    return student.classes.map((c) => ({ key: `id-${String(c.id)}`, id: c.id, name: c.name }))
  }
  return student.classNames.map((name, i) => ({ key: `name-${String(i)}-${name}`, id: null, name }))
}

/**
 * Whether the student is already in the chosen class. By id when the API sent ids; by name only
 * for an API without `classes`.
 */
export function isInClass(
  student: GuruStudent,
  target: { id: string; name: string | null },
): boolean {
  if (target.id === '') return false
  if (student.classes) return student.classes.some((c) => String(c.id) === target.id)
  return target.name !== null && student.classNames.includes(target.name)
}
