/**
 * U-OP-06 (S4-T04 part 1, FR-ADM-G7.6, DM-40, 45 section 6.6.1): trim the leaf prompt that repeats the question stem.
 * A DEV tool; the real run is made by the designated UAT developer only after the product owner approves the dry-run
 * report. Compare only: no text is invented, a trimmed prompt becomes empty.
 *
 * Scope (PO ruling, issue #448): the LATEST version of a question (`questions.latest_version_no`), and only a version that
 * has exactly ONE part (a single leaf). Older versions, multi-part trees and branch parts are never touched.
 * Match: `normalise(stem_ms) = normalise(prompt_ms)` and not empty, where normalise = collapse every whitespace run to one
 * space, then trim. Case is NOT folded. English is compared only when BOTH `stem_en` and `prompt_en` are non-empty; then they
 * must match too (a mismatch means no trim). When English is absent on either side it is ignored.
 * Write: `question_parts.prompt_ms` is NOT NULL, so it becomes the empty string ''. When the English pair matched,
 * `prompt_en` (nullable) is set to NULL. The stem, the answer key, the options and every other column are untouched.
 *
 * Backup: table `_bk_r1_trim_duplicate_stem` (created by --apply, no Prisma migration, DM-40 is "script only"). One row per
 * trimmed part, copied in the SAME statement as the update (so a part is never changed without a backup row).
 * `--restore` writes the old values back, only for a part that still holds the trimmed value (a part edited since is
 * skipped and reported, never overwritten).
 *
 * DRY RUN IS THE DEFAULT (read-only transaction; creates nothing). Writing needs the explicit `--apply` (or `--restore`).
 * Idempotent: a trimmed part no longer matches, so a second --apply writes nothing. Batches of 5,000 parts, one short
 * transaction per batch.
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/trim-duplicate-stem.ts                 # dry run (report only)
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/trim-duplicate-stem.ts --apply         # back up, then trim
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/trim-duplicate-stem.ts --restore       # put the backup values back
 *   (--dry-run is accepted and means the default; --batch-size=N overrides the 5,000; --sample=N the sample size, default 10)
 *
 * Exit code: 0 done (dry run, apply or restore); 1 a failure, or a restore that had to skip parts; 2 a usage error
 * (bad flag, flags that exclude each other, DATABASE_URL not set). Self-contained for now (S4-T03's `uat-ops/lib.ts` is
 * not merged). The report holds counts and ids only, never question text. The connection string comes from the
 * environment, never from this file.
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

export const BACKUP_TABLE = '_bk_r1_trim_duplicate_stem'
export const DEFAULT_BATCH_SIZE = 5000
export const DEFAULT_SAMPLE = 10

export type Mode = 'dry-run' | 'apply' | 'restore'

export interface Options {
  mode: Mode
  batchSize: number
  sample: number
}

/** The SQL normalisation: collapse whitespace runs to one space, then trim; NULL counts as empty. Case is kept. */
const norm = (col: string): string => `btrim(regexp_replace(coalesce(${col}, ''), '\\s+', ' ', 'g'))`

/**
 * The candidates: latest version, exactly one part (a leaf), BM stem equal to the BM prompt after normalisation, and the English
 * pair equal when both exist. Selects the part, the version and the tags needed by the report.
 */
export const MATCH_SQL = `
  SELECT p.id AS part_id,
         v.id AS version_id,
         v.question_id AS question_id,
         v.status AS status,
         v.subject_id AS subject_id,
         v.education_level_id AS level_id,
         p.prompt_ms AS old_prompt_ms,
         p.prompt_en AS old_prompt_en,
         (${norm('v.stem_en')} <> '' AND ${norm('p.prompt_en')} <> '') AS en_matched
    FROM question_parts p
    JOIN question_versions v ON v.id = p.question_version_id
    JOIN questions q ON q.id = v.question_id AND q.latest_version_no = v.version_no
   WHERE p.parent_part_id IS NULL
     AND p.mode IS NOT NULL
     AND (SELECT count(*) FROM question_parts x WHERE x.question_version_id = v.id) = 1
     AND ${norm('v.stem_ms')} <> ''
     AND ${norm('v.stem_ms')} = ${norm('p.prompt_ms')}
     AND (${norm('v.stem_en')} = '' OR ${norm('p.prompt_en')} = '' OR ${norm('v.stem_en')} = ${norm('p.prompt_en')})`

