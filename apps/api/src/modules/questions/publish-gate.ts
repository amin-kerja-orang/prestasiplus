/**
 * Pure publish rules. `checkTagGate` is the D9 rule BE-09 enforces in `setStatus(..., 'published')`
 * and on `POST /questions` with `published`. `checkKeysGate` is the key-completeness rule offered to
 * BE-10 for its publish gate; BE-09 does not call it (no quality gates here, Q-6).
 */
import type { QuestionPart } from '@pp/contract'

import { PUBLISH_TAG_MESSAGES } from './errors'
import { isLeaf, leavesOf } from './grading'

export interface TagGateInput {
  subjectId: string | null
  educationLevelId: string | null
  unitId: string | null
  spIds: readonly string[]
  /** `difficulty_tp` (1..6). */
  tp: number | null
}

export const MAX_SP_NODES = 3

/** The `fields` map of a failed gate; empty means the gate holds. */
export function checkTagGate(input: TagGateInput): Record<string, string> {
  const fields: Record<string, string> = {}
  if (input.subjectId === null) fields.subjectId = PUBLISH_TAG_MESSAGES.subjectId
  if (input.educationLevelId === null) fields.educationLevelId = PUBLISH_TAG_MESSAGES.educationLevelId
  if (input.unitId === null) fields.unitId = PUBLISH_TAG_MESSAGES.unitId
  if (input.spIds.length < 1) fields.spIds = PUBLISH_TAG_MESSAGES.spIds
  if (input.tp === null || input.tp < 1 || input.tp > 6) fields.tp = PUBLISH_TAG_MESSAGES.tp
  return fields
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
    if (leaf.mode === 'working' || leaf.mode === 'drawing' || leaf.mode === 'essay') {
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
