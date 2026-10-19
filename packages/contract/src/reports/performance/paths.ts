import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  PERFORMANCE_ERROR_MESSAGES as MSG,
  PerformanceAnalyticsSchema,
  PerformanceClassAnalyticsQuerySchema,
  PerformanceClassAnalyticsSchema,
  PerformanceClassCardSchema,
  PerformanceClassDashboardSchema,
  PerformanceClassItemAnalysisSchema,
  PerformanceDifficultySchema,
  PerformanceGpsBandSchema,
  PerformanceGradeSchema,
  PerformanceHeadcountAutoSetupRequestSchema,
  PerformanceHeadcountCreateRequestSchema,
  PerformanceHeadcountDashboardSchema,
  PerformanceHeadcountDetailSchema,
  PerformanceHeadcountDropRequestSchema,
  PerformanceHeadcountFormOptionsSchema,
  PerformanceHeadcountListItemSchema,
  PerformanceHeadcountModeSchema,
  PerformanceHeadcountSortQuerySchema,
  PerformanceHeadcountStudentSchema,
  PerformanceHeadcountSummarySchema,
  PerformanceItemAnalysisQuerySchema,
  PerformanceLeaderboardQuerySchema,
  PerformanceLeaderboardSchema,
  PerformanceLevelCardSchema,
  PerformanceLevelCodeSchema,
  PerformanceLevelDetailSchema,
  PerformancePublicProfileSchema,
  PerformanceRankingQuerySchema,
  PerformanceRankingSchema,
  PerformanceRiskLevelSchema,
  PerformanceSchoolItemAnalysisSchema,
  PerformanceSchoolSchema,
  PerformanceStudentSchema,
  PerformanceTimelineCategorySchema,
  PerformanceTimelineCreateRequestSchema,
  PerformanceTimelinePostSchema,
  PerformanceTimelineSchema,
  PerformanceTrendSchema,
  PerformanceUserRefSchema,
} from './schema'

/** Components contributed by BE-19 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const PERFORMANCE_COMPONENT_SCHEMAS = {
  PerformanceGrade: PerformanceGradeSchema,
  PerformanceGpsBand: PerformanceGpsBandSchema,
  PerformanceLevelCode: PerformanceLevelCodeSchema,
  PerformanceDifficulty: PerformanceDifficultySchema,
  PerformanceRiskLevel: PerformanceRiskLevelSchema,
  PerformanceTrend: PerformanceTrendSchema,
  PerformanceUserRef: PerformanceUserRefSchema,
  PerformanceClassCard: PerformanceClassCardSchema,
  PerformanceSchool: PerformanceSchoolSchema,
  PerformanceLevelCard: PerformanceLevelCardSchema,
  PerformanceLevelDetail: PerformanceLevelDetailSchema,
  PerformanceClassDashboard: PerformanceClassDashboardSchema,
  PerformanceStudent: PerformanceStudentSchema,
  PerformanceAnalytics: PerformanceAnalyticsSchema,
  PerformanceClassAnalytics: PerformanceClassAnalyticsSchema,
  PerformanceClassAnalyticsQuery: PerformanceClassAnalyticsQuerySchema,
  PerformanceItemAnalysisQuery: PerformanceItemAnalysisQuerySchema,
  PerformanceSchoolItemAnalysis: PerformanceSchoolItemAnalysisSchema,
  PerformanceClassItemAnalysis: PerformanceClassItemAnalysisSchema,
  PerformanceTimelineCategory: PerformanceTimelineCategorySchema,
  PerformanceTimelinePost: PerformanceTimelinePostSchema,
  PerformanceTimeline: PerformanceTimelineSchema,
  PerformanceTimelineCreateRequest: PerformanceTimelineCreateRequestSchema,
  PerformancePublicProfile: PerformancePublicProfileSchema,
  PerformanceRankingQuery: PerformanceRankingQuerySchema,
  PerformanceRanking: PerformanceRankingSchema,
  PerformanceLeaderboardQuery: PerformanceLeaderboardQuerySchema,
  PerformanceLeaderboard: PerformanceLeaderboardSchema,
  PerformanceHeadcountMode: PerformanceHeadcountModeSchema,
  PerformanceHeadcountListItem: PerformanceHeadcountListItemSchema,
  PerformanceHeadcountDashboard: PerformanceHeadcountDashboardSchema,
  PerformanceHeadcountFormOptions: PerformanceHeadcountFormOptionsSchema,
  PerformanceHeadcountCreateRequest: PerformanceHeadcountCreateRequestSchema,
  PerformanceHeadcountAutoSetupRequest: PerformanceHeadcountAutoSetupRequestSchema,
  PerformanceHeadcountDropRequest: PerformanceHeadcountDropRequestSchema,
  PerformanceHeadcountSortQuery: PerformanceHeadcountSortQuerySchema,
  PerformanceHeadcountStudent: PerformanceHeadcountStudentSchema,
  PerformanceHeadcountSummary: PerformanceHeadcountSummarySchema,
  PerformanceHeadcountDetail: PerformanceHeadcountDetailSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const E401 = err(`UNAUTHORIZED: no valid session ("${MSG.unauthorized}").`)
const E403 = (what: string) => err(`FORBIDDEN "${MSG.forbidden}": ${what}`)
const E404 = (what: string) => err(`NOT_FOUND "${MSG.notFound}": ${what}`)
const E403CSRF = err(`FORBIDDEN "${MSG.forbidden}", or CSRF_INVALID on a missing/invalid X-CSRF-Token.`)

const idParam = (name: string) => z.object({ [name]: IdSchema })
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf.' }) })

/** The headcount staff guard: admin, teacher, school_admin; every other role gets 403. */
const STAFF = 'role not admin, teacher or school_admin'

