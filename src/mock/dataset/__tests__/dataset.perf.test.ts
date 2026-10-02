/**
 * Performance tests (overview §6.6) on 478,499 rows (the M05 answer log size, larger than the
 * 466,041-row M04 questions).
 *
 * Budgets (Delivery Lead decisions, F-09 G4): every query shape ≤ 50 ms; an arbitrary JS `match`
 * over cheap fields (`matchFields`) is the declared exception ≤ 100 ms; a query that derives every
 * row is ≤ 1,500 ms cold and ≤ 50 ms repeated; compile ≤ 5,000 ms.
 *
 * The harness is shared: `../testing/perf-calibration.ts` (module perf tests use it the same way).
 *
 * **Paired calibration (F09-1).** Other agents often load this machine, so fixed millisecond gates
 * alone are unreliable. The **floor** is the cheapest per-row JS work at this size: a plain loop
 * over 478,499 strings with one reused object and `includes`. Its strings are built and warmed up
 * once (separate step); then every case is **paired** with the floor. Repeatable cases are
 * **interleaved**: 7 rounds of (one floor pass, one timed call), so each timing has a floor from the
 * same moment; the case's floor is the best floor pass of its rounds. Single-shot cases (compile,
 * cold full derivation, first search after reload) take the floor immediately before and after
 * (best of 3 each; the lower wins).
 * - **Budget gate:** `best ≤ budget × scale`, `scale = min(1.5, max(1, floor / 30 ms))`, where 30 ms
 *   is the quiet-machine floor. If the paired floor exceeds 45 ms (1.5 × 30) the case is re-measured
 *   (up to 3 pairs); if it is still above, the budget gate is **skipped** with the message "machine
 *   too loaded — timing not authoritative (floor X ms)" — the budget is never widened beyond 1.5×.
 * - **Ratio gate (always enforced, also for skipped cases):** `best ≤ ratioCap × floor + 1 ms`.
 *   Load slows the case and its paired floor alike, so the ratio is load-independent. The caps are
 *   tuned from measured ratios (see `RATIO_CAPS`) so a 2× regression fails for every case not
 *   marked noisy. The 1 ms slack covers JIT/GC noise on sub-millisecond operations.
 *
 * Each case runs 3 warm-up calls, then 7 timed calls; the **best** is asserted (the median is
 * printed only). Every calibrated figure is logged: floor, scale, ratio, cap, and any skip.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { floor as floorIds } from '../../db/id-strategies'
import { createDb } from '../../db/transaction'
import { mulberry32 } from '../../determinism/prng'
import { defineVirtualDataset, hashKey } from '../dataset'
import {
  createPerfCalibration,
  type CaseOptions,
  type FloorKind,
  type PerfCap,
} from '../testing/perf-calibration'
import type { VirtualDataset } from '../types'
import { anchor, buildCheapQuestions, buildQuestions, type Q, type QFacet } from './fixtures'

const N = 478_499
const BUDGET_MS = 50
/** Declared exception: an arbitrary JS `match` over cheap fields (one predicate call per row). */
const MATCH_BUDGET_MS = 100
const COLD_FULL_BUDGET_MS = 1_500
const COMPILE_BUDGET_MS = 5_000
/**
 * Maximum `best / paired floor` per case (F09-3, F09-5, F09-7), from 5 full-file calibration runs of
 * the current code on a loaded machine (js floors 35.6–41 ms, native 10.9–14 ms), with
 * deterministic per-call costs. The proof cases add 9 measurements each in the proof context (the
 * full file, and alone with `-t` after their group warm-up). Computed with `suggestCaps`
 * (`../testing/perf-caps.ts`): the cap lies in the honest window [1.2 × the worst run, 1.95 × the
 * fastest run]. Every cap below is honest (a plain number): no slack, and cap < 2 × the fastest run
 * seen, so a real 2× of any run at least that fast fails; the regression proofs (3 of 3,
 * search/match/where groups) check it. A case whose spread leaves no honest window would be
 * **noisy** (an object cap with a slack and no 2× guarantee); none is at present. Fast cases are
 * batched to ≥ 5 ms samples; native string-search cases are paired with the native floor
 * (`NATIVE_CASES`). Re-tune with `CALIBRATE = true` and the helper's procedure.
 */
