/**
 * Ports of the Bijak attempts module (BE-16). The owners of the data this card reads are other
 * cards that may not be merged yet, so the module talks to them through four small interfaces with
 * safe defaults. Same pattern as `CurriculumPorts`: the holder below is exported by
 * `BijakAttemptsModule`; the owning card (or the main session) plugs the real adapter in from its
 * own `onModuleInit`. Registering one twice is a wiring error and throws. Tests plug fakes in
 * before `app.init()`.
 *
 * - `BijakPaperSource`     BE-15 (papers, sections, placements). Default: no paper exists.
 * - `BijakQuestionSource`  BE-09 (question bank: content, answer keys, schemes). Default: empty.
 * - `BijakRewardPort`      BE-11 (wallet). Default: no-op.
 * - `BijakAttemptAggregatePort`  BE-12 / US-33 (teacher and school analytics over the practice store). Default: no-op.
 */
import { Injectable } from '@nestjs/common'

import type { McqOption, QuestionDef, SchemeDef, SectionSnapshot, StimulusDef } from './exam-core.adapter'

/* ----------------------------------------------------------------------------- BE-15: papers */

/** A paper as an attempt needs it: the snapshot fields plus the frozen composition (sections and their question ids in order). */
export interface AttemptPaper {
  /** Decimal-string id of `papers.id` (the wire id of the paper). */
  id: string
  kind: 'pilihan' | 'jana'
  title: string
  /** Subject code, for example `MAT`. */
  subject: string
  subjectName: string
  kertas: number
  /** Printed paper code, for example `1449/2`. */
  code: string
  durationMin: number
  /** Sections with the question ids placed in them, in paper order. `id` is the section's wire id. */
  sections: SectionSnapshot[]
}

export type PaperResolution =
  | { ok: true; paper: AttemptPaper }
  /** Unknown, unpublished, or a generated paper of another user: 404 "Kertas tidak ditemui". */
  | { ok: false; reason: 'not_found' }
  /** The caller may not sit this paper (for example a subscription gate): 403. */
  | { ok: false; reason: 'not_eligible' }

export interface BijakPaperSource {
  /**
   * Resolves `paperId` for `userId` and checks eligibility (BE-15 "start attempt eligibility").
   * The returned sections are copied into the attempt and never re-read (a later edit of the paper
   * does not change a running attempt).
   */
  resolveForAttempt(input: { userId: string; paperId: string; isTest: boolean }): Promise<PaperResolution>
}

/* --------------------------------------------------------------------------- BE-09: questions */

/** Everything the attempts module needs about one question. The shapes are the prototype's (`@pp/exam-core` types). */
export interface BijakQuestionBundle {
  question: QuestionDef
  /** The stimulus group of the question (`question.groupId`), when it has one. */
  group?: { id: string; stimulus: StimulusDef; optionBank?: McqOption[] }
  /**
   * Mark scheme per LEAF id. For an MCQ question the leaf id is the question id; for a structured
   * question it is the id of each leaf part. SERVER ONLY: a scheme leaves the API only inside a
   * graded result (after submit, or per question after "Semak" in latihan).
   */
  schemes: Readonly<Record<string, SchemeDef>>
}

