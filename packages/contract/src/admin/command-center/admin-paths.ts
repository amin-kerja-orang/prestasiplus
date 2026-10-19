import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { ErrorBodySchema } from '../../common/error'
import {
  CommandCenterBadgeRowSchema,
  CommandCenterClassRefSchema,
  CommandCenterClassResponseSchema,
  CommandCenterClassSchema,
  CommandCenterCorrectionSchema,
  CommandCenterDailyActivityResponseSchema,
  CommandCenterDailyActivitySchema,
  CommandCenterDailyFeedRowSchema,
  CommandCenterDailyPointSchema,
  CommandCenterDailyQuerySchema,
  CommandCenterDailyTopStudentSchema,
  CommandCenterEngagementBucketsSchema,
  CommandCenterFeedRowSchema,
  CommandCenterHeadcountDetailResponseSchema,
  CommandCenterHeadcountDetailSchema,
  CommandCenterHeadcountParamsSchema,
  CommandCenterHeadcountRowSchema,
  CommandCenterIdParamsSchema,
  CommandCenterKirkpatrickSchema,
  CommandCenterLiveDataResponseSchema,
  CommandCenterLiveDataSchema,
  CommandCenterLoginRowSchema,
  CommandCenterMoodCountsSchema,
  CommandCenterMoodDotSchema,
  CommandCenterMoodSchema,
  CommandCenterPackageChipSchema,
  CommandCenterPeriodSchema,
  CommandCenterPupilStatusSchema,
  CommandCenterRefSchema,
  CommandCenterSchoolActivitySchema,
  CommandCenterSchoolDrillResponseSchema,
  CommandCenterSchoolDrillSchema,
  CommandCenterSchoolResponseSchema,
  CommandCenterSchoolSchema,
  CommandCenterScopeSchema,
  CommandCenterSessionAnswerSchema,
  CommandCenterSessionDetailResponseSchema,
  CommandCenterSessionDetailSchema,
  CommandCenterSessionListResponseSchema,
  CommandCenterSessionListSchema,
  CommandCenterSessionParamsSchema,
  CommandCenterSessionRowSchema,
  CommandCenterStudentResponseSchema,
  CommandCenterStudentSchema,
  CommandCenterStudentSubjectQuerySchema,
  CommandCenterStudentWeekQuerySchema,
  CommandCenterSubjectBarSchema,
  CommandCenterSubjectRowSchema,
  CommandCenterTeacherParamsSchema,
  CommandCenterTeacherResponseSchema,
  CommandCenterTeacherSchema,
  CommandCenterTopSchoolSchema,
  CommandCenterTopStudentSchema,
  CommandCenterWeekSchema,
  ServerStatusResponseSchema,
  ServerStatusSchema,
} from './admin'

/**
 * Components contributed by the admin/school half of BE-22 (appended to COMPONENT_SCHEMAS in
 * openapi.ts). The key of each entry is the schema `.meta({ id })`; ids are prefixed `CommandCenter`
 * (M17) and `ServerStatus`. Query/param object schemas are inlined by the generator and are not listed;
 * the request schemas with an id are listed where they carry one.
 */
