/**
 * Typed refusals of `BuilderService.importDraftPaper` (S1-T10). They are plain errors, not HTTP ones: the S1 service decides the status
 * (`PaperImportGroupSplitError` -> 422 `fields.items`, `PaperImportPublishedError` -> 409, the others -> 422/500 as it sees fit).
 */
export type PaperImportErrorCode = 'GROUP_SPLIT' | 'PAPER_PUBLISHED' | 'QUESTION_NOT_FOUND' | 'QUESTION_NOT_SERVABLE' | 'SECTION_LIMIT'

export abstract class PaperImportError extends Error {
  abstract readonly code: PaperImportErrorCode
}

/** Accepted members of ONE stimulus group would land in more than one Bahagian (ERR-QST-02). `groupId` is the question group id. */
export class PaperImportGroupSplitError extends PaperImportError {
  readonly code = 'GROUP_SPLIT'
  constructor(
    readonly groupId: string,
    readonly questionIds: readonly string[],
  ) {
    super(`stimulus group ${groupId} would be split across sections`)
  }
}

/** The paper of the batch is `Terbit`: it must be withdrawn to a draft first. */
export class PaperImportPublishedError extends PaperImportError {
  readonly code = 'PAPER_PUBLISHED'
  constructor(readonly paperId: bigint) {
    super(`paper ${paperId.toString()} is published`)
  }
}

/** A question of the input is not known to the question bank. */
export class PaperImportQuestionError extends PaperImportError {
  readonly code = 'QUESTION_NOT_FOUND'
  constructor(readonly questionId: string) {
    super(`question ${questionId} is not known to the question bank`)
  }
}

/** The paper would hold more Bahagian than the builder allows (20). */
export class PaperImportSectionLimitError extends PaperImportError {
  readonly code = 'SECTION_LIMIT'
  constructor(readonly limit: number) {
    super(`a paper holds at most ${String(limit)} sections`)
  }
}

/** M2: a question of the input cannot be placed (a held or unresolved picture; see `placementBlockers`). */
export class PaperImportBlockedError extends PaperImportError {
  readonly code = 'QUESTION_NOT_SERVABLE'
  constructor(
    readonly questionId: string,
    readonly reason: string,
  ) {
    super(`question ${questionId} cannot be placed on a paper: ${reason}`)
  }
}
