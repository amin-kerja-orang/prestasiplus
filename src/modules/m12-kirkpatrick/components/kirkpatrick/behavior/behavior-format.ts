/**
 * Class strings and labels of S4 (SRS M12 FR-M12-43 ... FR-M12-47). Full literals so Tailwind sees them.
 * Colours are the hex values of BR-M12-12 / FN-M12-2.6.1 as their Tailwind palette equivalents.
 */

import type { BandKey } from '../../../api/types'

/** Solid fill of a band (bars, Tahap pills). */
export const BAND_FILL: Record<BandKey, string> = {
  champion: 'bg-green-700',
  konsisten: 'bg-blue-600',
  berkembang: 'bg-yellow-600',
  minimum: 'bg-orange-600',
  tidakTerlibat: 'bg-red-600',
}

/** Captions of the S4 band tiles as live (">50 soalan"; DV-M12-10 rejected, the boundaries are >= 50 / 20-49). */
export const BAND_CAPTION: Record<BandKey, string> = {
  champion: '>50 soalan',
  konsisten: '20-50 soalan',
  berkembang: '5-20 soalan',
  minimum: '<5 soalan',
  tidakTerlibat: '0 soalan',
}

/** Rows of the heat table, Monday first. */
export const HEAT_DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'] as const

/** Hours 06 ... 23 (BR-M12-13). */
export const HEAT_HOURS = Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, '0'))

/** The `title` of a heat cell: "{Hari} {HH}:00 — {n} soalan". */
export const heatTitle = (day: string, hour: string, n: number) => `${day} ${hour}:00 — ${n} soalan`

/** α = max(0.15, n ÷ max) (BR-M12-13); a zero cell uses the flat slate background instead. */
export const heatAlpha = (n: number, max: number) => (max > 0 ? Math.max(0.15, n / max) : 0.15)
