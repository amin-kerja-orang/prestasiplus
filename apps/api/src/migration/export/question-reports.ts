/**
 * Open question reports export (BE-30, Q9 A; v2-data-migration.md 3.3 item 4): `question_reports` is not migrated, but
 * the reports that are still open are written to a file for the content team; closed ones are dropped.
 *
 * Source: `archive_cloud.question_reports`, read-only (one REPEATABLE READ READ ONLY transaction, so nothing can be
 * written and the file is one consistent picture). The question is found again in the new bank by the same
 * identifiers the BE-29 snapshot join uses (`snapshot-dims/index.ts`): the source paper natural key and the number
 * label (canonical bridge `legacy_canonical_map` -> `exam_questions` -> lowest-numbered `exam_papers` -> `source_papers`),
 * plus the legacy question id and the curriculum codes (subject code, chapter number, topic id). A question that is not
 * in the archive, or has no canonical bridge, gives empty identifier cells (the legacy question id is always there).
 *
 * Q9 A also covers `question_submissions` (teacher submissions). The staged spec holds only `user_id`, `status` and the
 * timestamps for them (no content, v2-data-migration.md 3.3), so the content team gets METADATA only in a second file,
 * `question-submissions-open-<stamp>.csv`: legacy submission id, status, Malaysia date. Never `user_id`. Open submissions
 * are those in the same open set, counted in the same summary. (Deviation row in v2-backend-deviations.md: LEAD to confirm.)
 *
 * Files are created with `wx` and are never replaced: a second run in the same second fails ("already exists") instead
 * of overwriting, and only files this run created are removed on failure.
 *
 * WORKING ASSUMPTION ("open"): the enum values of `question_reports.status` are not profiled yet. The live site shows
 * `baru` / `selesai` (docs/discovery/L06), the v2 prototype uses `pending`. A report is open when its status, trimmed and
 * lower-cased, is in `OPEN_REPORT_STATUSES`. The summary lists the count of EVERY status with `exported` true or false,
 * so the operator sees what was left out and can extend the set after profiling (MIG-01).
 *
 * PRIVACY / MINIMISATION: the file has NO user id and no user attribute (name, e-mail, school): the reporter is not
 * selected at all. `reason` is free text written by the reporter (possibly a minor), so it is kept for the content team
 * but minimised by `redactReason`: e-mail addresses, Malaysian phone numbers and 12-digit IC / MyKad numbers become
 * `[dihapus]`, and the text is cut at `REASON_MAX` characters (marked `[dipotong]`). Names cannot be detected, so the CSV
 * is still personal-data bearing: custody and deletion (7 days at most, or at hand-over, whichever is first) are in the
 * runbook (sections 17a and 18). The report date is the Malaysia calendar DATE only (no time of day). The summary holds
 * counts per status only. The command prints counts and file paths, never a row.
 */
import { closeSync, existsSync, lstatSync, openSync, unlinkSync, writeSync } from 'node:fs'
import { basename, join } from 'node:path'

import type pg from 'pg'

import { ARCHIVE_SCHEMA, STAGING_SCHEMA } from '../ddl/spec'
import { sanitizeDbError } from '../kit/errors'
import { quoteIdent } from '../kit/sql'
import { prepareOutputDir } from '../profile'

/** Working assumption, see the file header. Compared after `lower(btrim(status))`. */
export const OPEN_REPORT_STATUSES: readonly string[] = ['baru', 'menunggu', 'pending', 'open', 'new']

export const CSV_COLUMNS = [
  'legacy_report_id',
  'legacy_question_id',
  'source_paper_natural_key',
  'number_label',
  'subject_code',
  'chapter_number',
  'topic_id',
  'status',
  'reason',
  'created_date',
] as const

export const SUBMISSION_COLUMNS = ['legacy_submission_id', 'status', 'created_date'] as const

/** The statuses the summary may name (documented known set); any other value is shown as `(other)`. */
export const KNOWN_STATUSES: readonly string[] = ['baru', 'menunggu', 'pending', 'open', 'new', 'selesai', 'closed', 'resolved', 'rejected']

