import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { listEnvelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * Pending teachers of the school (BE-21 AC 13, LEAD addition of 2026-10-20). A teacher who
 * self-registered (BE-06) is created INACTIVE, with no school (`users.school_id` NULL) and the
 * school they asked for kept as `users.pending_school_id`. The Admin Sekolah of that school lists
 * the pending teachers and verifies one: in a single transaction the account becomes active, the
 * school is assigned (the school scope of a teacher IS `users.school_id`), the pending marker is
 * cleared, an audit event (ids only) is written and the teacher gets an inbox notice.
 *
 * Routes (the static `pending` segment wins over `{id}`): `GET /admin-sekolah/guru/pending` and
 * `POST /admin-sekolah/guru/{id}/verify`. Like the rest of `/admin-sekolah/*`, school_admin only
 * (Admin Pusat gets 403: it has no school to scope to).
 */

/** One waiting teacher. Only what the admin needs to recognise the person; no IC, no password data. */
export const SchoolAdminPendingTeacherRowSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    initials: z.string().min(1).max(2).meta({ description: 'Up to two upper-case initials.' }),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    requestedAt: TimestampSchema.meta({ description: 'When the teacher registered.' }),
  })
  .meta({ id: 'SchoolAdminPendingTeacherRow' })
export type SchoolAdminPendingTeacherRow = z.infer<typeof SchoolAdminPendingTeacherRowSchema>

/** Unpaged: one page that holds every pending teacher (oldest request first, then id). */
export const SchoolAdminPendingTeacherListResponseSchema = listEnvelopeOf(SchoolAdminPendingTeacherRowSchema).meta({
  id: 'SchoolAdminPendingTeacherListResponse',
})
export type SchoolAdminPendingTeacherListResponse = z.infer<typeof SchoolAdminPendingTeacherListResponseSchema>

/** `200` result of the verify action: the new state of the account and the BM flash text. */
export const SchoolAdminVerifyTeacherResultSchema = z
  .object({
    data: z.object({
      id: IdSchema,
      isActive: z.literal(true),
      schoolId: IdSchema.meta({ description: 'The school of the admin: the teacher now has this school scope.' }),
    }),
    status: z.string().min(1).meta({ description: 'Guru berjaya disahkan.' }),
  })
  .meta({ id: 'SchoolAdminVerifyTeacherResult' })
export type SchoolAdminVerifyTeacherResult = z.infer<typeof SchoolAdminVerifyTeacherResultSchema>

/** Flash copy (proposed BM, same register as `SCHOOL_ADMIN_FLASH`). */
export const SCHOOL_ADMIN_PENDING_TEACHER_FLASH = {
  verified: 'Guru berjaya disahkan.',
} as const

/** The inbox notice sent to the verified teacher (BE-06 notifications, category `system`). */
export const SCHOOL_ADMIN_TEACHER_VERIFIED_NOTICE = {
  type: 'teacher_verified',
  category: 'system',
  title: 'Akaun guru anda telah disahkan',
  body: 'Pentadbir sekolah telah mengesahkan akaun guru anda. Anda kini boleh log masuk dan menggunakan PrestasiPlus.',
} as const

export const SCHOOL_ADMIN_PENDING_COMPONENT_SCHEMAS = {
  SchoolAdminPendingTeacherRow: SchoolAdminPendingTeacherRowSchema,
  SchoolAdminPendingTeacherListResponse: SchoolAdminPendingTeacherListResponseSchema,
  SchoolAdminVerifyTeacherResult: SchoolAdminVerifyTeacherResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const IdParams = z.object({ id: IdSchema.meta({ description: 'Digits only.' }) })
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const NO_STORE_HEADERS = {
  'Cache-Control': { description: 'no-store (the body holds names and e-mails).', schema: { type: 'string' as const } },
}
const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const FORBIDDEN = err(
  'FORBIDDEN "This action is unauthorized." (role is not school_admin, Admin Pusat included, or the school admin has no school), or CSRF_INVALID on the POST.',
)
const RATE_LIMITED = err('RATE_LIMITED "Terlalu banyak percubaan. Sila cuba sebentar lagi." with error.retryAfter in seconds.')

export function registerSchoolAdminPendingTeacherPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/admin-sekolah/guru/pending',
    tags: ['school-admin-pending'],
    summary: 'Teachers waiting for verification',
    description:
      'The teachers who registered and asked for THIS school (users.pending_school_id equals the school of the caller), oldest request first. A pending teacher of another school is never listed. The school comes from the session; a schoolId in the query is ignored. Sent with Cache-Control: no-store. Rate limited (429).',
    responses: {
      200: { ...json(SchoolAdminPendingTeacherListResponseSchema, 'The waiting teachers (empty list when none).'), headers: NO_STORE_HEADERS },
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      429: RATE_LIMITED,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin-sekolah/guru/{id}/verify',
    tags: ['school-admin-pending'],
    summary: 'Verify a pending teacher',
    description:
      'No body. In ONE transaction: the account becomes active, school_id is set to the school of the caller, pending_school_id is cleared (the teacher role is ensured) and an audit event with ids only is written; after the commit the teacher gets an inbox notice. ANTI-ENUMERATION: an unknown id, a teacher pending for another school, a teacher who is not pending (including one already verified: a repeat call is 404, never 409), a non-teacher and a suspended account are indistinguishable: 404 "Not Found.". Two concurrent calls: exactly one succeeds. Rate limited (429).',
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: json(SchoolAdminVerifyTeacherResultSchema, 'Verified; status "Guru berjaya disahkan.".'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      404: err('NOT_FOUND "Not Found." (see the description).'),
      429: RATE_LIMITED,
    },
  })
}
