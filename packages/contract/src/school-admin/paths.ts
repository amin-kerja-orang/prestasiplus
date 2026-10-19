import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import {
  AmaranEffectivenessReportSchema,
  AmaranEffectivenessResultSchema,
  AmaranEffectivenessSchema,
  AmaranInterventionTypeSchema,
  AmaranKomboSchema,
  AmaranPupilRiskSchema,
  AmaranRiskStatusSchema,
  AmaranSchoolRiskQuerySchema,
  AmaranSchoolRiskSchema,
  AmaranScopeSchema,
  AmaranSubjectRiskSchema,
  AmaranSummaryQuerySchema,
  AmaranSummarySchema,
  AmaranSummarySchoolRowSchema,
  AmaranTallySchema,
  AMARAN_CSV_COLUMNS,
} from './amaran'
import { SchoolAdminSchoolInfoSchema, SchoolAdminSchoolRefSchema } from './common'
import {
  SchoolAdminPupilCreateRequestSchema,
  SchoolAdminPupilCreatedResultSchema,
  SchoolAdminPupilFormOptionsSchema,
  SchoolAdminPupilListResponseSchema,
  SchoolAdminPupilRowSchema,
} from './pupils'
import {
  SchoolAdminActivityPupilRowSchema,
  SchoolAdminActivityQuerySchema,
  SchoolAdminActivityReportSchema,
  SchoolAdminActivityTeacherRowSchema,
  SchoolAdminClassListMetaSchema,
  SchoolAdminClassListQuerySchema,
  SchoolAdminClassListResponseSchema,
  SchoolAdminClassRowSchema,
  SchoolAdminDashboardSchema,
  SchoolAdminDskpHeatmapSchema,
  SchoolAdminDskpStatusSchema,
  SchoolAdminHeatmapBidangSchema,
  SchoolAdminHeatmapQuerySchema,
  SchoolAdminHeatmapSpSchema,
  SchoolAdminMonthlyMonthRowSchema,
  SchoolAdminMonthlyQuerySchema,
  SchoolAdminMonthlyReportSchema,
  SchoolAdminMonthlySubjectRowSchema,
  SchoolAdminSubscriptionStatusSchema,
  SchoolAdminUsagePeriodSchema,
  SchoolAdminUsageQuerySchema,
  SchoolAdminUsageSchema,
} from './reports'
import {
  SchoolAdminTeacherCreateRequestSchema,
  SchoolAdminTeacherListResponseSchema,
  SchoolAdminTeacherRowSchema,
  SchoolAdminToggleActiveResultSchema,
} from './teachers'
import {
  SchoolAdminResetPasswordRequestSchema,
  SchoolAdminResetResultSchema,
  SchoolAdminUserDetailSchema,
  SchoolAdminUserExportQuerySchema,
  SchoolAdminUserListMetaSchema,
  SchoolAdminUserListQuerySchema,
  SchoolAdminUserRoleSchema,
  SchoolAdminUserUpdateRequestSchema,
  SchoolAdminUserWriteResultSchema,
  SCHOOL_ADMIN_USER_CSV_COLUMNS,
} from './users'

/**
 * Components contributed by BE-21 (appended to COMPONENT_SCHEMAS in openapi.ts). The key of each
 * entry is the schema `.meta({ id })`; ids are prefixed `SchoolAdmin` (M27) and `Amaran` (M18).
 */
