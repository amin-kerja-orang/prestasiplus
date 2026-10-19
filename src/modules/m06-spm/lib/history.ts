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
  /** Phosphor icon of the pill. */
  icon: string
}

export const HISTORY_FILTERS: readonly HistoryFilter[] = [
  { type: null, label: 'Semua', icon: 'i-ph-squares-four-bold' },
  { type: 'past_year', label: 'Tahun Lepas', icon: 'i-ph-scroll-bold' },
  { type: 'latih_tubi', label: 'Latih Tubi', icon: 'i-ph-barbell-bold' },
  { type: 'ramalan', label: 'Tracking A', icon: 'i-ph-magic-wand-bold' },
]

/** Type badge text and colour (FR-M06-63/66; Tracking A purple INFERRED). */
export const TYPE_BADGES: Record<
  HistoryType,
  { label: string; color: 'warning' | 'info' | 'secondary' }
> = {
  past_year: { label: 'Tahun Lepas', color: 'warning' },
  latih_tubi: { label: 'Latih Tubi', color: 'info' },
  ramalan: { label: 'Tracking A', color: 'secondary' },
}

/** The `?type=` value when it is one of the three, else `null` (absent or unknown → all rows). */
export function parseHistoryType(raw: unknown): HistoryType | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'past_year' || v === 'latih_tubi' || v === 'ramalan' ? v : null
}

/** Score badge colour: error below 50%, warning 50–79%, success from 80% (FR-M06-66). */
export function scoreColor(percent: number): 'error' | 'warning' | 'success' {
  if (percent < 50) return 'error'
  if (percent < 80) return 'warning'
  return 'success'
}

export const isSpmMode = (m: PracticeMode): m is HistoryType =>
  (SPM_MODES as readonly string[]).includes(m)
