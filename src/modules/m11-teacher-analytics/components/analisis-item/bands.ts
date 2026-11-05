import type { ItemAnalysisRow } from '../../api/types'
import { ITEM_COPY } from './copy'

/** FN-M11-5.1.3 legend dots / BR-M11-28 bands: token colours. */
export const BAND_COLOR: Record<ItemAnalysisRow['band'], 'success' | 'warning' | 'error'> = {
  mudah: 'success',
  sederhana: 'warning',
  sukar: 'error',
}

/** The question text cut to 80 characters (FN-M11-5.1.5). */
export function clip80(text: string): string {
  const chars = [...text.trim()]
  return chars.length > 80 ? `${chars.slice(0, 80).join('')}…` : chars.join('')
}

/** "% betul" as a whole number rounded half up (decision 11, XS-5): 57.9 → "58%", 12.5 → "13%". */
export const pctLabel = (p: number): string => `${String(Math.round(p))}%`

/** One Tahap rule on the whole-number % betul (DV-GUR-6-1, AC-GUR-6-11): > 70 Mudah, 40–70 Sederhana, < 40 Sukar. */
export function tahapOf(p: number): ItemAnalysisRow['band'] {
  const whole = Math.round(p)
  return whole > 70 ? 'mudah' : whole >= 40 ? 'sederhana' : 'sukar'
}

/** D to 2 decimals; "Data Tidak Mencukupi" when it cannot be computed (fewer than 10 pupils, D113). */
export const discLabel = (d: number | null): string =>
  d === null ? ITEM_COPY.insufficient : d.toFixed(2)

// ---------------------------------------------------------------------------------------------
// Search, sort and the "Tahap Kesukaran" filter (R1-GUR-6: query `q`, `susun`, `tahap`)
// ---------------------------------------------------------------------------------------------

export const SORT_OPTIONS = [
  { value: 'difficulty_desc', label: 'Paling Sukar Dahulu' },
  { value: 'difficulty_asc', label: 'Paling Mudah Dahulu' },
  { value: 'accuracy_asc', label: 'Ketepatan Rendah Dahulu' },
  { value: 'accuracy_desc', label: 'Ketepatan Tinggi Dahulu' },
  { value: 'attempts_desc', label: 'Paling Banyak Percubaan' },
] as const
export type SortKey = (typeof SORT_OPTIONS)[number]['value']
export const DEFAULT_SORT: SortKey = 'difficulty_desc'
export const parseSort = (raw: unknown): SortKey => {
  const v = Array.isArray(raw) ? raw[0] : raw
  return SORT_OPTIONS.find((o) => o.value === v)?.value ?? DEFAULT_SORT
}

export const TAHAP_OPTIONS = [
  { value: '', label: ITEM_COPY.allTahap },
  { value: 'mudah', label: ITEM_COPY.legendMudah },
  { value: 'sederhana', label: ITEM_COPY.legendSederhana },
  { value: 'sukar', label: ITEM_COPY.legendSukar },
] as const
export type TahapFilter = '' | ItemAnalysisRow['band']
export const parseTahap = (raw: unknown): TahapFilter => {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'mudah' || v === 'sederhana' || v === 'sukar' ? v : ''
}

export const SEARCH_MIN = 2
/** One character is neither a search nor a filter: the hint shows and the rows stay (GLB-4). */
export const searchTooShort = (q: string): boolean => q.trim().length === 1

/** Search over the question text, the Tahap filter on the whole-number %, then the chosen order (ties by question id). */
export function visibleRows(
  rows: readonly ItemAnalysisRow[],
  opts: { q: string; tahap: TahapFilter; sort: SortKey },
): ItemAnalysisRow[] {
  const needle = opts.q.trim().toLowerCase()
  const key: Record<SortKey, (r: ItemAnalysisRow) => number> = {
    difficulty_desc: (r) => Math.round(r.pct),
    difficulty_asc: (r) => -Math.round(r.pct),
    accuracy_asc: (r) => Math.round(r.pct),
    accuracy_desc: (r) => -Math.round(r.pct),
    attempts_desc: (r) => -r.attempts,
  }
  const k = key[opts.sort]
  return rows
    .filter((r) => needle.length < SEARCH_MIN || r.textPlain.toLowerCase().includes(needle))
    .filter((r) => opts.tahap === '' || tahapOf(r.pct) === opts.tahap)
    .sort((a, b) => k(a) - k(b) || a.questionId - b.questionId)
}

/** "baik" when > 0.3, "semak semula" when < 0 (FN-M11-5.1.5); otherwise none. */
export function discNote(d: number | null): 'baik' | 'semak semula' | null {
  if (d === null) return null
  return d > 0.3 ? 'baik' : d < 0 ? 'semak semula' : null
}
