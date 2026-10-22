/**
 * SQL generation and schema parsing for the .cloud MySQL export (AM-10). Pure functions: no I/O.
 *
 * Rules:
 *   - every identifier is validated (`^[A-Za-z0-9_]+$`) and then backtick-quoted; anything else is refused, so a hostile
 *     schema cannot inject SQL;
 *   - only columns that exist in BOTH ddl/spec.ts and the source are selected (a source-only column never leaves the
 *     server: PDPA minimisation); spec-only columns are omitted and reported; `redact` columns are NULL;
 *   - values are emitted the way `staging:load` takes them (jsonb_populate_recordset into the spec's Postgres types):
 *       DATETIME   'YYYY-MM-DDTHH:MM:SS.ffffff+HH:MM' (the --datetime-offset, default +08:00: a DATETIME has no zone)
 *       TIMESTAMP  'YYYY-MM-DDTHH:MM:SS.ffffffZ'      (the session time zone is forced to UTC)
 *       DATE       'YYYY-MM-DD'
 *       JSON       the JSON value itself (jsonb); a text column that the spec calls j is parsed, invalid text becomes NULL
 *       tinyint    a JSON number (the spec says `t`; Postgres turns 1 into the text '1')
 *       bigint     a JSON number, written verbatim by the splitter, so it is exact in the raw file; an integer of 2^53 or more is
 *                  reported by the splitter and stops dump:cloud and dump:produce (later JSON.parse readers would round it)
 *       binary     base64 without line breaks (flagged in the report)
 *   - zero or partial dates (0000-00-00, 2024-00-10) become NULL: Postgres cannot store them.
 */
import { columnNames, type ColumnSpec, type TableSpec } from '../ddl/spec'
import { DumpUsageError } from './errors'

const IDENT = /^[A-Za-z0-9_]+$/

export function assertIdentifier(name: string): string {
  if (!IDENT.test(name)) throw new DumpUsageError('An identifier is not a plain name ([A-Za-z0-9_]); refusing to build SQL with it.')
  return name
}

export const quoteIdent = (name: string): string => `\`${assertIdentifier(name)}\``

const OFFSET = /^([+-])(\d{2}):(\d{2})$/

export function assertDatetimeOffset(offset: string): string {
  const m = OFFSET.exec(offset)
  if (!m || Number(m[2]) > 14 || Number(m[3]) > 59) throw new DumpUsageError('--datetime-offset must look like +08:00 or -05:30.')
  return offset
}

// ---------------------------------------------------------------------------------------------------------------------
// Schema read

export const M = {
  version: '#PP-VERSION',
  database: '#PP-DATABASE',
  timeZone: '#PP-TZ',
  grants: '#PP-GRANTS',
  roleVars: '#PP-ROLEVARS',
  role: '#PP-ROLE',
  tables: '#PP-TABLES',
  columns: '#PP-COLUMNS',
  counts: '#PP-COUNTS',
  end: '#PP-END',
  table: '#PP-TABLE',
  jsonBad: '#PP-JSONBAD',
} as const

/** Metadata only: no data row is read. */
export function buildMetaSql(): string {
  return [
    `SELECT '${M.version}';`,
    'SELECT VERSION();',
    `SELECT '${M.database}';`,
    'SELECT DATABASE();',
    `SELECT '${M.timeZone}';`,
    'SELECT @@session.time_zone, @@global.time_zone, @@system_time_zone;',
    `SELECT '${M.grants}';`,
    'SHOW GRANTS FOR CURRENT_USER();',
    // Works on MySQL 5.7/8 and MariaDB, needs no privilege, empty set when the variable does not exist.
    `SELECT '${M.roleVars}';`,
    "SHOW GLOBAL VARIABLES WHERE Variable_name IN ('mandatory_roles');",
    `SELECT '${M.tables}';`,
    'SELECT table_name, table_type, engine FROM information_schema.tables WHERE table_schema = DATABASE();',
    `SELECT '${M.columns}';`,
    'SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position;',
    `SELECT '${M.end}';`,
    '',
  ].join('\n')
}

/**
 * The active role is a second metadata call, only where CURRENT_ROLE() exists (MySQL 8.0+, MariaDB): it is a syntax error on
 * MySQL 5.7, and a failed statement would stop the whole schema read.
 */
export function buildRoleSql(): string {
  return [`SELECT '${M.role}';`, 'SELECT CURRENT_ROLE();', `SELECT '${M.end}';`, ''].join('\n')
}

/** True when `CURRENT_ROLE()` exists. An unparsable MySQL version counts as yes: a failure is then loud (fail closed). */
export function supportsRoles(schema: Pick<SchemaInfo, 'flavor' | 'version'>): boolean {
  if (schema.flavor === 'mariadb') return true
  const m = /^(\d+)\./.exec(schema.version.trim())
  return m === null || Number(m[1]) >= 8
}

