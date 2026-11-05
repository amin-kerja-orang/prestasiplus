/**
 * U-OP-07 dry-run report for S4-T03 (DM-17, API-DSKP-09): the planning view for the admin's Bab mapping. READ-ONLY and report-only:
 * there is no `--apply`. The bulk write itself is `POST /api/admin/curriculum/questions/bulk-chapter`, used by an Admin in the Studio
 * (content work is the admin's, D110). This script never maps and never suggests a Bab for a question (D89: no auto-mapping).
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/bulk-chapter-dry-run.ts [--subject <code>] [--level <code>]
 *   (--dry-run is accepted and means the default; the npm name `uat:bulk-chapter-dry-run` is added by S4-T08)
 *
 * Per offered Subjek x Tingkatan (an active subject linked through `subject_levels` to an active, non-primary level; the same set as
 * `GET /api/admin/curriculum/chapter-coverage`): the approved LIVE questions (live version approved; `questions.is_active` is NOT a condition, like the API; PKSK questions are left out, like the admin filter) with no Bab, with a
 * Bab, and for each active in-tree Bab of that subject and level how many questions are eligible for it. Eligible is the definition of
 * `bulk-chapter.service.ts`, `overwrite=false`: the live version is approved, its subject and level equal the Bab's, and it has no Bab.
 * That count is the same for every Bab of the pair; it is a count, never a per-question mapping.
 *
 * Report: `.evidence/uat-ops/bulk-chapter-dry-run-<ISO time>.txt` and `.json` (counts and curriculum ids/names only, no personal data).
 * Exit code 0 (INFO lines only), 2 on a usage or environment error.
 */
