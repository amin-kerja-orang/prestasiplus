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
 * WORKING ASSUMPTION ("open"): the enum values of `question_reports.status` are not profiled yet. The live site shows
 * `baru` / `selesai` (docs/discovery/L06), the v2 prototype uses `pending`. A report is open when its status, trimmed and
 * lower-cased, is in `OPEN_REPORT_STATUSES`. The summary lists the count of EVERY status with `exported` true or false,
 * so the operator sees what was left out and can extend the set after profiling (MIG-01).
 *
 * PRIVACY: the file has NO user id and no user attribute (name, e-mail, school): the reporter is not selected at all.
 * `reason` is free text written by the reporter, so it is kept (the content team needs it) and the CSV is personal-data
 * bearing: custody and deletion are in the runbook (section 17a). The summary holds counts per status only. The command
 * prints counts and file paths, never a row.
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
  'created_at',
] as const

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
  /** Normalised status; `(null)` for no status, `(other)` for a value that does not look like an enum code. */
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
}

export interface ExportResult {
  csv: string
  summary: string
  total: number
  exported: number
  byStatus: StatusCount[]
}

const A = quoteIdent(ARCHIVE_SCHEMA)
const S = quoteIdent(STAGING_SCHEMA)

/** Same lateral lookup as `snapshot-dims/index.ts` (bridge by id, never a join on free text). */
const PAGE_SQL = `
SELECT r.id::text AS legacy_report_id, r.question_id::text AS legacy_question_id,
       k.natural_key AS source_paper_natural_key, k.number_label AS number_label,
       sb.code::text AS subject_code, ch.number::text AS chapter_number, q.topic_id::text AS topic_id,
       r.status::text AS status, r.reason::text AS reason,
       to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
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

const STATUS_SQL = `SELECT lower(btrim(status::text)) AS status, count(*)::text AS n FROM ${A}."question_reports" GROUP BY 1 ORDER BY 1`

type Cell = string | null

/**
 * One RFC 4180 field. A text that starts with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'` so a spreadsheet does
 * not run it as a formula (CSV injection); then quotes, commas and line breaks are quoted.
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export const csvLine = (cells: readonly Cell[]): string => `${cells.map(csvCell).join(',')}\r\n`

/** A status value is named in the summary only when it looks like an enum code (never free text). */
function statusLabel(raw: string | null): string {
  if (raw === null) return '(null)'
  return /^[a-z0-9_\- ]{1,40}$/.test(raw) ? raw : '(other)'
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

/** Replaces an existing file (never through a symbolic link) and creates it with `wx`, mode 0600. */
function openNew(file: string): number {
  if (existsSync(file) || isLink(file)) {
    if (lstatSync(file).isSymbolicLink()) throw new RangeError('An export file is a symbolic link; refusing to write through it.')
    unlinkSync(file)
  }
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

/**
 * Writes `question-reports-open-<stamp>.csv` and `.summary.json` (mode 0600) under a `.migration-out` folder and returns
 * the paths and the counts. Reads only; no table is written.
 */
export async function exportOpenQuestionReports(options: ExportOptions): Promise<ExportResult> {
  const now = (options.now ?? (() => new Date()))()
  const generatedAt = now.toISOString()
  const stamp = generatedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const dir = prepareOutputDir(options.outDir)
  const csv = join(dir, `question-reports-open-${stamp}.csv`)
  const summaryFile = join(dir, `question-reports-open-${stamp}.summary.json`)
  const pageSize = options.pageSize ?? 500

  let fd: number | undefined
  let exported = 0
  let byStatus: StatusCount[] = []
  try {
    fd = openNew(csv)
    writeSync(fd, csvLine(CSV_COLUMNS))
    await withReadOnly(options.pool, async (c) => {
      const counts = await c.query<{ status: string | null; n: string }>(STATUS_SQL)
      const open = new Set(OPEN_REPORT_STATUSES)
      const merged = new Map<string, StatusCount>()
      for (const row of counts.rows) {
        const label = statusLabel(row.status)
        const isOpen = row.status !== null && open.has(row.status)
        const prev = merged.get(label)
        merged.set(label, { status: label, count: (prev?.count ?? 0) + Number(row.n), exported: (prev?.exported ?? false) || isOpen })
      }
      byStatus = [...merged.values()].sort((x, y) => (x.status < y.status ? -1 : x.status > y.status ? 1 : 0))
      let after: string | null = null
      for (;;) {
        const res: pg.QueryResult<Record<(typeof CSV_COLUMNS)[number], Cell>> = await c.query(PAGE_SQL, [[...OPEN_REPORT_STATUSES], after, pageSize])
        if (res.rows.length > 0) {
          writeSync(fd as number, res.rows.map((r) => csvLine(CSV_COLUMNS.map((k) => r[k]))).join(''))
          exported += res.rows.length
        }
        if (res.rows.length < pageSize) break
        after = (res.rows[res.rows.length - 1] as { legacy_report_id: string }).legacy_report_id
      }
    })
    closeSync(fd)
    fd = undefined
  } catch (e) {
    if (fd !== undefined) closeSync(fd)
    // A half-written export must not stay behind.
    if (existsSync(csv) && !isLink(csv)) unlinkSync(csv)
    throw e
  }

  const total = byStatus.reduce((n, s) => n + s.count, 0)
  const summary: ExportSummary = {
    generatedAt,
    source: 'cloud',
    openStatuses: OPEN_REPORT_STATUSES,
    total,
    exported,
    byStatus,
    csvFile: basename(csv),
  }
  const sfd = openNew(summaryFile)
  try {
    writeSync(sfd, `${JSON.stringify(summary, null, 2)}\n`)
  } finally {
    closeSync(sfd)
  }
  return { csv, summary: summaryFile, total, exported, byStatus }
}
