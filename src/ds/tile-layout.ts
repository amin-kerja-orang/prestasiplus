/**
 * Orphan-free tile grids (v2-ds-hardening 13). For any tile count, every row of a strip is full at
 * every width: the tiles are split into rows of near-equal size (k and k+1 tiles), the track is the
 * least common multiple of the row sizes (2, 6 or 12), and each tile spans track / row size. Used by
 * `DsStatRow` and by pages that lay their own KPI tiles out in a `DsGrid` (`tiles` prop + `span`).
 * Class names come from the literal tables in `layout.ts`, so Tailwind sees whole names.
 */
import { colsClasses, spanClasses } from './layout'
import type { DsCols, DsResponsive } from './types'

type Bp = 'base' | 'md' | 'xl'
const BPS: Bp[] = ['base', 'md', 'xl']

export interface TileLayout {
  /** Column-track classes of the grid (`grid-cols-2 md:grid-cols-6 xl:grid-cols-5`). */
  grid: string[]
  /** Span classes per tile index (empty where the span matches the previous width). */
  span: string[][]
  /** The same spans as `DsGridItem` `span` props (a page cannot put classes on a Ds primitive). */
  spans: DsResponsive<DsCols>[]
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const lcm = (a: number, b: number): number => (a * b) / gcd(a, b)

/** Rows of near-equal size for `n` tiles with at most `max` per row (track kept <= 12). */
function rows(n: number, max: number, smallFirst: boolean): number[] {
  for (let c = Math.max(1, Math.min(max, n)); c >= 1; c--) {
    const r = Math.ceil(n / c)
    const base = Math.floor(n / r)
    const extra = n % r
    const sizes = Array.from({ length: r }, (_, i) => base + (i < extra ? 1 : 0)) // big rows first
    const track = sizes.reduce((acc, s) => lcm(acc, s), 1)
    if (track <= 12 && [1, 2, 3, 4, 5, 6, 12].includes(track)) return smallFirst ? sizes.reverse() : sizes
  }
  return [n]
}

/** `cols` = the most tiles per row at `xl` (default 5); `md` is capped at 3 and below `md` at 2. */
export function tileLayout(n: number, cols: number = 5): TileLayout {
  if (n <= 0) return { grid: [], span: [], spans: [] }
  // A lone tile is the full row at every width.
  if (n === 1) return { grid: colsClasses(2), span: [spanClasses(2)], spans: [{ base: 2 }] }
  const max: Record<Bp, number> = { base: 2, md: Math.min(3, cols), xl: cols }
  const grid: string[] = []
  const span: string[][] = Array.from({ length: n }, () => [])
  const spans: DsResponsive<DsCols>[] = Array.from({ length: n }, () => ({}))
  let prevTrack = 0
  let prevSpans: number[] = Array<number>(n).fill(1)
  for (const bp of BPS) {
    const r = rows(n, max[bp], bp === 'base')
    const track = r.reduce((acc, s) => lcm(acc, s), 1)
    const cur: number[] = []
    for (const size of r) for (let k = 0; k < size; k++) cur.push(track / size)
    if (track !== prevTrack) {
      grid.push(...colsClasses({ [bp]: track as DsCols }))
    }
    for (let i = 0; i < n; i++) {
      const s = cur[i] ?? 1
      if (s !== prevSpans[i] || (bp === 'base' && s > 1)) {
        span[i]!.push(...spanClasses({ [bp]: s as DsCols }))
        spans[i]![bp] = s as DsCols
      }
    }
    prevTrack = track
    prevSpans = cur
  }
  return { grid, span, spans }
}
