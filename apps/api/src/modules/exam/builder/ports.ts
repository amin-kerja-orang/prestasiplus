/**
 * Question port of the paper builder (BE-39). Questions belong to M04 (BE-09 store, BE-10 workflow);
 * the builder never reads the `questions` tables. Until BE-09/BE-10 provide the question bank, the
 * default is the PoC fixture (`poc-builder-source.ts`), which serves the reserved PoC question ids of
 * the BE-15 seed (all published, version 1).
 *
 * WIRE-UP (main session, after BE-09 + BE-10): a `QuestionsService` backed implementation registers
 * itself from the question module's `onModuleInit` (the `CurriculumPorts` pattern):
 *
 * ```ts
 * onModuleInit() { this.builderPorts.provideQuestionSource(this.builderQuestions) }
 * ```
 *
 * Every id is a decimal-string question id. `versionNo` is the question version (v2-question-bank
 * 4.6: editing a published question makes version n+1); a ref without `versionNo` means "the version
 * in force now". `status` is ALWAYS the current lifecycle status of the question (D54a), whatever
 * version is described.
 */
import { Injectable } from '@nestjs/common'
import type {
  BijakAttemptOption,
  BijakAttemptStimulus,
  BijakBuilderQuestionKind,
  BijakBuilderQuestionStatus,
  BijakBuilderReviewQuestion,
} from '@pp/contract'

import { PocBuilderQuestionSource } from './poc-builder-source'

export interface BuilderQuestionRef {
  id: string
  /** The pinned version; absent = the version in force now. */
  versionNo?: number
}

/** A question as the builder needs it: structure and picker text. Never an answer key or scheme. */
export interface BuilderQuestionInfo {
  id: string
  /** The version described (the pinned one when asked, else the current one). */
  versionNo: number
  /** Current lifecycle status (D54a); `published` = Terbit. */
  status: BijakBuilderQuestionStatus
  /** Bijak subject code (MAT, SN, SEJ ...), as `curriculum.subject` of the question. */
  subject: string
  kertas: number
  /** Stimulus group (D6), or null. */
  groupId: string | null
  /** Label of the group stimulus ("Rajah 2"), when the group has one. */
  stimulusLabel?: string
  /** Picker text (`previewOf` of the prototype). */
  preview: string
  /** Total marks at this version (`marksOf` of the prototype). */
  marks: number
  kind: BijakBuilderQuestionKind
  /** Display name of the curriculum unit. */
  topic: string
}

export interface BuilderGroupInfo {
  id: string
  /** The first group stimulus; a group without one is absent from `groups(...)`. */
  stimulus: BijakAttemptStimulus
  /**
   * D90 (R1-T07): every stimulus of the group in order, 1 to 3, the first being `stimulus`. The group is ONE unit: the stimuli
   * are shown once above all member questions and carry no marks. Absent = `[stimulus]` (PoC fixture).
   */
  stimuli?: BijakAttemptStimulus[]
  /** Member question ids in published order. */
  questionIds: string[]
}

export interface BuilderCandidateScope {
  /** Bijak subject code of the paper. */
  subject: string
  kertas: number
}

export interface BuilderPreview {
  questions: BijakBuilderReviewQuestion[]
  stimuli: Record<string, BijakAttemptStimulus>
  /** R1-T07: all stimuli (1 to 3) per group, in order; `stimuli[groupId]` is the first. Absent = one per group. */
  groupStimuli?: Record<string, BijakAttemptStimulus[]>
  optionBanks: Record<string, BijakAttemptOption[]>
}

export interface BuilderQuestionSource {
  /** Info per ref, keyed by question id; an id that does not exist is absent. */
  describe(refs: readonly BuilderQuestionRef[]): Promise<ReadonlyMap<string, BuilderQuestionInfo>>
  /** Picker candidates: ids of the PUBLISHED questions of the subject and kertas, in bank order. */
  candidates(scope: BuilderCandidateScope): Promise<string[]>
  /** Group id -> group (stimulus and members in published order); unknown or stimulus-less groups are absent. */
  groups(groupIds: readonly string[]): Promise<ReadonlyMap<string, BuilderGroupInfo>>
  /** Admin review content (`previewQuestions`): carries the answer key and mark scheme. Unknown ids are left out. */
  review(ids: readonly string[]): Promise<BuilderPreview>
}

/** Holder of the builder's question port, so BE-09/BE-10 plug in without editing this module. */
@Injectable()
export class BijakBuilderPorts {
  private questions: BuilderQuestionSource = new PocBuilderQuestionSource()
  private questionsSet = false

  get questionSource(): BuilderQuestionSource {
    return this.questions
  }

  /** BE-09/BE-10: replace the PoC fixture by the question bank. Registering twice is a wiring error. */
  provideQuestionSource(provider: BuilderQuestionSource): void {
    if (this.questionsSet) throw new Error('BijakBuilderPorts: the question source is already set')
    this.questions = provider
    this.questionsSet = true
  }
}
