/**
 * Exam step of `migrate:activity` (BE-29, LEAD Q4): `exam_attempts` with its `attempt_results` row in the same batch.
 *
 * Only the header and the score are migrated. The extract below names its columns on purpose: the served
 * composition, the section selections and every part-level answer or grading column of the source are never
 * selected, so no free text can reach the migration (card AC2). The v2 columns without a .cloud source carry the
 * documented sentinels of `transform/exam.ts`.
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA, STAGING_SCHEMA } from '../../ddl/spec'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { quoteIdent, toJson } from '../../kit/sql'
import { upsertByLegacy, type LegacyRow } from '../../kit/upsert'
import { rejectRow } from '../helpers'
import { distinctValues, resolveFk, type StagedRow } from '../source'
import { EXAM_ATTEMPT_COLUMNS, snapshotTitle, transformExamAttempt, type ExamResultValues } from '../../transform/exam'
import type { ActivityContext } from './context'
import { idOf } from './wallet-steps'

/** Pages of `exam_attempts` with only the header and score columns, ascending by id after `afterKey`. */
export async function* readExamAttempts(pool: pg.Pool, afterKey: string | null, pageSize: number): AsyncGenerator<StagedRow> {
  const from = `${quoteIdent(STAGING_SCHEMA)}.${quoteIdent('exam_attempts')}`
  let after = afterKey
  for (;;) {
    const res = await pool.query<StagedRow>(
      // `t."id"` is the bigint column; a bare `ORDER BY "id"` would bind to the text output alias of the same name.
      `SELECT t."id"::text AS "id", t."user_id"::text AS "user_id", t."exam_paper_id"::text AS "exam_paper_id",
              t."mode"::text AS "mode", t."status"::text AS "status", t."score"::text AS "score", t."max_score"::text AS "max_score",
              t."section_scores"::text AS "section_scores", t."created_at"::text AS "created_at", t."updated_at"::text AS "updated_at"
       FROM ${from} t WHERE ($1::bigint IS NULL OR t."id" > $1::bigint) ORDER BY t."id" LIMIT $2`,
      [after, pageSize],
    )
    for (const row of res.rows) yield row
    if (res.rows.length < pageSize) return
    after = res.rows[res.rows.length - 1]?.id ?? null
  }
}

/** `paper id -> snapshot title` from the archived papers (title text of a public paper, no personal data). */
async function paperTitles(pool: pg.Pool, paperIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (paperIds.length === 0) return out
  const a = quoteIdent(ARCHIVE_SCHEMA)
  const res = await pool.query<{ id: string; title: string | null; year: string | null }>(
    `SELECT ep.id::text AS id, ep.title::text AS title, sp.year::text AS year
     FROM ${a}."exam_papers" ep LEFT JOIN ${a}."source_papers" sp ON sp.id = ep.source_paper_id
     WHERE ep.id = ANY($1::bigint[])`,
    [paperIds.filter((id) => /^\d{1,18}$/.test(id))],
  )
  for (const r of res.rows) out.set(r.id, snapshotTitle(r.title, r.year))
  return out
}

/** Writes the results of the batch; a row whose score and maximum are unchanged is left alone (idempotent). */
async function upsertResults(ctx: BatchContext, results: { attempt_id: string; r: ExamResultValues }[]): Promise<void> {
  if (results.length === 0) return
  await ctx.db.query(
    `INSERT INTO attempt_results (attempt_id, score, max_score, provisional, pending_review, coins, points, graded, section_scores)
     SELECT x.attempt_id, x.score, x.max_score, false, 0, NULL, NULL, '{"sections":[],"questions":[]}'::jsonb, x.section_scores
     FROM jsonb_to_recordset($1::jsonb) AS x(attempt_id uuid, score numeric, max_score numeric, section_scores jsonb)
     ON CONFLICT (attempt_id) DO UPDATE
       SET score = EXCLUDED.score, max_score = EXCLUDED.max_score, section_scores = EXCLUDED.section_scores, updated_at = now()
       WHERE (attempt_results.score, attempt_results.max_score, attempt_results.section_scores)
             IS DISTINCT FROM (EXCLUDED.score, EXCLUDED.max_score, EXCLUDED.section_scores)`,
    [toJson(results.map((x) => ({ attempt_id: x.attempt_id, score: x.r.score, max_score: x.r.max_score, section_scores: x.r.section_scores })))],
  )
}

export function examAttemptsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'exam_attempts'
  return {
    entity,
    source: a.source,
    extract: (after) => readExamAttempts(a.pool, after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      const titles = await paperTitles(a.pool, distinctValues(rows, 'exam_paper_id'))
      const items: LegacyRow[] = []
      const resultOf = new Map<string, ExamResultValues>()
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformExamAttempt(row, {
          userId: resolveFk(row.user_id, users) ?? undefined,
          paperTitle: titles.get((row.exam_paper_id ?? '').trim()) ?? null,
        })
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          continue
        }
        items.push({ legacyId, values: out.value.attempt as unknown as Record<string, unknown> })
        if (out.value.result) resultOf.set(legacyId, out.value.result)
        else a.notes.count('exam_attempts.no_result')
      }
      if (items.length === 0) return { inserted: 0, updated: 0, unchanged: 0 }
      const res = await upsertByLegacy(ctx.db, { table: 'exam_attempts', source: ctx.source, columns: EXAM_ATTEMPT_COLUMNS, rows: items })
      for (const legacyId of res.duplicates) rejectRow(ctx, entity, legacyId, { reason: 'DUPLICATE_KEY', column: 'id' })
      const written: { attempt_id: string; r: ExamResultValues }[] = []
      for (const [legacyId, r] of resultOf) {
        const id = res.ids.get(legacyId)
        if (id !== undefined) written.push({ attempt_id: id, r })
      }
      await upsertResults(ctx, written)
      return { inserted: res.inserted, updated: res.updated, unchanged: res.unchanged }
    },
  }
}
