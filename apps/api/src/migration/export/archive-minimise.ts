/**
 * `archive_cloud` minimisation (AM-09 / BE-30, LEAD decision 18 on Q12): after the Q9 export (`question-reports.ts`) has
 * handed the open reports to the content team, the personal columns the archive keeps are emptied:
 *   - `user_id` -> NULL in `question_reports`, `question_submissions`, `question_imports`, `spm_sets`,
 *     `teacher_reference_documents` (where the column exists);
 *   - `reason` (reporter free text) -> NULL in `question_reports`.
 * `_row_hash` (the loader's hash of the whole row, which holds those values) is set to NULL on every row that is touched.
 * No other column is written (not `updated_at`, not `title`, not `path`). Rows are never deleted.
 *
 * Gates (the same family as `rollbackLegacy`, a destructive data change), for the dry-run AND the apply:
 *   `PP_ALLOW_MIGRATE_APPLY=1`, `PP_MIGRATE_TARGET_DB = current_database()` (every environment), `confirmDb = current_database()`.
 * "The export ran" is proved by `exportSummaryPath`: the summary JSON that `migrate:export-question-reports` writes
 * (`question-reports-open-<stamp>.summary.json`, a regular file, not a link). It must parse as that summary, and its counts
 * (all reports, open reports, all submissions, open submissions) must equal the counts in the database now. A summary of
 * another database state, a later load, or a hand-written file therefore does not pass. The CSV files are NOT required
 * (the runbook deletes them at hand-over). Statuses are never changed here, so a re-run with the same summary still matches.
 *
 * One transaction (REPEATABLE READ). The dry-run runs the same UPDATEs and rolls back, so its counts are exact. The caller
 * holds `etl:source:cloud`. Output is counts only, never a value.
 */
