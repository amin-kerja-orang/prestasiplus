/**
 * `paper_blueprints` (36) + `blueprint_sections` (23) -> `blueprints` / `blueprint_sections` (T-B10-2, design 10.3, OC-8).
 *
 * Loaded as REFERENCE Kontrak: `source` `draft` (V2 `derived`) or `spec` (V2 `spec` and `confirmed`; never `verified`, that needs an Admin
 * Pusat verification record), `serves_students = false`, version 1. A (subject, kertas) that already has an active V3 head (the seeded
 * Kontrak) is skipped and counted: the seeded head is authoritative.
 *
 * Design deviation (reported): the design says `status = draft`, but the Studio lists and edits only `active` Kontrak (`listActive`), so a
 * `draft` row would be invisible. The row is therefore `active` with source `draft` / `spec` and no serving flag, the same shape the
 * Studio's own "create a Draf Kontrak" writes (`BlueprintsService.create`); the one-active-per-(subject, kertas) index makes the skip rule
 * above mandatory.
 *
 * Gaps filled from V2's own data and never invented: `duration` from the median of the V2 papers of the same subject and kertas (a
 * blueprint with none is a reject: V3 requires a positive duration); a section's `question_count` from `select_count` (rule all), else
 * the median question count of the same-ordinal section of those papers, else the blueprint loads without sections (counted).
 * `structure_hash` is computed with V3's own helper (`structureHashOf(toStandard(...))`).
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, toJson } from '../../kit/sql'
import { enumKey, flag, ok, reject, text, type Outcome, type Staged } from '../../transform/common'
import { structureHashOf, toStandard } from '../../../modules/exam/blueprints/blueprint-standard'
import { rejectRow } from '../helpers'
import type { QuestionsContext } from '../questions/context'
import { childrenOf, lookupSlugs, readArchiveById, type ArchiveRow } from './archive-source'
import { allowedModesOf, intOf, kertasOf, median, ruleTypeOf } from './plan'

/** Per (subject, kertas): durations and per-ordinal section question counts of the V2 papers (read once per run). */
export interface PaperStats {
  durations: Map<string, number[]>
  sectionCounts: Map<string, Map<number, number[]>>
}

export async function readPaperStats(c: QuestionsContext): Promise<PaperStats> {
  const durations = new Map<string, number[]>()
  const sectionCounts = new Map<string, Map<number, number[]>>()
  const papers = await c.pool.query<{ id: string; subject_id: string | null; kertas: string | null; duration_minutes: string | null }>(
    `SELECT id::text AS id, subject_id::text AS subject_id, kertas::text AS kertas, duration_minutes::text AS duration_minutes FROM archive_cloud.exam_papers`,
  )
  const sections = await c.pool.query<{ exam_paper_id: string; id: string; position: string | null; n: string }>(
    `SELECT s.exam_paper_id::text AS exam_paper_id, s.id::text AS id, s.position::text AS position,
            (SELECT count(*) FROM archive_cloud.exam_paper_questions q WHERE q.paper_section_id = s.id)::text AS n
       FROM archive_cloud.paper_sections s ORDER BY s.exam_paper_id, s.position, s.id`,
  )
  const byPaper = new Map<string, number[]>()
  for (const s of sections.rows) byPaper.set(s.exam_paper_id, [...(byPaper.get(s.exam_paper_id) ?? []), Number(s.n)])
  for (const p of papers.rows) {
    const kertas = kertasOf(p.kertas)
    if (p.subject_id === null || kertas === null) continue
    const key = `${p.subject_id}|${kertas}`
    const d = intOf(p.duration_minutes, 1)
    if (d !== null) durations.set(key, [...(durations.get(key) ?? []), d])
    const counts = sectionCounts.get(key) ?? new Map<number, number[]>()
    ;(byPaper.get(p.id) ?? []).forEach((n, i) => {
      if (n > 0) counts.set(i + 1, [...(counts.get(i + 1) ?? []), n])
    })
    sectionCounts.set(key, counts)
  }
  return { durations, sectionCounts }
}

export interface BlueprintSectionPlan {
  position: number
  label: string
  instruction: string | null
  rule_type: 'all' | 'choose'
  rule_n: number | null
  question_count: number
  mark_budget: number | null
  allowed_modes: string[]
}
export interface BlueprintPlan {
  legacyId: string
  subject_id: string
  kertas: number
  code: string
  source: 'draft' | 'spec'
  duration_min: number
  total_marks: number | null
  auto_markable: boolean | null
  sections: BlueprintSectionPlan[]
  notes: string[]
}

