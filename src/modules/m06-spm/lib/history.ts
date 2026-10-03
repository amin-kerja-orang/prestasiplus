/**
 * S10 "Sejarah Kuiz SPM" helpers (SRS M06 FR-M06-62…66, BR-M06-20; rows are M05 #23 sessions).
 */

import type { PracticeMode } from '@/modules/m05-practice'

export type HistoryType = 'past_year' | 'latih_tubi' | 'ramalan'

export const SPM_MODES: readonly HistoryType[] = ['past_year', 'latih_tubi', 'ramalan']

export interface HistoryFilter {
  /** `null` is "Semua" (`/spm/history`). */
  type: HistoryType | null
  label: string
  /** Active: `bg-{colour}-500 text-white shadow-md`; inactive: white + slate border + coloured hover. */
  active: string
  hover: string
}

export const HISTORY_FILTERS: readonly HistoryFilter[] = [
  { type: null, label: 'Semua', active: 'bg-indigo-500', hover: 'hover:border-indigo-400' },
  {
    type: 'past_year',
    label: 'Tahun Lepas',
    active: 'bg-amber-500',
    hover: 'hover:border-amber-400',
  },
  {
    type: 'latih_tubi',
    label: 'Latih Tubi',
    active: 'bg-blue-500',
    hover: 'hover:border-blue-400',
  },
  {
    type: 'ramalan',
    label: 'Tracking A',
    active: 'bg-purple-500',
    hover: 'hover:border-purple-400',
  },
]

/** Type badge text and colour (FR-M06-63/66; Tracking A purple INFERRED). */
export const TYPE_BADGES: Record<HistoryType, { label: string; cls: string }> = {
  past_year: { label: 'Tahun Lepas', cls: 'bg-amber-100 text-amber-700' },
  latih_tubi: { label: 'Latih Tubi', cls: 'bg-blue-100 text-blue-700' },
  ramalan: { label: 'Tracking A', cls: 'bg-purple-100 text-purple-700' },
}

/** The `?type=` value when it is one of the three, else `null` (absent or unknown → all rows). */
export function parseHistoryType(raw: unknown): HistoryType | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'past_year' || v === 'latih_tubi' || v === 'ramalan' ? v : null
}

/** Score tile colour: red below 50%, yellow 50–79%, green from 80% (FR-M06-66). */
export function scoreTileClass(percent: number): string {
  if (percent < 50) return 'bg-red-100 text-red-600'
  if (percent < 80) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-600'
}

export const isSpmMode = (m: PracticeMode): m is HistoryType =>
  (SPM_MODES as readonly string[]).includes(m)
