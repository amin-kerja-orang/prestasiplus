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

/** S6 "Purata" badge colour (FR-M04-61; thresholds INFERRED, every live value is the green one). */
export function averageColor(average: number): 'success' | 'warning' | 'error' {
  if (average >= 76) return 'success'
  if (average > 50) return 'warning'
  return 'error'
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
