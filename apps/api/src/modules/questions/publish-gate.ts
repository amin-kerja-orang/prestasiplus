/**
 * Pure publish rules. `checkTagGate` is the D9 rule BE-09 enforces in `setStatus(..., 'approved')`
 * and on `POST /questions` with `approved`. `checkKeysGate` is the key-completeness rule offered to
 * BE-10 for its publish gate; BE-09 does not call it (no quality gates here, Q-6).
 */
import { INTAKE_GATE_MESSAGES, type QuestionPart } from '@pp/contract'

import { PUBLISH_TAG_MESSAGES } from './errors'
import { isLeaf, leavesOf } from './grading'
import { reachableIds, schemeTotal, type SchemeDeduction, type SchemeKeyLike } from './scheme-total'

export { schemeTotal, reachableIds, type SchemeKeyLike }

export interface TagGateInput {
  subjectId: string | null
  educationLevelId: string | null
  unitId: string | null
  spIds: readonly string[]
  /** `difficulty_tp` (1..6). */
  tp: number | null
  /** R-DSKP (45 section 4.1): `curriculum_nodes` exist for the Subjek + Tingkatan. Unit, SP and TP are required only then. Absent = true (the strict rule). */
  hasDskpNodes?: boolean
  /** The Subjek + Tingkatan has chapters: the Bab is required (NO_CHAPTER). Absent = false (nothing to choose). */
  hasChapters?: boolean
  chapterId?: string | null
  /** Codes of the SP nodes that are not under the unit (FR-ADM-QE4.3). */
  spOutsideUnit?: readonly string[]
}

export const MAX_SP_NODES = 3

/** Publish gate text for an `essay_choice` leaf without 2 to 6 distinct, non-blank topics. */
export const ESSAY_CHOICE_TOPICS_MESSAGE = 'Esei pilihan mesti mempunyai 2 hingga 6 tajuk yang berbeza.'

/**
 * The `fields` map of a failed gate; empty means the gate holds. Subject and level are always required; unit, SP (1 to 3) and TP only where
 * DSKP nodes exist for the Subjek + Tingkatan (R-DSKP, D112(3)); the Bab where the Subjek + Tingkatan has chapters (NO_CHAPTER).
 */
export function checkTagGate(input: TagGateInput): Record<string, string> {
  const fields: Record<string, string> = {}
  if (input.subjectId === null) fields.subjectId = PUBLISH_TAG_MESSAGES.subjectId
  if (input.educationLevelId === null) fields.educationLevelId = PUBLISH_TAG_MESSAGES.educationLevelId
  if (input.hasDskpNodes !== false) {
    if (input.unitId === null) fields.unitId = PUBLISH_TAG_MESSAGES.unitId
    if (input.spIds.length < 1 || input.spIds.length > MAX_SP_NODES) fields.spIds = PUBLISH_TAG_MESSAGES.spIds
    else if ((input.spOutsideUnit ?? []).length > 0) fields.spIds = INTAKE_GATE_MESSAGES.spNotInTaxonomy(input.spOutsideUnit![0]!)
    if (input.tp === null || input.tp < 1 || input.tp > 6) fields.tp = PUBLISH_TAG_MESSAGES.tp
  }
  if (input.hasChapters === true && (input.chapterId ?? null) === null) fields.chapterId = PUBLISH_TAG_MESSAGES.chapterId
  return fields
}

/** NO_DIFFICULTY (row 9, S): refused only when neither the typed Kesukaran nor a TP exists (readers fall back to `least(5, tp)`, else 3). */
export function checkDifficultyGate(input: { difficultyLevel?: number | null; tp: number | null }): Record<string, string> {
  return (input.difficultyLevel ?? null) === null && input.tp === null ? { difficultyLevel: PUBLISH_TAG_MESSAGES.difficultyLevel } : {}
}

/** STEM_SHORT (row 10, S): the stem of an MCQ (one top-level MCQ leaf) has at least 10 characters. A blank stem is the REQUIRED_FIELD item, not this one. */
export function checkStemGate(stem: string | null | undefined, parts: readonly QuestionPart[]): Record<string, string> {
  const text = (stem ?? '').trim()
  if (text === '' || parts.length !== 1) return {}
  const only = parts[0]!
  if (!isLeaf(only) || only.mode !== 'mcq') return {}
  return Array.from(text).length < 10 ? { questionText: PUBLISH_TAG_MESSAGES.stem } : {}
}

