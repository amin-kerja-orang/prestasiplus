/**
 * Pure M08 rules (SRS M08 v1.11 §4): grades and points, GPS bands, accuracy rounding and cap, the
 * difficulty labels and the discrimination status. No store access; unit-tested.
 */

/** BR-M08-01: the ten SPM grades in point order (A+ 0 … G 9). */
export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const
export type Grade = (typeof GRADES)[number]

export const gradePoints = (grade: Grade): number => GRADES.indexOf(grade)

/** BR-M08-02: percentage → grade (A+ 90–100 … G < 40; INFERRED beyond the S15 values). */
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

/** Grade at a (half-up rounded) point value, clamped to A+…G. */
export function gradeOfPoints(points: number): Grade {
  const i = Math.min(9, Math.max(0, Math.floor(points + 0.5)))
  return GRADES[i] as Grade
}

export type GpsBand = 'Cemerlang' | 'Baik' | 'Sederhana' | 'Perlu Perhatian'

/** BR-M08-03 (≤ 2 / ≤ 4 / ≤ 6 / else). */
export function gpsBand(gps: number): GpsBand {
  if (gps <= 2) return 'Cemerlang'
  if (gps <= 4) return 'Baik'
  if (gps <= 6) return 'Sederhana'
  return 'Perlu Perhatian'
}

/** Rounds half away from zero to `digits` decimals. */
export function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f
}

/** Percentage `part ÷ whole × 100`, or 0 when `whole` is 0. */
export const pct = (part: number, whole: number): number => (whole === 0 ? 0 : (part / whole) * 100)

/** DV-07 / FR-M08-124: every displayed accuracy is capped at 100. */
export const capPercent = (value: number): number => Math.min(value, 100)

/** BR-M08-18: Indeks = 1 − p (2 decimals half up); Tahap Sukar > 0.70, Mudah ≤ 0.30, else Sederhana. */
export type DifficultyLevel = 'Mudah' | 'Sederhana' | 'Sukar'
export function difficultyIndex(correct: number, attempts: number): number {
  return attempts === 0 ? 0 : round(1 - correct / attempts, 2)
}
export function difficultyLevel(index: number): DifficultyLevel {
  if (index > 0.7) return 'Sukar'
  if (index <= 0.3) return 'Mudah'
  return 'Sederhana'
}

/** BR-M08-19 status of a discrimination index D. */
export function discriminationStatus(d: number): 'Sangat Baik' | 'Baik' | 'Sederhana' | 'Lemah' {
  if (d >= 0.4) return 'Sangat Baik'
  if (d >= 0.3) return 'Baik'
  if (d >= 0.2) return 'Sederhana'
  return 'Lemah'
}

/** BR-M08-14 SP band by accuracy (Mahir ≥ 75, Sederhana 50–74.9, Lemah < 50). */
export type SpBand = 'mahir' | 'sederhana' | 'lemah'
export function spBand(accuracy: number): SpBand {
  if (accuracy >= 75) return 'mahir'
  if (accuracy >= 50) return 'sederhana'
  return 'lemah'
}

/** BR-M08-14 Unjuran Gred: grade(accuracy − 10) – grade(accuracy + 10) (INFERRED, fits 40.5 → G–C, 35.0 → G–D). */
export function projection(accuracy: number): { low: Grade; high: Grade } {
  return { low: gradeOfPercent(accuracy - 10), high: gradeOfPercent(accuracy + 10) }
}

/** Learning-level label of the local weekday names (Ahad = Sunday). */
export const WEEKDAYS_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'] as const
