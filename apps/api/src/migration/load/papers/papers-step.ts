/**
 * `exam_papers` (175) + `paper_sections` + `exam_paper_questions` -> `papers` / `paper_sections` / `paper_placements` (T-B10-3, design 10.4).
 *
 * EVERY paper loads as `draft` (kind `pilihan`); the Terbit pass (`terbit-pass.ts`) publishes the V2-published ones through the real gate.
 *
 *  - kertas 1 to 4 from `inferKertas` (V2 text, cover code, title, structure; T-B13b, design 10.4a); undecided: kertas 1, held as
 *    `kertas_unknown:<reason>` (listed, never guessed);
 *  - surface: `simulasi` when an active V3 Kontrak exists for (subject, kertas), `subjektif` when kertas is 2 to 4 and none exists, else
 *    `simulasi`; duration: V2's; a V2 paper with none loads untimed (0, flag `legacy_untimed`, 0266: V2 served it untimed with an elapsed clock) and is
 *    NOT held, so it can be published (V2 parity); a subjektif paper may also be untimed (0);
 *  - sections from `paper_sections` (position renumbered 1..n), placements from `exam_paper_questions` (or `exam_questions.paper_section_id`
 *    + `position` when a section has no pivot rows); a placement is resolved to the V3 question through `legacy_canonical_map` ->
 *    `etl_id_map('questions' | 'structured_questions')`, else `etl_id_map('exam_questions')`; an unresolved placement is dropped and counted;
 *  - PO core rule: a stimulus group is placed whole and adjacent in `group_position` order inside ONE section; a paper whose groups cannot
 *    be kept whole (a member absent or in another section) is loaded as `draft` with `group_split` counted and is never Terbit-ed;
 *  - `section.mark_budget` is V2's, else the sum of the placed leaf marks (a choose-N section: the share of N of them).
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, toJson } from '../../kit/sql'
import { text } from '../../transform/common'
import { rejectRow } from '../helpers'
import type { QuestionsContext } from '../questions/context'
import { childrenOf, lookupSlugs, readArchiveById, type ArchiveRow } from './archive-source'
import { completeGroups, insertSections, recomputePaper } from './papers-recompute'
import { inferKertas, instructionsOf, intOf, referenceSheetsOf, ruleTypeOf, type KertasEvidence } from './plan'

export interface PlacementPlan {
  question_id: string
  number_label: string | null
  /** The question the V2 placement resolved to before the canonical question was loaded on its own (the wrong dedupe target), when it differs. */
  was?: string | null
  marks_override: number | null
}
export interface SectionPlan {
  label: string
  instruction: string | null
  rule_type: 'all' | 'choose'
  rule_n: number | null
  mark_budget: number | null
  placements: PlacementPlan[]
}

export interface GroupFacts {
  /** question id -> its group id (absent: not in a group). */
  groupOf: ReadonlyMap<string, string>
  /** group id -> member question ids in `group_position` order. */
  members: ReadonlyMap<string, readonly string[]>
}

/**
 * Keeps every stimulus group whole inside its section: the placed members of a group move next to each other, in `group_position` order, at
 * the place of the first one. `split` is true when a group cannot be whole (a member is not placed, or the members sit in different sections).
 */
export function normaliseGroups(sections: readonly SectionPlan[], facts: GroupFacts): { sections: SectionPlan[]; split: boolean } {
  let split = false
  const sectionOfQuestion = new Map<string, number>()
  sections.forEach((s, i) => s.placements.forEach((p) => sectionOfQuestion.set(p.question_id, i)))
  const out = sections.map((s, si) => {
    const placed = new Set(s.placements.map((p) => p.question_id))
    const emitted = new Set<string>()
    const list: PlacementPlan[] = []
    for (const p of s.placements) {
      if (emitted.has(p.question_id)) continue
      const g = facts.groupOf.get(p.question_id)
      if (g === undefined) {
        emitted.add(p.question_id)
        list.push(p)
        continue
      }
      const all = facts.members.get(g) ?? [p.question_id]
      if (all.some((m) => sectionOfQuestion.get(m) !== si)) split = true
      for (const m of all) {
        if (!placed.has(m) || emitted.has(m)) continue
        emitted.add(m)
        list.push(s.placements.find((x) => x.question_id === m) as PlacementPlan)
      }
    }
    return { ...s, placements: list }
  })
  return { sections: out, split }
}

