/**
 * The steps of `migrate:questions` (QLOAD): one batch = one transaction.
 *
 *  1. `questions`        a page of archive questions in ANY V2 status (T-B9-2). Writes, for the NEW questions of the batch only (an existing
 *                        `(legacy_source, legacy_id)` is "unchanged": a question and its children are committed together, so existing means
 *                        complete): `questions`, `question_versions`, `question_parts`, `part_options`, `answer_keys`, `question_tags`, the
 *                        question's own stem stimulus (`stimuli` + `question_version_stimuli`) and the `etl_id_map` entry. Carrier rows of the
 *                        rajah plan are NOT questions: they are counted `absorbed` and become stimuli in step 2.
 *  2. `question_stimuli` the stimuli of the plan (carriers, image owners, shared images, canonical stimuli), keyed `c:`, `o:`, `x:`, `s:`.
 *  3. `stimulus_groups`  the groups of the plan (T-B9-4): stimulus group + member links in V2 order, the image hold of a group whose picture is
 *                        not copied yet, and the stem links of image owners that sit alone in their class.
 * One multi-row statement per table from a JSON parameter; rows are joined by key (legacy id, question id, version id), never by order.
 * Inserts are direct SQL (the service publish gate is not a constraint; see the deviation log): the leaf was validated against the contract
 * schema in the transform, and the stimulus flag is written by the same detector the Studio runs (`flagOfLoaded`).
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, toJson } from '../../kit/sql'
import type { SqlExecutor } from '../../kit/types'
import { exclusionOf, transformQuestion, type ImportIssue, type LegacyQuestion, type QuestionPlan } from '../../transform/question-bank'
import { rejectRow } from '../helpers'
import type { QuestionsContext } from './context'
import { kindOfFigureText, flagOfLoaded, type PlannedGroup, type RajahPlan, type StimulusSpec } from './plan'
import { readQuestions } from './source'

const PROGRESS_EVERY = 50

/** Stable text order used for the key of the plan steps (the same comparator for the order of `extract` and the resume filter). */
const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

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
      const { plan } = await q.plan()
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
        // A rajah carrier is a stimulus, never a question (PO core rule): absorbed, counted, never a reject.
        if (plan.absorbed.has(legacyId.trim())) {
          excluded += 1
          q.notes.count('questions.absorbed')
          continue
        }
        const out = transformQuestion(row, cur)
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          q.notes.count(`questions.quarantined.${out.reject.reason}.${out.reject.column}`)
          continue
        }
        plans.push(out.value)
      }
      const inserted = await insertBatch(ctx, plans, plan, q.groupIndex(plan))
      const fresh = plans.filter((p) => inserted.has(p.legacyId))
      for (const p of fresh) for (const n of p.notes) q.notes.count(`questions.${n}`)
      batches += 1
      if (batches % PROGRESS_EVERY === 0) q.options.progress?.(`migrate:questions: ${batches} batches processed`)
      return { inserted: fresh.length, unchanged: plans.length - fresh.length, excluded }
    },
  }
}

const readQuestionsOf = (q: QuestionsContext, after: string | null): AsyncGenerator<LegacyQuestion> => readQuestions(q.pool, after, q.pageSize)

/** Pre-allocated ids of an identity table (the insert then names them, so rows are joined by key and never by order). */
export async function allocIds(db: SqlExecutor, table: string, n: number): Promise<string[]> {
  if (n === 0) return []
  const res = await db.query<{ id: string }>(`SELECT nextval(pg_get_serial_sequence('${table}', 'id'))::text AS id FROM generate_series(1, $1::int)`, [n])
  return res.rows.map((r) => r.id)
}