export interface BlueprintInput {
  row: Staged
  sections: readonly Staged[]
  subjectCode: string
  stats: PaperStats
  ruleSlugs: ReadonlyMap<string, string>
}

export function planBlueprint(input: BlueprintInput, subjects: ReadonlyMap<string, string>): Outcome<BlueprintPlan> {
  const { row } = input
  const notes: string[] = []
  const subjectRef = text(row.subject_id)
  const subject = subjectRef === null ? undefined : subjects.get(subjectRef)
  if (subject === undefined || subjectRef === null) return reject('ORPHAN_PARENT', 'subject_id')
  const kertas = intOf(row.kertas, 1)
  if (kertas === null || kertas > 4) return reject('INVALID_VALUE', 'kertas')
  const key = `${subjectRef}|${kertas}`
  const own = intOf(row.duration_minutes, 1)
  const derived = own ?? median(input.stats.durations.get(key) ?? [])
  if (derived === null) return reject('INVALID_VALUE', 'duration_minutes')
  if (own === null) notes.push('duration_from_papers')
  const flagValue = flag(row.auto_markable, true)
  const code = text(row.paper_code) ?? `${input.subjectCode}/K${kertas}`
  if (text(row.paper_code) === null) notes.push('code_defaulted')
  const sourceRaw = enumKey(row.source)
  const source: 'draft' | 'spec' = sourceRaw === 'derived' || sourceRaw === 'draft' ? 'draft' : 'spec'
  if (sourceRaw === 'confirmed') notes.push('confirmed_as_spec')

  const sections: BlueprintSectionPlan[] = []
  const ordered = [...input.sections].sort((a, b) => (intOf(a.position, 0) ?? 0) - (intOf(b.position, 0) ?? 0) || Number(a.id) - Number(b.id))
  let noSections = false
  const counts = input.stats.sectionCounts.get(key)
  for (const [i, s] of ordered.entries()) {
    const label = text(s.label)
    if (label === null) {
      noSections = true
      break
    }
    const slug = input.ruleSlugs.get(text(s.selection_rule_id) ?? '')
    let rule = ruleTypeOf(slug) ?? 'all'
    const n = intOf(s.select_count, 1)
    let ruleN = rule === 'choose' ? n : null
    if (rule === 'choose' && ruleN === null) {
      rule = 'all'
      ruleN = null
      notes.push('rule_n_missing')
    }
    const questionCount = rule === 'all' && n !== null ? n : (median(counts?.get(i + 1) ?? []) ?? n)
    if (questionCount === null || questionCount < 1) {
      noSections = true
      break
    }
    const modes = allowedModesOf(s.expected_answer_modes)
    if (modes.dropped > 0) notes.push('mode_dropped')
    sections.push({
      position: i + 1,
      label,
      instruction: text(s.instruction),
      rule_type: rule,
      rule_n: ruleN,
      question_count: questionCount,
      mark_budget: intOf(s.mark_budget, 0),
      allowed_modes: modes.modes,
    })
  }
  if (noSections && ordered.length > 0) {
    sections.length = 0
    notes.push('blueprint_no_sections')
  } else if (ordered.length === 0) notes.push('blueprint_no_sections')
  return ok({
    legacyId: (row.id ?? '').trim(),
    subject_id: subject,
    kertas,
    code,
    source,
    duration_min: derived,
    total_marks: intOf(row.total_marks, 0),
    auto_markable: flagValue === 'invalid' ? null : flagValue,
    sections,
    notes,
  })
}

/** The structure hash by V3's own helper, over the plan as the persisted row would read. */
export function hashOfPlan(plan: BlueprintPlan, subjectCode: string): string {
  const row = {
    kertas: plan.kertas,
    code: plan.code,
    version: 1,
    durationMin: plan.duration_min,
    kbatMarks: null,
    levelShare: null,
    subPartRamp: false,
    questionCount: null,
    sections: plan.sections.map((s) => ({
      position: s.position,
      label: s.label,
      ruleType: s.rule_type,
      ruleN: s.rule_n,
      questionCount: s.question_count,
      markBudget: s.mark_budget,
      compulsory: false,
      pool: null,
      allowedModes: s.allowed_modes,
      profile: null,
      quota: null,
      kbatMarks: null,
      kbatReviewed: true,
      marksPerQuestion: null,
    })),
  }
  return structureHashOf(toStandard(row as never, subjectCode))
}

