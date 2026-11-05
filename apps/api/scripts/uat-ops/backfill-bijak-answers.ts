/**
 * Backfill of past Bijak sittings into `practice_answers` (S5-T15, DM-44). Run by hand by the UAT developer:
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/uat-ops/backfill-bijak-answers.ts            (dry run, writes nothing)
 *   DATABASE_URL=postgresql://... npx tsx scripts/uat-ops/backfill-bijak-answers.ts --apply    (writes)
 *   optional: --limit <n> (attempts to look at), --batch <n> (attempts per page, default 200)
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/uat-ops/backfill-bijak-answers.ts --legacy-mode            (dry run)
 *   DATABASE_URL=postgresql://... npx tsx scripts/uat-ops/backfill-bijak-answers.ts --legacy-mode --apply    (writes)
 *   optional: --batch <n> (rows per batch, default 5000)
 *
 * U-OP-20 `--legacy-mode` runs ALONE (the Bijak step below is not run with it): it gives `practice_answers.mode` to rows
 * written before migration 0181 (the session's mode; 'latih_tubi' for a row without a session). Dry run by default
 * (prints how many rows would be set per mode, writes nothing). `--apply` writes in batches of `id` ranges, each batch
 * its own short statement with `WHERE mode IS NULL`, so a row that already has a mode is never touched and a re-run is a
 * no-op. Re-run it right before part 2's migration 0188 (VALIDATE CONSTRAINT + SET NOT NULL on mode).
 *
 * No route, no auth. Source: closed attempts (`exam_attempts` status submitted / auto_submitted with an
 * `attempt_results` row). One row per answered leaf of `attempt_results.graded.questions[].parts[]`, with the pupil's
 * self-mark (`graded.selfMarks`) applied on top. Idempotent: the same ON CONFLICT key as `AnswerLogPort.record`
 * (`upsertAnswerRow`), so a second run updates and never duplicates.
 *
 * Mode per attempt (master table "Pupil activity -> stored mode", 40): every `exam_attempts` row of V3 is a Bijak paper
 * sitting (`paper_kind` pilihan or jana, exam or latihan) = `simulasi`. Tracking A, Kertas Subjektif, Soalan Berstruktur
 * and Kuiz sittings cannot be told apart in V3 data (no such paper kind in `exam_attempts`; a Kuiz is a practice session
 * and already lives in `practice_answers`), so any other `paper_kind` is skipped with the reason `unmapped_paper_kind`.
 */
import { createPrismaClient, type PrismaClient } from '../../src/db/client'
import { type AnswerMode, type AnswerRow, upsertAnswerRow } from '../../src/modules/practice/answer-log.port'

/** The stored mode of a V3 attempt, or null when the attempt kind is not known to map (skipped and counted). */
export function modeOfAttempt(paperKind: string): AnswerMode | null {
  return paperKind === 'pilihan' || paperKind === 'jana' ? 'simulasi' : null
}

export interface GradedPart {
  partId: string
  marks: number
  awarded: number
  status: string
}
export interface GradedQuestion {
  questionId: string
  attempted?: boolean
  parts: GradedPart[]
}
export type SelfMarks = Record<string, { mark: number } | undefined>

export interface Leaf {
  questionId: string
  partRef: string | null
  isCorrect: boolean
  marksAwarded: number | null
  marksMax: number
}

export type SkipReason = 'blank_part' | 'not_attempted' | 'zero_marks' | 'unmapped_paper_kind' | 'bad_question_id'

/** The answered leaves of one graded result; skipped ones are counted by reason. */
export function leavesOfGraded(questions: readonly GradedQuestion[], selfMarks: SelfMarks, skips: Map<SkipReason, number>): Leaf[] {
  const skip = (r: SkipReason): void => void skips.set(r, (skips.get(r) ?? 0) + 1)
  const out: Leaf[] = []
  for (const q of questions) {
    if (!/^(0|[1-9]\d{0,18})$/.test(String(q.questionId))) {
      skip('bad_question_id')
      continue
    }
    for (const p of q.parts ?? []) {
      // A self-mark makes its question attempted (`applySelfMarks`): read it before the automatic `attempted: false`.
      const self = selfMarks[p.partId]
      if (q.attempted === false && !self) {
        skip('not_attempted')
        continue
      }
      if (p.status === 'kosong' && !self) {
        skip('blank_part')
        continue
      }
      if (!(p.marks > 0)) {
        skip('zero_marks')
        continue
      }
      const pending = p.status === 'belum_dimarkah' && !self
      const awarded = pending ? null : Math.min(p.marks, Math.max(0, self ? self.mark : p.awarded))
      out.push({
        questionId: String(q.questionId),
        partRef: p.partId === String(q.questionId) ? null : p.partId,
        isCorrect: awarded !== null && awarded === p.marks,
        marksAwarded: awarded,
        marksMax: p.marks,
      })
    }
  }
  return out
}

