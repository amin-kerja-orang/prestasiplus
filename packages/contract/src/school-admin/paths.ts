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
import { SchoolAdminInitialCredentialSchema, SchoolAdminSchoolInfoSchema, SchoolAdminSchoolRefSchema } from './common'
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
  SchoolAdminTeacherCreatedResultSchema,
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
  SchoolAdminInitialCredential: SchoolAdminInitialCredentialSchema,
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
  SchoolAdminTeacherCreatedResult: SchoolAdminTeacherCreatedResultSchema,
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
type HeaderDoc = Record<string, { description: string; schema: { type: 'string' | 'integer' } }>
const csv = (description: string, headers: HeaderDoc) => ({
  description,
  headers,
  content: { 'text/csv': { schema: z.string().meta({ type: 'string' }) } },
})

/** D57b: a response that carries a credential, a token or a bulk dump of minors' data must not be cached. */
const NO_STORE: HeaderDoc = {
  'Cache-Control': { description: 'no-store (nothing is kept by a proxy or the browser cache).', schema: { type: 'string' } },
  Pragma: { description: 'no-cache (HTTP/1.0 caches).', schema: { type: 'string' } },
}

/** D57a / BE-NFR-04: 429 of every write, both reset-password routes and the CSV exports. The numeric limits belong to the implementation card and the runbook. */
const RATE_LIMITED = {
  description:
    'RATE_LIMITED "Terlalu banyak percubaan. Sila cuba sebentar lagi." (proposed copy, same text as the auth routes) with error.retryAfter in seconds and the Retry-After header.',
  headers: {
    'Retry-After': { description: 'Seconds until a retry is allowed (equals error.retryAfter).', schema: { type: 'integer' } },
  } as HeaderDoc,
  content: { 'application/json': { schema: ErrorBodySchema } },
}

const IdempotencyKey = z.object({
  'Idempotency-Key': z
    .string()
    .min(1)
    .max(128)
    .optional()
    .meta({
      description:
        'Optional (BE-NFR-18, proposed). A client-generated key, one per create attempt. A replay with a key the server has already used answers 409 CONFLICT and never creates a second account; the credential is NOT re-served (recover with reset-password).',
    }),
})

const IdParams = z.object({
  id: IdSchema.meta({ description: 'Digits only; a non-numeric segment does not match the route (404 "Not Found.").' }),
})
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
/**
 * 403 of every M27 read: any role other than school_admin (Admin Pusat included: it has no school to
 * scope to), or a school admin without a school.
 */
