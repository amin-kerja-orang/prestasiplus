/**
 * Pure publish rules. `checkTagGate` is the D9 rule BE-09 enforces in `setStatus(..., 'approved')`
 * and on `POST /questions` with `approved`. `checkKeysGate` is the key-completeness rule offered to
 * BE-10 for its publish gate; BE-09 does not call it (no quality gates here, Q-6).
 */
import { INTAKE_GATE_MESSAGES, type QuestionPart } from '@pp/contract'

import { PUBLISH_TAG_MESSAGES } from './errors'
import { isLeaf, leavesOf } from './grading'

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

/** Problems keyed by the part path: key marks must equal the leaf marks and the sum of the points. */
export function checkKeysGate(parts: readonly QuestionPart[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const { path, leaf } of leavesOf(parts)) {
    if (!isLeaf(leaf)) continue
    if (leaf.mode === 'essay_choice') {
      const ids = leaf.topics.map((t) => t.id)
      if (leaf.topics.length < 2 || leaf.topics.length > 6 || new Set(ids).size !== ids.length || leaf.topics.some((t) => t.label.trim() === '')) {
        fields[`parts.${path}.topics`] = ESSAY_CHOICE_TOPICS_MESSAGE
      }
    }
    if (leaf.mode === 'working' || leaf.mode === 'drawing' || leaf.mode === 'essay' || leaf.mode === 'essay_choice') {
      const key = leaf.key
      if (key.kind === 'points') {
        const total = pointsTotal(key)
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
