/**
 * M25 client functions (SRS M25 v1.2 §7 #1-#2). UI tasks import these and do not change this file
 * (build-plan §S.3 rule 5).
 */

import { api } from '@/api'

import { DUTA_PATH, HEATMAP_PATH } from './settings'
import type { DutaCard, HeatmapResponse } from './types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #1 `GET /api/buku-nota/heatmap` (student and admin; others 403). */
export function getHeatmap(options: Signal = {}): Promise<HeatmapResponse> {
  return api.get<HeatmapResponse>(HEATMAP_PATH, withSignal(options))
}

/** #2 `GET /api/duta/recommendations` (owned by M24): one card or `null`. */
export function getDutaRecommendation(options: Signal = {}): Promise<DutaCard | null> {
  return api.get<DutaCard | null>(DUTA_PATH, withSignal(options))
}
