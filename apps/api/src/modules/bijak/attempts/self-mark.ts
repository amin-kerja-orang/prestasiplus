/**
 * R1-B12 / R1-B13: the pupil's own marks (V2 `selfMark`) and the keyword suggestion, as PURE functions
 * over a graded result. The stored result stays the automatic grading; the self-marks are kept next to it
 * (`attempt_results.graded.selfMarks`) and applied on top whenever a result is read or recomputed. That
 * keeps the apply idempotent: the same marks over the same base always give the same totals.
 *
 * V2 rules replicated (ExamSimulationController.php):
 * - :564-:611 selfMark: honesty based, per part, no lock, the part must belong to the attempt, the mark is
 *   clamped to 0..part marks and replaces the part's awarded mark;
 * - :679-:696 recomputeScore: the total is re-ranked with best-N (ExamBestNScorer), so a raised mark can
 *   change which choose-N questions count;
 * - :408-:414 the keyword suggestion exists only for mark-scheme-points parts with a non-empty answer.
 *   As in V2 a non-zero suggestion is stored as the awarded mark at submit (`seedSuggestions`, flagged
 *   `autoSuggested`, part stays `belum_dimarkah`); `decorateResult` only adds the detail lines. A self-mark
 *   replaces it. A self-mark makes its question "attempted" for best-N (ExamBestNScorer.php:75,114).
 */
import type { BijakAttemptPartResult, BijakAttemptResult } from '@pp/contract'

import { isBlank, type QuestionResult, type SchemeDef, type SectionSnapshot } from './exam-core.adapter'
import { answerTextOf, suggestFromPoints } from './keyword-suggest'
import { assembleResult, type AnswerMap, type Bundles } from './marking'

export interface SelfMarkEntry {
  /** Already clamped to 0..part marks (and to the band range). */
  mark: number
  band?: string
}
/** Part id to the pupil's mark. */
export type SelfMarks = Record<string, SelfMarkEntry>

/** Scheme kinds a person marks: mark-scheme points (V2 mark_scheme_points) and rubric (band_rubric). */
export function isSelfMarkable(scheme: SchemeDef | undefined): boolean {
  return scheme?.kind === 'points' || scheme?.kind === 'rubric'
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function statusFor(awarded: number, marks: number, blank: boolean): BijakAttemptPartResult['status'] {
  if (blank) return 'kosong'
  if (awarded >= marks && marks > 0) return 'betul'
  if (awarded > 0) return 'separa'
  return 'salah'
}

/**
 * Adds `selfMarkable` and, for a points part that waits for a person, the keyword `suggestion`. Works on
 * the AUTOMATIC grading (before the self-marks), so the suggestion stays visible after the pupil marked.
 * Never changes `awarded`, `status` or any total.
 */
export function decorateResult(base: BijakAttemptResult, bundles: Bundles, answers: AnswerMap): BijakAttemptResult {
  const questions = base.questions.map((q) => {
    const bundle = bundles.get(q.questionId)
    return {
      ...q,
      parts: q.parts.map((p): BijakAttemptPartResult => {
        const scheme = bundle?.schemes[p.partId]
        if (!isSelfMarkable(scheme)) return p
        const out: BijakAttemptPartResult = { ...p, selfMarkable: true }
        if (scheme?.kind === 'points' && p.status === 'belum_dimarkah') {
          const text = answerTextOf(answers.get(p.partId))
          if (text.trim() !== '') {
            out.suggestion = suggestFromPoints(
              scheme.points.map((pt) => ({ id: pt.id, label: pt.label, marks: pt.marks })),
              text,
              p.marks,
            )
          }
        }
        return out
      }),
    }
  })
  return { ...base, questions }
}

/** Overlays the pupil's marks and recomputes questions, choose-N ranking, totals, provisional and pending. */
export function applySelfMarks(base: BijakAttemptResult, composition: readonly SectionSnapshot[], marks: SelfMarks): BijakAttemptResult {
  if (Object.keys(marks).length === 0) return base
  const questions = structuredClone(base.questions)
  for (const q of questions) {
    let changed = false
    for (const p of q.parts) {
      const m = marks[p.partId]
      if (!m) continue
      p.awarded = clamp(m.mark, 0, p.marks)
      p.status = statusFor(p.awarded, p.marks, isBlank(p.answer))
      p.selfMarked = true
      delete p.autoSuggested // the pupil's mark replaces the automatic suggestion
      if (m.band !== undefined) p.band = m.band
      changed = true
    }
    if (changed) {
      q.awarded = q.parts.reduce((n, p) => n + p.awarded, 0)
      // V2: a self-mark creates a response row, and ExamBestNScorer counts a question as attempted once any
      // response row exists (ExamBestNScorer.php:75,114; selfMark updateOrCreate ExamSimulationController.php:593-597).
      q.attempted = true
    }
  }
  // assembleResult only reads and sets fields both shapes share (marks, awarded, counted, attempted, parts[].status).
  const assembled = assembleResult(composition, questions as unknown as QuestionResult[])
  return { ...assembled, questions }
}