interface V3Question {
  id: string
  group_id: string | null
  subject_id: string | null
  marks: number
}

export function papersStep(c: QuestionsContext): AnyEntityStep {
  const entity = 'exam_papers'
  let statuses: Map<string, string> | undefined
  let rules: Map<string, string> | undefined
  let kertasRef: KertasReference | undefined
  return {
    entity,
    source: c.source,
    extract: (after) => readArchiveById(c.pool, 'exam_papers', after, c.pageSize),
    keyOf: (r: ArchiveRow) => r.id ?? '',
    async load(rows: ArchiveRow[], ctx: BatchContext): Promise<BatchResult> {
      statuses ??= await lookupSlugs(c.pool, 'staging_cloud', 'paper_statuses')
      rules ??= await lookupSlugs(c.pool, 'archive_cloud', 'selection_rules')
      const ids = rows.map((r) => r.id as string)
      const sectionsBy = await childrenOf(c.pool, 'paper_sections', 'exam_paper_id', ids, 't."position", t."id"')
      const sectionIds = [...sectionsBy.values()].flatMap((l) => l.map((s) => s.id as string))
      const pivotBy = await childrenOf(c.pool, 'exam_paper_questions', 'paper_section_id', sectionIds, 't."sort_order", t."id"')
      const bareBy = await childrenOf(c.pool, 'exam_questions', 'paper_section_id', sectionIds, 't."position", t."id"')
      // Questions of the paper that sit in no section (exam_paper_id set, paper_section_id empty): placed in a last section, never dropped.
      const ownBy = await childrenOf(c.pool, 'exam_questions', 'exam_paper_id', ids, 't."position", t."id"')
      const sectionless = new Map<string, ArchiveRow[]>()
      for (const [paperId, list] of ownBy) {
        const free = list.filter((x) => text(x.paper_section_id) === null)
        if (free.length > 0) sectionless.set(paperId, free)
      }
      const eqIds = [...new Set([...pivotBy.values(), ...bareBy.values(), ...sectionless.values()].flatMap((l) => l.map((x) => (x.exam_question_id ?? x.id) as string)))]
      const eqLabel = new Map<string, string | null>()
      if (eqIds.length > 0) {
        const res = await c.pool.query<{ id: string; number_label: string | null }>(`SELECT id::text AS id, number_label FROM archive_cloud.exam_questions WHERE id = ANY($1::bigint[])`, [eqIds])
        for (const r of res.rows) eqLabel.set(r.id, text(r.number_label))
      }
      const mapped = new Map<string, { source: string; legacy_id: string }>()
      if (eqIds.length > 0) {
        const res = await c.pool.query<{ canonical_id: string; source: string; legacy_id: string }>(
          `SELECT canonical_id::text AS canonical_id, source, legacy_id FROM archive_cloud.legacy_canonical_map WHERE canonical_type = 'exam_question' AND canonical_id = ANY($1::bigint[])`,
          [eqIds],
        )
        for (const r of res.rows) mapped.set(r.canonical_id, { source: (r.source ?? '').trim().toLowerCase(), legacy_id: r.legacy_id })
      }
      const users = await ctx.idMap.resolveMany('users', rows.map((r) => (text(r.created_by) ?? '')).filter((x) => x !== ''))
      const cur = await c.curriculum()
      const legacyQuestions = await ctx.idMap.resolveMany('questions', [...mapped.values()].filter((m) => m.source === 'questions').map((m) => m.legacy_id))
      const structured = await ctx.idMap.resolveMany('structured_questions', [...mapped.values()].filter((m) => m.source === 'structured').map((m) => m.legacy_id))
      const canonical = await ctx.idMap.resolveMany('exam_questions', eqIds)
      const resolveQuestion = (eq: string): string | undefined => {
        // A canonical question loaded as its OWN question (an id-map entry of `exam_questions`) is the right one; the legacy projection is only the
        // fallback. So a question first deduped to a legacy one and loaded on its own later is re-pointed by the next run (M-A).
        const own = canonical.get(eq)
        if (own !== undefined) return own
        const m = mapped.get(eq)
        if (m?.source === 'questions') return legacyQuestions.get(m.legacy_id)
        if (m?.source === 'structured') return structured.get(m.legacy_id)
        return undefined
      }
      /** The legacy projection of a canonical question that is now loaded on its own: the placement an earlier run made (the wrong dedupe target). */
      const wasOf = (eq: string): string | null => {
        if (canonical.get(eq) === undefined) return null
        const m = mapped.get(eq)
        const old = m?.source === 'questions' ? legacyQuestions.get(m.legacy_id) : m?.source === 'structured' ? structured.get(m.legacy_id) : undefined
        return old !== undefined && old !== canonical.get(eq) ? old : null
      }
      // V3 facts of every resolved question: subject, group and leaf marks.
      const v3Ids = new Set<string>()
      const resolved = new Map<string, string | undefined>()
      for (const e of eqIds) {
        const q = resolveQuestion(e)
        resolved.set(e, q)
        if (q !== undefined) v3Ids.add(q)
      }
      const facts = new Map<string, V3Question>()
      if (v3Ids.size > 0) {
        const res = await ctx.db.query<{ id: string; group_id: string | null; subject_id: string | null; marks: number }>(
          `SELECT q.id::text AS id, q.group_id::text AS group_id, v.subject_id::text AS subject_id,
                  coalesce((SELECT sum(p.marks) FROM question_parts p WHERE p.question_version_id = v.id AND p.marks IS NOT NULL), 0)::int AS marks
             FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no WHERE q.id = ANY($1::bigint[])`,
          [[...v3Ids]],
        )
        for (const r of res.rows) facts.set(r.id, r)
      }
      const groupIds = [...new Set([...facts.values()].flatMap((f) => (f.group_id === null ? [] : [f.group_id])))]
      const groupFacts: GroupFacts = await readGroupFacts(ctx, groupIds)
      // The members of those groups that no V2 placement names (a recompute adds them to an existing paper): their marks are needed too.
      const unseen = [...groupFacts.members.values()].flat().filter((m) => !facts.has(m))
      if (unseen.length > 0) {
        const more = await ctx.db.query<{ id: string; group_id: string | null; subject_id: string | null; marks: number }>(
          `SELECT q.id::text AS id, q.group_id::text AS group_id, v.subject_id::text AS subject_id,
                  coalesce((SELECT sum(p.marks) FROM question_parts p WHERE p.question_version_id = v.id AND p.marks IS NOT NULL), 0)::int AS marks
             FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no WHERE q.id = ANY($1::bigint[])`,
          [unseen],
        )
        for (const r of more.rows) facts.set(r.id, r)
      }
      const blueprintHeads = new Map<string, number | null>()
      const ref = (kertasRef ??= await readKertasReference(c, ctx))
      // Leaf answer modes of every V2 question of this page (parts with children are not leaves).
      const leafModesOf = new Map<string, string[]>()
      if (eqIds.length > 0) {
        const modes = await c.pool.query<{ eq: string; slug: string }>(
          `SELECT p.exam_question_id::text AS eq, lower(btrim(am.slug)) AS slug FROM archive_cloud.question_parts p JOIN staging_cloud.answer_modes am ON am.id = p.answer_mode_id
            WHERE p.exam_question_id = ANY($1::bigint[]) AND NOT EXISTS (SELECT 1 FROM archive_cloud.question_parts c WHERE c.parent_part_id = p.id)`,
          [eqIds],
        )
        for (const r of modes.rows) leafModesOf.set(r.eq, [...(leafModesOf.get(r.eq) ?? []), r.slug])
      }

      let inserted = 0
      let unchanged = 0
      let updated = 0
      for (const row of rows) {
        const legacyId = row.id ?? ''
        assertSurrogateLegacyId(legacyId, 'migrate:papers')
        const have = await ctx.db.query<{ id: string }>(`SELECT p.id::text AS id FROM etl_id_map m JOIN papers p ON p.id = m.new_id::bigint WHERE m.legacy_source = $1 AND m.entity = $2 AND m.legacy_id = $3`, [ctx.source, entity, legacyId])
        const existingId = have.rows[0]?.id ?? null
        if (existingId === null) await ctx.db.query(`DELETE FROM etl_id_map WHERE legacy_source = $1 AND entity = $2 AND legacy_id = $3`, [ctx.source, entity, legacyId])
        const title = text(row.title)
        if (existingId === null && title === null) {
          rejectRow(ctx, entity, legacyId, { reason: 'INVALID_VALUE', column: 'title' })
          continue
        }
        // Sections and placements.
        const sections: SectionPlan[] = []
        const paperEqs = new Set<string>()
        let hasDocumentSection = false
        let dropped = 0
        for (const s of sectionsBy.get(legacyId) ?? []) {
          const sid = s.id as string
          if (text(s.paper_document_id) !== null) hasDocumentSection = true
          const links = pivotBy.get(sid)
          // The pivot rows (V2 sort order) first, then the section's own questions that the pivot does not list (V2 position order).
          const pivoted: { eq: string; label: string | null; override: number | null }[] = (links ?? []).map((l) => ({ eq: l.exam_question_id as string, label: text(l.number_label) ?? eqLabel.get(l.exam_question_id as string) ?? null, override: intOf(l.marks_override, 1) }))
          const listed = new Set(pivoted.map((e) => e.eq))
          const entries = [...pivoted, ...(bareBy.get(sid) ?? []).filter((l) => !listed.has(l.id as string)).map((l) => ({ eq: l.id as string, label: eqLabel.get(l.id as string) ?? null, override: null }))]
          for (const e of entries) paperEqs.add(e.eq)
          const seen = new Set<string>()
          const placements: PlacementPlan[] = []
          for (const e of entries) {
            const q = resolved.get(e.eq)
            if (q === undefined) {
              dropped += 1
              continue
            }
            if (seen.has(q)) continue
            seen.add(q)
            placements.push({ question_id: q, number_label: e.label, marks_override: e.override, was: wasOf(e.eq) })
          }
          const slug = rules.get(text(s.selection_rule_id) ?? '')
          let rule = ruleTypeOf(slug) ?? 'all'
          const n = intOf(s.select_count, 1)
          if (rule === 'choose' && n === null) {
            rule = 'all'
            c.notes.count('papers.rule_n_missing')
          }
          sections.push({ label: text(s.label) ?? `Bahagian ${sections.length + 1}`, instruction: text(s.instruction_text), rule_type: rule, rule_n: rule === 'choose' ? n : null, mark_budget: intOf(s.mark_budget, 0), placements })
        }
        const free = sectionless.get(legacyId)
        if (free !== undefined) {
          const placements: PlacementPlan[] = []
          const seen = new Set<string>(sections.flatMap((s) => s.placements.map((p) => p.question_id)))
          for (const l of free) {
            paperEqs.add(l.id as string)
            const q = resolved.get(l.id as string)
            if (q === undefined) {
              dropped += 1
              continue
            }
            if (seen.has(q)) continue
            seen.add(q)
            placements.push({ question_id: q, number_label: eqLabel.get(l.id as string) ?? null, marks_override: null, was: wasOf(l.id as string) })
          }
          if (placements.length > 0) {
            sections.push({ label: sections.length === 0 ? 'Bahagian A' : 'Soalan lain', instruction: null, rule_type: 'all', rule_n: null, mark_budget: null, placements })
            c.notes.count('papers.sectionless_questions', placements.length)
          }
        }
        if (dropped > 0) c.notes.count('papers.placement_dropped', dropped)
        // An EXISTING paper that places only some members of a rajah group is completed (the PO rule: every member shows the rajah, a group is never split;
        // V2's defect is repaired, not copied): the missing members are added, adjacent, in group order. A new paper keeps the load-time hold.
        const grouped = normaliseGroups(existingId === null ? sections : completeGroups(sections, groupFacts), groupFacts)
        const hold: string[] = []
        if (grouped.split) {
          hold.push('group_split')
          if (existingId === null) c.notes.count('papers.group_split')
        }
        if (existingId !== null) {
          // M-A: a paper loaded by an earlier run is recomputed when it is still an unedited migration paper (see papers-recompute.ts).
          const outcome = await recomputePaper(ctx, {
            paperId: existingId,
            legacyId,
            sections: grouped.sections,
            split: grouped.split,
            marksOf: (q) => facts.get(q)?.marks ?? 0,
            count: (k, n) => c.notes.count(k, n),
            report: (k, line) => c.notes.addId(k, line),
          })
          if (outcome === 'updated') updated += 1
          else unchanged += 1
          continue
        }
        if (title === null) continue

        // Subject: V2's, else the one subject of the placed questions.
        let subject = text(row.subject_id) === null ? undefined : cur.subjects.get((row.subject_id as string).trim())
        if (subject === undefined) {
          const subjects = new Set(grouped.sections.flatMap((s) => s.placements.map((p) => facts.get(p.question_id)?.subject_id ?? null)).filter((x): x is string => x !== null))
          if (subjects.size === 1) {
            subject = [...subjects][0]
            c.notes.count('papers.subject_from_questions')
          }
        }
        if (subject === undefined) {
          rejectRow(ctx, entity, legacyId, { reason: 'ORPHAN_PARENT', column: 'subject_id' })
          continue
        }
        const evidence: KertasEvidence = {
          raw: row.kertas ?? null,
          coverCode: row.cover_code ?? null,
          title,
          leafModes: [...paperEqs].flatMap((e) => leafModesOf.get(e) ?? []),
          hasDocumentSection,
          objectiveK1: ref.objectiveK1.has(subject),
          structuredKertas: [...(ref.structuredKertas.get(subject) ?? [])].sort(),
        }
        const inferred = inferKertas(evidence)
        let kertas = inferred.kertas
        if (kertas === null) {
          kertas = 1
          hold.push(`kertas_unknown:${inferred.via}`)
          c.notes.count('papers.kertas_unknown')
        } else if (inferred.via !== 'v2') c.notes.count(`papers.kertas_inferred.${inferred.via}`)
        const headKey = `${subject}|${kertas}`
        if (!blueprintHeads.has(headKey)) {
          const head = await ctx.db.query<{ duration_min: number }>(`SELECT duration_min FROM blueprints WHERE subject_id = $1::bigint AND kertas = $2 AND status = 'active'`, [subject, kertas])
          blueprintHeads.set(headKey, head.rows.length > 0 ? (head.rows[0] as { duration_min: number }).duration_min : null)
        }
        const kontrakMinutes = blueprintHeads.get(headKey) ?? null
        const surface: 'simulasi' | 'subjektif' = kontrakMinutes !== null ? 'simulasi' : kertas >= 2 ? 'subjektif' : 'simulasi'
        const ownMinutes = intOf(row.duration_minutes, 1)
        let printed: number
        let durationMinutes: number | null = null
        let legacyUntimed = false
        if (surface === 'subjektif') {
          const ok = ownMinutes !== null && ownMinutes <= 300
          printed = ok ? (ownMinutes as number) : 0
          durationMinutes = ok ? printed : null
          if (!ok && ownMinutes !== null) c.notes.count('papers.duration_out_of_range')
        } else if (ownMinutes !== null) printed = ownMinutes
        else {
          // V2 parity: a V2 paper with no duration was served untimed (elapsed clock, no countdown). It loads untimed (0) and is flagged
          // `legacy_untimed` (0266), the only case where a Simulasi paper may have no duration; it is NOT held and may be published.
          printed = 0
          legacyUntimed = true
          c.notes.count('papers.untimed_legacy')
        }
        const code = text(row.cover_code) ?? `K${kertas}`
        const creator = text(row.created_by)
        const paper = await ctx.db.query<{ id: string }>(
          `INSERT INTO papers (kind, title, subject_id, kertas, paper_code, printed_duration_min, legacy_untimed, surface, duration_minutes, instructions, reference_sheets, status, version, created_by_id, created_at, updated_at)
           VALUES ('pilihan', $1, $2::bigint, $3, $4, $5, $13, $6, $7, $8::text[], $9::jsonb, 'draft', 1, $10::bigint, coalesce($11::timestamptz, now()), coalesce($12::timestamptz, now()))
           RETURNING id::text AS id`,
          [title, subject, kertas, code, printed, surface, durationMinutes, instructionsOf(row.instructions), toJson(referenceSheetsOf(row.reference_assets)), creator === null ? null : (users.get(creator) ?? null), text(row.created_at), text(row.updated_at), legacyUntimed],
        )
        const paperId = (paper.rows[0] as { id: string }).id
        const placed = await insertSections(ctx, paperId, grouped.sections, (q) => facts.get(q)?.marks ?? 0)
        if (placed > 0) c.notes.count('papers.placements_loaded', placed)
        if (grouped.sections.length === 0) c.notes.count('papers.no_sections')
        await ctx.idMap.register(entity, legacyId, paperId)
        if (hold.length > 0) await ctx.idMap.register('exam_paper_holds', legacyId, hold.join(','))
        inserted += 1
        c.notes.count(`papers.surface.${surface}`)
        for (const h of hold) c.notes.count(`papers.hold.${h}`)
      }
      return { inserted, updated, unchanged }
    },
  }
}

