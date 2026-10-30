/**
 * Polynomial necessary-condition pre-checks (architecture 5.4). They are evaluated independently (the
 * "available" of a line ignores the other lines), so every line can read "Cukup" while the verdict is
 * still "Tidak boleh dijana" because of combinations. The same numbers feed the "Pratonton kolam" table
 * (AC-29.4), so counts equal rows (NFR-12). Fixed reporting order of failures: count, unit, tp, kbat, marks.
 */
import { buildSectionPool, type GroupSpec, type Item, type PoolContext, type PoolOptions, groupSpecs } from './pool'
import type { DescribedQuestion } from './eligibility'
import { offeredMarks, unitRefOf, type QuotaBasis, type StandardSection, type UnitRef } from './standard-model'
import type { StandardShortage } from './shortage'

export interface Short {
  needed: number
  available: number
  short: number
}

const mk = (needed: number, available: number): Short => ({ needed, available, short: Math.max(0, needed - available) })

export interface SectionPrecheck {
  position: number
  label: string
  slots: number
  effectiveMarks: number
  offeredMarks: number
  /** Questions eligible for this section (AC-29.1). */
  eligible: number
  /** Eligible elsewhere but the answer mode is not allowed here. */
  modeExcluded: number
  counts: Short
  marks: { needed: number; reachable: boolean; best: number }
  quota: (Short & { unit: UnitRef; basis: QuotaBasis })[]
  tp: (Short & { slot: { from: number; to: number }; tpMin: number; tpMax: number; tp?: number })[]
  kbat: Short | null
  /** Typed failures in the fixed order; empty when every necessary condition holds. */
  failures: StandardShortage[]
  /** Smallest (available - needed) over the lines; tightness for the section order. */
  minSlack: number
}

/** Bounded subset sum: reach[c][v] for choosing exactly c of the items (each at most once). */
function reachGrid(items: { size: number; val: number; mult: number }[], maxCount: number, maxVal: number): Uint8Array {
  const w = maxVal + 1
  const grid = new Uint8Array((maxCount + 1) * w)
  grid[0] = 1
  for (const it of items) {
    const reps = Math.min(it.mult, Math.floor(maxCount / it.size))
    for (let r = 0; r < reps; r++)
      for (let c = maxCount; c >= it.size; c--) {
        const from = (c - it.size) * w
        const to = c * w
        for (let v = maxVal; v >= it.val; v--) if (grid[from + v - it.val]) grid[to + v] = 1
      }
  }
  return grid
}

function tally<T>(rows: T[], key: (t: T) => string): Map<string, { row: T; n: number }> {
  const m = new Map<string, { row: T; n: number }>()
  for (const r of rows) {
    const k = key(r)
    const e = m.get(k)
    if (e) e.n++
    else m.set(k, { row: r, n: 1 })
  }
  return m
}

/* ---------------------------------------------------------------------------- max flow */

/** Tiny Edmonds-Karp on an adjacency matrix; the graphs here have under 100 nodes. */
function maxFlow(n: number, edges: [number, number, number][], s: number, t: number): number {
  const cap = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (const [a, b, c] of edges) cap[a]![b]! += c
  let flow = 0
  for (;;) {
    const prev = new Array<number>(n).fill(-1)
    prev[s] = s
    const queue = [s]
    for (let qi = 0; qi < queue.length && prev[t] === -1; qi++) {
      const u = queue[qi]!
      for (let v = 0; v < n; v++) if (prev[v] === -1 && cap[u]![v]! > 0) {
        prev[v] = u
        queue.push(v)
      }
    }
    if (prev[t] === -1) return flow
    let push = Number.POSITIVE_INFINITY
    for (let v = t; v !== s; v = prev[v]!) push = Math.min(push, cap[prev[v]!]![v]!)
    for (let v = t; v !== s; v = prev[v]!) {
      cap[prev[v]!]![v]! -= push
      cap[v]![prev[v]!]! += push
    }
    flow += push
  }
}

function groupAccepts(g: GroupSpec, d: DescribedQuestion): boolean {
  if (d.tp === null) return false
  if (d.tp < g.tpMin || d.tp > g.tpMax) return false
  if (d.marks < g.mMin || d.marks > g.mMax) return false
  if (g.units && !Object.keys(d.unitMarks).every((k) => g.units!.has(k))) return false
  return true
}

