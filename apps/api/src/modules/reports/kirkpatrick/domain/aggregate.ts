import type { Cell, SchoolPopulationRow } from '../kirkpatrick.repository'
import { BAND_KEYS, type BandKey, bandOfAnswers, pct1 } from './rules'

/** Pure roll-ups of the repository's cells (the mock's `kirkpatrick` segment reads, BR-M12-02 .. BR-M12-06). */

export interface Totals {
  sessions: number
  answered: number
  correct: number
  scoredSessions: number
  scoreSum: number
  /** Pupils with at least one answered question (BR-M12-02). */
  activeStudents: number
}

export interface StudentAgg {
  userId: string
  schoolId: string
  sessions: number
  answered: number
  correct: number
}

export interface SchoolAgg extends Totals {
  schoolId: string
  /** Distinct subjects with at least one answer. */
  subjects: number
}

export interface SubjectAgg {
  subjectId: string
  answered: number
  correct: number
}

export interface Population {
  t4t5: number
  never: number
  teachers: number
  teachersLoggedIn: number
  /** One row per school with at least one T4/T5 pupil (Q-M12-SCH-TABLE), school id ascending. */
  schools: SchoolPopulationRow[]
}

const byId = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)
export const compareIds = byId

export function populationOf(rows: readonly SchoolPopulationRow[]): Population {
  const sorted = [...rows].sort((a, b) => byId(a.schoolId, b.schoolId))
  const schools = sorted.filter((r) => r.t4t5 > 0)
  return {
    t4t5: schools.reduce((s, r) => s + r.t4t5, 0),
    never: schools.reduce((s, r) => s + r.never, 0),
    teachers: sorted.reduce((s, r) => s + r.teachers, 0),
    teachersLoggedIn: sorted.reduce((s, r) => s + r.teachersLoggedIn, 0),
    schools,
  }
}

export function studentsOf(cells: readonly Cell[]): StudentAgg[] {
  const by = new Map<string, StudentAgg>()
  for (const c of cells) {
    let s = by.get(c.userId)
    if (!s) {
      s = { userId: c.userId, schoolId: c.schoolId, sessions: 0, answered: 0, correct: 0 }
      by.set(c.userId, s)
    }
    s.sessions += c.sessions
    s.answered += c.answered
    s.correct += c.correct
  }
  return [...by.values()].sort((a, b) => byId(a.userId, b.userId))
}

export function totalsOf(cells: readonly Cell[]): Totals {
  const t: Totals = { sessions: 0, answered: 0, correct: 0, scoredSessions: 0, scoreSum: 0, activeStudents: 0 }
  for (const c of cells) {
    t.sessions += c.sessions
    t.answered += c.answered
    t.correct += c.correct
    t.scoredSessions += c.scoredSessions
    t.scoreSum += c.scoreSum
  }
  t.activeStudents = studentsOf(cells).filter((s) => s.answered > 0).length
  return t
}

export function schoolsOf(cells: readonly Cell[]): SchoolAgg[] {
  const groups = new Map<string, Cell[]>()
  for (const c of cells) {
    const list = groups.get(c.schoolId) ?? []
    list.push(c)
    groups.set(c.schoolId, list)
  }
  return [...groups.entries()]
    .sort((a, b) => byId(a[0], b[0]))
    .map(([schoolId, list]) => ({
      schoolId,
      ...totalsOf(list),
      subjects: new Set(list.filter((c) => c.subjectId !== null && c.answered > 0).map((c) => c.subjectId)).size,
    }))
}

export function subjectsOf(cells: readonly Cell[]): SubjectAgg[] {
  const by = new Map<string, SubjectAgg>()
  for (const c of cells) {
    if (c.subjectId === null) continue
    const s = by.get(c.subjectId) ?? { subjectId: c.subjectId, answered: 0, correct: 0 }
    s.answered += c.answered
    s.correct += c.correct
    by.set(c.subjectId, s)
  }
  return [...by.values()].sort((a, b) => byId(a.subjectId, b.subjectId))
}

/** Months (`YYYY-MM`, ascending) with at least one answered question. */
export function monthsOf(cells: readonly Cell[]): string[] {
  return [...new Set(cells.filter((c) => c.answered > 0).map((c) => c.month))].sort()
}

export interface MonthAgg {
  month: string
  answered: number
  correct: number
  /** Pupils with at least one answer in the month, and their answers. */
  students: { userId: string; answered: number }[]
}

export function monthOf(cells: readonly Cell[], month: string): MonthAgg {
  const agg: MonthAgg = { month, answered: 0, correct: 0, students: [] }
  const by = new Map<string, number>()
  for (const c of cells) {
    if (c.month !== month) continue
    agg.answered += c.answered
    agg.correct += c.correct
    by.set(c.userId, (by.get(c.userId) ?? 0) + c.answered)
  }
  agg.students = [...by.entries()].filter(([, n]) => n > 0).map(([userId, answered]) => ({ userId, answered }))
  return agg
}

export interface BandCount {
  key: BandKey
  count: number
  pct: number
}

/** BR-M12-06: pupils without an answer (and pupils without a session) are "Tidak Terlibat". */
export function bandsOf(t4t5: number, students: readonly StudentAgg[]): BandCount[] {
  const counts: Record<BandKey, number> = { champion: 0, konsisten: 0, berkembang: 0, minimum: 0, tidakTerlibat: 0 }
  let active = 0
  for (const s of students) {
    if (s.answered < 1) continue
    counts[bandOfAnswers(s.answered)]++
    active++
  }
  counts.tidakTerlibat = Math.max(0, t4t5 - active)
  return BAND_KEYS.map((key) => ({ key, count: counts[key], pct: pct1(counts[key], t4t5) }))
}
