import type {
  AnalyticsItemAnalysisSchema,
  AnalyticsMonitoringExportSchema,
  AnalyticsMonitoringOverviewSchema,
  AnalyticsSchoolDetailSchema,
  AnalyticsStudentDetailSchema,
  AnalyticsTeacherDetailSchema,
  AnalyticsTeacherReportSchema,
} from '@pp/contract'
import type { z } from 'zod'

/** Wire shapes, inferred from the contract schemas (the contract exports the schemas only). */
export type MonitoringOverview = z.infer<typeof AnalyticsMonitoringOverviewSchema>
export type MonitoringExport = z.infer<typeof AnalyticsMonitoringExportSchema>
export type SchoolDetail = z.infer<typeof AnalyticsSchoolDetailSchema>
export type StudentDetail = z.infer<typeof AnalyticsStudentDetailSchema>
export type TeacherDetail = z.infer<typeof AnalyticsTeacherDetailSchema>
export type TeacherReport = z.infer<typeof AnalyticsTeacherReportSchema>
export type ItemAnalysis = z.infer<typeof AnalyticsItemAnalysisSchema>

export type SchoolEngagementRow = MonitoringOverview['studentRows'][number]
export type TeacherEngagementRow = MonitoringOverview['teacherRows'][number]
export type WeeklyRow = MonitoringOverview['weekly'][number]
export type Signal = MonitoringOverview['signals']['best'][number]
export type StudentLite = TeacherReport['notLoggedIn'][number]
export type StudentAnswerRow = StudentDetail['answers']['rows'][number]
