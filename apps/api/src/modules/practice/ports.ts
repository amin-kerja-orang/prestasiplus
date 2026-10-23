/**
 * Ports of the practice module (BE-12, owner M05). The owners of data the write path reads are other cards
 * that are not merged yet, so the module talks to them through small interfaces with safe defaults. Same
 * pattern as `CurriculumPorts` / `BijakAttemptPorts`: the holder below is exported by `PracticeModule`; the
 * owning card (or the Delivery Lead) plugs the real adapter in from its own `onModuleInit`. Registering one
 * twice is a wiring error and throws. Tests plug fakes in before `app.init()`.
 *
 * - `PracticeQuestionSource`   BE-09 (question bank: selection, served version, grading). Default: empty bank.
 * - `PracticeAssignmentSource` BE-18 (missions, remedial tests, question sets). Default: `SET_NOT_READY`.
 * - `PracticeRamalanSource`    BE-41 (`SpmTrackingService.ramalanQuestionIds`). Default: empty set.
 * - `PracticeRewardPort`       BE-11 / BE-23 (wallet credit, quest rewards, streak). Default: no-op.
 *
 * Every port method that runs inside the submit transaction receives that transaction (`tx`), and the
 * ambient one (`PrismaService.transaction`) is active too, so a real adapter that writes joins the same unit
 * of work and rolls back with it (AC 1).
 */
import { Injectable } from '@nestjs/common'

import type { TxClient } from '../../db/client'
import type { Prng } from '../../db/prng'
import type { PracticeMode } from '@pp/contract'

/* --------------------------------------------------------------------------------- BE-09: questions */

/**
 * One question as practice serves and grades it: ONE version of it (the live one at start, or the exact
 * version a session served when grading). Ids are decimal strings.
 */
export interface PracticeQuestion {
  id: string
  versionNo: number
  /** Dimensions copied onto the answer row at answer time (AC 6). */
  subjectId: string | null
  educationLevelId: string | null
  chapterId: string | null
  topicId: string | null
  /** Mock difficulty scale (1 to 5), null when unknown. */
  difficulty: number | null
  /** Store type, for example `mcq`. Only `mcq` questions are served by this path. */
  questionType: string
  /** In the SPM pool (past_year, latih_tubi). */
  spmPool: boolean
  questionText: string
  textDirection: 'ltr' | 'rtl'
  scriptType: 'rumi' | 'arab' | 'jawi' | 'mixed'
  hasDskp: boolean
  /** Teacher who wrote the question ("Soalan oleh:"), else null. */
  contributor: { name: string; profileUrl: string | null } | null
  /** Options in served order; the zero-based index is the wire `selectedOptionId`. Labels `A`..`H`. */
  options: { label: string; text: string }[]
  /** SERVER ONLY: the key label. Never put it in a start response (AC 4). */
  correctLabel: string | null
  /** SERVER ONLY until the check. */
  explanation: string | null
}

/** Filter of a random / SPM-pool draw. Eligibility (published, active, live version) is always forced. */
export interface PracticeSelection {
  subjectId: string
  /** Any of these levels; absent = every level. */
  educationLevelIds?: readonly string[]
  difficulty?: number
  /** True = only SPM-pool questions (past_year, latih_tubi). */
  spmPool?: boolean
}

export interface PracticeQuestionSource {
  /** `QuestionsRepository.sample`: up to `n` eligible ids drawn in SQL (seeded hash order, LIMIT) with a seed taken from `rng`. */
  sample(filter: PracticeSelection, n: number, rng: Prng): Promise<string[]>
  /**
   * Question count per chapter, one grouped statement; a chapter with none is absent or 0. Cheap form (default): eligible
   * published plain MCQs (BR-15 list). `exact: true` also checks the servable shape per row (one part, no stimulus, no option
   * image, the key names an option): use it for a few chapters only (the target and the one before it, BR-16).
   */
  chapterCounts(chapterIds: readonly string[], exact?: boolean): Promise<ReadonlyMap<string, number>>
  /** Up to `limit` servable questions of a chapter in ascending id order, never one of `excludeIds` (BR-17 unanswered first). */
  chapterPage(chapterId: string, excludeIds: readonly string[], limit: number): Promise<string[]>
  /**
   * The LIVE version of each id that is eligible for practice NOW (`eligibleForPractice`: published, active).
   * An ineligible or unknown id is omitted, so it is never served (AC 4).
   */
  live(ids: readonly string[]): Promise<ReadonlyMap<string, PracticeQuestion>>
  /**
   * The exact versions a session served (OD-28): key `${questionId}@${versionNo}`. Used for check and submit,
   * so a later edit (version n+1) never changes the grading (AC 11). Eligibility is NOT re-checked here.
   */
  versions(refs: readonly { questionId: string; versionNo: number }[]): Promise<ReadonlyMap<string, PracticeQuestion>>
}