const CREATE_BACKUP_SQL = `
  CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} (
    id            bigserial PRIMARY KEY,
    part_id       bigint      NOT NULL,
    version_id    bigint      NOT NULL,
    old_prompt_ms text        NOT NULL,
    old_prompt_en text,
    new_prompt_ms text        NOT NULL,
    new_prompt_en text,
    run_at        timestamptz NOT NULL DEFAULT now(),
    restored_at   timestamptz
  );
  CREATE INDEX IF NOT EXISTS ix_bk_r1_trim_duplicate_stem_part_id ON ${BACKUP_TABLE} (part_id)`

/** One batch: copy the old values to the backup and write the trimmed ones, in one statement (rows locked meanwhile). */
export const APPLY_BATCH_SQL = `
  WITH cand AS (
    SELECT m.* FROM (${MATCH_SQL}) m
     ORDER BY m.part_id
     LIMIT $1
  ),
  locked AS (
    SELECT p.id FROM question_parts p JOIN cand c ON c.part_id = p.id ORDER BY p.id FOR UPDATE OF p
  ),
  bk AS (
    INSERT INTO ${BACKUP_TABLE} (part_id, version_id, old_prompt_ms, old_prompt_en, new_prompt_ms, new_prompt_en)
    SELECT c.part_id, c.version_id, c.old_prompt_ms, c.old_prompt_en, '', CASE WHEN c.en_matched THEN NULL ELSE c.old_prompt_en END
      FROM cand c JOIN locked l ON l.id = c.part_id
    RETURNING part_id
  )
  UPDATE question_parts p
     SET prompt_ms = '',
         prompt_en = CASE WHEN c.en_matched THEN NULL ELSE p.prompt_en END
    FROM cand c JOIN bk ON bk.part_id = c.part_id
   WHERE p.id = c.part_id`

/** One restore batch: the OLDEST unrestored backup row of a part, only while the part still holds the trimmed value. */
export const RESTORE_BATCH_SQL = `
  WITH todo AS (
    SELECT DISTINCT ON (b.part_id) b.id, b.part_id, b.old_prompt_ms, b.old_prompt_en, b.new_prompt_ms, b.new_prompt_en
      FROM ${BACKUP_TABLE} b
      JOIN question_parts p ON p.id = b.part_id
     WHERE b.restored_at IS NULL
       AND p.prompt_ms = b.new_prompt_ms
       AND p.prompt_en IS NOT DISTINCT FROM b.new_prompt_en
     ORDER BY b.part_id, b.id
     LIMIT $1
  ),
  locked AS (
    SELECT p.id FROM question_parts p JOIN todo t ON t.part_id = p.id ORDER BY p.id FOR UPDATE OF p
  ),
  upd AS (
    UPDATE question_parts p SET prompt_ms = t.old_prompt_ms, prompt_en = t.old_prompt_en
      FROM todo t JOIN locked l ON l.id = t.part_id
     WHERE p.id = t.part_id
       -- Re-checked on the row as it is once our lock is held (READ COMMITTED re-evaluates this on the
       -- newest version): a prompt edited while we waited is left alone and its backup row stays unrestored.
       AND p.prompt_ms = t.new_prompt_ms
       AND p.prompt_en IS NOT DISTINCT FROM t.new_prompt_en
    RETURNING p.id
  ),
  mark AS (
    UPDATE ${BACKUP_TABLE} b SET restored_at = now() FROM upd WHERE b.part_id = upd.id AND b.restored_at IS NULL
    RETURNING b.id
  )
  SELECT (SELECT count(*) FROM upd)::int AS restored`

export interface Report {
  mode: 'dry-run' | 'apply'
  /** Latest versions with exactly one part (the population the rule looks at). */
  scanned: number
  /** Parts that match (dry run) or were trimmed (apply). */
  matched: number
  /** Of those, where the English pair matched too (prompt_en set to NULL as well). */
  enMatched: number
  byStatus: Record<string, number>
  /** Counts per subject code x level code. */
  bySubjectLevel: { subject: string; level: string; count: number }[]
  /** Sample ids (no text). */
  sample: { questionId: string; versionId: string; partId: string }[]
  batches: number
}

