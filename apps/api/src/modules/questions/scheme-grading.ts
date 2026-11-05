/**
 * Marks a `working` leaf with a scheme v2 points key (46 section 3.2 M-WORK; key fields 45 section 7.0). Pure: no database, no clock.
 *
 * How a point is matched (the matcher kind follows the point fields, 46 M-WORK):
 * - `step`: the point has `accept` (and neither `seen` nor `implied`): any pupil line, or a side of a chain "a = b = c", is equivalent to
 *   an accepted expression (numeric equivalence at fixed test points, so 2x+6 = 2(x+3)), or equals it after text normalisation.
 *   A line equal to a `notAccepted` value (as written, after text normalisation) is never matched.
 * - `all_of`: every `allOf` item is among the lines (equivalent) or is a whole-phrase of the normalised text.
 * - `keywords`: `seen` or `implied` is set; the terms are `accept`, else the terms of `text.ms` (split on newline, `;` or `@`), matched as
 *   whole-word phrases of the normalised text.
 * - `final`: the point has `ecf`, `tol`, `tolKind`, `sf` or `dp`: the final box against `finalAnswer` (value only), or the own figure carried
 *   forward (`ecf`: the transform of the pupil's earlier final within the tolerance).
 * - `unit`: the point has `unit`; a unit that is not `mandatory` may be missing but never wrong.
 * - `manual`: none of the above. Never auto.
 * A point with several matcher fields must pass all of them. `requires`, groups (`anyN`, `eachMarks`, `cap`, `pair`), `bonus`, `countMarks` and
 * `alternatives` are applied by the shared engine of `scheme-total.ts` (the one the publish gate uses).
 *
 * Left out (reported, not guessed): `sf` and `dp` are not checked as a rule on the final value; a deduction or `zeroIf` that needs a person
 * to judge (spelling, punctuation, grammar, copy, other, sf, dp) makes the part `belum_dimarkah` instead of being applied.
 */
import { answersEquivalent, latexToPlain, matchFinal, normaliseUnit, numericValue, splitUnit } from '@pp/exam-core/math-expr'
import { containsPhrase, normaliseText } from '@pp/exam-core/grading'

import { reachableIds, schemeTotal, type SchemeKeyLike, type SchemePoint } from './scheme-total'
import type { GradeResult, PointOutcome } from './types'

/** A keyword answer longer than this is routed to review (46 M-WORK). */
export const MAX_WORKING_WORDS = 80

export const UNIT_MISSING_MESSAGE = 'Unit tidak ditulis.'
export const UNIT_WRONG_MESSAGE = 'Unit tidak betul.'
export const requiresMessage = (id: string): string => `Tidak diberi: ${id} tidak diperoleh.`

export interface WorkingAnswer {
  steps?: readonly string[]
  final?: string
  unit?: string
  text?: string
  photos?: number
}
export interface WorkingDeduction {
  code: string
  amount: number
  cap?: number
}
export interface WorkingContext {
  /** Numeric final the pupil gave for earlier leaves, by leaf label (ECF). */
  previousFinals?: Readonly<Record<string, number | null | undefined>>
  /** Deductions of the question's `schemeRules` whose scope is `part`. */
  partDeductions?: readonly WorkingDeduction[]
  /** `schemeRules.zeroIf` is non-empty. */
  hasZeroRules?: boolean
}

interface WorkPoint extends SchemePoint {
  text?: { ms: string }
  accept?: readonly string[]
  allOf?: readonly string[]
  seen?: boolean
  implied?: boolean
  notAccepted?: readonly string[]
  unit?: { value: string; mandatory: boolean; alt?: readonly string[] }
  tol?: number
  tolKind?: 'abs' | 'rel'
  sf?: number
  dp?: number
  ecf?: { fromPart: string; rule: { op: 'same' } | { op: 'scale'; factor: number } }
}
export interface WorkingKey extends SchemeKeyLike {
  points?: readonly WorkPoint[]
  finalAnswer?: { display: string; accepted: readonly string[]; tol?: number; tolKind?: 'abs' | 'rel'; unit?: string }
  deductions?: readonly (WorkingDeduction & { scope?: 'question' | 'part' })[]
  zeroIf?: readonly { code: string; label: string }[]
}

const nonBlank = (s: string | undefined): boolean => (s ?? '').trim() !== ''
const wordCount = (s: string): number => {
  const t = normaliseText(s)
  return t === '' ? 0 : t.split(' ').length
}

/** Working lines that can be compared: each line, and each side of a chain `a = b = c`. */
function candidateLines(a: WorkingAnswer): string[] {
  const out: string[] = []
  const raw = [...(a.steps ?? []), a.final ?? '', ...(a.text ?? '').split('\n')]
  for (const line of raw) {
    const t = line.trim()
    if (t === '') continue
    out.push(t)
    const plain = latexToPlain(t)
    if (plain.includes('=') && !/[<>]/.test(plain)) for (const seg of plain.split('=')) if (seg.trim() !== '') out.push(seg.trim())
  }
  return out
}

