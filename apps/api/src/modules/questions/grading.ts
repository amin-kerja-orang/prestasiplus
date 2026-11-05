/**
 * Pure grading of the leaf modes (BE-09 AC 6; S1-T09a part 5, 46 section 3). No database, no clock, no randomness. The one grader (46 section 3);
 * `@pp/exam-core` keeps only helpers this file imports (`math-expr`, `normaliseText`).
 *
 * Part statuses (OPT-STATUS-BAHAGIAN, `partStatusOf`): `betul` (awarded = marks), `separa` (0 < awarded < marks), `salah` (0, an answer given),
 * `kosong` (nothing entered: result `blank`, no mark row), `belum_dimarkah` (result `needs_review`: the pupil decides, never a silent 0).
 * A worked-example leaf (`modeConfig.example`) is never answered and returns no row.
 *
 * Rules (each documented once, tested in `grading.spec.ts` and `grading-v3.spec.ts`):
 * - mcq / true_false: the answer label equals `key.correct` or is listed in `key.accepted`; full marks or 0. `true_false` is an `mcq` leaf
 *   with the two fixed options Betul / Salah.
 * - mcq_multi (mcq leaf, key kind `options` with `correctOptionIds`, M-MULTI): k correct options, c correct ticked, w wrong ticked. marks 1:
 *   1 only when c = k and w = 0. marks > 1: max(0, floor(marks x (c - w) / k)). Ticking every option scores 0.
 * - short_text (M-SHORT): both sides lower-cased, NFD without diacritics, every character outside a-z0-9 a space, spaces collapsed and trimmed
 *   (only trimmed when `caseSensitive`); an exact phrase. A wrong answer of 3 or more words is `belum_dimarkah` (the accepted answers are
 *   shown), fewer than 3 words is `salah`. With `anyOrder` the answer is split on `;`, `,` or a newline and the tokens must equal the accepted
 *   values as a set (one token per blank).
 * - numeric (M-NUM): the answer matches an accepted value within its tolerance (`abs`, or `rel` as a fraction of the value, default exact);
 *   when the accepted value names a unit the answer must give the same unit (case and spacing ignored) or one of `unitAlt`, else the reason
 *   "Unit tidak ditulis." / "Unit tidak betul.". Text that cannot be parsed is `belum_dimarkah`.
 * - working with a scheme v2 points key (M-WORK): `scheme-grading.ts`. A v1 key is not evaluated: `belum_dimarkah`.
 * - essay / essay_choice / drawing: never auto-marked, `belum_dimarkah` (blank: `kosong`).
 * - table_fill (M-TABLE): never auto-awarded; the keyed cells give the suggestion "Cadangan automatik: {k} daripada {n} sel sepadan".
 * - match_letter: every pair must be right (all or nothing); a gap is its own leaf.
 */
import { normaliseText } from '@pp/exam-core/grading'
import { latexToPlain, normaliseUnit, numericValue, splitAnyUnit, splitUnit } from '@pp/exam-core/math-expr'
import type { QuestionPart, QuestionPartV3, QuestionSchemeRules } from '@pp/contract'

import { gradeWorking, type WorkingAnswer, type WorkingKey } from './scheme-grading'
import type { GradeResult, PartAnswerValue, PartStatus, QuestionGrade } from './types'

export type QuestionLeaf = Extract<QuestionPart, { mode: string }>
/** A leaf as stored since S1-T09a: also the `mcq_multi` key and the scheme v2 keys. */
export type QuestionLeafV3 = Extract<QuestionPartV3, { mode: string }>
type KeyOf<M extends QuestionLeaf['mode']> = Extract<QuestionLeaf, { mode: M }>['key']

export const isLeaf = (part: QuestionPart): part is QuestionLeaf => 'mode' in part

/** `modeConfig.example` ("Contoh (tidak dimarkah)", W-06): shown filled, never answered, no mark row, not counted. */
export const isExampleLeaf = (leaf: { modeConfig?: { example?: unknown } | undefined }): boolean => leaf.modeConfig?.example !== undefined

const verdict = (correct: boolean, marks: number, extra: { reasons?: string[] } = {}): GradeResult => ({
  kind: 'graded',
  correct,
  marks: correct ? marks : 0,
  maxMarks: marks,
  ...extra,
})

/** Status of a result (OPT-STATUS-BAHAGIAN). */
export function partStatusOf(result: GradeResult): PartStatus {
  if (result.kind === 'blank') return 'kosong'
  if (result.kind === 'needs_review') return 'belum_dimarkah'
  if (result.maxMarks > 0 && result.marks >= result.maxMarks) return 'betul'
  return result.marks > 0 ? 'separa' : 'salah'
}

