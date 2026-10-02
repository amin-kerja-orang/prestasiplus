/**
 * A small mutable cell list used to build a dataset distribution by **carving**: every step takes
 * rows out of the cells that match a predicate and gives them new facet values. Totals never
 * change; only facet values move. The builder is deterministic (candidate order is the insertion
 * order, or a stable per-cell hash for "spread" carves).
 *
 * - `take(pred, n, patch)` moves exactly `n` rows (throws when fewer are available);
 * - `takeTo(pred, target, patch)` tops up rows that already have `patch` to `target`;
 * - `reserve(...)` = `take` plus a lock label: locked cells are skipped by every later carve, so
 *   the anchors they were made for keep their exact facet tuple (the rows still count in every
 *   total).
 *
 * Only the last partially-used cell of a carve is split, so the cell count grows by at most one per
 * carve; `spread` carves apportion over all candidates (largest remainder) and split more.
 */

import { fnv1a32 } from '@/mock/determinism'
import { cellKey, split, type CellSpec, type FacetValue } from '@/mock/dataset'

export interface BuilderCell<F> {
  f: F
  n: number
  /** Reservation label; locked cells are not carved again. */
  lock: string | null
  /** Stable pseudo-random rank (hash of the facet tuple) for interleaved carve order. */
  rank: number
}

export type CellPred<F> = (f: Readonly<F>) => boolean

export interface CarveOptions<F> {
  /** `seq` (default): whole cells in order, the last one split. `spread`: apportioned over all. */
  mode?: 'seq' | 'spread'
  /** Lower first (default 0 for all). Ties use the stable rank. */
  priority?: (f: Readonly<F>) => number
  /** Include locked cells as candidates (default false). */
  includeLocked?: boolean
  /** Lock label for the carved rows. */
  lock?: string
  /** Order candidates by insertion order instead of the stable rank. */
  inOrder?: boolean
}

export class CellBuilder<F extends Record<string, FacetValue>> {
  readonly cells: BuilderCell<F>[] = []
  private readonly names: readonly string[]

  constructor(
    facetNames: readonly (keyof F & string)[],
    private readonly label: string,
  ) {
    this.names = facetNames
  }

  private rankOf(f: F): number {
    return fnv1a32(cellKey(f, this.names))
  }

  add(f: F, n: number, lock: string | null = null): void {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${this.label}: bad count ${String(n)}`)
    if (n === 0) return
    this.cells.push({ f: { ...f }, n, lock, rank: this.rankOf(f) })
  }

  count(pred: CellPred<F>): number {
    let n = 0
    for (const c of this.cells) if (pred(c.f)) n += c.n
    return n
  }

  private candidates(pred: CellPred<F>, opts: CarveOptions<F>): BuilderCell<F>[] {
    const list = this.cells.filter(
      (c) => c.n > 0 && (opts.includeLocked === true || c.lock === null) && pred(c.f),
    )
    if (opts.inOrder === true && !opts.priority) return list
    const prio = opts.priority
    const index = new Map(list.map((c, i) => [c, i]))
    return list.sort((a, b) => {
      const pa = prio ? prio(a.f) : 0
      const pb = prio ? prio(b.f) : 0
      if (pa !== pb) return pa - pb
      if (opts.inOrder === true) return (index.get(a) ?? 0) - (index.get(b) ?? 0)
      return a.rank - b.rank || (index.get(a) ?? 0) - (index.get(b) ?? 0)
    })
  }

  private move(c: BuilderCell<F>, t: number, patch: Partial<F>, lock: string | null): void {
    if (t <= 0) return
    const f = { ...c.f, ...patch }
    if (t === c.n) {
      c.f = f
      c.rank = this.rankOf(f)
      if (lock !== null) c.lock = lock
      return
    }
    c.n -= t
    this.cells.push({ f, n: t, lock: lock ?? c.lock, rank: this.rankOf(f) })
  }

  /** Moves exactly `n` rows matching `pred` to `patch`. */
  take(pred: CellPred<F>, n: number, patch: Partial<F>, opts: CarveOptions<F> = {}): void {
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new Error(`${this.label}: take count ${String(n)} is invalid`)
    }
    if (n === 0) return
    const list = this.candidates(pred, opts)
    const avail = list.reduce((a, c) => a + c.n, 0)
    if (avail < n) {
      throw new Error(
        `${this.label}: needs ${String(n)} rows for ${JSON.stringify(patch)}, only ${String(avail)} available`,
      )
    }
    const lock = opts.lock ?? null
    if (opts.mode === 'spread') {
      const parts = split(
        n,
        list.map((c, i) => [i, c.n] as const),
      )
      // Snapshot the counts first: `move` appends cells.
      parts.forEach(([i, t]) => this.move(list[i] as BuilderCell<F>, t, patch, lock))
      return
    }
    let rest = n
    for (const c of list) {
      if (rest === 0) break
      const t = Math.min(rest, c.n)
      this.move(c, t, patch, lock)
      rest -= t
    }
  }

  /**
   * Tops up to `target` the rows matching `pred` that already carry every `patch` value (locked
   * cells included in the count); the missing rows come from `pred` rows without them.
   */
  takeTo(pred: CellPred<F>, target: number, patch: Partial<F>, opts: CarveOptions<F> = {}): void {
    const has = (f: Readonly<F>) =>
      Object.entries(patch).every(([k, v]) => (f as Record<string, unknown>)[k] === v)
    const current = this.count((f) => pred(f) && has(f))
    if (current > target) {
      throw new Error(
        `${this.label}: ${String(current)} rows already have ${JSON.stringify(patch)}, above the target ${String(target)}`,
      )
    }
    this.take((f) => pred(f) && !has(f), target - current, patch, opts)
  }

  /** `take` with a lock label (anchor reservation). */
  reserve(pred: CellPred<F>, n: number, patch: Partial<F>, lock: string, inOrder = false): void {
    this.take(pred, n, patch, { lock, inOrder })
  }

  /** Applies `patch` to every unlocked row matching `pred`. */
  patchAll(pred: CellPred<F>, patch: Partial<F>): void {
    for (const c of this.cells) {
      if (c.lock === null && c.n > 0 && pred(c.f)) {
        c.f = { ...c.f, ...patch }
        c.rank = this.rankOf(c.f)
      }
    }
  }

  /** Replaces one cell by the given children (their counts must sum to the cell's). */
  replace(cell: BuilderCell<F>, children: readonly { patch: Partial<F>; n: number }[]): void {
    const sum = children.reduce((a, c) => a + c.n, 0)
    if (sum !== cell.n) {
      throw new Error(`${this.label}: children sum ${String(sum)} ≠ ${String(cell.n)}`)
    }
    const i = this.cells.indexOf(cell)
    this.cells.splice(i, 1)
    for (const ch of children) {
      if (ch.n > 0) this.add({ ...cell.f, ...ch.patch }, ch.n, cell.lock)
    }
  }

  /** Merged cells (equal facet tuples summed), in first-seen order. */
  build(): CellSpec<F>[] {
    const out = new Map<string, CellSpec<F>>()
    for (const c of this.cells) {
      if (c.n <= 0) continue
      const key = cellKey(c.f, this.names)
      const prev = out.get(key)
      if (prev) prev.count += c.n
      else out.set(key, { facets: { ...c.f }, count: c.n })
    }
    return [...out.values()]
  }
}
