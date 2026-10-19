/**
 * Profiling report (BE-27 AC3, BE-MIG-06, MIG-01). AGGREGATES ONLY: row counts, null ratios, the
 * distinct values of columns the spec marks as enum-like (capped at 50), orphan counts per declared
 * foreign key, duplicate counts for `users.email` and `(school_id, username)`, and a histogram of
 * password-hash prefixes. No value of any other column is ever selected into the report.
 *
 * Safety nets for the enum listing: a value that looks personal (contains `@`, or a run of 7 or
 * more digits, or is longer than 40 characters) is shown as `[masked]`.
 */
import type pg from 'pg'

import { columnNames, schemaOf, TABLES, findTable, type TableSpec } from '../ddl/spec'
import { quoteIdent } from '../kit/sql'

export const ENUM_CAP = 50

export interface EnumValue {
  value: string | null
  count: number
}
export interface EnumProfile {
  column: string
  distinct: number
  /** True when `values` holds only the first ENUM_CAP of `distinct` values. */
  truncated: boolean
  values: EnumValue[]
}
export interface OrphanProfile {
  column: string
  parent: string
  orphans: number
}
export interface DuplicateProfile {
  check: string
  /** Distinct keys that occur more than once. */
  duplicateGroups: number
  /** Rows that share their key with another row. */
  rowsInDuplicateGroups: number
}
export interface HashPrefixProfile {
  column: string
  /** Prefix such as `$2y$`; `(null)`, `(empty)` or `(other)` for anything that is not `$id$`-shaped. */
  prefixes: { prefix: string; count: number }[]
}
export interface TableProfile {
  schema: string
  table: string
  rowCount: number
  nullRatios: Record<string, number | null>
  enums: EnumProfile[]
  orphans: OrphanProfile[]
  duplicates: DuplicateProfile[]
  hashPrefixes: HashPrefixProfile[]
}
export interface ProfileReport {
  generatedAt: string
  source: 'cloud'
  tablesProfiled: number
  tablesMissing: string[]
  totalRows: number
  tables: TableProfile[]
}

/** Duplicate checks the card names. `lower` compares e-mail case-insensitively (MySQL collation). */
const DUPLICATE_CHECKS: readonly { table: string; label: string; columns: readonly string[]; lower?: boolean; notNull: readonly string[] }[] = [
  { table: 'users', label: 'users.email', columns: ['email'], lower: true, notNull: ['email'] },
  { table: 'users', label: 'users.(school_id, username)', columns: ['school_id', 'username'], notNull: ['username'] },
]
const HASH_COLUMNS: readonly { table: string; column: string }[] = [{ table: 'users', column: 'password' }]

const looksPersonal = (v: string): boolean => v.includes('@') || /\d{7,}/.test(v) || v.length > 40
export const maskEnumValue = (v: string): string => (looksPersonal(v) ? '[masked]' : v)

const qualified = (spec: TableSpec) => `${quoteIdent(schemaOf(spec))}.${quoteIdent(spec.name)}`

async function tableExists(db: pg.Pool, spec: TableSpec): Promise<boolean> {
  const res = await db.query<{ ok: boolean }>('select to_regclass($1) is not null as ok', [qualified(spec)])
  return res.rows[0]?.ok === true
}

