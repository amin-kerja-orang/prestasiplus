/**
 * Pure performance rules, ported from the M08 mock (`rules.ts`, SRS M08 v1.11 section 4): grades,
 * rounding, accuracy cap, difficulty, discrimination, trend, projection, risk. No store access.
 */
import { PROJECTION_BAND, TREND_DELTA } from './constants'

export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const
export type Grade = (typeof GRADES)[number]

/** BR-M08-02: percentage to grade. */
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

/** Rounds half away from zero to `digits` decimals. */
export function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f
}

/** `part / whole * 100`, or 0 when `whole` is 0. */
export const pct = (part: number, whole: number): number => (whole === 0 ? 0 : (part / whole) * 100)

/** DV-07: every displayed accuracy is capped at 100. */
export const capPercent = (value: number): number => Math.min(value, 100)

/** Displayed accuracy: marks-weighted, capped, 1 decimal. */
export const accuracyOf = (score: number, max: number): number => round(capPercent(pct(score, max)), 1)

export type DifficultyLevel = 'Mudah' | 'Sederhana' | 'Sukar'

/** BR-M08-18: index = 1 - p, 2 decimals. */
export function difficultyIndex(correct: number, attempts: number): number {
  return attempts === 0 ? 0 : round(1 - correct / attempts, 2)
}

export function difficultyLevel(index: number): DifficultyLevel {
  if (index > 0.7) return 'Sukar'
  if (index <= 0.3) return 'Mudah'
  return 'Sederhana'
}

export type DiscriminationStatus = 'Sangat Baik' | 'Baik' | 'Sederhana' | 'Lemah'

/** BR-M08-19. */
export function discriminationStatus(d: number): DiscriminationStatus {
  if (d >= 0.4) return 'Sangat Baik'
  if (d >= 0.3) return 'Baik'
  if (d >= 0.2) return 'Sederhana'
  return 'Lemah'
}

export type Trend = 'up' | 'down' | 'stable'

/** Accuracy (percent) of the recent window against the one before; stable if either has no graded marks. */
export function trendOf(recent: { score: number; max: number }, before: { score: number; max: number }): Trend {
  if (recent.max === 0 || before.max === 0) return 'stable'
  const d = pct(recent.score, recent.max) - pct(before.score, before.max)
  return d >= TREND_DELTA ? 'up' : d <= -TREND_DELTA ? 'down' : 'stable'
}

/** Projected grade range, clamped to 0..100 first. */
export function projection(accuracy: number): { low: Grade; high: Grade } {
  const clamp = (v: number) => Math.min(100, Math.max(0, v))
  return {
    low: gradeOfPercent(clamp(accuracy - PROJECTION_BAND)),
    high: gradeOfPercent(clamp(accuracy + PROJECTION_BAND)),
  }
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

/** OQ-8: risk from the grade of the accuracy (E/G critical, D high, C and C+ medium, else low). */
export function riskOfAccuracy(accuracy: number): RiskLevel {
  const g = gradeOfPercent(accuracy)
  if (g === 'E' || g === 'G') return 'critical'
  if (g === 'D') return 'high'
  if (g === 'C' || g === 'C+') return 'medium'
  return 'low'
}

export const RISK_LEVELS: readonly RiskLevel[] = ['critical', 'high', 'medium', 'low']

/** Unknown filter value means "all". */
export const parseRiskLevel = (v: string | undefined): RiskLevel | '' =>
  RISK_LEVELS.includes(v as RiskLevel) ? (v as RiskLevel) : ''

/** Decimal-string ids in numeric order (shorter first, then lexicographic). */
export const compareIds = (a: string, b: string): number => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)

export const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length)
