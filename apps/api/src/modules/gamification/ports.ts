import { Injectable } from '@nestjs/common'

/**
 * Practice facts M14 reads but does not own (M05 practice, BE-12/BE-13). Until that card merges the default
 * answers "nothing yet", which is the mock's behaviour while M05 is still a stub (every read is empty).
 */
export interface PracticeDaySession {
  sessionId: string
  mode: string
  correct: number
  total: number
  /** Seconds. */
  timeSpent: number
}

export interface PracticeDayFacts {
  /** The user's completed sessions of one Malaysia day (all modes). */
  sessions: readonly PracticeDaySession[]
  /** Chapter ids (decimal strings) of that day's answered questions; duplicates are fine. */
  chapterIds: readonly string[]
}

export interface PracticeMasteryFact {
  subjectId: string
  subjectName: string
  /** Sort position of the subject in the curriculum order. */
  subjectOrder: number
  correct: number
  answered: number
}

export interface PracticeFactsProvider {
  dayFacts(userId: string, date: string): Promise<PracticeDayFacts>
  /** Per subject answer counters of the user (all time). */
  mastery(userId: string): Promise<readonly PracticeMasteryFact[]>
  /** Completed sessions, all modes (`all`, share cards) and the practice modes only (`practice`, achievement progress). */
  sessionCounts(userId: string): Promise<{ all: number; practice: number }>
}

export class NoPracticeFacts implements PracticeFactsProvider {
  async dayFacts(): Promise<PracticeDayFacts> {
    return { sessions: [], chapterIds: [] }
  }
  async mastery(): Promise<readonly PracticeMasteryFact[]> {
    return []
  }
  async sessionCounts(): Promise<{ all: number; practice: number }> {
    return { all: 0, practice: 0 }
  }
}

/**
 * The port as one injectable holder, so BE-12/BE-13 can plug in without editing this module and without a
 * circular import (see `CurriculumPorts`):
 *
 * ```ts
 * onModuleInit() { this.ports.providePracticeFacts(this.adapter) }
 * ```
 */
@Injectable()
export class GamificationPorts {
  private practice: PracticeFactsProvider = new NoPracticeFacts()
  private set = false

  get practiceFacts(): PracticeFactsProvider {
    return this.practice
  }

  /** Replaces the "no practice data yet" default. Registering twice is a wiring error. */
  providePracticeFacts(provider: PracticeFactsProvider): void {
    if (this.set) throw new Error('GamificationPorts: the practice facts provider is already set')
    this.practice = provider
    this.set = true
  }
}