const RATIO_CAPS: Record<string, PerfCap> = {
  'count()': 0.00043, // min 0.00025, median 0.00028, max 0.00030, 5 runs
  'count(facets)': 0.0093, // min 0.00619, median 0.00619, max 0.00656, 5 runs
  'groupCount(subjectId, where)': 0.0088, // min 0.00569, median 0.00583, max 0.00605, 5 runs
  'query page 1000 asc': 0.033, // min 0.01899, median 0.02139, max 0.02229, 5 runs
  'query page 1000 desc': 0.0056, // min 0.00332, median 0.00367, max 0.00436, 5 runs
  'query last page (all rows)': 0.14, // min 0.07921, median 0.08903, max 0.09073, 5 runs
  'query newest first (createdAt desc) page 1000': 0.043, // min 0.02263, median 0.02848, max 0.03201, 5 runs
  'query id range page 10': 0.016, // min 0.00839, median 0.01004, max 0.01067, 5 runs
  'query facet sort page 1000': 0.055, // min 0.03400, median 0.03631, max 0.03891, 5 runs
  'get(id)': 0.0000019, // min 0.00000, median 0.00000, max 0.00000, 5 runs
  'getMany(20)': 0.00037, // min 0.00023, median 0.00024, max 0.00028, 5 runs
  'sample(where, 20)': 0.024, // min 0.01457, median 0.01587, max 0.01861, 5 runs
  'compile (2,976 cells, 1,000 anchors)': 3.9, // min 2.38300, median 2.56100, max 2.69300, 5 runs
  'cheap field where (score ≥ x), page 1': 0.22, // min 0.11470, median 0.14830, max 0.18180, 14 runs
  'cheap field where + facets, page 50': 0.21, // min 0.13700, median 0.13940, max 0.16390, 5 runs
  'text search (search on a cheap field, warm column), page 1': 0.92, // min 0.50350, median 0.61270, max 0.68340, 5 runs
  'text search + facet filter, page 3': 2.2, // min 1.30900, median 1.43700, max 1.61700, 5 runs
  'count(search on a cheap field)': 1.4, // min 0.73100, median 0.92920, max 1.12000, 5 runs
  'count(search, caseSensitive) — the substring path that replaces match': 1.6, // min 0.84570, median 0.98610, max 1.25100, 5 runs
  'groupCount(cheap field, facets)': 0.13, // min 0.06770, median 0.08144, max 0.08875, 5 runs
  'sort by cheap field (score desc), one subject, page 10': 0.54, // min 0.31080, median 0.35740, max 0.39650, 5 runs
  'warm: repeated match query with cacheKey, page 200': 0.00018, // min 0.00011, median 0.00012, max 0.00014, 5 runs
  'match on a cheap field with matchFields (reused partial row), count': 1.7, // min 0.94720, median 1.10990, max 1.32610, 14 runs
  'match with matchFields + facets, page 5': 1.1, // min 0.68980, median 0.71200, max 0.76610, 5 runs
  'full derivation, where on a non-cheap derived field, repeated': 0.0044, // min 0.00260, median 0.00293, max 0.00359, 5 runs
  'full derivation, where on a non-cheap derived field, cold': 13, // min 7.11700, median 8.01500, max 9.93900, 5 runs
  'full derivation, match without matchFields (cacheKey), repeated': 0.0025, // min 0.00140, median 0.00150, max 0.00206, 5 runs
  'full derivation, match without matchFields (cacheKey), cold': 15, // min 7.98600, median 9.66900, max 10.33000, 5 runs
  'hc count()': 0.031, // min 0.01648, median 0.01863, max 0.02533, 5 runs
  'hc count(userId)': 0.18, // min 0.11660, median 0.11840, max 0.13650, 5 runs
  'hc count(week)': 0.29, // min 0.16530, median 0.17540, max 0.23620, 5 runs
  'hc count(userId in 50 users)': 0.23, // min 0.14250, median 0.15130, max 0.18530, 5 runs
  'hc groupCount(week, userId)': 0.21, // min 0.11040, median 0.14320, max 0.16190, 5 runs
  'hc groupCount(userId) — 30,000 groups': 0.24, // min 0.13380, median 0.15200, max 0.19390, 5 runs
  'hc query(userId) page 1': 0.23, // min 0.12350, median 0.14680, max 0.17360, 5 runs
  'hc count(userId, isCorrect) — cheap field': 0.14, // min 0.07287, median 0.07914, max 0.11250, 5 runs
  'hc per-user cheap query page 1 (userId + isCorrect)': 0.13, // min 0.07371, median 0.07944, max 0.10580, 5 runs
  'hc id window + cheap query (id 100000–100100, isCorrect)': 0.0029, // min 0.00157, median 0.00191, max 0.00231, 5 runs
  'hc sample(week, 20)': 0.49, // min 0.29210, median 0.32400, max 0.38780, 5 runs
  'hc compile (120,000 cells)': 21, // min 10.89000, median 12.21000, max 17.05000, 5 runs
  'first case-insensitive search after reload': 1.8, // min 0.91350, median 1.13300, max 1.45700, 5 runs
  'first case-sensitive search after reload': 1.6, // min 0.88690, median 1.02400, max 1.30100, 5 runs
  'M04 search index build (repetitive text)': 4.8, // min 2.47700, median 3.30400, max 3.58000, 5 runs
  'search index build (unique text)': 27, // min 15.60000, median 17.83000, max 20.25000, 5 runs
  'M04 S1 search "apakah" page 1 (id desc)': 0.24, // min 0.13400, median 0.15480, max 0.17400, 5 runs
  'M04 S1 search "apakah" page 1 (newest first)': 0.26, // min 0.15090, median 0.17100, max 0.17880, 5 runs
  'M04 count(search "apakah")': 0.26, // min 0.14000, median 0.16960, max 0.18050, 14 runs
  'M04 S1 search, rare term, page 1': 0.13, // min 0.07393, median 0.08069, max 0.08766, 5 runs
  'M04 S1 search + subject filter, page 2': 0.19, // min 0.09603, median 0.12240, max 0.15270, 5 runs
}
/** The shared paired-calibration harness (see `../testing/perf-calibration.ts`). */
/** Calibration mode (re-tuning caps): missing caps log instead of throwing; injection tests skip. */
const CALIBRATE = false
const perf = createPerfCalibration({
  prefix: 'F-09 perf',
  caps: CALIBRATE ? {} : RATIO_CAPS,
  floorRows: N,
  calibrate: CALIBRATE,
})