export interface ExportOptions {
  pool: pg.Pool
  source?: 'cloud'
  /** A `.migration-out` folder. Default `<repo>/.migration-out`. */
  outDir: string
  /** Test seam: the clock that names the files. */
  now?: () => Date
  pageSize?: number
}

export interface StatusCount {
  /** Normalised status if it is in `KNOWN_STATUSES`; `(null)` for no status; `(other)` for anything else. */
  status: string
  count: number
  exported: boolean
}

export interface ExportSummary {
  generatedAt: string
  source: 'cloud'
  /** Working assumption: the statuses treated as open. */
  openStatuses: readonly string[]
  total: number
  exported: number
  byStatus: StatusCount[]
  csvFile: string
  /** Teacher submissions: metadata only (id, status, date). */
  submissions: { total: number; exported: number; byStatus: StatusCount[]; csvFile: string }
}

export interface TableExportResult {
  csv: string
  total: number
  exported: number
  byStatus: StatusCount[]
}

export interface ExportResult extends TableExportResult {
  summary: string
  submissions: TableExportResult
}

const A = quoteIdent(ARCHIVE_SCHEMA)
const S = quoteIdent(STAGING_SCHEMA)

/** Same lateral lookup as `snapshot-dims/index.ts` (bridge by id, never a join on free text). */
const PAGE_SQL = `
SELECT r.id::text AS legacy_report_id, r.question_id::text AS legacy_question_id,
       k.natural_key AS source_paper_natural_key, k.number_label AS number_label,
       sb.code::text AS subject_code, ch.number::text AS chapter_number, q.topic_id::text AS topic_id,
       r.status::text AS status, r.reason::text AS reason,
       to_char(r.created_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS created_date
FROM ${A}."question_reports" r
LEFT JOIN ${A}."questions" q ON q.id = r.question_id
LEFT JOIN ${S}."subjects" sb ON sb.id = q.subject_id
LEFT JOIN ${S}."chapters" ch ON ch.id = q.chapter_id
LEFT JOIN LATERAL (
  SELECT eq.number_label::text AS number_label,
         (SELECT sp.natural_key::text
          FROM ${A}."exam_paper_questions" epq
          JOIN ${A}."exam_papers" ep ON ep.id = epq.exam_paper_id
          JOIN ${A}."source_papers" sp ON sp.id = ep.source_paper_id
          WHERE epq.exam_question_id = eq.id
          ORDER BY ep.id LIMIT 1) AS natural_key
  FROM ${A}."legacy_canonical_map" m
  JOIN ${A}."exam_questions" eq ON eq.id = m.canonical_id
  WHERE m.source = 'questions' AND m.legacy_id = r.question_id::text AND m.canonical_type = 'exam_question'
  ORDER BY m.id LIMIT 1
) k ON true
WHERE lower(btrim(r.status::text)) = ANY($1::text[]) AND ($2::bigint IS NULL OR r.id > $2::bigint)
ORDER BY r.id
LIMIT $3`

const SUBMISSION_PAGE_SQL = `
SELECT s.id::text AS legacy_submission_id, s.status::text AS status,
       to_char(s.created_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS created_date
FROM ${A}."question_submissions" s
WHERE lower(btrim(s.status::text)) = ANY($1::text[]) AND ($2::bigint IS NULL OR s.id > $2::bigint)
ORDER BY s.id
LIMIT $3`

const SUBMISSION_STATUS_SQL = `SELECT lower(btrim(status::text)) AS status, count(*)::text AS n FROM ${A}."question_submissions" GROUP BY 1 ORDER BY 1`

const STATUS_SQL = `SELECT lower(btrim(status::text)) AS status, count(*)::text AS n FROM ${A}."question_reports" GROUP BY 1 ORDER BY 1`

type Cell = string | null

/** Longest `reason` kept, in characters (code points). */
export const REASON_MAX = 1000
export const REDACTED = '[dihapus]'
export const TRUNCATED = ' [dipotong]'

