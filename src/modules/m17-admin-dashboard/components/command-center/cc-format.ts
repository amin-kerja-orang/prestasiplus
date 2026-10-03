/**
 * Shared formatting, labels and class strings of the S4-S7 Command Center drill-down (M17-T3a;
 * SRS M17 §3 FR-M17-48..60, URS FN-M17-5.x). The pages are standalone dark pages (live S4-S7).
 */

import { formatCount, formatNumber } from '@/lib/number'
import { formatMyt } from '@/lib/time'

import type { Mood } from '../../api/command-center-types'

/** `82.3%` (1 decimal, BR-M17-06). */
export const pct1 = (value: number) => `${formatNumber(value, { decimals: 1 })}%`
/** `80.00%` (2 decimals: the session tables). */
export const pct2 = (value: number) => `${formatNumber(value, { decimals: 2 })}%`
export const count = formatCount
/** `2 decimals`, "-" for a missing value (headcount TOV / ETR / RS). */
export const score2 = (value: number | null) =>
  value === null ? '-' : formatNumber(value, { decimals: 2, grouping: false })

/** `dd/mm HH:MM` MYT, "-" when the pupil never answered. */
export const dayMonthTime = (iso: string | null) => (iso ? formatMyt(iso, 'dd/MM HH:mm') : '-')
/** `dd/mm/yyyy HH:MM` MYT. */
export const dmyTime = (iso: string) => formatMyt(iso, 'dd/MM/yyyy HH:mm')
/** `HH:MM:SS` MYT. */
export const hms = (iso: string) => formatMyt(iso, 'HH:mm:ss')
/** `dd/mm/yyyy` of a `YYYY-MM-DD` key (no timezone maths on a date-only value). */
export function dmyOfKey(key: string): string {
  const [y = '', m = '', d = ''] = key.split('-')
  return `${d}/${m}/${y}`
}

export interface MoodInfo {
  emoji: string
  label: string
}

/** Appendix A.2 of the discovery: S6 and S7 dots use 😩 for "stressed"; the S7 modal uses 😥. */
export const MOOD: Record<Mood, MoodInfo> = {
  happy: { emoji: '😊', label: 'Gembira' },
  okay: { emoji: '😐', label: 'OK' },
  sad: { emoji: '😢', label: 'Sedih' },
  stressed: { emoji: '😩', label: 'Tekanan' },
}
export const MOOD_MODAL_EMOJI: Record<Mood, string> = {
  happy: '😊',
  okay: '😐',
  sad: '😢',
  stressed: '😥',
}

export type AccuracyTone = 'emerald' | 'amber' | 'rose'
/** FN-M17-5.4.10: >= 70 emerald, < 50 rose, else amber. */
export function accuracyTone(value: number): AccuracyTone {
  if (value >= 70) return 'emerald'
  if (value < 50) return 'rose'
  return 'amber'
}
export const TONE_TEXT: Record<AccuracyTone, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
}
export const TONE_BAR: Record<AccuracyTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
}

/** FN-M17-5.4.9: A+/A/A- emerald, D/E/G rose, else amber. */
export function gradeTone(grade: string | null): AccuracyTone {
  if (grade === 'A+' || grade === 'A' || grade === 'A-') return 'emerald'
  if (grade === 'D' || grade === 'E' || grade === 'G') return 'rose'
  return 'amber'
}

/** Class strings of the dark tables (min 12 px text, NFR-M17-04). */
export const CC_TABLE = {
  table: 'w-full border-collapse text-left',
  th: 'px-2 py-3 text-xs font-semibold tracking-wider text-slate-400 uppercase',
  td: 'px-2 py-3 align-middle text-sm text-slate-300',
  row: 'border-t border-slate-700/60 transition hover:bg-slate-700/40',
  rowLink: 'cursor-pointer',
  mono: 'font-mono',
} as const

export const LOAD_ERROR_COPY = 'Ralat memuatkan data'

/** What the S7 sessions modal lists: one week, every session, or one subject. */
export type CcSessionsSource =
  | { kind: 'week'; start: string; end: string; label: string }
  | { kind: 'all' }
  | { kind: 'subject'; code: string; name: string }
