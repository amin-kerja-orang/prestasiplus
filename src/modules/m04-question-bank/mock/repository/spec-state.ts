/**
 * Seed-phase bookkeeping of the `questions` dataset (owner M04): the distribution as it will
 * compile (default spec + the transforms applied so far through `overrideSpec`), and the anchor
 * ledger (which cell each anchor occupies), so M04 can
 * - validate contributed cells (`questions.contributeCells`) against the current distribution, and
 * - complete and validate contributed anchors (`questions.anchorRow`, `validateAnchor`) with the
 *   same capacity rule the compiler enforces (a cell holds at most `count` anchors).
 *
 * The state belongs to one seed run: it resets whenever the dataset's version changes (a `reset()`
 * clears and re-seeds the dataset, which bumps the version).
 */

import type { CellSpec } from '@/mock/dataset'

import { STATE_PROFILE_ANCHORS } from '../data/anchors'
import { PKSK_DIFFICULTY, PKSK_DOMAINS, PKSK_TOTAL, SPM_POOL, TABLE_A } from '../data/tables'
import { M04_ANCHOR_ROWS, questionsDataset } from '../datasets/questions'
import { facetKey, pkskFacets, questionSpec } from '../datasets/questions-spec'
import { QUESTION_FACETS, pickFacets } from '../datasets/question-row'
import type { QuestionFacets } from './types'

type F = QuestionFacets
export type CellTransform = (cells: CellSpec<F>[]) => CellSpec<F>[]

interface Resolved {
  cells: CellSpec<F>[]
  /** Cell key of each entry of `cells`. */
  keys: string[]
  /** Count per cell key (duplicates summed, as the compiler merges them). */
  counts: Map<string, number>
}

interface State {
  version: number
  transforms: CellTransform[]
  resolved: Resolved | null
  /** Anchor id → cell key (own anchors, completed rows, validated contributions). */
  ledger: Map<number, string>
  /** Anchors per cell key (kept in step with `ledger`). */
  use: Map<string, number>
  profile: boolean
}

let state: State | null = null

function fresh(): State {
  const s: State = {
    version: questionsDataset.version,
    transforms: [],
    resolved: null,
    ledger: new Map(),
    use: new Map(),
    profile: false,
  }
  for (const row of M04_ANCHOR_ROWS) setLedger(s, row.id, facetKey(pickFacets(row)))
  return s
}

function setLedger(s: State, id: number, key: string): void {
  const prev = s.ledger.get(id)
  if (prev === key) return
  if (prev !== undefined) s.use.set(prev, (s.use.get(prev) ?? 1) - 1)
  s.ledger.set(id, key)
  s.use.set(key, (s.use.get(key) ?? 0) + 1)
}

/** Records that anchor `id` occupies the cell `key`. */
export function ledgerSet(id: number, key: string): void {
  setLedger(specState(), id, key)
}

export function specState(): State {
  if (!state || state.version !== questionsDataset.version) state = fresh()
  return state
}

/** The distribution the dataset will compile (with the transforms applied so far), with keys. */
export function resolved(): Resolved {
  const s = specState()
  if (!s.resolved) {
    let cells = questionSpec().cells.map((c) => ({ facets: { ...c.facets }, count: c.count }))
    for (const t of s.transforms) cells = t(cells)
    const keys = cells.map((c) => facetKey(c.facets))
    const counts = new Map<string, number>()
    keys.forEach((k, i) => counts.set(k, (counts.get(k) ?? 0) + (cells[i] as CellSpec<F>).count))
    s.resolved = { cells, keys, counts }
  }
  return s.resolved
}

export function resolvedCells(): CellSpec<F>[] {
  return resolved().cells
}

/** Records a transform (the caller also passes it to `overrideSpec`). */
export function recordTransform(t: CellTransform): void {
  const s = specState()
  s.transforms.push(t)
  s.resolved = null
}

/** Anchors per cell key (read-only view of the ledger). */
export function anchorUse(): ReadonlyMap<string, number> {
  return specState().use
}

export function cellCounts(): ReadonlyMap<string, number> {
  return resolved().counts
}

// ---------------------------------------------------------------------------------------------
// Cell transforms
// ---------------------------------------------------------------------------------------------