/** Inserts the new questions of the batch; returns the legacy ids that were inserted. */
async function insertBatch(ctx: BatchContext, plans: readonly QuestionPlan[], rplan: RajahPlan, groups: ReadonlyMap<string, PlannedGroup>): Promise<Set<string>> {
  const done = new Set<string>()
  if (plans.length === 0) return done
  const db = ctx.db

  // V2 owners that were migrated (`created_by`, `approved_by`): else NULL.
  const owners = [...new Set(plans.flatMap((p) => [p.created_by, p.approved_by]).filter((x): x is string => x !== null))]
  const userOf = owners.length === 0 ? new Map<string, string>() : await ctx.idMap.resolveMany('users', owners)

  const qs = await db.query<{ id: string; legacy_id: string }>(
    `INSERT INTO questions (latest_version_no, live_version_no, is_active, created_at, updated_at, legacy_source, legacy_id, created_by_id)
     SELECT 1, CASE WHEN x.live THEN 1 END, x.is_active, x.created_at::timestamptz, x.updated_at::timestamptz, $2::text, x.legacy_id, x.created_by_id
     FROM jsonb_to_recordset($1::jsonb) AS x(legacy_id text, live boolean, is_active boolean, created_at text, updated_at text, created_by_id bigint)
     ON CONFLICT (legacy_source, legacy_id) DO NOTHING
     RETURNING id::text AS id, legacy_id`,
    [
      toJson(plans.map((p) => ({ legacy_id: p.legacyId, live: p.live, is_active: p.is_active, created_at: p.created_at, updated_at: p.updated_at, created_by_id: p.created_by === null ? null : (userOf.get(p.created_by) ?? null) }))),
      ctx.source,
    ],
  )
  if (qs.rows.length === 0) return done
  const questionOf = new Map(qs.rows.map((r) => [r.legacy_id, r.id]))
  const fresh = plans.filter((p) => questionOf.has(p.legacyId))
  for (const p of fresh) done.add(p.legacyId)

  // The stimulus flag as the Studio would write it, so an approved question that names a figure and shows none is never served.
  const flagOf = (p: QuestionPlan) =>
    flagOfLoaded({ stem: p.stem, optionTexts: p.options.map((o) => o.body), hasGroup: rplan.memberGroup.has(p.legacyId), hasStemStimulus: p.image_path !== null || rplan.ownerStimulus.has(p.legacyId) })
  const issuesOf = (p: QuestionPlan): ImportIssue[] | null => {
    const g = groups.get(rplan.memberGroup.get(p.legacyId) ?? '')
    const list = [...(p.import_issues ?? []), ...(g === undefined ? [] : [{ code: 'rajah_group_auto', target: 'question' as const, ref: g.confidence, signals: g.signals }])]
    return list.length === 0 ? null : list
  }

  const versions = await db.query<{ id: string; question_id: string }>(
    `INSERT INTO question_versions (question_id, version_no, status, published_at, type, stem_ms, language, explanation_ms, rejection_reason,
        subject_id, education_level_id, chapter_id, topic_id, form_origin, difficulty_tp, rights_status, import_issues, contributor_id,
        stimulus_flag, stimulus_flag_ref, stimulus_flag_at, created_at, updated_at)
     SELECT x.question_id, 1, x.status, x.published_at::timestamptz, x.qtype, x.stem, 'ms', x.explanation, x.rejection_reason,
        x.subject_id, x.education_level_id, x.chapter_id, x.topic_id, x.form_origin, x.difficulty_tp, 'unclear', x.import_issues, x.contributor_id,
        x.flag, x.flag_ref, CASE WHEN x.flag IS NOT NULL THEN now() END, x.created_at::timestamptz, x.updated_at::timestamptz
     FROM jsonb_to_recordset($1::jsonb) AS x(question_id bigint, status text, qtype text, published_at text, stem text, explanation text, rejection_reason text,
        subject_id bigint, education_level_id bigint, chapter_id bigint, topic_id bigint, form_origin text, difficulty_tp smallint, import_issues jsonb,
        contributor_id bigint, flag text, flag_ref text, created_at text, updated_at text)
     RETURNING id::text AS id, question_id::text AS question_id`,
    [toJson(fresh.map((p) => {
      const f = flagOf(p)
      return {
        question_id: questionOf.get(p.legacyId), status: p.status, qtype: p.qtype, published_at: p.published_at, stem: p.stem, explanation: p.explanation,
        rejection_reason: p.rejection_reason, subject_id: p.subject_id, education_level_id: p.education_level_id, chapter_id: p.chapter_id, topic_id: p.topic_id,
        form_origin: p.form_origin, difficulty_tp: p.difficulty_tp, import_issues: issuesOf(p), contributor_id: p.approved_by === null ? null : (userOf.get(p.approved_by) ?? null),
        flag: f?.flag ?? null, flag_ref: f?.ref ?? null, created_at: p.created_at, updated_at: p.updated_at,
      }
    }))],
  )
  const versionOf = new Map(versions.rows.map((r) => [r.question_id, r.id]))
  const versionFor = (p: QuestionPlan): string => versionOf.get(questionOf.get(p.legacyId) as string) as string

  const parts = await db.query<{ id: string; question_version_id: string }>(
    `-- the text is written ONCE, in the stem (as the S4-T04 trim leaves a single-leaf question): an equal prompt would raise stem_duplicated on every row
     INSERT INTO question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms, marks, mode, mode_config)
     SELECT x.vid, NULL, 1, 1, '1', x.prompt, 1, 'mcq', x.mode_config
     FROM jsonb_to_recordset($1::jsonb) AS x(vid bigint, prompt text, mode_config jsonb)
     RETURNING id::text AS id, question_version_id::text AS question_version_id`,
    [toJson(fresh.map((p) => ({ vid: versionFor(p), prompt: '', mode_config: p.qtype === 'mcq_multi' ? { multi: true } : null })))],
  )
  const partOf = new Map(parts.rows.map((r) => [r.question_version_id, r.id]))
  const partFor = (p: QuestionPlan): string => partOf.get(versionFor(p)) as string

  await db.query(
    `INSERT INTO part_options (part_id, label, body_ms, position)
     SELECT x.part_id, x.label, x.body, x.position FROM jsonb_to_recordset($1::jsonb) AS x(part_id bigint, label text, body text, position smallint)`,
    [toJson(fresh.flatMap((p) => p.options.map((o) => ({ part_id: partFor(p), label: o.label, body: o.body, position: o.position }))))],
  )
  await db.query(
    `INSERT INTO answer_keys (part_id, kind, content)
     SELECT x.part_id, x.kind, x.content FROM jsonb_to_recordset($1::jsonb) AS x(part_id bigint, kind text, content jsonb)`,
    [toJson(fresh.map((p) => (p.qtype === 'mcq_multi'
      ? { part_id: partFor(p), kind: 'options', content: { kind: 'options', correctOptionIds: p.correct } }
      : { part_id: partFor(p), kind: 'option', content: { kind: 'option', correct: p.correct[0] } })))],
  )
  const pooled = fresh.filter((p) => p.spm_pool)
  if (pooled.length > 0) {
    await db.query(
      `INSERT INTO question_tags (question_id, kind, code) SELECT x.question_id, 'pool', 'spm' FROM jsonb_to_recordset($1::jsonb) AS x(question_id bigint)`,
      [toJson(pooled.map((p) => ({ question_id: questionOf.get(p.legacyId) })))],
    )
  }

  // The question's own picture is its stem stimulus (position 1). A question whose picture is supplied by a group, or that shares a stimulus of
  // the plan (an image owner alone in its class, linked in step 3), writes none.
  const withImage = fresh.filter((p) => p.image_path !== null && !rplan.imageDropped.has(p.legacyId) && !rplan.ownerStimulus.has(p.legacyId))
  if (withImage.length > 0) {
    const ids = await allocIds(db, 'stimuli', withImage.length)
    await db.query(
      `INSERT INTO stimuli (id, kind, alt_text, reusable)
       OVERRIDING SYSTEM VALUE
       SELECT x.id, x.kind, x.alt, false FROM jsonb_to_recordset($1::jsonb) AS x(id bigint, kind text, alt text)`,
      [toJson(withImage.map((p, i) => ({ id: ids[i], kind: kindOfFigureText(p.stem), alt: null })))],
    )
    await db.query(
      `INSERT INTO question_version_stimuli (question_version_id, stimulus_id, position)
       SELECT x.vid, x.sid, 1 FROM jsonb_to_recordset($1::jsonb) AS x(vid bigint, sid bigint)`,
      [toJson(withImage.map((p, i) => ({ vid: versionFor(p), sid: ids[i] })))],
    )
    await ctx.idMap.registerMany('question_stimuli', withImage.map((p, i) => [`i:${p.legacyId}`, ids[i] as string] as const))
  }
  await ctx.idMap.registerMany('questions', fresh.map((p) => [p.legacyId, questionOf.get(p.legacyId) as string] as const))
  return done
}