/** Sum of the marks a points key can award: free points, plus `anyN` of each group. */
function pointsTotal(key: Extract<QuestionPart, { mode: 'working' }>['key']): number | null {
  if (key.paths && key.paths.length > 0) return null
  const grouped = new Set((key.groups ?? []).flatMap((g) => g.pointIds))
  const byId = new Map(key.points.map((p) => [p.id, p.marks]))
  const free = key.points.filter((p) => !grouped.has(p.id)).reduce((s, p) => s + p.marks, 0)
  const groups = (key.groups ?? []).reduce((s, g) => {
    const each = g.eachMarks ?? Math.max(0, ...g.pointIds.map((id) => byId.get(id) ?? 0))
    return s + each * Math.min(g.anyN, g.pointIds.length)
  }, 0)
  return free + groups
}

/* -------------------------------------------------------------------------------------------------
 * Scheme engine (S1-T09a part 3): best reachable marks (45 section 7.0) and the scheme validator. Pure: no database, no clock.
 * The key is read structurally (v1 and v2 shapes), so the engine does not depend on the parse path that produced it.
 * ------------------------------------------------------------------------------------------------- */

/**
 * The maximum marks a scheme can award (45 section 7.0 "Best reachable marks").
 * - v1 key (`scheme_v` absent): the existing `pointsTotal` semantics; a points key with `paths` returns null (not evaluated).
 * - v2 points: the best single alternative (`alternatives`; none = one alternative holding every point); deductions and `zeroIf` never raise it.
 * - rubric: `perCriterion` = sum of the criteria `max`; otherwise the highest band (or floor band) upper bound. `contentPoints` add nothing.
 * - any other kind (option, accepted, mapping, ...): `marks` as passed, else the key's own `marks`, else null.
 * `essay_choice` shares one key across its alternatives, so they never add.
 */
export function bestReachable(key: SchemeKeyLike, marks?: number): number | null {
  if (key.kind === 'points') {
    if (key.scheme_v !== 2) return pointsTotal(key as unknown as Parameters<typeof pointsTotal>[0])
    return schemeTotal(key)
  }
  if (key.kind === 'rubric') {
    if (key.scheme_v === 2 && key.scoring === 'perCriterion') return (key.criteria ?? []).reduce((s, c) => s + (c.max ?? 0), 0)
    return Math.max(0, ...(key.bands ?? []).map((b) => b.range[1]), ...(key.floorBand ? [key.floorBand.range[1]] : []))
  }
  return marks ?? key.marks ?? null
}

export interface SchemeIssue {
  code: string
  message: string
  path: string
}
export interface SchemeValidateOptions {
  /** Path prefix of the issues, e.g. `parts.a.key`. */
  path: string
  /** `modeConfig.example` is present: the sum check is skipped (card). */
  example?: boolean
  /** Label of the leaf (for `dependsOnPart`); with `partLabels` it detects a missing or later part. */
  ownLabel?: string
  /** Leaf labels of the question in order. */
  partLabels?: readonly string[]
  /** `modeConfig.dependsOnPart`. */
  dependsOnPart?: string
  /** Question-level deductions (`scheme_rules`); those with scope `part` are checked against the leaf marks. */
  schemeRules?: { deductions?: readonly SchemeDeduction[] }
}

/** 45 section 4.1 rows 13 to 16 and 3.1.7 (R1 copy, D113). Codes without PRD text return the code as the message. */
export const SCHEME_MESSAGES = {
  sum: (n: number, m: number) => `Jumlah skema (${String(n)}) mesti sama dengan markah bahagian (${String(m)}).`,
  depends: (label: string) => `Mata ${label} bergantung pada mata yang tiada.`,
  bandRange: (marks: number) => `Julat band tidak meliputi 0 hingga ${String(marks)}.`,
  noScheme: '⚠ tiada skema',
  penalty: 'Jumlah penalti melebihi markah bahagian.',
} as const
/** The deduction code is `SCHEME_PENALTY` (team-dd ruling on issue 558, D5); the text has no other source. */
export const SCHEME_PENALTY_CODE = 'SCHEME_PENALTY'

/**
 * Does the band set cover every mark 1..marks? (floor band included.) Mark 0 is implicit: example 7.1 has no floor band and passes the
 * gate (45 section 7.1), so a missing 0 is not a gap; any hole above 0 is.
 */
function bandsCover(key: SchemeKeyLike, marks: number): boolean {
  const ranges = [...(key.bands ?? []).map((b) => b.range), ...(key.floorBand ? [key.floorBand.range] : [])]
  for (let m = 1; m <= marks; m++) if (!ranges.some(([lo, hi]) => lo <= m && m <= hi)) return false
  return true
}

/**
 * Validates one leaf scheme against the leaf marks. A `null`/`undefined` key is `NO_SCHEME`. Only meaningful for `points` and `rubric`
 * keys; every other kind returns no issues (its completeness is the contract's).
 */