const isPoolHost = (f: F, s: number, l: number, d: number) =>
  f.pkskDomainId === null &&
  f.subjectId === s &&
  f.educationLevelId === l &&
  f.status === 'approved' &&
  f.isActive &&
  f.questionType === 'mcq' &&
  f.difficultyLevel === d

/** Rows a pool change may move: not the teacher databank, not outside the S10 coverage. */
const isMovable = (f: F) => !f.teacherDatabank && !f.coverageExcluded

/**
 * Moves `delta` rows of (subject, level, difficulty) between the non-pool and pool eligible MCQ
 * cells (delta > 0: into the pool). Cells holding a reservation are never shrunk below their
 * anchors; every other facet is kept, so Q-ELIGIBLE, Q-DIFFICULTY and the layer-1 cells stay.
 */
export function poolMove(
  cells: CellSpec<F>[],
  s: number,
  l: number,
  d: number,
  delta: number,
  reserved: ReadonlyMap<string, number>,
): CellSpec<F>[] {
  if (delta === 0) return cells
  const intoPool = delta > 0
  let left = Math.abs(delta)
  const out = cells.map((c) => ({ facets: { ...c.facets }, count: c.count }))
  const added = new Map<string, CellSpec<F>>()
  for (const c of out) {
    if (left === 0) break
    if (!isPoolHost(c.facets, s, l, d) || !isMovable(c.facets) || c.facets.spmPool === intoPool)
      continue
    const locked = reserved.get(facetKey(c.facets)) ?? 0
    const t = Math.min(left, c.count - locked)
    if (t <= 0) continue
    c.count -= t
    left -= t
    const twin = { ...c.facets, spmPool: intoPool }
    const k = facetKey(twin)
    const prev = added.get(k)
    if (prev) prev.count += t
    else added.set(k, { facets: twin, count: t })
  }
  if (left > 0) {
    throw new Error(
      `no room: ${String(Math.abs(delta))} rows cannot move ${intoPool ? 'into' : 'out of'} the SPM pool for subject ${String(s)} level ${String(l)} difficulty ${String(d)} (${String(left)} short)`,
    )
  }
  return [...out.filter((c) => c.count > 0), ...added.values()]
}

/** Current pool count of (subject, level, difficulty) in `cells`. */
export function poolCount(cells: readonly CellSpec<F>[], s: number, l: number, d: number): number {
  let n = 0
  for (const c of cells) if (isPoolHost(c.facets, s, l, d) && c.facets.spmPool) n += c.count
  return n
}

/** Replaces the PKSK family by `pksk` cells (domain × level × difficulty). */
export function replacePksk(cells: CellSpec<F>[], pksk: readonly CellSpec<F>[]): CellSpec<F>[] {
  return [...cells.filter((c) => c.facets.pkskDomainId === null), ...pksk.map((c) => ({ ...c }))]
}

// ---------------------------------------------------------------------------------------------
// Contributed cells: validation
// ---------------------------------------------------------------------------------------------

export interface ContributedCell {
  facets: Partial<F>
  count: number
}

const POOL_KEYS = ['difficultyLevel', 'educationLevelId', 'spmPool', 'subjectId']
const PKSK_KEYS = ['difficultyLevel', 'pkskDomainId', 'pkskTargetLevel']

const isCount = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0

