/**
 * DOCUMENTED COPY of BE-09's `publish-gate.ts` (`checkKeysGate`, `checkTagGate`) with the helpers it
 * needs from `grading.ts` (`isLeaf`, `leavesOf`) and `errors.ts` (`PUBLISH_TAG_MESSAGES`). BE-09 is
 * not merged, and the workflow may not import from `modules/questions/*` outside `workflow/`.
 * Swap to BE-09's exports once it merges; messages are kept identical (BM).
 */
import type { QuestionPart } from '@pp/contract'

type PartLeaf = Extract<QuestionPart, { mode: string }>
type WorkingLeaf = Extract<QuestionPart, { mode: 'working' }>

export const PUBLISH_TAG_MESSAGES = {
  subjectId: 'Sila pilih subjek.',
  educationLevelId: 'Sila pilih tahap pendidikan.',
  unitId: 'Sila pilih unit DSKP.',
  spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.',
  tp: 'Sila pilih tahap penguasaan (TP).',
} as const

export const KEYS_MARKS_MESSAGE = 'Jumlah markah tidak sepadan dengan skema.'

export interface TagGateInput {
  subjectId: string | null
  educationLevelId: string | null
  unitId: string | null
  spIds: readonly string[]
  /** `difficulty_tp` (1..6). */
  tp: number | null
}

export const isLeaf = (part: QuestionPart): part is PartLeaf => 'mode' in part

/** Leaves in reading order with their path (labels joined with `.`). */
export function leavesOf(parts: readonly QuestionPart[], prefix: readonly string[] = []): { path: string; leaf: PartLeaf }[] {
  const out: { path: string; leaf: PartLeaf }[] = []
  for (const part of parts) {
    const path = [...prefix, part.label]
    if (isLeaf(part)) out.push({ path: path.join('.'), leaf: part })
    else out.push(...leavesOf((part as { children: QuestionPart[] }).children, path))
  }
  return out
}

/** The `fields` map of a failed tag check; empty means it holds. */
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
function pointsTotal(key: WorkingLeaf['key']): number | null {
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
    if (leaf.mode === 'working' || leaf.mode === 'drawing' || leaf.mode === 'essay') {
      const key = leaf.key
      if (key.kind === 'points') {
        const total = pointsTotal(key)
        if (key.marks !== leaf.marks || (total !== null && total !== key.marks)) fields[`parts.${path}.key`] = KEYS_MARKS_MESSAGE
      } else if (key.marks !== leaf.marks) {
        fields[`parts.${path}.key`] = KEYS_MARKS_MESSAGE
      }
    }
  }
  return fields
}
