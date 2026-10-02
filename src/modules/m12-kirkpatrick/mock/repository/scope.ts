/**
 * Scope and population of the M12 figures (SRS M12 v1.6 BR-M12-01, §6.5 Q-M12-T4T5 / -GURU / -SCH-TABLE).
 *
 * "T4/T5" = students of grade 10 or 11 with a school outside the fixture range 900001-900099 (the M01 named query
 * `Q-M11-T45`, M11 BR-M11-34). `school_id` narrows to that school, `state` to the schools of that state; a fixture
 * or unknown school, or an unknown state, is an empty scope (the zero state). The populations are read from the M01
 * users repository (facet counts, O(cells)); the practice figures come from the M05 `kirkpatrick` repository with
 * the `KaScope` built here.
 */

import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import type { KaScope } from '@/modules/m05-practice/mock'

export interface ScopeInput {
  schoolId?: number | null
  state?: string | null
}

export interface Scope {
  schoolId: number | null
  state: string | null
  /** `null` = every school; a list = those schools (possibly empty). */
  schoolIds: readonly number[] | null
  /** The same scope for the M05 `kirkpatrick` repository. */
  ka: KaScope
}

/** Builds the scope of a request (BR-M12-01). */
export function resolveScope(input: ScopeInput = {}): Scope {
  const schoolId = input.schoolId ?? null
  const state = input.state === undefined || input.state === '' ? null : input.state
  let schoolIds: number[] | null = null

  if (schoolId !== null) {
    const school = schools.get(schoolId)
    schoolIds = schools.isFixture(schoolId) ? [] : [schoolId]
    if (state !== null && school?.state !== state) schoolIds = []
  } else if (state !== null) {
    schoolIds = users
      .schoolsWithUsers({ excludeFixtures: true })
      .filter((id) => schools.get(id)?.state === state)
  }
  return { schoolId, state, schoolIds, ka: { schoolIds } }
}

/** The empty scope (the zero state): no school at all. */
export function emptyScope(): Scope {
  return { schoolId: null, state: null, schoolIds: [], ka: { schoolIds: [] } }
}

/** True when `schoolId` is inside the scope. */
export function scopeHas(scope: Scope, schoolId: number): boolean {
  return scope.schoolIds === null || scope.schoolIds.includes(schoolId)
}

export interface SchoolPopulation {
  schoolId: number
  /** T4/T5 students (>= 1 for every listed school). */
  t4t5: number
  /** T4/T5 students with `lastLoginAt` null. */
  never: number
  teachers: number
  teachersLoggedIn: number
}

export interface Population {
  t4t5: number
  never: number
  teachers: number
  teachersLoggedIn: number
  /** One row per school with >= 1 T4/T5 student in scope (Q-M12-SCH-TABLE), by school id. */
  schools: SchoolPopulation[]
}

const num = (m: Map<unknown, number>, key: number): number => m.get(key) ?? 0

/** The populations of a scope (Q-M12-T4T5, Q-M12-GURU, Q-M12-GURU-LOGIN, Q-M12-NEVER-LOGIN). */
export function populationOf(scope: Scope): Population {
  const set = scope.schoolIds === null ? null : new Set(scope.schoolIds)
  const keep = (id: unknown): id is number =>
    typeof id === 'number' && (set === null || set.has(id))

  const t45 = users.groupCount('Q-M11-T45', 'schoolId')
  const never = users.groupCount('Q-M11-T45-LOGGED', 'schoolId', false)
  const teachers = users.groupCount('Q-M11-TEACHERS', 'schoolId')
  const logged = users.groupCount('Q-M11-TEACHERS-LOGGED', 'schoolId')

  const rows: SchoolPopulation[] = []
  for (const [id, n] of t45) {
    if (!keep(id) || n <= 0) continue
    rows.push({
      schoolId: id,
      t4t5: n,
      never: num(never, id),
      teachers: num(teachers, id),
      teachersLoggedIn: num(logged, id),
    })
  }
  rows.sort((a, b) => a.schoolId - b.schoolId)

  let teacherTotal = 0
  let teacherLogged = 0
  for (const [id, n] of teachers) if (keep(id)) teacherTotal += n
  for (const [id, n] of logged) if (keep(id)) teacherLogged += n
  return {
    t4t5: rows.reduce((s, r) => s + r.t4t5, 0),
    never: rows.reduce((s, r) => s + r.never, 0),
    teachers: teacherTotal,
    teachersLoggedIn: teacherLogged,
    schools: rows,
  }
}

/** Name of a school, or its id as text when the register has no row. */
export function schoolName(schoolId: number | null): string {
  if (schoolId === null) return ''
  return schools.get(schoolId)?.name ?? String(schoolId)
}
