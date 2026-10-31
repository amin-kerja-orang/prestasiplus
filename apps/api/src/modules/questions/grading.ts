/**
 * Pure grading of the OBJECTIVE leaf modes (BE-09 AC 6). No database, no clock, no randomness.
 * Subjective modes (working, essay, drawing) return `needs_review`: the marking engine is
 * `@pp/exam-core` (BE-14) and never produces a score here.
 *
 * Rules (each documented once, tested in `grading.spec.ts`):
 * - mcq: the answer label equals `key.correct`; full marks or 0.
 * - short_text: trimmed, whitespace collapsed, case-insensitive unless `caseSensitive`; any accepted
 *   value matches. With `anyOrder` the answer is split on `;`, `,` or a newline and the tokens must
 *   equal the accepted values as a set (one token per blank).
 * - numeric: the answer matches an accepted value within its tolerance (`abs`, or `rel` as a fraction
 *   of the value, default exact); when the accepted value names a unit the answer must give the same
 *   unit or one of `unitAlt`.
 * - match_letter / table_fill: every pair or cell must be right (all or nothing).
 */
import type { QuestionPart } from '@pp/contract'

import type { GradeResult, PartAnswerValue, QuestionGrade } from './types'

export type QuestionLeaf = Extract<QuestionPart, { mode: string }>
type KeyOf<M extends QuestionLeaf['mode']> = Extract<QuestionLeaf, { mode: M }>['key']

export const isLeaf = (part: QuestionPart): part is QuestionLeaf => 'mode' in part

const collapse = (text: string): string => text.trim().replace(/\s+/g, ' ')
const fold = (text: string, caseSensitive: boolean): string => (caseSensitive ? collapse(text) : collapse(text).toLowerCase())

const verdict = (correct: boolean, marks: number): GradeResult => ({
  kind: 'graded',
  correct,
  marks: correct ? marks : 0,
  maxMarks: marks,
})

export function gradeMcq(key: KeyOf<'mcq'>, label: string, marks: number): GradeResult {
  return verdict(label.trim().toUpperCase() === key.correct, marks)
}

/** BE-42: the chosen label must be one of the labels flagged correct (several or none may be). */
export function gradePkskChoice(key: KeyOf<'pksk_choice'>, label: string, marks: number): GradeResult {
  return verdict(key.correct.includes(label.trim().toUpperCase()), marks)
}

export function gradeShortText(key: KeyOf<'short_text'>, text: string, marks: number): GradeResult {
  const cs = key.caseSensitive === true
  const accepted = key.values.map((v) => fold(v, cs))
  if (key.anyOrder === true) {
    const tokens = text
      .split(/[;,\n]/)
      .map((t) => fold(t, cs))
      .filter((t) => t !== '')
    const a = [...accepted].sort()
    const t = [...tokens].sort()
    return verdict(a.length === t.length && a.every((v, i) => v === t[i]), marks)
  }
  return verdict(accepted.includes(fold(text, cs)), marks)
}

export function gradeNumeric(key: KeyOf<'numeric'>, value: number, unit: string | undefined, marks: number): GradeResult {
  if (!Number.isFinite(value)) return verdict(false, marks)
  const ok = key.values.some((v) => {
    const tol = v.tol ?? 0
    const limit = v.tolKind === 'rel' ? tol * Math.abs(v.v) : tol
    if (Math.abs(value - v.v) > limit + 1e-12) return false
    if (v.unit === undefined) return true
    const given = unit?.trim().toLowerCase()
    return given !== undefined && [v.unit, ...(v.unitAlt ?? [])].some((u) => u.trim().toLowerCase() === given)
  })
  return verdict(ok, marks)
}

export function gradeMapping(key: KeyOf<'match_letter'>, map: Readonly<Record<string, string>>, marks: number): GradeResult {
  const entries = Object.entries(key.map)
  return verdict(
    entries.length > 0 && entries.every(([item, label]) => map[item]?.trim().toUpperCase() === label),
    marks,
  )
}

export function gradeCells(key: KeyOf<'table_fill'>, cells: Readonly<Record<string, string>>, marks: number): GradeResult {
  const entries = Object.entries(key.cells)
  return verdict(
    entries.length > 0 &&
      entries.every(([cell, accepted]) => {
        const given = cells[cell]
        return given !== undefined && accepted.some((a) => fold(a, false) === fold(given, false))
      }),
    marks,
  )
}

/** One leaf against one answer. A value of the wrong kind for the mode is simply wrong (graded, 0). */
export function gradeLeaf(leaf: QuestionLeaf, answer: PartAnswerValue): GradeResult {
  const m = leaf.marks
  switch (leaf.mode) {
    case 'mcq':
      return answer.kind === 'option' ? gradeMcq(leaf.key, answer.label, m) : verdict(false, m)
    case 'pksk_choice':
      // No options: an essay, marked by the simulated marker outside this function.
      if (leaf.options.length === 0) return { kind: 'needs_review', maxMarks: m }
      return answer.kind === 'option' ? gradePkskChoice(leaf.key, answer.label, m) : verdict(false, m)
    case 'short_text':
      return answer.kind === 'text' ? gradeShortText(leaf.key, answer.text, m) : verdict(false, m)
    case 'numeric':
      return answer.kind === 'number' ? gradeNumeric(leaf.key, answer.value, answer.unit, m) : verdict(false, m)
    case 'match_letter':
      return answer.kind === 'mapping' ? gradeMapping(leaf.key, answer.map, m) : verdict(false, m)
    case 'table_fill':
      return answer.kind === 'cells' ? gradeCells(leaf.key, answer.cells, m) : verdict(false, m)
    case 'working':
    case 'essay':
    case 'essay_choice':
    case 'drawing':
      return { kind: 'needs_review', maxMarks: m }
  }
}

/** Leaves in reading order with their path (labels joined with `.`). */
export function leavesOf(parts: readonly QuestionPart[], prefix: readonly string[] = []): { path: string; leaf: QuestionLeaf }[] {
  const out: { path: string; leaf: QuestionLeaf }[] = []
  for (const part of parts) {
    const path = [...prefix, part.label]
    if (isLeaf(part)) out.push({ path: path.join('.'), leaf: part })
    else out.push(...leavesOf(part.children as QuestionPart[], path))
  }
  return out
}

/** Grades a whole question; a leaf with no answer scores 0 (or `needs_review` for subjective modes). */
export function gradeQuestion(
  questionId: string,
  parts: readonly QuestionPart[],
  answers: readonly { path?: string; value: PartAnswerValue }[],
): QuestionGrade {
  const leaves = leavesOf(parts)
  const results = leaves.map(({ path, leaf }) => {
    const answer = answers.find((a) => (a.path ?? (leaves.length === 1 ? path : undefined)) === path)
    const result: GradeResult = answer
      ? gradeLeaf(leaf, answer.value)
      : leaf.mode === 'working' || leaf.mode === 'essay' || leaf.mode === 'drawing'
        ? { kind: 'needs_review', maxMarks: leaf.marks }
        : verdict(false, leaf.marks)
    return { path, result }
  })
  return {
    questionId,
    parts: results,
    marks: results.reduce((s, r) => s + (r.result.kind === 'graded' ? r.result.marks : 0), 0),
    maxMarks: results.reduce((s, r) => s + r.result.maxMarks, 0),
    needsReview: results.some((r) => r.result.kind === 'needs_review'),
  }
}
