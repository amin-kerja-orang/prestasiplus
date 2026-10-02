/**
 * DATA-M11-02 MonitoringSettings (SRS M11 v1.10 §6.3): constants owned by M11, and the observed
 * anomaly-flag counts of DATA-M11-01 (§6.2, §6.7). Nothing here is a count that a dataset reproduces:
 * every engagement figure is computed per request from the owners' datasets (D11).
 */

import type { MonitoringPeriod, TahapKey } from '../../api/types'

export interface TahapBand {
  key: TahapKey
  colour: string
}

/** BR-M11-12 bands, best first (the thresholds are in `../repository/rules.ts`). */
export const TAHAP_BANDS: readonly TahapBand[] = [
  { key: 'Cemerlang', colour: '#15803d' },
  { key: 'Sederhana', colour: '#ea580c' },
  { key: 'Rendah', colour: '#dc2626' },
  { key: 'Kritikal', colour: '#991b1b' },
  { key: 'Tiada Langsung', colour: '#6b7280' },
]

/** FN-M11-3.2.1 "Negeri" options (the states that have schools with users, INFERRED). */
export const MONITORING_STATES: readonly string[] = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Melaka',
  'Pahang',
  'Perak',
  'Sabah',
  'Selangor',
  'Terengganu',
]

export const MONITORING_SETTINGS = {
  /** Monday of M1 (BR-M11-15). */
  monitoringStartDate: '2026-02-16',
  refreshSeconds: 300,
  guideStorageKey: 'hideMonitoringGuide',
  tahapBands: TAHAP_BANDS,
  ranges: [7, 30, 90],
  periods: { '': 'Semua Masa', '7d': '7 Hari', '30d': '30 Hari', '3m': '3 Bulan' } as Record<
    MonitoringPeriod,
    string
  >,
  states: MONITORING_STATES,
} as const

/** Epoch ms of M1's Monday 00:00 (MYT). */
export const M1_START_MS = Date.parse(`${MONITORING_SETTINGS.monitoringStartDate}T00:00:00+08:00`)

/**
 * DATA-M11-01 observed counts per school (SRS §6.7 "Anomaly flags"): `[review, excluded]`. Which pupils
 * carry a flag is not observable (Q-M11-4); the seed picks answering pupils deterministically
 * (`../seeds/seed.ts`, INFERRED).
 */
export const FLAG_COUNTS: Readonly<Record<number, readonly [review: number, excluded: number]>> = {
  8080: [10, 9],
  8078: [14, 4],
  8082: [6, 14],
  8106: [13, 3],
  8090: [5, 5],
  8087: [3, 0],
  10220: [1, 0],
}
