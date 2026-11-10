/**
 * Step of the canonical-only loader (T-B9-7): `archive_cloud.exam_questions` that have NO `legacy_canonical_map` row (not the
 * projection of a legacy question or structured question), with their parts, options, keys and stimulus links. No double loading:
 * the mapped ones stay the legacy rows (counted in `canonical.mapped_to_legacy`). Stimuli are linked only when the stimulus pass
 * has put them in `etl_id_map('question_stimuli')` under `s:<stimuli.id>` (otherwise the question loads without them, counted).
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA, columnNames, findTable, STAGING_SCHEMA } from '../../ddl/spec'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, quoteIdent } from '../../kit/sql'
import type { Staged } from '../../transform/common'
import { rejectRow } from '../helpers'
import { insertQuestionTrees, type QuestionTreePlan } from './bank-writer'
import { transformCanonical, type CanonicalPart, type CanonicalQuestion } from './canonical-plan'
import type { QuestionsContext } from './context'

const A = quoteIdent(ARCHIVE_SCHEMA)
const S = quoteIdent(STAGING_SCHEMA)

function selectList(table: string, alias: string): string {
  const spec = findTable(table)
  if (!spec || spec.group !== 'archive') throw new RangeError(`Table "${table}" is not an archive table.`)
  return columnNames(spec).map((c) => `${alias}.${quoteIdent(c)}::text AS ${quoteIdent(c)}`).join(', ')
}

const NOT_PROJECTED = `NOT EXISTS (SELECT 1 FROM ${A}."legacy_canonical_map" m WHERE m."canonical_type" = 'exam_question' AND m."canonical_id" = eq."id")`

async function* readCanonical(pool: pg.Pool, afterKey: string | null, pageSize: number): AsyncGenerator<CanonicalQuestion> {
  const questionsSql = `SELECT ${selectList('exam_questions', 'eq')}, qs."slug"::text AS status_slug, coalesce(ep."subject_id", sp."subject_id")::text AS subject_ref
    FROM ${A}."exam_questions" eq
    LEFT JOIN ${S}."question_statuses" qs ON qs."id" = eq."status_id"
    LEFT JOIN ${A}."exam_papers" ep ON ep."id" = eq."exam_paper_id"
    LEFT JOIN ${A}."source_papers" sp ON sp."id" = eq."source_paper_id"
    WHERE ($1::bigint IS NULL OR eq."id" > $1::bigint) AND ${NOT_PROJECTED}
    ORDER BY eq."id" LIMIT $2`
  const partsSql = `SELECT ${selectList('question_parts', 'p')}, m."slug"::text AS mode_slug
    FROM ${A}."question_parts" p LEFT JOIN ${S}."answer_modes" m ON m."id" = p."answer_mode_id"
    WHERE p."exam_question_id" = ANY($1::bigint[]) ORDER BY p."exam_question_id", p."position", p."id"`
  const optionsSql = `SELECT ${selectList('part_options', 'o')} FROM ${A}."part_options" o WHERE o."question_part_id" = ANY($1::bigint[]) ORDER BY o."question_part_id", o."position", o."id"`
  const keysSql = `SELECT DISTINCT ON (k."question_part_id") k."question_part_id"::text AS question_part_id, kk."slug"::text AS key_kind, k."content"::text AS key_content
    FROM ${A}."part_answer_keys" k LEFT JOIN ${S}."answer_key_kinds" kk ON kk."id" = k."answer_key_kind_id"
    WHERE k."question_part_id" = ANY($1::bigint[]) ORDER BY k."question_part_id", k."id"`
  const stimuliSql = `SELECT "exam_question_id"::text AS exam_question_id, "stimulus_id"::text AS stimulus_id FROM ${A}."question_stimulus"
    WHERE "exam_question_id" = ANY($1::bigint[]) ORDER BY "exam_question_id", "position", "id"`
  let after = afterKey
  for (;;) {
    const page = await pool.query<Record<string, string | null>>(questionsSql, [after, pageSize])
    const ids = page.rows.map((r) => r.id as string)
    const partsBy = new Map<string, Record<string, string | null>[]>()
    const optionsBy = new Map<string, Staged[]>()
    const keyBy = new Map<string, { key_kind: string | null; key_content: string | null }>()
    const stimuliBy = new Map<string, string[]>()
    if (ids.length > 0) {
      const parts = await pool.query<Record<string, string | null>>(partsSql, [ids])
      for (const p of parts.rows) partsBy.set(p.exam_question_id as string, [...(partsBy.get(p.exam_question_id as string) ?? []), p])
      const partIds = parts.rows.map((p) => p.id as string)
      if (partIds.length > 0) {
        for (const o of (await pool.query<Record<string, string | null>>(optionsSql, [partIds])).rows) {
          optionsBy.set(o.question_part_id as string, [...(optionsBy.get(o.question_part_id as string) ?? []), o])
        }
        for (const k of (await pool.query<{ question_part_id: string; key_kind: string | null; key_content: string | null }>(keysSql, [partIds])).rows) {
          keyBy.set(k.question_part_id, { key_kind: k.key_kind, key_content: k.key_content })
        }
      }
      for (const s of (await pool.query<{ exam_question_id: string; stimulus_id: string }>(stimuliSql, [ids])).rows) {
        stimuliBy.set(s.exam_question_id, [...(stimuliBy.get(s.exam_question_id) ?? []), s.stimulus_id])
      }
    }
    for (const row of page.rows) {
      const parts = (partsBy.get(row.id as string) ?? []).map(
        (p) => ({ ...p, options: optionsBy.get(p.id as string) ?? [], ...(keyBy.get(p.id as string) ?? { key_kind: null, key_content: null }) }) as unknown as CanonicalPart,
      )
      yield { ...row, parts, stimulus_ids: stimuliBy.get(row.id as string) ?? [] } as unknown as CanonicalQuestion
    }
    if (page.rows.length < pageSize) return
    after = page.rows[page.rows.length - 1]?.id ?? null
  }
}

export function canonicalStep(q: QuestionsContext): AnyEntityStep {
  const entity = 'exam_questions'
  let counted = false
  return {
    entity,
    source: q.source,
    extract: (after) => readCanonical(q.pool, after, q.pageSize),
    keyOf: (r: CanonicalQuestion) => r.id ?? '',
    async load(rows: CanonicalQuestion[], ctx: BatchContext): Promise<BatchResult> {
      if (!counted) {
        counted = true
        const res = await ctx.db.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM ${A}."legacy_canonical_map" WHERE "canonical_type" = 'exam_question'`,
        )
        q.notes.count('canonical.mapped_to_legacy', Number(res.rows[0]?.n ?? 0))
      }
      const cur = await q.curriculum()
      const stimulusIds = rows.flatMap((r) => r.stimulus_ids.map((id) => `s:${id}`))
      const stimulusMap = await ctx.idMap.resolveMany('question_stimuli', stimulusIds)
      const stimulusOf = new Map([...stimulusMap].map(([k, v]) => [k.slice(2), v]))
      const plans: QuestionTreePlan[] = []
      for (const row of rows) {
        assertSurrogateLegacyId(row.id ?? '', 'migrate:structured')
        const out = transformCanonical(row, cur, stimulusOf)
        if (!out.ok) rejectRow(ctx, entity, row.id ?? '', out.reject)
        else plans.push(out.value)
      }
      const { fresh } = await insertQuestionTrees(ctx, plans)
      for (const p of fresh) for (const n of p.notes) q.notes.count(`canonical.${n}`)
      for (const p of fresh) q.notes.count(`canonical.status.${p.status}`)
      return { inserted: fresh.length, unchanged: plans.length - fresh.length }
    },
  }
}
