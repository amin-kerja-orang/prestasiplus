import type { TeacherReport } from '../../api/types'

/** BR-M11-06: 7, 30 or 90; anything else is 30. */
export function parseRange(raw: unknown): 7 | 30 | 90 {
  const v = Array.isArray(raw) ? raw[0] : raw
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN
  return n === 7 || n === 90 ? n : 30
}

/** A positive integer query value, else `undefined` (an unknown id is tolerated by the API). */
export function parseId(raw: unknown): number | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string' || !/^\d+$/.test(v.trim())) return undefined
  const n = Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : undefined
}

/** BR-M11-11: counts with thousands separators ("4,158"). */
export const grouped = (n: number): string => n.toLocaleString('en-US')

/** BR-M11-02 / 03: integer percentage, "0%" when the population is empty. */
export const pctInt = (part: number, whole: number): string =>
  `${whole === 0 ? 0 : Math.round((part / whole) * 100)}%`

export type Band = 'green' | 'amber' | 'red'

/** BR-M11-22: ≥ 70 green; 50–69.9 amber; < 50 red. */
export const bandOf = (p: number): Band => (p >= 70 ? 'green' : p >= 50 ? 'amber' : 'red')

export const SCORE_TEXT: Record<Band, string> = {
  green: 'text-success',
  amber: 'text-warning',
  red: 'text-error',
}
export const SCORE_COLOR: Record<Band, 'success' | 'warning' | 'error'> = {
  green: 'success',
  amber: 'warning',
  red: 'error',
}

export type ScoreKey = keyof TeacherReport['score']['byType']
export type ActivityKey = keyof TeacherReport['activity']['byType']
