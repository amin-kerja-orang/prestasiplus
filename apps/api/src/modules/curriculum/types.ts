/** Wire types inferred from the contract schemas (the contract exports only some of them as types). */
import type {
  CurriculumChapterDetailSchema,
  CurriculumEducationLevelLookupSchema,
  CurriculumGradeCodeSchema,
  CurriculumLearningMapQuerySchema,
  CurriculumLegacySubjectCodeSchema,
  CurriculumSubjectLookupSchema,
  CurriculumTopicCardSchema,
  CurriculumTopicDetailLearnerSchema,
  CurriculumTopicDetailSchema,
  CurriculumTopicStateSchema,
  CurriculumTopicsQuerySchema,
} from '@pp/contract'
import type { z } from 'zod'

export type GradeCode = z.output<typeof CurriculumGradeCodeSchema>
export type LegacySubjectCode = z.output<typeof CurriculumLegacySubjectCodeSchema>
export type TopicState = z.output<typeof CurriculumTopicStateSchema>
export type EducationLevelLookup = z.output<typeof CurriculumEducationLevelLookupSchema>
export type SubjectLookup = z.output<typeof CurriculumSubjectLookupSchema>
export type TopicCard = z.output<typeof CurriculumTopicCardSchema>
export type LearnerTopicDetail = z.output<typeof CurriculumTopicDetailLearnerSchema>
export type ChapterDetail = z.output<typeof CurriculumChapterDetailSchema>
export type TopicDetail = z.output<typeof CurriculumTopicDetailSchema>
export type TopicsQuery = z.output<typeof CurriculumTopicsQuerySchema>
export type LearningMapQuery = z.output<typeof CurriculumLearningMapQuerySchema>
