/**
 * Stimuli of the canonical-only bank (T-B9-7, PO rule D90/D105): V2 `stimuli` linked by `question_stimulus` (or a part's `stimulus_id`) to
 * `exam_questions` that are NOT projections of a legacy question.
 *
 *  - a V2 stimulus becomes one V3 `stimuli` row (id map `canonical_stimuli`, key = V2 `stimuli.id`), created on first use;
 *  - a stimulus used by two or more canonical-only questions is a GROUP stimulus (id map `canonical_stimulus_groups`): every member shows it,
 *    members in V2 order (`exam_questions.position`, then id), a question belongs to one group, a group holds at most 40 members, and a member
 *    that cannot join (already grouped, group full) keeps the stimulus as its own stem stimulus;
 *  - a stimulus used by one question is that question's own stimulus (`question_version_stimuli`, at most 3);
 *  - a stimulus with a picture is held until the picture pass copies the file (the same `legacy_image_unresolved` hold and path as the rajah
 *    groups, so `migrate:questions --files-dir` releases it): every member of the group, or the question, is inactive meanwhile.
 * Batches may split a group; later batches attach to the group of the id map and the whole group is renumbered in V2 order.
 */
import type { BatchContext } from '../../kit/runner'
import { toJson } from '../../kit/sql'
import { text } from '../../transform/common'
import { plainFromHtml } from '../../transform/question-bank'
import { allocIds } from './steps'
import type { QuestionTreePlan } from './bank-writer'

const A = 'archive_cloud'
export const MAX_OWN_STIMULI = 3
export const MAX_GROUP_MEMBERS = 40

const KIND_OF: Readonly<Record<string, string>> = {
  passage: 'passage', box: 'passage', code: 'passage', pseudocode: 'passage', sql: 'passage', math: 'passage',
  table: 'table', diagram: 'diagram', graph: 'graph', map: 'map', infographic: 'infographic', audio: 'audio',
  image: 'image', cartoon: 'image', video: 'image',
}

