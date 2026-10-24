import { Inject, Injectable } from '@nestjs/common'
import type { GamesKeylessQuestion, QuestionPart } from '@pp/contract'

import type { Prng } from '../../../db/prng'
import { QuestionsRepository } from '../../questions'
import type { QuestionRecord } from '../../questions'

const LABELS = ['A', 'B', 'C', 'D'] as const

/** A question as a game serves it, plus the SERVER-ONLY key. The key is never part of `question`. */
export interface ServedQuestion {
  /** The keyless contract shape (`GamesKeylessQuestion`): id, text, options 0..3. Safe to send before the answer. */
  question: GamesKeylessQuestion
  /** SERVER ONLY: the index (0..3) of the correct option. */
  keyIndex: number
  /** SERVER ONLY: the text of the correct option. */
  keyText: string
  /** Difficulty TP 1..6 of the served version, null when unknown. */
  difficultyTp: number | null
  /** The version served (so a later edit never changes grading). */
  versionNo: number
}

export interface GameQuestionFilter {
  subjectId?: string
  educationLevelId?: string
  difficultyTp?: number
  excludeIds?: readonly string[]
}

/** Samples nothing beyond `n * OVERSAMPLE` ids so a bank of unusable questions cannot make a draw unbounded. */
const OVERSAMPLE = 4

/** What `toServed` accepts, in SQL: the draw (`sample`) and the gate (`eligibleCount`) share it, so a gate never passes while a draw is short. */
const GAME_SHAPE = { type: 'mcq', ungrouped: true, mcqShape: { minOptions: 2, maxOptions: 4 } } as const

/**
 * Draws game questions through `QuestionsRepository` (BE-09, the owner): published, active, single-part MCQ with
 * at most 4 options (labels A..D). The draw uses the supplied named PRNG stream.
 */
@Injectable()
export class GameQuestions {
  constructor(@Inject(QuestionsRepository) private readonly questions: QuestionsRepository) {}

  /** Up to `n` servable questions for the filter, in the order of the seeded sample. */
  async sample(filter: GameQuestionFilter, n: number, rng: Prng): Promise<ServedQuestion[]> {
    if (n <= 0) return []
    // Plain MCQ with 2 to 4 options only (what `toServed` accepts), so the oversampled window is rarely short.
    const ids = await this.questions.sample({ ...filter, ...GAME_SHAPE }, n * OVERSAMPLE, rng)
    return this.servedFrom(await this.questions.getMany(ids, 'live'), n)
  }

  /** The servable questions among `ids`, in the order of `ids`. Unknown / unservable ids are skipped. */
  async byIds(ids: readonly string[]): Promise<ServedQuestion[]> {
    return this.servedFrom(await this.questions.getMany(ids, 'live'), ids.length)
  }

  /** Servable (published, active, plain 2 to 4 option MCQ) questions for a filter (counts, e.g. "at least 15 for Jutawan"). */
  async eligibleCount(filter: GameQuestionFilter): Promise<number> {
    return this.questions.count({ ...filter, ...GAME_SHAPE, status: 'published', active: true })
  }

  private servedFrom(records: QuestionRecord[], limit: number): ServedQuestion[] {
    const out: ServedQuestion[] = []
    for (const r of records) {
      const served = toServed(r)
      if (served) out.push(served)
      if (out.length >= limit) break
    }
    return out
  }
}

/**
 * Maps a record to the keyless shape plus the server-only key. Only a question with ONE part that is an MCQ with
 * 2..4 options is servable (null otherwise). Option ids are the option index 0..3, labels A..D by position.
 */
export function toServed(record: QuestionRecord): ServedQuestion | null {
  const parts: QuestionPart[] = record.version.parts
  const part = parts.length === 1 ? parts[0] : undefined
  if (!part || !('mode' in part) || part.mode !== 'mcq') return null
  if (part.options.length < 2 || part.options.length > 4) return null
  const keyIndex = part.options.findIndex((o) => o.label === part.key.correct)
  if (keyIndex < 0) return null
  const stem = record.version.stemMs?.trim() ? record.version.stemMs : part.prompt.ms
  if (!stem.trim()) return null
  const options = part.options.map((o, i) => ({ id: i, label: LABELS[i] as (typeof LABELS)[number], text: o.body.ms }))
  if (options.some((o) => o.text.trim() === '')) return null
  return {
    question: { id: record.id, text: stem, options },
    keyIndex,
    keyText: options[keyIndex]?.text ?? '',
    difficultyTp: record.version.difficultyTp,
    versionNo: record.version.versionNo,
  }
}