/** Until BE-09 merges: the bank is empty (every draw is `NOT_ENOUGH_QUESTIONS`). */
export class NoPracticeQuestions implements PracticeQuestionSource {
  async sample(): Promise<string[]> {
    return []
  }
  async chapterCounts(): Promise<ReadonlyMap<string, number>> {
    return new Map()
  }
  async chapterPage(): Promise<string[]> {
    return []
  }
  async live(): Promise<ReadonlyMap<string, PracticeQuestion>> {
    return new Map()
  }
  async versions(): Promise<ReadonlyMap<string, PracticeQuestion>> {
    return new Map()
  }
}

export const versionKey = (questionId: string, versionNo: number): string => `${questionId}@${versionNo}`

/* ------------------------------------------------------------------------- BE-18: assigned work */

export type AssignmentKind = 'mission' | 'remedial' | 'question_set'

export type AssignmentResolution =
  /** BE-18 not merged: the mock's `SET_NOT_READY` (422 "Soalan tidak mencukupi."). */
  | { status: 'not_ready' }
  /** Unknown, not visible to this student, or cancelled: 404 `NOT_FOUND`. */
  | { status: 'not_found' }
  | {
      status: 'ok'
      subjectId: string | null
      questionIds: string[]
      /** mission: coins per correct answer (else `MISSION_COINS_PER_CORRECT`). */
      coinsPerCorrect?: number | null
      /** question_set: time limit in seconds. */
      timeLimitSec?: number | null
      /** question_set: 0 = unlimited. */
      maxAttempts?: number
      /** remedial: the test is already completed (409 "Ujian ini sudah selesai."). */
      completed?: boolean
    }

export interface PracticeAssignmentSource {
  resolve(kind: AssignmentKind, input: { userId: string; id: string; at: Date }): Promise<AssignmentResolution>
  /** Runs inside the submit transaction when a remedial session completes (mock `seams().remedialComplete`). */
  remedialCompleted(input: { remedialTestId: string; userId: string; afterAccuracy: number; completedAt: Date; isTest: boolean }, tx: TxClient): Promise<void>
}

export class NoAssignments implements PracticeAssignmentSource {
  async resolve(): Promise<AssignmentResolution> {
    return { status: 'not_ready' }
  }
  async remedialCompleted(): Promise<void> {}
}

/* ------------------------------------------------------------------------------ BE-41: ramalan */

export interface PracticeRamalanSource {
  /** Question ids of a ramalan set; `null` = unknown set (404), `[]` = not ready (422 `SET_NOT_READY`). */
  ramalanQuestionIds(subjectId: string, year: number, setNo: number): Promise<string[] | null>
}

/** Until BE-41 merges: every set is empty (the mock's empty-set behaviour). */
export class NoRamalan implements PracticeRamalanSource {
  async ramalanQuestionIds(): Promise<string[] | null> {
    return []
  }
}

/* ---------------------------------------------------------------------- BE-11 / BE-23: rewards */

/** Ledger `source` of the practice modes (`random`, `chapter`, `revision`, `mission`, `remedial`, `question_set`). */
export const PRACTICE_REWARD_SOURCE = 'quiz_practice'

/** Wallet ledger `source` of a practice session credit (M14 BR-M14-03 / DATA-M14-02). */
export type PracticeRewardSource = 'quiz_practice' | 'quiz_spm' | 'quiz_pksk'

/**
 * M14 BR-M14-03: the ledger source follows the session mode. The SPM modes `past_year`, `latih_tubi` and
 * `ramalan` credit as `quiz_spm`, `pksk` as `quiz_pksk`, and every other (practice) mode as `quiz_practice`.
 * The reward binding passes this as `CreditInput.source`.
 */
