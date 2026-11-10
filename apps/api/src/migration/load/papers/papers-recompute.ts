/**
 * Re-run of a loaded paper (`migrate:papers`, M-A, KP-14). A paper that exists already is not simply counted "unchanged": a V2 question that was
 * quarantined, held or deduped wrongly at the first run (and loaded or re-pointed by a later run) leaves a paper with a dropped placement, a stale
 * `group_split` hold, or a placement on the wrong legacy question. V2 data cloned into V3 is only ever IMPROVED, so this recompute may
 *  - ADD a missing placement at its V2 place (the placements already there keep their relative order);
 *  - REPOINT a placement that sits on the wrong question of the canonical dedupe (`PlacementPlan.was`) to the canonical question, in place;
 *  - clear or set the `group_split` hold of a DRAFT.
 * It NEVER removes or reorders a placement, never changes a paper's status (a published paper stays published, nothing is unpublished) and never
 * touches an attempt. Each repoint is written to the run report (`papers.repointed`: paper, position, old and new question id).
 *
 * Ownership (nothing an admin touched is changed). A paper is migration-owned and unedited when ALL hold:
 *  - it is `draft` or `published`, `version = 1` (a withdraw and re-publish raises it), and has no admin-added Bahagian;
 *  - its audit trail (`audit_events`, target `bijak_paper`) holds nothing but the Terbit of the migration pass (`bijak.paper.published` /
 *    `bijak.paper.published_override` with NO request id: the pass calls the service in-process; a Studio call always carries one). Every Studio
 *    edit (create, place, remove, order, section, question, withdraw, Terbit) writes an audit row, so any edit leaves a foreign row;
 *  - a published paper also has `updated_at = published_at` (every later edit bumps `updated_at`).
 * A published paper is changed (add or repoint alike) only when that is safe for pupils: 0 exam attempts (V2 pupil results never change; a paper with
 * attempts is skipped and listed in the report as `papers.recompute_skipped_attempts`), no group would be split, and every question added or repointed is
 * placeable under the shared rule in `fixedSet` mode (`papers-servable.ts`, one call; held questions are placed with a placeholder, not refused). Otherwise the paper is left as it is and counted (`papers.recompute_skipped.*`).
 *
 * Concurrency. The paper row is locked FOR UPDATE first (the lock every Studio edit takes), so ownership is read and written under one lock (race A: an
 * edit mid-recompute waits, or has already left a foreign audit row). For a published paper the attempts table is locked against inserts before the
 * last attempts count (race B: an attempt cannot start between the count and the write). Placements are never deleted.
 *
 * Writes are idempotent: the merged placements are compared with the stored ones first, and nothing is written when they agree (a re-run with
 * nothing new changes 0 rows). `updated_at` is never bumped, so the ownership signal survives.
 */
import type { BatchContext } from '../../kit/runner'
import { toJson } from '../../kit/sql'
import { placementOutcome } from './papers-servable'
import type { PlacementPlan, SectionPlan } from './papers-step'

export type RecomputeOutcome = 'updated' | 'unchanged' | 'skipped'

interface Figures {
  question_count: number
  mark_budget: number
}

/** `question_count` and `mark_budget` of a section: V2's budget, else the placed marks (a choose-N section: the share of N of them). */
export function sectionFigures(s: Pick<SectionPlan, 'mark_budget' | 'rule_type' | 'rule_n'> & { placements: readonly unknown[] }, marks: number): Figures {
  const budget = s.mark_budget ?? (s.rule_type === 'choose' && s.rule_n !== null && s.placements.length > 0 ? Math.round((marks * s.rule_n) / s.placements.length) : marks)
  return { question_count: s.placements.length, mark_budget: budget }
}

