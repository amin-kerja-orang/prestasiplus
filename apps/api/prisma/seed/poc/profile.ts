/**
 * Introspection of the PoC profile (BE-26): row counts per table, the content fingerprint used by the idempotency
 * test, and the markdown table kept in docs/plan/seed-profile.md. Read-only; fictitious data only.
 *
 * Tables come from the catalogue (every base table of the public schema except Prisma's own bookkeeping), so a new
 * table appears in the profile without editing this file.
 */
import { createHash } from 'node:crypto'

import type { Queryable } from './verify'

/** Tables that hold no seeded data by definition. */
const EXCLUDED_TABLES = new Set(['_prisma_migrations'])
/** Columns that are salted per run (argon2 hash), so they cannot take part in a cross-database comparison. */
const SALTED_COLUMNS = ['password_hash']

/**
 * Determinism gaps of the earlier seed modules, kept out of the fingerprint so the rest of every row is still
 * compared (each is listed in docs/plan/seed-profile.md for the owning module to fix):
 * - `updated_at` is stamped by the database clock (Prisma `@updatedAt`) whenever an upsert touches a row, in every table;
 * - `created_at` is stamped by the database clock (column default `now()`, not ctx.clock) in these tables.
 */
export const WALL_CLOCK_CREATED_AT_TABLES: readonly string[] = [
  'answer_keys',
  'blueprints',
  'mastery',
  'papers',
  'part_options',
  'practice_attempt_aggregates',
  'question_parts',
]

/**
 * `practice_sessions.id` is a database-generated uuid (the practice seed matches a session by its fixed `client_uuid`),
 * so the id and the references to it are replaced by the client uuid before hashing, and rows are ordered by it.
 */
const SESSION_REF_TABLES = ['practice_answers', 'practice_checks', 'practice_session_questions', 'session_credits']

export const COUNTS_BEGIN = '<!-- poc-counts:begin -->'
export const COUNTS_END = '<!-- poc-counts:end -->'

/** Names of the public base tables, sorted. */
export async function listTables(db: Queryable): Promise<string[]> {
  const rows = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  )
  return rows.map((r) => r.table_name).filter((t) => !EXCLUDED_TABLES.has(t))
}

/**
 * Primary key columns of a table in key order. A table with no primary key is ordered by every column in column
 * order, each compared as text (json and other types without a btree order still sort), so the order never
 * depends on the stripped row text.
 */
async function orderBy(db: Queryable, table: string): Promise<string> {
  const rows = await db.query<{ col: string }>(
    `select a.attname as col from pg_index i
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = '"public"."${table}"'::regclass and i.indisprimary
      order by array_position(i.indkey::int2[], a.attnum)`,
  )
  if (rows.length > 0) return rows.map((r) => `t."${r.col}"`).join(', ')
  const cols = await db.query<{ col: string }>(
    `select a.attname as col from pg_attribute a
      where a.attrelid = '"public"."${table}"'::regclass and a.attnum > 0 and not a.attisdropped
      order by a.attnum`,
  )
  return cols.map((c) => `t."${c.col}"::text`).join(', ')
}

/** Row count per table, tables with no rows included (value 0). */
export async function pocTableCounts(db: Queryable): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const t of await listTables(db)) {
    const [row] = await db.query<{ n: string }>(`select count(*)::text as n from "${t}"`)
    counts[t] = Number(row?.n ?? 0)
  }
  return counts
}

/** Rows written under Mod Pelajar (`is_test`) per table; they are excluded from every aggregate. */
export async function pocTestRowCounts(db: Queryable): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const tables = await db.query<{ table_name: string }>(
    `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'is_test' order by table_name`,
  )
  for (const { table_name: t } of tables) {
    const [row] = await db.query<{ n: string }>(`select count(*)::text as n from "${t}" where is_test`)
    out[t] = Number(row?.n ?? 0)
  }
  return out
}

export interface Fingerprint {
  hash: string
  counts: Record<string, number>
  /** Hash per table, to see WHICH table differs when the total does. */
  tables: Record<string, string>
}

/**
 * SHA-256 over every table read in primary-key order (no pg_dump). Each row is its canonical jsonb text without the
 * salted columns; `withSalted` adds an md5 of them, valid only when comparing the SAME database before and after a run.
 */
export async function pocFingerprint(db: Queryable, options: { withSalted?: boolean } = {}): Promise<Fingerprint> {
  const h = createHash('sha256')
  const counts: Record<string, number> = {}
  const tables: Record<string, string> = {}
  const strip = SALTED_COLUMNS.map((c) => ` - '${c}'`).join('')
  for (const t of await listTables(db)) {
    const wall = ` - 'updated_at'${WALL_CLOCK_CREATED_AT_TABLES.includes(t) ? " - 'created_at'" : ''}`
    let row = `to_jsonb(t)${strip}${wall}`
    let order = await orderBy(db, t)
    if (t === 'practice_sessions') {
      row = `${row} - 'id'`
      order = 't.client_uuid'
    } else if (SESSION_REF_TABLES.includes(t)) {
      row = `jsonb_set(${row}, '{session_id}', coalesce(to_jsonb((select s.client_uuid from practice_sessions s where s.id = t.session_id)), 'null'::jsonb))`
    }
    const salted = options.withSalted
      ? SALTED_COLUMNS.map((c) => `, md5(coalesce(to_jsonb(t) ->> '${c}', '')) as salted_${c}`).join('')
      : ''
    const select = `(${row})::text as row${salted}`
    const rows = await db.query<Record<string, string>>(`select ${select} from "${t}" t order by ${order}`)
    counts[t] = rows.length
    const th = createHash('sha256')
    for (const r of rows) th.update(`${JSON.stringify(r)}\n`)
    tables[t] = th.digest('hex')
    h.update(`${t}\n${tables[t]}\n`)
  }
  return { hash: h.digest('hex'), counts, tables }
}

/** The markdown table of docs/plan/seed-profile.md: tables with at least one row, plus a summary line. */
export function renderCountsTable(counts: Record<string, number>): string {
  const tables = Object.keys(counts).sort()
  const filled = tables.filter((t) => (counts[t] ?? 0) > 0)
  const lines = ['| Table | Rows |', '|---|---:|', ...filled.map((t) => `| ${t} | ${counts[t]} |`)]
  const total = filled.reduce((sum, t) => sum + (counts[t] ?? 0), 0)
  lines.push('', `Tables with rows: ${filled.length} of ${tables.length}. Total rows: ${total}.`)
  return lines.join('\n')
}

/** Extracts the generated table from the document (between the two markers), trimmed; null when a marker is missing. */
export function extractCountsTable(doc: string): string | null {
  const a = doc.indexOf(COUNTS_BEGIN)
  const b = doc.indexOf(COUNTS_END)
  if (a < 0 || b < a) return null
  return doc.slice(a + COUNTS_BEGIN.length, b).trim()
}

/** Students (role student) by kind, for the D45 comparison: demo.test accounts and generated example.test ones. */
export async function pocStudentCounts(db: Queryable): Promise<{ total: number; demo: number; generated: number }> {
  const [row] = await db.query<{ total: string; demo: string; generated: string }>(
    `select count(*)::text as total,
            count(*) filter (where u.email like '%@demo.test')::text as demo,
            count(*) filter (where u.email like '%@example.test')::text as generated
       from users u where exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student')`,
  )
  return { total: Number(row?.total ?? 0), demo: Number(row?.demo ?? 0), generated: Number(row?.generated ?? 0) }
}
