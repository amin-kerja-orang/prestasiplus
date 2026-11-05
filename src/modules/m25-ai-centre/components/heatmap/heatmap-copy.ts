/**
 * S1 copy and band tokens (SRS M25 v1.2 §6.3, §8.1, §10.1). Colours are the Tailwind palette values the
 * SRS lists (red-100 `#fee2e2`, amber-100 `#fef3c7`, emerald-100 `#d1fae5`, ...), so no one-off colour is used.
 */

import { wholePercent, type HeatmapChapter, type HeatmapState } from '../../api'

export const HEATMAP_COPY = {
  title: 'Heatmap Topik Lemah',
  intro:
    'Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar.',
  cikguHeading: '🌟 Cikgu Pakar Untuk Topik Lemah',
  dutaTier: '🥇 Duta Bintang',
  emptyTitle: 'Belum ada data heatmap lagi.',
  emptyHint: 'Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini.',
  notTried: 'Belum cuba',
  emptyButton: 'Mula Latih Tubi',
} as const

/**
 * FR-MUR-14-2 (lead ruling on #473, Q-1): a tile opens Soalan by Chapter of its subject, `/practice/chapter/{code}`,
 * with no deeper link and no query. The only place that decides the tile target.
 */
export const EMPTY_HREF = '/practice'
/** A subject without a code falls back to the practice home, never a dead `/practice/chapter/` link (D106). */
export function cellHref(subject: { code: string }): string {
  const code = subject.code.trim()
  return code === '' ? EMPTY_HREF : `/practice/chapter/${encodeURIComponent(code)}`
}

/** The grey outline: 1px inset ring of the muted text colour at 35%. */
const GREY_RING =
  'ring-1 ring-inset ring-[color-mix(in_oklab,var(--ui-text-muted)_35%,transparent)]'

/** Legend pills in order (FR-M25-14); gray is the `belum-cuba` tile (S10-T05). Single orange ramp (A3). */
export const LEGEND: readonly { key: HeatmapState | 'gray'; label: string; swatch: string }[] = [
  { key: 'red', label: 'Lemah (< 50%)', swatch: 'bg-heat' },
  { key: 'amber', label: 'Sederhana (50-79%)', swatch: 'bg-heat/35' },
  { key: 'green', label: 'Mantap (≥ 80%)', swatch: 'bg-accented' },
  { key: 'gray', label: 'Belum cuba', swatch: `bg-default ${GREY_RING}` },
]

/** Cell fills per band: one hue ramp, weak = full A3 orange, strong = the elevated surface. */
export function bandCellClass(band: HeatmapState): string {
  // Grey: an outlined tile on the page surface (the theme borders are transparent, so the outline is a ring
  // of the muted text token), so it never reads as the green tile (elevated fill).
  if (band === 'belum-cuba') return `bg-default text-muted ${GREY_RING}`
  if (band === 'red') return 'bg-heat text-on-highlight'
  if (band === 'amber') return 'bg-heat/35 text-highlighted'
  return 'bg-elevated text-highlighted'
}

/** ms-MY grouping from 1,000 (BR-M25-05). */
export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Line 2 of a cell: "{attempts} cuba · {whole}% betul" (U+00B7 between single spaces), `whole` = XS-5 rounded accuracy. */
export function figuresLine(attempts: number, accuracy: number | null): string {
  return `${groupDigits(attempts)} cuba · ${wholePercent(accuracy)}% betul`
}

/** Line 2 of a tile: "Belum cuba" for a grey tile, otherwise `figuresLine`. */
export function tileLine(chapter: Pick<HeatmapChapter, 'attempts' | 'accuracy' | 'state'>): string {
  return chapter.state === 'belum-cuba'
    ? HEATMAP_COPY.notTried
    : figuresLine(chapter.attempts, chapter.accuracy)
}

/** Rating with two decimals (FR-M25-24). */
export function ratingText(rating: number): string {
  return rating.toFixed(2)
}
