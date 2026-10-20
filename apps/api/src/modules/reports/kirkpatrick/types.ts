import type {
  KirkpatrickBehaviorSchema,
  KirkpatrickChainSchema,
  KirkpatrickFeedbackRequestSchema,
  KirkpatrickFeedbackResponseSchema,
  KirkpatrickFeedbackStatusSchema,
  KirkpatrickFilterOptionsSchema,
  KirkpatrickInterventionCreateRequestSchema,
  KirkpatrickInterventionListSchema,
  KirkpatrickInterventionRowSchema,
  KirkpatrickLearningSchema,
  KirkpatrickMeSchema,
  KirkpatrickOverviewSchema,
  KirkpatrickReactionSchema,
  KirkpatrickResultsSchema,
  KirkpatrickStudentSchema,
} from '@pp/contract'
import type { z } from 'zod'

/** Wire shapes, inferred from the contract schemas (the contract exports the schemas only). */
export type KirkpatrickOverview = z.output<typeof KirkpatrickOverviewSchema>
export type KirkpatrickReaction = z.output<typeof KirkpatrickReactionSchema>
export type KirkpatrickLearning = z.output<typeof KirkpatrickLearningSchema>
export type KirkpatrickBehavior = z.output<typeof KirkpatrickBehaviorSchema>
export type KirkpatrickResults = z.output<typeof KirkpatrickResultsSchema>
export type KirkpatrickChain = z.output<typeof KirkpatrickChainSchema>
export type KirkpatrickFilterOptions = z.output<typeof KirkpatrickFilterOptionsSchema>
export type KirkpatrickStudent = z.output<typeof KirkpatrickStudentSchema>
export type KirkpatrickMe = z.output<typeof KirkpatrickMeSchema>
export type KirkpatrickInterventionRow = z.output<typeof KirkpatrickInterventionRowSchema>
export type KirkpatrickInterventionList = z.output<typeof KirkpatrickInterventionListSchema>
export type KirkpatrickInterventionCreateRequest = z.output<typeof KirkpatrickInterventionCreateRequestSchema>
export type KirkpatrickFeedbackStatus = z.output<typeof KirkpatrickFeedbackStatusSchema>
export type KirkpatrickFeedbackRequest = z.output<typeof KirkpatrickFeedbackRequestSchema>
export type KirkpatrickFeedbackResponse = z.output<typeof KirkpatrickFeedbackResponseSchema>
