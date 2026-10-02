/**
 * `qualityScore` of generated rows (SRS §6.13.1 "exact qualityScore inside its bucket, chosen so
 * each subject's mean equals S6"). The score is one integer per cell (a pure function of the facet
 * tuple, so it is a cheap field), inside the cell's bucket: cemerlang 76–100, baik 51–75, le50 ≤ 50.
 *
 * The per-cell values are solved once from the compiled spec: an additive start (subject + level
 * effect, fitted to the S6 "Mengikut Subjek" and "Mengikut Tingkatan" means), rounded, then a greedy
 * integer repair until every subject and level mean rounds to its S6 value (1 decimal). Pinned
 * anchor scores (564159 = 96, 129114/129216 = 50, 570024 = 55, 124733) count in the means.
 *
 * Nothing observed is changed to fit: the S6 means are the targets, the per-cell values are the
 * PROPOSED free parameters.
 */

import type { CellSpec } from '@/mock/dataset'

import { S6_LEVEL_MEAN, S6_OVERALL_MEAN, S6_SUBJECT_MEAN } from '../data/tables'
import type { QualityBucket, QuestionFacets } from '../repository/types'
import { facetKey } from './questions-spec'

type F = QuestionFacets

const RANGE: Readonly<Record<Exclude<QualityBucket, 'unscored'>, readonly [number, number]>> = {
  cemerlang: [76, 100],
  baik: [51, 75],
  le50: [0, 50],
}

/** Default score of a bucket for cells the solver has not seen (runtime cells). */
export const DEFAULT_SCORE: Readonly<Record<QualityBucket, number | null>> = {
  unscored: null,
  cemerlang: 95,
  baik: 65,
  le50: 50,
}

export interface PinnedScore {
  facets: F
  score: number
}

interface Var {
  key: string
  s: number
  l: number
  lo: number
  hi: number
  free: number
  pinnedSum: number
  x: number
}

export interface QualityMeans {
  bySubject: Map<number, { n: number; sum: number }>
  byLevel: Map<number, { n: number; sum: number }>
  total: { n: number; sum: number }
}

