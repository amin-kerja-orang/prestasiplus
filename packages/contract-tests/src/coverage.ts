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
    percent: total === 0 ? 100 : (covered / total) * 100,
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

/** Threshold from `CONFORMANCE_MIN_COVERAGE` (percent, default 0). Returns an error text or null. */
export function coverageFailure(
  c: CoverageReport,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.CONFORMANCE_MIN_COVERAGE
  const min = raw === undefined || raw === '' ? 0 : Number(raw)
  if (Number.isNaN(min)) return `CONFORMANCE_MIN_COVERAGE is not a number: ${String(raw)}`
  return c.percent + 1e-9 < min
    ? `coverage ${c.percent.toFixed(1)}% is below CONFORMANCE_MIN_COVERAGE=${String(min)}%`
    : null
}