import { closeSync, constants as fsConstants, fstatSync, openSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'

import type pg from 'pg'

import { ARCHIVE_SCHEMA } from '../ddl/spec'
import { ApplyGuardError, assertApplyAllowed } from '../kit/apply-guard'
import { sanitizeDbError } from '../kit/errors'
import { quoteIdent } from '../kit/sql'
import { OPEN_REPORT_STATUSES } from './question-reports'

/** Refused before anything was changed. The CLI maps it to exit 2. */
export class ArchiveMinimiseRefusedError extends ApplyGuardError {
  constructor(message: string) {
    super(message)
    this.name = 'ArchiveMinimiseRefusedError'
  }
}

/** The columns emptied, per table. Fixed list: nothing is derived from data. */
export const MINIMISE_PLAN: readonly { table: string; columns: readonly string[] }[] = [
  { table: 'question_reports', columns: ['user_id', 'reason'] },
  { table: 'question_submissions', columns: ['user_id'] },
  { table: 'question_imports', columns: ['user_id'] },
  { table: 'spm_sets', columns: ['user_id'] },
  { table: 'teacher_reference_documents', columns: ['user_id'] },
]

export interface MinimiseOptions {
  pool: pg.Pool
  env: Readonly<Record<string, string | undefined>>
  confirmDb: string | undefined
  /** Path of the Q9 export summary file. */
  exportSummaryPath: string | undefined
  /** Default true. `false` commits. */
  dryRun?: boolean
}

export interface MinimiseReport {
  database: string
  dryRun: boolean
  /** Rows changed (apply) or that would be changed (dry-run), per table and column; columns that do not exist are absent. */
  changes: { table: string; column: string; rows: number }[]
  total: number
}

interface SummaryCounts {
  reports: { total: number; exported: number }
  submissions: { total: number; exported: number }
}

const A = quoteIdent(ARCHIVE_SCHEMA)
const q = quoteIdent
/** Loader column: a hash of the whole row. Emptied on every row the command touches. */
const HASH_COLUMN = '_row_hash'
const SUMMARY_NAME = /^question-reports-open-.+\.summary\.json$/
const MAX_SUMMARY_BYTES = 1_000_000

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** Reads and validates the export summary (shape only); throws a refusal that names the problem, never file content. */
export function readExportSummary(path: string | undefined): SummaryCounts {
  const fail = (why: string): never => {
    throw new ArchiveMinimiseRefusedError(`Refusing: ${why} Run migrate:export-question-reports first and pass its summary file with --export-summary. Nothing was changed.`)
  }
  if (path === undefined || path.trim() === '') return fail('--export-summary <path> is required (the Q9 export has not been shown to have run).')
  if (!SUMMARY_NAME.test(basename(path))) return fail('--export-summary is not a question-reports-open-<stamp>.summary.json file.')
  let text: string
  try {
    // O_NOFOLLOW refuses a link at open, and the checks run on the opened descriptor (no check-then-read gap).
    const fd = openSync(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    try {
      const st = fstatSync(fd)
      if (!st.isFile()) return fail('--export-summary is not a regular file (a link or a folder is refused).')
      if (st.size > MAX_SUMMARY_BYTES) return fail('--export-summary is too large to be an export summary.')
      text = readFileSync(fd, 'utf8')
    } finally {
      closeSync(fd)
    }
  } catch (e) {
    if (e instanceof ArchiveMinimiseRefusedError) throw e
    return fail('--export-summary cannot be read (does it exist?).')
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return fail('--export-summary is not valid JSON.')
  }
  const o = json as { source?: unknown; total?: unknown; exported?: unknown; byStatus?: unknown; submissions?: { total?: unknown; exported?: unknown; byStatus?: unknown } }
  const s = o?.submissions
  if (
    typeof o !== 'object' || o === null || o.source !== 'cloud' || !isCount(o.total) || !isCount(o.exported) || !Array.isArray(o.byStatus) ||
    typeof s !== 'object' || s === null || !isCount(s.total) || !isCount(s.exported) || !Array.isArray(s.byStatus) ||
    o.exported > o.total || s.exported > s.total
  ) {
    return fail('--export-summary does not have the shape of the export summary.')
  }
  return { reports: { total: o.total, exported: o.exported }, submissions: { total: s.total, exported: s.exported } }
}

/** Gates 1 to 3 (the same as the rollback). Throws `ApplyGuardError`; reads `current_database()` only. */
export async function assertMinimiseAllowed(pool: Pick<pg.Pool, 'query'>, env: MinimiseOptions['env'], confirmDb: string | undefined): Promise<string> {
  await assertApplyAllowed(pool, env)
  const current = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db ?? ''
  if (env.PP_MIGRATE_TARGET_DB !== current) {
    throw new ArchiveMinimiseRefusedError(`Refusing: PP_MIGRATE_TARGET_DB must equal the connected database name ("${current}") in every environment. Nothing was changed.`)
  }
  if (confirmDb !== current) {
    throw new ArchiveMinimiseRefusedError(`Refusing: --confirm must equal the connected database name ("${current}"). Nothing was changed.`)
  }
  return current
}

async function counts(db: pg.PoolClient, table: string): Promise<{ total: number; open: number }> {
  const r = await db.query<{ total: string; open: string }>(
    `SELECT count(*)::text AS total, (count(*) FILTER (WHERE lower(btrim(status::text)) = ANY($1::text[])))::text AS open FROM ${A}.${q(table)}`,
    [[...OPEN_REPORT_STATUSES]],
  )
  return { total: Number(r.rows[0]?.total), open: Number(r.rows[0]?.open) }
}

/** Runs the minimisation. The caller holds the source lock. Throws `ApplyGuardError` subclasses for every refusal. */
export async function minimiseArchive(options: MinimiseOptions): Promise<MinimiseReport> {
  const { pool, env } = options
  const dryRun = options.dryRun ?? true
  const database = await assertMinimiseAllowed(pool, env, options.confirmDb)
  const expected = readExportSummary(options.exportSummaryPath)

  const client = await pool.connect()
  let broken = false
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
    await client.query(`SET LOCAL lock_timeout = '30s'`)

    const schema = await client.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [ARCHIVE_SCHEMA])
    if (schema.rowCount === 0) throw new ArchiveMinimiseRefusedError(`Refusing: schema ${ARCHIVE_SCHEMA} does not exist in this database. Nothing was changed.`)
    const cols = await client.query<{ table_name: string; column_name: string; is_nullable: string }>(
      `SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
      [ARCHIVE_SCHEMA, MINIMISE_PLAN.map((p) => p.table)],
    )
    const have = new Map(cols.rows.map((c) => [`${c.table_name}.${c.column_name}`, c.is_nullable === 'YES']))
    const missing = MINIMISE_PLAN.filter((p) => !cols.rows.some((c) => c.table_name === p.table)).map((p) => p.table)
    if (missing.length > 0) throw new ArchiveMinimiseRefusedError(`Refusing: ${ARCHIVE_SCHEMA} table(s) missing: ${missing.join(', ')}. Nothing was changed.`)
    for (const p of MINIMISE_PLAN) {
      for (const c of [...p.columns, HASH_COLUMN]) {
        if (have.get(`${p.table}.${c}`) === false) {
          throw new ArchiveMinimiseRefusedError(`Refusing: ${ARCHIVE_SCHEMA}.${p.table}.${c} is NOT NULL and cannot be emptied. Nothing was changed.`)
        }
      }
    }

    // The export must describe the data as it is now.
    const reports = await counts(client, 'question_reports')
    const subs = await counts(client, 'question_submissions')
    const same =
      reports.total === expected.reports.total && reports.open === expected.reports.exported &&
      subs.total === expected.submissions.total && subs.open === expected.submissions.exported
    if (!same) {
      throw new ArchiveMinimiseRefusedError(
        `Refusing: the export summary does not match the archive now (reports ${expected.reports.exported}/${expected.reports.total} in the summary, ${reports.open}/${reports.total} now; ` +
          `submissions ${expected.submissions.exported}/${expected.submissions.total} in the summary, ${subs.open}/${subs.total} now). Run migrate:export-question-reports again. Nothing was changed.`,
      )
    }

    // One statement per table: each row is rewritten once. A row is touched when at least one listed column is non-null; the
    // loader's `_row_hash` (an unkeyed SHA-256 of the whole row, user_id and reason included) is emptied on those rows, or it
    // would let the reporter be re-identified by guessing. The per-column counts are taken from the rows' values before the change.
    const changes: MinimiseReport['changes'] = []
    for (const p of MINIMISE_PLAN) {
      const cols = p.columns.filter((c) => have.has(`${p.table}.${c}`))
      if (cols.length === 0) continue
      const flags = cols.map((_, i) => `${q(cols[i] as string)} IS NOT NULL AS f${i}`).join(', ')
      const any = cols.map((c) => `${q(c)} IS NOT NULL`).join(' OR ')
      const sets = [...cols.map((c) => `${q(c)} = NULL`), ...(have.has(`${p.table}.${HASH_COLUMN}`) ? [`${q(HASH_COLUMN)} = NULL`] : [])].join(', ')
      const sums = cols.map((_, i) => `count(*) FILTER (WHERE f${i})::text AS n${i}`).join(', ')
      const res = await client.query<Record<string, string>>(
        `WITH hit AS (SELECT ctid AS c, ${flags} FROM ${A}.${q(p.table)} WHERE ${any}), ` +
          `upd AS (UPDATE ${A}.${q(p.table)} AS t SET ${sets} FROM hit WHERE t.ctid = hit.c RETURNING ${cols.map((_, i) => `hit.f${i}`).join(', ')}) ` +
          `SELECT ${sums} FROM upd`,
      )
      cols.forEach((c, i) => changes.push({ table: p.table, column: c, rows: Number(res.rows[0]?.[`n${i}`] ?? 0) }))
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT')
    return { database, dryRun, changes, total: changes.reduce((n, c) => n + c.rows, 0) }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {
      broken = true
    })
    throw err instanceof ApplyGuardError ? err : sanitizeDbError(err)
  } finally {
    client.release(broken ? true : undefined)
  }
}
