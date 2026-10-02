/**
 * S20 `/leaderboard` "Papan Pendahulu" helpers (SRS M08 FR-M08-114..118, BR-M08-28).
 */

import type { LeaderboardPeriod } from '../api/types'

export const LEADERBOARD_PATH = '/leaderboard'

export const PERIOD_TABS: readonly { id: LeaderboardPeriod; label: string }[] = [
  { id: 'all', label: 'Semua Masa' },
  { id: 'week', label: 'Minggu Ini' },
  { id: 'month', label: 'Bulan Ini' },
]

/** No or unknown `period` is the week (FR-M08-114). */
export function readPeriod(
  value: string | null | (string | null)[] | undefined,
): LeaderboardPeriod {
  const first = Array.isArray(value) ? value[0] : value
  return PERIOD_TABS.find((p) => p.id === first)?.id ?? 'week'
}

/**
 * Accuracy pill (FR-M08-117): green from 80, amber 60 to 79.9, red below 60 on the unrounded value.
 * The API rounds to one decimal, so a displayed "60%" can be either; the API value is what is tested.
 */
export function pillClass(accuracy: number): string {
  if (accuracy >= 80) return 'bg-green-100 text-green-700'
  if (accuracy >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

/** Rank circle of the table (FR-M08-117). */
export function rankCircleClass(rank: number): string {
  if (rank === 1) return 'bg-amber-100 text-amber-700'
  if (rank === 2) return 'bg-slate-200 text-slate-700'
  if (rank === 3) return 'bg-orange-100 text-orange-700'
  return 'bg-slate-50 text-slate-500'
}

/** Whole-percent display of an accuracy ("98%"; the API already caps at 100, BR-M08-05). */
export const percentText = (accuracy: number): string => `${String(Math.round(accuracy))}%`

/** Initial for an avatar placeholder (no real photos exist, avatars are fictitious). */
export const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?'
