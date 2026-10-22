import type { PkskBahagian, PkskGrade, PkskLevel, PkskPackageLevel } from '@pp/contract'
import { PKSK_ESSAY_MIN_CHARS } from '@pp/contract'

import { mytDay } from '../subscriptions/dates'

/** Pure M07 rules (SRS M07 section 4). No I/O. */

export const LEVELS: readonly PkskLevel[] = ['T1', 'T4']

/** BR-M07-19: `level` is case-sensitive T1 or T4. */
export const isLevel = (v: unknown): v is PkskLevel => v === 'T1' || v === 'T4'

/** BR-M07-10: A >= 80, B 65-79, C 50-64, D 40-49, E < 40. */
export function gradeOf(pct: number): PkskGrade {
  if (pct >= 80) return 'A'
  if (pct >= 65) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'E'
}

export const round1 = (v: number): number => Math.round((v + Number.EPSILON) * 10) / 10

export const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length

/** BR-M07-09 weights: 20 / 70 / 10. */
export function examScore(aPct: number, bPct: number, cPct: number): number {
  return round1(0.2 * aPct + 0.7 * bPct + 0.1 * cPct)
}

/** Levels a package unlocks (`ALL` = Kombo, both). */
export function levelsOfPackage(level: PkskPackageLevel): readonly PkskLevel[] {
  return level === 'ALL' ? LEVELS : [level]
}

/**
 * True while a grant's expiry has not passed: no expiry, or the expiry day is today or later in Malaysia time
 * (valid through the end of that day). `expiresAt` is a `YYYY-MM-DD` day.
 */
export function notExpired(expiresAt: string | null, now: Date): boolean {
  return expiresAt === null || expiresAt >= mytDay(now)
}

/** BR-M07-16: revoked, else expired once `expiresAt` is before today (MYT), else active. */
export function displayStatusOf(
  row: { status: 'active' | 'revoked'; expiresAt: string | null },
  now: Date,
): 'active' | 'expired' | 'revoked' {
  if (row.status === 'revoked') return 'revoked'
  return notExpired(row.expiresAt, now) ? 'active' : 'expired'
}

/** A real calendar date `YYYY-MM-DD`. */
export function isRealDay(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** What the scorer needs of a question (never leaves the server). */
export interface ScoredKey {
  /** Option count; 0 for a Bahagian C (essay) question. */
  optionCount: number
  /** Indexes of the options flagged correct (several or none are allowed, BR-M07-04). */
  correctIndexes: readonly number[]
}

export interface GivenAnswer {
  optionIndex?: number | null | undefined
  text?: string | null | undefined
}

/**
 * Server-side scoring (BR-M07-12): Bahagian A and B need the chosen option to be one flagged correct; a question
 * without options (Bahagian C) is accepted by the simulated marker when the trimmed text has at least
 * `PKSK_ESSAY_MIN_CHARS` characters (open question 5).
 */
export function isAnswerCorrect(key: ScoredKey, answer: GivenAnswer): boolean {
  if (key.optionCount === 0) return (answer.text ?? '').trim().length >= PKSK_ESSAY_MIN_CHARS
  const idx = answer.optionIndex
  if (idx === null || idx === undefined) return false
  return key.correctIndexes.includes(idx)
}

/** Bahagian percentage over the PLANNED count (not the served count), one decimal. */
export function bahagianPct(correct: number, planned: number): number {
  return round1((correct / planned) * 100)
}

export type Tally = Record<PkskBahagian, number>
