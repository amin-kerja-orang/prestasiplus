import type { ContractIndex } from './contract-index'
import type { Target } from './http-client'
import type { RunReport } from './runner'

export interface CoverageReport {
  /** Operations the target serves (all of them when the target does not say). */
  total: number
  covered: number
  percent: number
  /** Per tag: covered / total. */
  byTag: Record<string, { covered: number; total: number }>
  uncovered: string[]
  /** Operations the target does not serve yet (later cards). Listed, never counted as uncovered or failed. */
  notImplemented: string[]
}

/** Every operation in `openapi.json` and whether a scenario sent a request to it (AC2). */
export function computeCoverage(
  contract: ContractIndex,
  run: RunReport,
  target?: Pick<Target, 'implements'>,
): CoverageReport {
  const byTag: CoverageReport['byTag'] = {}
  const uncovered: string[] = []
  const notImplemented: string[] = []
  let covered = 0
  let total = 0
  for (const op of contract.operations) {
    if (target?.implements && !target.implements(op)) {
      notImplemented.push(op.key)
      continue
    }
    total++
    const t = (byTag[op.tag] ??= { covered: 0, total: 0 })
    t.total++
    if (run.touched.has(op.key)) {
      t.covered++
      covered++
    } else uncovered.push(op.key)
  }
  return {
    total,
    covered,
    // No operation at all is never "100%": it means the target's route lookup found nothing.
    percent: total === 0 ? 0 : (covered / total) * 100,
    byTag,
    uncovered,
    notImplemented,
  }
}

export function formatCoverage(c: CoverageReport, { list = false } = {}): string {
  const lines = [
    `Conformance coverage: ${String(c.covered)}/${String(c.total)} operations (${c.percent.toFixed(1)}%)` +
      (c.notImplemented.length ? `; ${String(c.notImplemented.length)} more not yet implemented by the target` : ''),
  ]
  for (const [tag, v] of Object.entries(c.byTag).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${tag.padEnd(28)} ${String(v.covered).padStart(3)}/${String(v.total)}`)
  }
  if (list) {
    lines.push('Uncovered:', ...c.uncovered.map((k) => `  ${k}`))
    lines.push('Not yet implemented:', ...c.notImplemented.map((k) => `  ${k}`))
  }
  return lines.join('\n')
}

/**
 * Gate on the operations the target does not serve yet (the percentage ignores them).
 * `CONFORMANCE_MAX_NOT_IMPLEMENTED=<n>` fails when more than n operations are unserved (default:
 * unlimited); `CONFORMANCE_REQUIRE_ALL=1` is the same as 0. Returns an error text or null.
 */
export function notImplementedFailure(
  c: CoverageReport,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const all = env.CONFORMANCE_REQUIRE_ALL
  const raw = all === '1' || all === 'true' ? '0' : env.CONFORMANCE_MAX_NOT_IMPLEMENTED
  if (raw === undefined || raw === '') return null
  const max = Number(raw)
  if (Number.isNaN(max) || max < 0) return `CONFORMANCE_MAX_NOT_IMPLEMENTED is not a count: ${raw}`
  return c.notImplemented.length > max
    ? `${String(c.notImplemented.length)} operations are not yet implemented, above CONFORMANCE_MAX_NOT_IMPLEMENTED=${String(max)}`
    : null
}

/** Threshold from `CONFORMANCE_MIN_COVERAGE` (percent, default 0). Returns an error text or null. */
export function coverageFailure(
  c: CoverageReport,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (c.total === 0) return 'the target serves no contract operation (empty route lookup?)'
  const raw = env.CONFORMANCE_MIN_COVERAGE
  const min = raw === undefined || raw === '' ? 0 : Number(raw)
  if (Number.isNaN(min)) return `CONFORMANCE_MIN_COVERAGE is not a number: ${String(raw)}`
  return c.percent + 1e-9 < min
    ? `coverage ${c.percent.toFixed(1)}% is below CONFORMANCE_MIN_COVERAGE=${String(min)}%`
    : null
}
