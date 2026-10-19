/**
 * Paired-calibration harness for module perf tests (F-09 G4: F09-1, F09-3, F09-4). **Test-only**:
 * import it only from `**\/__tests__/**` files (ESLint enforces this). No production code imports
 * it, so it never reaches a build.
 *
 * Perf tests are not part of `npm run test`; run `npm run test:perf` on a quiet machine. It is
 * required at G4 for perf-sensitive tasks and at QA (README).
 *
 * ## Why
 * Other agents often load the dev/CI machine, so fixed millisecond gates alone are unreliable.
 * Each case is paired with a **floor** of the same kind of work:
 * - `js` (default): a plain JS loop over `floorRows` strings with one reused object and `includes`
 *   (≈ 30 ms on a quiet machine at 478,499 rows): for cases that run JS per row or per cell;
 * - `native`: 10 `indexOf` sweeps of a non-matching term over those strings joined (≈ 6 ms quiet):
 *   for cases whose work is native string search (`search` over a joined index).
 *
 * ## Gates (per metric)
 * - **Ratio gate (always enforced):** `best ≤ cap × pairedFloor (+ slackMs, noisy caps only)`.
 *   Load slows the case and its paired floor alike, so this is load-independent and catches
 *   regressions even when the budget gate is skipped. Every label needs a cap (a missing cap
 *   throws, except in `calibrate` mode). A cap is a number (honest: no slack), or
 *   `{ cap, noisy: true, slackMs }` for a case that cannot promise to catch a 2× regression.
 * - **Budget gate:** `best < budget × scale`, `scale = min(scaleCap, max(1, floor / ref))` with the
 *   floor kind's quiet reference. If the paired floor is above `ref × scaleCap`, the pair is
 *   re-measured up to `maxPairs` times; if it is still above, the budget gate is **skipped** via
 *   `ctx.skip("machine too loaded — timing not authoritative (floor X ms)")` and logged. The budget
 *   is never widened beyond `scaleCap`.
 * - **Skip share (F09-4):** `assertSkipShare()` (in the file's last test) fails the run when more
 *   than 25 % of the budget gates were skipped: "machine too loaded — rerun `npm run test:perf` on a
 *   quiet machine".
 *
 * ## Pairing and batching
 * - `timedCase` / `interleaved` (repeatable cases): `warmups` calls; then the case is **batched**
 *   (k calls per sample so a sample takes ≥ `minSampleMs`, 5 ms); then `rounds` rounds of (one
 *   floor pass, one sample). The best per-call time is gated against the best floor pass.
 * - `paired` (single-shot cases: builds, cold queries, first call after a reload): the floor is
 *   taken immediately before and after the measurement (best of 3 each; the lower wins).
 *
 * ## Usage (a module perf test, e.g. `src/modules/m04-question-bank/__tests__/mock/x.perf.test.ts`)
 * ```ts
 * import { beforeAll, describe, it } from 'vitest'
 * import { createPerfCalibration } from '@/mock/dataset/testing/perf-calibration'
 *
 * const perf = createPerfCalibration({
 *   prefix: 'M04 perf',
 *   caps: {
 *     'S1 list page 1': 0.12, // median 0.066, max 0.081, 5 runs
 *     'boot index build': { cap: 7, noisy: true, slackMs: 1 }, // single-shot, GC-bound
 *   },
 * })
 * beforeAll(() => perf.setup()) // builds + warms the floors once per file
 *
 * describe('M04 query budget', () => {
 *   const results: Record<string, string> = {}
 *   it('S1 list page 1 ≤ 50 ms (paired)', (ctx) => {
 *     perf.timedCase(ctx, 'S1 list page 1', () => repo.list({ page: 1 }), 50, results)
 *   })
 *   it('S1 text search ≤ 50 ms (paired, native floor)', (ctx) => {
 *     perf.timedCase(ctx, 'S1 search', () => repo.list({ search: 'apa' }), 50, results, 'native')
 *   })
 *   it('boot index build ≤ 300 ms (paired)', (ctx) => {
 *     const { value, floor } = perf.paired(() => measureOnce())
 *     perf.gate(ctx, 'boot index build', value, floor, 300, results)
 *   })
 *   it('reports timings', () => perf.report('M04 perf', results))
 * })
 * describe('calibration summary', () => {
 *   it('logs ratios and skips; fails when too loaded', () => {
 *     perf.logSummary()
 *     perf.assertSkipShare()
 *   })
 * })
 * ```
 * The file must be named `*.perf.test.ts` (the `perf` Vitest project, run alone, serially).
 *
 * ## Deterministic cases and regression proofs (F09-5, F09-6)
 * - Give every case a **deterministic cost per call**: fixed parameters. If a case must vary its
 *   parameters (e.g. to stay out of a result cache), cycle a fixed set of `n` values with
 *   `i++ % n` and pass `{ cycle: n }` as the case options: every timed sample then contains each
 *   value once.
 * - Prove the gates honest, at least one case per group:
 *   `it('proof: …', (ctx) => perf.proveRegression(ctx, label, fn, options))` runs the case really
 *   2× slower (`slowdown(fn, 2)`) 3 times and requires the ratio gate to fail every time. A skipped
 *   proof (e.g. while calibrating) is counted, and `assertSkipShare()` then fails the run.
 *
 * ## Setting caps from measured runs
 * 1. Start with `calibrate: true` (missing caps log instead of throwing).
 * 2. Run the file at least 3 times, ideally 5, and keep the ratio line of each run:
 *    `npx vitest run --project perf <file> --silent=false | grep "<prefix>, ratios]" | sed 's/.*ratios\] //' > <scratch>/ratios-N.json`
 * 3. Compute the caps with `suggestCaps` (`./perf-caps`), passing each case's floor reference so a
 *    noisy slack is judged in ms, e.g.:
 *    `node --experimental-strip-types -e "import('./src/mock/dataset/testing/perf-caps.ts').then((m) => { const fs = require('node:fs'); const runs = process.argv.slice(1).map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))); console.log(m.formatCaps(m.suggestCaps(runs))) })" <scratch>/ratios-1.json …`
 * 4. Paste the printed lines into `caps`, remove `calibrate`, and review every case marked noisy
 *    (honest means `cap < 2 × min`, the fastest run seen; only a noisy cap gets a slack).
 */

