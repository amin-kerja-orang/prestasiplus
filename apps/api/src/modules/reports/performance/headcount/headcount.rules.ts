/**
 * Pure headcount rules (SRS M08 BR-M08-01/07/08/24/33), ported from the mock `headcount-port.ts` and
 * `headcount-views.ts`. No store access. Percentages are 0-100.
 */
import type { HeadcountBand, HeadcountPairStatus, HeadcountTone, LatestAr } from '../domain/headcount'
import { gradeOfPercent, round, type Grade } from '../domain/rules'

/** The marks of one pupil in one config (blank slots when the pupil has no entry). */
export interface HeadcountMarks {
  tov: number | null
  /** `activeOtrs` slots. */
  targets: readonly (number | null)[]
  /** `activeOtrs` slots. */
  actuals: readonly (number | null)[]
  etr: number | null
  rs: number | null
}

export const blankSlots = (n: number): (number | null)[] => Array.from({ length: n }, () => null)

/** The latest checkpoint that has an AR (BR-M08-01 "latest AR"). */
export function latestAr(m: Pick<HeadcountMarks, 'targets' | 'actuals'>): LatestAr | null {
  for (let i = m.actuals.length - 1; i >= 0; i--) {
    const ar = m.actuals[i]
    if (ar !== null && ar !== undefined) return { n: i + 1, ar, target: m.targets[i] ?? null }
  }
  return null
}

/** BR-M08-01: an entry is graded when it has an AR. */
export const isGraded = (m: Pick<HeadcountMarks, 'targets' | 'actuals'>): boolean => latestAr(m) !== null

/** BR-M08-08 rule (1) with the "no data" bucket: the latest AR against its target. */
export function pairStatus(m: Pick<HeadcountMarks, 'targets' | 'actuals'>): HeadcountPairStatus {
  const l = latestAr(m)
  if (l === null || l.target === null) return 'none'
  return l.ar >= l.target ? 'on' : 'below'
}

/** BR-M08-08 rule (2): the 2 point band (above > OTR; on OTR - 2 to OTR; below < OTR - 2). */
export function bandStatus(ar: number | null, target: number | null): HeadcountBand {
  if (ar === null || target === null) return 'na'
  if (ar > target) return 'above'
  if (ar >= target - 2) return 'on'
  return 'below'
}

export const gradeOrNull = (v: number | null): Grade | null => (v === null ? null : gradeOfPercent(v))

/** Mean of the non-null values, 1 decimal; null when there are none. */
export function meanOrNull(values: readonly (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null)
  return v.length === 0 ? null : round(v.reduce((a, b) => a + b, 0) / v.length, 1)
}

export type ProjectionVariant = 'green' | 'amber' | 'red'
export type TrendLabel = 'Meningkat' | 'Stabil' | 'Menurun'
export type ConfidenceLabel = 'Tinggi' | 'Sederhana' | 'Rendah'
export type PredictionVerdict = 'Ramalan Tepat' | 'Hampir Tepat' | 'Selisih Besar'

export interface ProjectionResult {
  value: number
  variant: ProjectionVariant
  trend: TrendLabel
  confidence: ConfidenceLabel
}

/** BR-M08-24: projection = last AR + the mean step, clamped 0 to 100. Null when there is no AR. */
export function projectionOf(m: Pick<HeadcountMarks, 'actuals' | 'tov' | 'etr'>): ProjectionResult | null {
  const points = m.actuals.filter((v): v is number => v !== null)
  if (points.length === 0) return null
  const last = points[points.length - 1] as number
  const step = points.length < 2 ? 0 : (last - (points[0] as number)) / (points.length - 1)
  const value = Math.min(100, Math.max(0, round(last + step, 1)))
  const variant: ProjectionVariant = m.etr === null ? 'red' : value >= m.etr ? 'green' : 'amber'
  const delta = m.tov === null ? 0 : value - m.tov
  const trend: TrendLabel = delta > 3 ? 'Meningkat' : delta < -3 ? 'Menurun' : 'Stabil'
  const confidence: ConfidenceLabel = points.length >= 3 ? 'Tinggi' : points.length === 2 ? 'Sederhana' : 'Rendah'
  return { value, variant, trend, confidence }
}

export interface PredictionResult {
  etr: number
  rs: number
  diff: number
  verdict: PredictionVerdict
}

/** BR-M08-33: d = RS - ETR (1 decimal); |d| <= 5 exact, <= 10 near, else a large gap. */
export function predictionOf(m: Pick<HeadcountMarks, 'etr' | 'rs'>): PredictionResult | null {
  if (m.etr === null || m.rs === null) return null
  const diff = round(m.rs - m.etr, 1)
  const abs = Math.abs(diff)
  const verdict: PredictionVerdict = abs <= 5 ? 'Ramalan Tepat' : abs <= 10 ? 'Hampir Tepat' : 'Selisih Besar'
  return { etr: m.etr, rs: m.rs, diff, verdict }
}

/** Row tone of the pupil sections (S15). */
export function rowTone(ar: number | null, target: number | null): HeadcountTone {
  return ar === null ? 'noAr' : target === null ? 'noTarget' : ar >= target ? 'on' : 'below'
}

/** Value of a possibly missing numeric (Prisma Decimal | number | string | null) as a number or null. */
export function toNum(v: { toString(): string } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v.toString())
  return Number.isFinite(n) ? n : null
}

/** GPS grade points (plan section 3): A+ 0 ... G 9. */
export const GRADE_POINTS: Readonly<Record<Grade, number>> = {
  'A+': 0,
  A: 1,
  'A-': 2,
  'B+': 3,
  B: 4,
  'C+': 5,
  C: 6,
  D: 7,
  E: 8,
  G: 9,
}