export function practiceRewardSource(mode: PracticeMode): PracticeRewardSource {
  switch (mode) {
    case 'past_year':
    case 'latih_tubi':
    case 'ramalan':
      return 'quiz_spm'
    case 'pksk':
      return 'quiz_pksk'
    default:
      return PRACTICE_REWARD_SOURCE
  }
}

export interface PracticeSessionCompleted {
  userId: string
  sessionId: string
  mode: PracticeMode
  /** Wallet ledger source for this mode (`practiceRewardSource(mode)`, M14 BR-M14-03). */
  source: PracticeRewardSource
  correct: number
  total: number
  timeSpent: number
  completedAt: Date
  /** BR-09: 10 x correct. */
  pointsEarned: number
  /** BR-09: the session's own coins (mock `sessionCoins`). */
  sessionCoins: number
  /** mission only. */
  coinsPerCorrect?: number
  /** True under Mod Pelajar: every ledger row must be stamped `is_test`. */
  isTest: boolean
}

export interface PracticeRewardResult {
  /** What the wallet credited (returned in the submit response; the session keeps `sessionCoins`). */
  coinsEarned: number
  streakCount: number
  totalBalance: number
}

export interface PracticeRewardPort {
  /**
   * ADR-0014 amendment 2 step 6 (`gamification.onSessionCompleted`), called INSIDE the submit transaction.
   * A throw rolls the whole submit back. Real binding once BE-11 merges (lock order: streak, then wallet):
   *
   * ```ts
   * const streak = await streakService.touch(userId, { at: completedAt, tx })
   * const credit = sessionCoins > 0
   *   ? await walletService.credit({ userId, amount: sessionCoins, isTest, source: input.source,
   *       sourceId: sessionId, description: 'Latihan: jawapan betul' }, { tx })   // static BM, idempotent key
   *   : null
   * await walletService.recordSessionCredit({ sessionId, userId, coinsEarned, pointsEarned,
   *   streakCount: streak.current, totalBalance, completedAt, isTest }, { tx })
   * ```
   *
   * Quest rewards (BR-10, once per quest per Malaysia day) are BE-23's and join here.
   */
  onSessionCompleted(input: PracticeSessionCompleted, tx: TxClient): Promise<PracticeRewardResult>
}

/** Until BE-11 / BE-23 merge: nothing is credited. */
export class NoReward implements PracticeRewardPort {
  async onSessionCompleted(): Promise<PracticeRewardResult> {
    return { coinsEarned: 0, streakCount: 0, totalBalance: 0 }
  }
}

/* -------------------------------------------------------------------------------- the holder */

@Injectable()
export class PracticePorts {
  private questionSource: PracticeQuestionSource = new NoPracticeQuestions()
  private assignmentSource: PracticeAssignmentSource = new NoAssignments()
  private ramalanSource: PracticeRamalanSource = new NoRamalan()
  private rewardPort: PracticeRewardPort = new NoReward()
  private readonly set = new Set<string>()

  get questions(): PracticeQuestionSource {
    return this.questionSource
  }
  get assignments(): PracticeAssignmentSource {
    return this.assignmentSource
  }
  get ramalan(): PracticeRamalanSource {
    return this.ramalanSource
  }
  get reward(): PracticeRewardPort {
    return this.rewardPort
  }

  private once(name: string): void {
    if (this.set.has(name)) throw new Error(`PracticePorts: the ${name} is already set`)
    this.set.add(name)
  }

  /** BE-09. */
  provideQuestions(source: PracticeQuestionSource): void {
    this.once('question source')
    this.questionSource = source
  }
  /** BE-18. */
  provideAssignments(source: PracticeAssignmentSource): void {
    this.once('assignment source')
    this.assignmentSource = source
  }
  /** BE-41. */
  provideRamalan(source: PracticeRamalanSource): void {
    this.once('ramalan source')
    this.ramalanSource = source
  }
  /** BE-11 / BE-23. */
  provideReward(port: PracticeRewardPort): void {
    this.once('reward port')
    this.rewardPort = port
  }
}
