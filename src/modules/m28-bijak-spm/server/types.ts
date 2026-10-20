/**
 * The public surface of the Bijak SPM student server, shared by the in-browser mock
 * (`BijakServer`, store.ts) and the HTTP client (http.ts). Pages only depend on this interface.
 * Type-only imports: this file must never pull the seed registry into the http bundle.
 */
import type {
  AttemptMode,
  AttemptPaperView,
  GenerateOutcome,
  HistoryRow,
  InProgressInfo,
  PaperCover,
  PaperSummary,
  PhotoMeta,
  QuestionResult,
  ResultView,
  SavePayload,
  Subject,
  SubjectCode,
  SubmitPayload,
} from '../domain/types'

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
}

export interface BijakApi {
  /** Sync: the HTTP client fills a reactive list on first call. */
  subjects(): readonly Subject[]
  /** Sync: the server clock (HTTP: local clock plus the offset of the last attempt view). */
  serverNow(): number
  listPapers(userId: number): Promise<PaperSummary[]>
  getCover(userId: number, paperId: string): Promise<PaperCover>
  listContracts(): Promise<ContractRow[]>
  generatePaper(userId: number, subject: SubjectCode, kertas: number): Promise<GenerateOutcome>
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
  /**
   * Stores one working photo of a part and returns the metadata kept in `PartAnswer.photos`.
   * Mock: the device (IndexedDB). HTTP: `POST /api/bijak/attempts/{id}/photos` (server-issued key).
   * `existing` is the number of photos the part already holds (client pre-check / key suffix).
   */
  uploadPhoto(
    userId: number,
    attemptId: string,
    partId: string,
    file: File,
    existing: number,
  ): Promise<PhotoMeta>
  /** A URL the `<img>` can load for a stored photo, or null when it cannot be shown. */
  photoUrl(key: string): Promise<string | null>
  /** Drops the photo from the device. HTTP: no-op (the contract has no delete route). */
  removePhoto(key: string): Promise<void>
}
