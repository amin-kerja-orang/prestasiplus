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

/** The question is shown for a case-insensitive substring of its text (DV-M08-17). */
export function filterRows(rows: readonly DifficultyRow[], search: string): DifficultyRow[] {
  const needle = search.trim().toLowerCase()
  return needle === '' ? [...rows] : rows.filter((r) => r.text.toLowerCase().includes(needle))
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

/** "Ketepatan" colour: red < 40, amber 40–74.9, green ≥ 75 (BR-M08-05). */
export const accuracyClass = (v: number): string =>
  v < 40 ? 'text-error' : v < 75 ? 'text-warning' : 'text-success'

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
