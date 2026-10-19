/**
 * Q-M12-PRED (SRS M12 v1.6 §6.5, BR-M12-21): the active students of a scope with their accuracy and "Anggaran
 * Gred", accuracy descending; the order within equal accuracies is not observable on live, so the rebuild uses
 * the user id ascending (PROPOSED, never asserted). Accuracy and grade use the displayed 1-decimal value.
 */

import { users } from '@/modules/m01-authentication/mock'
import { kirkpatrick } from '@/modules/m05-practice/mock'

import type { SpmGrade } from '../../../api/types'
import { pctTenths } from '../common'
import { gradeOfAccuracyTenths } from '../rules'
import { schoolName, type Scope } from '../scope'

export interface PredictionRow {
  userId: number
  name: string
  schoolId: number
  schoolName: string
  answers: number
  correct: number
  /** Accuracy in tenths of a percent (the displayed 1-decimal value x 10). */
  tenths: number
  grade: SpmGrade
}

/** The prediction table of a scope (every student with >= 1 answered question), BR-M12-21 order. */
export function predictionsOf(scope: Scope): PredictionRow[] {
  const rows: PredictionRow[] = []
  for (const s of kirkpatrick.students(scope.ka)) {
    if (s.answered < 1) continue
    const tenths = pctTenths(s.correct, s.answered)
    rows.push({
      userId: s.userId,
      name: users.get(s.userId)?.name ?? `Pelajar ${String(s.userId)}`,
      schoolId: s.schoolId,
      schoolName: schoolName(s.schoolId),
      answers: s.answered,
      correct: s.correct,
      tenths,
      grade: gradeOfAccuracyTenths(tenths),
    })
  }
  rows.sort((a, b) => b.tenths - a.tenths || a.userId - b.userId)
  return rows
}