/** Cases whose work is native string search over a joined index: paired with the native floor. */
const NATIVE_CASES = new Set([
  'text search (search on a cheap field, warm column), page 1',
  'text search + facet filter, page 3',
  'count(search on a cheap field)',
  'count(search, caseSensitive) — the substring path that replaces match',
  'first case-insensitive search after reload',
  'first case-sensitive search after reload',
])
const kindOf = (label: string): FloorKind => (NATIVE_CASES.has(label) ? 'native' : 'js')

beforeAll(() => perf.setup())

// --- 1. facet, id and paging queries ---------------------------------------------------------

describe(`performance (${String(N)} rows)`, () => {
  let ds: VirtualDataset<Q, QFacet>
  let compile = { ms: 0, floor: 0 }
  const results: Record<string, string> = {}

  beforeAll(() => {
    const anchors: Q[] = []
    for (let i = 0; i < 500; i++) {
      anchors.push(
        anchor({
          id: 1_000 + i * 997,
          subjectId: 1 + (i % 20),
          levelId: 1 + (i % 8),
          difficulty: 1 + (i % 3),
        }),
      )
      anchors.push(
        anchor({ id: 900_001 + i, subjectId: 1 + (i % 20), levelId: 1 + (i % 8), difficulty: 2 }),
      )
    }
    ds = buildQuestions({ total: N, idMax: 564_161, anchors, reserved: [[900_001, 900_999]] })
    const before = perf.floorNow()
    const t = performance.now()
    ds.compile()
    const ms = performance.now() - t
    compile = { ms, floor: Math.min(before, perf.floorNow()) }
  })

  const cases: [string, () => unknown][] = [
    ['count()', () => ds.count()],
    ['count(facets)', () => ds.count({ status: 'approved', isActive: true, subjectId: [1, 2, 3] })],
    [
      'groupCount(subjectId, where)',
      () => ds.groupCount('subjectId', { status: 'approved', isActive: true }),
    ],
    [
      'query page 1000 asc',
      () => ds.query({ where: { isActive: true }, page: 1_000, pageSize: 20 }),
    ],
    [
      'query page 1000 desc',
      () => ds.query({ sort: { field: 'id', dir: 'desc' }, page: 1_000, pageSize: 20 }),
    ],
    ['query last page (all rows)', () => ds.query({ page: Math.ceil(N / 20), pageSize: 20 })],
    [
      'query newest first (createdAt desc) page 1000',
      () => ds.query({ sort: { field: 'createdAt', dir: 'desc' }, page: 1_000, pageSize: 20 }),
    ],
    [
      'query id range page 10',
      () => ds.query({ where: { id: { gte: 200_000 } }, page: 10, pageSize: 20 }),
    ],
    [
      'query facet sort page 1000',
      () =>
        ds.query({
          where: { status: 'approved' },
          sort: [{ field: 'subjectId', dir: 'desc' }],
          page: 1_000,
          pageSize: 20,
        }),
    ],
    ['get(id)', () => ds.get(300_001)],
    ['getMany(20)', () => ds.getMany(Array.from({ length: 20 }, (_, i) => 100_000 + i * 1_311))],
    ['sample(where, 20)', () => ds.sample({ subjectId: 3, isActive: true }, 20, mulberry32(7))],
  ]

  for (const [label, fn] of cases) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results)
    })
  }

  it(`compile ≤ ${String(COMPILE_BUDGET_MS)} ms (paired)`, (ctx) => {
    perf.gate(
      ctx,
      'compile (2,976 cells, 1,000 anchors)',
      compile.ms,
      compile.floor,
      COMPILE_BUDGET_MS,
      results,
    )
  })

  it('reports timings', () => {
    expect(ds.count()).toBe(N)
    perf.report(`N=${String(N)} cells=${String(ds.cells().length)}`, results)
  })
})

