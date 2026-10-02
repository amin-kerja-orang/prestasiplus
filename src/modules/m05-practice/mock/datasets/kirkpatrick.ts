/**
 * KirkpatrickSessionAggregate (DATA-M05-12; SRS M05 v1.17 §6.14.4, FR-M05-147; M12 v1.5 §6.5, XR-M12-02):
 * the M12 practice segment as a **D11 virtual dataset** of 20,991 completed sessions of T4/T5
 * students at the non-fixture schools, each an aggregate `{userId, schoolId, subjectId, completedAt,
 * questionCount, answeredCount, correctCount, scorePct}`. It is a store of its own: no QuizAnswer row
 * stands behind a session, it is never counted in Q-SESS-ALL and never joined to the answer log.
 *
 * - The distribution (facets `schoolId`, `subjectId`, `month`) and every row come from the plan in
 *   `./kirkpatrick-plan.ts` (a pure function of the observed M12 tables); the M12 §6.5 totals and
 *   pins are asserted by `__tests__/mock/kirkpatrick-plan.test.ts`.
 * - The plan knows students as `(school, index)`. The M05 `finalise` maps them to M01 users (`prime`):
 *   Student A = user 4664 and Student B = user 4644 at 8080 (M12 §6.9), the others the school's T4/T5
 *   students in a fixed order (active first, then logged in, then grade 11, then by id).
 * - Runtime rows (the M12 test hook `mock.addSegmentStudent`, provisional) are inserted through the
 *   `kirkpatrick` repository.
 *
 * Bump the M05 plugin `version` whenever the plan, the observed tables or a cheap field changes.
 */

import { toIsoMyt } from '@/lib/time'
import { defineVirtualDataset, type CellSpec } from '@/mock/dataset'
import { floor, ID_RANGES } from '@/mock/define'
import type { UserRow } from '@/modules/m01-authentication/mock'
import { users } from '@/modules/m01-authentication/mock'

import { KA_CELLS } from './kirkpatrick-cells'
import {
  KA_SCHOOL_8080,
  KA_SESSIONS,
  kirkpatrickPlan,
  monthKey,
  monthOfMs,
  type KaPlan,
} from './kirkpatrick-plan'

export interface KaSessionRow {
  /** 1–20,991; runtime rows from 9,000,001. */
  id: number
  schoolId: number
  /** M03 subject id; null for the one question-less session (M12 §6.9, school 940). */
  subjectId: number | null
  /** `YYYY-MM` of `completedAt` (MYT). */
  month: string
  userId: number
  completedAt: string
  completedAtMs: number
  /** Served questions. */
  questionCount: number
  /** Answered questions. */
  answeredCount: number
  correctCount: number
  /** Session score, 0–100, 1 decimal. */
  scorePct: number
}

export type KaFacetKey = 'schoolId' | 'subjectId' | 'month'
export type KaCheapKey =
  | 'userId'
  | 'completedAt'
  | 'completedAtMs'
  | 'questionCount'
  | 'answeredCount'
  | 'correctCount'
  | 'scorePct'

/** Students A and B of 8080 are these M01 users (M12 §6.9, XR-M12-01). */
export const KA_STUDENT_A = 4664
export const KA_STUDENT_B = 4644

// ---------------------------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------------------------

type Facets = Pick<KaSessionRow, KaFacetKey>

const facetsOf = (plan: KaPlan, row: number): Facets => ({
  schoolId: (plan.students[plan.student[row] as number] as { school: number }).school,
  subjectId: (plan.subject[row] as number) > 0 ? (plan.subject[row] as number) : null,
  month: monthKey(monthOfMs(plan.ms[row] as number)),
})

const cellKeyOf = (f: Facets) => `${String(f.schoolId)}|${String(f.subjectId)}|${f.month}`

let cellsCache: CellSpec<Facets>[] | null = null
/** Plan rows per cell, in plan order. */
let rowsByCell: Map<string, number[]> | null = null

function compilePlan(): void {
  if (cellsCache) return
  const plan = kirkpatrickPlan()
  const map = new Map<string, CellSpec<Facets>>()
  const rows = new Map<string, number[]>()
  for (let i = 0; i < plan.count; i++) {
    const f = facetsOf(plan, i)
    const key = cellKeyOf(f)
    const cell = map.get(key)
    if (cell) cell.count++
    else map.set(key, { facets: f, count: 1 })
    const list = rows.get(key)
    if (list) list.push(i)
    else rows.set(key, [i])
  }
  cellsCache = [...map.values()]
  rowsByCell = rows
}

/** The compile-time distribution: the committed cell table (no plan). */
export function kaDistribution(): CellSpec<Facets>[] {
  if (!committed) {
    committed = KA_CELLS.map(([schoolId, subjectId, m, count]) => ({
      facets: { schoolId, subjectId: subjectId > 0 ? subjectId : null, month: monthKey(m - 1) },
      count,
    }))
  }
  return committed
}

let committed: CellSpec<Facets>[] | null = null

/** The cells of the plan itself (tests compare them with `KA_CELLS`). */
export function kaPlanCells(): CellSpec<Facets>[] {
  compilePlan()
  return cellsCache as CellSpec<Facets>[]
}

// ---------------------------------------------------------------------------------------------
// Prime: slot → plan row → user
// ---------------------------------------------------------------------------------------------

export interface KaPrime {
  user: Int32Array
  ms: Float64Array
  served: Int32Array
  answered: Int32Array
  correct: Int32Array
  score: Int16Array
  /** User of every plan student (index = plan student). */
  studentUser: readonly number[]
  issues: string[]
}

