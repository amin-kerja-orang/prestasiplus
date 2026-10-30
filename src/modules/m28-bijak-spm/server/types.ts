/**
 * The public surface of the Bijak SPM student server, shared by the in-browser mock
 * (`BijakServer`, store.ts) and the HTTP client (http.ts). Pages only depend on this interface.
 * Type-only imports: this file must never pull the seed registry into the http bundle.
 */
import type { BijakGenerateShortage } from '@pp/contract'

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
  SubjectCode,
  SubmitPayload,
} from '../domain/types'
import type { PastSittings, SelfMarkOutcome } from '../domain/semakan'

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

/** One Kontrak row for Jana Kertas: which (subject, kertas) can be generated. */
export interface ContractRow {
  subject: SubjectCode
  subjectName: string
  kertas: number
  source: string
  code: string
  durationMin: number
  sections: { label: string; take: number }[]
  /** BJS-01: whether the caller can generate from this row now (false: show the AC-03.6 reason). */
  canGenerate: boolean
  unavailableReason?: 'NO_BLUEPRINT'
}

/**
 * What `generatePaper` resolves to (BJS-01): the mock `GenerateOutcome` plus the typed shortage
 * lines and the 503 GENERATE_LIMIT outcome. A transport failure rejects instead.
 */
export type BijakGenerateOutcome =
  | { ok: true; paperId: string }
  | { ok: false; reason: 'no_blueprint' }
  | { ok: false; reason: 'shortage'; shortages: BijakGenerateShortage[] }
  | { ok: false; reason: 'limit'; limitSections: { section?: string }[] }

export interface BijakApi {
  /** Sync: the HTTP client fills a reactive list on first call. */
  subjects(): readonly Subject[]
  /** Sync: the server clock (HTTP: local clock plus the offset of the last attempt view). */
  serverNow(): number
  listPapers(userId: number): Promise<PaperSummary[]>
  getCover(userId: number, paperId: string): Promise<PaperCover>
  listContracts(): Promise<ContractRow[]>
  generatePaper(userId: number, subject: SubjectCode, kertas: number): Promise<BijakGenerateOutcome>
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
  getResult(userId: number, attemptId: string): Promise<ResultView>
  history(userId: number): Promise<HistoryRow[]>
  /** R1-B12: the pupil's own mark (and band) for one part of a closed attempt. */
  selfMark(
    userId: number,
    attemptId: string,
    body: { partId: string; mark: number; band?: string },
  ): Promise<SelfMarkOutcome>
  /** R1-B15 "Cuba Lagi": a fresh attempt on the paper of a closed attempt. */
  retryAttempt(userId: number, attemptId: string): Promise<{ attemptId: string }>
  /** R1-B15 "Lihat semakan lepas": the caller's closed sittings of a paper, newest first. */
  pastSittings(userId: number, paperId: string): Promise<PastSittings>
}