import { formatLine, isMain, line, openDb, parseUatArgs, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = {
  name: 'bulk-chapter-dry-run',
  allowApply: false,
  flags: { subject: { type: 'string' }, level: { type: 'string' } },
}

/** One offered subject x level (SQL below). */
export interface PairRow {
  subject_id: string
  subject_code: string
  level_id: string
  level_code: string
  approved: number
  with_chapter: number
}

/** One active in-tree Bab. */
export interface ChapterRow {
  id: string
  subject_id: string
  education_level_id: string
  chapter_number: number | null
  name: string | null
}

export interface ChapterPlan {
  chapterId: string
  chapterNumber: number | null
  name: string | null
  /** Unlinked approved questions of the same subject and level that the bulk tool can put in this Bab (overwrite=false). */
  eligible: number
}

export interface PairPlan {
  subject: string
  level: string
  approved: number
  withoutChapter: number
  withChapter: number
  chapters: ChapterPlan[]
}

export interface Plan {
  pairs: PairPlan[]
  totals: { pairs: number; approved: number; withoutChapter: number; withChapter: number; chapters: number }
}

/**
 * Same eligibility as `bulk-chapter.service.ts` (S4-T03, API-DSKP-09), overwrite=false: no `questions.is_active` condition (the card and
 * the contract say "live approved version", and the admin filter has none, so an inactive approved question is matched and mapped), and
 * PKSK questions are excluded (the admin filter `NOT_PKSK_SQL`).
 */
export const PAIRS_SQL = `
SELECT s.id::text AS subject_id, s.code AS subject_code, l.id::text AS level_id, l.code AS level_code,
       a.approved::int AS approved, a.with_chapter::int AS with_chapter
  FROM subject_levels sl
  JOIN subjects s ON s.id = sl.subject_id AND s.is_active
  JOIN education_levels l ON l.id = sl.education_level_id AND l.is_active AND l.stage <> 'primary'
  CROSS JOIN LATERAL (
    SELECT count(*) AS approved, count(v.chapter_id) AS with_chapter
      FROM question_versions v
      JOIN questions q ON q.id = v.question_id AND q.live_version_no = v.version_no
     WHERE v.subject_id = s.id AND v.education_level_id = l.id AND v.status = 'approved'
       AND NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')
  ) a
 WHERE ($1::text IS NULL OR s.code = $1) AND ($2::text IS NULL OR l.code = $2)
 ORDER BY s.sort_order, s.id, l.sort_order, l.id`

export const CHAPTERS_SQL = `
SELECT c.id::text AS id, c.subject_id::text AS subject_id, c.education_level_id::text AS education_level_id,
       c.chapter_number, c.name
  FROM chapters c
  JOIN subjects s ON s.id = c.subject_id
  JOIN education_levels l ON l.id = c.education_level_id
 WHERE c.in_tree AND c.is_active
   AND ($1::text IS NULL OR s.code = $1) AND ($2::text IS NULL OR l.code = $2)
 ORDER BY c.subject_id, c.education_level_id, c.chapter_number NULLS LAST, c.id`

/** Pure: joins the two result sets into the plan. A Bab of a pair that is not offered is not listed (the bulk tool refuses it anyway). */
export function buildPlan(pairs: readonly PairRow[], chapters: readonly ChapterRow[]): Plan {
  const plans = pairs.map((p): PairPlan => {
    const withoutChapter = p.approved - p.with_chapter
    return {
      subject: p.subject_code,
      level: p.level_code,
      approved: p.approved,
      withoutChapter,
      withChapter: p.with_chapter,
      chapters: chapters
        .filter((c) => c.subject_id === p.subject_id && c.education_level_id === p.level_id)
        .map((c) => ({ chapterId: c.id, chapterNumber: c.chapter_number, name: c.name, eligible: withoutChapter })),
    }
  })
  return {
    pairs: plans,
    totals: {
      pairs: plans.length,
      approved: plans.reduce((n, p) => n + p.approved, 0),
      withoutChapter: plans.reduce((n, p) => n + p.withoutChapter, 0),
      withChapter: plans.reduce((n, p) => n + p.withChapter, 0),
      chapters: plans.reduce((n, p) => n + p.chapters.length, 0),
    },
  }
}

/** Pure: the INFO lines (one per subject x level, one per Bab, then the total). */
export function planLines(plan: Plan, filters: { subject?: string; level?: string } = {}): CheckLine[] {
  const out: CheckLine[] = []
  const scope = [filters.subject ? `subject ${filters.subject}` : '', filters.level ? `level ${filters.level}` : ''].filter(Boolean).join(', ')
  if (plan.pairs.length === 0) {
    out.push(line('SKIP', `no offered subject x level${scope ? ` for ${scope}` : ''}`))
    return out
  }
  for (const p of plan.pairs) {
    out.push(
      line(
        'INFO',
        `${p.level} ${p.subject}: approved ${String(p.approved)}, without Bab ${String(p.withoutChapter)}, with Bab ${String(p.withChapter)}, Bab in tree ${String(p.chapters.length)}`,
      ),
    )
    for (const c of p.chapters) {
      const label = `${c.chapterNumber === null ? '' : `Bab ${String(c.chapterNumber)} `}${c.name ?? ''}`.trim()
      out.push(line('INFO', `  ${p.level} ${p.subject} chapter ${c.chapterId}${label ? ` (${label})` : ''}: eligible ${String(c.eligible)}`))
    }
    if (p.chapters.length === 0 && p.withoutChapter > 0) out.push(line('INFO', `  ${p.level} ${p.subject}: no Bab in tree, nothing to map to yet`))
  }
  const t = plan.totals
  out.push(
    line(
      'INFO',
      `total: ${String(t.pairs)} subject x level, approved ${String(t.approved)}, without Bab ${String(t.withoutChapter)}, with Bab ${String(t.withChapter)}, Bab in tree ${String(t.chapters)}`,
    ),
  )
  return out
}

async function main(): Promise<number> {
  const started = new Date()
  let db: Awaited<ReturnType<typeof openDb>> | undefined
  try {
    const args = parseUatArgs(process.argv.slice(2), SPEC)
    const subject = typeof args.values.subject === 'string' ? args.values.subject.toUpperCase() : null
    const level = typeof args.values.level === 'string' ? args.values.level.toUpperCase() : null
    db = await openDb()
    const { pairs, chapters } = await db.readOnly(async (c) => ({
      pairs: (await c.query<PairRow>(PAIRS_SQL, [subject, level])).rows,
      chapters: (await c.query<ChapterRow>(CHAPTERS_SQL, [subject, level])).rows,
    }))
    const plan = buildPlan(pairs, chapters)
    const filters = { ...(subject ? { subject } : {}), ...(level ? { level } : {}) }
    const lines = planLines(plan, filters)
    for (const l of lines) console.log(formatLine(l))
    const opts = { now: started }
    const txt = writeReport('bulk-chapter-dry-run', lines, opts)
    const json = writeReport('bulk-chapter-dry-run', { script: 'bulk-chapter-dry-run', generatedAt: started.toISOString(), dryRun: true, filters, ...plan }, opts)
    console.log(`INFO report written: ${txt}`)
    console.log(`INFO report written: ${json}`)
    return 0
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  } finally {
    await db?.close()
  }
}

if (isMain(import.meta.url)) {
  void main().then((code) => process.exit(code))
}
