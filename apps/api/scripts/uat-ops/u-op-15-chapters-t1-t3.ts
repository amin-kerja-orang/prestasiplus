/**
 * U-OP-15 chapter counts for S4-T08 (FR-ADM-C01.6, D101): how many Bab each offered subject has in Tingkatan 1, 2 and 3. READ-ONLY and
 * report-only: it creates nothing and has no `--apply`; the chapters are created by an Admin in Kurikulum (ADM), then bulk-mapped (U-OP-07).
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/u-op-15-chapters-t1-t3.ts [--subject <code>]
 *
 * Offered = an active subject linked through `subject_levels` to an active T1, T2 or T3 (the same offered set as API-DSKP-11 `dskpReport` and
 * `bulk-chapter-dry-run.ts`). Per subject x level one line with the Bab counts: all rows, those shown in the tree (`in_tree`), and those
 * in the tree and active (the ones a pupil and the admin tree see). FAIL when an offered pair has 0 shown-and-active Bab (the T2 pupil
 * would see an empty Soalan by Chapter); PASS otherwise. Counts and subject/level codes only.
 * Exit code 0 ok, 1 an offered pair has no Bab, 2 usage or environment error.
 */
import { exitCodeOf, formatLine, isMain, line, openDb, parseUatArgs, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = { name: 'u-op-15-chapters-t1-t3', allowApply: false, flags: { subject: { type: 'string' } } }

/** Tingkatan 1 to 3 (D101). T4 and T5 are loaded from the DSKP extracts (U-OP-01). */
export const LOWER_LEVELS = ['T1', 'T2', 'T3'] as const

/** One offered subject x level with its Bab counts (SQL below). */
export interface ChapterCountRow {
  subject_code: string
  level_code: string
  total: number
  in_tree: number
  active: number
}

export const COUNTS_SQL = `
  SELECT s.code AS subject_code, l.code AS level_code,
         count(c.id)::int AS total,
         count(c.id) FILTER (WHERE c.in_tree)::int AS in_tree,
         count(c.id) FILTER (WHERE c.in_tree AND c.is_active)::int AS active
    FROM subject_levels sl
    JOIN subjects s ON s.id = sl.subject_id AND s.is_active
    JOIN education_levels l ON l.id = sl.education_level_id AND l.is_active AND l.stage <> 'primary' AND l.code = ANY($1::text[])
    LEFT JOIN chapters c ON c.subject_id = s.id AND c.education_level_id = l.id
   WHERE ($2::text IS NULL OR s.code = $2)
   GROUP BY s.id, s.code, s.sort_order, l.id, l.code, l.sort_order
   ORDER BY s.sort_order, s.id, l.sort_order, l.id`

/** Pure: rows -> report lines (one per pair, a summary, and a FAIL when nothing is offered). */
export function chapterLines(rows: readonly ChapterCountRow[]): CheckLine[] {
  if (rows.length === 0) return [line('FAIL', `no active subject is offered at ${LOWER_LEVELS.join(', ')} (subject_levels / education_levels)`)]
  const out: CheckLine[] = rows.map((r) =>
    r.active > 0
      ? line('PASS', `${r.subject_code} ${r.level_code}: ${String(r.active)} Bab (all rows ${String(r.total)}, in tree ${String(r.in_tree)})`)
      : line('FAIL', `${r.subject_code} ${r.level_code}: 0 Bab in the tree and active (all rows ${String(r.total)}, in tree ${String(r.in_tree)}); create them in Kurikulum (C01.6)`),
  )
  const empty = rows.filter((r) => r.active === 0).length
  const subjects = new Set(rows.map((r) => r.subject_code)).size
  out.push(line('INFO', `${String(rows.length)} subject x level pairs for ${String(subjects)} subjects; ${String(rows.length - empty)} with Bab, ${String(empty)} without`))
  return out
}

async function main(): Promise<number> {
  const started = new Date()
  let db: Awaited<ReturnType<typeof openDb>> | undefined
  try {
    const args = parseUatArgs(process.argv.slice(2), SPEC)
    const subject = typeof args.values.subject === 'string' ? args.values.subject.toUpperCase() : null
    db = await openDb()
    const rows = await db.readOnly(async (c) => (await c.query<ChapterCountRow>(COUNTS_SQL, [[...LOWER_LEVELS], subject])).rows)
    const lines = chapterLines(rows)
    for (const l of lines) console.log(formatLine(l))
    console.log(`INFO report written: ${writeReport('u-op-15-chapters-t1-t3', lines, { now: started })}`)
    return exitCodeOf(lines)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  } finally {
    await db?.close()
  }
}

if (isMain(import.meta.url)) void main().then((code) => process.exit(code))