/** Plain text of a V2 stimulus body (`{html}`, `{ms}`, `{text}`, a rich document or a string); null when it holds none. */
export function stimulusText(raw: string | null | undefined): string | null {
  const t = text(raw)
  if (t === null) return null
  let value: unknown = t
  if (/^[[{"]/.test(t)) {
    try {
      value = JSON.parse(t)
      if (typeof value === 'string' && /^[[{]/.test(value.trim())) value = JSON.parse(value)
    } catch {
      value = t
    }
  }
  const parts: string[] = []
  const walk = (x: unknown, depth: number): void => {
    if (depth > 8 || x === null || x === undefined) return
    if (typeof x === 'string') parts.push(x)
    else if (Array.isArray(x)) for (const i of x) walk(i, depth + 1)
    else if (typeof x === 'object') {
      const o = x as Record<string, unknown>
      for (const k of ['html', 'ms', 'text']) {
        if (typeof o[k] === 'string' && (o[k] as string).trim() !== '') {
          parts.push(o[k] as string)
          return
        }
      }
      for (const k of Object.keys(o).sort()) if (k !== 'en' && k !== 'type' && k !== 'attrs') walk(o[k], depth + 1)
    }
  }
  walk(value, 0)
  const plain = parts.map((p) => plainFromHtml(p).text.trim()).filter((p) => p !== '').join('\n')
  return plain === '' ? null : plain
}

interface StimulusRow {
  id: string
  kind: string | null
  body: string | null
  caption: string | null
  path: string | null
}

export interface LinkOutcome {
  created: number
  grouped: number
  groupsCreated: number
  own: number
  held: number
  empty: number
}

const HOLD = `jsonb_build_array(jsonb_build_object('code', 'legacy_image_unresolved', 'target', 'question', 'path', $2::text))`

export async function hold(ctx: BatchContext, questionIds: readonly string[], path: string): Promise<void> {
  await ctx.db.query(
    `UPDATE question_versions v SET import_issues = coalesce(CASE WHEN jsonb_typeof(v.import_issues) = 'array' THEN v.import_issues END, '[]'::jsonb) || ${HOLD}
      WHERE v.question_id = ANY($1::bigint[]) AND v.version_no = 1
        AND NOT coalesce(jsonb_typeof(v.import_issues) = 'array' AND v.import_issues @> jsonb_build_array(jsonb_build_object('code', 'legacy_image_unresolved', 'path', $2::text)), false)`,
    [questionIds, path],
  )
  await ctx.db.query(`UPDATE questions SET is_active = false WHERE id = ANY($1::bigint[])`, [questionIds])
}

/** Creates the V3 stimuli of `ids` that the id map does not know yet; returns the id map (V2 stimulus id to V3 id) and the picture path of each. */
export async function ensureStimuli(ctx: BatchContext, ids: readonly string[], out: LinkOutcome): Promise<{ ids: Map<string, string>; paths: Map<string, string> }> {
  const known = await ctx.idMap.resolveMany('canonical_stimuli', ids)
  const paths = new Map<string, string>()
  const missing = ids.filter((i) => !known.has(i))
  const res = await ctx.db.query<StimulusRow>(
    `SELECT s.id::text AS id, k.slug::text AS kind, s.body::text AS body, s.caption::text AS caption, ma.path::text AS path
       FROM ${A}.stimuli s LEFT JOIN staging_cloud.stimulus_kinds k ON k.id = s.stimulus_kind_id LEFT JOIN ${A}.media_assets ma ON ma.id = s.asset_id
      WHERE s.id = ANY($1::bigint[])`,
    [ids],
  )
  const fresh: { v2: string; kind: string; body: string | null; caption: string | null; alt: string | null }[] = []
  for (const r of res.rows) {
    const path = text(r.path)
    if (path !== null) paths.set(r.id, path)
    if (known.has(r.id)) continue
    const body = stimulusText(r.body)
    const caption = text(r.caption)
    if (body === null && caption === null && path === null) {
      out.empty += 1
      continue
    }
    const slug = (text(r.kind) ?? '').toLowerCase()
    const kind = KIND_OF[slug] ?? (path !== null ? 'image' : 'passage')
    fresh.push({ v2: r.id, kind, body, caption, alt: caption })
  }
  void missing
  if (fresh.length > 0) {
    const newIds = await allocIds(ctx.db, 'stimuli', fresh.length)
    await ctx.db.query(
      `INSERT INTO stimuli (id, kind, body_ms, caption, alt_text, reusable)
       OVERRIDING SYSTEM VALUE
       SELECT x.id, x.kind, x.body, x.caption, x.alt, true FROM jsonb_to_recordset($1::jsonb) AS x(id bigint, kind text, body text, caption text, alt text)`,
      [toJson(fresh.map((f, i) => ({ id: newIds[i], kind: f.kind, body: f.body, caption: f.caption, alt: f.alt })))],
    )
    await ctx.idMap.registerMany('canonical_stimuli', fresh.map((f, i) => [f.v2, newIds[i] as string] as const))
    out.created += fresh.length
    for (const [i, f] of fresh.entries()) known.set(f.v2, newIds[i] as string)
  }
  return { ids: known, paths }
}

/**
 * Links the stimuli of the canonical questions of this batch that show none yet (just inserted, or left unlinked by an earlier run). `links`: V2 exam question id to its V2 stimulus ids in V2 order.
 * `questionIds`: the `questionIds` of `insertQuestionTrees` (key `exam_questions<NUL><V2 id>`).
 */
export async function linkCanonicalStimuli(
  ctx: BatchContext,
  plans: readonly QuestionTreePlan[],
  questionIds: ReadonlyMap<string, string>,
  links: ReadonlyMap<string, readonly string[]>,
): Promise<LinkOutcome> {
  const out: LinkOutcome = { created: 0, grouped: 0, groupsCreated: 0, own: 0, held: 0, empty: 0 }
  const wanted = plans.flatMap((p) => {
    const qid = questionIds.get(`${p.idEntity}\u0000${p.idKey}`)
    const sids = [...new Set(links.get(p.idKey) ?? [])]
    return qid === undefined || sids.length === 0 ? [] : [{ v2: p.idKey, qid, subject: p.subject_id, sids }]
  })
  if (wanted.length === 0) return out
  // Self-healing: a question inserted by this batch shows no stimulus yet; one inserted by an earlier run (or an earlier loader version) that still
  // shows none (no group, no own stimulus) is linked now. A question that already shows a stimulus is left alone, so a re-run changes 0 rows.
  const shown = await ctx.db.query<{ id: string }>(
    `SELECT q.id::text AS id FROM questions q
      WHERE q.id = ANY($1::bigint[])
        AND (q.group_id IS NOT NULL OR EXISTS (SELECT 1 FROM question_versions v JOIN question_version_stimuli s ON s.question_version_id = v.id WHERE v.question_id = q.id AND v.version_no = 1))`,
    [wanted.map((m) => m.qid)],
  )
  const done = new Set(shown.rows.map((r) => r.id))
  const members = wanted.filter((m) => !done.has(m.qid))
  if (members.length === 0) return out
  const allSids = [...new Set(members.flatMap((m) => m.sids))]
  const { ids: stimulusOf, paths } = await ensureStimuli(ctx, allSids, out)

  const counts = await ctx.db.query<{ stimulus_id: string; n: number }>(
    `SELECT u.stimulus_id::text AS stimulus_id, count(DISTINCT u.exam_question_id)::int AS n FROM (
        SELECT stimulus_id, exam_question_id FROM ${A}.question_stimulus
        UNION ALL SELECT stimulus_id, exam_question_id FROM ${A}.question_parts WHERE stimulus_id IS NOT NULL) u
      WHERE u.stimulus_id = ANY($1::bigint[])
        AND NOT EXISTS (SELECT 1 FROM ${A}.legacy_canonical_map m WHERE m.canonical_type = 'exam_question' AND m.canonical_id = u.exam_question_id)
      GROUP BY u.stimulus_id`,
    [allSids],
  )
  const uses = new Map(counts.rows.map((r) => [r.stimulus_id, r.n]))

  const ownLinks: { qid: string; stimulus_id: string; position: number }[] = []
  const ownCount = new Map<string, number>()
  const addOwn = (qid: string, v3: string): void => {
    const n = (ownCount.get(qid) ?? 0) + 1
    if (n > MAX_OWN_STIMULI) return
    ownCount.set(qid, n)
    ownLinks.push({ qid, stimulus_id: v3, position: n })
    out.own += 1
  }
  const grouped = new Set<string>()
  const byStimulus = new Map<string, typeof members>()
  const heldPaths = new Map<string, Set<string>>()
  const holdQuestion = (path: string | undefined, qid: string): void => {
    if (path === undefined) return
    heldPaths.set(path, (heldPaths.get(path) ?? new Set()).add(qid))
  }
  for (const m of members) {
    for (const sid of m.sids) {
      const v3 = stimulusOf.get(sid)
      if (v3 === undefined) continue
      if ((uses.get(sid) ?? 1) >= 2 && !grouped.has(m.qid)) {
        grouped.add(m.qid)
        byStimulus.set(sid, [...(byStimulus.get(sid) ?? []), m])
      } else {
        addOwn(m.qid, v3)
        holdQuestion(paths.get(sid), m.qid)
      }
    }
  }

  const touched: string[] = []
  for (const [sid, list] of byStimulus) {
    const v3 = stimulusOf.get(sid) as string
    let groupId = (await ctx.idMap.resolve('canonical_stimulus_groups', sid)) ?? null
    let have = 0
    if (groupId === null) {
      const subjects = new Set(list.map((m) => m.subject))
      const [gid] = await allocIds(ctx.db, 'stimulus_groups', 1)
      groupId = gid as string
      await ctx.db.query(
        `INSERT INTO stimulus_groups (id, label, scope, subject_id) OVERRIDING SYSTEM VALUE VALUES ($1::bigint, NULL, 'section', $2::bigint)`,
        [groupId, subjects.size === 1 ? ([...subjects][0] ?? null) : null],
      )
      await ctx.db.query(`INSERT INTO stimulus_group_stimuli (group_id, stimulus_id, position) VALUES ($1::bigint, $2::bigint, 1)`, [groupId, v3])
      await ctx.idMap.register('canonical_stimulus_groups', sid, groupId)
      out.groupsCreated += 1
    } else {
      const c = await ctx.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM questions WHERE group_id = $1::bigint`, [groupId])
      have = c.rows[0]?.n ?? 0
    }
    const room = Math.max(0, MAX_GROUP_MEMBERS - have)
    const joined = list.slice(0, room)
    for (const m of list.slice(room)) addOwn(m.qid, v3)
    if (joined.length === 0) continue
    await ctx.db.query(
      `UPDATE questions q SET group_id = $1::bigint, group_position = 2000 + x.i, updated_at = now()
         FROM jsonb_to_recordset($2::jsonb) AS x(id bigint, i int) WHERE q.id = x.id`,
      [groupId, toJson(joined.map((m, i) => ({ id: m.qid, i })))],
    )
    touched.push(groupId)
    out.grouped += joined.length
    const path = paths.get(sid)
    if (path !== undefined) {
      // A group whose picture is not copied yet is held as a whole: the members already in it as well.
      const all = await ctx.db.query<{ id: string }>(`SELECT id::text AS id FROM questions WHERE group_id = $1::bigint`, [groupId])
      heldPaths.set(path, new Set([...(heldPaths.get(path) ?? []), ...all.rows.map((r) => r.id)]))
    }
  }

  if (touched.length > 0) {
    // V2 order inside each group, in two phases (the unique index on (group_id, group_position) is checked row by row).
    await ctx.db.query(`UPDATE questions SET group_position = group_position + 3000 WHERE group_id = ANY($1::bigint[])`, [touched])
    // Every member is renumbered (the shift above covers all of them, so none may stay at +3000): members that are not exam
    // questions (rajah-group members) keep their relative order and follow the exam questions.
    await ctx.db.query(
      `UPDATE questions q SET group_position = r.rn
         FROM (SELECT q2.id, row_number() OVER (PARTITION BY q2.group_id
                       ORDER BY (eq.id IS NULL), coalesce(eq."position"::text::int, 0), eq.id::bigint, q2.group_position, q2.id)::int AS rn
                 FROM questions q2
                 LEFT JOIN etl_id_map m ON m.new_id::bigint = q2.id AND m.entity = 'exam_questions' AND m.legacy_source = $2
                 LEFT JOIN ${A}.exam_questions eq ON eq.id = m.legacy_id::bigint
                WHERE q2.group_id = ANY($1::bigint[])) r
        WHERE q.id = r.id`,
      [touched, ctx.source],
    )
  }
  if (ownLinks.length > 0) {
    await ctx.db.query(
      `INSERT INTO question_version_stimuli (question_version_id, stimulus_id, position)
       SELECT v.id, x.stimulus_id, x.position
         FROM jsonb_to_recordset($1::jsonb) AS x(qid bigint, stimulus_id bigint, position smallint)
         JOIN question_versions v ON v.question_id = x.qid AND v.version_no = 1
       ON CONFLICT (question_version_id, stimulus_id) DO NOTHING`,
      [toJson(ownLinks)],
    )
  }
  for (const [path, set] of heldPaths) {
    await hold(ctx, [...set], path)
    out.held += set.size
  }
  return out
}
