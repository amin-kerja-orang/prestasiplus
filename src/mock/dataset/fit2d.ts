/**
 * `fit2d` (overview §6.6, ADR-0013 §2): an integer table over the allowed (row, col) pairs whose row
 * sums and column sums equal two observed marginals **exactly** — e.g. per-subject totals × per-level
 * totals over the M03 subject–level links, or schools `type × state`.
 *
 * Method (deterministic):
 * 1. Lower bounds (`bounds().min`, pins) are taken out first; upper bounds cap each cell.
 * 2. Proportional allocation by iterative proportional fitting of `weight(r, c)` (default 1) to the
 *    remaining marginals, floored and clamped to the caps.
 * 3. Largest-remainder pass: each row's shortfall goes to its cells with the largest fractional part
 *    while the column still needs units.
 * 4. Repair: an exact max-flow augmentation (Edmonds–Karp from the current allocation) on the
 *    bipartite network source → rows → cols → sink. It reaches the marginals whenever any integer
 *    table does; otherwise the totals are **infeasible** and `DatasetSpecError('INFEASIBLE')` is
 *    thrown, naming the unmet rows and columns. That is a requirements contradiction (D9/D11).
 */

import { DatasetSpecError, type DatasetIssue } from './errors'

export interface Fit2dBounds {
  min?: number
  max?: number
}

export interface Fit2dInput<R, C> {
  /** Row labels with their observed totals. */
  rows: readonly (readonly [R, number])[]
  /** Column labels with their observed totals. */
  cols: readonly (readonly [C, number])[]
  /** Which pairs may hold rows (default: all). */
  allowed?: (row: R, col: C) => boolean
  /** Per-pair bounds: `min` pins a lower bound (e.g. an observed cell), `max` a capacity. */
  bounds?: (row: R, col: C) => Fit2dBounds | undefined
  /** Relative weight of a pair in the proportional start (default 1). */
  weight?: (row: R, col: C) => number
  /** Name used in error messages. */
  label?: string
}

export interface Fit2dCell<R, C> {
  row: R
  col: C
  count: number
}

const IPF_ROUNDS = 64

function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
}