const same = (line: string, key: string): boolean => {
  const n = normaliseText(key)
  return answersEquivalent(line, key) || (n !== '' && normaliseText(line) === n)
}

const termsOf = (p: WorkPoint): string[] =>
  p.accept && p.accept.length > 0
    ? [...p.accept]
    : (p.text?.ms ?? '')
        .split(/[\n;@]/)
        .map((t) => t.trim())
        .filter((t) => t !== '')

/** Does the point carry any field a machine can match? */
function matcherKinds(p: WorkPoint): { step: boolean; keywords: boolean; allOf: boolean; final: boolean; unit: boolean } {
  const keywords = (p.seen === true || p.implied === true) && termsOf(p).length > 0
  return {
    keywords,
    step: !(p.seen === true || p.implied === true) && (p.accept?.length ?? 0) > 0,
    allOf: (p.allOf?.length ?? 0) > 0,
    final: p.ecf !== undefined || p.tol !== undefined || p.tolKind !== undefined || p.sf !== undefined || p.dp !== undefined,
    unit: p.unit !== undefined,
  }
}
const isManual = (p: WorkPoint): boolean => !Object.values(matcherKinds(p)).some(Boolean)

type UnitState = 'ok' | 'missing' | 'wrong'

/** The unit the pupil gave: the unit field, else a trailing unit of the final box. */
function givenUnit(a: WorkingAnswer, expected: string): string {
  if (nonBlank(a.unit)) return normaliseUnit(a.unit!)
  return splitUnit(latexToPlain(a.final ?? ''), expected).unit
}
function unitState(a: WorkingAnswer, accepted: readonly string[]): UnitState {
  const given = givenUnit(a, accepted[0] ?? '')
  if (given === '') return 'missing'
  return accepted.some((u) => normaliseUnit(u) === given) ? 'ok' : 'wrong'
}

interface FinalCheck {
  value: 'match' | 'mismatch' | 'unparseable' | 'empty'
  unit: UnitState | 'na'
}
function checkFinal(key: WorkingKey, a: WorkingAnswer, tolOverride?: number, kindOverride?: 'abs' | 'rel'): FinalCheck {
  const fa = key.finalAnswer
  if (!fa) return { value: 'empty', unit: 'na' }
  const kind = kindOverride ?? fa.tolKind ?? 'abs'
  const tol = tolOverride ?? fa.tol ?? 0
  let last: ReturnType<typeof matchFinal> = { value: 'empty', unit: 'na' }
  for (const accepted of fa.accepted) {
    const base = numericValue(accepted)
    const tolerance = kind === 'rel' ? tol * Math.abs(base ?? 0) : tol
    const m = matchFinal(a.final ?? '', a.unit ?? '', { accept: [accepted], tolerance, ...(fa.unit === undefined ? {} : { unit: fa.unit }) })
    if (m.value === 'match') return { value: 'match', unit: m.unit === 'na' ? 'na' : m.unit === 'ok' ? 'ok' : m.unit === 'missing' ? 'missing' : 'wrong' }
    last = m
  }
  return { value: last.value, unit: last.unit === 'na' ? 'na' : last.unit === 'ok' ? 'ok' : last.unit === 'missing' ? 'missing' : 'wrong' }
}

function matchPoint(
  p: WorkPoint,
  key: WorkingKey,
  a: WorkingAnswer,
  lines: readonly string[],
  text: string,
  ctx: WorkingContext,
): { hit: boolean; code: PointOutcome['code']; message?: string } {
  const kinds = matcherKinds(p)
  // `notAccepted` is the exact written form (normalised text), not an equivalent value: "2.0" can be refused while "2" is accepted.
  const rejected = (l: string): boolean => (p.notAccepted ?? []).some((n) => normaliseText(l) === normaliseText(n))
  const usable = lines.filter((l) => !rejected(l))
  let code: PointOutcome['code'] = 'HIT'
  let message: string | undefined
  let ok = true
  if (kinds.step && !usable.some((l) => (p.accept ?? []).some((k) => same(l, k)))) ok = false
  if (kinds.allOf && !(p.allOf ?? []).every((it) => usable.some((l) => same(l, it)) || containsPhrase(text, normaliseText(it)))) ok = false
  if (kinds.keywords && !termsOf(p).some((t) => containsPhrase(text, normaliseText(t)))) ok = false
  if (kinds.final) {
    const own = checkFinal(key, a, p.tol, p.tolKind)
    let hit = own.value === 'match'
    if (!hit && p.ecf) {
      const prev = ctx.previousFinals?.[p.ecf.fromPart]
      const mine = numericValue(a.final ?? '')
      if (prev != null && mine != null) {
        const expected = p.ecf.rule.op === 'same' ? prev : prev * p.ecf.rule.factor
        const tol = p.tolKind === 'rel' ? (p.tol ?? 0) * Math.abs(expected) : (p.tol ?? key.finalAnswer?.tol ?? 0)
        if (Math.abs(expected - mine) <= tol + 1e-9) {
          hit = true
          code = 'ECF'
        }
      }
    }
    if (!hit) ok = false
  }
  if (kinds.unit && p.unit) {
    const state = unitState(a, [p.unit.value, ...(p.unit.alt ?? [])])
    const onlyUnit = !kinds.step && !kinds.allOf && !kinds.keywords && !kinds.final
    const pass = state === 'ok' || (state === 'missing' && !p.unit.mandatory && !onlyUnit)
    if (!pass) {
      ok = false
      if (state === 'missing') {
        code = 'UNIT_MISSING'
        message = UNIT_MISSING_MESSAGE
      } else if (state === 'wrong') {
        code = 'UNIT_WRONG'
        message = UNIT_WRONG_MESSAGE
      }
    }
  }
  if (!ok) return { hit: false, code: code === 'UNIT_MISSING' || code === 'UNIT_WRONG' ? code : 'NO_MATCH', ...(message === undefined ? {} : { message }) }
  return { hit: true, code }
}