/** Solves one score per scored cell. Returns cell key → score. */
export function solveQualityScores(
  cells: readonly CellSpec<F>[],
  pinned: readonly PinnedScore[],
): Map<string, number> {
  const pinnedByKey = new Map<string, { n: number; sum: number }>()
  for (const p of pinned) {
    const k = facetKey(p.facets)
    const e = pinnedByKey.get(k) ?? { n: 0, sum: 0 }
    e.n += 1
    e.sum += p.score
    pinnedByKey.set(k, e)
  }
  const vars: Var[] = []
  for (const c of cells) {
    const f = c.facets
    if (f.pkskDomainId !== null || f.qualityBucket === 'unscored' || f.subjectId === null) continue
    const k = facetKey(f)
    const p = pinnedByKey.get(k) ?? { n: 0, sum: 0 }
    const [lo, hi] = RANGE[f.qualityBucket]
    vars.push({
      key: k,
      s: f.subjectId,
      l: f.educationLevelId ?? 0,
      lo,
      hi,
      free: c.count - p.n,
      pinnedSum: p.sum,
      x: f.qualityBucket === 'baik' ? 63 : f.qualityBucket === 'le50' ? 50 : 95,
    })
  }

  const subj = groupBy(vars, (v) => v.s)
  const lev = groupBy(vars, (v) => v.l)
  const target = (g: Var[], mean: number) => mean * g.reduce((a, v) => a + v.free + pinnedN(v), 0)
  const pinnedN = (v: Var) => pinnedByKey.get(v.key)?.n ?? 0
  const sumOf = (g: Var[]) => g.reduce((a, v) => a + v.free * v.x + v.pinnedSum, 0)
  const nOf = (g: Var[]) => g.reduce((a, v) => a + v.free + pinnedN(v), 0)

  // 1. Additive start on the cemerlang cells (continuous), then round.
  const a = new Map<number, number>()
  const b = new Map<number, number>()
  for (const s of subj.keys()) a.set(s, 0)
  for (const l of lev.keys()) b.set(l, 0)
  const cem = (v: Var) => v.lo === 76
  const val = (v: Var) =>
    cem(v) ? clamp(95 + (a.get(v.s) ?? 0) + (b.get(v.l) ?? 0), v.lo, v.hi) : v.x
  for (let round = 0; round < 60; round++) {
    for (const [s, g] of subj) {
      const mean = S6_SUBJECT_MEAN[s]
      if (mean === undefined) continue
      const free = g.filter(cem).reduce((acc, v) => acc + v.free, 0)
      if (free === 0) continue
      const cur = g.reduce((acc, v) => acc + v.free * val(v) + v.pinnedSum, 0)
      a.set(s, (a.get(s) ?? 0) + (target(g, mean) - cur) / free)
    }
    for (const [l, g] of lev) {
      const mean = S6_LEVEL_MEAN[l]
      if (mean === undefined) continue
      const free = g.filter(cem).reduce((acc, v) => acc + v.free, 0)
      if (free === 0) continue
      const cur = g.reduce((acc, v) => acc + v.free * val(v) + v.pinnedSum, 0)
      b.set(l, (b.get(l) ?? 0) + (target(g, mean) - cur) / free)
    }
  }
  for (const v of vars) v.x = Math.round(val(v))

  // 2. Greedy integer repair: every subject/level mean within ±0.04 of its target (the display
  //    rounds to 0.1) and the overall mean within ±0.009 of 94.14.
  const constraints: { g: Var[]; mean: number; kind: 's' | 'l' | 't'; id: number; tol: number }[] =
    []
  for (const [s, g] of subj) {
    const mean = S6_SUBJECT_MEAN[s]
    if (mean !== undefined) constraints.push({ g, mean, kind: 's', id: s, tol: 0.04 })
  }
  for (const [l, g] of lev) {
    const mean = S6_LEVEL_MEAN[l]
    if (mean !== undefined) constraints.push({ g, mean, kind: 'l', id: l, tol: 0.04 })
  }
  // "Purata Skor" 94.1 (the SRS computes 94.14): keep the overall mean within 94.131–94.149.
  constraints.push({ g: vars, mean: S6_OVERALL_MEAN, kind: 't', id: 0, tol: 0.009 })
  const resid = (c: (typeof constraints)[number]) => target(c.g, c.mean) - sumOf(c.g)
  const tol = (c: (typeof constraints)[number]) => c.tol * nOf(c.g)
  const other = new Map<Var, (typeof constraints)[number][]>()
  for (const c of constraints) for (const v of c.g) other.set(v, [...(other.get(v) ?? []), c])
  for (let iter = 0; iter < 50_000; iter++) {
    let worst: (typeof constraints)[number] | null = null
    let worstR = 1
    for (const c of constraints) {
      const r = Math.abs(resid(c)) / tol(c)
      if (r > worstR) {
        worstR = r
        worst = c
      }
    }
    if (!worst) break
    const dir = Math.sign(resid(worst))
    let best: Var | null = null
    let bestCost = Number.POSITIVE_INFINITY
    for (const v of worst.g) {
      if (v.free === 0) continue
      if ((dir > 0 && v.x >= v.hi) || (dir < 0 && v.x <= v.lo)) continue
      let cost = 0
      for (const c of other.get(v) ?? []) {
        const r = resid(c) - dir * v.free
        cost += (r / tol(c)) ** 2
      }
      if (cost < bestCost) {
        bestCost = cost
        best = v
      }
    }
    if (!best) break
    best.x += dir
  }

  const out = new Map<string, number>()
  for (const v of vars) out.set(v.key, v.x)
  return out
}

/** Subject, level and total (count, sum) of the scored rows under `scoreOf`. */
export function qualityMeans(
  cells: readonly CellSpec<F>[],
  scoreOf: (f: F) => number | null,
  pinned: readonly PinnedScore[],
): QualityMeans {
  const pinnedByKey = new Map<string, number[]>()
  for (const p of pinned) {
    const k = facetKey(p.facets)
    pinnedByKey.set(k, [...(pinnedByKey.get(k) ?? []), p.score])
  }
  const bySubject = new Map<number, { n: number; sum: number }>()
  const byLevel = new Map<number, { n: number; sum: number }>()
  const total = { n: 0, sum: 0 }
  const add = (m: Map<number, { n: number; sum: number }>, k: number, n: number, sum: number) => {
    const e = m.get(k) ?? { n: 0, sum: 0 }
    e.n += n
    e.sum += sum
    m.set(k, e)
  }
  for (const c of cells) {
    const f = c.facets
    if (f.pkskDomainId !== null || f.qualityBucket === 'unscored' || f.subjectId === null) continue
    const score = scoreOf(f) ?? 0
    const pins = pinnedByKey.get(facetKey(f)) ?? []
    const sum = (c.count - pins.length) * score + pins.reduce((x, y) => x + y, 0)
    add(bySubject, f.subjectId, c.count, sum)
    if (f.educationLevelId !== null) add(byLevel, f.educationLevelId, c.count, sum)
    total.n += c.count
    total.sum += sum
  }
  return { bySubject, byLevel, total }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

function groupBy<T, K>(list: readonly T[], key: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const t of list) {
    const k = key(t)
    const arr = out.get(k)
    if (arr) arr.push(t)
    else out.set(k, [t])
  }
  return out
}
