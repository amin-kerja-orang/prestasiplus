/* eslint-disable @typescript-eslint/no-unused-vars -- frozen signatures; bodies are filled in by the next commit */
import { Injectable } from '@nestjs/common'

import type {
  AdminListFilter,
  AdminListResult,
  ContributionCounts,
  Page,
  PartAnswer,
  PublicQuestion,
  QuestionActor,
  QuestionBulkAction,
  QuestionCreateInput,
  QuestionDetailView,
  QuestionGrade,
  QuestionGuruCreateInput,
  QuestionGuruUpdateInput,
  QuestionStatus,
  QuestionStatusInfo,
  QuestionSummaryView,
  QuestionUpdateInput,
  QuestionView,
  SetStatusOptions,
  StructuredListFilter,
  StructuredListResult,
} from './types'

const todo = (): never => {
  throw new Error('QuestionsService: not implemented yet')
}

/**
 * Question bank use cases (M04, BE-09). Controllers (Part C) call the admin and Guru methods;
 * BE-10 calls `setStatus`, `getStatus`, `deactivate`; BE-12/15/41 call `getPublicForLearner` and
 * `gradeAnswer`; BE-17 calls `contributionCountsFor`.
 *
 * Errors: 404 `NOT_FOUND` for an unknown id and for a row the caller may not see; 422
 * `VALIDATION_ERROR` with `fields`; 409 `CONFLICT` for a status pair outside the contract table.
 *
 * FROZEN SIGNATURES. Bodies are filled in by BE-09 Part B.
 */
@Injectable()
export class QuestionsService {
  // --- admin (Admin Pusat) ----------------------------------------------------------------------

  /** Latest-version rows, newest first, with `counts` per status. Unknown filter values match nothing. */
  list(_filter: AdminListFilter): Promise<AdminListResult> {
    return todo()
  }

  summary(): Promise<QuestionSummaryView> {
    return todo()
  }

  /** 404 when the id is unknown. */
  getAdmin(_id: string): Promise<QuestionDetailView> {
    return todo()
  }

  /** Status defaults to `draft`; `published` runs the tag gate (422). Returns the stored question. */
  create(_input: QuestionCreateInput, _actor: QuestionActor): Promise<QuestionView> {
    return todo()
  }

  /** On a published question this creates version n+1 as `draft`; version n keeps serving (Q-5). */
  update(_id: string, _input: QuestionUpdateInput, _actor: QuestionActor): Promise<QuestionView> {
    return todo()
  }

  remove(_id: string, _actor: QuestionActor): Promise<void> {
    return todo()
  }

  /** `delete` removes; any other action is `setStatus` per id (one transaction each). Unknown ids are skipped, duplicates count once. */
  bulkAction(_action: QuestionBulkAction, _ids: readonly string[], _actor: QuestionActor): Promise<{ affected: number }> {
    return todo()
  }

  // --- lifecycle (BE-10 calls these) ------------------------------------------------------------

  /**
   * Moves the LATEST version of a question to `status`: 404 unknown id; 409 when the pair is not in
   * `QUESTION_WORKFLOW_TRANSITIONS` for the actor; for `published` also 422 unless subject, level,
   * unit, 1 to 3 SP and TP are set (`fields.{subjectId, educationLevelId, unitId, spIds, tp}`).
   * Publishing sets `live_version_no` and archives the superseded live version (`superseded`) in one
   * transaction. No quality gates and no status events here (BE-10).
   */
  setStatus(_id: string, _status: QuestionStatus, _actorId: string, _options?: SetStatusOptions): Promise<QuestionView> {
    return todo()
  }

  /** 404 unknown id. */
  getStatus(_id: string): Promise<QuestionStatusInfo> {
    return todo()
  }

  /** `is_active = false`; the question leaves practice at once. 404 unknown id. */
  deactivate(_id: string): Promise<void> {
    return todo()
  }

  reactivate(_id: string): Promise<void> {
    return todo()
  }

  // --- structured (admin reads) -----------------------------------------------------------------

  listStructured(_filter: StructuredListFilter): Promise<StructuredListResult> {
    return todo()
  }

  getStructured(_id: string): Promise<QuestionDetailView> {
    return todo()
  }

  // --- Guru (own rows only; another teacher id is 404) ------------------------------------------

  listOwn(_userId: string, _page: number, _pageSize?: number): Promise<Page<QuestionView>> {
    return todo()
  }

  getOwn(_id: string, _userId: string): Promise<QuestionDetailView> {
    return todo()
  }

  /** Saved straight as `review`, owner = `userId`, no gate (Q-11). */
  createGuru(_input: QuestionGuruCreateInput, _userId: string): Promise<QuestionDetailView> {
    return todo()
  }

  updateOwn(_id: string, _input: QuestionGuruUpdateInput, _userId: string): Promise<QuestionDetailView> {
    return todo()
  }

  removeOwn(_id: string, _userId: string): Promise<void> {
    return todo()
  }

  /** Counts for BE-17 (contributions): total and per latest-version status of the caller own questions. */
  contributionCountsFor(_userId: string): Promise<ContributionCounts> {
    return todo()
  }

  // --- learners (BE-12, BE-15, BE-41); there is no student HTTP route (Q-3) ---------------------

  /**
   * 404 unless the live version is `published` AND the question is active. Projected through
   * `QuestionPublicSchema`: no key, explanation, model answer, source file or flat answer fields.
   */
  getPublicForLearner(_id: string): Promise<PublicQuestion> {
    return todo()
  }

  /** Grades MCQ, match, short text, numeric and table_fill leaves; subjective leaves return `needs_review`. Reads the LIVE version. */
  gradeAnswer(_id: string, _answers: readonly PartAnswer[]): Promise<QuestionGrade> {
    return todo()
  }
}