export const COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS = {
  CommandCenterMood: CommandCenterMoodSchema,
  CommandCenterMoodCounts: CommandCenterMoodCountsSchema,
  CommandCenterPeriod: CommandCenterPeriodSchema,
  CommandCenterRef: CommandCenterRefSchema,
  CommandCenterClassRef: CommandCenterClassRefSchema,
  CommandCenterScope: CommandCenterScopeSchema,
  CommandCenterTopSchool: CommandCenterTopSchoolSchema,
  CommandCenterTopStudent: CommandCenterTopStudentSchema,
  CommandCenterFeedRow: CommandCenterFeedRowSchema,
  CommandCenterKirkpatrick: CommandCenterKirkpatrickSchema,
  CommandCenterEngagementBuckets: CommandCenterEngagementBucketsSchema,
  CommandCenterCorrection: CommandCenterCorrectionSchema,
  CommandCenterDailyPoint: CommandCenterDailyPointSchema,
  CommandCenterLiveData: CommandCenterLiveDataSchema,
  CommandCenterLiveDataResponse: CommandCenterLiveDataResponseSchema,
  CommandCenterDailyQuery: CommandCenterDailyQuerySchema,
  CommandCenterPackageChip: CommandCenterPackageChipSchema,
  CommandCenterLoginRow: CommandCenterLoginRowSchema,
  CommandCenterBadgeRow: CommandCenterBadgeRowSchema,
  CommandCenterSchoolActivity: CommandCenterSchoolActivitySchema,
  CommandCenterDailyTopStudent: CommandCenterDailyTopStudentSchema,
  CommandCenterSubjectBar: CommandCenterSubjectBarSchema,
  CommandCenterDailyFeedRow: CommandCenterDailyFeedRowSchema,
  CommandCenterDailyActivity: CommandCenterDailyActivitySchema,
  CommandCenterDailyActivityResponse: CommandCenterDailyActivityResponseSchema,
  CommandCenterSchoolDrill: CommandCenterSchoolDrillSchema,
  CommandCenterSchoolDrillResponse: CommandCenterSchoolDrillResponseSchema,
  CommandCenterSchool: CommandCenterSchoolSchema,
  CommandCenterSchoolResponse: CommandCenterSchoolResponseSchema,
  CommandCenterTeacher: CommandCenterTeacherSchema,
  CommandCenterTeacherResponse: CommandCenterTeacherResponseSchema,
  CommandCenterPupilStatus: CommandCenterPupilStatusSchema,
  CommandCenterClass: CommandCenterClassSchema,
  CommandCenterClassResponse: CommandCenterClassResponseSchema,
  CommandCenterSubjectRow: CommandCenterSubjectRowSchema,
  CommandCenterWeek: CommandCenterWeekSchema,
  CommandCenterMoodDot: CommandCenterMoodDotSchema,
  CommandCenterHeadcountRow: CommandCenterHeadcountRowSchema,
  CommandCenterStudent: CommandCenterStudentSchema,
  CommandCenterStudentResponse: CommandCenterStudentResponseSchema,
  CommandCenterSessionRow: CommandCenterSessionRowSchema,
  CommandCenterSessionList: CommandCenterSessionListSchema,
  CommandCenterSessionListResponse: CommandCenterSessionListResponseSchema,
  CommandCenterSessionAnswer: CommandCenterSessionAnswerSchema,
  CommandCenterSessionDetail: CommandCenterSessionDetailSchema,
  CommandCenterSessionDetailResponse: CommandCenterSessionDetailResponseSchema,
  CommandCenterHeadcountDetail: CommandCenterHeadcountDetailSchema,
  CommandCenterHeadcountDetailResponse: CommandCenterHeadcountDetailResponseSchema,
  CommandCenterIdParams: CommandCenterIdParamsSchema,
  CommandCenterTeacherParams: CommandCenterTeacherParamsSchema,
  CommandCenterSessionParams: CommandCenterSessionParamsSchema,
  CommandCenterHeadcountParams: CommandCenterHeadcountParamsSchema,
  CommandCenterStudentWeekQuery: CommandCenterStudentWeekQuerySchema,
  CommandCenterStudentSubjectQuery: CommandCenterStudentSubjectQuerySchema,
  ServerStatus: ServerStatusSchema,
  ServerStatusResponse: ServerStatusResponseSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const FORBIDDEN_AS = err(
  'FORBIDDEN "This action is unauthorized." (role is not admin or school_admin, or a school_admin whose user has no school).',
)
const FORBIDDEN_ATS = err(
  'FORBIDDEN "This action is unauthorized." (role is not admin, teacher or school_admin, or a school_admin whose user has no school).',
)
const NOT_FOUND_SCOPE = err(
  'NOT_FOUND "Not Found." for an unknown id and for an id outside the viewer scope (never 403, so ids cannot be probed).',
)

const SCOPE_NOTE =
  'Scope (guard admin, teacher or school_admin): admin sees every id that exists; a teacher only the schools of own active classes, own page, own active classes, their active members and the headcount configs of those classes; a school_admin only the session school (never the request), its teachers, classes (class school, else owner school), pupils (active or not), their sessions and the headcount configs of those classes. Out of scope or unknown answers 404. GET only, so no CSRF header. Implementation excludes is_test accounts (card AC2, OQ-API-B3-1). Personal data: responses carry Cache-Control no-store; ETag / If-None-Match gives 304.'

/** Registers the 12 admin/school Command Center routes of BE-22. Bodies are `{ data }` or `{ error }`. */
export function registerCommandCenterAdminPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/admin/command-center/live-data',
    tags: ['command-center'],
    summary: 'Live board (Command Center, admin and school admin)',
    description: [
      'Roles admin and school_admin. Admin gets the platform view (students outside fixture schools 900001-900099); a school_admin gets every figure filtered to the session school (a client school id is ignored), topSchools empty, dailyTrend filled. Poll with ETag / If-None-Match; no websockets. Implementation excludes is_test accounts (card AC2, OQ-API-B3-1).',
      'engagement and correction are documented display constants on the platform view and zeros on the school view.',
    ].join('\n'),
    responses: {
      200: json(CommandCenterLiveDataResponseSchema, 'The live board.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_AS,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/daily-activity',
    tags: ['command-center'],
    summary: 'Daily activity board (Aktiviti Harian)',
    description:
      'Roles admin and school_admin (a school_admin is forced to the session school and `schools` is omitted). `period` is today, week or month; any other value answers with today figures and echoes the raw value in `period`. Implementation excludes is_test accounts (card AC2, OQ-API-B3-1).',
    request: { query: CommandCenterDailyQuerySchema },
    responses: {
      200: json(CommandCenterDailyActivityResponseSchema, 'The daily board for the period.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_AS,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/daily-activity/school/{id}',
    tags: ['command-center'],
    summary: 'Daily activity drill of one school',
    description:
      'Role admin only (a school_admin or teacher gets 403). Unknown school answers 404; same `period` rule as the board. Implementation excludes is_test accounts (card AC2, OQ-API-B3-1).',
    request: { params: CommandCenterIdParamsSchema, query: CommandCenterDailyQuerySchema },
    responses: {
      200: json(CommandCenterSchoolDrillResponseSchema, 'Teachers, pupils and logins of the school.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role is not admin).'),
      404: err('NOT_FOUND "Not Found." (unknown school).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/school/{id}',
    tags: ['command-center'],
    summary: 'School page (S4)',
    description: SCOPE_NOTE,
    request: { params: CommandCenterIdParamsSchema },
    responses: {
      200: json(CommandCenterSchoolResponseSchema, 'Cards and teachers of the school.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ATS,
      404: NOT_FOUND_SCOPE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/school/{sid}/teacher/{uid}',
    tags: ['command-center'],
    summary: 'Teacher page (S5)',
    description: `${SCOPE_NOTE} A teacher may open only the own page.`,
    request: { params: CommandCenterTeacherParamsSchema },
    responses: {
      200: json(CommandCenterTeacherResponseSchema, 'Classes of the teacher at the school.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ATS,
      404: NOT_FOUND_SCOPE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/classroom/{id}',
    tags: ['command-center'],
    summary: 'Class page (S6)',
    description: SCOPE_NOTE,
    request: { params: CommandCenterIdParamsSchema },
    responses: {
      200: json(CommandCenterClassResponseSchema, 'Pupils of the class.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ATS,
      404: NOT_FOUND_SCOPE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/headcount/{configId}',
    tags: ['command-center'],
    summary: 'Headcount detail (S7 modal)',
    description: `${SCOPE_NOTE} The class of the config must be in scope.`,
    request: { params: CommandCenterHeadcountParamsSchema },
    responses: {
      200: json(CommandCenterHeadcountDetailResponseSchema, 'Means, pass rate and non-dropped entries.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ATS,
      404: NOT_FOUND_SCOPE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/student/{id}',
    tags: ['command-center'],
    summary: 'Pupil page (S7)',
    description: `${SCOPE_NOTE} The id must be a student.`,
    request: { params: CommandCenterIdParamsSchema },
    responses: {
      200: json(CommandCenterStudentResponseSchema, 'Cards, subjects, 8 weeks, mood trend, headcount and insight.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ATS,
      404: NOT_FOUND_SCOPE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/student/{id}/subject',
    tags: ['command-center'],
    summary: 'Completed sessions of one subject of a pupil',
    description: `${SCOPE_NOTE} Newest first; code UMUM is free practice; an unknown code gives an empty list (200).`,
    request: { params: CommandCenterIdParamsSchema, query: CommandCenterStudentSubjectQuerySchema },
    responses: {
      200: json(CommandCenterSessionListResponseSchema, 'The session list.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ATS,
      404: NOT_FOUND_SCOPE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/student/{id}/week',
    tags: ['command-center'],
    summary: 'Completed sessions of a pupil in a date range',
    description: `${SCOPE_NOTE} Scope is checked first (404), then the range. Sessions finished in [start 00:00, end + 1 day 00:00) Malaysia time, oldest first. The all-sessions modal uses start 2020-01-01 and end 2030-12-31.`,
    request: { params: CommandCenterIdParamsSchema, query: CommandCenterStudentWeekQuerySchema },
    responses: {
      200: json(CommandCenterSessionListResponseSchema, 'The session list.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ATS,
      404: NOT_FOUND_SCOPE,
      422: err('VALIDATION_ERROR with fields.start "Julat tarikh tidak sah." (start or end missing, not a real YYYY-MM-DD date, or start after end); message is the same text.'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/command-center/session/{sessionId}',
    tags: ['command-center'],
    summary: 'Session detail (S7 modal)',
    description: `${SCOPE_NOTE} The pupil of the session must be in scope.`,
    request: { params: CommandCenterSessionParamsSchema },
    responses: {
      200: json(CommandCenterSessionDetailResponseSchema, 'Per-question answers of the session.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ATS,
      404: NOT_FOUND_SCOPE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/server-status',
    tags: ['command-center'],
    summary: 'Server health for the header pill',
    description:
      'Role admin only. Polled every 30 s. Host readings only (percentages, uptime, load, cores, GB figures); never connection strings, hostnames, paths or secrets. Thresholds (CPU 50/80, RAM 60/85, Disk 75/90) live in the frontend.',
    responses: {
      200: json(ServerStatusResponseSchema, 'The readings.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role is not admin).'),
    },
  })
}
