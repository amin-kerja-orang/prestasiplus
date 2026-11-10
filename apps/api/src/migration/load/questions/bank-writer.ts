/**
 * Generic writer of planned question trees (T-B9-6, T-B9-7): the shared insert path of the structured, subjective and
 * canonical-only loaders. One call = the batch's transaction. For each NEW question (existing means complete, see below) it
 * writes `questions`, one `question_versions` row (version 1, any status), the part tree (depth 1 to 3), `part_options`,
 * `answer_keys`, the optional SPM pool tag, the own stimulus links and the `etl_id_map` entry. One multi-row statement per
 * table from a JSON parameter; rows are joined by key (version id, parent part id, position), never by order, except the
 * question ids, which are allocated from the identity sequence first so the plans and the rows share one id.
 *
 * "Existing" (design 11 rule 1): a plan is skipped when its id-map entry points at a question that still exists, or, for a plan
 * with a `legacyId` (the `questions(legacy_source, legacy_id)` pair of the legacy bank), when that pair exists. A dangling
 * id-map row (an admin deleted the target) is deleted and the plan is created again.
 */
import type pg from 'pg'

import type { BatchContext } from '../../kit/runner'
import { toJson } from '../../kit/sql'

export interface LeafPlan {
  kind: 'leaf'
  label: string
  prompt: string
  marks: number
  mode: string
  options?: { label: string; body: string | null }[]
  /** The answer key content (`content.kind` is the `answer_keys.kind`). */
  key: Record<string, unknown>
  modeConfig?: Record<string, unknown> | null
  wordMax?: number | null
}

export interface BranchPlan {
  kind: 'branch'
  label: string
  prompt: string
  children: NodePlan[]
}

export type NodePlan = LeafPlan | BranchPlan

export type VersionStatus = 'draft' | 'review' | 'approved' | 'archived'

export interface IssuePlan {
  code: string
  target: string
  label?: string
  path?: string
  kind?: string
}

export interface QuestionTreePlan {
  /** `etl_id_map` entity and key of the source row. */
  idEntity: string
  idKey: string
  /** The `questions.legacy_id` of the cloud pair (legacy bank rows); null for rows that live only in the id map. */
  legacyId: string | null
  type: string
  status: VersionStatus
  is_active: boolean
  created_at: string
  updated_at: string
  subject_id: string | null
  education_level_id: string | null
  chapter_id: string | null
  topic_id: string | null
  form_origin: 't1_t3' | 't4' | 't5'
  difficulty_tp: number | null
  kbat: string | null
  number_label: string | null
  stem: string
  explanation: string | null
  declared_marks: number | null
  rejection_reason: string | null
  import_issues: IssuePlan[] | null
  created_by_id: string | null
  spm_pool: boolean
  /** Extra tags of the question (`question_tags`), e.g. the PKSK domain and level; the SPM pool tag is `spm_pool`. */
  tags?: { kind: string; code: string }[]
  tree: NodePlan[]
  /** Own stimuli of the version (`question_version_stimuli`), by `stimuli.id`, position 1..n. */
  stimulusIds?: string[]
  notes: string[]
}

type Db = pg.PoolClient

interface PartRow {
  vid: string
  parent: string | null
  position: number
  depth: number
  label: string
  prompt: string
  marks: number | null
  mode: string | null
  mode_config: Record<string, unknown> | null
  word_max: number | null
  node: NodePlan
}

