/**
 * Ratio-cap tuning for paired perf tests (`./perf-calibration`). Pure, no imports: it can run under
 * Vitest or directly with Node (`--experimental-strip-types`) on the ratio lines a perf file logs.
 *
 * The rule (F-09 G4, F09-3): per case, over N ≥ 3 runs of `best / paired floor` —
 * - **honest window** `[1.2 × worst, 1.95 × min)`: if it is not empty, the cap is the point of the
 *   window nearest to 1.5 × median. Every run seen passes with ≥ 20 % margin, and a real 2× of any
 *   run at least as fast as the fastest run seen (min) fails with ≥ 2.5 % margin;
 * - otherwise cap = max(1.5 × median, 1.2 × worst), flagged noisy. Ceilings lower the cap, never
 *   below 1.2 × the worst run;
 * - include runs from every context the gate runs in (the whole perf file, and a case run alone,
 *   e.g. `-t`): a case can be measurably faster alone, and `min` must cover it;
 * - a case is **honest** only when `cap < 2 × min` (the fastest run seen): then a real 2× of any run
 *   at least as fast as that one fails the gate. Otherwise it is **noisy** (in particular whenever
 *   `cap × ref + slack ≥ 2 × median × ref`); only noisy caps get an absolute `slackMs` (default
 *   1 ms) for timer/GC jitter.
 * Caps are rounded up to 2 significant digits.
 */

export interface SuggestedCap {
  cap: number
  median: number
  /** Fastest run seen (the honesty test is `cap < 2 × min`). */
  min: number
  max: number
  runs: number
  /** `true` when the cap cannot guarantee catching a 2× regression. */
  noisy: boolean
  /** Absolute slack of the ratio gate (0 unless noisy). */
  slackMs: number
}

/** Ratios of one run, as logged by `logSummary()` (`{ label: "0.1234" }`) or as numbers. */
export type RatioRun = Readonly<Record<string, string | number>>

export interface SuggestCapsOptions {
  /** Maximum cap per label (decided ceilings, e.g. search ≤ 1.0, JS match ≤ 3). */
  ceilings?: Readonly<Record<string, number>>
  /** Slack given to noisy caps (default 1 ms). */
  noisySlackMs?: number
}

function roundDown2(x: number): number {
  if (x <= 0) return 0
  const e = Math.pow(10, Math.floor(Math.log10(x)) - 1)
  return Number((Math.floor(x / e + 1e-9) * e).toPrecision(2))
}

function roundUp2(x: number): number {
  if (x <= 0) return 0
  const e = Math.pow(10, Math.floor(Math.log10(x)) - 1)
  return Number((Math.ceil(x / e - 1e-9) * e).toPrecision(2))
}

export function suggestCaps(
  runs: readonly RatioRun[],
  options: SuggestCapsOptions = {},
): Record<string, SuggestedCap> {
  const { ceilings = {}, noisySlackMs = 1 } = options
  const labels = [...new Set(runs.flatMap((r) => Object.keys(r)))]
  const out: Record<string, SuggestedCap> = {}
  for (const label of labels) {
    const values = runs
      .map((r) => r[label])
      .filter((v): v is string | number => v !== undefined)
      .map(Number)
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b)
    if (values.length === 0) continue
    const median = values[Math.floor(values.length / 2)] as number
    const max = values[values.length - 1] as number
    const min = values[0] as number
    const lower = roundUp2(1.2 * max)
    const upper = roundDown2(1.95 * min)
    let cap =
      lower <= upper
        ? Math.min(upper, Math.max(lower, roundUp2(1.5 * median)))
        : roundUp2(Math.max(1.5 * median, 1.2 * max))
    const ceiling = ceilings[label]
    if (ceiling !== undefined && cap > ceiling) cap = Math.max(ceiling, lower)
    // Honest only when a real 2× of even the fastest run seen exceeds the cap (no slack).
    const noisy = !(cap < 2 * min)
    out[label] = {
      cap,
      median,
      min,
      max,
      runs: values.length,
      noisy,
      slackMs: noisy ? noisySlackMs : 0,
    }
  }
  return out
}

/** The caps as source lines for a `caps` object literal (with the evidence as comments). */
export function formatCaps(caps: Readonly<Record<string, SuggestedCap>>): string {
  return Object.entries(caps)
    .map(([label, c]) => {
      const value = c.noisy
        ? `{ cap: ${String(c.cap)}, noisy: true, slackMs: ${String(c.slackMs)} }`
        : String(c.cap)
      return `  ${JSON.stringify(label)}: ${value}, // min ${c.min.toFixed(5)}, median ${c.median.toFixed(5)}, max ${c.max.toFixed(5)}, ${String(c.runs)} runs${c.noisy ? ' — noisy: no 2x guarantee' : ''}`
    })
    .join('\n')
}