/** The active role from the `buildRoleSql` output: false for NONE, NULL or empty, true for any role (names are not kept). */
export function parseRoleActive(lines: readonly string[]): boolean {
  const start = lines.indexOf(M.role)
  if (start === -1 || !lines.includes(M.end)) throw new DumpUsageError('The role read did not complete (the client output was cut short).')
  const value = (lines[start + 1] ?? '').trim()
  return !(value === '' || value === M.end || /^(NONE|NULL)$/i.test(value))
}

export type Flavor = 'mysql' | 'mariadb'

export interface SourceColumn {
  name: string
  type: string
}

export interface SourceTable {
  /** `BASE TABLE`, `VIEW`, ... */
  type: string
  /** Storage engine (`InnoDB`, `MyISAM`, ...); undefined for a view. */
  engine?: string
  columns: SourceColumn[]
}

export interface SchemaInfo {
  version: string
  flavor: Flavor
  /** False when `DATABASE()` was NULL (the option file names no database). */
  hasDatabase: boolean
  timeZone: { session: string; global: string; system: string }
  grantLines: string[]
  /** True when `mandatory_roles` is non-empty: every account then holds roles that SHOW GRANTS does not list. */
  mandatoryRoles: boolean
  tables: Map<string, SourceTable>
  /** Names that are not plain identifiers (never used in SQL). */
  unprintableTables: number
}

