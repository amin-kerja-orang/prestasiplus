/**
 * U-OP-05 / U-OP-17 regroup report for S4-T04 (QE-08, FR-X1-4f, G7.5): how many questions wait in the regroup work-list, per Subjek x Tingkatan x flag.
 * READ-ONLY and report-only: there is no `--apply`. The detector and the flag write are S1-T07 (`flag-stimulus.ts`, the write path of the question
 * versions); the regroup itself is an Admin's work in the work-list (D110). This script only READS the stored flag and counts.
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/regroup-report.ts [--subject <code>] [--level <code>]
 *   (--dry-run is accepted and means the default; the npm name `uat:regroup-report` is added by S4-T08)
 *
 * Same set as `RegroupService.worklist` (API-Q-13, `questions/regroup.service.ts`): the LIVE version is approved, the question is active, it is not a PKSK
 * question, its level is not primary (Darjah), the stored flag is open (`stimulus_flag IS NOT NULL AND flag_dismissed_at IS NULL`). The totals therefore
 * equal the work-list's `meta.counts` (`byFlag`; `open` = stimulus_missing + figure_only; `done` = excluding flags dismissed). The exclusion predicate is
 * NOT re-implemented: `NOT_FLAGGED_SQL`, `NOT_PKSK_SQL` and `NOT_PRIMARY_LEVEL_SQL` of `questions/learner-visibility.ts` are inlined here as the identical
 * text (this script stays plain `pg`, like `lib.ts`), and `regroup-report.spec.ts` asserts each equals the exported one. A cross-check line (PASS / FAIL)
 * compares the open count of the two excluding flags with the rows `NOT (NOT_FLAGGED_SQL)` selects, so a drift of the flag rule shows up as exit code 1.
 *
 * Report: `.evidence/uat-ops/regroup-report-<ISO time>.txt` and `.json` (counts and curriculum ids/codes only: no question text, no question id, no
 * personal data). Exit code 0 (counts printed, cross-check PASS), 1 (cross-check FAIL), 2 usage or environment error.
 */