import { expect, type TestContext } from 'vitest'

/** A ratio cap: honest (a number, no slack) or noisy (with an absolute slack). */
export type PerfCap = number | { cap: number; noisy: true; slackMs: number }

/** The work a case's floor reproduces (see the header). */
export type FloorKind = 'js' | 'native'

/**
 * How a repeatable case is measured: its floor kind, and `cycle` when the case deliberately cycles
 * through a fixed set of `cycle` parameters (e.g. to stay out of a cache): the batch is rounded up to
 * whole cycles so every timed sample has the identical mix. A bare `FloorKind` is accepted too.
 */
export type CaseOptions = FloorKind | { kind?: FloorKind; cycle?: number }

function caseOptions(o: CaseOptions | undefined): { kind: FloorKind; cycle: number } {
  if (o === undefined) return { kind: 'js', cycle: 1 }
  if (typeof o === 'string') return { kind: o, cycle: 1 }
  const cycle = o.cycle ?? 1
  if (!Number.isSafeInteger(cycle) || cycle < 1) throw new Error(`cycle must be a positive integer`)
  return { kind: o.kind ?? 'js', cycle }
}

export interface PerfCalibrationOptions {
  /** Log prefix, e.g. `'M04 perf'` (lines read `[M04 perf, …]`). */
  prefix: string
  /** Ratio cap per label (see "Setting caps"). */
  caps: Readonly<Record<string, PerfCap>>
  /** Calibration mode: missing caps log a warning instead of throwing. */
  calibrate?: boolean
  /** Floor strings (default 478,499). */
  floorRows?: number
  /** Quiet-machine floors in ms (defaults: js 30, native 6). */
  floorRefMs?: Partial<Record<FloorKind, number>>
  /** Maximum budget scale (default 1.5). */
  scaleCap?: number
  /** Re-measurements while the floor is above the cap (default 3). */
  maxPairs?: number
  /** Interleaved rounds per case (default 7). */
  rounds?: number
  /** Warm-up calls per case (default 3). */
  warmups?: number
  /** Minimum duration of one timed sample; fast cases are batched to reach it (default 5 ms). */
  minSampleMs?: number
  /** Share of skipped budget gates above which `assertSkipShare` fails (default 0.25). */
  maxSkipShare?: number
}

