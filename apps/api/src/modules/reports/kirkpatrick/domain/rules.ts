/**
 * Pure M12 rules (SRS M12 v1.6 section 4): number formats, bands, tahap, grades, statuses. No store is read here.
 * Ported from the mock (`src/modules/m12-kirkpatrick/mock/repository/{common,rules}.ts`).
 */

export type BandKey = 'champion' | 'konsisten' | 'berkembang' | 'minimum' | 'tidakTerlibat'
export type SubjectStatus = 'Mastered' | 'Developing' | 'Beginning'
export type Grade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E' | 'G'

export const BAND_KEYS: readonly BandKey[] = ['champion', 'konsisten', 'berkembang', 'minimum', 'tidakTerlibat']

/** Rounds `value` half-up to one decimal (the displayed precision of every M12 percentage). */
export function round1(value: number): number {
  const r = Math.round((Math.abs(value) + Number.EPSILON) * 10) / 10
  return value < 0 ? -r : r
}

/** `part / whole x 100`, half-up to 1 decimal in integer arithmetic; 0 when `whole` is 0 (BR-M12-03). */
export function pct1(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.floor((2000 * part + whole) / (2 * whole)) / 10
}

/** The same ratio in tenths of a percent (integer), for sorting and grade bounds on the displayed value. */
export function pctTenths(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.floor((2000 * part + whole) / (2 * whole))
}

/** A mean (`sum / count`) half-up to 1 decimal; 0 when `count` is 0. */
export function mean1(sum: number, count: number): number {
  if (count <= 0) return 0
  return Math.floor((20 * sum + count) / (2 * count)) / 10
}

/** "x" or "x.y": the number as the screens print it (trailing ".0" dropped, no thousands separator). */
export function fmt1(value: number): string {
  const r = round1(value)
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** BR-M12-06: >= 50 Champion; 20-49 Konsisten; 5-19 Berkembang; 1-4 Minimum; 0 Tidak Terlibat. */
export function bandOfAnswers(answered: number): BandKey {
  if (answered >= 50) return 'champion'
  if (answered >= 20) return 'konsisten'
  if (answered >= 5) return 'berkembang'
  if (answered >= 1) return 'minimum'
  return 'tidakTerlibat'
}

/** BR-M12-12 "Tahap by score": >= 80 / 60 / 40 / 20. */
export function tahapOfScore(score: number): BandKey {
  if (score >= 80) return 'champion'
  if (score >= 60) return 'konsisten'
  if (score >= 40) return 'berkembang'
  if (score >= 20) return 'minimum'
  return 'tidakTerlibat'
}

/** BR-M12-09 "Subject status": >= 80 Mastered; 50-< 80 Developing; < 50 Beginning. */
export function statusOfAccuracy(accuracy: number): SubjectStatus {
  if (accuracy >= 80) return 'Mastered'
  if (accuracy >= 50) return 'Developing'
  return 'Beginning'
}

/** BR-M12-21 "Anggaran Gred" from an accuracy in tenths of a percent (the displayed 1-decimal value). */
export function gradeOfAccuracyTenths(tenths: number): Grade {
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

/** BR-M12-25 strength of r. */
export function strengthOfR(r: number): 'Lemah' | 'Sederhana' | 'Kuat' {
  const a = Math.abs(r)
  if (a < 0.3) return 'Lemah'
  if (a < 0.7) return 'Sederhana'
  return 'Kuat'
}

export type InterventionStatus = 'Menunggu Semakan' | 'Meningkat' | 'Menurun' | null

/** BR-M12-26: derived on read, never stored. */
export function statusOfIntervention(row: { beforeAccuracy: number | null; afterAccuracy: number | null }): InterventionStatus {
  if (row.afterAccuracy === null) return 'Menunggu Semakan'
  if (row.beforeAccuracy === null) return null
  if (row.afterAccuracy > row.beforeAccuracy) return 'Meningkat'
  if (row.afterAccuracy < row.beforeAccuracy) return 'Menurun'
  return null
}

/**
 * DC-M12-03 (display constants of the mock, documented by the contract, OQ-API-B3-8): the correlation bands and r of
 * the impact chain. No table holds them.
 */
export const CORRELATION_R = 0.1298
export const CORRELATION_BANDS: readonly { label: string; n: number; acc: number }[] = [
  { label: '1-20 soalan', n: 215, acc: 59.7 },
  { label: '51-100 soalan', n: 149, acc: 68.7 },
  { label: '100+ soalan', n: 348, acc: 75.2 },
]

/** Day names Isnin .. Ahad and the heat hours 06..23 (BR-M12-13). */
export const HEAT_HOURS = 18
export const HEAT_FIRST_HOUR = 6