interface AttemptRow {
  id: string
  user_id: string
  paper_kind: string
  is_test: boolean
  started_at: Date
  submitted_at: Date | null
  graded: { questions?: GradedQuestion[]; selfMarks?: SelfMarks }
}

interface Dims {
  versionNo: number | null
  subjectId: string | null
  educationLevelId: string | null
  chapterId: string | null
  topicId: string | null
  difficulty: number | null
  questionType: string | null
}

async function dimsOf(db: PrismaClient, ids: string[]): Promise<Map<string, Dims>> {
  if (ids.length === 0) return new Map()
  const rows = await db.$queryRaw<
    { question_id: string; version_no: number; subject_id: string | null; education_level_id: string | null; chapter_id: string | null; topic_id: string | null; difficulty: number | null; type: string }[]
  >`SELECT q.id::text AS question_id, v.version_no, v.subject_id::text, v.education_level_id::text, v.chapter_id::text, v.topic_id::text,
           CASE WHEN v.difficulty_tp IS NULL THEN NULL ELSE least(5, greatest(1, v.difficulty_tp)) END AS difficulty, v.type
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = coalesce(q.live_version_no, q.latest_version_no)
     WHERE q.id = ANY(${ids.map((i) => BigInt(i))}::bigint[])`
  return new Map(
    rows.map((r) => [
      r.question_id,
      { versionNo: r.version_no, subjectId: r.subject_id, educationLevelId: r.education_level_id, chapterId: r.chapter_id, topicId: r.topic_id, difficulty: r.difficulty, questionType: r.type },
    ]),
  )
}

export interface BackfillReport {
  attempts: number
  rowsByMode: Map<AnswerMode, number>
  skips: Map<SkipReason, number>
  created: number
  updated: number
}

export async function runBackfill(db: PrismaClient, opts: { apply: boolean; limit?: number; batch?: number }): Promise<BackfillReport> {
  const report: BackfillReport = { attempts: 0, rowsByMode: new Map(), skips: new Map(), created: 0, updated: 0 }
  const batch = opts.batch ?? 200
  let after = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const take = opts.limit === undefined ? batch : Math.min(batch, opts.limit - report.attempts)
    if (take <= 0) break
    const attempts = await db.$queryRaw<AttemptRow[]>`
      SELECT a.id::text, a.user_id::text, a.paper_kind, a.is_test, a.started_at, a.submitted_at, r.graded
        FROM exam_attempts a JOIN attempt_results r ON r.attempt_id = a.id
       WHERE a.status IN ('submitted', 'auto_submitted') AND a.id > ${after}::uuid
       ORDER BY a.id LIMIT ${take}::int`
    if (attempts.length === 0) break
    for (const a of attempts) {
      after = a.id
      report.attempts++
      const mode = modeOfAttempt(a.paper_kind)
      if (mode === null) {
        report.skips.set('unmapped_paper_kind', (report.skips.get('unmapped_paper_kind') ?? 0) + 1)
        continue
      }
      const leaves = leavesOfGraded(a.graded?.questions ?? [], a.graded?.selfMarks ?? {}, report.skips)
      const dims = await dimsOf(db, [...new Set(leaves.map((l) => l.questionId))])
      const saved = await db.$queryRaw<{ part_id: string; saved_at: Date }[]>`SELECT part_id, saved_at FROM attempt_answers WHERE attempt_id = ${a.id}::uuid`
      const savedAt = new Map(saved.map((s) => [s.part_id, s.saved_at]))
      const rows: AnswerRow[] = leaves.map((l) => {
        const d = dims.get(l.questionId)
        return {
          userId: a.user_id,
          attemptId: a.id,
          sessionId: null,
          questionId: l.questionId,
          questionVersionNo: d?.versionNo ?? null,
          partRef: l.partRef,
          mode,
          subjectId: d?.subjectId ?? null,
          educationLevelId: d?.educationLevelId ?? null,
          chapterId: d?.chapterId ?? null,
          topicId: d?.topicId ?? null,
          difficulty: d?.difficulty ?? null,
          questionType: d?.questionType ?? null,
          isCorrect: l.isCorrect,
          marksAwarded: l.marksAwarded,
          marksMax: l.marksMax,
          answeredAt: savedAt.get(l.partRef ?? l.questionId) ?? a.submitted_at ?? a.started_at,
          isTest: a.is_test,
        }
      })
      report.rowsByMode.set(mode, (report.rowsByMode.get(mode) ?? 0) + rows.length)
      if (opts.apply && rows.length > 0) {
        await db.$transaction(async (tx) => {
          for (const row of rows) {
            const out = await upsertAnswerRow(tx, row)
            if (out.created) report.created++
            else report.updated++
          }
        })
      }
    }
  }
  return report
}