let prime: KaPrime | null = null

export function resetKirkpatrickPrime(): void {
  prime = null
}

export function kirkpatrickPrimeOrNull(): KaPrime | null {
  return prime
}

/** The prime, built on first use (the first read after boot). */
function requirePrime(): KaPrime {
  if (!prime) {
    const issues = primeKirkpatrick()
    if (issues.length > 0) {
      throw new Error(`M05 KirkpatrickSessionAggregate: ${issues.join('; ')}`)
    }
  }
  return prime as KaPrime
}

export function ensureKirkpatrickPrimed(): void {
  requirePrime()
}

/** The M01 users of the plan's students (see the file header). */
export function mapKaStudents(plan: KaPlan, issues: string[]): number[] {
  const students = users.query('U-ROLE', { sort: 'id' }, 'student').rows
  const bySchool = new Map<number, UserRow[]>()
  for (const u of students) {
    if (u.schoolId === null || (u.grade !== 10 && u.grade !== 11)) continue
    if (u.id === KA_STUDENT_A || u.id === KA_STUDENT_B) continue
    const list = bySchool.get(u.schoolId) ?? []
    list.push(u)
    bySchool.set(u.schoolId, list)
  }
  for (const list of bySchool.values()) {
    list.sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        Number(b.hasLoggedIn) - Number(a.hasLoggedIn) ||
        (b.grade ?? 0) - (a.grade ?? 0) ||
        a.id - b.id,
    )
  }
  const out: number[] = []
  const taken = new Map<number, number>()
  for (const s of plan.students) {
    if (s.special === 'A') {
      out.push(KA_STUDENT_A)
      continue
    }
    if (s.special === 'B') {
      out.push(KA_STUDENT_B)
      continue
    }
    const pool = bySchool.get(s.school) ?? []
    const at = taken.get(s.school) ?? 0
    taken.set(s.school, at + 1)
    const u = pool[at]
    if (!u) {
      issues.push(
        `Kirkpatrick: school ${String(s.school)} has ${String(pool.length)} T4/T5 students, ${String(at + 1)} needed`,
      )
      out.push(0)
    } else out.push(u.id)
  }
  return out
}

/**
 * Maps the compiled slots of the dataset to plan rows and users (after the dataset has compiled and
 * M01 is readable). Returns the problems found.
 */
export function primeKirkpatrick(): string[] {
  compilePlan()
  const plan = kirkpatrickPlan()
  const issues: string[] = []
  const studentUser = mapKaStudents(plan, issues)
  const n = KA_SESSIONS + 1
  const p: KaPrime = {
    user: new Int32Array(n),
    ms: new Float64Array(n),
    served: new Int32Array(n),
    answered: new Int32Array(n),
    correct: new Int32Array(n),
    score: new Int16Array(n),
    studentUser,
    issues,
  }
  const used = new Map<string, number>()
  let visited = 0
  kirkpatrickDataset.count(
    {},
    (row) => {
      if (row.id > KA_SESSIONS) return false
      const key = cellKeyOf(row)
      const at = used.get(key) ?? 0
      used.set(key, at + 1)
      const planRow = (rowsByCell as Map<string, number[]>).get(key)?.[at]
      if (planRow === undefined) {
        issues.push(`Kirkpatrick: slot ${String(row.id)} has no plan row in ${key}`)
        return false
      }
      visited++
      p.user[row.id] = studentUser[plan.student[planRow] as number] as number
      p.ms[row.id] = plan.ms[planRow] as number
      p.served[row.id] = plan.served[planRow] as number
      p.answered[row.id] = plan.answered[planRow] as number
      p.correct[row.id] = plan.correct[planRow] as number
      p.score[row.id] = plan.score[planRow] as number
      return false
    },
    {
      matchFields: ['id', 'schoolId', 'subjectId', 'month'],
      cacheKey: 'm05:kirkpatrick:prime',
    },
  )
  if (visited !== KA_SESSIONS)
    issues.push(`Kirkpatrick: ${String(visited)} slots ≠ ${String(KA_SESSIONS)}`)
  prime = p
  return issues
}

// ---------------------------------------------------------------------------------------------
// The dataset
// ---------------------------------------------------------------------------------------------

/** Runtime ids (the M12 hook `mock.addSegmentStudent`) start here, above the generated range. */
export const KA_RUNTIME_ID_FLOOR = ID_RANGES.usersRuntimeFloor

export const kirkpatrickDataset = defineVirtualDataset<KaSessionRow, KaFacetKey, KaCheapKey>({
  name: 'practice.kirkpatrickSessions',
  owner: 'M05',
  total: KA_SESSIONS,
  idRange: { min: 1, max: KA_SESSIONS },
  runtimeIds: floor({ start: KA_RUNTIME_ID_FLOOR }),
  facets: ['schoolId', 'subjectId', 'month'],
  distribution: kaDistribution,
  derive: () => ({}),
  fields: {
    userId: (key) => requirePrime().user[key] as number,
    completedAt: (key) => toIsoMyt(requirePrime().ms[key] as number),
    completedAtMs: (key) => requirePrime().ms[key] as number,
    questionCount: (key) => requirePrime().served[key] as number,
    answeredCount: (key) => requirePrime().answered[key] as number,
    correctCount: (key) => requirePrime().correct[key] as number,
    scorePct: (key) => (requirePrime().score[key] as number) / 10,
  },
})

export { KA_SCHOOL_8080 }