// Patterns run in this order: e-mail, IC / MyKad (12 digits, `######-##-####`, optional dashes or spaces), phone.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
const IC = /(?<!\d)\d{6}[ -]?\d{2}[ -]?\d{4}(?!\d)/g
// Malaysian numbers: 01x-xxxxxxx(x) mobile, 03-xxxxxxxx and other landlines, with +60 / 60 / 0, spaces or dashes inside.
const PHONE = /(?<![\d])(?:\+?60|0)[ \t-]*(?:1\d|[3-9])(?:[ \t-]*\d){7,8}(?!\d)/g

/** Minimises the reporter's free text: contact details and IC numbers removed, length capped. */
export function redactReason(text: Cell): Cell {
  if (text === null || text === undefined) return null
  // Bound the work on an absurdly long text before the patterns run; the cap below is what the file keeps.
  const redacted = text.slice(0, 20_000).replace(EMAIL, REDACTED).replace(IC, REDACTED).replace(PHONE, REDACTED)
  const chars = Array.from(redacted)
  return chars.length > REASON_MAX || text.length > 20_000 ? `${chars.slice(0, REASON_MAX).join('')}${TRUNCATED}` : redacted
}

/**
 * One RFC 4180 field. A text whose first non-blank character is `=`, `+`, `-` or `@` (blank = whitespace incl. NBSP), or
 * that starts with tab, CR or LF, is prefixed with `'` so a spreadsheet does not run it as a formula (CSV injection);
 * then quotes, commas and line breaks are quoted.
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  const safe = /^(?:\s*[=+\-@]|[\t\r\n])/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export const csvLine = (cells: readonly Cell[]): string => `${cells.map(csvCell).join(',')}\r\n`

/** A status value is named in the summary only when it is in the documented known set (never data-derived text). */
function statusLabel(raw: string | null): string {
  if (raw === null) return '(null)'
  return KNOWN_STATUSES.includes(raw) ? raw : '(other)'
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

function quietly(fn: () => void): void {
  try {
    fn()
  } catch {
    // best effort
  }
}

/** Removes a file we created (never a symbolic link); errors are swallowed so they cannot mask the real one. */
function removeQuietly(path: string): void {
  quietly(() => {
    if (existsSync(path) && !isLink(path)) unlinkSync(path)
  })
}

/** Creates a new file with `wx`, mode 0600. Never replaces an existing file and never writes through a symbolic link. */
function openNew(file: string): number {
  if (isLink(file)) throw new RangeError('An export file path is a symbolic link; refusing to write through it.')
  if (existsSync(file)) throw new RangeError('An export file already exists (a second run in the same second?); refusing to replace it. Wait a second, or move the old file.')
  return openSync(file, 'wx', 0o600)
}

async function withReadOnly<T>(pool: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw sanitizeDbError(e, 'question_reports')
  } finally {
    client.release()
  }
}

interface PagedTable {
  columns: readonly string[]
  statusSql: string
  pageSql: string
  idColumn: string
  /** Per-column transform (the reporter's free text is minimised here). */
  cell?: (column: string, value: Cell) => Cell
}

/** Counts every status, then writes the rows whose status is open, keyset-paged by id. */
async function exportTable(c: pg.PoolClient, fd: number, t: PagedTable, pageSize: number): Promise<{ exported: number; byStatus: StatusCount[] }> {
  const counts = await c.query<{ status: string | null; n: string }>(t.statusSql)
  const open = new Set(OPEN_REPORT_STATUSES)
  const merged = new Map<string, StatusCount>()
  for (const row of counts.rows) {
    const label = statusLabel(row.status)
    const isOpen = row.status !== null && open.has(row.status)
    const prev = merged.get(label)
    merged.set(label, { status: label, count: (prev?.count ?? 0) + Number(row.n), exported: (prev?.exported ?? false) || isOpen })
  }
  const byStatus = [...merged.values()].sort((x, y) => (x.status < y.status ? -1 : x.status > y.status ? 1 : 0))
  let exported = 0
  let after: string | null = null
  for (;;) {
    const res: pg.QueryResult<Record<string, Cell>> = await c.query(t.pageSql, [[...OPEN_REPORT_STATUSES], after, pageSize])
    if (res.rows.length > 0) {
      writeSync(fd, res.rows.map((r) => csvLine(t.columns.map((k) => (t.cell ? t.cell(k, r[k] ?? null) : (r[k] ?? null))))).join(''))
      exported += res.rows.length
    }
    if (res.rows.length < pageSize) break
    after = (res.rows[res.rows.length - 1] as Record<string, string>)[t.idColumn] ?? null
  }
  return { exported, byStatus }
}

