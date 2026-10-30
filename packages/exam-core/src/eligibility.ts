/**
 * Question facts and eligibility (architecture 4.2, US-38, 3.1a). The facts come from the pool source
 * (no content, no keys) with the EFFECTIVE leaf values; this module turns them into the numbers the
 * generator and the oracle use.
 */
import { T1_T3_KEY, unitKeyOf, type StandardSection, type UnitKey } from './standard-model'

export type FormOrigin = 't1_t3' | 't4' | 't5'

export interface UnitFact {
  nodeId: string
  level: 'T4' | 'T5'
  code: string
}

export interface LeafFact {
  marks: number | null
  mode: string | null
  /** Effective TP (part, else question). */
  tp: number | null
  /** Resolved KBAT flag of the leaf (effective `kbat` level present). Adapters derive it; this package never sees level numbers. */
  kbat: boolean
  hasKey: boolean
  /** Effective unit of the leaf. `undefined` = inherit the question's primary unit; `null` = none. */
  unit?: UnitFact | null
  /** Effective origin of the leaf; `undefined` = inherit the question's. */
  formOrigin?: FormOrigin
}

export interface QuestionFacts {
  id: string
  groupId: string | null
  groupPosition: number | null
  /** Optional: when set, a group with fewer candidates than this is incomplete and never used. */
  groupSize?: number
  versionNo: number
  /** true = the tags await review: the question is never eligible (reason `tag_review`). */
  tagReview: boolean
  /** Primary unit of the question. */
  unit: UnitFact | null
  formOrigin: FormOrigin
  pools: readonly string[]
  leaves: readonly LeafFact[]
}

/** Why a question is not in the pool at all, in the fixed order of the spec (so counts add up). */
export const INELIGIBLE_REASONS = ['no_unit', 'no_tp', 'no_marks', 'no_key', 'tag_review'] as const
export type IneligibleReason = (typeof INELIGIBLE_REASONS)[number]

/** Extra reasons that exist only relative to a section. */
export const SECTION_REASONS = ['mode_not_allowed', 'pool_mismatch', 'unit_not_in_quota'] as const
export type SectionReason = (typeof SECTION_REASONS)[number]

export interface DescribedQuestion {
  id: string
  groupId: string | null
  groupPosition: number | null
  groupSize: number | null
  /** Sum of leaf marks. */
  marks: number
  /** Highest effective leaf TP (null when no leaf has one). */
  tp: number | null
  /** Sum of the marks of leaves whose effective `kbat` is true. */
  kbatMarks: number
  /** Distinct leaf modes, sorted. */
  modes: string[]
  /** Primary bucket (questions-basis lines); null when the question has no unit and is not T1-T3. */
  bucket: UnitKey | null
  /** Marks per effective leaf unit (marks-basis lines), keys sorted. */
  unitMarks: Record<UnitKey, number>
  reasons: IneligibleReason[]
}

function leafKey(leaf: LeafFact, q: QuestionFacts): UnitKey | null {
  const unit = leaf.unit !== undefined ? leaf.unit : q.unit
  if (unit) return unitKeyOf({ kind: 'unit', nodeId: unit.nodeId })
  const origin = leaf.formOrigin ?? q.formOrigin
  return origin === 't1_t3' ? T1_T3_KEY : null
}