/** The ids of the plans that already exist as a question (a dangling id-map row is removed on the way). */
async function existingKeys(ctx: BatchContext, plans: readonly QuestionTreePlan[]): Promise<Set<string>> {
  const found = new Set<string>()
  const byEntity = new Map<string, QuestionTreePlan[]>()
  for (const p of plans) byEntity.set(p.idEntity, [...(byEntity.get(p.idEntity) ?? []), p])
  for (const [entity, list] of byEntity) {
    const keys = list.map((p) => p.idKey)
    const live = await ctx.db.query<{ legacy_id: string }>(
      `SELECT m.legacy_id FROM etl_id_map m JOIN questions q ON q.id = m.new_id::bigint
        WHERE m.legacy_source = $1 AND m.entity = $2 AND m.legacy_id = ANY($3::text[])`,
      [ctx.source, entity, keys],
    )
    for (const r of live.rows) found.add(`${entity}\u0000${r.legacy_id}`)
    await ctx.db.query(
      `DELETE FROM etl_id_map m WHERE m.legacy_source = $1 AND m.entity = $2 AND m.legacy_id = ANY($3::text[])
          AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = m.new_id::bigint)`,
      [ctx.source, entity, keys],
    )
    const pairs = list.filter((p) => p.legacyId !== null).map((p) => p.legacyId as string)
    if (pairs.length > 0) {
      const have = await ctx.db.query<{ legacy_id: string }>(
        `SELECT legacy_id FROM questions WHERE legacy_source = $1 AND legacy_id = ANY($2::text[])`,
        [ctx.source, pairs],
      )
      const haveSet = new Set(have.rows.map((r) => r.legacy_id))
      for (const p of list) if (p.legacyId !== null && haveSet.has(p.legacyId)) found.add(`${entity}\u0000${p.idKey}`)
    }
  }
  return found
}

const keyOf = (p: QuestionTreePlan): string => `${p.idEntity}\u0000${p.idKey}`