/** Registers the 30 BE-19 (M08) endpoints. Success bodies are `{ data }`; errors are `{ error }`. */
export function registerPerformancePaths(registry: OpenAPIRegistry): void {
  const get = (
    path: string,
    summary: string,
    schema: z.ZodType,
    errors: Record<number, ReturnType<typeof err>>,
    request: { params?: z.ZodObject; query?: z.ZodObject } = {},
    description?: string,
    tag = 'performance',
  ) =>
    registry.registerPath({
      method: 'get',
      path,
      tags: [tag],
      summary,
      ...(description ? { description } : {}),
      request,
      responses: { 200: json(envelopeOf(schema), summary), 401: E401, ...errors },
    })

  // Student and class analytics
  get('/analytics/me', 'Own adaptive analytics (S7)', PerformanceAnalyticsSchema, {})
  get(
    '/analytics/classes',
    'Class analytics with risk filter (S8)',
    PerformanceClassAnalyticsSchema,
    { 403: E403('role not admin or teacher, or a class the viewer may not open') },
    { query: PerformanceClassAnalyticsQuerySchema },
    'Without classroomId a teacher gets the first own class; an unknown class id gives the empty payload (summary null, rows []).',
  )
  get(
    '/performance/students/{userId}',
    'Prestasi 360 of a student (S6)',
    PerformanceStudentSchema,
    { 403: E403('student not visible to the viewer'), 404: E404('unknown user id') },
    { params: idParam('userId') },
    'Admin any; teacher pupils of own classes; school_admin own school; student self; PPD/JPN officers in scope.',
  )

  // Performance by scope
  get(
    '/performance/school',
    'School (admin: platform) performance (S1)',
    PerformanceSchoolSchema,
    {},
    {},
    'Admin sees the platform; every other role the own school (a user without a school gets an empty school scope).',
  )
  get('/performance/levels', 'Level cards T4/T5 (S2)', z.array(PerformanceLevelCardSchema), {})
  get(
    '/performance/levels/{code}',
    'Level detail (S3)',
    PerformanceLevelDetailSchema,
    { 404: E404('code is not t4 or t5') },
    { params: z.object({ code: PerformanceLevelCodeSchema }) },
  )
  get(
    '/performance/classes',
    'Own classes (S4)',
    z.array(PerformanceClassCardSchema),
    {},
    {},
    'A teacher gets the own active classrooms; every other role gets [].',
  )
  get(
    '/performance/classes/{id}',
    'Class dashboard (S5)',
    PerformanceClassDashboardSchema,
    { 404: E404('unknown class, school class, or a class the viewer may not open') },
    { params: idParam('id') },
    'Admin any classroom; teacher own; school_admin classrooms of the own school.',
  )

  // Item analysis
  get(
    '/item-analysis/school',
    'Item analysis of the own school (S9)',
    PerformanceSchoolItemAnalysisSchema,
    { 403: E403('role has no access (parent, sponsor)'), 404: E404('viewer has no school, or no analysis') },
    { query: PerformanceItemAnalysisQuerySchema },
  )
  get(
    '/item-analysis/school/{schoolId}',
    'Item analysis of a given school (S9, variant byId)',
    PerformanceSchoolItemAnalysisSchema,
    { 403: E403('role has no access, or school outside the viewer scope'), 404: E404('no analysis') },
    { params: idParam('schoolId'), query: PerformanceItemAnalysisQuerySchema },
    'Admin any school; PPD district / JPN state officers schools in scope; other roles own school. An unknown id answers the empty payload (FR-M08-143), not 404.',
  )
  get(
    '/item-analysis/classes',
    'Class list for item analysis (S10)',
    z.array(PerformanceClassCardSchema),
    { 403: E403('role not admin or teacher') },
    {},
    'Admin every classroom (createdAt desc, then id); teacher own classrooms including inactive ones.',
  )
  get(
    '/item-analysis/classes/{id}',
    'Class item analysis (S11)',
    PerformanceClassItemAnalysisSchema,
    { 403: E403('unknown class OR a class the viewer may not open (live parity, FR-M08-08)') },
    { params: idParam('id') },
  )

  // Rankings and social
  get('/rankings', 'Ranking table (S19)', PerformanceRankingSchema, {}, { query: PerformanceRankingQuerySchema })
  get('/leaderboard', 'Coin leaderboard (S20)', PerformanceLeaderboardSchema, {}, { query: PerformanceLeaderboardQuerySchema })
  get('/timeline', 'Own timeline (S16)', PerformanceTimelineSchema, {})

  registry.registerPath({
    method: 'post',
    path: '/timeline',
    tags: ['performance'],
    summary: 'Create a timeline post with 1 to 5 photos (S17)',
    description: 'multipart/form-data. Photos are stored through file storage (BE-04); the response carries their URLs.',
    request: {
      headers: [csrf],
      body: { required: true, content: { 'multipart/form-data': { schema: PerformanceTimelineCreateRequestSchema } } },
    },
    responses: {
      201: json(envelopeOf(PerformanceTimelinePostSchema), 'Post created.'),
      401: E401,
      403: E403CSRF,
      422: err('VALIDATION_ERROR with fields (title, category, eventDate, story, photos); message = first field message plus "(and N more error(s))".'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/public/students/{id}',
    tags: ['performance'],
    summary: 'Public student profile (S18), no session required',
    description: 'Anonymous allowed (live parity). The mock does not check role or active state: see open question.',
    request: { params: idParam('id') },
    responses: { 200: json(envelopeOf(PerformancePublicProfileSchema), 'Public profile.'), 404: E404('unknown user id') },
  })
  registry.registerPath({
    method: 'get',
    path: '/weekly-report',
    tags: ['performance'],
    summary: 'Weekly report (S21): always 403 by design',
    description: 'Live parity (OQ-M08-01): every signed-in role gets 403, nobody gets a body.',
    responses: { 401: E401, 403: E403('always, for every role') },
  })

  // Headcount (TOV / RS)
  const hc = (path: string, summary: string, schema: z.ZodType, request: { params?: z.ZodObject; query?: z.ZodObject } = {}) =>
    get(
      path,
      summary,
      schema,
      {
        403: E403(`${STAFF}${request.params ? ', or a config/student outside the viewer scope' : ''}`),
        ...(request.params ? { 404: E404('unknown id (checked before 403)') } : {}),
      },
      request,
      undefined,
      'headcount',
    )
  hc('/headcounts', 'Own headcount configs (S12), newest first', z.array(PerformanceHeadcountListItemSchema))
  hc('/headcounts/dashboard', 'Headcount dashboard (S13)', PerformanceHeadcountDashboardSchema)
  hc('/headcounts/form-options', 'Create-form select options (S14)', PerformanceHeadcountFormOptionsSchema)
  hc('/headcounts/students/{userId}', 'Headcount sections of one student (S15)', PerformanceHeadcountStudentSchema, {
    params: idParam('userId'),
  })
  hc('/headcounts/{id}/summary', 'Class summary (S22)', PerformanceHeadcountSummarySchema, { params: idParam('id') })
  hc('/headcounts/{id}', 'Headcount table (S23)', PerformanceHeadcountDetailSchema, {
    params: idParam('id'),
    query: PerformanceHeadcountSortQuerySchema,
  })

  registry.registerPath({
    method: 'get',
    path: '/headcounts/{id}/export',
    tags: ['headcount'],
    summary: 'CSV download of the S23 table',
    description: 'Content-Disposition filename headcount-{id}.csv.',
    request: { params: idParam('id'), query: PerformanceHeadcountSortQuerySchema },
    responses: {
      200: { description: 'CSV file.', content: { 'text/csv': { schema: z.string() } } },
      401: E401,
      403: E403(STAFF),
      404: E404('unknown id'),
    },
  })

  const post = (
    method: 'post' | 'delete',
    path: string,
    summary: string,
    status: 200 | 201,
    data: z.ZodType,
    errors: Record<number, ReturnType<typeof err>>,
    request: { params?: z.ZodObject; body?: z.ZodType } = {},
  ) =>
    registry.registerPath({
      method,
      path,
      tags: ['headcount'],
      summary,
      request: {
        headers: [csrf],
        ...(request.params ? { params: request.params } : {}),
        ...(request.body
          ? { body: { required: true, content: { 'application/json': { schema: request.body } } } }
          : {}),
      },
      responses: { [status]: json(envelopeOf(data), summary), 401: E401, 403: E403CSRF, ...errors },
    })
  const own = { 404: E404('unknown id') }

  post('post', '/headcounts', 'Create a headcount config (S14)', 201, z.object({ id: IdSchema }), {
    409: err('CONFLICT: "Headcount Auto|Manual untuk kelas, subjek dan tahun ini sudah wujud."'),
    422: err('VALIDATION_ERROR with fields classroomId, subjectId, educationLevelId, academicYear, activeOtrs, mode.'),
  }, { body: PerformanceHeadcountCreateRequestSchema })
  post('post', '/headcounts/auto-setup', 'Create Auto configs for the own classes of the chosen levels (idempotent)', 200, z.object({ created: z.number().int().min(0) }), {
    422: err('VALIDATION_ERROR with field levels.'),
  }, { body: PerformanceHeadcountAutoSetupRequestSchema })
  post('post', '/headcounts/{id}/drop-students', 'Drop or restore students of a config', 200, z.object({ updated: z.number().int().min(0) }), {
    ...own,
    422: err('VALIDATION_ERROR with fields action, studentIds.'),
  }, { params: idParam('id'), body: PerformanceHeadcountDropRequestSchema })
  post('post', '/headcounts/{id}/reset', 'Reset all marks of a config', 200, z.object({ reset: z.literal(true) }), own, { params: idParam('id') })
  post('delete', '/headcounts/{id}', 'Delete a config', 200, z.object({ deleted: z.literal(true) }), own, { params: idParam('id') })
}
