/**
 * Public types of the reusable quiz component (`QuizRunner`; XL-10 contract, SRS M05 v1.19 §7.1).
 * The component is used by Q1 (random), Q2 (chapter), S7 (revision), Q4–Q6 (teacher-assigned) and the
 * M06 SPM quiz pages; hosts pass data and labels only.
 */

import type {
  CheckAnswerResponse,
  StartSessionRequest,
  StartSessionResponse,
  SubmitSessionResponse,
} from '../../api/types'

/** The three session calls (#4–#6). The default is the M05 client (`api/practice.ts`); hosts and tests may replace it. */
export interface QuizApi {
  start(body: StartSessionRequest): Promise<StartSessionResponse>
  check(
    sessionId: string,
    body: { questionId: number; selectedOptionId: number },
  ): Promise<CheckAnswerResponse>
  submit(
    sessionId: string,
    body: { answers: { questionId: number; selectedOptionId: number }[]; timeSpent: number },
  ): Promise<SubmitSessionResponse>
}

/** Copy of one host (FR-M05-52: S7 values are SOURCE-DERIVED, Q1/Q2 are PROPOSED COPY, §8.3). */
export interface QuizLabels {
  loadingTitle: string
  loadingText: string
  resultTitle: string
  messages: { perfect: string; high: string; mid: string; low: string }
  /** Results button that starts a new session ("Ulang Kaji Lagi" / "Ulang Lagi"). */
  retry: string
  /** Results link back to the host list ("Senarai Subjek" / "Kembali"). */
  back: string
  /** Feedback card titles. */
  correctTitle: string
  wrongTitle: string
  /** `alert` text when #4 fails with a server error that has no message. */
  startErrorFallback: string
  /** `alert` text when #4 fails with no response and an empty error message. */
  networkErrorFallback: string
}

export type QuizReportTint =
  'default' | 'red' | 'amber' | 'orange' | 'yellow' | 'blue' | 'indigo' | 'slate'

/** Passed to the M04 `ReportQuestionModal` (`variant: 'mcq'`; XL-09). */
export interface QuizReportConfig {
  source: 'revision' | 'latihan' | 'spm' | 'quiz'
  failureText?: string
  tints?: Record<string, QuizReportTint>
}

/** One checked answer kept for "Semakan Semula Jawapan" (FR-M05-79, FR-M05-85). */
export interface QuizAnswerRecord {
  questionId: number
  questionText: string
  selectedOptionId: number
  /** "{label}. {text}" of the user's option. */
  selectedLabel: string
  /** "{label}. {text}" of the correct option; empty when the check response had none. */
  correctLabel: string
  isCorrect: boolean
  explanation: string | null
}

/** The check result of the current question as the screen uses it. */
export interface QuizCheckResult {
  isCorrect: boolean
  /** `null` for an error-body response (nothing is marked green). */
  correctOptionId: number | null
  feedback: string
  explanation: string | null
}

export type QuizPhase = 'loading' | 'quiz' | 'results'

export interface QuizStartErrorEvent {
  status: number
  code: string
  message: string
}

export interface QuizCompletedEvent {
  score: number
  total: number
  gamification: SubmitSessionResponse['results']['gamification'] | null
}