/** Inserts the plans that do not exist yet. Returns the plans that were inserted and the question id of every plan (new or existing). */
export async function insertQuestionTrees(
  ctx: BatchContext,
  plans: readonly QuestionTreePlan[],
): Promise<{ fresh: QuestionTreePlan[]; questionIds: Map<string, string> }> {
  const questionIds = new Map<string, string>()
  if (plans.length === 0) return { fresh: [], questionIds }
  const db: Db = ctx.db
  const exists = await existingKeys(ctx, plans)
  const fresh = plans.filter((p) => !exists.has(keyOf(p)))

  // Question ids of the plans that already existed, so the caller can link to them.
  const known = plans.filter((p) => exists.has(keyOf(p)))
  for (const p of known) {
    const res = await db.query<{ id: string }>(
      p.legacyId !== null
        ? `SELECT id::text AS id FROM questions WHERE legacy_source = $1 AND legacy_id = $2`
        : `SELECT new_id AS id FROM etl_id_map WHERE legacy_source = $1 AND entity = $3 AND legacy_id = $2`,
      p.legacyId !== null ? [ctx.source, p.legacyId] : [ctx.source, p.idKey, p.idEntity],
    )
    const id = res.rows[0]?.id
    if (id !== undefined) questionIds.set(keyOf(p), id)
  }
  if (fresh.length === 0) return { fresh, questionIds }

  const alloc = await db.query<{ id: string }>(
    `SELECT nextval(pg_get_serial_sequence('questions', 'id'))::text AS id FROM generate_series(1, $1::int)`,
    [fresh.length],
  )
  fresh.forEach((p, i) => questionIds.set(keyOf(p), (alloc.rows[i] as { id: string }).id))
  const qid = (p: QuestionTreePlan): string => questionIds.get(keyOf(p)) as string

  await db.query(
    `INSERT INTO questions (id, created_by_id, latest_version_no, live_version_no, is_active, created_at, updated_at, legacy_source, legacy_id)
     OVERRIDING SYSTEM VALUE
     SELECT x.id, x.created_by_id, 1, CASE WHEN x.approved THEN 1 ELSE NULL END, x.is_active, x.created_at::timestamptz, x.updated_at::timestamptz,
            CASE WHEN x.legacy_id IS NULL THEN NULL ELSE $2::text END, x.legacy_id
     FROM jsonb_to_recordset($1::jsonb) AS x(id bigint, created_by_id bigint, approved boolean, is_active boolean, created_at text, updated_at text, legacy_id text)`,
    [
      toJson(fresh.map((p) => ({
        id: qid(p), created_by_id: p.created_by_id, approved: p.status === 'approved', is_active: p.is_active,
        created_at: p.created_at, updated_at: p.updated_at, legacy_id: p.legacyId,
      }))),
      ctx.source,
    ],
  )

  const versions = await db.query<{ id: string; question_id: string }>(
    `INSERT INTO question_versions (question_id, version_no, status, published_at, type, stem_ms, number_label, language, explanation_ms,
        subject_id, education_level_id, chapter_id, topic_id, form_origin, difficulty_tp, kbat, declared_marks, rejection_reason,
        contributor_id, rights_status, import_issues, created_at, updated_at)
     SELECT x.question_id, 1, x.status, CASE WHEN x.status = 'approved' THEN x.updated_at::timestamptz ELSE NULL END, x.type, x.stem, x.number_label, 'ms', x.explanation,
        x.subject_id, x.education_level_id, x.chapter_id, x.topic_id, x.form_origin, x.difficulty_tp, x.kbat, x.declared_marks, x.rejection_reason,
        x.contributor_id, 'unclear', x.import_issues, x.created_at::timestamptz, x.updated_at::timestamptz
     FROM jsonb_to_recordset($1::jsonb) AS x(question_id bigint, status text, type text, stem text, number_label text, explanation text,
        subject_id bigint, education_level_id bigint, chapter_id bigint, topic_id bigint, form_origin text, difficulty_tp smallint, kbat text,
        declared_marks smallint, rejection_reason text, contributor_id bigint, import_issues jsonb, created_at text, updated_at text)
     RETURNING id::text AS id, question_id::text AS question_id`,
    [
      toJson(fresh.map((p) => ({
        question_id: qid(p), status: p.status, type: p.type, stem: p.stem, number_label: p.number_label, explanation: p.explanation,
        subject_id: p.subject_id, education_level_id: p.education_level_id, chapter_id: p.chapter_id, topic_id: p.topic_id,
        form_origin: p.form_origin, difficulty_tp: p.difficulty_tp, kbat: p.kbat, declared_marks: p.declared_marks,
        rejection_reason: p.rejection_reason, contributor_id: p.created_by_id, import_issues: p.import_issues,
        created_at: p.created_at, updated_at: p.updated_at,
      }))),
    ],
  )
  const versionOf = new Map(versions.rows.map((r) => [r.question_id, r.id]))
  const vid = (p: QuestionTreePlan): string => versionOf.get(qid(p)) as string

  // Parts, one depth at a time: a child needs the id of its parent.
  const partIdOf = new Map<NodePlan, string>()
  const optionRows: { part_id: string; label: string; body: string | null; position: number }[] = []
  const keyRows: { part_id: string; kind: string; content: Record<string, unknown> }[] = []
  let level: PartRow[] = fresh.flatMap((p) => p.tree.map((node, i) => rowOf(vid(p), null, i + 1, 1, node)))
  while (level.length > 0) {
    const res = await db.query<{ id: string; question_version_id: string; parent_part_id: string | null; position: number }>(
      `INSERT INTO question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms, marks, mode, mode_config, word_max)
       SELECT x.vid, x.parent, x.position, x.depth, x.label, x.prompt, x.marks, x.mode, x.mode_config, x.word_max
       FROM jsonb_to_recordset($1::jsonb) AS x(vid bigint, parent bigint, position smallint, depth smallint, label text, prompt text, marks smallint, mode text, mode_config jsonb, word_max int)
       RETURNING id::text AS id, question_version_id::text AS question_version_id, parent_part_id::text AS parent_part_id, position::int AS position`,
      [toJson(level.map((r) => ({ vid: r.vid, parent: r.parent, position: r.position, depth: r.depth, label: r.label, prompt: r.prompt, marks: r.marks, mode: r.mode, mode_config: r.mode_config, word_max: r.word_max })))],
    )
    const byKey = new Map(res.rows.map((r) => [`${r.question_version_id}|${r.parent_part_id ?? 0}|${r.position}`, r.id]))
    const next: PartRow[] = []
    for (const row of level) {
      const id = byKey.get(`${row.vid}|${row.parent ?? 0}|${row.position}`) as string
      partIdOf.set(row.node, id)
      if (row.node.kind === 'leaf') {
        const leaf = row.node
        for (const [i, o] of (leaf.options ?? []).entries()) optionRows.push({ part_id: id, label: o.label, body: o.body, position: i + 1 })
        keyRows.push({ part_id: id, kind: String(leaf.key.kind), content: leaf.key })
      } else {
        row.node.children.forEach((child, i) => next.push(rowOf(row.vid, id, i + 1, row.depth + 1, child)))
      }
    }
    level = next
  }
  if (optionRows.length > 0) {
    await db.query(
      `INSERT INTO part_options (part_id, label, body_ms, position)
       SELECT x.part_id, x.label, x.body, x.position FROM jsonb_to_recordset($1::jsonb) AS x(part_id bigint, label text, body text, position smallint)`,
      [toJson(optionRows)],
    )
  }
  if (keyRows.length > 0) {
    await db.query(
      `INSERT INTO answer_keys (part_id, kind, content) SELECT x.part_id, x.kind, x.content FROM jsonb_to_recordset($1::jsonb) AS x(part_id bigint, kind text, content jsonb)`,
      [toJson(keyRows)],
    )
  }
  const pooled = fresh.filter((p) => p.spm_pool)
  if (pooled.length > 0) {
    await db.query(
      `INSERT INTO question_tags (question_id, kind, code) SELECT x.question_id, 'pool', 'spm' FROM jsonb_to_recordset($1::jsonb) AS x(question_id bigint)
       ON CONFLICT DO NOTHING`,
      [toJson(pooled.map((p) => ({ question_id: qid(p) })))],
    )
  }
  const tagRows = fresh.flatMap((p) => (p.tags ?? []).map((t) => ({ question_id: qid(p), kind: t.kind, code: t.code })))
  if (tagRows.length > 0) {
    await db.query(
      `INSERT INTO question_tags (question_id, kind, code) SELECT x.question_id, x.kind, x.code FROM jsonb_to_recordset($1::jsonb) AS x(question_id bigint, kind text, code text)
       ON CONFLICT DO NOTHING`,
      [toJson(tagRows)],
    )
  }
  const links = fresh.flatMap((p) => (p.stimulusIds ?? []).map((sid, i) => ({ version_id: vid(p), stimulus_id: sid, position: i + 1 })))
  if (links.length > 0) {
    await db.query(
      `INSERT INTO question_version_stimuli (question_version_id, stimulus_id, position)
       SELECT x.version_id, x.stimulus_id, x.position FROM jsonb_to_recordset($1::jsonb) AS x(version_id bigint, stimulus_id bigint, position smallint)`,
      [toJson(links)],
    )
  }
  const byEntity = new Map<string, (readonly [string, string])[]>()
  for (const p of fresh) byEntity.set(p.idEntity, [...(byEntity.get(p.idEntity) ?? []), [p.idKey, qid(p)] as const])
  for (const [entity, pairs] of byEntity) await ctx.idMap.registerMany(entity, pairs)
  return { fresh, questionIds }
}

function rowOf(vid: string, parent: string | null, position: number, depth: number, node: NodePlan): PartRow {
  return node.kind === 'leaf'
    ? { vid, parent, position, depth, label: node.label, prompt: node.prompt, marks: node.marks, mode: node.mode, mode_config: node.modeConfig ?? null, word_max: node.wordMax ?? null, node }
    : { vid, parent, position, depth, label: node.label, prompt: node.prompt, marks: null, mode: null, mode_config: null, word_max: null, node }
}

/** Total of the leaf marks of a tree. */
export function leafMarksOf(tree: readonly NodePlan[]): number {
  return tree.reduce((sum, n) => sum + (n.kind === 'leaf' ? n.marks : leafMarksOf(n.children)), 0)
}