export function fit2d<R, C>(input: Fit2dInput<R, C>): Fit2dCell<R, C>[] {
  const label = input.label ?? 'fit2d'
  const issues: DatasetIssue[] = []
  const nr = input.rows.length
  const nc = input.cols.length
  const rowT = input.rows.map(([, t]) => t)
  const colT = input.cols.map(([, t]) => t)
  rowT.forEach((t, i) => {
    if (!isCount(t))
      issues.push({ code: 'CELL', message: `${label}: row total [${String(i)}] = ${String(t)}` })
  })
  colT.forEach((t, j) => {
    if (!isCount(t))
      issues.push({ code: 'CELL', message: `${label}: col total [${String(j)}] = ${String(t)}` })
  })
  const dupes = (labels: readonly unknown[], kind: string) => {
    const seen = new Set<unknown>()
    for (const l of labels) {
      if (seen.has(l))
        issues.push({
          code: 'CELL',
          message: `${label}: duplicate ${kind} label ${JSON.stringify(l)}`,
        })
      seen.add(l)
    }
  }
  dupes(
    input.rows.map(([r]) => r),
    'row',
  )
  dupes(
    input.cols.map(([c]) => c),
    'col',
  )
  if (issues.length > 0) throw new DatasetSpecError(label, issues)

  const sumR = rowT.reduce((a, b) => a + b, 0)
  const sumC = colT.reduce((a, b) => a + b, 0)
  if (sumR !== sumC) {
    throw new DatasetSpecError(label, [
      {
        code: 'INFEASIBLE',
        message: `${label}: row totals sum to ${String(sumR)} but column totals sum to ${String(sumC)}`,
      },
    ])
  }

  // Pair tables (row-major). allowed = 0/1, lo/hi bounds, weights.
  const size = nr * nc
  const allowed = new Uint8Array(size)
  const lo = new Float64Array(size)
  const cap = new Float64Array(size)
  const w = new Float64Array(size)
  const remR = rowT.slice()
  const remC = colT.slice()
  for (let i = 0; i < nr; i++) {
    const [r] = input.rows[i] as readonly [R, number]
    for (let j = 0; j < nc; j++) {
      const [c] = input.cols[j] as readonly [C, number]
      const k = i * nc + j
      if (input.allowed && !input.allowed(r, c)) continue
      allowed[k] = 1
      const b = input.bounds?.(r, c)
      const min = b?.min ?? 0
      const max = b?.max ?? Number.POSITIVE_INFINITY
      if (!isCount(min) || !(max === Number.POSITIVE_INFINITY || isCount(max)) || max < min) {
        issues.push({
          code: 'INFEASIBLE',
          message: `${label}: bad bounds for (${String(r)}, ${String(c)}): min ${String(min)}, max ${String(max)}`,
        })
        continue
      }
      lo[k] = min
      cap[k] = max - min
      remR[i] = (remR[i] as number) - min
      remC[j] = (remC[j] as number) - min
      const weight = input.weight ? input.weight(r, c) : 1
      w[k] = Number.isFinite(weight) && weight > 0 ? weight : 0
    }
  }
  remR.forEach((t, i) => {
    if (t < 0)
      issues.push({
        code: 'INFEASIBLE',
        message: `${label}: row ${String(input.rows[i]?.[0])} pins exceed its total by ${String(-t)}`,
      })
  })
  remC.forEach((t, j) => {
    if (t < 0)
      issues.push({
        code: 'INFEASIBLE',
        message: `${label}: col ${String(input.cols[j]?.[0])} pins exceed its total by ${String(-t)}`,
      })
  })
  if (issues.length > 0) throw new DatasetSpecError(label, issues)

  // 2. Proportional start (IPF), then floor and clamp.
  const real = new Float64Array(size)
  for (let k = 0; k < size; k++) {
    real[k] = allowed[k] && (cap[k] as number) > 0 ? (w[k] as number) || 1e-9 : 0
  }
  for (let round = 0; round < IPF_ROUNDS; round++) {
    for (let i = 0; i < nr; i++) {
      let s = 0
      for (let j = 0; j < nc; j++) s += real[i * nc + j] as number
      const f = s > 0 ? (remR[i] as number) / s : 0
      for (let j = 0; j < nc; j++) {
        const k = i * nc + j
        real[k] = Math.min((real[k] as number) * f, cap[k] as number)
      }
    }
    for (let j = 0; j < nc; j++) {
      let s = 0
      for (let i = 0; i < nr; i++) s += real[i * nc + j] as number
      const f = s > 0 ? (remC[j] as number) / s : 0
      for (let i = 0; i < nr; i++) {
        const k = i * nc + j
        real[k] = Math.min((real[k] as number) * f, cap[k] as number)
      }
    }
  }
  const x = new Float64Array(size)
  for (let k = 0; k < size; k++) x[k] = Math.max(0, Math.floor((real[k] as number) + 1e-9))
  const rowOut = new Float64Array(nr)
  const colIn = new Float64Array(nc)
  const recount = () => {
    rowOut.fill(0)
    colIn.fill(0)
    for (let i = 0; i < nr; i++)
      for (let j = 0; j < nc; j++) {
        const v = x[i * nc + j] as number
        rowOut[i] = (rowOut[i] as number) + v
        colIn[j] = (colIn[j] as number) + v
      }
  }
  recount()
  // Never exceed a marginal (IPF may overshoot slightly before flooring).
  for (let i = 0; i < nr; i++) {
    for (let j = nc - 1; j >= 0 && (rowOut[i] as number) > (remR[i] as number); j--) {
      const k = i * nc + j
      const d = Math.min(x[k] as number, (rowOut[i] as number) - (remR[i] as number))
      x[k] = (x[k] as number) - d
      rowOut[i] = (rowOut[i] as number) - d
      colIn[j] = (colIn[j] as number) - d
    }
  }
  for (let j = 0; j < nc; j++) {
    for (let i = nr - 1; i >= 0 && (colIn[j] as number) > (remC[j] as number); i--) {
      const k = i * nc + j
      const d = Math.min(x[k] as number, (colIn[j] as number) - (remC[j] as number))
      x[k] = (x[k] as number) - d
      rowOut[i] = (rowOut[i] as number) - d
      colIn[j] = (colIn[j] as number) - d
    }
  }

  // 3. Largest-remainder pass per row.
  for (let i = 0; i < nr; i++) {
    const order: { j: number; f: number }[] = []
    for (let j = 0; j < nc; j++) {
      const k = i * nc + j
      if (allowed[k]) order.push({ j, f: (real[k] as number) - (x[k] as number) })
    }
    order.sort((a, b) => b.f - a.f || a.j - b.j)
    for (const { j } of order) {
      if ((rowOut[i] as number) >= (remR[i] as number)) break
      const k = i * nc + j
      if ((colIn[j] as number) < (remC[j] as number) && (x[k] as number) < (cap[k] as number)) {
        x[k] = (x[k] as number) + 1
        rowOut[i] = (rowOut[i] as number) + 1
        colIn[j] = (colIn[j] as number) + 1
      }
    }
  }

  // 4. Max-flow repair (BFS augmenting paths over the residual network).
  // Nodes: 0 = source, 1..nr = rows, nr+1..nr+nc = cols, nr+nc+1 = sink.
  const sink = nr + nc + 1
  const nodes = sink + 1
  const prev = new Int32Array(nodes)
  const queue = new Int32Array(nodes)
  for (;;) {
    prev.fill(-1)
    prev[0] = 0
    let head = 0
    let tail = 0
    queue[tail++] = 0
    let found = false
    while (head < tail && !found) {
      const u = queue[head++] as number
      if (u === 0) {
        for (let i = 0; i < nr; i++) {
          const v = 1 + i
          if (prev[v] === -1 && (rowOut[i] as number) < (remR[i] as number)) {
            prev[v] = 0
            queue[tail++] = v
          }
        }
      } else if (u <= nr) {
        const i = u - 1
        for (let j = 0; j < nc; j++) {
          const v = 1 + nr + j
          const k = i * nc + j
          if (prev[v] === -1 && allowed[k] && (x[k] as number) < (cap[k] as number)) {
            prev[v] = u
            queue[tail++] = v
          }
        }
      } else {
        const j = u - 1 - nr
        if ((colIn[j] as number) < (remC[j] as number)) {
          prev[sink] = u
          found = true
          break
        }
        for (let i = 0; i < nr; i++) {
          const v = 1 + i
          if (prev[v] === -1 && (x[i * nc + j] as number) > 0) {
            prev[v] = u
            queue[tail++] = v
          }
        }
      }
    }
    if (!found) break

    // Bottleneck along the path.
    let bottleneck = Number.POSITIVE_INFINITY
    let v = sink
    while (v !== 0) {
      const u = prev[v] as number
      if (v === sink) {
        const j = u - 1 - nr
        bottleneck = Math.min(bottleneck, (remC[j] as number) - (colIn[j] as number))
      } else if (u === 0) {
        const i = v - 1
        bottleneck = Math.min(bottleneck, (remR[i] as number) - (rowOut[i] as number))
      } else if (u <= nr) {
        const k = (u - 1) * nc + (v - 1 - nr)
        bottleneck = Math.min(bottleneck, (cap[k] as number) - (x[k] as number))
      } else {
        const k = (v - 1) * nc + (u - 1 - nr)
        bottleneck = Math.min(bottleneck, x[k] as number)
      }
      v = u
    }
    // Apply.
    v = sink
    while (v !== 0) {
      const u = prev[v] as number
      if (v === sink) {
        const j = u - 1 - nr
        colIn[j] = (colIn[j] as number) + bottleneck
      } else if (u === 0) {
        const i = v - 1
        rowOut[i] = (rowOut[i] as number) + bottleneck
      } else if (u <= nr) {
        const k = (u - 1) * nc + (v - 1 - nr)
        x[k] = (x[k] as number) + bottleneck
      } else {
        const k = (v - 1) * nc + (u - 1 - nr)
        x[k] = (x[k] as number) - bottleneck
      }
      v = u
    }
  }

  for (let i = 0; i < nr; i++) {
    if (rowOut[i] !== remR[i]) {
      issues.push({
        code: 'INFEASIBLE',
        message: `${label}: row ${String(input.rows[i]?.[0])} total ${String(rowT[i])} cannot be met (short by ${String((remR[i] as number) - (rowOut[i] as number))})`,
      })
    }
  }
  for (let j = 0; j < nc; j++) {
    if (colIn[j] !== remC[j]) {
      issues.push({
        code: 'INFEASIBLE',
        message: `${label}: col ${String(input.cols[j]?.[0])} total ${String(colT[j])} cannot be met (short by ${String((remC[j] as number) - (colIn[j] as number))})`,
      })
    }
  }
  if (issues.length > 0) throw new DatasetSpecError(label, issues)

  const out: Fit2dCell<R, C>[] = []
  for (let i = 0; i < nr; i++) {
    const [r] = input.rows[i] as readonly [R, number]
    for (let j = 0; j < nc; j++) {
      const k = i * nc + j
      if (!allowed[k]) continue
      const [c] = input.cols[j] as readonly [C, number]
      out.push({ row: r, col: c, count: (x[k] as number) + (lo[k] as number) })
    }
  }
  return out
}
