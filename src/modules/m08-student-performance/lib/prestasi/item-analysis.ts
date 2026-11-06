/**
 * Pure helpers of the S11 class item analysis (FR-M08-65…72, DV-M08-17, BR-M08-20).
 */

import type { ItemAnalysis } from '../../api/types'

export type DifficultyRow = ItemAnalysis['difficulty'][number]

export const SORT_OPTIONS = [
  { value: 'difficulty_desc', label: 'Paling Sukar Dahulu' },
  { value: 'difficulty_asc', label: 'Paling Mudah Dahulu' },
  { value: 'accuracy_asc', label: 'Ketepatan Rendah Dahulu' },
  { value: 'accuracy_desc', label: 'Ketepatan Tinggi Dahulu' },
  { value: 'attempts_desc', label: 'Paling Banyak Percubaan' },
] as const
export type SortKey = (typeof SORT_OPTIONS)[number]['value']

export const DEFAULT_SORT: SortKey = 'difficulty_desc'

/** An unknown `susun` query value is the default order. */
export const parseSort = (raw: unknown): SortKey => {
  const v = Array.isArray(raw) ? raw[0] : raw
  return SORT_OPTIONS.find((o) => o.value === v)?.value ?? DEFAULT_SORT
}

/** Search needs at least 2 characters (GLB-4, R1-GUR-6); one character filters nothing. */
export const SEARCH_MIN = 2
export const SEARCH_TOO_SHORT = 'Taip sekurang-kurangnya 2 aksara.'
export const searchTooShort = (search: string): boolean => search.trim().length === 1

/** The question is shown for a case-insensitive substring of its text (DV-M08-17, from 2 characters). */
export function filterRows(rows: readonly DifficultyRow[], search: string): DifficultyRow[] {
  const needle = search.trim().toLowerCase()
  return needle.length < SEARCH_MIN
    ? [...rows]
    : rows.filter((r) => r.text.toLowerCase().includes(needle))
}

/** The chosen order, ties by question id ascending (BR-M08-20). */
export function sortRows(rows: readonly DifficultyRow[], sort: SortKey): DifficultyRow[] {
  const key: Record<SortKey, (r: DifficultyRow) => number> = {
    difficulty_desc: (r) => -r.index,
    difficulty_asc: (r) => r.index,
    accuracy_asc: (r) => r.accuracy,
    accuracy_desc: (r) => -r.accuracy,
    attempts_desc: (r) => -r.attempts,
  }
  const k = key[sort]
  return [...rows].sort((a, b) => k(a) - k(b) || a.questionId - b.questionId)
}

/**
 * "Ketepatan" colour on the same bands as the Tahap badge (whole-number %, AC-GUR-6-11): red < 40, amber 40–70,
 * green > 70, so the colour and the badge always agree.
 */
export const accuracyClass = (v: number): string => {
  const whole = Math.round(v)
  return whole < 40 ? 'text-error' : whole <= 70 ? 'text-warning' : 'text-success'
}

/** Discrimination index colour: green ≥ 0.30, amber 0.20–0.29, red < 0.20 (FR-M08-72). */
export const indexClass = (v: number): string =>
  v >= 0.3 ? 'text-success' : v >= 0.2 ? 'text-warning' : 'text-error'

/** Indeks Kesukaran to 2 decimals, half up (the API sends it rounded; this keeps "0.50"). */
export const index2 = (v: number): string => v.toFixed(2)

export const STATUS_COLOR: Record<
  ItemAnalysis['discrimination']['rows'][number]['status'],
  'success' | 'info' | 'warning' | 'error'
> = {
  'Sangat Baik': 'success',
  Baik: 'info',
  Sederhana: 'warning',
  Lemah: 'error',
}

/** "{Subjek} — {Topik} — {Subtopik}" without the empty parts (shown under the question below 640px). */
export const topicLine = (r: Pick<DifficultyRow, 'subject' | 'topic' | 'subtopic'>): string =>
  [r.subject, r.topic, r.subtopic].filter((p): p is string => !!p).join(' — ')
