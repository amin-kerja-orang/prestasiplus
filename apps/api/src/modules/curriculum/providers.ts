/**
 * Ports other cards implement. M03 never computes what it does not own: topic progress comes from
 * the answer log (M05, BE-13) and active question counts from the question bank (M04, BE-09).
 * Until those cards merge, the defaults below answer "nothing yet", which is the mock's initial
 * state (first two topics open, every count 0).
 */
import { Injectable } from '@nestjs/common'

import type { TopicProgress } from './rules'
import { NO_PROGRESS } from './rules'

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

/**
 * The two ports as one injectable holder, so a later module can plug in its implementation without
 * editing `curriculum.module.ts` and without a circular import (M03 never imports M04 or M05).
 *
 * How a later card uses it (BE-09 for question counts, BE-13 for topic progress):
 *
 * ```ts
 * @Module({ imports: [CurriculumModule], providers: [QuestionCountsAdapter] })
 * export class QuestionBankModule implements OnModuleInit {
 *   constructor(private readonly ports: CurriculumPorts, private readonly counts: QuestionCountsAdapter) {}
 *   onModuleInit() { this.ports.provideQuestionCounts(this.counts) }
 * }
 * ```
 *
 * The curriculum services read `ports.questionCounts` and `ports.topicProgress` on every request, so
 * the swap needs no restart order. Registering twice is a wiring error and throws.
 */
@Injectable()
export class CurriculumPorts {
  private progress: TopicProgressProvider = new NoTopicProgress()
  private counts: QuestionCountProvider = new NoQuestionCounts()
  private progressSet = false
  private countsSet = false

  get topicProgress(): TopicProgressProvider {
    return this.progress
  }

  get questionCounts(): QuestionCountProvider {
    return this.counts
  }

  /** BE-13: replace the "no progress yet" default. */
  provideTopicProgress(provider: TopicProgressProvider): void {
    if (this.progressSet) throw new Error('CurriculumPorts: the topic progress provider is already set')
    this.progress = provider
    this.progressSet = true
  }

  /** BE-09: replace the "no questions yet" default. */
  provideQuestionCounts(provider: QuestionCountProvider): void {
    if (this.countsSet) throw new Error('CurriculumPorts: the question count provider is already set')
    this.counts = provider
    this.countsSet = true
  }
}
