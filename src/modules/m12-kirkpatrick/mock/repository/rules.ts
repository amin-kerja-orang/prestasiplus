/** Pure M12 rules (SRS M12 v1.6 §4): bands, tahap, grades, statuses. No store is read here. */

import type { BandKey, SpmGrade, SubjectStatus } from '../../api/types'
import { SPM_GRADES } from '../data/rules-data'

/** BR-M12-06 (v1.6): >= 50 Champion; 20-49 Konsisten; 5-19 Berkembang; 1-4 Minimum; 0 Tidak Terlibat. */
export function bandOfAnswers(answered: number): BandKey {
  if (answered >= 50) return 'champion'
  if (answered >= 20) return 'konsisten'
  if (answered >= 5) return 'berkembang'
  if (answered >= 1) return 'minimum'
  return 'tidakTerlibat'
}

/** BR-M12-12 "Tahap by score": >= 80 / 60 / 40 / 20 (INFERRED). */
export function tahapOfScore(score: number): BandKey {
  if (score >= 80) return 'champion'
  if (score >= 60) return 'konsisten'
  if (score >= 40) return 'berkembang'
  if (score >= 20) return 'minimum'
  return 'tidakTerlibat'
}

/** BR-M12-09 "Subject status": >= 80 Mastered; 50-< 80 Developing; < 50 Beginning (INFERRED). */
export function statusOfAccuracy(accuracy: number): SubjectStatus {
  if (accuracy >= 80) return 'Mastered'
  if (accuracy >= 50) return 'Developing'
  return 'Beginning'
}

/** BR-M12-21 "Anggaran Gred" from an accuracy in tenths of a percent (the displayed 1-decimal value). */
export function gradeOfAccuracyTenths(tenths: number): SpmGrade {
  if (tenths >= 900) return 'A+'
  if (tenths >= 800) return 'A'
  if (tenths >= 700) return 'A-'
  if (tenths >= 650) return 'B+'
  if (tenths >= 600) return 'B'
  if (tenths >= 550) return 'C+'
  if (tenths >= 500) return 'C'
  if (tenths >= 400) return 'D'
  if (tenths >= 300) return 'E'
  return 'G'
}

/** The grade of a GPS (BR-M12-19): the grade of point ceil(GPS) - 1 (A+ 0 ... G 9), clamped. */
export function gradeOfGps(gps: number): SpmGrade {
  const point = Math.min(9, Math.max(0, Math.ceil(gps - 1e-9) - 1))
  return SPM_GRADES[point] as SpmGrade
}

/** BR-M12-22: the Cadangan band follows the grade (the observed exception is stored per row). */
export function bandOfGrade(grade: string): 'A' | 'B' | 'C' | 'D/E' {
  if (grade === 'A+' || grade === 'A' || grade === 'A-') return 'A'
  if (grade === 'B+' || grade === 'B') return 'B'
  if (grade === 'C+' || grade === 'C') return 'C'
  return 'D/E'
}

/** BR-M12-22 tiles: pass A+ ... D; fail E and G; needs intervention D and E. */
export const isPass = (grade: string): boolean => grade !== 'E' && grade !== 'G'
export const isFail = (grade: string): boolean => grade === 'E' || grade === 'G'
export const needsIntervention = (grade: string): boolean => grade === 'D' || grade === 'E'

/** BR-M12-25 strength of r (INFERRED bounds). */
export function strengthOfR(r: number): 'Lemah' | 'Sederhana' | 'Kuat' {
  const a = Math.abs(r)
  if (a < 0.3) return 'Lemah'
  if (a < 0.7) return 'Sederhana'
  return 'Kuat'
}