export interface Timing {
  /** Best per-call time (ms). */
  best: number
  median: number
  /** Calls per timed sample. */
  batch: number
}

export interface Metric {
  label: string
  bestMs: number
  budgetMs: number
  extra?: string
}

export interface Paired<T> {
  value: T
  /** The paired floor (ms). */
  floor: number
  /** Measurements taken (> 1 when the floor was above the cap). */
  pairs: number
}

export interface PerfCalibration {
  /** Builds the floor strings and warms the floors up. Call once, in a file-level `beforeAll`. */
  setup(): void
  /** One floor pass (ms). */
  floorRun(kind?: FloorKind): number
  /** Best of 3 floor passes (ms). */
  floorNow(kind?: FloorKind): number
  /** The budget scale for a floor. */
  scaleOf(floorMs: number, kind?: FloorKind): number
  /** Batched, interleaved pairing for a repeatable case. */
  interleaved(fn: () => unknown, options?: CaseOptions): Paired<Timing>
  /** Before/after pairing for a single-shot measurement. */
  paired<T>(measure: () => T, kind?: FloorKind): Paired<T>
  /** The ratio gate alone (throws when exceeded). Used by regression-injection tests. */
  ratioGate(label: string, bestMs: number, floorMs: number): void
  /** Ratio gates (always), then budget gates (or an explicit skip when loaded). */
  gates(
    ctx: TestContext,
    metrics: readonly Metric[],
    floorMs: number,
    results: Record<string, string>,
    kind?: FloorKind,
  ): void
  /** One-metric form of `gates`. */
  gate(
    ctx: TestContext,
    label: string,
    bestMs: number,
    floorMs: number,
    budgetMs: number,
    results: Record<string, string>,
    extra?: string,
    kind?: FloorKind,
  ): void
  /** `interleaved` + `gate`: the usual repeatable case. */
  timedCase(
    ctx: TestContext,
    label: string,
    fn: () => unknown,
    budgetMs: number,
    results: Record<string, string>,
    options?: CaseOptions,
  ): void
  /**
   * Regression proof (F09-5): the case made `factor`× slower (`slowdown`, a real 2× for this run)
   * must fail its ratio gate in each of `repetitions` measurements. Without a cap (calibrating) the
   * proof is skipped and counted, and `assertSkipShare` then fails the run.
   */
  proveRegression(
    ctx: TestContext,
    label: string,
    fn: () => unknown,
    options?: CaseOptions,
    proof?: { factor?: number; repetitions?: number },
  ): void
  /** Skips a regression proof visibly and counts it (`assertSkipShare` requires none). */
  skipProof(ctx: TestContext, label: string, reason: string): never
  /** Logs a group's results. */
  report(title: string, results: Readonly<Record<string, string>>): void
  /** Ratios (`label → "0.1234"`), floor kinds, budget gates checked and skipped so far. */
  summary(): {
    ratios: Readonly<Record<string, string>>
    kinds: Readonly<Record<string, FloorKind>>
    budgetGates: number
    skipped: readonly string[]
    proofs: number
    proofsSkipped: readonly string[]
  }
  /** Logs `[prefix, ratios] {json}` (the input of `suggestCaps`) and `[prefix, skipped] …`. */
  logSummary(): void
  /**
   * Fails when more than `maxSkipShare` of the budget gates were skipped for load (F09-4), or when
   * any regression proof was skipped (F09-6).
   */
  assertSkipShare(): void
}

/**
 * Wraps `fn` so every call does `extraMs` more work (busy wait). A 2× regression of an operation
 * whose typical cost is `median × floor` is `delayBy(fn, median × floorNow)`: the injected cost is
 * one typical call, independent of how fast this particular run happens to be.
 */
export function delayBy(fn: () => unknown, extraMs: number): () => unknown {
  return () => {
    const result = fn()
    const end = performance.now() + extraMs
    while (performance.now() < end) {
      // busy wait
    }
    return result
  }
}

/** Wraps `fn` so every call takes `factor` × as long as it did (busy wait). */
export function slowdown(fn: () => unknown, factor = 2): () => unknown {
  return () => {
    const t = performance.now()
    const result = fn()
    const extra = (performance.now() - t) * (factor - 1)
    const end = performance.now() + extra
    while (performance.now() < end) {
      // busy wait
    }
    return result
  }
}