export interface RestoreReport {
  mode: 'restore'
  restored: number
  /** Unrestored backup rows left: the part was edited since the trim (or is gone). */
  skipped: number
  batches: number
}

type Queryable = Pick<pg.Client, 'query'>

const SCANNED_SQL = `
  SELECT count(*)::int AS n
    FROM question_versions v
    JOIN questions q ON q.id = v.question_id AND q.latest_version_no = v.version_no
   WHERE (SELECT count(*) FROM question_parts x WHERE x.question_version_id = v.id) = 1`

interface MatchRow {
  part_id: string
  version_id: string
  question_id: string
  status: string
  subject: string | null
  level: string | null
  en_matched: boolean
}

/** The dry-run read (also the report of an apply, taken before it writes). Read-only. */
export async function findMatches(client: Queryable, sample = DEFAULT_SAMPLE): Promise<Omit<Report, 'mode' | 'batches'>> {
  const scanned = Number(((await client.query<{ n: number }>(SCANNED_SQL)).rows[0] as { n: number }).n)
  const { rows } = await client.query<MatchRow>(
    `SELECT m.part_id::text, m.version_id::text, m.question_id::text, m.status, s.code AS subject, l.code AS level, m.en_matched
       FROM (${MATCH_SQL}) m
       LEFT JOIN subjects s ON s.id = m.subject_id
       LEFT JOIN education_levels l ON l.id = m.level_id
      ORDER BY m.part_id`,
  )
  return summarise(scanned, rows, sample)
}

function summarise(scanned: number, rows: readonly MatchRow[], sample: number): Omit<Report, 'mode' | 'batches'> {
  const byStatus: Record<string, number> = {}
  const cells = new Map<string, { subject: string; level: string; count: number }>()
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    const subject = r.subject ?? '(no subject)'
    const level = r.level ?? '(no level)'
    const key = `${subject}\u0000${level}`
    const cell = cells.get(key) ?? { subject, level, count: 0 }
    cell.count += 1
    cells.set(key, cell)
  }
  return {
    scanned,
    matched: rows.length,
    enMatched: rows.filter((r) => r.en_matched).length,
    byStatus,
    bySubjectLevel: [...cells.values()].sort((a, b) => a.subject.localeCompare(b.subject) || a.level.localeCompare(b.level)),
    sample: rows.slice(0, sample).map((r) => ({ questionId: r.question_id, versionId: r.version_id, partId: r.part_id })),
  }
}

/** Dry run: one read-only transaction; creates and changes nothing. */
export async function dryRun(client: Queryable, options: Pick<Options, 'sample'> = { sample: DEFAULT_SAMPLE }): Promise<Report> {
  await client.query('BEGIN READ ONLY')
  try {
    return { mode: 'dry-run', ...(await findMatches(client, options.sample)), batches: 0 }
  } finally {
    await client.query('ROLLBACK')
  }
}

/** Apply: back up and trim in batches (one transaction each). Reports what was matched before the first write. */
export async function apply(client: Queryable, options: Pick<Options, 'batchSize' | 'sample'> = { batchSize: DEFAULT_BATCH_SIZE, sample: DEFAULT_SAMPLE }, log: (line: string) => void = () => undefined): Promise<Report> {
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1) throw new Error('batch size must be a positive integer')
  await client.query('BEGIN')
  try {
    await client.query(CREATE_BACKUP_SQL)
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  }
  const before = await findMatches(client, options.sample)
  let trimmed = 0
  let batches = 0
  for (;;) {
    await client.query('BEGIN')
    let n: number
    try {
      n = (await client.query(APPLY_BATCH_SQL, [options.batchSize])).rowCount ?? 0
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
    if (n === 0) break
    batches += 1
    trimmed += n
    log(`batch ${String(batches)}: ${String(n)} parts trimmed`)
  }
  return { mode: 'apply', ...before, matched: trimmed, batches }
}

