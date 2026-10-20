import {
  PRACTICE_READS_HISTORY_BADGES,
  PRACTICE_READS_MASTERY_LABELS,
  PRACTICE_READS_MASTERY_THRESHOLDS,
  type PracticeReadMasteryCardSchema,
} from '@pp/contract'
import type { z } from 'zod'

import { toMytTimestamp } from '../../../../common/time/myt'

/** Pure helpers of the analytics reads: rounding, Malaysia-time windows and the mastery card (BR-20). */

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

/** Rounds to `digits` decimals (half away from zero for the non-negative values used here); same as the mock. */
export function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round((value + Number.EPSILON) * f) / f
}

/** Percentage `part / whole x 100`, or 0 when `whole` is 0. */
export const pct = (part: number, whole: number): number => (whole === 0 ? 0 : (part / whole) * 100)

/** 00:00 Malaysia time of the day of `ms`, epoch ms. */
export function startOfMytDay(ms: number): number {
  return Math.floor((ms + MYT_OFFSET_MS) / DAY_MS) * DAY_MS - MYT_OFFSET_MS
}

/** `YYYY-MM-DD` of `ms` in Malaysia time. */
export function mytDateKey(ms: number): string {
  return new Date(ms + MYT_OFFSET_MS).toISOString().slice(0, 10)
}

/** Monday 00:00 (Malaysia time) of the week of `ms`. */
export function weekStartOf(ms: number): number {
  const day = startOfMytDay(ms)
  const dow = new Date(day + MYT_OFFSET_MS).getUTCDay()
  return day - ((dow + 6) % 7) * DAY_MS
}

export interface Window {
  from: number
  to: number
}

export function monthWindow(ms: number): Window {
  const d = new Date(ms + MYT_OFFSET_MS)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  return { from: Date.UTC(y, m, 1) - MYT_OFFSET_MS, to: Date.UTC(y, m + 1, 1) - MYT_OFFSET_MS }
}

export function yearWindow(ms: number): Window {
  const y = new Date(ms + MYT_OFFSET_MS).getUTCFullYear()
  return { from: Date.UTC(y, 0, 1) - MYT_OFFSET_MS, to: Date.UTC(y + 1, 0, 1) - MYT_OFFSET_MS }
}

/** `[from, to)` of the month `YYYY-MM` in Malaysia time. */
export function monthKeyWindow(key: string): Window {
  const [y, m] = key.split('-').map(Number) as [number, number]
  return { from: Date.UTC(y, m - 1, 1) - MYT_OFFSET_MS, to: Date.UTC(y, m, 1) - MYT_OFFSET_MS }
}

export const monthKeyOf = (ms: number): string => mytDateKey(ms).slice(0, 7)

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const t = y * 12 + (m - 1) + delta
  return `${String(Math.floor(t / 12)).padStart(4, '0')}-${String((t % 12) + 1).padStart(2, '0')}`
}

export const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/** Day label `DD/MM` of a `YYYY-MM-DD` key. */
export const dayLabel = (key: string): string => `${key.slice(8, 10)}/${key.slice(5, 7)}`

/** BR-20: the level reached with `correct` right answers (L0 to L10). */
export function masteryLevel(correct: number): number {
  let level = 0
  for (const [i, t] of PRACTICE_READS_MASTERY_THRESHOLDS.entries()) if (correct >= t) level = i
  return level
}

export type MasteryCard = z.infer<typeof PracticeReadMasteryCardSchema>

export function masteryCard(
  subject: { code: string; name: string; icon: string | null; color: string },
  m: { correct: number; answered: number; lastAnsweredAt: Date | null },
): MasteryCard {
  const level = masteryLevel(m.correct)
  const last = level === PRACTICE_READS_MASTERY_THRESHOLDS.length - 1
  const from = PRACTICE_READS_MASTERY_THRESHOLDS[level] as number
  const to = last ? null : (PRACTICE_READS_MASTERY_THRESHOLDS[level + 1] as number)
  return {
    code: subject.code,
    name: subject.name,
    icon: subject.icon,
    color: subject.color,
    level,
    label: PRACTICE_READS_MASTERY_LABELS[level] as string,
    correct: m.correct,
    answered: m.answered,
    accuracyPct: round(pct(m.correct, m.answered), 1),
    nextLevel: last ? null : level + 1,
    nextThreshold: to,
    barPct: to === null ? 100 : round(((m.correct - from) / (to - from)) * 100, 1),
    xpMultiplier: level >= 2 ? round(1 + 0.05 * (level - 1), 2) : null,
    lastAnsweredAt: m.lastAnsweredAt ? toMytTimestamp(m.lastAnsweredAt) : null,
  }
}

export const historyBadge = (mode: keyof typeof PRACTICE_READS_HISTORY_BADGES) => ({ ...PRACTICE_READS_HISTORY_BADGES[mode] })
