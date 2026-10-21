/**
 * BE-30 / MIG-09 optional backfill: links migrated practice answers to new bank questions. STUB: Part C implements it.
 */
import type pg from 'pg'

import type { LegacySource, RunMode } from '../kit/types'

export interface LinkQuestionsOptions {
  pool: pg.Pool
  env: Readonly<Record<string, string | undefined>>
  source: LegacySource
  /** Default `dry-run` (counts only, rolled back). */
  mode?: RunMode
  batchSize?: number
}

export interface LinkQuestionsReport {
  mode: RunMode
  /** Answers with `question_id IS NULL`, `legacy_source = source`, that were examined. */
  examined: number
  /** Set to the single matching question. */
  linked: number
  /** More than one candidate question: left NULL. */
  ambiguous: number
  /** No candidate: left NULL. */
  unmatched: number
  /** Already had a `question_id`: never touched. */
  alreadyLinked: number
  /** Surrogate ids (practice_answers.id) of ambiguous rows, capped for printing. */
  ambiguousIds: string[]
  unmatchedIds: string[]
}

export async function linkQuestions(_options: LinkQuestionsOptions): Promise<LinkQuestionsReport> {
  throw new Error('linkQuestions: not implemented yet (BE-30 Part C).')
}
