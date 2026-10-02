/**
 * Helpers of M04 S5 import, S5h history and S6 quality (M04-T5; SRS FR-M04-53…63).
 * Full class strings live in the pages (overview §8.2 rule 2); this file holds paths and formatting.
 */

export const IMPORT_PATH = '/admin/questions/import'
export const IMPORT_HISTORY_PATH = '/admin/questions/import-history'
export const QUALITY_PATH = '/admin/questions/quality'

export const IMPORT_ROUTES = {
  import: 'm04.imports.form',
  history: 'm04.imports.history',
  quality: 'm04.quality',
} as const

/** S6 "Purata" pill colours (FR-M04-61; thresholds INFERRED, every live value is emerald). */
export function averagePillClass(average: number): string {
  if (average >= 76) return 'bg-emerald-100 text-emerald-700'
  if (average > 50) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

/** Below this width a distribution label does not fit inside its segment (D9: live clips it). */
export const NARROW_SEGMENT_PCT = 8

export const DIFFICULTY_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Sangat Mudah' },
  { value: 2, label: 'Mudah' },
  { value: 3, label: 'Sederhana' },
  { value: 4, label: 'Sukar' },
  { value: 5, label: 'Sangat Sukar' },
]