// --- step 2: the stimuli of the plan ------------------------------------------------------------------------------------------------

export function stimuliStep(q: QuestionsContext): AnyEntityStep {
  const entity = 'question_stimuli'
  let list: StimulusSpec[] | null = null
  const load = async (): Promise<StimulusSpec[]> => {
    if (list === null) list = [...(await q.plan()).plan.stimuli.values()].sort((a, b) => byKey(a.key, b.key))
    return list
  }
  return {
    entity,
    source: q.source,
    extract: async function* (after: string | null) {
      for (const s of await load()) if (after === null || byKey(s.key, after) > 0) yield s
    },
    keyOf: (s: StimulusSpec) => s.key,
    async load(rows: StimulusSpec[], ctx: BatchContext): Promise<BatchResult> {
      const have = await existing(ctx, 'question_stimuli', 'stimuli', rows.map((r) => r.key))
      const fresh = rows.filter((r) => !have.has(r.key))
      if (fresh.length > 0) {
        const ids = await allocIds(ctx.db, 'stimuli', fresh.length)
        await ctx.db.query(
          `INSERT INTO stimuli (id, kind, label, body_ms, caption, alt_text, reusable)
           OVERRIDING SYSTEM VALUE
           SELECT x.id, x.kind, x.label, x.body, x.caption, x.alt, true
             FROM jsonb_to_recordset($1::jsonb) AS x(id bigint, kind text, label text, body text, caption text, alt text)`,
          [toJson(fresh.map((s, i) => ({ id: ids[i], kind: s.kind, label: s.label, body: s.bodyText, caption: s.caption, alt: s.altText })))],
        )
        await ctx.idMap.registerMany('question_stimuli', fresh.map((s, i) => [s.key, ids[i] as string] as const))
        for (const s of fresh) q.notes.count(`stimuli.created.${s.kind}`)
      }
      return { inserted: fresh.length, unchanged: rows.length - fresh.length }
    },
  }
}