const FLOOR_STEMS = ['Apakah', 'Manakah', 'Mengapakah', 'Bagaimanakah', 'Berapakah', 'Siapakah']

/** Small stable hash for the floor strings (murmur3 finaliser). */
function mix(k: number): number {
  let h = Math.imul(k ^ 0x9e3779b9, 0xcc9e2d51)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return (h ^ (h >>> 16)) >>> 0
}

export function createPerfCalibration(options: PerfCalibrationOptions): PerfCalibration {
  const {
    prefix,
    caps,
    calibrate = false,
    floorRows = 478_499,
    scaleCap = 1.5,
    maxPairs = 3,
    rounds = 7,
    warmups = 3,
    minSampleMs = 5,
    maxSkipShare = 0.25,
  } = options
  const refMs: Record<FloorKind, number> = { js: 30, native: 6, ...options.floorRefMs }
  const capMs = (kind: FloorKind) => refMs[kind] * scaleCap
  let floorStrings: string[] = []
  let joined = ''
  let floorSeq = 0
  const skipped: string[] = []
  const ratios: Record<string, string> = {}
  const kinds: Record<string, FloorKind> = {}
  let budgetGates = 0
  let proofs = 0
  const proofsSkipped: string[] = []

  function capOf(label: string): { cap: number; slackMs: number; noisy: boolean } | undefined {
    const cap = caps[label]
    if (cap === undefined) {
      if (!calibrate) {
        throw new Error(
          `[${prefix}] no ratio cap for perf case '${label}' (see perf-calibration.ts)`,
        )
      }
      return undefined
    }
    return typeof cap === 'number'
      ? { cap, slackMs: 0, noisy: false }
      : { cap: cap.cap, slackMs: cap.slackMs, noisy: true }
  }

  function jsFloorRun(): number {
    const term = `soalan ${String(10 + (floorSeq++ % 80))}`
    const match = (row: { text: string }) => row.text.includes(term)
    const one = { text: '' }
    const strings = floorStrings
    const t = performance.now()
    let hits = 0
    for (let p = 0; p < strings.length; p++) {
      one.text = strings[p] as string
      if (match(one)) hits++
    }
    const ms = performance.now() - t
    if (hits < 0) throw new Error('unreachable')
    return ms
  }

  function nativeFloorRun(): number {
    const text = joined
    const t = performance.now()
    let hits = 0
    for (let sweep = 0; sweep < 10; sweep++) {
      const term = `tiada padanan ${String(floorSeq++)}`
      let from = 0
      for (;;) {
        const o = text.indexOf(term, from)
        if (o < 0) break
        hits++
        from = o + 1
      }
    }
    const ms = performance.now() - t
    if (hits < 0) throw new Error('unreachable')
    return ms
  }

  const perf: PerfCalibration = {
    setup() {
      const strings: string[] = []
      for (let k = 1; k <= floorRows; k++) {
        strings.push(
          `${FLOOR_STEMS[mix(k) % FLOOR_STEMS.length] as string} soalan ${String(k)} (subjek ${String(1 + (k % 27))})?`,
        )
      }
      floorStrings = strings
      joined = strings.join('\u0000')
      for (let i = 0; i < 5; i++) {
        perf.floorRun('js')
        perf.floorRun('native')
      }
      console.info(
        `[${prefix}, calibration] warm floors: js=${perf.floorNow('js').toFixed(1)}ms (ref ${String(refMs.js)}), ` +
          `native=${perf.floorNow('native').toFixed(1)}ms (ref ${String(refMs.native)}); scale cap ${String(scaleCap)}, ` +
          `min sample ${String(minSampleMs)}ms, max skip share ${String(maxSkipShare * 100)}%`,
      )
    },

    floorRun(kind = 'js') {
      if (floorStrings.length === 0)
        throw new Error(`[${prefix}] call perf.setup() in beforeAll first`)
      return kind === 'native' ? nativeFloorRun() : jsFloorRun()
    },

    floorNow(kind = 'js') {
      return Math.min(perf.floorRun(kind), perf.floorRun(kind), perf.floorRun(kind))
    },

    scaleOf(floorMs, kind = 'js') {
      return Math.min(scaleCap, Math.max(1, floorMs / refMs[kind]))
    },

    interleaved(fn, options) {
      const { kind, cycle } = caseOptions(options)
      for (let i = 0; i < Math.max(warmups, cycle); i++) fn()
      // Batch fast operations so one sample takes ≥ minSampleMs (timer and JIT noise), in whole
      // cycles so every sample has the identical mix of parameters.
      const t0 = performance.now()
      for (let i = 0; i < cycle; i++) fn()
      const one = Math.max((performance.now() - t0) / cycle, 0.001)
      const raw = Math.min(10_000, Math.max(1, Math.ceil(minSampleMs / one)))
      const batch = Math.ceil(raw / cycle) * cycle
      let value: Timing
      let floorMs: number
      let pairs = 0
      do {
        pairs++
        const times: number[] = []
        const floors: number[] = []
        for (let r = 0; r < rounds; r++) {
          floors.push(perf.floorRun(kind))
          const t = performance.now()
          for (let b = 0; b < batch; b++) fn()
          times.push((performance.now() - t) / batch)
        }
        // Pair the best sample with the floor pass taken immediately before it (the same moment),
        // not with the best floor of another round: under fluctuating load those can differ.
        let bestRound = 0
        for (let r = 1; r < rounds; r++) {
          if ((times[r] as number) < (times[bestRound] as number)) bestRound = r
        }
        const sorted = [...times].sort((a, b) => a - b)
        value = {
          best: times[bestRound] as number,
          median: sorted[Math.floor(rounds / 2)] as number,
          batch,
        }
        floorMs = floors[bestRound] as number
      } while (floorMs > capMs(kind) && pairs < maxPairs)
      return { value, floor: floorMs, pairs }
    },

    paired<T>(measure: () => T, kind: FloorKind = 'js'): Paired<T> {
      let value: T
      let floorMs: number
      let pairs = 0
      do {
        pairs++
        const before = perf.floorNow(kind)
        value = measure()
        const after = perf.floorNow(kind)
        floorMs = Math.min(before, after)
      } while (floorMs > capMs(kind) && pairs < maxPairs)
      return { value, floor: floorMs, pairs }
    },

    ratioGate(label, bestMs, floorMs) {
      const c = capOf(label)
      if (!c) {
        console.warn(`[${prefix}, calibrate] no cap for '${label}': ratio gate not enforced`)
        return
      }
      const ratio = bestMs / floorMs
      expect(
        bestMs,
        `${label}: ratio ${ratio.toFixed(3)} to the paired floor exceeds its cap ${c.cap.toFixed(3)}` +
          (c.noisy ? ` (+ ${String(c.slackMs)} ms noisy slack)` : ''),
      ).toBeLessThanOrEqual(c.cap * floorMs + c.slackMs)
    },

    gates(ctx, metrics, floorMs, results, kind = 'js') {
      const scale = perf.scaleOf(floorMs, kind)
      const loaded = floorMs > capMs(kind)
      for (const m of metrics) {
        const c = capOf(m.label)
        const ratio = m.bestMs / floorMs
        results[m.label] =
          `best ${m.bestMs.toFixed(3)} ms${m.extra ?? ''} | ${kind} floor ${floorMs.toFixed(1)} ms, ` +
          `scale ${scale.toFixed(2)}, ratio ${ratio.toFixed(4)} (cap ${c === undefined ? 'none: calibrating' : `${c.cap.toFixed(4)}${c.noisy ? `, noisy +${String(c.slackMs)}ms` : ''}`})` +
          (loaded ? ' | budget gate SKIPPED: loaded' : '')
        ratios[m.label] = ratio.toPrecision(4)
        kinds[m.label] = kind
      }
      // Load-independent: always enforced, also when the budget gate is skipped below.
      for (const m of metrics) perf.ratioGate(m.label, m.bestMs, floorMs)
      budgetGates += metrics.length
      if (loaded) {
        const msg = `machine too loaded — timing not authoritative (floor ${floorMs.toFixed(1)} ms)`
        for (const m of metrics) {
          skipped.push(`${m.label}: ${msg}`)
          console.warn(`[${prefix}, SKIP] ${m.label}: ${msg}`)
        }
        ctx.skip(msg)
      }
      for (const m of metrics) {
        expect(
          m.bestMs,
          `${m.label}: budget ${String(m.budgetMs)} ms × scale ${scale.toFixed(2)}`,
        ).toBeLessThan(m.budgetMs * scale)
      }
    },

    gate(ctx, label, bestMs, floorMs, budgetMs, results, extra = '', kind = 'js') {
      perf.gates(ctx, [{ label, bestMs, budgetMs, extra }], floorMs, results, kind)
    },

    timedCase(ctx, label, fn, budgetMs, results, options) {
      const { kind } = caseOptions(options)
      const { value, floor, pairs } = perf.interleaved(fn, options)
      perf.gate(
        ctx,
        label,
        value.best,
        floor,
        budgetMs,
        results,
        `, median ${value.median.toFixed(3)} ms, batch ${String(value.batch)}, pairs ${String(pairs)}`,
        kind,
      )
    },

    proveRegression(ctx, label, fn, options, proof = {}) {
      const factor = proof.factor ?? 2
      const repetitions = proof.repetitions ?? 3
      // The unmodified case in this same context: logged (it is calibration data for this context,
      // e.g. the case run alone with -t), then the proof.
      const plain = perf.interleaved(fn, options)
      const plainRatio = (plain.value.best / plain.floor).toFixed(4)
      console.info(`[${prefix}, proof plain] ${JSON.stringify({ [label]: plainRatio })}`)
      if (calibrate || caps[label] === undefined) {
        perf.skipProof(ctx, label, 'no ratio cap yet (calibrating)')
      }
      const ratios: string[] = []
      for (let r = 0; r < repetitions; r++) {
        const slow = perf.interleaved(slowdown(fn, factor), options)
        ratios.push((slow.value.best / slow.floor).toFixed(4))
        console.info(
          `[${prefix}, proof] ${label}: plain ratio ${plainRatio}, ${String(factor)}× repetition ${String(r + 1)} ratio ${ratios[r] as string}`,
        )
        expect(
          () => {
            perf.ratioGate(label, slow.value.best, slow.floor)
          },
          `${label}: a ${String(factor)}× slower run (repetition ${String(r + 1)}/${String(repetitions)}, ratio ${ratios[r] as string}) passed its ratio gate`,
        ).toThrow(/exceeds its cap/)
      }
      proofs++
      console.info(
        `[${prefix}, proof] ${label}: ${String(factor)}× ratios [${ratios.join(', ')}] all fail the gate`,
      )
    },

    skipProof(ctx, label, reason) {
      proofsSkipped.push(`${label}: ${reason}`)
      console.warn(`[${prefix}, PROOF SKIPPED] ${label}: ${reason}`)
      return ctx.skip(`regression proof skipped: ${reason}`)
    },

    report(title, results) {
      console.info(
        `[${prefix}] ${title}\n` +
          Object.entries(results)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n'),
      )
    },

    summary() {
      return { ratios, kinds, budgetGates, skipped, proofs, proofsSkipped }
    },

    logSummary() {
      console.info(
        `[${prefix}, ratios] ${JSON.stringify(ratios)}\n` +
          `[${prefix}, kinds] ${JSON.stringify(kinds)}\n` +
          `[${prefix}, skipped] ${String(skipped.length)}/${String(budgetGates)} budget gates` +
          (skipped.length === 0 ? '' : `: ${skipped.join(' | ')}`) +
          `\n[${prefix}, proofs] ${String(proofs)} passed, ${String(proofsSkipped.length)} skipped` +
          (proofsSkipped.length === 0 ? '' : `: ${proofsSkipped.join(' | ')}`),
      )
    },

    assertSkipShare() {
      if (proofsSkipped.length > 0) {
        throw new Error(
          `${String(proofsSkipped.length)} regression proof(s) skipped (${proofsSkipped.join(' | ')}): the ratio gates are unproven; rerun \`npm run test:perf\` with caps set`,
        )
      }
      const share = budgetGates === 0 ? 0 : skipped.length / budgetGates
      if (share > maxSkipShare) {
        throw new Error(
          `machine too loaded — ${String(skipped.length)}/${String(budgetGates)} budget gates skipped ` +
            `(${(share * 100).toFixed(0)} % > ${String(maxSkipShare * 100)} %); rerun \`npm run test:perf\` on a quiet machine`,
        )
      }
    },
  }
  return perf
}
