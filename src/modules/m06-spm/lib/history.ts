/**
 * "Sejarah Kuiz SPM" helpers (S3-T07 part F; `GET /api/spm/history`, API-BIJAK-07). The list is one merged,
 * server-paged list (15 per page) of the caller's closed SPM sittings; the page reads the chip from `?mod=`
 * (the old `?type=` link key is still read) and the page number from `?halaman=`.
 */

import { SPM_HISTORY_PAGE_SIZE, type SpmHistoryRowMode } from '@pp/contract'

import { formatMinSec, formatMyt } from '@/lib/time'

export { SPM_HISTORY_PAGE_SIZE }

/** A chip filter value sent to the API (`all` is "no filter" and is never sent). */
export type HistoryChip = 'databank' | 'latih_tubi' | 'tracking_a'

export interface HistoryFilter {
  /** `null` is "Semua" (`/spm/history`). */
  mod: HistoryChip | null
  label: string
  /** Phosphor icon of the pill. */
  icon: string
}

export const HISTORY_FILTERS: readonly HistoryFilter[] = [
  { mod: null, label: 'Semua', icon: 'i-ph-squares-four-bold' },
  { mod: 'databank', label: 'Tahun Lepas', icon: 'i-ph-scroll-bold' },
  { mod: 'latih_tubi', label: 'Latih Tubi', icon: 'i-ph-barbell-bold' },
  { mod: 'tracking_a', label: 'Tracking A', icon: 'i-ph-magic-wand-bold' },
]

type BadgeColor = 'warning' | 'info' | 'secondary' | 'primary' | 'neutral'

/** Row mode label and badge colour (OPT-MODE-SESI; a `databank` row reads "Tahun Lepas", as the chip does). */
export const MODE_BADGES: Record<SpmHistoryRowMode, { label: string; color: BadgeColor }> = {
  databank: { label: 'Tahun Lepas', color: 'warning' },
  latih_tubi: { label: 'Latih Tubi', color: 'info' },
  tracking_a: { label: 'Tracking A', color: 'secondary' },
  simulasi: { label: 'Bijak SPM', color: 'primary' },
  subjektif: { label: 'Subjektif', color: 'neutral' },
  structured: { label: 'Soalan Berstruktur', color: 'neutral' },
  kuiz: { label: 'Simulasi - Kuiz', color: 'neutral' },
}

const first = (raw: unknown): unknown => (Array.isArray(raw) ? raw[0] : raw)

/** The chip a `?mod=` / `?type=` value stands for; the legacy `past_year` and `ramalan` map to their chips. */
const CHIP_OF: Record<string, HistoryChip | null> = {
  all: null,
  databank: 'databank',
  past_year: 'databank',
  latih_tubi: 'latih_tubi',
  tracking_a: 'tracking_a',
  ramalan: 'tracking_a',
}

/**
 * The chip of the page URL: `mod` wins over the old `type` key. `undefined` = a missing or unknown value (no filter is
 * sent and, when the value is present but unknown, no pill is active); `null` = "Semua".
 */
export function parseHistoryMod(query: { mod?: unknown; type?: unknown }): HistoryChip | null | undefined {
  const raw = first(query.mod) ?? first(query.type)
  if (raw === undefined) return null
  return typeof raw === 'string' && raw in CHIP_OF ? CHIP_OF[raw] : undefined
}

/** The 1-based `?halaman=`; anything that is not a positive whole number is page 1. */
export function parseHistoryPage(raw: unknown): number {
  const v = first(raw)
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : 1
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}

/** The page URL of a chip and page (`halaman` is left out on page 1). */
export function historyHref(mod: HistoryChip | null, page = 1): string {
  const parts: string[] = []
  if (mod !== null) parts.push(`mod=${mod}`)
  if (page > 1) parts.push(`halaman=${page}`)
  return parts.length === 0 ? '/spm/history' : `/spm/history?${parts.join('&')}`
}

/** Score badge colour: error below 50%, warning 50–79%, success from 80% (FR-M06-66). */
export function scoreColor(percent: number): 'error' | 'warning' | 'success' {
  if (percent < 50) return 'error'
  if (percent < 80) return 'warning'
  return 'success'
}

/** A whole-number accuracy "{n}%", or "—" when there are no answers (`null`). */
export function formatAccuracy(value: number | null): string {
  return value === null ? '—' : `${value}%`
}

/** Row duration "{m}m {s}s" (e.g. "37m 32s"). */
export const formatHistoryDuration = (seconds: number): string => formatMinSec(seconds)

/** Row date with BM month names, 12-hour clock: "23 Okt 2026, 08:06 PM". */
export const formatHistoryDate = (iso: string): string => formatMyt(iso, 'd MMM yyyy, hh:mm A')

/** The pager text "Halaman {p} daripada {n}". */
export const pagerText = (page: number, pageCount: number): string => `Halaman ${page} daripada ${pageCount}`
