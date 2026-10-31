/**
 * Question port of the paper builder (BE-39). Questions belong to M04 (BE-09 store, BE-10 workflow);
 * the builder never reads the `questions` tables. The source is registered by `ExamBuilderModule` (the
 * question bank, R1-B07: the PoC fixture is gone from `src`); before that the default is an empty source.
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
  /** Current lifecycle status (D54a, ADR-0027); `approved` = Terbit (the only servable status). */
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
  /** The group stimulus; a group without one is absent from `groups(...)`. */
  stimulus: BijakAttemptStimulus
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

/** Default until a module registers the bank: nothing to place, nothing to describe. */
class EmptyBuilderSource implements BuilderQuestionSource {
  async describe(): Promise<ReadonlyMap<string, BuilderQuestionInfo>> {
    return new Map()
  }
  async candidates(): Promise<string[]> {
    return []
  }
  async groups(): Promise<ReadonlyMap<string, BuilderGroupInfo>> {
    return new Map()
  }
  async review(): Promise<BuilderPreview> {
    return { questions: [], stimuli: {}, optionBanks: {} }
  }
}

/** Holder of the builder's question port, so BE-09/BE-10 plug in without editing this module. */
@Injectable()
export class BijakBuilderPorts {
  private questions: BuilderQuestionSource = new EmptyBuilderSource()
  private questionsSet = false

  get questionSource(): BuilderQuestionSource {
    return this.questions
  }

  /** BE-09/BE-10: replace the empty default by the question bank. Registering twice is a wiring error. */
  provideQuestionSource(provider: BuilderQuestionSource): void {
    if (this.questionsSet) throw new Error('BijakBuilderPorts: the question source is already set')
    this.questions = provider
    this.questionsSet = true
  }
}
