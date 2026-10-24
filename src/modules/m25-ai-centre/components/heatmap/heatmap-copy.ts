/**
 * S1 copy and band tokens (SRS M25 v1.2 §6.3, §8.1, §10.1). Colours are the Tailwind palette values the
 * SRS lists (red-100 `#fee2e2`, amber-100 `#fef3c7`, emerald-100 `#d1fae5`, ...), so no one-off colour is used.
 */

import type { HeatmapBand } from '../../api'

export const HEATMAP_COPY = {
  title: 'Peta Haba Topik Lemah',
  intro:
    'Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar.',
  cikguHeading: '🌟 Cikgu Pakar Untuk Topik Lemah',
  dutaTier: '🥇 Duta Bintang',
  emptyTitle: 'Belum ada data peta haba.',
  emptyHint: 'Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini.',
  emptyButton: 'Mula Latih Tubi',
} as const

/** DV-M25-02: every cell keeps the live link, whatever its band or subject. */
export const CELL_HREF = '/practice/chapter'
export const EMPTY_HREF = '/practice'

/** Legend pills in order (FR-M25-14); gray is legend only, never a cell (FR-M25-17). Single orange ramp (A3). */
export const LEGEND: readonly { key: HeatmapBand | 'gray'; label: string; swatch: string }[] = [
  { key: 'red', label: 'Lemah (< 50%)', swatch: 'bg-heat' },
  { key: 'amber', label: 'Sederhana (50-79%)', swatch: 'bg-heat/35' },
  { key: 'green', label: 'Mantap (≥ 80%)', swatch: 'bg-accented' },
  { key: 'gray', label: 'Belum cuba', swatch: 'bg-muted' },
]

/** Cell fills per band: one hue ramp, weak = full A3 orange, strong = the elevated surface. */
export function bandCellClass(band: HeatmapBand): string {
  if (band === 'red') return 'bg-heat text-on-highlight'
  if (band === 'amber') return 'bg-heat/35 text-highlighted'
  return 'bg-elevated text-highlighted'
}

/** ms-MY grouping from 1,000 (BR-M25-05). */
export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Line 2 of a cell: "{attempts} cuba · {percent}% betul" (U+00B7 between single spaces). */
export function figuresLine(attempts: number, percent: number): string {
  return `${groupDigits(attempts)} cuba · ${percent}% betul`
}

/** Rating with two decimals (FR-M25-24). */
export function ratingText(rating: number): string {
  return rating.toFixed(2)
}
