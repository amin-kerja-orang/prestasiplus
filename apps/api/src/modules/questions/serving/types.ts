import type { QuestionFacts } from '@pp/exam-core'

import type { QuestionRecord, StimulusGroupRecord } from '../types'

/** The education level of a version, as the SPM and learner filters read it (`education_levels`). */
export interface LevelFact {
  id: string
  code: string
  /** `primary`, `lower_secondary` or `upper_secondary`. */
  stage: string
  isActive: boolean
}

/** The subject of a version and its place in the SPM lists (`subjects`, `subject_levels`, `spm_subject_configs`). */
export interface SubjectFact {
  id: string
  isActive: boolean
  /** A `subject_levels` row links the subject to the version's level (the `SPM_SERVABLE_SQL` rule). */
  linkedToLevel: boolean
  /** The subject has an SPM configuration row: it is one of the Latih Tubi subjects. */
  spmListed: boolean
  /** The subject has a Tahun Lepas position (`databank_order`): it is on the Databank list. */
  databankListed: boolean
}

/**
 * Everything the rules need about one question, loaded in batch by `ServabilityService` and handed to the pure `evaluate`.
 * `live` is the version pupils are served (null while none is live); `latest` is the newest version (the status reason when
 * nothing is live).
 */
export interface ServabilityFacts {
  live: QuestionRecord | null
  latest: QuestionRecord
  level: LevelFact | null
  subject: SubjectFact | null
  /** The stimulus group of the live question, or null. */
  group: StimulusGroupRecord | null
  /** Kind and file of every stimulus linked to the live version or to one of its leaves (`QuestionsRepository.stimulusAssets`). */
  linkedAssets: ReadonlyMap<string, { kind: string; assetFileId: string | null }>
  /** Internal file id to public token, for the files that exist (the Bijak bridge refuses a missing file). */
  fileTokens: ReadonlyMap<string, string>
  /** The question is placed on a published, non-generated paper (Simulasi). */
  onPublishedPaper: boolean
  /** Jana Kertas pool facts of the live version, or null when the pool does not hold it. */
  janaFacts: QuestionFacts | null
}