/** Restore: write the old values back from the backup table (only where the trimmed value is still there). */
export async function restore(client: Queryable, options: Pick<Options, 'batchSize'> = { batchSize: DEFAULT_BATCH_SIZE }, log: (line: string) => void = () => undefined): Promise<RestoreReport> {
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1) throw new Error('batch size must be a positive integer')
  const exists = (await client.query<{ t: string | null }>(`SELECT to_regclass('${BACKUP_TABLE}')::text AS t`)).rows[0]?.t
  if (!exists) throw new Error(`backup table ${BACKUP_TABLE} does not exist: nothing to restore`)
  let restored = 0
  let batches = 0
  for (;;) {
    await client.query('BEGIN')
    let n: number
    try {
      n = Number(((await client.query<{ restored: number }>(RESTORE_BATCH_SQL, [options.batchSize])).rows[0] as { restored: number }).restored)
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
    if (n === 0) break
    batches += 1
    restored += n
    log(`batch ${String(batches)}: ${String(n)} parts restored`)
  }
  const skipped = Number(((await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${BACKUP_TABLE} WHERE restored_at IS NULL`)).rows[0] as { n: number }).n)
  return { mode: 'restore', restored, skipped, batches }
}

export function parseArgs(argv: readonly string[]): Options {
  let mode: Mode | null = null
  let batchSize = DEFAULT_BATCH_SIZE
  let sample = DEFAULT_SAMPLE
  const set = (m: Mode): void => {
    if (mode !== null && mode !== m) throw new Error('--dry-run, --apply and --restore exclude each other')
    mode = m
  }
  const positive = (flag: string, value: string | undefined, min: number): number => {
    const n = Number(value)
    if (value === undefined || !Number.isInteger(n) || n < min) throw new Error(`${flag} needs an integer >= ${String(min)}`)
    return n
  }
  for (const arg of argv) {
    if (arg === '--dry-run') set('dry-run')
    else if (arg === '--apply') set('apply')
    else if (arg === '--restore') set('restore')
    else if (arg.startsWith('--batch-size=')) batchSize = positive('--batch-size', arg.slice('--batch-size='.length), 1)
    else if (arg.startsWith('--sample=')) sample = positive('--sample', arg.slice('--sample='.length), 0)
    else throw new Error(`unknown argument ${arg}`)
  }
  return { mode: mode ?? 'dry-run', batchSize, sample }
}

export function formatReport(r: Report | RestoreReport, target = ''): string[] {
  const head = `trim-duplicate-stem mode=${r.mode.toUpperCase()}${target === '' ? '' : ` db=${target}`}`
  if (r.mode === 'restore') return [head, `restored parts: ${String(r.restored)} (${String(r.batches)} batches)`, `skipped (edited since the trim, or gone): ${String(r.skipped)}`]
  const verb = r.mode === 'apply' ? 'trimmed' : 'would trim'
  const lines = [
    head,
    `latest single-leaf versions scanned: ${String(r.scanned)}`,
    `${verb} (BM stem = BM leaf prompt after trim and whitespace collapse): ${String(r.matched)}, of which English pair matched too: ${String(r.enMatched)}`,
    `by status: ${Object.entries(r.byStatus).map(([k, v]) => `${k}=${String(v)}`).join(' ') || '-'}`,
    'by subject x level:',
    ...r.bySubjectLevel.map((c) => `  ${c.subject} ${c.level} ${String(c.count)}`),
    `sample (question_id version_id part_id), max ${String(r.sample.length)}:`,
    ...r.sample.map((s) => `  ${s.questionId} ${s.versionId} ${s.partId}`),
  ]
  if (r.mode === 'apply') lines.push(`batches: ${String(r.batches)}; backup table: ${BACKUP_TABLE}`)
  else lines.push('dry run: nothing was changed. Run with --apply after the report is approved.')
  return lines
}

/** Host and database only (never the user or password). */
const targetOf = (url: string): string => {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`
  } catch {
    return '(unparsed)'
  }
}

async function main(): Promise<number> {
  let options: Options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set.')
    return 2
  }
  const client = new pg.Client({ connectionString: url })
  try {
    await client.connect()
    const log = (line: string): void => console.log(line)
    const report =
      options.mode === 'apply' ? await apply(client, options, log) : options.mode === 'restore' ? await restore(client, options, log) : await dryRun(client, options)
    for (const line of formatReport(report, targetOf(url))) console.log(line)
    return report.mode === 'restore' && report.skipped > 0 ? 1 : 0
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 1
  } finally {
    await client.end().catch(() => undefined)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().then((code) => process.exit(code))
}