/** tp is the max over leaves, KBAT marks the sum over KBAT leaves, plus the two unit accountings of 3.1a. */
export function describeQuestion(q: QuestionFacts): DescribedQuestion {
  let marks = 0
  let tp: number | null = null
  let kbat = 0
  const modes = new Set<string>()
  const unitMarks = new Map<UnitKey, number>()
  let missingUnit = false
  let missingTp = false
  let missingMarks = q.leaves.length === 0
  let missingKey = false
  for (const leaf of q.leaves) {
    const m = leaf.marks ?? 0
    if (leaf.marks === null || leaf.marks < 1) missingMarks = true
    marks += Math.max(0, m)
    if (leaf.tp === null || leaf.tp < 1 || leaf.tp > 6) missingTp = true
    else tp = tp === null ? leaf.tp : Math.max(tp, leaf.tp)
    if (leaf.kbat) kbat += Math.max(0, m)
    if (!leaf.hasKey) missingKey = true
    if (leaf.mode) modes.add(leaf.mode)
    const k = leafKey(leaf, q)
    if (k === null) missingUnit = true
    else unitMarks.set(k, (unitMarks.get(k) ?? 0) + Math.max(0, m))
  }
  const bucket = q.unit ? unitKeyOf({ kind: 'unit', nodeId: q.unit.nodeId }) : q.formOrigin === 't1_t3' ? T1_T3_KEY : null
  if (bucket === null) missingUnit = true
  const reasons: IneligibleReason[] = []
  if (missingUnit) reasons.push('no_unit')
  if (missingTp) reasons.push('no_tp')
  if (missingMarks) reasons.push('no_marks')
  if (missingKey) reasons.push('no_key')
  if (q.tagReview) reasons.push('tag_review')
  const sorted: Record<UnitKey, number> = {}
  for (const k of [...unitMarks.keys()].sort()) sorted[k] = unitMarks.get(k) ?? 0
  return {
    id: q.id,
    groupId: q.groupId,
    groupPosition: q.groupPosition,
    groupSize: q.groupSize ?? null,
    marks,
    tp,
    kbatMarks: kbat,
    modes: [...modes].sort(),
    bucket,
    unitMarks: sorted,
    reasons,
  }
}

/** What a section asks of a question besides being well tagged. */
export type EligibilitySection = Pick<StandardSection, 'allowedModes' | 'quota'> & { pool?: string | null }

export interface Eligibility {
  eligible: boolean
  /** Base reasons first (fixed order), then the section reasons (mode, pool, quota). */
  reasons: (IneligibleReason | SectionReason)[]
}

/** Lines of the quota with a value above 0, as a key set (AC-36.2, AC-36.5); null = no quota. */
export function quotaUnitKeys(section: Pick<StandardSection, 'quota'>): Set<UnitKey> | null {
  if (!section.quota) return null
  const keys = new Set<UnitKey>()
  for (const line of section.quota.lines) if (line.value > 0) keys.add(unitKeyOf(line.unit))
  return keys
}

export function eligibilityOf(
  facts: QuestionFacts,
  section: EligibilitySection,
  described: DescribedQuestion = describeQuestion(facts),
): Eligibility {
  const reasons: (IneligibleReason | SectionReason)[] = [...described.reasons]
  if (section.allowedModes.length > 0 && described.modes.some((m) => !section.allowedModes.includes(m)))
    reasons.push('mode_not_allowed')
  if (section.pool && !facts.pools.includes(section.pool)) reasons.push('pool_mismatch')
  const keys = quotaUnitKeys(section)
  if (keys && section.quota) {
    const ok =
      section.quota.basis === 'marks'
        ? Object.keys(described.unitMarks).every((k) => keys.has(k))
        : described.bucket !== null && keys.has(described.bucket)
    if (!ok) reasons.push('unit_not_in_quota')
  }
  return { eligible: reasons.length === 0, reasons }
}

export interface ExcludedReport {
  /** Unique questions failing at least one base reason. */
  total: number
  /** Per reason; one question may count under several reasons (design D-8). */
  byReason: { reason: IneligibleReason; count: number }[]
  /** Per first reason in the fixed order; these add up to `total`. */
  byFirstReason: { reason: IneligibleReason; count: number }[]
}

/** The "tidak layak" breakdown of AC-29.5 / AC-38.2 over a candidate list. */
export function excludedReport(candidates: readonly QuestionFacts[]): ExcludedReport {
  const any = new Map<IneligibleReason, number>()
  const first = new Map<IneligibleReason, number>()
  let total = 0
  for (const q of candidates) {
    const d = describeQuestion(q)
    if (d.reasons.length === 0) continue
    total++
    first.set(d.reasons[0]!, (first.get(d.reasons[0]!) ?? 0) + 1)
    for (const r of d.reasons) any.set(r, (any.get(r) ?? 0) + 1)
  }
  return {
    total,
    byReason: INELIGIBLE_REASONS.map((reason) => ({ reason, count: any.get(reason) ?? 0 })),
    byFirstReason: INELIGIBLE_REASONS.map((reason) => ({ reason, count: first.get(reason) ?? 0 })),
  }
}