/** Deficit of the first `upto` groups when the pool of questions must fill them all (cross-group feasibility). */
function flowDeficit(members: DescribedQuestion[], groups: GroupSpec[]): number {
  const needUnits = groups.some((g) => g.units)
  const classes = tally(members, (d) => `${d.tp}|${d.marks}|${needUnits ? Object.keys(d.unitMarks).join(',') : ''}`)
  const cls = [...classes.values()]
  const G = groups.length
  // nodes: 0 source, 1 sink, classes, group nodes, count nodes (g, tp)
  const base = 2
  const gBase = base + cls.length
  const cBase = gBase + G
  const n = cBase + G * 7
  const edges: [number, number, number][] = []
  cls.forEach(({ row, n: count }, ci) => {
    edges.push([0, base + ci, count])
    groups.forEach((g, gi) => {
      if (!groupAccepts(g, row)) return
      if (g.counts) {
        const node = cBase + gi * 7 + (row.tp ?? 0)
        edges.push([base + ci, node, count])
      } else edges.push([base + ci, gBase + gi, count])
    })
  })
  groups.forEach((g, gi) => {
    edges.push([gBase + gi, 1, g.size])
    if (g.counts) for (let tp = 1; tp <= 6; tp++) edges.push([cBase + gi * 7 + tp, gBase + gi, g.counts[tp] ?? 0])
  })
  const total = groups.reduce((s, g) => s + g.size, 0)
  return total - maxFlow(n, edges, 0, 1)
}

/* ------------------------------------------------------------------------------ checks */

export function precheckSection(ctx: PoolContext, section: StandardSection, opts: PoolOptions = {}): SectionPrecheck {
  const pool = buildSectionPool(ctx, section, opts)
  return precheckPool(section, pool.items, pool.eligibleQuestions, pool.modeExcluded)
}