/** Reference facts of the kertas inference, read once per run (V3 `spm_subject_configs` and `blueprints`, V2 `paper_blueprints`), keyed by V3 subject id. */
export interface KertasReference {
  objectiveK1: ReadonlySet<string>
  structuredKertas: ReadonlyMap<string, ReadonlySet<number>>
}

async function readKertasReference(c: QuestionsContext, ctx: BatchContext): Promise<KertasReference> {
  const cur = await c.curriculum()
  const objectiveK1 = new Set<string>()
  const structuredKertas = new Map<string, Set<number>>()
  const add = (subject: string, kertas: number): void => {
    if (kertas >= 2 && kertas <= 4) structuredKertas.set(subject, (structuredKertas.get(subject) ?? new Set<number>()).add(kertas))
  }
  const cfg = await ctx.db.query<{ subject_id: string }>(`SELECT subject_id::text AS subject_id FROM spm_subject_configs WHERE target_type = 'spm'`)
  for (const r of cfg.rows) objectiveK1.add(r.subject_id)
  const heads = await ctx.db.query<{ subject_id: string; kertas: number }>(`SELECT subject_id::text AS subject_id, kertas FROM blueprints WHERE status = 'active'`)
  for (const r of heads.rows) add(r.subject_id, r.kertas)
  const v2 = await c.pool.query<{ subject_id: string | null; kertas: string | null; source: string | null; auto_markable: string | null }>(
    `SELECT subject_id::text AS subject_id, kertas::text AS kertas, lower(btrim(source)) AS source, auto_markable::text AS auto_markable FROM archive_cloud.paper_blueprints`,
  )
  for (const r of v2.rows) {
    const subject = r.subject_id === null ? undefined : cur.subjects.get(r.subject_id.trim())
    const kertas = Number(r.kertas)
    if (subject === undefined || !Number.isInteger(kertas)) continue
    if (kertas === 1 && r.source === 'derived' && ['1', 't', 'true'].includes((r.auto_markable ?? '').toLowerCase())) objectiveK1.add(subject)
    else if (r.source !== 'draft') add(subject, kertas)
  }
  return { objectiveK1, structuredKertas }
}

async function readGroupFacts(ctx: BatchContext, groupIds: readonly string[]): Promise<GroupFacts> {
  const groupOf = new Map<string, string>()
  const members = new Map<string, string[]>()
  if (groupIds.length === 0) return { groupOf, members }
  const res = await ctx.db.query<{ id: string; group_id: string }>(
    `SELECT id::text AS id, group_id::text AS group_id FROM questions WHERE group_id = ANY($1::bigint[]) ORDER BY group_id, group_position, id`,
    [groupIds],
  )
  for (const r of res.rows) {
    groupOf.set(r.id, r.group_id)
    members.set(r.group_id, [...(members.get(r.group_id) ?? []), r.id])
  }
  return { groupOf, members }
}

