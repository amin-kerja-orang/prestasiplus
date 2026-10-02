/**
 * The distribution spec DSL of virtual datasets (overview §6.6 "Distribution spec → cells",
 * ADR-0013 §2).
 *
 * A distribution compiles to an explicit list of **cells**: `{ facets, count }`. The facets of a
 * cell are the count-relevant field values of every row in it; the sum of all cell counts is the
 * dataset total. Helpers:
 * - `exact(cells)` — counts observed on live, per combination;
 * - `split(total, weights)` — largest-remainder rounding, parts always sum to `total`;
 * - `nest(parent, child)` — split each parent cell further; children must sum to the parent;
 * - `nestSplit(parent, field, weights)` — `nest` + `split` over one new facet;
 * - `fit2d(...)` (in `./fit2d`) — an integer table that matches two observed marginals exactly.
 *
 * All helpers are pure and deterministic, and every inexact input throws `DatasetSpecError`.
 */

import { DatasetSpecError, type DatasetIssue } from './errors'

/** A facet value: the value of a count-relevant field (primitives only). */
export type FacetValue = string | number | boolean | null

export type FacetRecord = Record<string, FacetValue>

export interface CellSpec<F> {
  facets: F
  count: number
}

export type Distribution<F> = readonly CellSpec<F>[]

/** Stable key of a facet combination (facet order = the dataset's `facets` order). */
export function cellKey(
  facets: Readonly<Record<string, unknown>>,
  names: readonly string[],
): string {
  let out = ''
  for (const name of names) {
    const v = facets[name]
    out += `${JSON.stringify(v === undefined ? null : v)}\u0001`
  }
  return out
}

export function isFacetValue(value: unknown): value is FacetValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

function checkCount(count: unknown, where: string, issues: DatasetIssue[]) {
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    issues.push({
      code: 'CELL',
      message: `${where}: count must be a non-negative integer, got ${String(count)}`,
    })
  }
}

/** Observed per-combination counts, taken literally. Validates the counts. */
export function exact<F>(cells: readonly CellSpec<F>[]): CellSpec<F>[] {
  const issues: DatasetIssue[] = []
  cells.forEach((c, i) => checkCount(c.count, `exact[${String(i)}]`, issues))
  if (issues.length > 0) throw new DatasetSpecError('exact', issues)
  return cells.map((c) => ({ facets: { ...c.facets }, count: c.count }))
}

/**
 * Largest-remainder apportionment of `total` over `weights`. Parts always sum to `total` exactly.
 * Ties on the remainder go to the earlier entry (deterministic). A zero weight gets 0.
 */
export function split<K>(total: number, weights: readonly (readonly [K, number])[]): [K, number][] {
  const issues: DatasetIssue[] = []
  checkCount(total, 'split total', issues)
  let sum = 0
  weights.forEach(([, w], i) => {
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) {
      issues.push({
        code: 'INFEASIBLE',
        message: `split weight[${String(i)}] must be ≥ 0, got ${String(w)}`,
      })
    } else sum += w
  })
  if (issues.length === 0 && total > 0 && sum <= 0) {
    issues.push({
      code: 'INFEASIBLE',
      message: `split: ${String(total)} cannot be split over zero weights`,
    })
  }
  if (issues.length > 0) throw new DatasetSpecError('split', issues)

  if (total === 0) return weights.map(([k]) => [k, 0])
  const quotas = weights.map(([, w]) => (w * total) / sum)
  const parts = quotas.map((q) => Math.floor(q))
  let rest = total - parts.reduce((a, b) => a + b, 0)
  const order = quotas
    .map((q, i) => ({ i, r: q - Math.floor(q) }))
    .filter((x) => (weights[x.i]?.[1] ?? 0) > 0)
    .sort((a, b) => b.r - a.r || a.i - b.i)
  for (let n = 0; rest > 0; n = (n + 1) % order.length, rest--) {
    const idx = (order[n] as { i: number }).i
    parts[idx] = (parts[idx] as number) + 1
  }
  return weights.map(([k], i) => [k, parts[i] as number])
}

/**
 * Splits each parent cell further. `child(cell)` returns the child cells (their facets are merged
 * over the parent's); their counts must sum to the parent count exactly.
 */
export function nest<P, C>(
  parent: readonly CellSpec<P>[],
  child: (cell: CellSpec<P>) => readonly CellSpec<C>[],
): CellSpec<P & C>[] {
  const issues: DatasetIssue[] = []
  const out: CellSpec<P & C>[] = []
  for (const cell of parent) {
    const kids = child(cell)
    let sum = 0
    for (const k of kids) {
      checkCount(k.count, `nest child of ${JSON.stringify(cell.facets)}`, issues)
      sum += k.count
      out.push({ facets: { ...cell.facets, ...k.facets }, count: k.count })
    }
    if (sum !== cell.count) {
      issues.push({
        code: 'INFEASIBLE',
        message: `nest: children of ${JSON.stringify(cell.facets)} sum to ${String(sum)}, parent count is ${String(cell.count)}`,
      })
    }
  }
  if (issues.length > 0) throw new DatasetSpecError('nest', issues)
  return out
}

/**
 * `nest` + `split`: splits each parent cell over the values of one new facet `field`, with
 * `weights` given per parent (a function) or shared (a list). Zero-count children are kept only if
 * `keepZero` is set.
 */
export function nestSplit<P, K extends string, V extends FacetValue>(
  parent: readonly CellSpec<P>[],
  field: K,
  weights:
    readonly (readonly [V, number])[] | ((cell: CellSpec<P>) => readonly (readonly [V, number])[]),
  options: { keepZero?: boolean } = {},
): CellSpec<P & Record<K, V>>[] {
  return nest(parent, (cell) => {
    const w = typeof weights === 'function' ? weights(cell) : weights
    return split(cell.count, w)
      .filter(([, n]) => n > 0 || options.keepZero === true)
      .map(([value, count]) => ({ facets: { [field]: value } as Record<K, V>, count }))
  })
}

/** Σ of cell counts. */
export function totalOf(cells: readonly CellSpec<unknown>[]): number {
  let n = 0
  for (const c of cells) n += c.count
  return n
}

/** Σ of the counts of the cells whose facets satisfy `pred` (spec-side marginal checks). */
export function marginal<F>(cells: readonly CellSpec<F>[], pred: (facets: F) => boolean): number {
  let n = 0
  for (const c of cells) if (pred(c.facets)) n += c.count
  return n
}