/** Splits contributed cells into the two accepted families; returns messages for invalid cells. */
export function classifyCells(cells: readonly ContributedCell[]): {
  pool: { s: number; l: number; d: number; count: number }[]
  pksk: { domain: number; level: 'T1' | 'T4'; d: number; count: number }[]
  issues: string[]
} {
  const pool: { s: number; l: number; d: number; count: number }[] = []
  const pksk: { domain: number; level: 'T1' | 'T4'; d: number; count: number }[] = []
  const issues: string[] = []
  const seen = new Set<string>()
  cells.forEach((cell, i) => {
    const where = `cell ${String(i)}`
    if (typeof cell !== 'object' || cell === null || typeof cell.facets !== 'object') {
      issues.push(`${where}: expected { facets, count }`)
      return
    }
    if (!isCount(cell.count)) {
      issues.push(`${where}: count must be a non-negative integer`)
      return
    }
    const keys = Object.keys(cell.facets).sort()
    for (const k of keys) {
      if (!(QUESTION_FACETS as readonly string[]).includes(k))
        issues.push(`${where}: '${k}' is not a question facet`)
    }
    const f = cell.facets
    const d = f.difficultyLevel
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 5) {
      issues.push(`${where}: difficultyLevel must be 1–5`)
      return
    }
    if (keys.join() === POOL_KEYS.join()) {
      const s = f.subjectId
      const l = f.educationLevelId
      if (f.spmPool !== true) issues.push(`${where}: pool cells carry spmPool = true`)
      if (typeof s !== 'number' || !(s in SPM_POOL)) {
        issues.push(`${where}: subject ${String(s)} has no SPM pool (M06 §6.10)`)
        return
      }
      if (l !== 10 && l !== 11) {
        issues.push(`${where}: SPM pool levels are 10 and 11 (T4/T5), got ${String(l)}`)
        return
      }
      if ((TABLE_A[s]?.[l - 1] ?? null) === null) {
        issues.push(`${where}: subject ${String(s)} has no level ${String(l)} link`)
        return
      }
      const k = `p:${String(s)}:${String(l)}:${String(d)}`
      if (seen.has(k)) issues.push(`${where}: duplicate pool cell`)
      seen.add(k)
      pool.push({ s, l, d, count: cell.count })
      return
    }
    if (keys.join() === PKSK_KEYS.join()) {
      const domain = f.pkskDomainId
      const level = f.pkskTargetLevel
      if (typeof domain !== 'number' || !(domain in PKSK_DOMAINS)) {
        issues.push(`${where}: unknown PKSK domain ${String(domain)}`)
        return
      }
      if (level !== 'T1' && level !== 'T4') {
        issues.push(`${where}: pkskTargetLevel must be T1 or T4`)
        return
      }
      const k = `k:${String(domain)}:${level}:${String(d)}`
      if (seen.has(k)) issues.push(`${where}: duplicate PKSK cell`)
      seen.add(k)
      pksk.push({ domain, level, d, count: cell.count })
      return
    }
    issues.push(
      `${where}: facets must be {subjectId, educationLevelId, difficultyLevel, spmPool: true} (SPM pool) or {pkskDomainId, pkskTargetLevel, difficultyLevel} (PKSK)`,
    )
  })
  if (pksk.length > 0) {
    // The PKSK family is replaced as a whole and must keep the §6.13 totals.
    const total = pksk.reduce((a, c) => a + c.count, 0)
    if (total !== PKSK_TOTAL)
      issues.push(`PKSK cells sum to ${String(total)}, Q-PKSK is ${String(PKSK_TOTAL)}`)
    for (const [id, [, t1, t4]] of Object.entries(PKSK_DOMAINS)) {
      for (const [level, want] of [
        ['T1', t1],
        ['T4', t4],
      ] as const) {
        const got = pksk
          .filter((c) => c.domain === Number(id) && c.level === level)
          .reduce((a, c) => a + c.count, 0)
        if (got !== want)
          issues.push(
            `PKSK domain ${id} ${level}: ${String(got)} rows, M07 §6.8 has ${String(want)}`,
          )
      }
    }
    PKSK_DIFFICULTY.forEach((want, i) => {
      const got = pksk.filter((c) => c.d === i + 1).reduce((a, c) => a + c.count, 0)
      if (got !== want)
        issues.push(
          `PKSK difficulty ${String(i + 1)}: ${String(got)} rows, Q-DIFFICULTY needs ${String(want)}`,
        )
    })
    if (pksk.some((c) => c.d === 5 && c.count > 0))
      issues.push('no PKSK row has difficulty 5 (XL-31)')
  }
  return { pool, pksk, issues }
}

export function pkskCellsOf(
  pksk: readonly { domain: number; level: 'T1' | 'T4'; d: number; count: number }[],
): CellSpec<F>[] {
  return pksk
    .filter((c) => c.count > 0)
    .map((c) => ({ facets: pkskFacets(c.domain, c.level, c.d), count: c.count }))
}

/** State-profile flag (test-only override), recorded so anchors of the profile are in the ledger. */
export function markProfile(): void {
  const s = specState()
  if (s.profile) return
  s.profile = true
  for (const a of STATE_PROFILE_ANCHORS) setLedger(s, a.id, facetKey(a.facets))
}
