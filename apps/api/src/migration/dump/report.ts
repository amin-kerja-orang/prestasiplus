/**
 * `schema-report.json` / `schema-report.md` (AM-10): what the .cloud MySQL schema looks like compared with
 * ddl/spec.ts. Names, types, counts and privilege names only: no row value, no user, host, database name or grant text.
 */
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { GrantVerdict } from './grants'
import type { SchemaInfo, TablePlan } from './export-sql'

const PLAIN = /^[A-Za-z0-9_]{1,64}$/

export interface TableReport {
  table: string
  group: 'staging' | 'archive'
  present: boolean
  /** Only when not present: `absent` or `view`. */
  not_present_reason?: string
  /** Rows in the source (COUNT(*) in the snapshot / count read), null when not counted. */
  row_count: number | null
  columns_selected: number
  columns_redacted: string[]
  spec_columns_missing_in_source: string[]
  source_columns_not_in_spec: { count: number; names: string[] }
  type_notes: string[]
  /** Spec j columns held in text: number of non-NULL values that are not valid JSON (null when not counted). */
  invalid_json: Record<string, number | null>
  /** Integer values of 2^53 or more, per column (only when the export found any). */
  large_integers?: Record<string, number>
}

export interface SchemaReport {
  generated_at: string
  server: { version: string; flavor: string }
  time_zone: { session: string; global: string; system: string }
  grants: { read_only: boolean; privileges: string[]; refused: string[]; unverifiable: number }
  datetime_offset?: string
  spec_tables_absent_in_source: string[]
  source_tables_not_in_spec: { count: number; names: string[] }
  tables: TableReport[]
  totals: { tables_present: number; tables_expected: number; rows: number | null }
}

export function buildReport(input: {
  now: Date
  schema: SchemaInfo
  verdict: GrantVerdict
  plans: readonly TablePlan[]
  specTableNames: readonly string[]
  counts?: ReadonlyMap<string, number>
  invalidJson?: Readonly<Record<string, Record<string, number>>>
  largeIntegers?: Readonly<Record<string, Record<string, number>>>
  datetimeOffset?: string
}): SchemaReport {
  const { schema, plans, counts } = input
  const specNames = new Set(input.specTableNames)
  const sourceOnly = [...schema.tables.keys()].filter((n) => !specNames.has(n)).sort()
  const tables: TableReport[] = plans.map((p) => {
    return {
      table: p.name,
      group: p.group,
      present: p.present,
      ...(p.present ? {} : { not_present_reason: p.absentReason ?? 'absent' }),
      row_count: p.present ? (counts?.get(p.name) ?? null) : null,
      columns_selected: p.columns.length,
      columns_redacted: p.redacted,
      spec_columns_missing_in_source: p.missingInSource,
      source_columns_not_in_spec: { count: p.sourceOnly.length, names: p.sourceOnly.filter((n) => PLAIN.test(n)).slice(0, 200) },
      type_notes: p.notes,
      invalid_json: Object.fromEntries(p.jsonTextColumns.map((c) => [c, input.invalidJson?.[p.name]?.[c] ?? null])),
      ...(input.largeIntegers?.[p.name] ? { large_integers: { ...input.largeIntegers[p.name] } } : {}),
    }
  })
  const present = tables.filter((t) => t.present)
  const counted = present.every((t) => t.row_count !== null)
  return {
    generated_at: input.now.toISOString(),
    server: { version: schema.version, flavor: schema.flavor },
    time_zone: schema.timeZone,
    grants: { read_only: input.verdict.readOnly, privileges: input.verdict.privileges, refused: input.verdict.refused, unverifiable: input.verdict.unverifiable },
    ...(input.datetimeOffset ? { datetime_offset: input.datetimeOffset } : {}),
    spec_tables_absent_in_source: tables.filter((t) => !t.present).map((t) => t.table),
    source_tables_not_in_spec: { count: sourceOnly.length + schema.unprintableTables, names: sourceOnly.slice(0, 200) },
    tables,
    totals: {
      tables_present: present.length,
      tables_expected: tables.length,
      rows: counted ? present.reduce((sum, t) => sum + (t.row_count ?? 0), 0) : null,
    },
  }
}

const cell = (v: string): string => v.replace(/\|/g, '/')

export function renderReportMarkdown(r: SchemaReport): string {
  const out: string[] = [
    '# .cloud schema report (names, types and counts only)',
    '',
    `Generated: ${r.generated_at}. Server: ${r.server.flavor} ${cell(r.server.version)}.`,
    `Time zone: session ${cell(r.time_zone.session)}, global ${cell(r.time_zone.global)}, system ${cell(r.time_zone.system)}.`,
    r.datetime_offset ? `DATETIME offset applied: ${r.datetime_offset}.` : 'DATETIME columns have no time zone: --datetime-offset decides the offset at export.',
    '',
    `Grants: ${r.grants.read_only ? 'read-only (accepted)' : 'NOT read-only (refused)'}. Privileges seen: ${r.grants.privileges.join(', ') || 'none'}.${r.grants.refused.length > 0 ? ` Beyond read-only: ${r.grants.refused.join(', ')}.` : ''}${r.grants.unverifiable > 0 ? ` Unverifiable grant lines: ${r.grants.unverifiable}.` : ''}`,
    '',
    `Tables present: ${r.totals.tables_present} of ${r.totals.tables_expected}. Rows: ${r.totals.rows ?? 'not counted'}.`,
    '',
    '| Table | Present | Rows | Selected | Redacted | Spec columns missing or not granted | Source columns not in spec |',
    '|---|---|---:|---:|---|---|---|',
    ...r.tables.map(
      (t) =>
        `| ${t.table} | ${t.present ? 'yes' : `no (${t.not_present_reason})`} | ${t.row_count ?? ''} | ${t.columns_selected} | ${t.columns_redacted.join(', ')} | ${t.spec_columns_missing_in_source.join(', ')} | ${t.source_columns_not_in_spec.count > 0 ? `${t.source_columns_not_in_spec.count}: ${t.source_columns_not_in_spec.names.join(', ')}` : ''} |`,
    ),
    '',
  ]
  const notes = r.tables.filter((t) => t.type_notes.length > 0 || Object.keys(t.invalid_json).length > 0 || Object.keys(t.large_integers ?? {}).length > 0)
  if (notes.length > 0) {
    out.push('## Type notes', '')
    for (const t of notes) {
      for (const n of t.type_notes) out.push(`- ${t.table}.${n}`)
      for (const [c, n] of Object.entries(t.large_integers ?? {})) out.push(`- ${t.table}.${c}: ${n} integer value(s) of 2^53 or more (exact in the raw file; dump:produce refuses)`)
      for (const [c, n] of Object.entries(t.invalid_json)) out.push(`- ${t.table}.${c}: ${n === null ? 'invalid JSON values not counted' : `${n} value(s) that are not valid JSON (exported as NULL)`}`)
    }
    out.push('')
  }
  if (r.source_tables_not_in_spec.count > 0) {
    out.push('## Source tables that ddl/spec.ts does not know (never exported)', '', `${r.source_tables_not_in_spec.count} table(s): ${r.source_tables_not_in_spec.names.join(', ')}`, '')
  }
  return out.join('\n')
}

export async function writeReport(dir: string, report: SchemaReport): Promise<void> {
  await writeFile(join(dir, 'schema-report.json'), `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await writeFile(join(dir, 'schema-report.md'), `${renderReportMarkdown(report)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
}
