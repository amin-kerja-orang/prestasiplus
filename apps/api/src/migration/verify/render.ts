/**
 * Output of `migrate:verify` in a git-ignored `.migration-out` folder (plan 14.6; the folder guard is the profile report's,
 * `prepareOutputDir`):
 *  - `recon-<runIds>-<yyyymmddHHMMss>.json` and `.md`: AGGREGATES ONLY (counts, statuses, check names). No id of any row.
 *  - `deleted-at-source-<stamp>-<rand>.json` (only when rows were deleted at the source): the surrogate legacy ids of those
 *    rows (capped at 200 per entity). They are ids of real people (users, parent:child pairs of minors), so this file is real
 *    data, not an aggregate: mode 0600, never committed or attached, and kept under the real-data custody rule of the
 *    runbook (7 days). It is separate precisely so the recon files stay aggregate-only.
 * No file is ever replaced.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, lstatSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { prepareOutputDir } from '../profile'
import type { VerifyReport } from './types'

const DEFAULT_OUT_DIR = join(fileURLToPath(new URL('../../../../../', import.meta.url)), '.migration-out')

/** Table cell: no pipe or line break can break the row. */
const cell = (v: string | number | null | undefined): string => (v === null || v === undefined ? '-' : String(v).replace(/[|\r\n]+/g, ' '))

export function renderVerifyJson(report: VerifyReport): string {
  // The ids of the rows deleted at the source never go into the recon json (see the header).
  const { deletedAtSourceIds: _ids, ...aggregate } = report
  void _ids
  return `${JSON.stringify(aggregate, null, 2)}\n`
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
    '| Entity | Staging table | Target | Source | Eligible | Loaded | Rejected | Expected delta | Target count | Deleted at source | Status |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...report.entities.map(
      (e) =>
        `| ${cell(e.entity)} | ${cell(e.stagingTable)} | ${cell(e.targetTable)} | ${e.sourceCount} | ${e.eligibleCount} | ${e.loaded} | ${e.rejected} | ${e.expectedDelta} | ${cell(e.targetCount)} | ${cell(e.deletedAtSource)} | ${e.status} |`,
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
 * Writes the report (mode 0600) into `outDir` (default `<repo>/.migration-out`), refusing to replace an existing file or
 * a link at the target, sets `report.files` and returns the two paths.
 */
export function writeVerifyReport(report: VerifyReport, outDir: string = DEFAULT_OUT_DIR): { json: string; md: string; deletedIds?: string } {
  const dir = prepareOutputDir(outDir)
  const stamp = stampOf(report.generatedAt)
  const base = `recon-${report.runIds.length > 0 ? report.runIds.join('-') : 'none'}-${stamp}`
  const files: { json: string; md: string; deletedIds?: string } = { json: join(dir, `${base}.json`), md: join(dir, `${base}.md`) }
  const ids = report.deletedAtSourceIds
  if (ids !== undefined && Object.keys(ids).length > 0) {
    files.deletedIds = join(dir, `deleted-at-source-${stamp}-${randomBytes(4).toString('hex')}.json`)
  }
  // Never replace a file: an existing one (or a link planted at the name) is an error, not something to overwrite.
  for (const path of [files.json, files.md]) {
    if (existsSync(path) || isLink(path)) throw new RangeError('A report file with this name already exists; refusing to replace it.')
  }
  report.files = files
  const writes: [string, string][] = [[files.json, renderVerifyJson(report)], [files.md, renderVerifyMarkdown(report)]]
  if (files.deletedIds !== undefined) {
    writes.push([files.deletedIds, `${JSON.stringify({ generatedAt: report.generatedAt, source: report.source, runIds: report.runIds, deletedAtSourceIds: ids }, null, 2)}\n`])
  }
  for (const [path, content] of writes) writeFileSync(path, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  return files
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}