/** Deduction codes a machine can decide; every other code needs a person. */
const AUTO_DEDUCTIONS = new Set(['unit'])

/** Marks one `working` leaf against a scheme v2 points key. `marks` is the leaf marks. */
export function gradeWorking(key: WorkingKey, answer: WorkingAnswer, marks: number, ctx: WorkingContext = {}): GradeResult {
  const hasText = nonBlank(answer.final) || nonBlank(answer.text) || (answer.steps ?? []).some(nonBlank)
  if (!hasText) return (answer.photos ?? 0) > 0 ? { kind: 'needs_review', maxMarks: marks } : { kind: 'blank', maxMarks: marks }

  const points = key.points ?? []
  const lines = candidateLines(answer)
  const text = normaliseText([answer.text ?? '', answer.final ?? '', ...(answer.steps ?? [])].join(' '))
  const raw = new Map<string, boolean>()
  const outcomes = new Map<string, PointOutcome>()
  for (const p of points) {
    if (isManual(p)) {
      raw.set(p.id, false)
      outcomes.set(p.id, { id: p.id, hit: false, manual: true, code: 'MANUAL' })
      continue
    }
    const m = matchPoint(p, key, answer, lines, text, ctx)
    raw.set(p.id, m.hit)
    outcomes.set(p.id, { id: p.id, hit: m.hit, code: m.code, ...(m.message === undefined ? {} : { message: m.message }) })
  }
  // `requires`: a matched point counts only when the points it requires count.
  const counted = reachableIds(points, (id) => raw.get(id) === true)
  for (const p of points) {
    const o = outcomes.get(p.id)!
    if (o.hit && !counted.has(p.id)) {
      const missing = (p.requires ?? []).find((r) => !counted.has(r)) ?? ''
      outcomes.set(p.id, { id: p.id, hit: false, code: 'REQUIRES', message: requiresMessage(missing) })
    }
  }
  const total = Math.min(schemeTotal(key, (id) => raw.get(id) === true), marks)

  // Deductions: the unit rule is applied; the rest need a person.
  const fa = key.finalAnswer
  const finalCheck = checkFinal(key, answer)
  let deducted = 0
  let needsPerson = ctx.hasZeroRules === true || (key.zeroIf?.length ?? 0) > 0
  for (const d of [...(key.deductions ?? []).filter((x) => x.scope !== 'question'), ...(ctx.partDeductions ?? [])]) {
    if (!AUTO_DEDUCTIONS.has(d.code)) {
      needsPerson = true
      continue
    }
    if (d.code === 'unit' && fa?.unit !== undefined && finalCheck.unit !== 'ok' && finalCheck.unit !== 'na') deducted += Math.min(d.amount, d.cap ?? d.amount)
  }
  const awarded = Math.max(0, total - deducted)

  const list = points.map((p) => outcomes.get(p.id)!)
  const reasons = list.flatMap((o) => (o.message === undefined ? [] : [o.message]))
  const anyAuto = list.some((o) => o.manual !== true)
  const manual = list.some((o) => o.manual === true)
  const unreadable = fa !== undefined && nonBlank(answer.final) && finalCheck.value === 'unparseable'
  const tooLong = wordCount([answer.text ?? '', answer.final ?? '', ...(answer.steps ?? [])].join(' ')) > MAX_WORKING_WORDS
  if (manual || unreadable || tooLong || needsPerson) {
    return {
      kind: 'needs_review',
      maxMarks: marks,
      ...(anyAuto ? { suggestion: { marks: awarded, points: list } } : {}),
      ...(reasons.length > 0 ? { reasons } : {}),
    }
  }
  return { kind: 'graded', correct: awarded >= marks && marks > 0, marks: awarded, maxMarks: marks, points: list, ...(reasons.length > 0 ? { reasons } : {}) }
}
