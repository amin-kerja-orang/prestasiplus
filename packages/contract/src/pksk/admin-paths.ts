import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import {
  PkskAdminAccessDisplayStatusSchema,
  PkskAdminAccessGrantSchema,
  PkskAdminAccessItemSchema,
  PkskAdminAccessListQuerySchema,
  PkskAdminAccessListResponseSchema,
  PkskAdminAccessMutationResponseSchema,
  PkskAdminAccessStatsResponseSchema,
  PkskAdminAccessStatsSchema,
  PkskAdminAccessStatusSchema,
  PkskAdminBulkActionSchema,
  PkskAdminBulkRequestSchema,
  PkskAdminBulkResponseSchema,
  PkskAdminBulkResultSchema,
  PkskAdminOptionInputSchema,
  PkskAdminQuestionCreateSchema,
  PkskAdminQuestionDetailResponseSchema,
  PkskAdminQuestionDetailSchema,
  PkskAdminQuestionListItemSchema,
  PkskAdminQuestionListQuerySchema,
  PkskAdminQuestionListResponseSchema,
  PkskAdminQuestionMutationResponseSchema,
  PkskAdminQuestionOptionSchema,
  PkskAdminQuestionStatsResponseSchema,
  PkskAdminQuestionStatsSchema,
  PkskAdminQuestionUpdateSchema,
  PkskPackageListResponseSchema,
  PkskPackageSchema,
} from './admin'

/**
 * Components contributed by the admin half of BE-42 (the lead appends them to COMPONENT_SCHEMAS in
 * openapi.ts). The key of each entry is the schema `.meta({ id })`; ids are prefixed `PkskAdmin`,
 * except the package which is `PkskPackage`.
 */