export interface LegacyModeReport {
  rowsByMode: Map<string, number>
  updated: number
  batches: number
}

/** U-OP-20: set `mode` on rows that have none. Dry run counts per mode; apply updates by `id` range, one statement per batch. */
export async function runLegacyMode(db: PrismaClient, opts: { apply: boolean; batch?: number }): Promise<LegacyModeReport> {
  const report: LegacyModeReport = { rowsByMode: new Map(), updated: 0, batches: 0 }
  const batch = opts.batch ?? 5000
  let after = 0n
  for (;;) {
    const [range] = await db.$queryRaw<{ hi: bigint | null }[]>`
      SELECT max(id) AS hi FROM (SELECT id FROM practice_answers WHERE mode IS NULL AND id > ${after} ORDER BY id LIMIT ${batch}::int) t`
    const hi = range?.hi ?? null
    if (hi === null) break
    if (opts.apply) {
      const rows = await db.$queryRaw<{ mode: string; n: bigint }[]>`
        WITH upd AS (
          UPDATE practice_answers a
             SET mode = coalesce((SELECT s.mode FROM practice_sessions s WHERE s.id = a.session_id), CASE WHEN a.session_id IS NULL THEN 'latih_tubi' END)
           WHERE a.mode IS NULL AND a.id > ${after} AND a.id <= ${hi}
          RETURNING a.mode)
        SELECT mode, count(*) AS n FROM upd WHERE mode IS NOT NULL GROUP BY mode`
      for (const r of rows) {
        report.rowsByMode.set(r.mode, (report.rowsByMode.get(r.mode) ?? 0) + Number(r.n))
        report.updated += Number(r.n)
      }
    } else {
      const rows = await db.$queryRaw<{ mode: string; n: bigint }[]>`
        SELECT coalesce(s.mode, CASE WHEN a.session_id IS NULL THEN 'latih_tubi' END) AS mode, count(*) AS n
          FROM practice_answers a LEFT JOIN practice_sessions s ON s.id = a.session_id
         WHERE a.mode IS NULL AND a.id > ${after} AND a.id <= ${hi}
         GROUP BY 1`
      for (const r of rows) if (r.mode !== null) report.rowsByMode.set(r.mode, (report.rowsByMode.get(r.mode) ?? 0) + Number(r.n))
    }
    report.batches++
    after = hi
  }
  return report
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const num = (flag: string): number | undefined => {
    const i = args.indexOf(flag)
    const n = i >= 0 ? Number.parseInt(args[i + 1] ?? '', 10) : Number.NaN
    return Number.isInteger(n) && n > 0 ? n : undefined
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    process.stderr.write('DATABASE_URL is not set\n')
    process.exit(2)
  }
  const db = createPrismaClient(url)
  try {
    const limit = num('--limit')
    const batch = num('--batch')
    if (args.includes('--legacy-mode')) {
      const legacy = await runLegacyMode(db, { apply, ...(batch !== undefined ? { batch } : {}) })
      process.stdout.write(`${apply ? 'APPLY' : 'DRY RUN (nothing written; pass --apply to write)'} --legacy-mode\n`)
      for (const [m, n] of [...legacy.rowsByMode].sort()) process.stdout.write(`rows ${apply ? 'set' : 'to set'} for mode ${m}: ${String(n)}\n`)
      process.stdout.write(`batches: ${String(legacy.batches)}\n`)
      return
    }
    const report = await runBackfill(db, { apply, ...(limit !== undefined ? { limit } : {}), ...(batch !== undefined ? { batch } : {}) })
    const out = process.stdout
    out.write(`${apply ? 'APPLY' : 'DRY RUN (nothing written; pass --apply to write)'}\nattempts looked at: ${String(report.attempts)}\n`)
    for (const [m, n] of [...report.rowsByMode].sort()) out.write(`rows for mode ${m}: ${String(n)}\n`)
    for (const [r, n] of [...report.skips].sort()) out.write(`skipped (${r}): ${String(n)}\n`)
    if (apply) out.write(`created: ${String(report.created)}, updated: ${String(report.updated)}\n`)
  } finally {
    await db.$disconnect()
  }
}

// Run only when started as a script (the specs import the pure functions).
if (process.argv[1] && /backfill-bijak-answers\.[cm]?[tj]s$/.test(process.argv[1])) {
  main().catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(1)
  })
}
