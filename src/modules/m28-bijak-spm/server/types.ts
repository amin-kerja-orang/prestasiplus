/**
 * The public surface of the Bijak SPM student server, shared by the in-browser mock
 * (`BijakServer`, store.ts) and the HTTP client (http.ts). Pages only depend on this interface.
 * Type-only imports: this file must never pull the seed registry into the http bundle.
 */
import type {
  BijakKuizCheckRequest,
  BijakKuizCheckResult,
  BijakKuizPaperPage,
  BijakKuizResult,
  BijakKuizSession,
  BijakKuizStartRequest,
} from '@pp/contract'

import type {
  AttemptMode,
  AttemptPaperView,
  HistoryRow,
  InProgressInfo,
  PaperCover,
  PaperSummary,
  QuestionResult,
  ResultView,
  SavePayload,
  Subject,
  SubmitPayload,
} from '../domain/types'
import type { PastSittings, SelfMarkOutcome } from '../domain/semakan'

/** The two paper lists of `GET /api/bijak/papers?surface` (default `simulasi`). */
export type PaperSurface = 'simulasi' | 'subjektif'

/** A row of the list; the Kertas Subjektif rows also carry `surface` and `examBoard` (slug of OPT-NEGERI-KERTAS). */
export type ListedPaper = PaperSummary & { surface?: PaperSurface; examBoard?: string }

export interface SaveResult {
  savedAt: number
  /** The attempt is already closed; the device keeps its local copy. */
  closed?: boolean
  /** Late-synced changes that were accepted and re-graded (AC-05.4). */
  regraded?: boolean
}

export interface SubmitResult {
  attemptId: string
  late: number
  closed?: boolean
  regraded?: boolean
}

/**
 * Simulasi Kuiz (R1-B16): the random quiz (a stored practice session) and the per-paper quiz
 * (nothing stored). The server marks; an item never carries the key. `startKuiz` rejects with
 * `BijakError('no_questions')` when no objective question matches.
 */
export interface BijakKuizApi {
  startKuiz(input: BijakKuizStartRequest): Promise<BijakKuizSession>
  checkKuiz(sessionId: string, input: BijakKuizCheckRequest): Promise<BijakKuizCheckResult>
  finishKuiz(sessionId: string, timeSpent?: number): Promise<BijakKuizResult>
  getKuizPaperPage(paperId: string, page: number): Promise<BijakKuizPaperPage>
  checkKuizPaper(paperId: string, input: BijakKuizCheckRequest): Promise<BijakKuizCheckResult>
}

export interface BijakApi extends BijakKuizApi {
  /** Sync: the HTTP client fills a reactive list on first call. */
  subjects(): readonly Subject[]
  /** Sync: the server clock (HTTP: local clock plus the offset of the last attempt view). */
  serverNow(): number
  listPapers(userId: number, surface?: PaperSurface): Promise<ListedPaper[]>
  getCover(userId: number, paperId: string): Promise<PaperCover>
  findInProgress(userId: number, paperId: string): Promise<InProgressInfo | null>
  startAttempt(
    userId: number,
    paperId: string,
    mode: AttemptMode,
    opts?: { restart?: boolean },
  ): Promise<{ attemptId: string }>
  getAttemptView(userId: number, attemptId: string): Promise<AttemptPaperView>
  saveAnswers(userId: number, attemptId: string, payload: SavePayload): Promise<SaveResult>
  submit(userId: number, attemptId: string, payload: SubmitPayload): Promise<SubmitResult>
  abandon(userId: number, attemptId: string): Promise<void>
  checkQuestion(
    userId: number,
    attemptId: string,
    questionId: string,
    payload?: SavePayload,
  ): Promise<QuestionResult>
  /** `withScheme` is `?scheme=1`: a Kertas Subjektif result carries no scheme without it (AC-MUR-13-21). */
  getResult(userId: number, attemptId: string, withScheme?: boolean): Promise<ResultView>
  history(userId: number): Promise<HistoryRow[]>
  /** R1-B12: the pupil's own mark (and band) for one part of a closed attempt. */
  selfMark(
    userId: number,
    attemptId: string,
    body: { partId: string; mark: number; band?: string },
    withScheme?: boolean,
  ): Promise<SelfMarkOutcome>
  /** R1-B15 "Cuba Lagi": a fresh attempt on the paper of a closed attempt. */
  retryAttempt(userId: number, attemptId: string): Promise<{ attemptId: string }>
  /** R1-B15 "Lihat semakan lepas": the caller's closed sittings of a paper, newest first. */
  pastSittings(userId: number, paperId: string): Promise<PastSittings>
}
