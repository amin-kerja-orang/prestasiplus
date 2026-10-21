/**
 * Output of `migrate:verify`: `recon-<runIds>-<yyyymmddHHMMss>.json` and `.md` in a git-ignored `.migration-out` folder
 * (plan 14.6). Both files are aggregates and surrogate ids only; the folder guard and the symbolic-link refusal are the
 * ones of the profile report (`prepareOutputDir`).
 */
import { existsSync, lstatSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { prepareOutputDir } from '../profile'
import type { VerifyReport } from './types'

const DEFAULT_OUT_DIR = join(fileURLToPath(new URL('../../../../../', import.meta.url)), '.migration-out')

/** Table cell: no pipe or line break can break the row. */
const cell = (v: string | number | null | undefined): string => (v === null || v === undefined ? '-' : String(v).replace(/[|\r\n]+/g, ' '))

export function renderVerifyJson(report: VerifyReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

export function renderVerifyMarkdown(report: VerifyReport): string {
  const out: string[] = [
    '# .cloud migration reconciliation (aggregates only)',
    '',
    `Generated: ${report.generatedAt}. Source: ${report.source}. Runs: ${report.runIds.join(', ') || 'none'}. **Status: ${report.status.toUpperCase()}**.`,
    '',
    'No personal value appears in this report. It must stay under `.migration-out/` and is never committed or attached to a PR.',
    '',
    '## Entities',
    '',
    '| Entity | Staging table | Target | Source | Eligible | Loaded | Rejected | Expected delta | Target count | Status |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---|',
    ...report.entities.map(
      (e) =>
        `| ${cell(e.entity)} | ${cell(e.stagingTable)} | ${cell(e.targetTable)} | ${e.sourceCount} | ${e.eligibleCount} | ${e.loaded} | ${e.rejected} | ${e.expectedDelta} | ${cell(e.targetCount)} | ${e.status} |`,
    ),
    '',
  ]
  const notes = report.entities.filter((e) => e.note)
  if (notes.length > 0) {
    out.push('### Notes', '', ...notes.map((e) => `- ${cell(e.entity)}: ${cell(e.note)}`), '')
  }
  out.push(
    '## Checks',
    '',
    '| Check | Kind | Expected | Actual | Status | Detail |',
    '|---|---|---:|---:|---|---|',
    ...report.checks.map((c) => `| ${cell(c.name)} | ${c.kind} | ${cell(c.expected)} | ${cell(c.actual)} | ${c.status} | ${cell(c.detail)} |`),
    '',
  )
  return out.join('\n')
}

/** `20260601T101500Z` style stamp without separators: `yyyymmddHHMMss`. */
export const stampOf = (iso: string): string => iso.replace(/\.\d+Z$/, 'Z').replace(/[-:TZ]/g, '').slice(0, 14)

/**
 * Writes the report (mode 0600) into `outDir` (default `<repo>/.migration-out`), refusing a symbolic link at the target,
 * sets `report.files` and returns the two paths.
 */
export function writeVerifyReport(report: VerifyReport, outDir: string = DEFAULT_OUT_DIR): { json: string; md: string } {
  const dir = prepareOutputDir(outDir)
  const base = `recon-${report.runIds.length > 0 ? report.runIds.join('-') : 'none'}-${stampOf(report.generatedAt)}`
  const files = { json: join(dir, `${base}.json`), md: join(dir, `${base}.md`) }
  report.files = files
  for (const [path, content] of [[files.json, renderVerifyJson(report)], [files.md, renderVerifyMarkdown(report)]] as const) {
    if (existsSync(path)) {
      if (lstatSync(path).isSymbolicLink()) throw new RangeError('A report file is a symbolic link; refusing to write through it.')
      unlinkSync(path)
    }
    writeFileSync(path, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  }
  return files
}
