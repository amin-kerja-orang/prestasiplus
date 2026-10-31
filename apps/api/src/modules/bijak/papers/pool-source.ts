/**
 * BJS-07: `BijakPoolSource`, the candidate port of the standard-based Jana Kertas (v2-bijak-spm-standards 2, 4.2, 15.5).
 *
 * The questions module (M04) implements the bank side; the PoC fixture implements it for staging. It returns
 * FACTS only (no content, no keys): per question the effective unit, TP, KBAT flag, marks, mode and key
 * presence of every leaf part, plus the tag-review flag, the pool tags and the stimulus group. The facts are
 * exactly what `@pp/exam-core` `describeQuestion` / `eligibilityOf` expect; every count below comes from them,
 * so the preview, the generator and the oracle agree (NFR-12).
 *
 * The old `BijakQuestionSource.pool()` path stays untouched until BJS-10 switches the generator over.
 */
import {
  describeQuestion,
  eligibilityOf,
  excludedReport,
  type EligibilitySection,
  type IneligibleReason,
  type QuestionFacts,
} from './exam-core.adapter'
import type { BijakPoolScope } from './ports'

export interface BijakPoolSource {
  /**
   * Every published, active question of the subject as candidate facts, in id order. Ineligible questions are
   * INCLUDED (the preview counts them by reason); callers apply `eligibilityOf`. `scope.kertas` does not narrow
   * the bank (a question has no kertas; the section's pool tag does that through `QuestionFacts.pools`).
   */
  candidates(scope: BijakPoolScope): Promise<QuestionFacts[]>
  /** Question ids (decimal strings) the student has been served before (prefer-unseen). */
  seen(userId: string): Promise<ReadonlySet<string>>
}

/** The reasons of the contract's `excluded.byReason`. */
export type ExcludedReasonCode = IneligibleReason

export interface PoolTotals {
  /** Candidates handed over = Terbit live questions of the subject (15.5). */
  publishedTotal: number
  /** Passing the section-independent eligibility. Invariant: `publishedTotal = eligibleTotal + excluded.total`. */
  eligibleTotal: number
  excluded: {
    /** Unique excluded questions. */
    total: number
    /** One entry per reason (all five, zero counts included); a question may count under several reasons. */
    byReason: { reason: ExcludedReasonCode; count: number; bankQuery: Record<string, string> }[]
  }
}

/** Bank filter of the "Lihat soalan" link per reason (15.7). */
export function excludedBankQuery(reason: ExcludedReasonCode, subjectId: string): Record<string, string> {
  const base = { subjectId, status: 'approved' }
  switch (reason) {
    case 'no_unit':
      return { ...base, dskpFilter: 'untagged' }
    case 'no_tp':
      return { ...base, missing: 'tp' }
    case 'no_marks':
      return { ...base, missing: 'marks' }
    case 'no_key':
      return { ...base, missing: 'key' }
    case 'tag_review':
      return { ...base, tagReview: 'true' }
  }
}

/** `publishedTotal`, `eligibleTotal` and the exclusion breakdown of a candidate list (AC-29.5, AC-38.2, 15.5). */
export function poolTotals(candidates: readonly QuestionFacts[], subjectId: string): PoolTotals {
  const report = excludedReport(candidates)
  return {
    publishedTotal: candidates.length,
    eligibleTotal: candidates.length - report.total,
    excluded: {
      total: report.total,
      byReason: report.byReason.map((r) => ({ reason: r.reason, count: r.count, bankQuery: excludedBankQuery(r.reason, subjectId) })),
    },
  }
}

export interface SectionPoolCounts {
  /** Questions eligible for the section (base eligibility, pool tag, mode, quota unit). */
  eligible: number
  /** Eligible elsewhere but their answer mode is not allowed here: base-eligible, in the section's pool, mode rejected. */
  modeExcluded: number
}

/** Per-section counts of the preview (`eligible`, `modeExcluded`) over the same candidate list. */
export function sectionPoolCounts(candidates: readonly QuestionFacts[], section: Omit<EligibilitySection, 'quota'> & Partial<Pick<EligibilitySection, 'quota'>>): SectionPoolCounts {
  let eligible = 0
  let modeExcluded = 0
  for (const q of candidates) {
    const d = describeQuestion(q)
    const e = eligibilityOf(q, { quota: null, ...section }, d)
    if (e.eligible) eligible++
    else if (d.reasons.length === 0 && e.reasons.includes('mode_not_allowed') && !e.reasons.includes('pool_mismatch')) modeExcluded++
  }
  return { eligible, modeExcluded }
}