/** Keys whose id-map entry still points at an existing row (a dangling entry is deleted, so the entity is re-created: design section 11, rule 1). */
async function existing(ctx: BatchContext, entity: string, table: string, keys: readonly string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set()
  const res = await ctx.db.query<{ legacy_id: string; ok: boolean }>(
    `SELECT m.legacy_id, EXISTS (SELECT 1 FROM ${table} t WHERE t.id = m.new_id::bigint) AS ok
       FROM etl_id_map m WHERE m.legacy_source = $1 AND m.entity = $2 AND m.legacy_id = ANY($3::text[])`,
    [ctx.source, entity, keys],
  )
  const dangling = res.rows.filter((r) => !r.ok).map((r) => r.legacy_id)
  if (dangling.length > 0) {
    await ctx.db.query(`DELETE FROM etl_id_map WHERE legacy_source = $1 AND entity = $2 AND legacy_id = ANY($3::text[])`, [ctx.source, entity, dangling])
  }
  return new Set(res.rows.filter((r) => r.ok).map((r) => r.legacy_id))
}

// --- step 3: the groups of the plan -------------------------------------------------------------------------------------------------

interface GroupUnit {
  key: string
  group: PlannedGroup | null
  /** An image owner alone in its class: its stem link to the shared stimulus. */
  owner: { questionId: string; stimulusKey: string } | null
}

export function groupsStep(q: QuestionsContext): AnyEntityStep {
  const entity = 'stimulus_groups'
  let list: GroupUnit[] | null = null
  const load = async (): Promise<GroupUnit[]> => {
    if (list === null) {
      const { plan } = await q.plan()
      list = [
        ...plan.groups.map((g) => ({ key: g.key, group: g, owner: null })),
        ...[...plan.ownerStimulus].map(([questionId, stimulusKey]) => ({ key: `o:${questionId}`, group: null, owner: { questionId, stimulusKey } })),
      ].sort((a, b) => byKey(a.key, b.key))
    }
    return list
  }
  return {
    entity,
    source: q.source,
    extract: async function* (after: string | null) {
      for (const u of await load()) if (after === null || byKey(u.key, after) > 0) yield u
    },
    keyOf: (u: GroupUnit) => u.key,
    async load(rows: GroupUnit[], ctx: BatchContext): Promise<BatchResult> {
      const { plan } = await q.plan()
      let inserted = 0
      let unchanged = 0
      let updated = 0
      for (const u of rows) {
        if (u.group !== null) {
          const w = await writeGroup(ctx, plan, u.group, q)
          if (w.inserted) inserted += 1
          else if (w.updated > 0) updated += 1 // one changed GROUP row; the member count is the note groups.late_attached
          else unchanged += 1
        } else if (await writeOwnerLink(ctx, plan, u.owner as NonNullable<GroupUnit['owner']>)) inserted += 1
        else unchanged += 1
      }
      return { inserted, updated, unchanged }
    },
  }
}