async function profileTable(db: pg.Pool, spec: TableSpec): Promise<TableProfile> {
  const target = qualified(spec)
  const cols = columnNames(spec)

  const counts = await db.query<Record<string, string>>(
    `select count(*) as total, ${cols.map((c, i) => `count(${quoteIdent(c)}) as c${i}`).join(', ')} from ${target}`,
  )
  const row = counts.rows[0] as Record<string, string>
  const total = Number(row.total)
  const nullRatios: Record<string, number | null> = {}
  cols.forEach((c, i) => {
    nullRatios[c] = total === 0 ? null : Math.round((1 - Number(row[`c${i}`]) / total) * 10000) / 10000
  })

  const enums: EnumProfile[] = []
  for (const col of spec.columns.filter((c) => c.enum)) {
    const q = quoteIdent(col.name)
    const values = await db.query<{ v: string | null; n: string }>(
      `select ${q}::text as v, count(*) as n from ${target} group by 1 order by count(*) desc, 1 limit ${ENUM_CAP + 1}`,
    )
    const distinct = await db.query<{ n: string }>(`select count(distinct ${q}) + (case when count(*) > count(${q}) then 1 else 0 end) as n from ${target}`)
    const shown = values.rows.slice(0, ENUM_CAP).map((r) => ({ value: r.v === null ? null : maskEnumValue(r.v), count: Number(r.n) }))
    enums.push({
      column: col.name,
      distinct: Number(distinct.rows[0]?.n ?? 0),
      truncated: values.rows.length > ENUM_CAP,
      values: shown,
    })
  }

  const orphans: OrphanProfile[] = []
  for (const col of spec.columns.filter((c) => c.fk)) {
    const parent = findTable(col.fk as string)
    if (!parent || !(await tableExists(db, parent))) continue
    const q = quoteIdent(col.name)
    const res = await db.query<{ n: string }>(
      `select count(*) as n from ${target} t where t.${q} is not null and not exists (select 1 from ${qualified(parent)} p where p."id" = t.${q})`,
    )
    orphans.push({ column: col.name, parent: parent.name, orphans: Number(res.rows[0]?.n ?? 0) })
  }

  const duplicates: DuplicateProfile[] = []
  for (const check of DUPLICATE_CHECKS.filter((c) => c.table === spec.name)) {
    const keys = check.columns.map((c) => (check.lower ? `lower(${quoteIdent(c)}::text)` : quoteIdent(c))).join(', ')
    const where = check.notNull.map((c) => `${quoteIdent(c)} is not null`).join(' and ')
    const res = await db.query<{ groups: string; rows: string }>(
      `select count(*) as groups, coalesce(sum(n), 0) as rows from
         (select count(*) as n from ${target} where ${where} group by ${keys} having count(*) > 1) d`,
    )
    duplicates.push({
      check: check.label,
      duplicateGroups: Number(res.rows[0]?.groups ?? 0),
      rowsInDuplicateGroups: Number(res.rows[0]?.rows ?? 0),
    })
  }

  const hashPrefixes: HashPrefixProfile[] = []
  for (const h of HASH_COLUMNS.filter((x) => x.table === spec.name)) {
    const q = quoteIdent(h.column)
    const res = await db.query<{ prefix: string; n: string }>(
      `select case when ${q} is null then '(null)' when ${q} = '' then '(empty)'
                   else coalesce(substring(${q} from '^\\$[0-9A-Za-z]{1,10}\\$'), '(other)') end as prefix,
              count(*) as n
         from ${target} group by 1 order by count(*) desc, 1`,
    )
    hashPrefixes.push({ column: h.column, prefixes: res.rows.map((r) => ({ prefix: r.prefix, count: Number(r.n) })) })
  }

  return { schema: schemaOf(spec), table: spec.name, rowCount: total, nullRatios, enums, orphans, duplicates, hashPrefixes }
}

/** Profiles every spec table that exists in the staging database. */
export async function collectProfile(db: pg.Pool, now: Date = new Date()): Promise<ProfileReport> {
  const tables: TableProfile[] = []
  const missing: string[] = []
  for (const spec of TABLES) {
    if (!(await tableExists(db, spec))) {
      missing.push(spec.name)
      continue
    }
    tables.push(await profileTable(db, spec))
  }
  return {
    generatedAt: now.toISOString(),
    source: 'cloud',
    tablesProfiled: tables.length,
    tablesMissing: missing,
    totalRows: tables.reduce((s, t) => s + t.rowCount, 0),
    tables,
  }
}