export function parseMeta(lines: readonly string[]): SchemaInfo {
  const sections = new Map<string, string[]>()
  let current: string[] | undefined
  let ended = false
  const markers = new Set<string>([M.version, M.database, M.timeZone, M.grants, M.roleVars, M.tables, M.columns])
  for (const line of lines) {
    if (line === M.end) {
      ended = true
      current = undefined
      continue
    }
    if (markers.has(line)) {
      current = []
      sections.set(line, current)
      continue
    }
    current?.push(line)
  }
  if (!ended || [...markers].some((m) => !sections.has(m))) throw new DumpUsageError('The schema read did not complete (the client output was cut short).')

  const version = (sections.get(M.version) as string[])[0] ?? ''
  const dbLine = (sections.get(M.database) as string[])[0]
  const tz = ((sections.get(M.timeZone) as string[])[0] ?? '').split('\t')
  const tables = new Map<string, SourceTable>()
  let unprintableTables = 0
  for (const line of sections.get(M.tables) as string[]) {
    const [name, type, engine] = line.split('\t')
    if (name === undefined || type === undefined) continue
    if (!IDENT.test(name)) {
      unprintableTables++
      continue
    }
    tables.set(name, { type: type.toUpperCase(), ...(engine && engine !== 'NULL' ? { engine } : {}), columns: [] })
  }
  for (const line of sections.get(M.columns) as string[]) {
    const [table, name, type] = line.split('\t')
    if (table === undefined || name === undefined || type === undefined) continue
    // A column whose name is not a plain identifier is never selected; it is simply not listed.
    if (!IDENT.test(name)) continue
    tables.get(table)?.columns.push({ name, type: type.toLowerCase() })
  }
  return {
    version,
    flavor: /mariadb/i.test(version) ? 'mariadb' : 'mysql',
    hasDatabase: dbLine !== undefined && dbLine !== 'NULL' && dbLine !== '',
    timeZone: { session: tz[0] ?? '', global: tz[1] ?? '', system: tz[2] ?? '' },
    grantLines: sections.get(M.grants) as string[],
    mandatoryRoles: (sections.get(M.roleVars) as string[]).some((l) => {
      const [name, value] = l.split('\t')
      return name?.toLowerCase() === 'mandatory_roles' && (value ?? '').trim() !== '' && (value ?? '').trim() !== 'NULL'
    }),
    tables,
    unprintableTables,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Plan

const DATETIME_TYPES = new Set(['datetime'])
const TIMESTAMP_TYPES = new Set(['timestamp'])
const BINARY_TYPES = new Set(['binary', 'varbinary', 'tinyblob', 'blob', 'mediumblob', 'longblob'])
const TEXT_TYPES = new Set(['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext', 'enum', 'set'])
const NUMERIC_TYPES = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint', 'decimal', 'numeric', 'float', 'double', 'year', 'bit'])

export type ColumnKind = 'plain' | 'redacted' | 'datetime' | 'timestamp' | 'date' | 'json' | 'json-text' | 'binary' | 'bit'

export interface ColumnPlan {
  name: string
  specType: ColumnSpec['type']
  sourceType: string
  kind: ColumnKind
  /** The SQL value expression (the second argument of JSON_OBJECT). */
  expr: string
}

export interface TablePlan {
  name: string
  group: TableSpec['group']
  /** False when the source has no such base table. */
  present: boolean
  /** Why it is not present: `absent` or `view`. */
  absentReason?: 'absent' | 'view'
  /** Storage engine of the source table (the consistent snapshot holds only for InnoDB). */
  engine?: string
  columns: ColumnPlan[]
  redacted: string[]
  /** Spec columns that the source does not have (omitted from the export). */
  missingInSource: string[]
  /** Source columns that the spec does not have (never selected). Plain names only; `unprintable` counts the rest. */
  sourceOnly: string[]
  /** Data type notes for the report (no values). */
  notes: string[]
  /** Spec `j` columns held in a text column: their invalid values are counted. */
  jsonTextColumns: string[]
  orderBy: string | null
}

export interface PlanOptions {
  datetimeOffset: string
  /** Restrict to these spec table names (already validated). */
  only?: readonly string[]
}

function guard(col: string): string {
  return `YEAR(${col}) = 0 OR MONTH(${col}) = 0 OR DAY(${col}) = 0`
}

export function columnPlan(spec: ColumnSpec, source: SourceColumn | undefined, flavor: Flavor, offset: string): { plan?: ColumnPlan; note?: string } {
  if (spec.redact) {
    return { plan: { name: spec.name, specType: spec.type, sourceType: source?.type ?? 'absent', kind: 'redacted', expr: 'NULL' } }
  }
  if (!source) return {}
  const c = quoteIdent(spec.name)
  const t = source.type
  const make = (kind: ColumnKind, expr: string, note?: string) => ({
    plan: { name: spec.name, specType: spec.type, sourceType: t, kind, expr } satisfies ColumnPlan,
    note,
  })

  if (spec.type === 'd' && (t === 'date' || DATETIME_TYPES.has(t) || TIMESTAMP_TYPES.has(t))) {
    return make('date', `IF(${guard(c)}, NULL, DATE_FORMAT(${c}, '%Y-%m-%d'))`, t === 'date' ? undefined : `spec d but source ${t.toUpperCase()}: the date part is exported`)
  }
  if (DATETIME_TYPES.has(t) || t === 'date') {
    const note = spec.type === 'ts' ? undefined : `spec ${spec.type} but source ${t.toUpperCase()}: exported as a timestamp string`
    const fmt = t === 'date' ? `'%Y-%m-%dT00:00:00.000000${offset}'` : `'%Y-%m-%dT%H:%i:%s.%f${offset}'`
    return make(t === 'date' ? 'date' : 'datetime', `IF(${guard(c)}, NULL, DATE_FORMAT(${c}, ${fmt}))`, note ?? (t === 'datetime' ? 'DATETIME has no time zone: the --datetime-offset is applied' : undefined))
  }
  if (TIMESTAMP_TYPES.has(t)) {
    return make('timestamp', `IF(${guard(c)}, NULL, DATE_FORMAT(${c}, '%Y-%m-%dT%H:%i:%s.%fZ'))`, spec.type === 'ts' ? undefined : `spec ${spec.type} but source TIMESTAMP: exported as a UTC timestamp string`)
  }
  if (spec.type === 'j') {
    if (t === 'json') return make('json', c)
    if (TEXT_TYPES.has(t)) {
      // MariaDB has no CAST(.. AS JSON) but JSON_COMPACT is embedded as JSON. MySQL: the outermost CAST makes the value
      // JSON whatever IF() does with its argument types (5.7 returned a string there).
      const expr = flavor === 'mariadb' ? `IF(JSON_VALID(${c}), JSON_COMPACT(${c}), NULL)` : `CAST(IF(JSON_VALID(${c}), ${c}, NULL) AS JSON)`
      return make('json-text', expr, `spec j but source ${t.toUpperCase()}: parsed when valid, NULL otherwise (invalid values are counted)`)
    }
    return make('plain', c, `spec j but source ${t.toUpperCase()}`)
  }
  if (BINARY_TYPES.has(t)) {
    return make('binary', `REPLACE(TO_BASE64(${c}), CHAR(10 USING utf8mb4), '')`, `${t.toUpperCase()} column exported as base64`)
  }
  if (t === 'bit') return make('bit', `CAST(${c} AS UNSIGNED)`, 'BIT column exported as a number')
  if (t === 'json') return make('json', c, `spec ${spec.type} but source JSON: the JSON value lands in the column`)
  if ((spec.type === 'ts' || spec.type === 'd') && (TEXT_TYPES.has(t) || NUMERIC_TYPES.has(t))) {
    return make('plain', c, `spec ${spec.type} but source ${t.toUpperCase()}: passed through, Postgres must be able to parse it`)
  }
  if ((spec.type === 'id' || spec.type === 'i' || spec.type === 'n') && TEXT_TYPES.has(t)) {
    return make('plain', c, `spec ${spec.type} but source ${t.toUpperCase()}: passed through, Postgres must be able to parse it`)
  }
  return make('plain', c)
}

export function buildPlan(schema: SchemaInfo, specs: readonly TableSpec[], options: PlanOptions): TablePlan[] {
  const offset = assertDatetimeOffset(options.datetimeOffset)
  const only = options.only ? new Set(options.only) : undefined
  const plans: TablePlan[] = []
  for (const spec of specs) {
    if (only && !only.has(spec.name)) continue
    assertIdentifier(spec.name)
    const source = schema.tables.get(spec.name)
    const empty = { name: spec.name, group: spec.group, columns: [], redacted: [], missingInSource: [], sourceOnly: [], notes: [], jsonTextColumns: [], orderBy: null }
    if (!source || source.type !== 'BASE TABLE') {
      plans.push({ ...empty, present: false, absentReason: source ? 'view' : 'absent' })
      continue
    }
    const sourceByName = new Map(source.columns.map((c) => [c.name, c]))
    const specNames = new Set(columnNames(spec))
    const plan: TablePlan = { ...empty, present: true, notes: [], ...(source.engine ? { engine: source.engine } : {}) }
    for (const col of spec.columns) {
      assertIdentifier(col.name)
      const src = sourceByName.get(col.name)
      if (col.redact) plan.redacted.push(col.name) // always NULL, whether or not the source has the column
      else if (!src) {
        plan.missingInSource.push(col.name)
        continue
      }
      const { plan: cp, note } = columnPlan(col, src, schema.flavor, offset)
      if (!cp) continue
      plan.columns.push(cp)
      if (cp.kind === 'json-text') plan.jsonTextColumns.push(col.name)
      if (note) plan.notes.push(`${col.name}: ${note}`)
    }
    plan.sourceOnly = source.columns.map((c) => c.name).filter((n) => !specNames.has(n)).sort()
    plan.orderBy = spec.pk && sourceByName.has(spec.pk) ? spec.pk : null
    if (plan.columns.every((c) => c.kind === 'redacted')) {
      // Nothing of the spec exists in the source: nothing to export.
      plans.push({ ...plan, present: false, absentReason: 'absent', columns: [], notes: [...plan.notes, 'no spec column exists in the source table'] })
      continue
    }
    plans.push(plan)
  }
  return plans
}

// ---------------------------------------------------------------------------------------------------------------------
// Dump SQL

export function buildCountSql(plans: readonly TablePlan[]): string {
  const lines: string[] = [`SELECT '${M.counts}';`]
  for (const p of plans) {
    if (!p.present) continue
    lines.push(`SELECT '${M.table} ${assertIdentifier(p.name)}';`, `SELECT COUNT(*) FROM ${quoteIdent(p.name)};`)
  }
  lines.push(`SELECT '${M.end}';`, '')
  return lines.join('\n')
}

export function parseCounts(lines: readonly string[]): Map<string, number> {
  const out = new Map<string, number>()
  let table: string | undefined
  let ended = false
  let started = false
  for (const line of lines) {
    if (line === M.counts) started = true
    else if (line === M.end) ended = true
    else if (line.startsWith(`${M.table} `)) table = line.slice(M.table.length + 1)
    else if (table !== undefined && /^\d+$/.test(line)) {
      out.set(table, Number(line))
      table = undefined
    }
  }
  if (!started || !ended) throw new DumpUsageError('The row-count read did not complete (the client output was cut short).')
  return out
}

/** The one-session export: consistent read-only snapshot, UTC session, then per table marker, count, bad-JSON counts, rows. */
export function buildDumpSql(plans: readonly TablePlan[]): string {
  const lines: string[] = [
    "SET SESSION time_zone = '+00:00';",
    'SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
    'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;',
  ]
  for (const p of plans) {
    if (!p.present) continue
    const table = quoteIdent(p.name)
    lines.push(`SELECT '${M.table} ${assertIdentifier(p.name)}';`, `SELECT COUNT(*) FROM ${table};`)
    for (const col of p.jsonTextColumns) {
      lines.push(
        `SELECT '${M.jsonBad} ${assertIdentifier(col)}';`,
        `SELECT COUNT(*) FROM ${table} WHERE ${quoteIdent(col)} IS NOT NULL AND JSON_VALID(${quoteIdent(col)}) = 0;`,
      )
    }
    const pairs = p.columns.map((c) => `'${assertIdentifier(c.name)}', ${c.expr}`).join(', ')
    lines.push(`SELECT JSON_OBJECT(${pairs}) FROM ${table}${p.orderBy ? ` ORDER BY ${quoteIdent(p.orderBy)}` : ''};`)
  }
  lines.push('COMMIT;', `SELECT '${M.end}';`, '')
  return lines.join('\n')
}