async function stimulusIdOf(ctx: BatchContext, key: string): Promise<string> {
  const id = await ctx.idMap.resolve('question_stimuli', key)
  if (id === null) throw new Error(`migrate:questions: stimulus ${key} was not created before its group`)
  return id
}

/** The loaded question ids and tags of the legacy members of a group, in the order given (members that were not loaded are absent). */
async function loadedMembers(db: SqlExecutor, source: string, legacyIds: readonly string[]): Promise<{ legacyId: string; id: string; subject: string | null; level: string | null; group: string | null }[]> {
  const res = await db.query<{ legacy_id: string; id: string; subject_id: string | null; education_level_id: string | null; group_id: string | null }>(
    `SELECT q.legacy_id, q.id::text AS id, v.subject_id::text AS subject_id, v.education_level_id::text AS education_level_id, q.group_id::text AS group_id
       FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = 1
      WHERE q.legacy_source = $1 AND q.legacy_id = ANY($2::text[])`,
    [source, legacyIds],
  )
  const byLegacy = new Map(res.rows.map((r) => [r.legacy_id, r]))
  return legacyIds.flatMap((l) => {
    const r = byLegacy.get(l)
    return r === undefined ? [] : [{ legacyId: l, id: r.id, subject: r.subject_id, level: r.education_level_id, group: r.group_id }]
  })
}

/**
 * A group that exists already: a member that was quarantined or held in an earlier run and is loaded by this one has `group_id` NULL.
 * Attach it, and renumber the whole group in V2 order (two phases: the unique index on (group_id, group_position) is checked row by row,
 * and the +3000 shift is undone by the renumber, so positions never grow). Returns the number of members attached; 0 changes no row.
 */
async function attachLateMembers(ctx: BatchContext, g: PlannedGroup, groupId: string, q: QuestionsContext, plan: RajahPlan): Promise<number> {
  const db = ctx.db
  const loaded = await loadedMembers(db, ctx.source, g.members)
  const late = loaded.filter((m) => m.group === null)
  if (late.length === 0) return 0
  const inGroup = loaded.filter((m) => m.group === groupId || m.group === null)
  const ordered = inGroup.map((m) => m.id)
  const extra = await db.query<{ id: string }>(
    `SELECT id::text AS id FROM questions WHERE group_id = $1::bigint AND NOT (id = ANY($2::bigint[])) ORDER BY group_position, id`,
    [groupId, ordered],
  )
  const finalOrder = [...ordered, ...extra.rows.map((r) => r.id)]
  await db.query(`UPDATE questions SET group_position = group_position + 3000 WHERE group_id = $1::bigint`, [groupId])
  await db.query(
    `UPDATE questions q SET group_id = $1::bigint, group_position = x.pos, updated_at = now()
       FROM jsonb_to_recordset($2::jsonb) AS x(id bigint, pos smallint) WHERE q.id = x.id`,
    [groupId, toJson(finalOrder.map((id, i) => ({ id, pos: i + 1 })))],
  )
  // A group whose picture is still not copied is held as a whole: the late members join the hold.
  const stimulus = plan.stimuli.get(g.stimulusKey)
  if (stimulus !== undefined && stimulus.imagePath !== null) {
    const copied = await db.query(`SELECT 1 FROM stimuli s WHERE s.id = $1::bigint AND s.asset_file_id IS NOT NULL`, [await stimulusIdOf(ctx, g.stimulusKey)])
    if ((copied.rowCount ?? 0) === 0) {
      const ids = late.map((m) => m.id)
      await db.query(
        `UPDATE question_versions v SET import_issues = coalesce(CASE WHEN jsonb_typeof(v.import_issues) = 'array' THEN v.import_issues END, '[]'::jsonb)
                || jsonb_build_array(jsonb_build_object('code', 'legacy_image_unresolved', 'target', 'question', 'path', $2::text))
          WHERE v.question_id = ANY($1::bigint[]) AND v.version_no = 1
            AND NOT coalesce(jsonb_typeof(v.import_issues) = 'array' AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb, false)`,
        [ids, stimulus.imagePath],
      )
      await db.query(`UPDATE questions SET is_active = false WHERE id = ANY($1::bigint[])`, [ids])
    }
  }
  q.notes.count(`groups.members.${g.cls}`, late.length)
  q.notes.count('groups.late_attached', late.length)
  return late.length
}