/** Inserts the sections and placements of a paper (first load, and a paper that has no section yet). Returns the placements inserted. */
export async function insertSections(ctx: BatchContext, paperId: string, sections: readonly SectionPlan[], marksOf: (questionId: string) => number): Promise<number> {
  if (sections.length === 0) return 0
  const secRows = sections.map((s, i) => ({
    position: i + 1,
    label: s.label,
    instruction: s.instruction,
    rule_type: s.rule_type,
    rule_n: s.rule_n,
    ...sectionFigures(s, s.placements.reduce((sum, p) => sum + (p.marks_override ?? marksOf(p.question_id)), 0)),
  }))
  const made = await ctx.db.query<{ id: string; position: number }>(
    `INSERT INTO paper_sections (paper_id, position, label, instruction, rule_type, rule_n, question_count, mark_budget, compulsory, allowed_modes, admin_created)
     SELECT $1::bigint, x.position, x.label, x.instruction, x.rule_type, x.rule_n, x.question_count, x.mark_budget, false, '{}', false
     FROM jsonb_to_recordset($2::jsonb) AS x(position smallint, label text, instruction text, rule_type text, rule_n smallint, question_count int, mark_budget int)
     RETURNING id::text AS id, position::int AS position`,
    [paperId, toJson(secRows)],
  )
  const sectionOf = new Map(made.rows.map((r) => [r.position, r.id]))
  const placementRows = sections.flatMap((s, i) =>
    s.placements.map((p, j) => ({ section_id: sectionOf.get(i + 1), question_id: p.question_id, position: j + 1, number_label: p.number_label, marks_override: p.marks_override })),
  )
  if (placementRows.length > 0) {
    await ctx.db.query(
      `INSERT INTO paper_placements (paper_section_id, question_id, pinned_version_no, position, number_label, marks_override)
       SELECT x.section_id, x.question_id, 1, x.position, x.number_label, x.marks_override
       FROM jsonb_to_recordset($1::jsonb) AS x(section_id bigint, question_id bigint, position smallint, number_label text, marks_override smallint)`,
      [toJson(placementRows)],
    )
  }
  return placementRows.length
}

/**
 * Adds to a section every member of a stimulus group that the paper does not place anywhere, when the section places at least one member of it
 * (appended; `normaliseGroups` then moves the group's members next to each other in group order). A member placed in ANOTHER section is not
 * moved: that group stays split and the paper stays held.
 */
export function completeGroups(sections: readonly SectionPlan[], facts: { groupOf: ReadonlyMap<string, string>; members: ReadonlyMap<string, readonly string[]> }): SectionPlan[] {
  const onPaper = new Set(sections.flatMap((s) => s.placements.map((p) => p.question_id)))
  return sections.map((s) => {
    const extra: PlacementPlan[] = []
    const seen = new Set<string>()
    for (const p of s.placements) {
      const g = facts.groupOf.get(p.question_id)
      if (g === undefined || seen.has(g)) continue
      seen.add(g)
      for (const m of facts.members.get(g) ?? []) {
        if (onPaper.has(m)) continue
        onPaper.add(m)
        extra.push({ question_id: m, number_label: null, marks_override: null })
      }
    }
    return extra.length === 0 ? s : { ...s, placements: [...s.placements, ...extra] }
  })
}

export interface CurrentPlacement {
  question_id: string
  position: number
  number_label: string | null
  marks_override: number | null
  pinned_version_no: number
}
interface CurrentSection {
  id: string
  placements: CurrentPlacement[]
}

/** One entry of a merged section: a placement already there (kept), a repoint (`from` set) or an added one. */
export interface MergedEntry {
  question_id: string
  kind: 'kept' | 'repointed' | 'added'
  from?: string
  plan?: PlacementPlan
  current?: CurrentPlacement
}

/**
 * Merges the V2 plan of a section into the stored placements WITHOUT removing or reordering any: a planned question whose `was` is on the paper
 * replaces it in place; a planned question not on the paper is added after its nearest preceding planned question that is (else at the start).
 */
export function mergeSection(current: readonly CurrentPlacement[], planned: readonly PlacementPlan[]): MergedEntry[] {
  const out: MergedEntry[] = current.map((c) => ({ question_id: c.question_id, kind: 'kept', current: c }))
  const has = (q: string): boolean => out.some((e) => e.question_id === q)
  for (const p of planned) {
    if (p.was === undefined || p.was === null || has(p.question_id)) continue
    const at = out.findIndex((e) => e.question_id === p.was && e.kind === 'kept')
    if (at >= 0) out[at] = { question_id: p.question_id, kind: 'repointed', from: p.was, plan: p, current: (out[at] as MergedEntry).current }
  }
  planned.forEach((p, i) => {
    if (has(p.question_id)) return
    let after = -1
    for (let k = i - 1; k >= 0 && after < 0; k -= 1) after = out.findIndex((e) => e.question_id === (planned[k] as PlacementPlan).question_id)
    out.splice(after + 1, 0, { question_id: p.question_id, kind: 'added', plan: p })
  })
  return out
}