const sumCounts = (b: readonly StatusCount[]): number => b.reduce((n, s) => n + s.count, 0)

/**
 * Writes `question-reports-open-<stamp>.csv`, `question-submissions-open-<stamp>.csv` and `question-reports-open-<stamp>.summary.json`
 * (mode 0600, `wx`) under a `.migration-out` folder and returns the paths and the counts. Reads only; no table is written.
 */
export async function exportOpenQuestionReports(options: ExportOptions): Promise<ExportResult> {
  const now = (options.now ?? (() => new Date()))()
  const generatedAt = now.toISOString()
  const stamp = generatedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const dir = prepareOutputDir(options.outDir)
  const csv = join(dir, `question-reports-open-${stamp}.csv`)
  const submissionsCsv = join(dir, `question-submissions-open-${stamp}.csv`)
  const summaryFile = join(dir, `question-reports-open-${stamp}.summary.json`)
  const pageSize = options.pageSize ?? 500

  // Only files this run created are removed on failure (never a pre-existing file); a failing cleanup never hides the error.
  const created: string[] = []
  const open = new Set<number>()
  const create = (file: string): number => {
    const fd = openNew(file)
    created.push(file)
    open.add(fd)
    return fd
  }
  const close = (fd: number): void => {
    open.delete(fd)
    closeSync(fd)
  }

  let reports: { exported: number; byStatus: StatusCount[] } = { exported: 0, byStatus: [] }
  let subs: { exported: number; byStatus: StatusCount[] } = { exported: 0, byStatus: [] }
  try {
    const rfd = create(csv)
    writeSync(rfd, csvLine(CSV_COLUMNS))
    const sfd = create(submissionsCsv)
    writeSync(sfd, csvLine(SUBMISSION_COLUMNS))
    await withReadOnly(options.pool, async (c) => {
      reports = await exportTable(
        c,
        rfd,
        { columns: CSV_COLUMNS, statusSql: STATUS_SQL, pageSql: PAGE_SQL, idColumn: 'legacy_report_id', cell: (k, v) => (k === 'reason' ? redactReason(v) : v) },
        pageSize,
      )
      subs = await exportTable(
        c,
        sfd,
        { columns: SUBMISSION_COLUMNS, statusSql: SUBMISSION_STATUS_SQL, pageSql: SUBMISSION_PAGE_SQL, idColumn: 'legacy_submission_id' },
        pageSize,
      )
    })
    close(rfd)
    close(sfd)

    const summary: ExportSummary = {
      generatedAt,
      source: 'cloud',
      openStatuses: OPEN_REPORT_STATUSES,
      total: sumCounts(reports.byStatus),
      exported: reports.exported,
      byStatus: reports.byStatus,
      csvFile: basename(csv),
      submissions: { total: sumCounts(subs.byStatus), exported: subs.exported, byStatus: subs.byStatus, csvFile: basename(submissionsCsv) },
    }
    const jfd = create(summaryFile)
    writeSync(jfd, `${JSON.stringify(summary, null, 2)}\n`)
    close(jfd)
  } catch (e) {
    for (const fd of open) quietly(() => closeSync(fd))
    for (const f of created) removeQuietly(f)
    throw e
  }
  return {
    csv,
    summary: summaryFile,
    total: sumCounts(reports.byStatus),
    exported: reports.exported,
    byStatus: reports.byStatus,
    submissions: { csv: submissionsCsv, total: sumCounts(subs.byStatus), exported: subs.exported, byStatus: subs.byStatus },
  }
}
