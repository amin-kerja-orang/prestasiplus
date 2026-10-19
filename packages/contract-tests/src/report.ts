import type { RunReport } from './runner'

/** Plain-text summary: failures first, then the known mismatches (reported apart), then stale entries. */
export function formatRun(run: RunReport): string {
  const failing = run.results.filter((r) => r.failures.length)
  const known = run.results.filter((r) => r.known.length)
  const applicable = run.results.filter((r) => !r.notForTarget)
  const pending = applicable.filter((r) => r.notImplemented.length)
  const clean = applicable.filter((r) => r.violations.length === 0 && r.notImplemented.length === 0).length
  const lines = [
    `Conformance run against ${run.target}: ${String(run.results.length)} scenarios, ${String(clean)} clean, ` +
      `${String(failing.length)} failing, ${String(known.length)} with known mismatches, ` +
      `${String(pending.length)} not yet implemented, ${String(run.results.length - applicable.length)} not for this target`,
  ]
  for (const r of failing) {
    for (const v of r.failures) lines.push(`  FAIL  ${r.id}  [${v.kind}] ${v.message}`)
  }
  for (const r of known) {
    for (const v of r.known) lines.push(`  known ${r.id}  [${v.kind}] ${v.message}`)
  }
  for (const s of run.stale) {
    lines.push(`  STALE known mismatch (no longer occurs): ${s.scenario} (${s.reason})`)
  }
  return lines.join('\n')
}
