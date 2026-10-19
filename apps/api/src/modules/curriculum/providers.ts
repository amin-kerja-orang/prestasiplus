/**
 * Ports other cards implement. M03 never computes what it does not own: topic progress comes from
 * the answer log (M05, BE-13) and active question counts from the question bank (M04, BE-09).
 * Until those cards merge, the defaults below answer "nothing yet", which is the mock's initial
 * state (first two topics open, every count 0).
 */
import type { TopicProgress } from './rules'
import { NO_PROGRESS } from './rules'

/** DI token for the topic progress provider (BE-13 provides its own with `useClass`/`useExisting`). */
export const TOPIC_PROGRESS_PROVIDER = Symbol('TOPIC_PROGRESS_PROVIDER')

export interface TopicProgressProvider {
  /**
   * Progress of one learner per learner topic id (decimal string), derived on read from the answer
   * log (BR-19). A topic missing from the map has no progress. Nothing is stored by M03.
   */
  topicProgress(userId: string): Promise<ReadonlyMap<string, TopicProgress>>
}

/** The default until BE-13 merges: no answers, so every topic reads 0. */
export class NoTopicProgress implements TopicProgressProvider {
  async topicProgress(): Promise<ReadonlyMap<string, TopicProgress>> {
    return new Map()
  }
}

export function progressOf(map: ReadonlyMap<string, TopicProgress>, topicId: string): TopicProgress {
  return map.get(topicId) ?? NO_PROGRESS
}

/** DI token for the active question counts shown on the admin level and subject lists. */
export const QUESTION_COUNT_PROVIDER = Symbol('QUESTION_COUNT_PROVIDER')

export interface QuestionCountProvider {
  /** Active (published) questions per education level id (decimal string); missing = 0. */
  activeByLevel(): Promise<ReadonlyMap<string, number>>
  /** Active (published) questions per subject id (decimal string); missing = 0. */
  activeBySubject(): Promise<ReadonlyMap<string, number>>
}

/** The default until BE-09 merges: the question bank is empty. */
export class NoQuestionCounts implements QuestionCountProvider {
  async activeByLevel(): Promise<ReadonlyMap<string, number>> {
    return new Map()
  }
  async activeBySubject(): Promise<ReadonlyMap<string, number>> {
    return new Map()
  }
}