export function blueprintsStep(c: QuestionsContext): AnyEntityStep {
  const entity = 'paper_blueprints'
  let stats: PaperStats | undefined
  let ruleSlugs: Map<string, string> | undefined
  return {
    entity,
    source: c.source,
    extract: (after) => readArchiveById(c.pool, 'paper_blueprints', after, c.pageSize),
    keyOf: (r: ArchiveRow) => r.id ?? '',
    async load(rows: ArchiveRow[], ctx: BatchContext): Promise<BatchResult> {
      stats ??= await readPaperStats(c)
      ruleSlugs ??= await lookupSlugs(c.pool, 'archive_cloud', 'selection_rules')
      const cur = await c.curriculum()
      const sectionsBy = await childrenOf(c.pool, 'blueprint_sections', 'paper_blueprint_id', rows.map((r) => r.id as string), 't."position", t."id"')
      const existing = await ctx.db.query<{ legacy_id: string }>(
        `SELECT m.legacy_id FROM etl_id_map m JOIN blueprints b ON b.id = m.new_id::bigint WHERE m.legacy_source = $1 AND m.entity = $2 AND m.legacy_id = ANY($3::text[])`,
        [ctx.source, entity, rows.map((r) => r.id ?? '')],
      )
      const have = new Set(existing.rows.map((r) => r.legacy_id))
      await ctx.db.query(
        `DELETE FROM etl_id_map m WHERE m.legacy_source = $1 AND m.entity = $2 AND m.legacy_id = ANY($3::text[]) AND NOT EXISTS (SELECT 1 FROM blueprints b WHERE b.id = m.new_id::bigint)`,
        [ctx.source, entity, rows.map((r) => r.id ?? '')],
      )
      const subjectCodes = await ctx.db.query<{ id: string; code: string }>(`SELECT id::text AS id, code FROM subjects`)
      const codeOf = new Map(subjectCodes.rows.map((r) => [r.id, r.code]))
      let inserted = 0
      let unchanged = 0
      let excluded = 0
      for (const row of rows) {
        const legacyId = row.id ?? ''
        assertSurrogateLegacyId(legacyId, 'migrate:papers')
        if (have.has(legacyId)) {
          unchanged += 1
          continue
        }
        const subjectNew = cur.subjects.get((row.subject_id ?? '').trim())
        const out = planBlueprint(
          { row, sections: sectionsBy.get(legacyId) ?? [], subjectCode: codeOf.get(subjectNew ?? '') ?? 'X', stats, ruleSlugs },
          cur.subjects,
        )
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          continue
        }
        const plan = out.value
        const head = await ctx.db.query(`SELECT 1 FROM blueprints WHERE subject_id = $1::bigint AND kertas = $2 AND status = 'active'`, [plan.subject_id, plan.kertas])
        if (head.rows.length > 0) {
          excluded += 1
          c.notes.count('blueprints.blueprint_exists')
          continue
        }
        const taken = await ctx.db.query(`SELECT 1 FROM blueprints WHERE code = $1 AND version = 1`, [plan.code])
        if (taken.rows.length > 0) {
          rejectRow(ctx, entity, legacyId, { reason: 'DUPLICATE_KEY', column: 'paper_code' })
          continue
        }
        const subjectCode = codeOf.get(plan.subject_id) ?? 'X'
        const made = await ctx.db.query<{ id: string }>(
          `INSERT INTO blueprints (subject_id, kertas, code, version, status, source, duration_min, total_marks, auto_markable, instructions, reference_sheets, structure_hash, serves_students)
           VALUES ($1::bigint, $2, $3, 1, 'active', $4, $5, $6, $7, '{}', '[]'::jsonb, $8, false) RETURNING id::text AS id`,
          [plan.subject_id, plan.kertas, plan.code, plan.source, plan.duration_min, plan.total_marks, plan.auto_markable, hashOfPlan(plan, subjectCode)],
        )
        const id = (made.rows[0] as { id: string }).id
        if (plan.sections.length > 0) {
          await ctx.db.query(
            `INSERT INTO blueprint_sections (blueprint_id, position, label, instruction, rule_type, rule_n, question_count, mark_budget, compulsory, allowed_modes)
             SELECT $1::bigint, x.position, x.label, x.instruction, x.rule_type, x.rule_n, x.question_count, x.mark_budget, false,
                    COALESCE(ARRAY(SELECT jsonb_array_elements_text(x.allowed_modes)), '{}')
             FROM jsonb_to_recordset($2::jsonb) AS x(position smallint, label text, instruction text, rule_type text, rule_n smallint, question_count int, mark_budget int, allowed_modes jsonb)`,
            [id, toJson(plan.sections)],
          )
        }
        await ctx.idMap.register(entity, legacyId, id)
        inserted += 1
        for (const n of plan.notes) c.notes.count(`blueprints.${n}`)
        c.notes.count(`blueprints.source.${plan.source}`)
      }
      return { inserted, unchanged, excluded }
    },
  }
}
