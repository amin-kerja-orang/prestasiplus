/**
 * Part A of `migrate:activity` (BE-29): the `wallet` and `activity` groups.
 *
 * wallet    wallets, then coin_ledger, then the wallet-versus-ledger drift scan (report only, nothing corrected)
 * activity  practice_sessions, practice_answers (snapshot), streaks (recomputed), exam_attempts (+ attempt_results)
 *
 * Tiers come from the catalogue group (Part B) under the entity name `tiers`.
 */
import type { ActivityGroup } from './context'
import { examAttemptsStep } from './exam-steps'
import { practiceAnswersStep, practiceSessionsStep } from './practice-steps'
import { streaksStep } from './streak-step'
import { coinLedgerStep, walletLedgerDriftStep, walletsStep } from './wallet-steps'

export const walletGroup: ActivityGroup = {
  name: 'wallet',
  notMigrated: [],
  steps: (a) => [walletsStep(a), coinLedgerStep(a), walletLedgerDriftStep(a)],
}

export const activityGroupA: ActivityGroup = {
  name: 'activity',
  notMigrated: [],
  // The snapshot join and the exam title read only tables already in ACTIVITY_READ_TABLES (exam_questions, source_papers,
  // exam_papers, attempt_statuses): the source-paper key is `exam_questions.source_paper_id`, so no pivot table is read.
  steps: (a) => [practiceSessionsStep(a), practiceAnswersStep(a), streaksStep(a), examAttemptsStep(a)],
}
