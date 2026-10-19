/**
 * Labels and heat classes of S4 (SRS M12 FR-M12-43 ... FR-M12-47). Full literals so Tailwind sees them;
 * colours are theme tokens only.
 */

import type { BandKey } from '../../../api/types'

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

/** α = max(0.15, n ÷ max) (BR-M12-13); a zero cell uses the flat muted layer instead. */
export const heatAlpha = (n: number, max: number) => (max > 0 ? Math.max(0.15, n / max) : 0.15)

/** Single-hue kobalt ramp of a heat cell: the alpha picks one of four steps; zero is a flat layer. */
export function heatClass(n: number, max: number): string {
  if (n === 0) return 'bg-muted text-dimmed'
  const a = heatAlpha(n, max)
  if (a < 0.3) return 'bg-cat-1/20 text-highlighted'
  if (a < 0.55) return 'bg-cat-1/40 text-highlighted'
  if (a < 0.8) return 'bg-cat-1/55 text-highlighted'
  return 'bg-cat-1 text-white dark:bg-cat-1/70 dark:text-highlighted'
}
