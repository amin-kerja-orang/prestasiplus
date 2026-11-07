/**
 * Ports of the SPM module (BE-41, owner M06). Same pattern as `PracticePorts` / `CurriculumPorts`: the structured
 * attempts live in `structured_attempts` of BE-13 (student structured practice), which is not merged. This card
 * does not stack on it: the Subjektif overview (M06-07) asks a small port with a safe default (no attempts), and
 * BE-13 binds the real adapter from its own `onModuleInit`. Registering one twice is a wiring error and throws.
 * Tests plug a fake in before `app.init()`.
 */
import { Injectable } from '@nestjs/common'
import type { SpmHistoryRowMode } from '@pp/contract'

/** The caller's structured attempts with scope `spm`, summarised (M06-07 `stats`). */
export interface SpmStructuredStats {
  /** Count of the caller's attempts. */
  setsAnswered: number
  /** Distinct subjects among them. */
  subjectsTried: number
  /** Best attempt percentage, rounded; null with no attempt. */
  bestScore: number | null
  /** Distinct structured questions attempted. */
  bestSetsSaved: number
}

export interface SpmStructuredAttemptSource {
  /**
   * Stats over the CALLER's structured attempts with scope `spm` only (another user's attempts never count).
   * `subjectIds` are the Subjektif subjects (decimal ids); rows written under Mod Pelajar count only with `includeTest`.
   */
  statsFor(userId: string, subjectIds: readonly string[], options: { includeTest: boolean }): Promise<SpmStructuredStats>
}

/** Until BE-13 merges: no attempts. */
export class NoStructuredAttempts implements SpmStructuredAttemptSource {
  async statsFor(): Promise<SpmStructuredStats> {
    return { setsAnswered: 0, subjectsTried: 0, bestScore: null, bestSetsSaved: 0 }
  }
}

/** Papers as the hub sees them (S3-T07): only the count of the Kertas Subjektif card. */
export interface SpmPaperSource {
  /** Published papers with `surface = 'subjektif'`; `level_scope` is not applied (the S3-T06 list does not apply it). */
  countPublishedSubjektif(): Promise<number>
}

/** Until the module binds its adapter: no papers. */
export class NoPapers implements SpmPaperSource {
  async countPublishedSubjektif(): Promise<number> {
    return 0
  }
}

/* ------------------------------------------------------------------------ S3-T07 part F: Prestasi SPM and Sejarah */

/** What a user's SPM-mode answers and sittings add up to (hub "Prestasi SPM Anda"). */
export interface SpmAnswerStats {
  /** Answer rows of the SPM modes (XS-4, XS-8: every answer, no session filter). */
  answered: number
  /** Of those, the correct ones; a self-marked part is correct only at full marks (XS-5). */
  correct: number
  /** Completed practice sessions plus closed Bijak sittings (`submitted`, `auto_submitted`); abandoned and in-progress never count. */
  sessions: number
}

/**
 * The answer-store read, implemented in `practice/` (S5 owns `practice_answers`; the sessions and the sittings come from their owners).
 * `includeTest` false leaves out rows written under Mod Pelajar (INV-30).
 */
export interface SpmAnswerStatsSource {
  statsFor(userId: string, options: { includeTest: boolean }): Promise<SpmAnswerStats>
}

export class NoAnswerStats implements SpmAnswerStatsSource {
  async statsFor(): Promise<SpmAnswerStats> {
    return { answered: 0, correct: 0, sessions: 0 }
  }
}

/** The M14 wallet ledger read (owner: wallet): Syiling earned from the SPM sources, never read from the answer store. */
export interface SpmCoinSource {
  earnedCoins(userId: string, options: { includeTest: boolean }): Promise<number>
}

export class NoCoins implements SpmCoinSource {
  async earnedCoins(): Promise<number> {
    return 0
  }
}

/** The chip of the Sejarah list after the aliases are resolved (`past_year` is `databank`, `ramalan` is `tracking_a`). */
export type SpmHistoryChip = 'all' | 'databank' | 'latih_tubi' | 'tracking_a'

export interface SpmHistoryRowData {
  id: string
  mode: SpmHistoryRowMode
  subject: { code: string; name: string }
  correct: number
  total: number
  /** Whole number, half up. */
  percent: number
  coins: number
  durationSeconds: number
  completedAt: Date
}

export interface SpmHistoryPageQuery {
  userId: string
  includeTest: boolean
  chip: SpmHistoryChip
  /** 1-based. */
  page: number
  pageSize: number
}

/**
 * The merged Sejarah list, implemented in `practice/`: completed `practice_sessions` and closed `exam_attempts` (read through
 * the attempts owner), newest first (`completedAt` desc, id desc), cut to one page on the server. `total` counts the rows of the chip.
 */
export interface SpmHistorySource {
  page(query: SpmHistoryPageQuery): Promise<{ rows: SpmHistoryRowData[]; total: number }>
}

export class NoHistory implements SpmHistorySource {
  async page(): Promise<{ rows: SpmHistoryRowData[]; total: number }> {
    return { rows: [], total: 0 }
  }
}

@Injectable()
export class SpmPorts {
  private papersSource: SpmPaperSource = new NoPapers()
  private attemptSource: SpmStructuredAttemptSource = new NoStructuredAttempts()
  private answerStatsSource: SpmAnswerStatsSource = new NoAnswerStats()
  private coinSource: SpmCoinSource = new NoCoins()
  private historySource: SpmHistorySource = new NoHistory()
  private readonly set = new Set<string>()

  get structuredAttempts(): SpmStructuredAttemptSource {
    return this.attemptSource
  }

  /** BE-13. */
  provideStructuredAttempts(source: SpmStructuredAttemptSource): void {
    if (this.set.has('structured attempts')) throw new Error('SpmPorts: the structured attempts source is already set')
    this.set.add('structured attempts')
    this.attemptSource = source
  }

  get papers(): SpmPaperSource {
    return this.papersSource
  }

  /** The papers table adapter, bound by `SpmModule.onModuleInit`. */
  providePapers(source: SpmPaperSource): void {
    if (this.set.has('papers')) throw new Error('SpmPorts: the papers source is already set')
    this.set.add('papers')
    this.papersSource = source
  }

  get answerStats(): SpmAnswerStatsSource {
    return this.answerStatsSource
  }

  /** The answer-store adapter of `practice/` (S5), bound by `PracticeSpmReadsModule.onModuleInit`. */
  provideAnswerStats(source: SpmAnswerStatsSource): void {
    if (this.set.has('answer stats')) throw new Error('SpmPorts: the answer stats source is already set')
    this.set.add('answer stats')
    this.answerStatsSource = source
  }

  get coins(): SpmCoinSource {
    return this.coinSource
  }

  /** The M14 ledger adapter, bound by `SpmModule.onModuleInit`. */
  provideCoins(source: SpmCoinSource): void {
    if (this.set.has('coins')) throw new Error('SpmPorts: the coins source is already set')
    this.set.add('coins')
    this.coinSource = source
  }

  get history(): SpmHistorySource {
    return this.historySource
  }

  /** The merged practice sessions + attempts adapter of `practice/` (S5), bound by `PracticeSpmReadsModule.onModuleInit`. */
  provideHistory(source: SpmHistorySource): void {
    if (this.set.has('history')) throw new Error('SpmPorts: the history source is already set')
    this.set.add('history')
    this.historySource = source
  }
}