async function writeGroup(ctx: BatchContext, plan: RajahPlan, g: PlannedGroup, q: QuestionsContext): Promise<{ inserted: boolean; updated: number }> {
  const db = ctx.db
  const known = await existing(ctx, 'stimulus_groups', 'stimulus_groups', [g.key])
  if (known.has(g.key)) {
    const groupId = await ctx.idMap.resolve('stimulus_groups', g.key)
    return { inserted: false, updated: groupId === null ? 0 : await attachLateMembers(ctx, g, groupId, q, plan) }
  }
  const members = (await loadedMembers(db, ctx.source, g.members)).filter((m) => m.group === null)
  if (members.length === 0) return { inserted: false, updated: 0 }
  const stimulus = plan.stimuli.get(g.stimulusKey)
  if (stimulus === undefined) throw new Error(`migrate:questions: group ${g.key} has no stimulus in the plan`)
  const stimulusId = await stimulusIdOf(ctx, g.stimulusKey)
  const subjects = new Set(members.map((m) => m.subject))
  const levels = new Set(members.map((m) => m.level))
  const [groupId] = await allocIds(db, 'stimulus_groups', 1)
  await db.query(
    `INSERT INTO stimulus_groups (id, label, scope, subject_id, education_level_id) OVERRIDING SYSTEM VALUE VALUES ($1::bigint, $2, 'section', $3::bigint, $4::bigint)`,
    [groupId, stimulus.label, subjects.size === 1 ? [...subjects][0] : null, levels.size === 1 ? [...levels][0] : null],
  )
  await db.query(`INSERT INTO stimulus_group_stimuli (group_id, stimulus_id, position) VALUES ($1::bigint, $2::bigint, 1)`, [groupId, stimulusId])
  await db.query(
    `UPDATE questions q SET group_id = $1::bigint, group_position = x.pos, updated_at = now()
       FROM jsonb_to_recordset($2::jsonb) AS x(id bigint, pos smallint) WHERE q.id = x.id`,
    [groupId, toJson(members.map((m, i) => ({ id: m.id, pos: i + 1 })))],
  )
  // A group whose picture is not copied yet is held as a whole (design 8.3): every member inactive, with the path so the repair pass finds it.
  if (stimulus.imagePath !== null) {
    await db.query(
      `UPDATE question_versions v SET import_issues = coalesce(CASE WHEN jsonb_typeof(v.import_issues) = 'array' THEN v.import_issues END, '[]'::jsonb)
              || jsonb_build_array(jsonb_build_object('code', 'legacy_image_unresolved', 'target', 'question', 'path', $2::text))
        WHERE v.question_id = ANY($1::bigint[]) AND v.version_no = 1
          AND NOT coalesce(jsonb_typeof(v.import_issues) = 'array' AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb, false)`,
      [members.map((m) => m.id), stimulus.imagePath],
    )
    await db.query(`UPDATE questions SET is_active = false WHERE id = ANY($1::bigint[])`, [members.map((m) => m.id)])
    q.notes.count('groups.held_image')
  }
  await ctx.idMap.registerMany('stimulus_groups', [[g.key, groupId as string]])
  q.notes.count(`groups.${g.confidence}.${g.cls}`)
  q.notes.count(`groups.members.${g.cls}`, members.length)
  return { inserted: true, updated: 0 }
}

async function writeOwnerLink(ctx: BatchContext, plan: RajahPlan, o: NonNullable<GroupUnit['owner']>): Promise<boolean> {
  void plan
  const [m] = await loadedMembers(ctx.db, ctx.source, [o.questionId])
  if (m === undefined) return false
  const stimulusId = await stimulusIdOf(ctx, o.stimulusKey)
  const res = await ctx.db.query(
    `INSERT INTO question_version_stimuli (question_version_id, stimulus_id, position)
     SELECT v.id, $2::bigint, 1 FROM question_versions v WHERE v.question_id = $1::bigint AND v.version_no = 1
     ON CONFLICT (question_version_id, stimulus_id) DO NOTHING`,
    [m.id, stimulusId],
  )
  return (res.rowCount ?? 0) > 0
}