/** MCQ identity is the option label (D7); `accepted` lists further labels that earn the marks (45:463; may include `correct`). */
export function gradeMcq(key: KeyOf<'mcq'>, label: string, marks: number): GradeResult {
  const given = label.trim().toUpperCase()
  return verdict(given === key.correct || (key.accepted ?? []).includes(given), marks)
}

/**
 * M-MULTI. `optionLabels` are all labels of the leaf; `ticked` the labels the pupil ticked (unknown labels and repeats are ignored).
 * Ticking every option scores 0. `correct` (betul) only when c = k and w = 0.
 */
export function gradeMcqMulti(key: { correctOptionIds: readonly string[] }, optionLabels: readonly string[], ticked: readonly string[], marks: number): GradeResult {
  const options = new Set(optionLabels)
  const right = new Set(key.correctOptionIds)
  const given = new Set(ticked.map((t) => t.trim().toUpperCase()).filter((t) => options.has(t)))
  const k = right.size
  let c = 0
  for (const g of given) if (right.has(g)) c += 1
  const w = given.size - c
  const exact = c === k && w === 0
  const allTicked = options.size > 0 && given.size === options.size
  let awarded = 0
  if (!allTicked && k > 0) awarded = marks === 1 ? (exact ? 1 : 0) : Math.min(marks, Math.max(0, Math.floor((marks * (c - w)) / k)))
  return { kind: 'graded', correct: exact && awarded === marks, marks: awarded, maxMarks: marks }
}

/** BE-42: the chosen label must be one of the labels flagged correct (several or none may be). */
export function gradePkskChoice(key: KeyOf<'pksk_choice'>, label: string, marks: number): GradeResult {
  return verdict(key.correct.includes(label.trim().toUpperCase()), marks)
}

/** M-SHORT normalisation: lower-case, NFD without diacritics, every character outside a-z0-9 a space, collapsed, trimmed (`caseSensitive`: trimmed only). */
const shortFold = (text: string, caseSensitive: boolean): string => (caseSensitive ? text.trim() : normaliseText(text))
const wordsIn = (text: string): number => {
  const t = normaliseText(text)
  return t === '' ? 0 : t.split(' ').length
}
/** A wrong short answer of this many words or more is `belum_dimarkah` (K20). */
export const SHORT_REVIEW_WORDS = 3

export function gradeShortText(key: KeyOf<'short_text'>, text: string, marks: number): GradeResult {
  const cs = key.caseSensitive === true
  const accepted = key.values.map((v) => shortFold(v, cs))
  let right: boolean
  if (key.anyOrder === true) {
    const tokens = text
      .split(/[;,\n]/)
      .map((t) => shortFold(t, cs))
      .filter((t) => t !== '')
    const a = [...accepted].sort()
    const t = [...tokens].sort()
    right = a.length === t.length && a.every((v, i) => v === t[i])
  } else {
    right = accepted.includes(shortFold(text, cs))
  }
  if (right) return verdict(true, marks)
  if (wordsIn(text) >= SHORT_REVIEW_WORDS) return { kind: 'needs_review', maxMarks: marks, acceptedShown: [...key.values] }
  return verdict(false, marks)
}

export const UNIT_MISSING = 'Unit tidak ditulis.'
export const UNIT_WRONG = 'Unit tidak betul.'

/** M-NUM on a parsed value. A unit named by the accepted value must be given (case and spacing ignored) as that unit or one of `unitAlt`. */
export function gradeNumeric(key: KeyOf<'numeric'>, value: number, unit: string | undefined, marks: number): GradeResult {
  if (!Number.isFinite(value)) return verdict(false, marks)
  let reason: string | undefined
  for (const v of key.values) {
    const tol = v.tol ?? 0
    const limit = v.tolKind === 'rel' ? tol * Math.abs(v.v) : tol
    if (Math.abs(value - v.v) > limit + 1e-12) continue
    if (v.unit === undefined) return verdict(true, marks)
    const given = unit === undefined ? '' : normaliseUnit(unit)
    if (given !== '' && [v.unit, ...(v.unitAlt ?? [])].some((u) => normaliseUnit(u) === given)) return verdict(true, marks)
    reason ??= given === '' ? UNIT_MISSING : UNIT_WRONG
  }
  return verdict(false, marks, reason === undefined ? {} : { reasons: [reason] })
}

/** M-NUM on typed text ("12 cm", "1/2", "0,5"): unparseable text is `belum_dimarkah`; a trailing unit counts as the unit given. */
export function gradeNumericText(key: KeyOf<'numeric'>, text: string, unitField: string | undefined, marks: number): GradeResult {
  const value = numericValue(text)
  if (value === null) return { kind: 'needs_review', maxMarks: marks }
  const wanted = key.values.find((v) => v.unit !== undefined)?.unit
  const inline = wanted === undefined ? splitAnyUnit(latexToPlain(text)).unit : splitUnit(latexToPlain(text), wanted).unit
  const given = unitField !== undefined && unitField.trim() !== '' ? unitField : inline === '' ? undefined : inline
  return gradeNumeric(key, value, given, marks)
}

