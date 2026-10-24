/**
 * The `questions` step of `migrate:questions` (QLOAD): one batch = one transaction = a page of archive questions.
 *
 * Writes, for the NEW questions of the batch only (an existing `(legacy_source, legacy_id)` is "unchanged": a question and
 * its children are always committed together, so existing means complete): `questions`, `question_versions`,
 * `question_parts`, `part_options`, `answer_keys`, `question_tags` and the `etl_id_map` entry. One multi-row statement per
 * table from a JSON parameter; rows are joined by key (legacy id, question id, version id), never by order.
 * Inserts are direct SQL as published (the service publish gate is not a constraint; see the deviation log): the leaf was
 * validated against the contract schema in the transform.
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, toJson } from '../../kit/sql'
import { exclusionOf, transformQuestion, type LegacyQuestion, type QuestionPlan } from '../../transform/question-bank'
import { rejectRow } from '../helpers'
import type { QuestionsContext } from './context'
import { readQuestions } from './source'

const PROGRESS_EVERY = 50

export function questionsStep(q: QuestionsContext): AnyEntityStep {
  const entity = 'questions'
  let batches = 0
  return {
    entity,
    source: q.source,
    extract: (after) => readQuestionsOf(q, after),
    keyOf: (r: LegacyQuestion) => r.id ?? '',
    async load(rows: LegacyQuestion[], ctx: BatchContext): Promise<BatchResult> {
      const cur = await q.curriculum()
      const plans: QuestionPlan[] = []
      let excluded = 0
      for (const row of rows) {
        const legacyId = row.id ?? ''
        assertSurrogateLegacyId(legacyId, 'migrate:questions')
        const ex = exclusionOf(row)
        if (ex) {
          excluded += 1
          q.notes.count(`questions.excluded.${ex.by}.${ex.code}`)
          continue
        }
        const out = transformQuestion(row, cur)
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          continue
        }
        plans.push(out.value)
      }
      const inserted = await insertBatch(ctx, plans)
      const fresh = plans.filter((p) => inserted.has(p.legacyId))
      for (const p of fresh) for (const n of p.notes) q.notes.count(`questions.${n}`)
      batches += 1
      if (batches % PROGRESS_EVERY === 0) q.options.progress?.(`migrate:questions: ${batches} batches processed`)
      return { inserted: fresh.length, unchanged: plans.length - fresh.length, excluded }
    },
  }
}

const readQuestionsOf = (q: QuestionsContext, after: string | null): AsyncGenerator<LegacyQuestion> => readQuestions(q.pool, after, q.pageSize)

/** Inserts the new questions of the batch; returns the legacy ids that were inserted. */
async function insertBatch(ctx: BatchContext, plans: readonly QuestionPlan[]): Promise<Set<string>> {
  const done = new Set<string>()
  if (plans.length === 0) return done
  const db = ctx.db

  const qs = await db.query<{ id: string; legacy_id: string }>(
    `INSERT INTO questions (latest_version_no, live_version_no, is_active, created_at, updated_at, legacy_source, legacy_id)
     SELECT 1, 1, x.is_active, x.created_at::timestamptz, x.updated_at::timestamptz, $2::text, x.legacy_id
     FROM jsonb_to_recordset($1::jsonb) AS x(legacy_id text, is_active boolean, created_at text, updated_at text)
     ON CONFLICT (legacy_source, legacy_id) DO NOTHING
     RETURNING id::text AS id, legacy_id`,
    [toJson(plans.map((p) => ({ legacy_id: p.legacyId, is_active: p.is_active, created_at: p.created_at, updated_at: p.updated_at }))), ctx.source],
  )
  if (qs.rows.length === 0) return done
  const questionOf = new Map(qs.rows.map((r) => [r.legacy_id, r.id]))
  const fresh = plans.filter((p) => questionOf.has(p.legacyId))
  for (const p of fresh) done.add(p.legacyId)

  const versions = await db.query<{ id: string; question_id: string }>(
    `INSERT INTO question_versions (question_id, version_no, status, published_at, type, stem_ms, language, explanation_ms,
        subject_id, education_level_id, chapter_id, topic_id, form_origin, difficulty_tp, rights_status, import_issues, created_at, updated_at)
     SELECT x.question_id, 1, 'published', x.published_at::timestamptz, 'mcq', x.stem, 'ms', x.explanation,
        x.subject_id, x.education_level_id, x.chapter_id, x.topic_id, x.form_origin, x.difficulty_tp, 'unclear', x.import_issues,
        x.created_at::timestamptz, x.updated_at::timestamptz
     FROM jsonb_to_recordset($1::jsonb) AS x(question_id bigint, published_at text, stem text, explanation text, subject_id bigint,
        education_level_id bigint, chapter_id bigint, topic_id bigint, form_origin text, difficulty_tp smallint, import_issues jsonb,
        created_at text, updated_at text)
     RETURNING id::text AS id, question_id::text AS question_id`,
    [toJson(fresh.map((p) => ({
      question_id: questionOf.get(p.legacyId), published_at: p.published_at, stem: p.stem, explanation: p.explanation,
      subject_id: p.subject_id, education_level_id: p.education_level_id, chapter_id: p.chapter_id, topic_id: p.topic_id,
      form_origin: p.form_origin, difficulty_tp: p.difficulty_tp, import_issues: p.import_issues, created_at: p.created_at, updated_at: p.updated_at,
    })))],
  )
  const versionOf = new Map(versions.rows.map((r) => [r.question_id, r.id]))

  const parts = await db.query<{ id: string; question_version_id: string }>(
    `INSERT INTO question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms, marks, mode)
     SELECT x.vid, NULL, 1, 1, '1', x.prompt, 1, 'mcq'
     FROM jsonb_to_recordset($1::jsonb) AS x(vid bigint, prompt text)
     RETURNING id::text AS id, question_version_id::text AS question_version_id`,
    [toJson(fresh.map((p) => ({ vid: versionOf.get(questionOf.get(p.legacyId) as string), prompt: p.stem })))],
  )
  const partOf = new Map(parts.rows.map((r) => [r.question_version_id, r.id]))
  const partFor = (p: QuestionPlan): string => partOf.get(versionOf.get(questionOf.get(p.legacyId) as string) as string) as string

  await db.query(
    `INSERT INTO part_options (part_id, label, body_ms, position)
     SELECT x.part_id, x.label, x.body, x.position FROM jsonb_to_recordset($1::jsonb) AS x(part_id bigint, label text, body text, position smallint)`,
    [toJson(fresh.flatMap((p) => p.options.map((o) => ({ part_id: partFor(p), label: o.label, body: o.body, position: o.position }))))],
  )
  await db.query(
    `INSERT INTO answer_keys (part_id, kind, content)
     SELECT x.part_id, 'option', x.content FROM jsonb_to_recordset($1::jsonb) AS x(part_id bigint, content jsonb)`,
    [toJson(fresh.map((p) => ({ part_id: partFor(p), content: { kind: 'option', correct: p.correct } })))],
  )
  const pooled = fresh.filter((p) => p.spm_pool)
  if (pooled.length > 0) {
    await db.query(
      `INSERT INTO question_tags (question_id, kind, code) SELECT x.question_id, 'pool', 'spm' FROM jsonb_to_recordset($1::jsonb) AS x(question_id bigint)`,
      [toJson(pooled.map((p) => ({ question_id: questionOf.get(p.legacyId) })))],
    )
  }
  await ctx.idMap.registerMany('questions', fresh.map((p) => [p.legacyId, questionOf.get(p.legacyId) as string] as const))
  return done
}
