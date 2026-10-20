/* eslint-disable @typescript-eslint/no-unused-vars -- frozen signatures; bodies are filled in by the next commit */
import { Injectable } from '@nestjs/common'

import type { Prng } from '../../db/prng'
import type {
  GroupCountBy,
  GuruListFilter,
  Page,
  QuestionFilter,
  QuestionRecord,
  SampleFilter,
  StimulusGroupRecord,
  ViewMode,
} from './types'

const todo = (): never => {
  throw new Error('QuestionsRepository: not implemented yet')
}

/**
 * The only doorway to the question tables (ADR-0014, data model G-12). Other cards (BE-12 practice,
 * BE-15, BE-18, BE-41 Bijak, BE-10 reports) call the read methods below; they never query these
 * tables. Ids are decimal strings. `view` picks the version: `live` (the published version, what
 * practice serves; a question without one returns null) or `latest` (what the admin edits).
 *
 * FROZEN SIGNATURES. Bodies are filled in by BE-09 Part B.
 */
@Injectable()
export class QuestionsRepository {
  /** One question, or null. Default view is `live`. */
  get(_id: string, _view: ViewMode = 'live'): Promise<QuestionRecord | null> {
    return todo()
  }

  /** Several questions in the order of `ids`; missing ids (and, for `live`, unpublished) are skipped. */
  getMany(_ids: readonly string[], _view: ViewMode = 'live'): Promise<QuestionRecord[]> {
    return todo()
  }

  /** Questions matching `filter`. A `status` filter applies to the live version (`published`) or the latest version otherwise. */
  count(_filter: QuestionFilter = {}): Promise<number> {
    return todo()
  }

  /** Counts per key of `by` (decimal-string keys; `status` keys are the contract codes). Unknown keys are absent. */
  groupCount(_by: GroupCountBy, _filter: QuestionFilter = {}): Promise<Map<string, number>> {
    return todo()
  }

  /** True when the live version is `published` AND `questions.is_active` (Q-2). */
  eligibleForPractice(_id: string): Promise<boolean> {
    return todo()
  }

  /** Ids of eligible questions (published live version AND active), ascending. */
  eligibleIds(_filter?: QuestionFilter): Promise<string[]> {
    return todo()
  }

  /**
   * `n` eligible ids, deterministic for a given `Prng` state: candidates are sorted ascending then
   * shuffled with `rng` (never `Math.random`). Fewer than `n` candidates returns all of them.
   */
  sample(_filter: SampleFilter, _n: number, _rng: Prng): Promise<string[]> {
    return todo()
  }

  /** `is_active = false`: the question leaves `eligibleForPractice` at once. False when the id is unknown. */
  deactivate(_id: string): Promise<boolean> {
    return todo()
  }

  /** `is_active = true`. False when the id is unknown. */
  reactivate(_id: string): Promise<boolean> {
    return todo()
  }

  /** The stimulus group of a member question: stimuli once, ordered; null when ungrouped. */
  groupOf(_questionId: string): Promise<StimulusGroupRecord | null> {
    return todo()
  }

  /** The caller own questions only (Guru list), id ascending. */
  listOwn(_filter: GuruListFilter): Promise<Page<QuestionRecord>> {
    return todo()
  }
}
