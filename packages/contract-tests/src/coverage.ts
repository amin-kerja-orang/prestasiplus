import type { ContractIndex } from './contract-index'
import type { RunReport } from './runner'

export interface CoverageReport {
  total: number
  covered: number
  percent: number
  /** Per tag: covered / total. */
  byTag: Record<string, { covered: number; total: number }>
  uncovered: string[]
}

/** Every operation in `openapi.json` and whether a scenario sent a request to it (AC2). */
export function computeCoverage(contract: ContractIndex, run: RunReport): CoverageReport {
  const byTag: CoverageReport['byTag'] = {}
  const uncovered: string[] = []
  let covered = 0
  for (const op of contract.operations) {
    const t = (byTag[op.tag] ??= { covered: 0, total: 0 })
    t.total++
    if (run.touched.has(op.key)) {
      t.covered++
      covered++
    } else uncovered.push(op.key)
  }
  const total = contract.operations.length
  return { total, covered, percent: total === 0 ? 100 : (covered / total) * 100, byTag, uncovered }
}

export function formatCoverage(c: CoverageReport, { list = false } = {}): string {
  const lines = [
    `Conformance coverage: ${String(c.covered)}/${String(c.total)} operations (${c.percent.toFixed(1)}%)`,
  ]
  for (const [tag, v] of Object.entries(c.byTag).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${tag.padEnd(28)} ${String(v.covered).padStart(3)}/${String(v.total)}`)
  }
  if (list) lines.push('Uncovered:', ...c.uncovered.map((k) => `  ${k}`))
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