// --- 2. slow path: cheap fields, search, match, full derivation ------------------------------

describe(`slow path performance (${String(N)} rows)`, () => {
  let cheap: VirtualDataset<Q, QFacet>
  let full: VirtualDataset<Q, QFacet>
  const results: Record<string, string> = {}
  let i = 0
  let firstSearchMs = 0
  let firstValueColumnMs = 0

  beforeAll(() => {
    cheap = buildCheapQuestions({ total: N, idMax: 564_161 })
    full = buildQuestions({ total: N, idMax: 564_161, name: 'test.questions.full' })
    cheap.compile()
    full.compile()
    let t = performance.now()
    cheap.count({}, undefined, { search: { term: 'x', fields: ['text'] } })
    cheap.count({}, undefined, { search: { term: 'x', fields: ['text'], caseSensitive: true } })
    firstSearchMs = performance.now() - t
    t = performance.now()
    cheap.count({}, (r) => r.score > 1 && r.text.length > 0, { matchFields: ['text', 'score'] })
    firstValueColumnMs = performance.now() - t
  })

  // Every case has a deterministic cost per call (F09-5a): fixed parameters for the paths that
  // never cache (cheap-field where, search, partial-row match, facet counts). The one cached path
  // (the generic sort caches its sorted refs per query) cycles a fixed set of 20 subjects with
  // `cycle: 20`, so every timed sample contains each subject exactly once.
  const budgeted: [string, () => unknown, CaseOptions?][] = [
    [
      'cheap field where (score ≥ x), page 1',
      () => cheap.query({ where: { score: { gte: 80 } }, page: 1, pageSize: 20 }),
    ],
    [
      'cheap field where + facets, page 50',
      () =>
        cheap.query({
          where: { score: { gte: 80 }, isActive: true },
          page: 50,
          pageSize: 20,
        }),
    ],
    [
      'text search (search on a cheap field, warm column), page 1',
      () =>
        cheap.query({
          search: { term: 'Mengapakah soalan 1', fields: ['text'] },
          page: 1,
          pageSize: 20,
        }),
    ],
    [
      'text search + facet filter, page 3',
      () =>
        cheap.query({
          where: { subjectId: 5, isActive: true },
          search: { term: 'bagaimana', fields: ['text'] },
          page: 3,
          pageSize: 20,
        }),
    ],
    [
      'count(search on a cheap field)',
      () => cheap.count({}, undefined, { search: { term: 'soalan 42', fields: ['text'] } }),
    ],
    [
      'count(search, caseSensitive) — the substring path that replaces match',
      () =>
        cheap.count({}, undefined, {
          search: { term: 'soalan 42', fields: ['text'], caseSensitive: true },
        }),
    ],
    ['groupCount(cheap field, facets)', () => cheap.groupCount('score', { subjectId: 5 })],
    [
      'sort by cheap field (score desc), one subject, page 10',
      () =>
        cheap.query({
          where: { subjectId: 1 + (i++ % 20) },
          sort: { field: 'score', dir: 'desc' },
          page: 10,
          pageSize: 20,
        }),
      { cycle: 20 },
    ],
    [
      'warm: repeated match query with cacheKey, page 200',
      () =>
        full.query({
          match: (r) => r.score > 97,
          cacheKey: 'score>97',
          page: 200,
          pageSize: 20,
        }),
    ],
  ]
  const optionsOf = (label: string, options?: CaseOptions): CaseOptions => ({
    kind: kindOf(label),
    ...(typeof options === 'object' ? options : {}),
  })
  for (const [label, fn, options] of budgeted) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired, ${kindOf(label)} floor)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results, optionsOf(label, options))
    })
  }

  // Declared budget exception: an arbitrary JS `match` over cheap fields (`matchFields`), one
  // predicate call per row on a reused partial row. Substring tests belong in `search` instead.
  const matchCases: [string, () => unknown, CaseOptions?][] = [
    [
      'match on a cheap field with matchFields (reused partial row), count',
      () => cheap.count({}, (r) => r.text.includes('soalan 42'), { matchFields: ['text'] }),
    ],
    [
      'match with matchFields + facets, page 5',
      () =>
        cheap.query({
          match: (r) => r.score > 90 && r.difficulty === 2,
          matchFields: ['score', 'difficulty'],
          page: 5,
          pageSize: 20,
        }),
    ],
  ]
  for (const [label, fn, options] of matchCases) {
    it(`${label} ≤ ${String(MATCH_BUDGET_MS)} ms (declared exception, paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, MATCH_BUDGET_MS, results, optionsOf(label, options))
    })
  }

  // Regression proofs (F09-5c): one case of each group (search: the M04 dictionary search, below) made really 2× slower (`slowdown(fn, 2)`,
  // the same run doubled) must fail its ratio gate in 3 of 3 measurements. Skipped proofs are
  // counted and fail the run (`assertSkipShare`, F09-6).
  const proofs: [group: string, label: string][] = [
    ['match', 'match on a cheap field with matchFields (reused partial row), count'],
    ['where', 'cheap field where (score ≥ x), page 1'],
  ]
  for (const [group, label] of proofs) {
    it(`regression proof: a 2× slower ${group} case fails its ratio gate (3 of 3)`, (ctx) => {
      const entry = [...budgeted, ...matchCases].find(([l]) => l === label)
      if (!entry) throw new Error(`no case '${label}'`)
      // The gate runs in the full file, where the shared scan code has seen every plan of this
      // group (JIT state). Recreate that context, so a proof run alone (-t) measures the case in
      // the same state as its gate.
      for (const [, fn] of [...budgeted, ...matchCases]) for (let r = 0; r < 3; r++) fn()
      perf.proveRegression(ctx, label, entry[1], optionsOf(label, entry[2]))
    })
  }

  // Full derivation of every candidate row (a derived field not declared cheap; a `match` that
  // reads such fields, named by `cacheKey`): cold ≤ 1,500 ms; the SAME query repeated (next
  // request, new closure, same cacheKey) ≤ 50 ms.
  const fullCases: [string, (n: number) => unknown][] = [
    [
      'where on a non-cheap derived field',
      (n) =>
        full.query({
          where: { score: { gte: 50 + (n % 50) } },
          page: 1 + Math.floor(n / 50),
          pageSize: 20,
        }),
    ],
    [
      'match without matchFields (cacheKey)',
      (n) => {
        const term = `soalan ${String(10 + n)}`
        return full.query({
          match: (r) => r.text.includes(term),
          cacheKey: `text~${term}`,
          page: 1,
          pageSize: 20,
        })
      },
    ],
  ]
  let n = 0
  for (const [label, fn] of fullCases) {
    it(`${label}: cold ≤ ${String(COLD_FULL_BUDGET_MS)} ms, repeated ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      const { value, floor } = perf.paired(() => {
        const cold: number[] = []
        const warm: number[] = []
        for (let r = 0; r < 3; r++) {
          const q = n++
          let t = performance.now()
          fn(q)
          cold.push(performance.now() - t)
          t = performance.now()
          fn(q)
          warm.push(performance.now() - t)
        }
        return { cold: Math.min(...cold), warm: Math.min(...warm) }
      })
      perf.gates(
        ctx,
        [
          { label: `full derivation, ${label}, repeated`, bestMs: value.warm, budgetMs: BUDGET_MS },
          {
            label: `full derivation, ${label}, cold`,
            bestMs: value.cold,
            budgetMs: COLD_FULL_BUDGET_MS,
          },
        ],
        floor,
        results,
      )
    })
  }

  it('reports timings', () => {
    perf.report(
      `slow path: N=${String(N)} one-time builds: search indexes (both case modes)=${firstSearchMs.toFixed(0)}ms, value columns=${firstValueColumnMs.toFixed(0)}ms`,
      results,
    )
  })
})