export function gradeMapping(key: KeyOf<'match_letter'>, map: Readonly<Record<string, string>>, marks: number): GradeResult {
  const entries = Object.entries(key.map)
  return verdict(
    entries.length > 0 && entries.every(([item, label]) => map[item]?.trim().toUpperCase() === label),
    marks,
  )
}

/** M-TABLE: a keyed cell matches by M-SHORT, or numerically (M-NUM) when both sides are numbers. */
const cellMatches = (given: string, accepted: string): boolean => {
  const a = normaliseText(accepted)
  if (a !== '' && normaliseText(given) === a) return true
  const x = numericValue(given)
  const y = numericValue(accepted)
  return x !== null && y !== null && Math.abs(x - y) <= 1e-12
}
export const tableSuggestion = (k: number, n: number): string => `Cadangan automatik: ${String(k)} daripada ${String(n)} sel sepadan`

/** No auto-award: the suggestion is k x marks per cell, rounded half up; the status stays `belum_dimarkah` until the pupil self-marks. */
export function gradeCells(key: KeyOf<'table_fill'>, cells: Readonly<Record<string, string>>, marks: number): GradeResult {
  const entries = Object.entries(key.cells)
  const n = entries.length
  const k = entries.filter(([cell, accepted]) => {
    const given = cells[cell]
    return given !== undefined && accepted.some((a) => cellMatches(given, a))
  }).length
  const suggested = n === 0 ? 0 : Math.floor((2 * k * marks + n) / (2 * n))
  return { kind: 'needs_review', maxMarks: marks, suggestion: { marks: suggested, message: tableSuggestion(k, n) } }
}

/** Context of one leaf: earlier finals (ECF) and the question's scheme rules. */
export interface GradeOptions {
  schemeRules?: QuestionSchemeRules | null | undefined
}
interface LeafContext {
  previousFinals: Record<string, number | null>
  partDeductions: { code: string; amount: number; cap?: number }[]
  hasZeroRules: boolean
}
const noContext = (): LeafContext => ({ previousFinals: {}, partDeductions: [], hasZeroRules: false })

/** Nothing entered (`kosong`). A number is never blank (NaN is unreadable, not empty). */
function isBlankAnswer(a: PartAnswerValue): boolean {
  switch (a.kind) {
    case 'option':
      return a.label.trim() === ''
    case 'options':
      return a.labels.length === 0
    case 'text':
      return a.text.trim() === ''
    case 'number':
      return false
    case 'mapping':
      return Object.values(a.map).every((v) => v.trim() === '')
    case 'cells':
      return Object.values(a.cells).every((v) => v.trim() === '')
    case 'working':
      return !(a.final ?? '').trim() && !(a.text ?? '').trim() && !(a.steps ?? []).some((x) => x.trim()) && (a.photos ?? 0) === 0
    case 'photo':
      return a.count === 0
  }
}

const SUBJECTIVE = new Set<string>(['essay', 'essay_choice', 'drawing'])
type AnyLeaf = QuestionLeaf | QuestionLeafV3

