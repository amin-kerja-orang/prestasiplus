/** M25 constants (SRS M25 v1.2 §6.3). */

import type { HeatmapBand } from './types'

/** K-M25-01: the minimum answers a chapter needs to be shown (any value 3-5 reproduces the observation). */
export const HEATMAP_MIN_ATTEMPTS = 5

/** BR-M25-03: red below 50, amber 50-79, green from 80 (on the rounded percent). */
export function bandOf(percent: number): HeatmapBand {
  if (percent < 50) return 'red'
  if (percent < 80) return 'amber'
  return 'green'
}

/** FR-M25-27: `round(100 x correct / attempts)`, half up, in integer arithmetic. */
export function percentOf(correct: number, attempts: number): number {
  return attempts <= 0 ? 0 : Math.floor((200 * correct + attempts) / (2 * attempts))
}

export const HEATMAP_PATH = '/api/buku-nota/heatmap'
export const DUTA_PATH = '/api/duta/recommendations'
