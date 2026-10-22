/**
 * Pure rules of the teacher Command Center (mock `command-center-rules.ts`; SRS M10 BR-M10-08, 09, 14, 15, 16). No I/O.
 * The grade table is the BR-M08-01/02 table; it is repeated here (cited) instead of importing the BE-19 internals across modules.
 */
import { COMMAND_CENTER_GURU_GRADES } from '@pp/contract'

export const GRADES = COMMAND_CENTER_GURU_GRADES
export type Grade = (typeof GRADES)[number]

export const gradePoints = (grade: Grade): number => GRADES.indexOf(grade)

export function gradeOfPercent(value: number): Grade {
  if (value >= 90) return 'A+'
  if (value >= 80) return 'A'
  if (value >= 70) return 'A-'
  if (value >= 65) return 'B+'
  if (value >= 60) return 'B'
  if (value >= 55) return 'C+'
  if (value >= 50) return 'C'
  if (value >= 45) return 'D'
  if (value >= 40) return 'E'
  return 'G'
}

/** The drill "Gred" of a GPS (the live script's own scale). */
export function drillGradeOfGps(gps: number): string {
  if (gps <= 1.5) return 'A+'
  if (gps <= 2.0) return 'A'
  if (gps <= 2.5) return 'A-'
  if (gps <= 3.0) return 'B+'
  if (gps <= 3.5) return 'B'
  if (gps <= 4.0) return 'C+'
  if (gps <= 4.5) return 'C'
  if (gps <= 5.0) return 'D'
  return 'E'
}

export const PREDICT_MIN_ANSWERS = 10

export type Band = 'champion' | 'consistent' | 'developing' | 'minimum' | 'disengaged'
export const BANDS: readonly Band[] = ['champion', 'consistent', 'developing', 'minimum', 'disengaged']

/** BR-M10-09: by distinct answer days in the last 7 days; Minimum = none in 7 but some in 30; Disengaged = none in 30. */
export function engagementBand(daysIn7: number, daysIn30: number): Band {
  if (daysIn7 >= 5) return 'champion'
  if (daysIn7 >= 3) return 'consistent'
  if (daysIn7 >= 1) return 'developing'
  return daysIn30 >= 1 ? 'minimum' : 'disengaged'
}

export type PredictionRisk = 'kritikal' | 'tinggi' | 'sederhana' | 'rendah'
export function predictionRisk(grade: Grade): PredictionRisk {
  if (grade === 'E' || grade === 'G') return 'kritikal'
  if (grade === 'D') return 'tinggi'
  if (grade === 'C' || grade === 'C+') return 'sederhana'
  return 'rendah'
}

export type TrendLabel = 'Naik' | 'Turun' | 'Stabil'
export function trendLabel(trend: number): TrendLabel {
  if (trend > 5) return 'Naik'
  if (trend < -5) return 'Turun'
  return 'Stabil'
}

export type EvaluationRisk = 'critical' | 'high' | 'medium'
export function evaluationRisk(alertCount: number): EvaluationRisk | null {
  if (alertCount >= 3) return 'critical'
  if (alertCount === 2) return 'high'
  return alertCount === 1 ? 'medium' : null
}

export const EVALUATION_MSG = {
  inactive: (days: number): string => `Tiada aktiviti ${String(days)} hari`,
  inactiveTip: 'Hubungi pelajar dan ingatkan untuk menjawab soalan setiap hari.',
  lowAccuracy: (accuracy: number): string => `Ketepatan rendah (${String(accuracy)}%)`,
  lowAccuracyTip: 'Jana ujian remedial untuk topik yang lemah.',
  declining: 'Prestasi menurun',
  decliningTip: 'Semak jawapan salah terkini dan beri bimbingan tambahan.',
} as const

/** FN-M10-2.2.13: chip colour by number of holders. */
export function badgeColor(holders: number): string {
  if (holders >= 20) return '#94a3b8'
  if (holders >= 10) return '#22c55e'
  if (holders >= 5) return '#3b82f6'
  return holders >= 1 ? '#a855f7' : '#f59e0b'
}

/** `DARJAH_n` (grade 1..6) or `TINGKATAN_n` (grade 7..11 -> 1..5); null for any other grade. */
export function gradeCode(grade: number | null): 'DARJAH_1' | 'DARJAH_2' | 'DARJAH_3' | 'DARJAH_4' | 'DARJAH_5' | 'DARJAH_6' | 'TINGKATAN_1' | 'TINGKATAN_2' | 'TINGKATAN_3' | 'TINGKATAN_4' | 'TINGKATAN_5' | null {
  if (grade === null || !Number.isInteger(grade) || grade < 1 || grade > 11) return null
  return (grade <= 6 ? `DARJAH_${grade}` : `TINGKATAN_${grade - 6}`) as ReturnType<typeof gradeCode>
}