import { exitCodeOf, formatLine, isMain, line, openDb, parseUatArgs, UsageError, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = {
  name: 'regroup-report',
  allowApply: false,
  flags: { subject: { type: 'string' }, level: { type: 'string' } },
}

export const FLAGS = ['stimulus_missing', 'figure_only', 'stem_duplicated'] as const
export type StimulusFlagName = (typeof FLAGS)[number]

/** Inlined, identical to `NOT_PKSK_SQL` of questions/learner-visibility.ts (the spec asserts equality). */
export const NOT_PKSK_SQL = `NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')`
/** Inlined, identical to `NOT_PRIMARY_LEVEL_SQL` of questions/learner-visibility.ts. */
export const NOT_PRIMARY_LEVEL_SQL = `(v.education_level_id IS NULL OR NOT EXISTS (SELECT 1 FROM education_levels el WHERE el.id = v.education_level_id AND el.stage = 'primary'))`
/** Inlined, identical to `NOT_FLAGGED_SQL` of questions/learner-visibility.ts: false exactly for an OPEN `stimulus_missing` / `figure_only`. */
export const NOT_FLAGGED_SQL = `(v.stimulus_flag IS NULL OR v.stimulus_flag = 'stem_duplicated' OR v.flag_dismissed_at IS NOT NULL)`

const FROM = `FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
  LEFT JOIN subjects sj ON sj.id = v.subject_id
  LEFT JOIN education_levels lv ON lv.id = v.education_level_id`
/** The base of `RegroupService.worklist` (`base`), plus the optional subject / level code filters ($1, $2). */
const BASE = `v.status = 'approved' AND q.is_active AND ${NOT_PKSK_SQL} AND ${NOT_PRIMARY_LEVEL_SQL} AND v.stimulus_flag IS NOT NULL
   AND ($1::text IS NULL OR sj.code = $1) AND ($2::text IS NULL OR lv.code = $2)`

/** One row per subject x level; open = not dismissed (the work-list's `byFlag`), dismissed_excluding = the work-list's `done`. */
export const CELLS_SQL = `
SELECT v.subject_id::text AS subject_id, sj.code AS subject_code, v.education_level_id::text AS level_id, lv.code AS level_code,
       (count(*) FILTER (WHERE v.stimulus_flag = 'stimulus_missing' AND v.flag_dismissed_at IS NULL))::int AS stimulus_missing,
       (count(*) FILTER (WHERE v.stimulus_flag = 'figure_only' AND v.flag_dismissed_at IS NULL))::int AS figure_only,
       (count(*) FILTER (WHERE v.stimulus_flag = 'stem_duplicated' AND v.flag_dismissed_at IS NULL))::int AS stem_duplicated,
       (count(*) FILTER (WHERE v.stimulus_flag IN ('stimulus_missing', 'figure_only') AND v.flag_dismissed_at IS NOT NULL))::int AS dismissed_excluding
  ${FROM}
 WHERE ${BASE}
 GROUP BY v.subject_id, sj.code, v.education_level_id, lv.code, sj.sort_order, lv.sort_order
 ORDER BY sj.sort_order NULLS LAST, v.subject_id NULLS LAST, lv.sort_order NULLS LAST, v.education_level_id NULLS LAST`

/** The rows the pupil exclusion drops (`NOT NOT_FLAGGED_SQL`): must equal stimulus_missing + figure_only open. */
export const EXCLUDED_SQL = `SELECT count(*)::int AS n ${FROM} WHERE ${BASE} AND NOT ${NOT_FLAGGED_SQL}`

export interface CellRow {
  subject_id: string | null
  subject_code: string | null
  level_id: string | null
  level_code: string | null
  stimulus_missing: number
  figure_only: number
  stem_duplicated: number
  dismissed_excluding: number
}

export interface Report {
  cells: { subjectId: string | null; subject: string; levelId: string | null; level: string; stimulus_missing: number; figure_only: number; stem_duplicated: number; dismissedExcluding: number }[]
  totals: { byFlag: Record<StimulusFlagName, number>; open: number; done: number; cells: number }
}

/** Pure: result rows -> report. `open` = stimulus_missing + figure_only, like the work-list's `counts.open`. */
export function buildReport(rows: readonly CellRow[]): Report {
  const cells = rows.map((r) => ({
    subjectId: r.subject_id,
    subject: r.subject_code ?? 'none',
    levelId: r.level_id,
    level: r.level_code ?? 'none',
    stimulus_missing: r.stimulus_missing,
    figure_only: r.figure_only,
    stem_duplicated: r.stem_duplicated,
    dismissedExcluding: r.dismissed_excluding,
  }))
  const sum = (k: 'stimulus_missing' | 'figure_only' | 'stem_duplicated' | 'dismissedExcluding'): number => cells.reduce((n, c) => n + c[k], 0)
  const byFlag = { stimulus_missing: sum('stimulus_missing'), figure_only: sum('figure_only'), stem_duplicated: sum('stem_duplicated') }
  return { cells, totals: { byFlag, open: byFlag.stimulus_missing + byFlag.figure_only, done: sum('dismissedExcluding'), cells: cells.length } }
}

/** Pure: INFO line per subject x Tingkatan, the totals, and the cross-check (PASS / FAIL). */
export function reportLines(report: Report, excludedByPredicate: number, filters: { subject?: string; level?: string } = {}): CheckLine[] {
  const out: CheckLine[] = []
  const scope = [filters.subject ? `subject ${filters.subject}` : '', filters.level ? `level ${filters.level}` : ''].filter(Boolean).join(', ')
  if (report.cells.length === 0) out.push(line('SKIP', `no open or dismissed flag${scope ? ` for ${scope}` : ''}`))
  for (const c of report.cells) {
    out.push(line('INFO', `${c.level} ${c.subject}: stimulus_missing ${String(c.stimulus_missing)}, figure_only ${String(c.figure_only)}, stem_duplicated ${String(c.stem_duplicated)}, dismissed ${String(c.dismissedExcluding)}`))
  }
  const t = report.totals
  out.push(
    line('INFO', `total: ${String(t.cells)} subject x level, stimulus_missing ${String(t.byFlag.stimulus_missing)}, figure_only ${String(t.byFlag.figure_only)}, stem_duplicated ${String(t.byFlag.stem_duplicated)}, open (work-list) ${String(t.open)}, done ${String(t.done)}`),
  )
  out.push(
    excludedByPredicate === t.open
      ? line('PASS', `open stimulus_missing + figure_only (${String(t.open)}) equals the rows NOT NOT_FLAGGED_SQL excludes`)
      : line('FAIL', `open stimulus_missing + figure_only (${String(t.open)}) differs from the rows NOT NOT_FLAGGED_SQL excludes (${String(excludedByPredicate)})`),
  )
  return out
}

/** The whole run; returns the exit code. `out` receives the printed lines (tests pass a collector). */
export async function run(argv: readonly string[], env: NodeJS.ProcessEnv = process.env, out: (text: string) => void = console.log, root?: string): Promise<number> {
  const started = new Date()
  let db: Awaited<ReturnType<typeof openDb>> | undefined
  try {
    const args = parseUatArgs(argv, SPEC)
    const subject = typeof args.values.subject === 'string' ? args.values.subject.toUpperCase() : null
    const level = typeof args.values.level === 'string' ? args.values.level.toUpperCase() : null
    db = await openDb(env)
    const { rows, excluded } = await db.readOnly(async (c) => ({
      rows: (await c.query<CellRow>(CELLS_SQL, [subject, level])).rows,
      excluded: (await c.query<{ n: number }>(EXCLUDED_SQL, [subject, level])).rows[0]?.n ?? 0,
    }))
    const report = buildReport(rows)
    const filters = { ...(subject ? { subject } : {}), ...(level ? { level } : {}) }
    const lines = reportLines(report, excluded, filters)
    for (const l of lines) out(formatLine(l))
    const opts = { now: started, ...(root ? { root } : {}) }
    const txt = writeReport('regroup-report', lines, opts)
    const json = writeReport('regroup-report', { script: 'regroup-report', generatedAt: started.toISOString(), dryRun: true, filters, ...report }, opts)
    out(`INFO report written: ${txt}`)
    out(`INFO report written: ${json}`)
    return exitCodeOf(lines)
  } catch (e) {
    console.error(e instanceof UsageError || e instanceof Error ? e.message : String(e))
    return 2
  } finally {
    await db?.close()
  }
}

if (isMain(import.meta.url)) {
  void run(process.argv.slice(2)).then((code) => process.exit(code))
}