const SAME_AUDIT = `('bijak.paper.published', 'bijak.paper.published_override')`

export interface RecomputeInput {
  paperId: string
  legacyId: string
  /** The planned sections (groups already normalised, in V2 order). */
  sections: readonly SectionPlan[]
  /** True when a stimulus group cannot be kept whole in the plan. */
  split: boolean
  /** Leaf marks of a V3 question (0 when unknown). */
  marksOf: (questionId: string) => number
  count: (key: string, n?: number) => void
  /** Surrogate ids only: `paper:<id>|position:<n>|old:<question id>|new:<question id>`. */
  report: (name: string, line: string) => void
}

export async function recomputePaper(ctx: BatchContext, input: RecomputeInput): Promise<RecomputeOutcome> {
  const { paperId, legacyId, sections } = input
  const db = ctx.db
  // Race A (an admin edit mid-recompute): the Studio takes this same row lock (`BuilderRepository.lockPaper`) before every edit, so an edit waits for this
  // batch transaction and the ownership read below is the state that is written; an edit that committed first shows as a foreign audit row. Taken before any read.
  const locked = await db.query(`SELECT id FROM papers WHERE id = $1::bigint AND kind = 'pilihan' FOR UPDATE`, [paperId])
  if ((locked.rowCount ?? 0) === 0) return 'unchanged'
  const head = await db.query<{ status: string; version: number; stamped: boolean; admin_sections: number; foreign_events: number; attempts: number }>(
    `SELECT p.status, p.version, (p.updated_at = p.published_at) AS stamped,
            (SELECT count(*) FROM paper_sections s WHERE s.paper_id = p.id AND s.admin_created)::int AS admin_sections,
            (SELECT count(*) FROM audit_events a WHERE a.target_type = 'bijak_paper' AND a.target_id = p.id::text
                AND NOT (a.action IN ${SAME_AUDIT} AND a.request_id IS NULL))::int AS foreign_events,
            (SELECT count(*) FROM exam_attempts t WHERE t.paper_id = p.id)::int AS attempts
       FROM papers p WHERE p.id = $1::bigint`,
    [paperId],
  )
  const h = head.rows[0]
  if (h === undefined) return 'unchanged'
  const published = h.status === 'published'
  if ((h.status !== 'draft' && !published) || h.version !== 1 || h.admin_sections > 0 || h.foreign_events > 0 || (published && !h.stamped)) {
    input.count('papers.recompute_skipped.edited_or_not_owned')
    return 'unchanged'
  }

  const cur = await db.query<{ section_id: string; question_id: string | null; position: number | null; number_label: string | null; marks_override: number | null; pinned_version_no: number | null }>(
    `SELECT s.id::text AS section_id, pl.question_id::text AS question_id, pl.position::int AS position, pl.number_label,
            pl.marks_override::int AS marks_override, pl.pinned_version_no
       FROM paper_sections s LEFT JOIN paper_placements pl ON pl.paper_section_id = s.id
      WHERE s.paper_id = $1::bigint ORDER BY s.position, pl.position`,
    [paperId],
  )
  const current: CurrentSection[] = []
  for (const r of cur.rows) {
    let sec = current.find((x) => x.id === r.section_id)
    if (sec === undefined) {
      sec = { id: r.section_id, placements: [] }
      current.push(sec)
    }
    if (r.question_id !== null) sec.placements.push({ question_id: r.question_id, position: r.position as number, number_label: r.number_label, marks_override: r.marks_override, pinned_version_no: r.pinned_version_no as number })
  }

  let wrote = false
  if (current.length === 0 && sections.length > 0) {
    // A paper with no section at all (nothing to preserve): the sections and placements are loaded now.
    if (published) {
      input.count('papers.recompute_skipped.section_count')
    } else {
      await insertSections(ctx, paperId, sections, input.marksOf)
      input.count('papers.recomputed.draft')
      wrote = true
    }
  } else if (current.length !== sections.length) {
    input.count('papers.recompute_skipped.section_count')
  } else {
    const merged = sections.map((s, i) => mergeSection((current[i] as CurrentSection).placements, s.placements))
    const changed = merged.some((m) => m.some((e) => e.kind !== 'kept'))
    if (changed && (await mayApply(ctx, h.attempts, published, input, merged))) {
      await writeMerged(ctx, input, current, merged, published)
      input.count(published ? 'papers.recomputed.published' : 'papers.recomputed.draft')
      wrote = true
    }
  }

  // --- the group_split hold of a draft (the placement order is never touched here)
  if (!published) {
    const holdRow = await db.query<{ new_id: string }>(`SELECT new_id FROM etl_id_map WHERE legacy_source = $1 AND entity = 'exam_paper_holds' AND legacy_id = $2`, [ctx.source, legacyId])
    const had = holdRow.rows[0] === undefined ? [] : holdRow.rows[0].new_id.split(',')
    const next = [...had.filter((x) => x !== 'group_split'), ...(input.split ? ['group_split'] : [])]
    if (next.join(',') !== had.join(',')) {
      await db.query(`DELETE FROM etl_id_map WHERE legacy_source = $1 AND entity = 'exam_paper_holds' AND legacy_id = $2`, [ctx.source, legacyId])
      if (next.length > 0) await ctx.idMap.register('exam_paper_holds', legacyId, next.join(','))
      input.count(input.split ? 'papers.recompute_hold_added' : 'papers.recompute_hold_cleared')
      wrote = true
    }
  }
  return wrote ? 'updated' : 'unchanged'
}