export const SCHOOL_ADMIN_COMPONENT_SCHEMAS = {
  // shared
  SchoolAdminSchoolRef: SchoolAdminSchoolRefSchema,
  SchoolAdminSchoolInfo: SchoolAdminSchoolInfoSchema,
  // reports
  SchoolAdminSubscriptionStatus: SchoolAdminSubscriptionStatusSchema,
  SchoolAdminDashboard: SchoolAdminDashboardSchema,
  SchoolAdminUsagePeriod: SchoolAdminUsagePeriodSchema,
  SchoolAdminUsageQuery: SchoolAdminUsageQuerySchema,
  SchoolAdminUsage: SchoolAdminUsageSchema,
  SchoolAdminActivityQuery: SchoolAdminActivityQuerySchema,
  SchoolAdminActivityPupilRow: SchoolAdminActivityPupilRowSchema,
  SchoolAdminActivityTeacherRow: SchoolAdminActivityTeacherRowSchema,
  SchoolAdminActivityReport: SchoolAdminActivityReportSchema,
  SchoolAdminDskpStatus: SchoolAdminDskpStatusSchema,
  SchoolAdminHeatmapQuery: SchoolAdminHeatmapQuerySchema,
  SchoolAdminHeatmapSp: SchoolAdminHeatmapSpSchema,
  SchoolAdminHeatmapBidang: SchoolAdminHeatmapBidangSchema,
  SchoolAdminDskpHeatmap: SchoolAdminDskpHeatmapSchema,
  SchoolAdminMonthlyQuery: SchoolAdminMonthlyQuerySchema,
  SchoolAdminMonthlySubjectRow: SchoolAdminMonthlySubjectRowSchema,
  SchoolAdminMonthlyMonthRow: SchoolAdminMonthlyMonthRowSchema,
  SchoolAdminMonthlyReport: SchoolAdminMonthlyReportSchema,
  SchoolAdminClassListQuery: SchoolAdminClassListQuerySchema,
  SchoolAdminClassRow: SchoolAdminClassRowSchema,
  SchoolAdminClassListMeta: SchoolAdminClassListMetaSchema,
  SchoolAdminClassListResponse: SchoolAdminClassListResponseSchema,
  // users
  SchoolAdminUserListQuery: SchoolAdminUserListQuerySchema,
  SchoolAdminUserExportQuery: SchoolAdminUserExportQuerySchema,
  SchoolAdminUserListMeta: SchoolAdminUserListMetaSchema,
  SchoolAdminUserRole: SchoolAdminUserRoleSchema,
  SchoolAdminUserDetail: SchoolAdminUserDetailSchema,
  SchoolAdminUserUpdateRequest: SchoolAdminUserUpdateRequestSchema,
  SchoolAdminResetPasswordRequest: SchoolAdminResetPasswordRequestSchema,
  SchoolAdminUserWriteResult: SchoolAdminUserWriteResultSchema,
  SchoolAdminResetResult: SchoolAdminResetResultSchema,
  // teachers
  SchoolAdminTeacherRow: SchoolAdminTeacherRowSchema,
  SchoolAdminTeacherListResponse: SchoolAdminTeacherListResponseSchema,
  SchoolAdminTeacherCreateRequest: SchoolAdminTeacherCreateRequestSchema,
  SchoolAdminToggleActiveResult: SchoolAdminToggleActiveResultSchema,
  // pupils
  SchoolAdminPupilRow: SchoolAdminPupilRowSchema,
  SchoolAdminPupilListResponse: SchoolAdminPupilListResponseSchema,
  SchoolAdminPupilFormOptions: SchoolAdminPupilFormOptionsSchema,
  SchoolAdminPupilCreateRequest: SchoolAdminPupilCreateRequestSchema,
  SchoolAdminPupilCreatedResult: SchoolAdminPupilCreatedResultSchema,
  // M18 Amaran
  AmaranRiskStatus: AmaranRiskStatusSchema,
  AmaranScope: AmaranScopeSchema,
  AmaranInterventionType: AmaranInterventionTypeSchema,
  AmaranEffectiveness: AmaranEffectivenessSchema,
  AmaranTally: AmaranTallySchema,
  AmaranSubjectRisk: AmaranSubjectRiskSchema,
  AmaranSchoolRiskQuery: AmaranSchoolRiskQuerySchema,
  AmaranPupilRisk: AmaranPupilRiskSchema,
  AmaranSchoolRisk: AmaranSchoolRiskSchema,
  AmaranSummaryQuery: AmaranSummaryQuerySchema,
  AmaranKombo: AmaranKomboSchema,
  AmaranSummarySchoolRow: AmaranSummarySchoolRowSchema,
  AmaranSummary: AmaranSummarySchema,
  AmaranEffectivenessReport: AmaranEffectivenessReportSchema,
  AmaranEffectivenessResult: AmaranEffectivenessResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
const csv = (description: string, headers: Record<string, { description: string; schema: { type: 'string' } }>) => ({
  description,
  headers,
  content: { 'text/csv': { schema: z.string().meta({ type: 'string' }) } },
})

const IdParams = z.object({
  id: IdSchema.meta({ description: 'Digits only; a non-numeric segment does not match the route (404 "Not Found.").' }),
})
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
/** 403 of every M27 read: any role other than school_admin, or a school admin without a school. */
const FORBIDDEN_SA = err(
  'FORBIDDEN "This action is unauthorized." (role is not school_admin, or the school admin has no school; a missing school never means "all schools").',
)
const FORBIDDEN_SA_WRITE = err(
  'FORBIDDEN "This action is unauthorized." (role is not school_admin, or no school), or CSRF_INVALID (missing or wrong X-CSRF-Token).',
)
const NOT_FOUND_USER = err(
  'NOT_FOUND "Not Found." (unknown id, a user of another school, or a user of another role: indistinguishable). The owner message "Pengguna tidak ditemui." applies only if the account vanishes between the scope check and the write.',
)
const FORBIDDEN_INACTIVE = err(
  'FORBIDDEN "This action is unauthorized." (the account is inactive), or the role/CSRF refusals of the guard; "Anda tidak boleh mengurus akaun ini." for an account outside the managed roles; "Akaun ini tidak aktif." when it turns inactive during the write; or CSRF_INVALID.',
)
const FORBIDDEN_INACTIVE_READ = err(
  'FORBIDDEN "This action is unauthorized." (role/school guard, or the account is inactive).',
)

const FIELD_RULES =
  'VALIDATION_ERROR with fields (field -> Laravel English message, e.g. "The name field is required."); the top-level message is the first field message plus " (and N more error(s))" when several.'

const SCHOOL_ONLY =
  'Always confined to the caller school; no query or body value can change it (a schoolId sent by the client is ignored).'

const contentDisposition = {
  description: 'attachment; filename="..."; the exact file name is in the route description.',
  schema: { type: 'string' as const },
}

/**
 * Registers the 20 M27 school-admin routes and the 4 M18 Amaran routes of BE-21. Responses are
 * `{ data }` (reads), `{ data, status }` (M27 writes, `status` is the BM flash text), the list
 * envelope, or the documented exceptions (class list extras, CSV files). Failures are `{ error }`.
 * The mock impersonation routes (`POST /admin-sekolah/users/{id}/impersonate` and
 * `POST /admin-sekolah/impersonate/leave`) are NOT part of the contract (UD-2): Mod Pelajar is
 * `POST /session/mode`. Static segments (`export.csv`, `form-options`) win over `{id}`.
 */
export function registerSchoolAdminPaths(registry: OpenAPIRegistry): void {
  // -------------------------------------------------------------------------------------------
  // M27 school reports (6)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/dashboard',
    tags: ['school-admin'],
    summary: 'School dashboard (S0)',
    description: `School cards, the first 3 Perutusan posts, subscription state and performance (GPS, Amaran Awal tally, practice, levels, grade distribution). ${SCHOOL_ONLY}`,
    responses: { 200: json(envelopeOf(SchoolAdminDashboardSchema), 'The dashboard.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/usage',
    tags: ['school-admin'],
    summary: 'School usage statistics (S1)',
    description: `Window: today = 00:00 Malaysia time to now; 7days / 30days = the last N x 24 hours. An unknown period is 30days. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminUsageQuerySchema },
    responses: { 200: json(envelopeOf(SchoolAdminUsageSchema), 'Tiles and sessions per mode.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/laporan-aktiviti',
    tags: ['school-admin'],
    summary: 'Activity report (S3)',
    description: `The M17 statistics report in the school scope, window = 00:00 Malaysia time of (today - range + 1 days) to now. An unknown range is 30. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminActivityQuerySchema },
    responses: { 200: json(envelopeOf(SchoolAdminActivityReportSchema), 'The report.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/laporan-bulanan',
    tags: ['school-admin'],
    summary: 'Monthly report (S5)',
    description: `12-month series and subject strengths. A future or invalid bulan gives the current month; a month without data returns the empty shape (months [], total null, accuracy null, no strongest / weakest). ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminMonthlyQuerySchema },
    responses: { 200: json(envelopeOf(SchoolAdminMonthlyReportSchema), 'The monthly report.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/dskp-heatmap',
    tags: ['school-admin'],
    summary: 'DSKP heatmap of the school pupils (S2)',
    description: `Per SP, pooled over the school pupils (sum correct / sum answered). Unknown query values fall back to the defaults (first subject by name, T4). ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminHeatmapQuerySchema },
    responses: { 200: json(envelopeOf(SchoolAdminDskpHeatmapSchema), 'The heatmap.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/kelas',
    tags: ['school-admin'],
    summary: 'Class list of the school (S8)',
    description: `Classroom classes of the school, active and inactive, by name A to Z (Malay collation) then id; 25 per page. Body is {data, meta, tiles, levels}: tiles and levels are top-level extras next to data / meta. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminClassListQuerySchema },
    responses: { 200: json(SchoolAdminClassListResponseSchema, 'Classes with meta, tiles and levels.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  // -------------------------------------------------------------------------------------------
  // M27 teachers (7)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/guru',
    tags: ['school-admin'],
    summary: 'Teachers of the school (S7)',
    description: `Active first, then id descending; 25 per page; a page beyond the last gives the last page (this list clamps instead of returning an empty page). meta.counts ignore the filters. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminUserListQuerySchema },
    responses: { 200: json(SchoolAdminTeacherListResponseSchema, 'Teachers with meta.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/guru/export.csv',
    tags: ['school-admin'],
    summary: 'Teachers CSV export',
    description: `Same filters as the list, no paging; teachers ordered by id. File name users-guru-{yyyy-mm-dd}.csv. Body: UTF-8 BOM, LF line ends and a trailing newline; header ${SCHOOL_ADMIN_USER_CSV_COLUMNS.join(',')}; role = "guru", sekolah = the school name, kelas empty, is_active 1 / 0. Cells starting with = + - @ tab or CR are prefixed with an apostrophe; cells holding a comma, quote or line break are quoted (RFC 4180). No IC and no phone. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminUserExportQuerySchema },
    responses: {
      200: csv('The CSV file (text/csv; charset=utf-8).', { 'Content-Disposition': contentDisposition }),
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/guru/{id}',
    tags: ['school-admin'],
    summary: 'Teacher detail (S10)',
    description: 'Order of checks: role guard, then 404 (unknown / other school / not a teacher), then 403 for an inactive teacher.',
    request: { params: IdParams },
    responses: { 200: json(envelopeOf(SchoolAdminUserDetailSchema), 'The teacher.'), 401: UNAUTHORIZED, 403: FORBIDDEN_INACTIVE_READ, 404: NOT_FOUND_USER },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/guru',
    tags: ['school-admin'],
    summary: 'Create a teacher (S11)',
    description: 'Creates an active teacher of the caller school (createdBy = the caller). The password is hashed and never returned.',
    request: { headers: [csrf], body: body(SchoolAdminTeacherCreateRequestSchema) },
    responses: {
      201: json(SchoolAdminUserWriteResultSchema, 'Created; status "Pengguna berjaya didaftarkan.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA_WRITE,
      422: err(FIELD_RULES),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin-sekolah/guru/{id}',
    tags: ['school-admin'],
    summary: 'Update a teacher (S10)',
    description: 'Checks: guard, 404, 403 (inactive), 422. Role, school and status never change. A new password revokes all the teacher sessions.',
    request: { params: IdParams, headers: [csrf], body: body(SchoolAdminUserUpdateRequestSchema) },
    responses: {
      200: json(SchoolAdminUserWriteResultSchema, 'Updated; status "Pengguna berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_INACTIVE,
      404: NOT_FOUND_USER,
      422: err(FIELD_RULES),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/guru/{id}/toggle-active',
    tags: ['school-admin'],
    summary: 'Switch a teacher active / inactive',
    description: 'No body. Flips isActive in either direction, including an inactive teacher. Deactivating revokes all the teacher sessions. Writes an audit event with the actor. Pupils cannot be toggled (a pupil id is 404).',
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: json(SchoolAdminToggleActiveResultSchema, 'Toggled; data.isActive is the new state; status "Status pengguna berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA_WRITE,
      404: NOT_FOUND_USER,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/guru/{id}/reset-password',
    tags: ['school-admin'],
    summary: 'Reset a teacher password',
    description: 'The target must be an active teacher of the school. Replaces the hash at once and revokes the target sessions (not the caller). The new password is never echoed or logged.',
    request: { params: IdParams, headers: [csrf], body: body(SchoolAdminResetPasswordRequestSchema) },
    responses: {
      200: json(SchoolAdminResetResultSchema, 'Reset; status "Pengguna berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_INACTIVE,
      404: NOT_FOUND_USER,
      422: err(FIELD_RULES),
    },
  })

  // -------------------------------------------------------------------------------------------
  // M27 pupils (7)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/pelajar',
    tags: ['school-admin'],
    summary: 'Pupils of the school (S6)',
    description: `Active first, then id descending; 25 per page; a page beyond the last gives the last page. meta.counts ignore the filters. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminUserListQuerySchema },
    responses: { 200: json(SchoolAdminPupilListResponseSchema, 'Pupils with meta.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/pelajar/form-options',
    tags: ['school-admin'],
    summary: 'Create-pupil form data (S12)',
    description: 'Matches before the {id} route. Never carries the default password.',
    responses: { 200: json(envelopeOf(SchoolAdminPupilFormOptionsSchema), 'School, active classes and password hints.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/pelajar/export.csv',
    tags: ['school-admin'],
    summary: 'Pupils CSV export',
    description: `Matches before the {id} route. Same filters as the list, no paging; pupils ordered by id. File name users-pelajar-{yyyy-mm-dd}.csv. Body: UTF-8 BOM, LF line ends and a trailing newline; header ${SCHOOL_ADMIN_USER_CSV_COLUMNS.join(',')}; role = "pelajar", sekolah = the school name, kelas = the names of the active classes joined by ", ", is_active 1 / 0. Cells starting with = + - @ tab or CR are prefixed with an apostrophe; cells holding a comma, quote or line break are quoted (RFC 4180). No IC and no phone. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminUserExportQuerySchema },
    responses: {
      200: csv('The CSV file (text/csv; charset=utf-8).', { 'Content-Disposition': contentDisposition }),
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/pelajar/{id}',
    tags: ['school-admin'],
    summary: 'Pupil detail (S9)',
    description: 'Order of checks: role guard, then 404 (unknown / other school / not a pupil), then 403 for an inactive pupil. No IC number.',
    request: { params: IdParams },
    responses: { 200: json(envelopeOf(SchoolAdminUserDetailSchema), 'The pupil.'), 401: UNAUTHORIZED, 403: FORBIDDEN_INACTIVE_READ, 404: NOT_FOUND_USER },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/pelajar',
    tags: ['school-admin'],
    summary: 'Create a pupil (S12)',
    description: 'Creates an active pupil of the caller school (createdBy = the caller); with classId the pupil is enrolled with source school_admin. D55c: the response shows the password once, to the creating admin only (never logged, never stored in plain text, not retrievable again) and returns mustChangePassword true: the account is flagged so the first login forces a password change (BE-03).',
    request: { headers: [csrf], body: body(SchoolAdminPupilCreateRequestSchema) },
    responses: {
      201: json(SchoolAdminPupilCreatedResultSchema, 'Created, with the one-time credential and mustChangePassword true.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA_WRITE,
      422: err(FIELD_RULES),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin-sekolah/pelajar/{id}',
    tags: ['school-admin'],
    summary: 'Update a pupil (S9)',
    description: 'Checks: guard, 404, 403 (inactive), 422. Role, school, status and grade never change. A new password revokes all the pupil sessions.',
    request: { params: IdParams, headers: [csrf], body: body(SchoolAdminUserUpdateRequestSchema) },
    responses: {
      200: json(SchoolAdminUserWriteResultSchema, 'Updated; status "Pengguna berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_INACTIVE,
      404: NOT_FOUND_USER,
      422: err(FIELD_RULES),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/pelajar/{id}/reset-password',
    tags: ['school-admin'],
    summary: 'Reset a pupil password',
    description: 'The target must be an active pupil of the school. Replaces the hash at once and revokes the target sessions (not the caller). The new password is never echoed or logged.',
    request: { params: IdParams, headers: [csrf], body: body(SchoolAdminResetPasswordRequestSchema) },
    responses: {
      200: json(SchoolAdminResetResultSchema, 'Reset; status "Pengguna berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_INACTIVE,
      404: NOT_FOUND_USER,
      422: err(FIELD_RULES),
    },
  })

  // -------------------------------------------------------------------------------------------
  // M18 Amaran Awal (4)
  // -------------------------------------------------------------------------------------------

  const AMARAN_ACCESS =
    'Roles in B1: admin, school_admin, teacher (student, parent, sponsor and ppd_officer get 403). School access: admin any school; school_admin its own school; teacher its own school or a school of a class it owns.'

  registry.registerPath({
    method: 'get',
    path: '/amaran/schools/{id}',
    tags: ['amaran'],
    summary: 'School risk page (Amaran Awal)',
    description: `${AMARAN_ACCESS} Risk is computed at request time and never stored: per pupil A = 100 - mean practice accuracy, E = min(100, days since active x 100 / 30), M = (10 - mean mastery) x 10, score = 0.4A + 0.3E + 0.3M (1 decimal). An unknown school is 404 (checked before access); a school outside the caller scope is 403 (not 404, a deliberate deviation from the 404 convention).`,
    request: { params: IdParams, query: AmaranSchoolRiskQuerySchema },
    responses: {
      200: json(envelopeOf(AmaranSchoolRiskSchema), 'The school risk page.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role not allowed, or the school is outside the caller scope).'),
      404: err('NOT_FOUND "Not Found." (unknown school).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/amaran/summary',
    tags: ['amaran'],
    summary: 'Executive summary of a school, district or state',
    description: `${AMARAN_ACCESS} Without scope the default is the viewer own scope (school_admin and teacher: own school; admin: the preview district). The district and state scopes are admin only (403 for school_admin and teacher). Reserved fixture schools are excluded from district and state roll-ups. Check order: 422, then 404 (unknown school, or a district / state with no schools), then 403.`,
    request: { query: AmaranSummaryQuerySchema },
    responses: {
      200: json(envelopeOf(AmaranSummarySchema), 'The summary (generatedAt is epoch milliseconds).'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role not allowed, scope outside the caller reach, or no default scope).'),
      404: err('NOT_FOUND "Not Found." (unknown school, or a district / state with no schools).'),
      422: err(
        'VALIDATION_ERROR (English copy; the top-level message equals the field text): scope=school without an integer schoolId -> fields.schoolId "The school id is required."; scope=district without district and state -> fields.district "The district and state are required."; scope=state without a state -> fields.state "The state is required."; any other scope -> fields.scope "The scope must be school, district or state.".',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/amaran/effectiveness',
    tags: ['amaran'],
    summary: 'Intervention effectiveness of the caller school',
    description: `${AMARAN_ACCESS} The report is of the caller own school (a viewer without a school gets 403), computed from the intervention records at request time.`,
    responses: {
      200: json(envelopeOf(AmaranEffectivenessResultSchema), 'The school and its effectiveness report.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role not allowed, or the viewer has no school).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/amaran/export/school/{id}',
    tags: ['amaran'],
    summary: 'School risk list as CSV',
    description: `Roles: admin (any school) and school_admin (own school); a teacher gets 403. An unknown school is 404 (before access). File name amaran-sekolah-{id}-{yyyymmdd}.csv (date in Malaysia time). Headers: Content-Type text/csv; charset=utf-8, Cache-Control no-store. Body: UTF-8 BOM, CRLF line ends with a trailing CRLF; header ${AMARAN_CSV_COLUMNS.join(',')}; one line per pupil of the school (no tingkatan filter), score with one decimal, status label, then the three BM cell texts of the risk page. Cells starting with = + - @ tab or CR are prefixed with an apostrophe; quoting follows RFC 4180. No IC, e-mail or phone. Every accepted download writes an audit event (actor, school, file name) and never personal content.`,
    request: { params: IdParams },
    responses: {
      200: csv('The CSV file.', {
        'Content-Disposition': contentDisposition,
        'Cache-Control': { description: 'no-store', schema: { type: 'string' } },
      }),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role not allowed, a teacher, or the school is outside the caller scope).'),
      404: err('NOT_FOUND "Not Found." (unknown school).'),
    },
  })
}
