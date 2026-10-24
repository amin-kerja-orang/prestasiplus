import { randomInt } from 'node:crypto'

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
  /** BR-M14-16 "Tepat Sasaran": completed practice-mode sessions whose accuracy (correct / questions) is at least `minPct` percent. */
  accurateSessions(userId: string, minPct: number): Promise<number>
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
  async accurateSessions(): Promise<number> {
    return 0
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
/**
 * Where lucky draw randomness comes from: `(drawId) => (maxInclusive) => integer in [0, maxInclusive]`. Production
 * uses the operating system CSPRNG (`crypto.randomInt`) so winners are neither predictable nor choosable by an admin.
 * Only tests replace it (seeded `prngStream`, for the AC5 determinism); no request input ever reaches it.
 */
export type DrawRandomSource = (drawId: string) => (maxInclusive: number) => number

export const cryptoDrawRandom: DrawRandomSource = () => (maxInclusive) => randomInt(0, maxInclusive + 1)

@Injectable()
export class GamificationPorts {
  private draw: DrawRandomSource = cryptoDrawRandom

  get drawRandom(): DrawRandomSource {
    return this.draw
  }

  /** Test seam: replaces the CSPRNG source of the lucky draw. Never called by application code. */
  overrideDrawRandom(source: DrawRandomSource): void {
    this.draw = source
  }

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