/** Safety of a change: always no split group for a published paper; a repoint needs no attempt on the paper; what is added or repointed must be eligible. */
async function mayApply(ctx: BatchContext, attempts: number, published: boolean, input: RecomputeInput, merged: readonly (readonly MergedEntry[])[]): Promise<boolean> {
  const entries = merged.flat()
  if (!published) return true
  // G-2: a published paper changes (add or repoint) only with 0 exam attempts: V2 pupil results never change. Listed in the report.
  if (attempts > 0) {
    input.count('papers.recompute_skipped.has_attempts')
    input.report('papers.recompute_skipped_attempts', `paper:${input.paperId}`)
    return false
  }
  // Race B (an attempt starting mid-write): the attempts table is locked against inserts until this transaction ends, then the count is read again.
  await ctx.db.query('LOCK TABLE exam_attempts IN SHARE ROW EXCLUSIVE MODE')
  const again = await ctx.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM exam_attempts WHERE paper_id = $1::bigint`, [input.paperId])
  if ((again.rows[0]?.n ?? 0) > 0) {
    input.count('papers.recompute_skipped.has_attempts')
    input.report('papers.recompute_skipped_attempts', `paper:${input.paperId}`)
    return false
  }
  if (input.split) {
    input.count('papers.recompute_skipped.group_split')
    return false
  }
  return placeable(ctx, input, entries)
}

/**
 * The shared rule in mode 'fixedSet' (KP-14/KP-15): a V2-published paper is a set a person already chose, so nothing is refused; a held or
 * unresolved-picture question is placed and shown with a placeholder. The refusal branch stays for a mode that would refuse.
 */
async function placeable(ctx: BatchContext, input: RecomputeInput, entries: readonly MergedEntry[]): Promise<boolean> {
  const touched = [...new Set(entries.filter((e) => e.kind !== 'kept').map((e) => e.question_id))]
  const out = await placementOutcome(ctx.db, touched)
  if (out.refused.length > 0) {
    input.count('papers.recompute_skipped.unservable')
    return false
  }
  if (out.placeholder.length > 0) input.count('papers.recompute_placeholder', out.placeholder.length)
  return true
}

/**
 * Writes the merged placements of the sections that CHANGED (other sections keep their rows and V2 figures). No DELETE: a repoint is an UPDATE of
 * `question_id` on the same placement row, the positions are shifted out of the way and set to the final order (the unique index on
 * (section, position) is checked row by row), and the added placements are INSERTed. A kept placement keeps its pin, label and marks.
 */
async function writeMerged(ctx: BatchContext, input: RecomputeInput, current: readonly CurrentSection[], merged: readonly (readonly MergedEntry[])[], published: boolean): Promise<void> {
  const db = ctx.db
  const fresh = published
    ? (await db.query<{ id: string; live: number }>(`SELECT id::text AS id, live_version_no AS live FROM questions WHERE id = ANY($1::bigint[])`, [merged.flat().filter((e) => e.kind !== 'kept').map((e) => e.question_id)])).rows
    : []
  const liveOf = new Map(fresh.map((r) => [r.id, r.live]))
  for (const [i, m] of merged.entries()) {
    if (!m.some((e) => e.kind !== 'kept')) continue
    const section = current[i] as CurrentSection
    const planSection = input.sections[i] as SectionPlan
    const marksOfEntry = (e: MergedEntry): number => {
      if (e.kind === 'kept') return (e.current as CurrentPlacement).marks_override ?? input.marksOf(e.question_id)
      return published ? ((e.plan as PlacementPlan).marks_override ?? input.marksOf(e.question_id)) : (e.current?.marks_override ?? (e.plan as PlacementPlan).marks_override ?? input.marksOf(e.question_id))
    }
    for (const [j, e] of m.entries()) {
      if (e.kind !== 'repointed') continue
      input.report('papers.repointed', `paper:${input.paperId}|position:${j + 1}|old:${e.from}|new:${e.question_id}`)
      await db.query(
        `UPDATE paper_placements SET question_id = $3::bigint,
                pinned_version_no = CASE WHEN $4::boolean THEN $5::int ELSE pinned_version_no END,
                marks_override = CASE WHEN $4::boolean THEN $6::smallint ELSE marks_override END
          WHERE paper_section_id = $1::bigint AND question_id = $2::bigint`,
        [section.id, e.from, e.question_id, published, liveOf.get(e.question_id) ?? 1, marksOfEntry(e)],
      )
    }
    const existing = m.flatMap((e, j) => (e.kind === 'added' ? [] : [{ question_id: e.question_id, position: j + 1 }]))
    await db.query(`UPDATE paper_placements SET position = position + 1000 WHERE paper_section_id = $1::bigint`, [section.id])
    if (existing.length > 0) {
      await db.query(
        `UPDATE paper_placements p SET position = x.position
           FROM jsonb_to_recordset($2::jsonb) AS x(question_id bigint, position smallint) WHERE p.paper_section_id = $1::bigint AND p.question_id = x.question_id`,
        [section.id, toJson(existing)],
      )
    }
    const added = m.flatMap((e, j) =>
      e.kind !== 'added'
        ? []
        : [
            {
              section_id: section.id,
              question_id: e.question_id,
              // A draft is pinned at 1 as at load; a published paper's new placement is pinned at the live version with its frozen marks.
              pinned_version_no: published ? (liveOf.get(e.question_id) ?? 1) : 1,
              position: j + 1,
              number_label: (e.plan as PlacementPlan).number_label,
              marks_override: published ? marksOfEntry(e) : (e.plan as PlacementPlan).marks_override,
            },
          ],
    )
    if (added.length > 0) {
      await db.query(
        `INSERT INTO paper_placements (paper_section_id, question_id, pinned_version_no, position, number_label, marks_override)
         SELECT x.section_id, x.question_id, x.pinned_version_no, x.position, x.number_label, x.marks_override
         FROM jsonb_to_recordset($1::jsonb) AS x(section_id bigint, question_id bigint, pinned_version_no int, position smallint, number_label text, marks_override smallint)`,
        [toJson(added)],
      )
    }
    const f = sectionFigures({ mark_budget: planSection.mark_budget, rule_type: planSection.rule_type, rule_n: planSection.rule_n, placements: m }, m.reduce((sum, e) => sum + marksOfEntry(e), 0))
    await db.query(`UPDATE paper_sections SET question_count = $2, mark_budget = $3 WHERE id = $1::bigint`, [section.id, f.question_count, f.mark_budget])
  }
}
