/**
 * Shared formatting, labels and class strings of the S4-S7 Command Center drill-down (M17-T3a;
 * SRS M17 §3 FR-M17-48..60, URS FN-M17-5.x). The pages draw the staff theme (v2).
 */

import type { StatItem } from '@/ds'

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
  icon: string
  label: string
}

/** S6 and S7 dots (Appendix A.2 of the discovery): the mood as a Phosphor face and its label. */
export const MOOD: Record<Mood, MoodInfo> = {
  happy: { icon: 'i-ph-smiley', label: 'Gembira' },
  okay: { icon: 'i-ph-smiley-meh', label: 'OK' },
  sad: { icon: 'i-ph-smiley-sad', label: 'Sedih' },
  stressed: { icon: 'i-ph-smiley-nervous', label: 'Tekanan' },
}
export const MOOD_MODAL_ICON: Record<Mood, string> = {
  happy: 'i-ph-smiley',
  okay: 'i-ph-smiley-meh',
  sad: 'i-ph-smiley-sad',
  stressed: 'i-ph-smiley-nervous',
}

/** The semantic colour of an accuracy or grade (also the `UProgress` colour). */
export type AccuracyTone = 'success' | 'warning' | 'error'
/** FN-M17-5.4.10: >= 70 success, < 50 error, else warning. */
export function accuracyTone(value: number): AccuracyTone {
  if (value >= 70) return 'success'
  if (value < 50) return 'error'
  return 'warning'
}
export const TONE_TEXT: Record<AccuracyTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}

/** FN-M17-5.4.9: A+/A/A- success, D/E/G error, else warning. */
export function gradeTone(grade: string | null): AccuracyTone {
  if (grade === 'A+' || grade === 'A' || grade === 'A-') return 'success'
  if (grade === 'D' || grade === 'E' || grade === 'G') return 'error'
  return 'warning'
}

/** Live copy of the S7 dialog load failures (FN-M17-5.4.x, observed). */
export const MODAL_ERROR_COPY = 'Ralat memuatkan data'

/** The label / value pairs of the S7 dialogs as `DsStatRow` items. */
export function statItems(stats: { label: string; value: string }[]): StatItem[] {
  return stats.map((s) => ({ key: s.label, label: s.label, value: s.value }))
}

/** What the S7 sessions modal lists: one week, every session, or one subject. */
export type CcSessionsSource =
  | { kind: 'week'; start: string; end: string; label: string }
  | { kind: 'all' }
  | { kind: 'subject'; code: string; name: string }
