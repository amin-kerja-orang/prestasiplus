import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  ANALYTICS_ERROR_MESSAGES as MSG,
  ANALYTICS_MESSAGES,
  AnalyticsClassOptionSchema,
  AnalyticsExportQuerySchema,
  AnalyticsFlagLevelSchema,
  AnalyticsItemAnalysisQuerySchema,
  AnalyticsItemAnalysisSchema,
  AnalyticsLevelSchema,
  AnalyticsMonitoringExportSchema,
  AnalyticsMonitoringFilterQuerySchema,
  AnalyticsMonitoringOverviewSchema,
  AnalyticsSchoolDetailSchema,
  AnalyticsSchoolEngagementRowSchema,
  AnalyticsSignalSchema,
  AnalyticsStudentAnswerRowSchema,
  AnalyticsStudentDetailSchema,
  AnalyticsStudentLiteSchema,
  AnalyticsStudentStatusSchema,
  AnalyticsTahapSchema,
  AnalyticsTeacherDetailSchema,
  AnalyticsTeacherEngagementRowSchema,
  AnalyticsTeacherReportQuerySchema,
  AnalyticsTeacherReportSchema,
  AnalyticsWeeklyRowSchema,
} from './schema'

/** Components contributed by BE-20 (M11), spread into COMPONENT_SCHEMAS in openapi.ts. */
export const ANALYTICS_COMPONENT_SCHEMAS = {
  AnalyticsTahap: AnalyticsTahapSchema,
  AnalyticsLevel: AnalyticsLevelSchema,
  AnalyticsStudentStatus: AnalyticsStudentStatusSchema,
  AnalyticsFlagLevel: AnalyticsFlagLevelSchema,
  AnalyticsMonitoringFilterQuery: AnalyticsMonitoringFilterQuerySchema,
  AnalyticsExportQuery: AnalyticsExportQuerySchema,
  AnalyticsTeacherReportQuery: AnalyticsTeacherReportQuerySchema,
  AnalyticsItemAnalysisQuery: AnalyticsItemAnalysisQuerySchema,
  AnalyticsStudentLite: AnalyticsStudentLiteSchema,
  AnalyticsClassOption: AnalyticsClassOptionSchema,
  AnalyticsTeacherReport: AnalyticsTeacherReportSchema,
  AnalyticsSchoolEngagementRow: AnalyticsSchoolEngagementRowSchema,
  AnalyticsTeacherEngagementRow: AnalyticsTeacherEngagementRowSchema,
  AnalyticsWeeklyRow: AnalyticsWeeklyRowSchema,
  AnalyticsSignal: AnalyticsSignalSchema,
  AnalyticsMonitoringOverview: AnalyticsMonitoringOverviewSchema,
  AnalyticsSchoolDetail: AnalyticsSchoolDetailSchema,
  AnalyticsStudentAnswerRow: AnalyticsStudentAnswerRowSchema,
  AnalyticsStudentDetail: AnalyticsStudentDetailSchema,
  AnalyticsTeacherDetail: AnalyticsTeacherDetailSchema,
  AnalyticsMonitoringExport: AnalyticsMonitoringExportSchema,
  AnalyticsItemAnalysis: AnalyticsItemAnalysisSchema,
} as const

