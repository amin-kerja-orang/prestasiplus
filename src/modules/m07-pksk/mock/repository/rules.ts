/** Pure M07 rules (SRS M07 v1.7 §4): grades, levels, access status, scoring helpers. */

import { formatDateKey } from '@/lib/time'

import type { Grade, PkskAccessRow, PkskLevel } from './types'

export const LEVELS: readonly PkskLevel[] = ['T1', 'T4']

/** BR-M07-19: `level` is case-sensitive T1 or T4. */
export const isLevel = (v: unknown): v is PkskLevel => v === 'T1' || v === 'T4'

/** BR-M07-10: A >= 80, B 65-79, C 50-64, D 40-49, E < 40. */
export function gradeOf(pct: number): Grade {
  if (pct >= 80) return 'A'
  if (pct >= 65) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'E'
}

export const round1 = (v: number): number => Math.round((v + Number.EPSILON) * 10) / 10

/** BR-M07-09 weights (the S1 format card): 20 / 70 / 10. */
export function examScore(aPct: number, bPct: number, cPct: number): number {
  return round1(0.2 * aPct + 0.7 * bPct + 0.1 * cPct)
}

/** BR-M07-16: revoked, else expired once `expiresAt` is before today (MYT), else active. */
export function displayStatusOf(
  row: Pick<PkskAccessRow, 'status' | 'expiresAt'>,
  nowMs: number,
): 'active' | 'expired' | 'revoked' {
  if (row.status === 'revoked') return 'revoked'
  if (row.expiresAt !== null && row.expiresAt < formatDateKey(nowMs)) return 'expired'
  return 'active'
}
