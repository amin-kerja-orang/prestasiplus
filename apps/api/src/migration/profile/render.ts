import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

import type { ProfileReport } from './collect'

export function renderJson(report: ProfileReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

const pct = (v: number | null): string => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`)

/** Markdown view of the report. Only counts, ratios and enum-like codes appear. */
export function renderMarkdown(report: ProfileReport): string {
  const out: string[] = [
    '# .cloud staging profile (aggregates only)',
    '',
    `Generated: ${report.generatedAt}. Source: ${report.source}. Tables profiled: ${report.tablesProfiled}. Total rows: ${report.totalRows}.`,
    '',
    'No personal value appears in this report. It must stay under `.migration-out/` and is never committed or attached to a PR.',
    '',
    '## Row counts',
    '',
    '| Schema | Table | Rows |',
    '|---|---|---:|',
    ...report.tables.map((t) => `| ${t.schema} | ${t.table} | ${t.rowCount} |`),
    '',
  ]
  if (report.tablesMissing.length > 0) out.push(`Tables not found in the staging database: ${report.tablesMissing.join(', ')}.`, '')

  const dup = report.tables.filter((t) => t.duplicates.length > 0)
  if (dup.length > 0) {
    out.push('## Duplicates', '', '| Check | Duplicate groups | Rows in those groups |', '|---|---:|---:|')
    for (const t of dup) for (const d of t.duplicates) out.push(`| ${d.check} | ${d.duplicateGroups} | ${d.rowsInDuplicateGroups} |`)
    out.push('')
  }
  const hashes = report.tables.filter((t) => t.hashPrefixes.length > 0)
  if (hashes.length > 0) {
    out.push('## Password hash prefixes', '', '| Table.column | Prefix | Rows |', '|---|---|---:|')
    for (const t of hashes) for (const h of t.hashPrefixes) for (const p of h.prefixes) out.push(`| ${t.table}.${h.column} | \`${p.prefix}\` | ${p.count} |`)
    out.push('')
  }
  const orphans = report.tables.flatMap((t) => t.orphans.map((o) => ({ t, o })))
  if (orphans.length > 0) {
    out.push('## Orphans per declared foreign key', '', '| Table.column | Parent | Orphans |', '|---|---|---:|')
    for (const { t, o } of orphans) out.push(`| ${t.table}.${o.column} | ${o.parent} | ${o.orphans} |`)
    out.push('')
  }
  out.push('## Enum-like columns (distinct values, cap 50)', '')
  for (const t of report.tables) {
    for (const e of t.enums) {
      const values = e.values.map((v) => `${v.value === null ? '(null)' : `\`${v.value}\``} ${v.count}`).join(', ')
      out.push(`- ${t.table}.${e.column}: ${e.distinct} distinct${e.truncated ? ' (first 50 shown)' : ''}${values ? `: ${values}` : ''}`)
    }
  }
  out.push('', '## Null ratios', '')
  for (const t of report.tables) {
    if (t.rowCount === 0) continue
    const cols = Object.entries(t.nullRatios)
      .filter(([, r]) => r !== null && r > 0)
      .map(([c, r]) => `${c} ${pct(r)}`)
    out.push(`- ${t.table} (${t.rowCount} rows): ${cols.length > 0 ? cols.join(', ') : 'no nulls'}`)
  }
  out.push('')
  return out.join('\n')
}

export class ProfileOutputError extends Error {}

/**
 * Writes `profile-<date>.md` and `.json`. The directory must sit under a `.migration-out` folder
 * (git-ignored by BE-34), so a report can never land in a tracked path by mistake.
 */
export function writeProfile(report: ProfileReport, outDir: string): { md: string; json: string } {
  const dir = resolve(outDir)
  if (!dir.split(sep).includes('.migration-out')) {
    throw new ProfileOutputError('The output directory must be inside a ".migration-out" folder (it is git-ignored).')
  }
  mkdirSync(dir, { recursive: true })
  const date = report.generatedAt.slice(0, 10)
  const md = join(dir, `profile-${date}.md`)
  const json = join(dir, `profile-${date}.json`)
  writeFileSync(md, renderMarkdown(report), 'utf8')
  writeFileSync(json, renderJson(report), 'utf8')
  return { md, json }
}