const FORBIDDEN_SA = err(
  'FORBIDDEN "This action is unauthorized." (role is not school_admin, or the school admin has no school; a missing school never means "all schools"). The Admin (Pusat) role is EXCLUDED from /admin-sekolah/* and also gets 403.',
)
const FORBIDDEN_SA_WRITE = err(
  'FORBIDDEN "This action is unauthorized." (role is not school_admin, Admin Pusat included, or no school), or CSRF_INVALID (missing or wrong X-CSRF-Token).',
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
 *
 * Role: ONLY school_admin may call `/admin-sekolah/*`; Admin (Pusat) is excluded (403, no school to
 * scope to). The BE-21 card AC1 ("school_admin (and admin)") must be amended by the LEAD. Admin
 * keeps access to the `/amaran/*` routes, which carry an explicit school id.
 *
 * Every write, both reset-password routes and the export routes document 429 RATE_LIMITED
 * (D57a). Mass assignment: the server ignores unknown and protected body keys (waiver of
 * BE-NFR-05, mock fidelity). Passwords are 8 to 255 characters on every field.
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
    description: `Same filters as the list, no paging; teachers ordered by id. File name users-guru-{yyyy-mm-dd}.csv. Body: UTF-8 BOM, LF line ends and a trailing newline; header ${SCHOOL_ADMIN_USER_CSV_COLUMNS.join(',')}; role = "guru", sekolah = the school name, kelas empty, is_active 1 / 0. Cells starting with = + - @ tab or CR are prefixed with an apostrophe; cells holding a comma, quote or line break are quoted (RFC 4180). No IC and no phone. Sends Cache-Control: no-store. PDPA: the file is a bulk list of names and e-mails (of minors for pupils); every export writes an audit event (actor, school, file name, never the content) and is rate limited. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminUserExportQuerySchema },
    responses: {
      200: csv('The CSV file (text/csv; charset=utf-8).', { 'Content-Disposition': contentDisposition, ...NO_STORE }),
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA,
      429: RATE_LIMITED,
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
    description:
      'Creates an active teacher of the caller school (createdBy = the caller). D59b: there is no password in the request; the server ALWAYS generates a random initial password (CSPRNG, at least 12 characters), returns it once in credential.password and sets mustChangePassword true (the first login forces a change, BE-03). The password is never logged, never stored in plain text and never re-served; the 201 carries Cache-Control: no-store and Pragma: no-cache (D57b). LOST RESPONSE: recover with POST /admin-sekolah/guru/{id}/reset-password; the optional Idempotency-Key header prevents a duplicate account on a retry (a replayed key answers 409 CONFLICT, proposed). The e-mail is unique across all schools (accepted enumeration trade-off, see POST /admin-sekolah/pelajar). Unknown and protected body keys, a password key included, are ignored (mass-assignment waiver).',
    request: { headers: [csrf, IdempotencyKey], body: body(SchoolAdminTeacherCreateRequestSchema) },
    responses: {
      201: {
        ...json(SchoolAdminTeacherCreatedResultSchema, 'Created, with the one-time credential and mustChangePassword true; status "Pengguna berjaya didaftarkan.". Never cached.'),
        headers: NO_STORE,
      },
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA_WRITE,
      409: err('CONFLICT (proposed): the Idempotency-Key was already used. No second account is created and the credential is NOT re-served; use reset-password.'),
      422: err(FIELD_RULES),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin-sekolah/guru/{id}',
    tags: ['school-admin'],
    summary: 'Update a teacher (S10)',
    description: 'Checks: guard, 404, 403 (inactive), 422. Role, school and status never change (such body keys are ignored, mass-assignment waiver). A new password (8 to 255 characters) revokes all the teacher sessions. The e-mail is unique across all schools (accepted enumeration trade-off).',
    request: { params: IdParams, headers: [csrf], body: body(SchoolAdminUserUpdateRequestSchema) },
    responses: {
      200: json(SchoolAdminUserWriteResultSchema, 'Updated; status "Pengguna berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_INACTIVE,
      404: NOT_FOUND_USER,
      422: err(FIELD_RULES),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/guru/{id}/toggle-active',
    tags: ['school-admin'],
    summary: 'Switch a teacher active / inactive',
    description: 'No body. Flips isActive in either direction, including an inactive teacher. Deactivating revokes all the teacher sessions. Writes an audit event with the actor. Pupils cannot be toggled (a pupil id is 404). SELF-TOGGLE: an admin cannot deactivate their own account. The M27 mock has no explicit refusal: the caller is a school_admin, not a teacher, so a self-target already answers 404 NOT_FOUND "Not Found." like any non-teacher id. If the managed roles ever widen so that the caller can be a target, the refusal is 422 VALIDATION_ERROR with fields.id "Anda tidak boleh menyahaktifkan akaun sendiri." (proposed copy, modelled on the M02 own-account refusals) and nothing changes. Rate limited (429).',
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: json(SchoolAdminToggleActiveResultSchema, 'Toggled; data.isActive is the new state; status "Status pengguna berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA_WRITE,
      404: NOT_FOUND_USER,
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/guru/{id}/reset-password',
    tags: ['school-admin'],
    summary: 'Reset a teacher password',
    description: 'The target must be an active teacher of the school. Replaces the hash at once and revokes the target sessions (not the caller). The new password (8 to 255 characters, chosen by the admin) is required: there is no fallback to a shared default password (D59b). It is never echoed or logged. Rate limited (429).',
    request: { params: IdParams, headers: [csrf], body: body(SchoolAdminResetPasswordRequestSchema) },
    responses: {
      200: { ...json(SchoolAdminResetResultSchema, 'Reset; status "Pengguna berjaya dikemaskini.". Sent with Cache-Control: no-store and Pragma: no-cache (the request carries a password).'), headers: NO_STORE },
      401: UNAUTHORIZED,
      403: FORBIDDEN_INACTIVE,
      404: NOT_FOUND_USER,
      422: err(FIELD_RULES),
      429: RATE_LIMITED,
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
    description: `Active first, then id descending; 25 per page; a page beyond the last gives the last page. meta.counts ignore the filters. PDPA: rows are mostly minors; the list shows name, e-mail and phone because the screen does; no IC number. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminUserListQuerySchema },
    responses: { 200: json(SchoolAdminPupilListResponseSchema, 'Pupils with meta.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/pelajar/form-options',
    tags: ['school-admin'],
    summary: 'Create-pupil form data (S12)',
    description: 'Matches before the {id} route. Carries the school and the active classes only: there is no password field in the create form (D59b, the server generates the initial password).',
    responses: { 200: json(envelopeOf(SchoolAdminPupilFormOptionsSchema), 'School and active classes.'), 401: UNAUTHORIZED, 403: FORBIDDEN_SA },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/pelajar/export.csv',
    tags: ['school-admin'],
    summary: 'Pupils CSV export',
    description: `Matches before the {id} route. Same filters as the list, no paging; pupils ordered by id. File name users-pelajar-{yyyy-mm-dd}.csv. Body: UTF-8 BOM, LF line ends and a trailing newline; header ${SCHOOL_ADMIN_USER_CSV_COLUMNS.join(',')}; role = "pelajar", sekolah = the school name, kelas = the names of the active classes joined by ", ", is_active 1 / 0. Cells starting with = + - @ tab or CR are prefixed with an apostrophe; cells holding a comma, quote or line break are quoted (RFC 4180). No IC and no phone. Sends Cache-Control: no-store. PDPA: the file is a bulk list of names and e-mails (of minors for pupils); every export writes an audit event (actor, school, file name, never the content) and is rate limited. ${SCHOOL_ONLY}`,
    request: { query: SchoolAdminUserExportQuerySchema },
    responses: {
      200: csv('The CSV file (text/csv; charset=utf-8).', { 'Content-Disposition': contentDisposition, ...NO_STORE }),
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA,
      429: RATE_LIMITED,
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
    description:
      'Creates an active pupil of the caller school (createdBy = the caller); with classId the pupil is enrolled with source school_admin. D55c: the response shows the password once, to the creating admin only (never logged, never stored in plain text, not retrievable again) and returns mustChangePassword true: the account is flagged so the first login forces a password change (BE-03). The 201 carries Cache-Control: no-store (D57b). ' +
      'LOST RESPONSE: the credential is never re-served. If the 201 is lost, a retry answers 422 "The email has already been taken." and the password is gone; recover with POST /admin-sekolah/pelajar/{id}/reset-password (the admin sets a new password). The server must not store the plaintext to support a retry. The optional Idempotency-Key header prevents a duplicate account on a retry: a replayed key answers 409 CONFLICT and never re-serves the credential. ' +
      'ACCEPTED TRADE-OFF (e-mail enumeration): the e-mail is unique across all schools, so the 422 "The email has already been taken." reveals that an address is registered somewhere (a pupil of another school included). It cannot be hidden without dropping uniqueness; it is mitigated by the 429 rate limit and the audit trail. ' +
      'D59b: there is no password in the request and no shared default password: the server ALWAYS generates a random initial password (CSPRNG, at least 12 characters; exact policy in the implementation card) and returns it once in credential.password with mustChangePassword true. Mass assignment waiver: role, schoolId, isActive, grade, icNumber and a password key in the body are ignored, never bound (BE-NFR-05 exception, mock fidelity). 429 RATE_LIMITED guards bulk account creation.',
    request: { headers: [csrf, IdempotencyKey], body: body(SchoolAdminPupilCreateRequestSchema) },
    responses: {
      201: {
        ...json(SchoolAdminPupilCreatedResultSchema, 'Created, with the one-time credential and mustChangePassword true. Never cached.'),
        headers: NO_STORE,
      },
      401: UNAUTHORIZED,
      403: FORBIDDEN_SA_WRITE,
      409: err('CONFLICT (proposed): the Idempotency-Key was already used. No second account is created and the credential is NOT re-served; use reset-password.'),
      422: err(FIELD_RULES),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin-sekolah/pelajar/{id}',
    tags: ['school-admin'],
    summary: 'Update a pupil (S9)',
    description: 'Checks: guard, 404, 403 (inactive), 422. Role, school, status and grade never change (such body keys are ignored, mass-assignment waiver). A new password (8 to 255 characters) revokes all the pupil sessions. The e-mail is unique across all schools (accepted enumeration trade-off, see POST /admin-sekolah/pelajar).',
    request: { params: IdParams, headers: [csrf], body: body(SchoolAdminUserUpdateRequestSchema) },
    responses: {
      200: json(SchoolAdminUserWriteResultSchema, 'Updated; status "Pengguna berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_INACTIVE,
      404: NOT_FOUND_USER,
      422: err(FIELD_RULES),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/pelajar/{id}/reset-password',
    tags: ['school-admin'],
    summary: 'Reset a pupil password',
    description: 'The target must be an active pupil of the school. Replaces the hash at once and revokes the target sessions (not the caller). The new password (8 to 255 characters, chosen by the admin) is required: there is no fallback to a shared default password (D59b). It is never echoed or logged. This is the recovery path when the one-time credential of POST /admin-sekolah/pelajar was lost. Rate limited (429).',
    request: { params: IdParams, headers: [csrf], body: body(SchoolAdminResetPasswordRequestSchema) },
    responses: {
      200: { ...json(SchoolAdminResetResultSchema, 'Reset; status "Pengguna berjaya dikemaskini.". Sent with Cache-Control: no-store and Pragma: no-cache (the request carries a password).'), headers: NO_STORE },
      401: UNAUTHORIZED,
      403: FORBIDDEN_INACTIVE,
      404: NOT_FOUND_USER,
      422: err(FIELD_RULES),
      429: RATE_LIMITED,
    },
  })

  // -------------------------------------------------------------------------------------------
  // M18 Amaran Awal (4)
  // -------------------------------------------------------------------------------------------

  const AMARAN_ACCESS =
    'Roles in B1: admin, school_admin, teacher (student, parent, sponsor and ppd_officer get 403). School access: admin any school; school_admin its own school; teacher its own school or a school of a class it owns. A school outside the caller reach answers 404 NOT_FOUND "Not Found.", indistinguishable from an unknown school (BE-NFR-05, no school-id enumeration); 403 is only for a role that is not allowed. PDPA: the pupil lists show minors\' names, classes and risk scores; never cache them and show them only to staff who need them.'

  registry.registerPath({
    method: 'get',
    path: '/amaran/schools/{id}',
    tags: ['amaran'],
    summary: 'School risk page (Amaran Awal)',
    description: `${AMARAN_ACCESS} Risk is computed at request time and never stored: per pupil A = 100 - mean practice accuracy, E = min(100, days since active x 100 / 30), M = (10 - mean mastery) x 10, score = 0.4A + 0.3E + 0.3M (1 decimal). The role is checked first (403); then an unknown school and a school outside the caller scope are both 404 (the mock answered 403 for the latter; changed so the 403/404 difference cannot be used to list valid school ids).`,
    request: { params: IdParams, query: AmaranSchoolRiskQuerySchema },
    responses: {
      200: json(envelopeOf(AmaranSchoolRiskSchema), 'The school risk page.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role not allowed).'),
      404: err('NOT_FOUND "Not Found." (unknown school, or a school outside the caller scope: indistinguishable).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/amaran/summary',
    tags: ['amaran'],
    summary: 'Executive summary of a school, district or state',
    description: `${AMARAN_ACCESS} Without scope the default is the viewer own scope (school_admin and teacher: own school; admin: the preview district). The district and state scopes are admin only (403 for school_admin and teacher). Reserved fixture schools are excluded from district and state roll-ups. Check order: 422, then 403 (role not allowed, no default scope, or the district / state scope for a role other than admin), then 404 (unknown school, a school outside the caller reach: indistinguishable, or a district / state with no schools). The mock answered 403 for an out-of-reach school; changed to 404 (BE-NFR-05).`,
    request: { query: AmaranSummaryQuerySchema },
    responses: {
      200: json(envelopeOf(AmaranSummarySchema), 'The summary (generatedAt is epoch milliseconds).'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role not allowed, the district / state scope for a role other than admin, or no default scope).'),
      404: err('NOT_FOUND "Not Found." (unknown school, a school outside the caller reach, or a district / state with no schools).'),
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
    description: `Roles: admin (any school) and school_admin (own school); a teacher or any other role gets 403. Check order: the role check (403) comes BEFORE the 404; then an unknown school and a school outside the caller scope are both 404 (indistinguishable; the mock answered 403 for the latter). File name amaran-sekolah-{id}-{yyyymmdd}.csv (date in Malaysia time). Headers: Content-Type text/csv; charset=utf-8, Cache-Control no-store. Body: UTF-8 BOM, CRLF line ends with a trailing CRLF; header ${AMARAN_CSV_COLUMNS.join(',')}; one line per pupil of the school (no tingkatan filter), score with one decimal, status label, then the three BM cell texts of the risk page. Cells starting with = + - @ tab or CR are prefixed with an apostrophe; quoting follows RFC 4180. No IC, e-mail or phone. PDPA: the file lists minors\' names, classes and risk scores, the most sensitive derived data; it is never cached and rate limited (429, proposed on top of D57a because it is a bulk dump of minors). Every accepted download writes an audit event (actor, school, file name) and never personal content.`,
    request: { params: IdParams },
    responses: {
      200: csv('The CSV file.', {
        'Content-Disposition': contentDisposition,
        ...NO_STORE,
      }),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role not allowed, including a teacher; checked before the 404).'),
      404: err('NOT_FOUND "Not Found." (unknown school, or a school outside the caller scope: indistinguishable).'),
      429: RATE_LIMITED,
    },
  })
}