export interface BijakQuestionSource {
  /**
   * Returns the bundles for `questionIds` (the version pinned for the paper). An id that cannot be
   * loaded is omitted; the attempt then fails with a 500 rather than serving a broken paper.
   */
  loadQuestions(questionIds: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>>
}

/* ------------------------------------------------------------------------------ BE-11: reward */

/** Static BM description of the wallet ledger line. */
export const BIJAK_REWARD_DESCRIPTION = 'Ganjaran kertas Bijak SPM'

export interface BijakRewardInput {
  attemptId: string
  userId: string
  /** True under Mod Pelajar: the wallet must flag the line as test data. */
  isTest: boolean
  /** The display values of the result (`score * 2` coins, `score * 10` points). */
  coins: number
  points: number
  score: number
  max: number
  provisional: boolean
  description: typeof BIJAK_REWARD_DESCRIPTION
}

export interface BijakRewardPort {
  /**
   * Called ONCE, after the commit that closed an EXAM attempt (submitted or auto_submitted; never a
   * latihan, whose "Semak" shows the scheme), never for a replay, a late-sync regrade or an abandoned attempt. Failures are logged and swallowed.
   * Real binding (BE-11): `WalletService.credit({ userId, amount: coins, isTest, sourceId: attemptId,
   * description })`; `sourceId` makes it idempotent. The mock credits nothing (open question 2).
   */
  award(input: BijakRewardInput): Promise<void>
}

/* ---------------------------------------------------------------------------- US-33: aggregate */

export interface BijakAttemptAggregateInput {
  attemptId: string
  userId: string
  isTest: boolean
  /** Decimal-string paper id; null for a migrated attempt. */
  paperId: string | null
  subject: string
  kertas: number
  mode: 'exam' | 'latihan'
  status: 'submitted' | 'auto_submitted'
  score: number
  max: number
  provisional: boolean
  /** True when a late sync re-graded an attempt that was already counted (replace, do not add). */
  regraded: boolean
  questions: { questionId: string; marks: number; awarded: number; attempted: boolean; counted: boolean }[]
  /** AC-33.4 "start type": the paper kind of the attempt (BE-12 open question 1). */
  paperKind?: 'pilihan' | 'jana' | null
  /** AC-33.4 "duration": when the attempt started. */
  startedAt?: Date | null
  /** AC-33.4 "duration": when it was closed (submitted or auto-submitted). */
  submittedAt?: Date | null
}

export interface BijakAttemptAggregatePort {
  /**
   * Feeds teacher and school analytics (US-33). `isTest` rows must be excluded from other users'
   * aggregates. Bound to BE-12's `PracticeAggregateService` by `BijakIntegrationModule`.
   */
  recordGraded(input: BijakAttemptAggregateInput): Promise<void>
}

/* -------------------------------------------------------------------------------- defaults */

/** Until BE-15 merges: no paper can be started. */
export class NoPapers implements BijakPaperSource {
  async resolveForAttempt(): Promise<PaperResolution> {
    return { ok: false, reason: 'not_found' }
  }
}

/** Until BE-09 merges: the bank is empty. */
export class NoQuestions implements BijakQuestionSource {
  async loadQuestions(): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    return new Map()
  }
}

export class NoReward implements BijakRewardPort {
  async award(): Promise<void> {}
}

export class NoAggregate implements BijakAttemptAggregatePort {
  async recordGraded(): Promise<void> {}
}

/** The four ports as one injectable holder (see the file comment). */
@Injectable()
export class BijakAttemptPorts {
  private papers: BijakPaperSource = new NoPapers()
  private questions: BijakQuestionSource = new NoQuestions()
  private rewardPort: BijakRewardPort = new NoReward()
  private aggregatePort: BijakAttemptAggregatePort = new NoAggregate()
  private readonly set = new Set<string>()

  get paperSource(): BijakPaperSource {
    return this.papers
  }
  get questionSource(): BijakQuestionSource {
    return this.questions
  }
  get reward(): BijakRewardPort {
    return this.rewardPort
  }
  get aggregate(): BijakAttemptAggregatePort {
    return this.aggregatePort
  }

  private once(name: string): void {
    if (this.set.has(name)) throw new Error(`BijakAttemptPorts: the ${name} is already set`)
    this.set.add(name)
  }

  /** BE-15. */
  providePaperSource(source: BijakPaperSource): void {
    this.once('paper source')
    this.papers = source
  }
  /** BE-09. */
  provideQuestionSource(source: BijakQuestionSource): void {
    this.once('question source')
    this.questions = source
  }
  /** BE-11. */
  provideReward(port: BijakRewardPort): void {
    this.once('reward port')
    this.rewardPort = port
  }
  /** US-33 / BE-12. */
  provideAggregate(port: BijakAttemptAggregatePort): void {
    this.once('aggregate port')
    this.aggregatePort = port
  }
}
