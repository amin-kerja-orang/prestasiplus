/**
 * Stimuli of the legacy questions that have a canonical projection (T-B9-6, PO rule D90/D105).
 *
 * V2 keeps a structured (or subjective) question in `structured_questions` / `questions` AND, when the canonical bank was built, as an
 * `exam_questions` row linked by `legacy_canonical_map`. The canonical row owns the V2 `stimuli` (`question_stimulus`, a part's `stimulus_id`):
 * the rajah that the sub-questions refer to ("Rajah 1.1"). The canonical loader skips a projected row (the legacy row stays the question), so
 * without this link the V3 question loses its rajah and the Studio says "Soalan ini tidak berkongsi rangsangan".
 *
 * For every legacy question inserted by the batch this links the stimuli of its projection, in V2 order, as the question's own stem
 * stimuli (at most 3), through the same V2 stimulus -> V3 stimulus id map as the canonical-only loader (`canonical_stimuli`, so a stimulus
 * shared with a canonical-only question is ONE row). Two stimuli are left out: one with no picture whose text is already inside the loaded stem
 * (V2's projection copies the stem into a stimulus), and an empty one. A stimulus with a picture holds the question
 * (`legacy_image_unresolved`) until the picture pass copies the file, exactly as the rajah groups do; the Audit Rajah upload releases it too.
 */
import { ARCHIVE_SCHEMA } from '../../ddl/spec'
import type { BatchContext } from '../../kit/runner'
import { quoteIdent, toJson } from '../../kit/sql'
import { text } from '../../transform/common'
import { plainFromHtml } from '../../transform/question-bank'
import type { QuestionTreePlan } from './bank-writer'
import { ensureStimuli, hold, MAX_OWN_STIMULI, stimulusText, type LinkOutcome } from './canonical-stimuli'

const A = quoteIdent(ARCHIVE_SCHEMA)

/** The V2 `legacy_canonical_map.source` of a legacy table. */
export type ProjectionSource = 'structured' | 'questions'

const norm = (s: string): string => plainFromHtml(s).text.toLowerCase().replace(/\s+/g, ' ').trim()

/** True when a text-only stimulus adds nothing to the question: it is empty, or its words are already in the stem. */
export function isCopyOfStem(stimulus: string | null, stem: string): boolean {
  if (stimulus === null) return true
  const s = norm(stimulus)
  return s === '' || norm(stem).includes(s)
}

export interface ProjectedLink {
  legacyId: string
  stimulusIds: string[]
}

/** V2 stimulus ids of the canonical projection of each legacy id, in V2 order (question stimuli first, then the stimuli of its parts). */
export async function projectedStimulusIds(ctx: BatchContext, source: ProjectionSource, legacyIds: readonly string[]): Promise<ProjectedLink[]> {
  if (legacyIds.length === 0) return []
  const res = await ctx.db.query<{ legacy_id: string; stimulus_id: string }>(
    `SELECT m."legacy_id"::text AS legacy_id, u.stimulus_id::text AS stimulus_id
       FROM ${A}."legacy_canonical_map" m
       JOIN (SELECT "exam_question_id", "stimulus_id", "position" AS pos, "id" AS ord FROM ${A}."question_stimulus"
             UNION ALL SELECT "exam_question_id", "stimulus_id", 1000 + "position", 1000000000 + "id" FROM ${A}."question_parts" WHERE "stimulus_id" IS NOT NULL) u
         ON u.exam_question_id = m."canonical_id"
      WHERE m."canonical_type" = 'exam_question' AND m."source" = $1 AND m."legacy_id"::text = ANY($2::text[])
      ORDER BY m."legacy_id"::text, u.pos, u.ord`,
    [source, [...legacyIds]],
  )
  const by = new Map<string, string[]>()
  for (const r of res.rows) {
    const list = by.get(r.legacy_id) ?? []
    if (!list.includes(r.stimulus_id)) list.push(r.stimulus_id)
    by.set(r.legacy_id, list)
  }
  return [...by].map(([legacyId, stimulusIds]) => ({ legacyId, stimulusIds }))
}

/**
 * Links the projected stimuli of the freshly inserted legacy questions `fresh`. `questionIds` is the map of `insertQuestionTrees` (key
 * `<idEntity>\0<idKey>`); `legacyKey` gives the V2 `legacy_canonical_map.legacy_id` of a plan (the structured id, or the V2 question id).
 */
export async function linkProjectedStimuli(
  ctx: BatchContext,
  source: ProjectionSource,
  fresh: readonly QuestionTreePlan[],
  questionIds: ReadonlyMap<string, string>,
): Promise<LinkOutcome> {
  const out: LinkOutcome = { created: 0, grouped: 0, groupsCreated: 0, own: 0, held: 0, empty: 0 }
  const planOf = new Map(fresh.map((p) => [p.idKey, p] as const))
  const links = await projectedStimulusIds(ctx, source, [...planOf.keys()])
  if (links.length === 0) return out

  // Which stimuli add something: a picture, or text that is not already in the stem.
  const allIds = [...new Set(links.flatMap((l) => l.stimulusIds))]
  const info = await ctx.db.query<{ id: string; body: string | null; path: string | null }>(
    `SELECT s.id::text AS id, s.body::text AS body, ma.path::text AS path
       FROM ${A}.stimuli s LEFT JOIN ${A}.media_assets ma ON ma.id = s.asset_id WHERE s.id = ANY($1::bigint[])`,
    [allIds],
  )
  const facts = new Map(info.rows.map((r) => [r.id, { body: stimulusText(r.body), path: text(r.path) }] as const))
  const wanted = new Map<string, string[]>()
  for (const l of links) {
    const plan = planOf.get(l.legacyId)
    if (plan === undefined) continue
    const keep = l.stimulusIds.filter((sid) => {
      const f = facts.get(sid)
      if (f === undefined) return false
      return f.path !== null || !isCopyOfStem(f.body, plan.stem)
    })
    out.empty += l.stimulusIds.length - keep.length
    if (keep.length > 0) wanted.set(l.legacyId, keep.slice(0, MAX_OWN_STIMULI))
  }
  if (wanted.size === 0) return out

  const { ids: stimulusOf, paths } = await ensureStimuli(ctx, [...new Set([...wanted.values()].flat())], out)
  const rows: { qid: string; stimulus_id: string; position: number }[] = []
  const heldPaths = new Map<string, Set<string>>()
  for (const [legacyId, sids] of wanted) {
    const plan = planOf.get(legacyId) as QuestionTreePlan
    const qid = questionIds.get(`${plan.idEntity}\u0000${plan.idKey}`)
    if (qid === undefined) continue
    let position = 0
    for (const sid of sids) {
      const v3 = stimulusOf.get(sid)
      if (v3 === undefined) continue
      position += 1
      rows.push({ qid, stimulus_id: v3, position })
      out.own += 1
      const path = paths.get(sid)
      if (path !== undefined) heldPaths.set(path, (heldPaths.get(path) ?? new Set()).add(qid))
    }
  }
  if (rows.length > 0) {
    await ctx.db.query(
      `INSERT INTO question_version_stimuli (question_version_id, stimulus_id, position)
       SELECT v.id, x.stimulus_id, x.position
         FROM jsonb_to_recordset($1::jsonb) AS x(qid bigint, stimulus_id bigint, position smallint)
         JOIN question_versions v ON v.question_id = x.qid AND v.version_no = 1
       ON CONFLICT DO NOTHING`,
      [toJson(rows)],
    )
  }
  for (const [path, set] of heldPaths) {
    await hold(ctx, [...set], path)
    out.held += set.size
  }
  return out
}