export function validateScheme(key: SchemeKeyLike | null | undefined, leafMarks: number, opts: SchemeValidateOptions): SchemeIssue[] {
  const issues: SchemeIssue[] = []
  const add = (code: string, message: string, sub = '') => issues.push({ code, message, path: opts.path + sub })
  if (key == null) return [{ code: 'NO_SCHEME', message: SCHEME_MESSAGES.noScheme, path: opts.path }]
  if (key.kind !== 'points' && key.kind !== 'rubric') return issues

  if (opts.dependsOnPart !== undefined && opts.partLabels !== undefined) {
    const at = opts.partLabels.indexOf(opts.dependsOnPart)
    const own = opts.ownLabel === undefined ? -1 : opts.partLabels.indexOf(opts.ownLabel)
    if (at < 0 || (own >= 0 && at >= own)) add('SCHEME_DEPENDS', 'SCHEME_DEPENDS', '.dependsOnPart')
  }
  if (key.kind === 'points') {
    const points = key.points ?? []
    const ids = new Set(points.map((p) => p.id))
    const ok = reachableIds(points)
    points.forEach((p, i) => {
      const missing = (p.requires ?? []).some((r) => !ids.has(r) || r === p.id)
      const badEcf = p.ecf !== undefined && opts.partLabels !== undefined && !opts.partLabels.includes(p.ecf.fromPart)
      // A cycle makes a point unreachable although every id exists.
      if (missing || badEcf || !ok.has(p.id)) add('SCHEME_DEPENDS', SCHEME_MESSAGES.depends(p.label ?? p.id), `.points.${String(i)}`)
    })
  }
  if (!opts.example) {
    if (key.kind === 'rubric') {
      const max = bestReachable(key) ?? 0
      if (max !== leafMarks || (key.marks !== undefined && key.marks !== leafMarks)) add('SCHEME_SUM', SCHEME_MESSAGES.sum(max, leafMarks), '.marks')
      // perCriterion: the bands only describe levels (45 7.5 lists one band of [5, 5]); the criteria maxima decide the total.
      if (key.scoring !== 'perCriterion' && !bandsCover(key, leafMarks)) add('BAND_RANGE', SCHEME_MESSAGES.bandRange(leafMarks))
    } else {
      const max = bestReachable(key)
      if (key.marks !== undefined && key.marks !== leafMarks) add('SCHEME_SUM', SCHEME_MESSAGES.sum(key.marks, leafMarks), '.marks')
      else if (max !== null && max !== leafMarks) add('SCHEME_SUM', SCHEME_MESSAGES.sum(max, leafMarks), '.points')
    }
  }
  const deductions = [...(key.deductions ?? []), ...(opts.schemeRules?.deductions ?? []).filter((d) => d.scope === 'part')]
  if (deductions.reduce((s, d) => s + (d.cap ?? d.amount), 0) > leafMarks) add(SCHEME_PENALTY_CODE, SCHEME_MESSAGES.penalty, '.deductions')
  return issues
}

/** Problems keyed by the part path: key marks must equal the leaf marks and the sum of the points. */
export function checkKeysGate(parts: readonly QuestionPart[]): Record<string, string> {
  const fields: Record<string, string> = {}
  const leaves = leavesOf(parts)
  for (const { path, leaf } of leaves) {
    if (!isLeaf(leaf)) continue
    if (leaf.mode === 'essay_choice') {
      const ids = leaf.topics.map((t) => t.id)
      if (leaf.topics.length < 2 || leaf.topics.length > 6 || new Set(ids).size !== ids.length || leaf.topics.some((t) => t.label.trim() === '')) {
        fields[`parts.${path}.topics`] = ESSAY_CHOICE_TOPICS_MESSAGE
      }
    }
    if (leaf.mode === 'working' || leaf.mode === 'drawing' || leaf.mode === 'essay' || leaf.mode === 'essay_choice') {
      const key = leaf.key
      if ((key as SchemeKeyLike).scheme_v === 2) {
        // Scheme v2 (45 section 7.0): the shared validator; the first issue is the field message.
        const mc = (leaf as { modeConfig?: { example?: unknown; dependsOnPart?: string } }).modeConfig
        const [first] = validateScheme(key as SchemeKeyLike, leaf.marks, {
          path: `parts.${path}.key`,
          example: mc?.example !== undefined,
          ownLabel: path,
          partLabels: leaves.map((l) => l.path),
          ...(mc?.dependsOnPart !== undefined ? { dependsOnPart: mc.dependsOnPart } : {}),
        })
        if (first) fields[`parts.${path}.key`] = first.message
        continue
      }
      if (key.kind === 'points') {
        const total = bestReachable(key as SchemeKeyLike)
        if (key.marks !== leaf.marks || (total !== null && total !== key.marks)) {
          fields[`parts.${path}.key`] = 'Jumlah markah tidak sepadan dengan skema.'
        }
      } else if (key.marks !== leaf.marks) {
        fields[`parts.${path}.key`] = 'Jumlah markah tidak sepadan dengan skema.'
      }
    }
  }
  return fields
}