// --- 3. high cardinality -------------------------------------------------------------------------

/** High cardinality: ~120,000 cells (e.g. answers by user × week) over 478,499 rows. */
describe('high-cardinality performance (120,000 cells)', () => {
  interface A {
    id: number
    userId: number
    week: number
    isCorrect: boolean
  }
  const USERS = 30_000
  const WEEKS = 4
  let ds: VirtualDataset<A, 'userId' | 'week'>
  let compile = { ms: 0, floor: 0 }
  const results: Record<string, string> = {}

  beforeAll(() => {
    const nCells = USERS * WEEKS
    const base = Math.floor(N / nCells)
    const extra = N - base * nCells
    const cells = Array.from({ length: nCells }, (_, c) => ({
      facets: { userId: 1 + Math.floor(c / WEEKS), week: 1 + (c % WEEKS) },
      count: base + (c < extra ? 1 : 0),
    }))
    ds = defineVirtualDataset<A, 'userId' | 'week', 'isCorrect'>({
      name: 'perf.answers',
      total: N,
      idRange: { min: 1, max: N },
      runtimeIds: floorIds({ start: 9_000_001 }),
      facets: ['userId', 'week'],
      distribution: cells,
      fields: { isCorrect: (key) => hashKey(key, 3) % 1000 < 798 },
      derive: () => ({}),
    })
    const before = perf.floorNow()
    const t = performance.now()
    ds.compile()
    const ms = performance.now() - t
    compile = { ms, floor: Math.min(before, perf.floorNow()) }
  })

  // Fixed parameters: every call costs the same (F09-5a).
  const USERS_50 = Array.from({ length: 50 }, (_, k) => 1 + ((k * 97 + 11) % USERS))
  const cases: [string, () => unknown][] = [
    ['hc count()', () => ds.count()],
    ['hc count(userId)', () => ds.count({ userId: 4_242 })],
    ['hc count(week)', () => ds.count({ week: 2 })],
    ['hc count(userId in 50 users)', () => ds.count({ userId: USERS_50 })],
    ['hc groupCount(week, userId)', () => ds.groupCount('week', { userId: 4_242 })],
    ['hc groupCount(userId) — 30,000 groups', () => ds.groupCount('userId')],
    [
      'hc query(userId) page 1',
      () => ds.query({ where: { userId: 4_242 }, page: 1, pageSize: 20 }),
    ],
    [
      'hc count(userId, isCorrect) — cheap field',
      () => ds.count({ userId: 4_242, isCorrect: true }),
    ],
    // Narrow plans with a cheap condition (F09-7): cost ∝ candidates, not N.
    [
      'hc per-user cheap query page 1 (userId + isCorrect)',
      () => ds.query({ where: { userId: 4_242, isCorrect: true }, page: 1, pageSize: 20 }),
    ],
    [
      'hc id window + cheap query (id 100000–100100, isCorrect)',
      () =>
        ds.query({
          where: { id: { gte: 100_000, lte: 100_100 }, isCorrect: true },
          page: 1,
          pageSize: 20,
        }),
    ],
    ['hc sample(week, 20)', () => ds.sample({ week: 3 }, 20, mulberry32(7))],
  ]
  for (const [label, fn] of cases) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results)
    })
  }

  it(`compile ≤ ${String(COMPILE_BUDGET_MS)} ms (paired)`, (ctx) => {
    perf.gate(
      ctx,
      'hc compile (120,000 cells)',
      compile.ms,
      compile.floor,
      COMPILE_BUDGET_MS,
      results,
    )
  })

  it('reports timings', () => {
    expect(ds.cells()).toHaveLength(USERS * WEEKS)
    expect(ds.count()).toBe(N)
    perf.report(`high cardinality: N=${String(N)} cells=${String(USERS * WEEKS)}`, results)
  })
})