export const PKSK_ADMIN_COMPONENT_SCHEMAS = {
  PkskAdminQuestionListQuery: PkskAdminQuestionListQuerySchema,
  PkskAdminQuestionListItem: PkskAdminQuestionListItemSchema,
  PkskAdminQuestionListResponse: PkskAdminQuestionListResponseSchema,
  PkskAdminQuestionStats: PkskAdminQuestionStatsSchema,
  PkskAdminQuestionOption: PkskAdminQuestionOptionSchema,
  PkskAdminQuestionDetail: PkskAdminQuestionDetailSchema,
  PkskAdminQuestionDetailResponse: PkskAdminQuestionDetailResponseSchema,
  PkskAdminQuestionMutationResponse: PkskAdminQuestionMutationResponseSchema,
  PkskAdminOptionInput: PkskAdminOptionInputSchema,
  PkskAdminQuestionCreate: PkskAdminQuestionCreateSchema,
  PkskAdminQuestionUpdate: PkskAdminQuestionUpdateSchema,
  PkskAdminBulkAction: PkskAdminBulkActionSchema,
  PkskAdminBulkRequest: PkskAdminBulkRequestSchema,
  PkskAdminBulkResult: PkskAdminBulkResultSchema,
  PkskAdminBulkResponse: PkskAdminBulkResponseSchema,
  PkskAdminAccessStatus: PkskAdminAccessStatusSchema,
  PkskAdminAccessDisplayStatus: PkskAdminAccessDisplayStatusSchema,
  PkskAdminAccessListQuery: PkskAdminAccessListQuerySchema,
  PkskAdminAccessItem: PkskAdminAccessItemSchema,
  PkskAdminAccessListResponse: PkskAdminAccessListResponseSchema,
  PkskAdminAccessStats: PkskAdminAccessStatsSchema,
  PkskAdminAccessGrant: PkskAdminAccessGrantSchema,
  PkskAdminAccessMutationResponse: PkskAdminAccessMutationResponseSchema,
  PkskPackage: PkskPackageSchema,
  PkskPackageListResponse: PkskPackageListResponseSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const IdParams = z.object({
  id: IdSchema.meta({ description: 'Digits only; a non-numeric segment does not match the route (404 "Not Found.").' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const FORBIDDEN = err('FORBIDDEN "This action is unauthorized." (the active role is not admin).')
const FORBIDDEN_WRITE = err(
  'FORBIDDEN "This action is unauthorized." (the active role is not admin), or CSRF_INVALID (missing or wrong X-CSRF-Token).',
)
const RATE_LIMITED = {
  description:
    'RATE_LIMITED, with retryAfter in the body and the Retry-After header (D57a). The numbers are set by the backend card.',
  headers: {
    'Retry-After': { description: 'Seconds until a retry is allowed.', schema: { type: 'integer' as const, minimum: 0 } },
  },
  content: { 'application/json': { schema: ErrorBodySchema } },
}
const NO_STORE = {
  'Cache-Control': { description: 'no-store: personal data of paying users and minors.', schema: { type: 'string' as const, example: 'no-store' } },
}
const ADMIN_ONLY = 'Admin only (401 without a session, 403 for any other role).'
const VALIDATION_FIELDS =
  'VALIDATION_ERROR with fields (name -> BM message); all failing fields are returned together, and the top-level message is the first field message plus " (and N more error(s))" when several fail.'

/**
 * Registers the 12 admin routes of BE-42: PKSK question list, stats, bulk, detail, create, update,
 * delete (M07-10 to M07-16), access list, stats, grant, revoke (M07-17 to M07-20) and the package
 * list (M07-21). Paths are relative to `/api`. The student routes are registered by the student half.
 */
export function registerPkskAdminPaths(registry: OpenAPIRegistry): void {
  // -------------------------------------------------------------------------------------------
  // Questions
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/pksk-questions',
    tags: ['pksk-admin'],
    summary: 'PKSK question list (S5)',
    description: `${ADMIN_ONLY} PKSK questions are tags on the question bank and never appear in the M04 lists. Filters are AND-combined and case-insensitive; an unknown filter value returns an empty page (not an error). Order: created_at descending, then id ascending. Fixed page size 20 (pageSize is not read).`,
    request: { query: PkskAdminQuestionListQuerySchema },
    responses: {
      200: json(PkskAdminQuestionListResponseSchema, 'A page of PKSK questions with the list meta.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/pksk-questions/stats',
    tags: ['pksk-admin'],
    summary: 'PKSK question counters (S5)',
    description: `${ADMIN_ONLY} Global counts over all PKSK questions, never filtered; t1 and t4 count every status.`,
    responses: {
      200: json(PkskAdminQuestionStatsResponseSchema, 'The counters.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/pksk-questions/bulk',
    tags: ['pksk-admin'],
    summary: 'Approve, reject or delete many PKSK questions',
    description: `${ADMIN_ONLY} Every id must be a PKSK question: any non-PKSK, unknown or non-numeric id answers 422 fields.ids and changes nothing. Duplicates count once. At most 100 ids (proposed cap). A bulk delete is audited (ids only).`,
    request: { headers: [csrf], body: body(PkskAdminBulkRequestSchema) },
    responses: {
      200: json(PkskAdminBulkResponseSchema, 'Done; status is "<n> soalan telah diluluskan." / "<n> soalan telah ditolak." / "<n> soalan telah dipadam.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err(`${VALIDATION_FIELDS} fields.action "Tindakan tidak sah."; fields.ids "Sila pilih sekurang-kurangnya satu soalan PKSK." (empty list, or any non-PKSK / unknown id).`),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/pksk-questions/{id}',
    tags: ['pksk-admin'],
    summary: 'PKSK question detail (S7)',
    description: `${ADMIN_ONLY} The id of a non-PKSK question answers 404, never its data.`,
    request: { params: IdParams },
    responses: {
      200: json(PkskAdminQuestionDetailResponseSchema, 'The question with its options.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      404: err('NOT_FOUND "Soalan PKSK tidak dijumpai." (unknown id or not a PKSK question).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/pksk-questions',
    tags: ['pksk-admin'],
    summary: 'Create a PKSK question',
    description: `${ADMIN_ONLY} Saved approved (BR-M07-03). Question text and explanation are plain text, stored sanitised and never rendered as HTML. Bahagian C stores no options. The domain must belong to the chosen Bahagian (service rule, fields.pkskDomainId).`,
    request: { headers: [csrf], body: body(PkskAdminQuestionCreateSchema) },
    responses: {
      201: json(PkskAdminQuestionMutationResponseSchema, 'Created; status is "Soalan PKSK berjaya ditambah.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err(`${VALIDATION_FIELDS} Keys: bahagian, pkskDomainId, pkskTargetLevel, questionText, difficultyLevel, options (one key for the count and for any option text).`),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/pksk-questions/{id}',
    tags: ['pksk-admin'],
    summary: 'Update a PKSK question',
    description: `${ADMIN_ONLY} A non-PKSK id answers 404 and is never changed. Any status may follow any other (BR-M07-02).`,
    request: { params: IdParams, headers: [csrf], body: body(PkskAdminQuestionUpdateSchema) },
    responses: {
      200: json(PkskAdminQuestionMutationResponseSchema, 'Updated; status is "Soalan PKSK berjaya dikemaskini.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: err('NOT_FOUND "Soalan PKSK tidak dijumpai.".'),
      422: err(`${VALIDATION_FIELDS} As create, plus fields.status "Sila pilih status.".`),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/pksk-questions/{id}',
    tags: ['pksk-admin'],
    summary: 'Delete a PKSK question (hard delete)',
    description: `${ADMIN_ONLY} Hard delete (BR-M07-02); historical practice answers survive. A non-PKSK id answers 404 and is never deleted.`,
    request: { params: IdParams, headers: [csrf] },
    responses: {
      204: { description: 'Deleted. No body.' },
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: err('NOT_FOUND "Soalan PKSK tidak dijumpai.".'),
      429: RATE_LIMITED,
    },
  })

  // -------------------------------------------------------------------------------------------
  // Access grants
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/pksk-access',
    tags: ['pksk-admin'],
    summary: 'PKSK access grants (S8)',
    description: `${ADMIN_ONLY} Lists names and e-mails of paying users, so the response carries Cache-Control: no-store. Order: granted_at descending, then id descending; fixed page size 20.`,
    request: { query: PkskAdminAccessListQuerySchema },
    responses: {
      200: { ...json(PkskAdminAccessListResponseSchema, 'A page of grants with the list meta.'), headers: NO_STORE },
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/pksk-access/stats',
    tags: ['pksk-admin'],
    summary: 'PKSK access counters (S8)',
    description: `${ADMIN_ONLY} Active rows only (not revoked, not expired); a Kombo package counts in both t1 and t4; the subscription flag and the admin role are not counted.`,
    responses: {
      200: json(PkskAdminAccessStatsResponseSchema, 'The counters.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/pksk-access',
    tags: ['pksk-admin'],
    summary: 'Grant PKSK access to a user',
    description: `${ADMIN_ONLY} grantedBy is the acting admin and grantedAt is now. A past expiry date is accepted and gives an already-expired row. Duplicate grants are allowed (BR-M07-14). The grant is audited (actor, user id, package id). Student routes see the change on the next request.`,
    request: { headers: [csrf], body: body(PkskAdminAccessGrantSchema) },
    responses: {
      201: { ...json(PkskAdminAccessMutationResponseSchema, 'Granted; status is "Akses PKSK berjaya diberi.".'), headers: NO_STORE },
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      422: err(`${VALIDATION_FIELDS} fields.userId "Pengguna tidak dijumpai." (missing, not an id or no such user); fields.packageId "Sila pilih pakej."; fields.expiresAt "Tarikh tamat tidak sah.".`),
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/pksk-access/{id}/revoke',
    tags: ['pksk-admin'],
    summary: 'Revoke an active PKSK grant',
    description: `${ADMIN_ONLY} The row stays listed with status revoked and revokedAt set. The revoke is audited (actor, access id, package id).`,
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: { ...json(PkskAdminAccessMutationResponseSchema, 'Revoked; status is "Akses PKSK telah ditarik balik.".'), headers: NO_STORE },
      401: UNAUTHORIZED,
      403: FORBIDDEN_WRITE,
      404: err('NOT_FOUND "Rekod akses tidak dijumpai.".'),
      409: err('CONFLICT "Akses ini tidak aktif dan tidak boleh ditarik balik." (already revoked or expired).'),
      429: RATE_LIMITED,
    },
  })

  // -------------------------------------------------------------------------------------------
  // Packages
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/pksk-packages',
    tags: ['pksk-admin'],
    summary: 'The 3 PKSK packages',
    description: `${ADMIN_ONLY} The mock guards this route with admin only. data is a bare array of the 3 reference packages ordered by id.`,
    responses: {
      200: json(PkskPackageListResponseSchema, 'The packages.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })
}