const NO_STORE = {
  'Cache-Control': { description: 'no-store: the body holds personal data of pupils and teachers.', schema: { type: 'string' as const, example: 'no-store' } },
}
const json = (schema: z.ZodType, description: string, headers?: typeof NO_STORE) => ({
  description,
  ...(headers ? { headers } : {}),
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const E401 = err(`UNAUTHORIZED "${MSG.unauthorized}": no valid session.`)
const E403 = (what: string) => err(`FORBIDDEN "${MSG.forbidden}": ${what}`)
const E404 = (what: string) => err(`NOT_FOUND "${MSG.notFound}": ${what}`)

const MONITORING_ROLES = 'role not admin, teacher or school_admin'
const SCOPE =
  'Admin sees all schools; teacher and school_admin are forced to the own school from the session, never from the request (deviation from the mock, where a teacher sees all schools).'
const OUT_OF_SCOPE =
  'Unknown ids and, for teacher and school_admin, another school or a pupil/teacher of another school all answer 404 (existence is not revealed). A non-numeric id is also 404.'

/** Registers the 7 BE-20 (M11) endpoints. Success bodies are `{ data }`; errors are `{ error }`. */
export function registerAnalyticsPaths(registry: OpenAPIRegistry): void {
  const get = (
    path: string,
    summary: string,
    schema: z.ZodType,
    errors: Partial<Record<number, ReturnType<typeof err>>>,
    request: { params?: z.ZodObject; query?: z.ZodObject },
    description: string,
    personal = true,
  ) =>
    registry.registerPath({
      method: 'get',
      path,
      tags: ['analytics'],
      summary,
      description,
      request,
      responses: { 200: json(envelopeOf(schema), summary, personal ? NO_STORE : undefined), 401: E401, ...errors },
    })

  get(
    '/monitoring/overview',
    'Monitoring overview (S2)',
    AnalyticsMonitoringOverviewSchema,
    { 403: E403(MONITORING_ROLES) },
    { query: AnalyticsMonitoringFilterQuerySchema },
    `Engagement by school, teacher login rates, weekly tracking and signals. ${SCOPE} Invalid filter values are tolerated, never rejected.`,
    false,
  )
  get(
    '/monitoring/schools/{schoolId}',
    'School detail (S3)',
    AnalyticsSchoolDetailSchema,
    { 403: E403(MONITORING_ROLES), 404: E404(OUT_OF_SCOPE) },
    { params: z.object({ schoolId: IdSchema }) },
    `Pupils (T4 and T5) and teachers of one school. Admin: any school. Teacher and school_admin: the own school only. ${OUT_OF_SCOPE}`,
  )
  get(
    '/monitoring/schools/{schoolId}/students/{userId}',
    'Pupil detail (S4)',
    AnalyticsStudentDetailSchema,
    { 403: E403(MONITORING_ROLES), 404: E404(OUT_OF_SCOPE) },
    { params: z.object({ schoolId: IdSchema, userId: IdSchema }) },
    `Answers, topics and gaps of one pupil. Admin: the school segment is not validated against the pupil (live rule BR-M11-29). Teacher and school_admin: school and pupil must be own. A pupil with no answers returns the empty state, not 404. ${OUT_OF_SCOPE}`,
  )
  get(
    '/monitoring/schools/{schoolId}/teachers/{userId}',
    'Teacher detail (S5)',
    AnalyticsTeacherDetailSchema,
    { 403: E403(MONITORING_ROLES), 404: E404(`${OUT_OF_SCOPE} A user who is not a teacher is also 404.`) },
    { params: z.object({ schoolId: IdSchema, userId: IdSchema }) },
    `One teacher and the pupils of the school in the URL. Scope as the pupil detail. ${OUT_OF_SCOPE}`,
  )
  get(
    '/monitoring/export',
    'Monitoring export rows (S2 PDF and CSV links)',
    AnalyticsMonitoringExportSchema,
    {
      403: E403(MONITORING_ROLES),
      422: err(`VALIDATION_ERROR: fields.format "${ANALYTICS_MESSAGES.exportFormat}" (missing or other than pdf and csv).`),
    },
    { query: AnalyticsExportQuerySchema },
    `The student table behind the export, with the overview filters (tahap applied). The mock returns JSON rows and the client builds the file; a server-built file is an open question. Cells that start with =, +, - or @ must be neutralised by whoever builds a CSV or XLSX. ${SCOPE}`,
    false,
  )
  get(
    '/teacher/report',
    'Teacher report (S1)',
    AnalyticsTeacherReportSchema,
    { 403: E403('role not admin or teacher (school_admin included)') },
    { query: AnalyticsTeacherReportQuerySchema },
    'Population, activity, scores, trend and pupil lists of the own classes (teacher) or an empty population (admin). Invalid range or classroomId are tolerated: range falls back to 30, a not-own class is ignored.',
  )
  get(
    '/teacher/item-analysis',
    'Teacher item analysis (S6)',
    AnalyticsItemAnalysisSchema,
    { 403: E403('role not admin or teacher (school_admin included)') },
    { query: AnalyticsItemAnalysisQuerySchema },
    'Per-question difficulty band and discrimination over the own classes. Rows are [] for admin and for a not-own or unknown class (no error). Band: mudah p > 70, sederhana 40 to 70, sukar p < 40.',
  )
}