// --- 4. reload -----------------------------------------------------------------------------------

/** A prebuilt search index (`searchFields`, both case modes) stays warm across `loadDiff`. */
describe(`search after reload (${String(N)} rows, searchFields)`, () => {
  const results: Record<string, string> = {}
  let ds: VirtualDataset<Q, QFacet>
  let target: Q
  let loadMs = 0
  let seq = 0

  beforeAll(() => {
    const db = createDb()
    ds = db.register(
      buildCheapQuestions({ total: N, idMax: 564_161, searchText: true, name: 'perf.reload' }),
    )
    db.baseline()
    target = ds.query({ page: 777, pageSize: 1 }).rows[0] as Q
    const t0 = performance.now()
    ds.loadDiff({
      kind: 'dataset',
      overrides: [{ id: target.id, patch: { text: 'Soalan dimuat semula ZQX' } }],
      deletes: [],
      inserts: [],
      ids: null,
    })
    loadMs = performance.now() - t0
  })

  for (const caseSensitive of [false, true]) {
    const label = `first ${caseSensitive ? 'case-sensitive' : 'case-insensitive'} search after reload`
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      const term = caseSensitive ? 'ZQX' : 'zqx'
      const probe = ds.query({
        search: { term, fields: ['text'], caseSensitive },
        page: 1,
        pageSize: 20,
      })
      expect(probe.rows.map((r) => r.id)).toEqual([target.id])
      // Cold calls (a never-cached query on the prebuilt index): best of 5, each with a new term,
      // so one scheduling hiccup does not decide the measurement.
      const { value, floor } = perf.paired(() => {
        let best = Number.POSITIVE_INFINITY
        for (let r = 0; r < 5; r++) {
          const t = performance.now()
          ds.count({}, undefined, {
            search: {
              term: `${caseSensitive ? 'Soalan' : 'soalan'} ${String(20 + seq++)}`,
              fields: ['text'],
              caseSensitive,
            },
          })
          best = Math.min(best, performance.now() - t)
        }
        return best
      }, kindOf(label))
      perf.gate(ctx, label, value, floor, BUDGET_MS, results, '', kindOf(label))
    })
  }

  it('reports timings', () => {
    perf.report(`reload: loadDiff=${loadMs.toFixed(1)}ms`, results)
  })
})

