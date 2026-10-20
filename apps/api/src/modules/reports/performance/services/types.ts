import type { RoleCode, Scope } from '@pp/contract'
import type {
  PerformanceAnalyticsSchema,
  PerformanceClassAnalyticsQuerySchema,
  PerformanceClassAnalyticsSchema,
  PerformanceClassCardSchema,
  PerformanceClassDashboardSchema,
  PerformanceClassItemAnalysisSchema,
  PerformanceLevelCardSchema,
  PerformanceLeaderboardSchema,
  PerformanceLevelDetailSchema,
  PerformancePublicProfileSchema,
  PerformanceRankingSchema,
  PerformanceTimelinePostSchema,
  PerformanceSchoolItemAnalysisSchema,
  PerformanceSchoolSchema,
  PerformanceStudentSchema,
} from '@pp/contract'
import type { z } from 'zod'

/**
 * Who is asking, built by the controllers from `ScopeContext` (services never see Express).
 * `scope` is the ACTIVE scope of the request; nothing is read from the query or body.
 */
export interface Ctx {
  userId: string
  role: RoleCode
  scope: Scope
  /** Mod Pelajar is on. Test sittings are never counted either way (OQ-13). */
  isTest: boolean
}

export type PerformanceAnalytics = z.infer<typeof PerformanceAnalyticsSchema>
export type PerformanceClassAnalyticsQuery = z.infer<typeof PerformanceClassAnalyticsQuerySchema>
export type PerformanceClassAnalytics = z.infer<typeof PerformanceClassAnalyticsSchema>
export type PerformanceClassCard = z.infer<typeof PerformanceClassCardSchema>
export type PerformanceClassDashboard = z.infer<typeof PerformanceClassDashboardSchema>
export type PerformanceClassItemAnalysis = z.infer<typeof PerformanceClassItemAnalysisSchema>
export type PerformanceLevelCard = z.infer<typeof PerformanceLevelCardSchema>
export type PerformanceLevelDetail = z.infer<typeof PerformanceLevelDetailSchema>
export type PerformanceSchool = z.infer<typeof PerformanceSchoolSchema>
export type PerformanceSchoolItemAnalysis = z.infer<typeof PerformanceSchoolItemAnalysisSchema>
export type PerformanceStudent = z.infer<typeof PerformanceStudentSchema>

/** Query of the school item analysis: `tingkatan` is T4 or T5, anything else is ignored. */
export interface ItemAnalysisSchoolQuery {
  tingkatan?: string
}

export type PerformanceRanking = z.infer<typeof PerformanceRankingSchema>
export type PerformanceLeaderboard = z.infer<typeof PerformanceLeaderboardSchema>
export type PerformancePublicProfile = z.infer<typeof PerformancePublicProfileSchema>
export type PerformanceTimelinePost = z.infer<typeof PerformanceTimelinePostSchema>
