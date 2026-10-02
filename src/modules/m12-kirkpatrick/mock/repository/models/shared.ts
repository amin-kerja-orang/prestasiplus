/** Pieces shared by the M12 read models: band counts, scope statistics. */

import { kirkpatrick, type KaStudentAgg, type KaTotals } from '@/modules/m05-practice/mock'

import type { BandCount } from '../../../api/types'
import { BAND_KEYS } from '../../data/rules-data'
import { pct1 } from '../common'
import { bandOfAnswers } from '../rules'
import { populationOf, type Population, type Scope } from '../scope'

export interface ScopeStats {
  scope: Scope
  pop: Population
  totals: KaTotals
  /** Students with >= 1 session in scope (the practice segment), by user id. */
  students: KaStudentAgg[]
  /** Accuracy of the scope, half-up to 1 decimal ("0%" when no answers). */
  accuracy: number
}

/** The populations and the practice totals of a scope (read once per request). */
export function statsOf(scope: Scope): ScopeStats {
  const totals = kirkpatrick.totals(scope.ka)
  return {
    scope,
    pop: populationOf(scope),
    totals,
    students: kirkpatrick.students(scope.ka),
    accuracy: pct1(totals.correct, totals.answered),
  }
}

/** BR-M12-06: the five bands of the T4/T5 students; the students without an answer are "Tidak Terlibat". */
export function bandsOf(t4t5: number, students: readonly KaStudentAgg[]): BandCount[] {
  const counts: Record<(typeof BAND_KEYS)[number], number> = {
    champion: 0,
    konsisten: 0,
    berkembang: 0,
    minimum: 0,
    tidakTerlibat: 0,
  }
  let active = 0
  for (const s of students) {
    if (s.answered < 1) continue
    counts[bandOfAnswers(s.answered)]++
    active++
  }
  counts.tidakTerlibat = Math.max(0, t4t5 - active)
  return BAND_KEYS.map((key) => ({ key, count: counts[key], pct: pct1(counts[key], t4t5) }))
}