// --- 5. M04-shaped search (F-25 findings) ------------------------------------------------------

/**
 * M04-shaped: 466,041 rows whose texts repeat (per-subject stem lists), prebuilt `searchFields`
 * index in both case modes. Covers the index build at boot / reset (budget 300 ms) and the S1
 * searches (full list, common term "apakah" ≈ 83 % of rows here, newest first) with early exit.
 */
describe('M04-shaped search (466,041 rows, repetitive text)', () => {
  const M = 466_041
  const results: Record<string, string> = {}
  let db: ReturnType<typeof createDb>
  let ds: VirtualDataset<Q, QFacet>
  const builds: { ms: number; floor: number }[] = []
  let uniqueBuild = { ms: 0, floor: 0 }

  beforeAll(() => {
    db = createDb()
    ds = db.register(
      buildCheapQuestions({
        total: M,
        idMax: 564_161,
        searchText: true,
        repetitiveText: true,
        name: 'perf.m04',
      }),
    )
    // Index build at boot (markBaseline) and after 2 resets; compile is timed separately.
    for (let r = 0; r < 3; r++) {
      if (r > 0) db.reset()
      ds.compile()
      const before = perf.floorNow()
      const t = performance.now()
      db.baseline()
      const ms = performance.now() - t
      builds.push({ ms, floor: Math.min(before, perf.floorNow()) })
    }
    // For comparison: an index over one distinct text per row (joined mode).
    const unique = createDb()
    const u = unique.register(
      buildCheapQuestions({ total: M, idMax: 564_161, searchText: true, name: 'perf.m04.unique' }),
    )
    u.compile()
    const before = perf.floorNow()
    const t = performance.now()
    unique.baseline()
    uniqueBuild = { ms: performance.now() - t, floor: Math.min(before, perf.floorNow()) }
  })

  it('search index build at boot/reset (repetitive text, both case modes) ≤ 300 ms (paired)', (ctx) => {
    const best = builds.reduce((a, b) => (b.ms < a.ms ? b : a))
    perf.gate(ctx, 'M04 search index build (repetitive text)', best.ms, best.floor, 300, results)
  })

  it('search index build, one distinct text per row (joined mode) ≤ 1,500 ms (paired)', (ctx) => {
    perf.gate(
      ctx,
      'search index build (unique text)',
      uniqueBuild.ms,
      uniqueBuild.floor,
      1_500,
      results,
    )
  })

  const cases: [string, () => unknown][] = [
    [
      'M04 S1 search "apakah" page 1 (id desc)',
      () =>
        ds.query({
          search: { term: 'apakah', fields: ['text'] },
          sort: { field: 'id', dir: 'desc' },
          page: 1,
          pageSize: 20,
        }),
    ],
    [
      'M04 S1 search "apakah" page 1 (newest first)',
      () =>
        ds.query({
          search: { term: 'apakah', fields: ['text'] },
          sort: { field: 'createdAt', dir: 'desc' },
          page: 1,
          pageSize: 20,
        }),
    ],
    [
      'M04 count(search "apakah")',
      () => ds.count({}, undefined, { search: { term: 'apakah', fields: ['text'] } }),
    ],
    [
      'M04 S1 search, rare term, page 1',
      () =>
        ds.query({
          search: { term: 'topik 123 bagi', fields: ['text'] },
          page: 1,
          pageSize: 20,
        }),
    ],
    [
      'M04 S1 search + subject filter, page 2',
      () =>
        ds.query({
          where: { subjectId: 5, status: 'approved' },
          search: { term: 'mengapakah', fields: ['text'] },
          sort: { field: 'id', dir: 'desc' },
          page: 2,
          pageSize: 20,
        }),
    ],
  ]
  for (const [label, fn] of cases) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results)
    })
  }

  // Regression proof, search group (F09-5c): the dictionary search that M04 uses, 2× slower,
  // fails its ratio gate 3 of 3.
  it('regression proof: a 2× slower search case fails its ratio gate (3 of 3)', (ctx) => {
    const label = 'M04 count(search "apakah")'
    const entry = cases.find(([l]) => l === label)
    if (!entry) throw new Error(`no case '${label}'`)
    // Same JIT context as the gate: every case of this group has run (see the other proofs).
    for (const [, fn] of cases) for (let r = 0; r < 3; r++) fn()
    perf.proveRegression(ctx, label, entry[1])
  })

  it('reports timings', () => {
    perf.report(
      `M04 search: N=${String(M)} index builds (boot, reset, reset)=${builds.map((b) => b.ms.toFixed(0)).join('/')}ms`,
      results,
    )
  })
})

// --- summary -------------------------------------------------------------------------------------

describe('calibration summary', () => {
  it('lists the ratios and any skipped budget gates', () => {
    perf.logSummary()
    expect(Object.keys(perf.summary().ratios).length).toBeGreaterThan(30)
    // F09-4: more than 25 % of the budget gates skipped for load fails the run.
    perf.assertSkipShare()
  })
})