export function precheckPool(
  section: StandardSection,
  items: Item[],
  eligibleQuestions: number,
  modeExcluded: number,
): SectionPrecheck {
  const M = section.questionCount
  const O = offeredMarks(section)
  const groups = groupSpecs(section)
  const members = items.flatMap((i) => i.members)
  const label = section.label
  const failures: StandardShortage[] = []
  let minSlack = Number.POSITIVE_INFINITY

  // count
  const counts = mk(M, eligibleQuestions)
  minSlack = Math.min(minSlack, eligibleQuestions - M)
  if (counts.short > 0) failures.push({ section: label, kind: 'count', need: M, have: eligibleQuestions })

  // unit lines
  const quota: SectionPrecheck['quota'] = []
  if (section.quota) {
    const basis = section.quota.basis
    for (const line of section.quota.lines) {
      const key = line.unit.kind === 't1_t3' ? 't1_t3' : `unit:${line.unit.nodeId}`
      let available: number
      if (basis === 'questions') {
        available = members.filter((d) => d.bucket === key).length
      } else {
        const amounts = tally(
          members.filter((d) => (d.unitMarks[key] ?? 0) > 0),
          (d) => String(d.unitMarks[key]),
        )
        const grid = reachGrid(
          [...amounts.values()].map(({ row, n }) => ({ size: 1, val: row.unitMarks[key]!, mult: n })),
          Math.max(1, Math.min(M, members.length)),
          line.value,
        )
        // any count up to M may contribute to the line; best reachable total not above the value
        available = 0
        const w = line.value + 1
        const cMax = Math.max(1, Math.min(M, members.length))
        for (let v = line.value; v >= 0 && !available; v--)
          for (let c = 0; c <= cMax; c++) if (grid[c * w + v]) { available = v; break }
      }
      const row = { unit: line.unit, basis, ...mk(line.value, available) }
      quota.push(row)
      minSlack = Math.min(minSlack, available - line.value)
      if (row.short > 0)
        failures.push({ section: label, kind: 'unit', basis, unit: unitRefOf(key), need: line.value, have: available })
    }
  }

  // tp lines per slot group
  const tp: SectionPrecheck['tp'] = []
  if (section.profile) {
    const tpFail: StandardShortage[] = []
    groups.forEach((g) => {
      const slot = { from: g.from, to: g.to }
      const inBand = members.filter((d) => groupAccepts(g, d))
      const row = { slot, tpMin: g.tpMin, tpMax: g.tpMax, ...mk(g.size, inBand.length) }
      tp.push(row)
      minSlack = Math.min(minSlack, inBand.length - g.size)
      if (row.short > 0) {
        const tpOnly = members.filter((d) => d.tp !== null && d.tp >= g.tpMin && d.tp <= g.tpMax).length
        if (tpOnly >= g.size && g.size > 0)
          tpFail.push({ section: label, kind: 'marks', slot, need: g.size, have: inBand.length, marksBand: { min: g.mMin, max: Number.isFinite(g.mMax) ? g.mMax : g.mMin } })
        else tpFail.push({ section: label, kind: 'tp', slot, tp: { min: g.tpMin, max: g.tpMax }, need: g.size, have: inBand.length })
      }
      if (g.counts)
        for (let t = 1; t <= 6; t++) {
          const want = g.counts[t] ?? 0
          if (want <= 0) continue
          const have = inBand.filter((d) => d.tp === t).length
          const exact = { slot, tpMin: g.tpMin, tpMax: g.tpMax, tp: t, ...mk(want, have) }
          tp.push(exact)
          minSlack = Math.min(minSlack, have - want)
          if (exact.short > 0) tpFail.push({ section: label, kind: 'tp', slot, tp: { min: t, max: t }, need: want, have })
        }
    })
    if (tpFail.length === 0 && groups.length > 0) {
      // Cross-group feasibility: prefix by prefix, so the first group that cannot be filled is named.
      for (let j = 1; j <= groups.length; j++) {
        const deficit = flowDeficit(members, groups.slice(0, j))
        if (deficit > 0) {
          const g = groups[j - 1]!
          tpFail.push({
            section: label,
            kind: 'tp',
            slot: { from: g.from, to: g.to },
            tp: { min: g.tpMin, max: g.tpMax },
            need: g.size,
            have: Math.max(0, g.size - deficit),
          })
          break
        }
      }
    }
    failures.push(...tpFail)
  }

  // kbat
  let kbat: Short | null = null
  if (section.kbatMarks !== null && section.kbatMarks !== undefined) {
    const K = section.kbatMarks
    const top = Math.max(O, K)
    const bySize = tally(items, (i) => `${i.size}|${i.kbat}`)
    const grid = reachGrid(
      [...bySize.values()].map(({ row, n }) => ({ size: row.size, val: Math.min(row.kbat, top + 1), mult: n })),
      M,
      top,
    )
    const w = top + 1
    let max = -1
    let min = -1
    let below = 0
    for (let v = 0; v <= top; v++)
      if (grid[M * w + v]) {
        if (min < 0) min = v
        max = v
        if (v <= K) below = v
      }
    if (max >= 0) {
      const ok = !!grid[M * w + K]
      kbat = mk(K, ok ? K : Math.min(below, max))
      if (K > max) kbat = mk(K, max)
      minSlack = Math.min(minSlack, (K > max ? max : K) - K)
      if (!ok) {
        if (K > max) failures.push({ section: label, kind: 'kbat', need: Math.max(1, K), have: max })
        else if (K < min) failures.push({ section: label, kind: 'combination', blocking: 'kbat', need: M, have: eligibleQuestions })
        else failures.push({ section: label, kind: 'kbat', need: Math.max(1, K), have: below })
      }
    } else kbat = mk(K, 0)
  }

  // marks
  let reachable = true
  let best = 0
  {
    const bySize = tally(items, (i) => `${i.size}|${i.marks}`)
    const grid = reachGrid(
      [...bySize.values()].map(({ row, n }) => ({ size: row.size, val: Math.min(row.marks, O + 1), mult: n })),
      M,
      O,
    )
    const w = O + 1
    reachable = !!grid[M * w + O]
    for (let v = O; v >= 0; v--) if (grid[M * w + v]) { best = v; break }
    if (!reachable && counts.short === 0) failures.push({ section: label, kind: 'marks', need: O, have: best })
  }

  // Fixed reporting order: count, unit, tp (incl. marks bands), kbat, marks.
  const rank = (f: StandardShortage) => {
    if (f.kind === 'unit') return 1
    if (f.kind === 'tp' || (f.kind === 'marks' && f.slot)) return 2
    if (f.kind === 'kbat' || f.kind === 'combination') return 3
    if (f.kind === 'marks') return 4
    return 0
  }
  failures.sort((a, b) => rank(a) - rank(b))

  return {
    position: section.position,
    label,
    slots: M,
    effectiveMarks: section.markBudget,
    offeredMarks: O,
    eligible: eligibleQuestions,
    modeExcluded,
    counts,
    marks: { needed: O, reachable, best },
    quota,
    tp,
    kbat,
    failures,
    minSlack: Number.isFinite(minSlack) ? minSlack : 0,
  }
}