/** One leaf against one answer. A value of the wrong kind for the mode is simply wrong (graded, 0). */
export function gradeLeaf(leaf: AnyLeaf, answer: PartAnswerValue, context: Partial<LeafContext> = {}): GradeResult {
  const m = leaf.marks
  if (isBlankAnswer(answer)) return { kind: 'blank', maxMarks: m }
  const key = leaf.key as { kind: string; scheme_v?: number }
  switch (leaf.mode) {
    case 'mcq': {
      if (key.kind === 'options') {
        const k = leaf.key as { correctOptionIds: readonly string[] }
        const ticked = answer.kind === 'options' ? answer.labels : answer.kind === 'option' ? [answer.label] : null
        if (ticked === null) return verdict(false, m)
        return gradeMcqMulti(k, (leaf as { options: { label: string }[] }).options.map((o) => o.label), ticked, m)
      }
      return answer.kind === 'option' ? gradeMcq(leaf.key as KeyOf<'mcq'>, answer.label, m) : verdict(false, m)
    }
    case 'pksk_choice':
      // No options: an essay, marked by the simulated marker outside this function.
      if (leaf.options.length === 0) return { kind: 'needs_review', maxMarks: m }
      return answer.kind === 'option' ? gradePkskChoice(leaf.key, answer.label, m) : verdict(false, m)
    case 'short_text':
      return answer.kind === 'text' ? gradeShortText(leaf.key, answer.text, m) : verdict(false, m)
    case 'numeric':
      if (answer.kind === 'number') return Number.isFinite(answer.value) ? gradeNumeric(leaf.key, answer.value, answer.unit, m) : { kind: 'needs_review', maxMarks: m }
      if (answer.kind === 'text') return gradeNumericText(leaf.key, answer.text, undefined, m)
      if (answer.kind === 'working') return gradeNumericText(leaf.key, answer.final ?? answer.text ?? '', answer.unit, m)
      return verdict(false, m)
    case 'match_letter':
      return answer.kind === 'mapping' ? gradeMapping(leaf.key, answer.map, m) : verdict(false, m)
    case 'table_fill':
      return answer.kind === 'cells' ? gradeCells(leaf.key, answer.cells, m) : verdict(false, m)
    case 'working': {
      // Only a scheme v2 points key is evaluated; a v1 key (no matcher fields) is the pupil's to self-mark.
      if (key.kind !== 'points' || key.scheme_v !== 2) return { kind: 'needs_review', maxMarks: m }
      const a: WorkingAnswer | null =
        answer.kind === 'working' ? answer : answer.kind === 'text' ? { text: answer.text } : answer.kind === 'photo' ? { photos: answer.count } : null
      if (a === null) return verdict(false, m)
      return gradeWorking(leaf.key as unknown as WorkingKey, a, m, {
        previousFinals: context.previousFinals ?? {},
        partDeductions: context.partDeductions ?? [],
        hasZeroRules: context.hasZeroRules ?? false,
      })
    }
    default:
      // essay, essay_choice, drawing: never auto-marked.
      return SUBJECTIVE.has(leaf.mode) ? { kind: 'needs_review', maxMarks: m } : verdict(false, m)
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

/** The numeric final a leaf answer carries (for ECF of a later leaf), or null. */
function finalOf(a: PartAnswerValue): number | null {
  if (a.kind === 'number') return Number.isFinite(a.value) ? a.value : null
  if (a.kind === 'working') return numericValue(a.final ?? '')
  if (a.kind === 'text') return numericValue(a.text)
  return null
}

/**
 * Grades a whole question; a leaf with no answer is `kosong` (a `blank` result, no mark row). A worked-example leaf has no entry at all.
 * `options.schemeRules` carries the question-level deductions of scope `part` and the `zeroIf` rules.
 */
export function gradeQuestion(
  questionId: string,
  parts: readonly (QuestionPart | QuestionPartV3)[],
  answers: readonly { path?: string; value: PartAnswerValue }[],
  options: GradeOptions = {},
): QuestionGrade {
  const leaves = (leavesOf(parts as readonly QuestionPart[]) as unknown as { path: string; leaf: AnyLeaf }[]).filter((l) => !isExampleLeaf(l.leaf))
  const base = noContext()
  base.partDeductions = (options.schemeRules?.deductions ?? []).filter((d) => d.scope === 'part').map((d) => ({ code: d.code, amount: d.amount, ...(d.cap === undefined ? {} : { cap: d.cap }) }))
  base.hasZeroRules = (options.schemeRules?.zeroIf?.length ?? 0) > 0
  const results = leaves.map(({ path, leaf }) => {
    const answer = answers.find((a) => (a.path ?? (leaves.length === 1 ? path : undefined)) === path)
    const result: GradeResult = answer ? gradeLeaf(leaf, answer.value, base) : { kind: 'blank', maxMarks: leaf.marks }
    if (answer) {
      const final = finalOf(answer.value)
      base.previousFinals[leaf.label] = final
      base.previousFinals[path] = final
    }
    return { path, result, status: partStatusOf(result) }
  })
  return {
    questionId,
    parts: results,
    marks: results.reduce((s, r) => s + (r.result.kind === 'graded' ? r.result.marks : 0), 0),
    maxMarks: results.reduce((s, r) => s + r.result.maxMarks, 0),
    needsReview: results.some((r) => r.result.kind === 'needs_review'),
  }
}

/** The leaves that write a mark row: one per ANSWERED leaf (a `kosong` leaf and a worked-example leaf write none). A `belum_dimarkah` row carries the suggestion (0 when none). */
export function markRows(grade: QuestionGrade): { path: string; status: PartStatus; marks: number; isCorrect: boolean }[] {
  return grade.parts.flatMap((p) => {
    if (p.result.kind === 'blank') return []
    if (p.result.kind === 'needs_review') return [{ path: p.path, status: p.status, marks: p.result.suggestion?.marks ?? 0, isCorrect: false }]
    return [{ path: p.path, status: p.status, marks: p.result.marks, isCorrect: p.result.correct }]
  })
}
