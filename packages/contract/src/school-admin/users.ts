import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { ListMetaSchema } from '../common/envelope'
import { TimestampSchema } from '../common/time'
import { count, nonBlank, password8, passwordConfirmation, SchoolAdminSchoolInfoSchema } from './common'

/**
 * Pieces shared by the teacher and pupil routes of the Admin Sekolah (S6 to S12): list query and
 * meta, the user detail, the update and password-reset bodies and the `{ data, status }` write
 * results. Teacher- and pupil-specific rows live in `teachers.ts` and `pupils.ts`.
 *
 * Every write needs `X-CSRF-Token` (403 `CSRF_INVALID` otherwise). Passwords are write-only: they
 * are never returned, except the one-time `credential` of the create-pupil response.
 */

/** Header row of the two user CSV exports (pupils and teachers). */
export const SCHOOL_ADMIN_USER_CSV_COLUMNS = [
  'id',
  'name',
  'email',
  'role',
  'sekolah',
  'kelas',
  'is_active',
  'created_at',
] as const

/** `phone` is at most 14 characters; null clears it on an update. */
const phone = z.string().max(14)

// ---------------------------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------------------------

/**
 * Query of `GET /admin-sekolah/pelajar` and `/guru`. Nothing is rejected: an unknown `is_active`
 * means all, an invalid `page` is 1, a page beyond the last gives the last page.
 */
export const SchoolAdminUserListQuerySchema = z
  .object({
    is_active: z.string().optional().meta({ description: '1 = active only, 0 = inactive only; anything else = all.' }),
    search: z.string().optional().meta({ description: 'Name or e-mail contains, case-insensitive.' }),
    page: z.string().optional().meta({ description: '25 rows per page.' }),
  })
  .meta({ id: 'SchoolAdminUserListQuery' })
export type SchoolAdminUserListQuery = z.infer<typeof SchoolAdminUserListQuerySchema>

/** Query of the two `export.csv` routes: the same filters as the list, no paging. */
export const SchoolAdminUserExportQuerySchema = z
  .object({
    is_active: z.string().optional().meta({ description: '1 = active only, 0 = inactive only; anything else = all.' }),
    search: z.string().optional().meta({ description: 'Name or e-mail contains, case-insensitive.' }),
  })
  .meta({ id: 'SchoolAdminUserExportQuery' })
export type SchoolAdminUserExportQuery = z.infer<typeof SchoolAdminUserExportQuerySchema>

/** List meta: `counts` are the school totals and ignore the filters. `pageSize` is always 25. */
export const SchoolAdminUserListMetaSchema = ListMetaSchema.extend({
  counts: z.object({ total: count, active: count, inactive: count }),
}).meta({ id: 'SchoolAdminUserListMeta' })
export type SchoolAdminUserListMeta = z.infer<typeof SchoolAdminUserListMetaSchema>

// ---------------------------------------------------------------------------------------------
// Detail and write bodies
// ---------------------------------------------------------------------------------------------

export const SchoolAdminUserRoleSchema = z
  .enum(['student', 'teacher'])
  .meta({ id: 'SchoolAdminUserRole', description: 'The only roles an Admin Sekolah manages.' })
export type SchoolAdminUserRole = z.infer<typeof SchoolAdminUserRoleSchema>

/** `GET /admin-sekolah/pelajar/{id}` and `/guru/{id}`, and the `data` of the writes. No IC number. */
export const SchoolAdminUserDetailSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    role: SchoolAdminUserRoleSchema,
    school: SchoolAdminSchoolInfoSchema,
  })
  .meta({ id: 'SchoolAdminUserDetail' })
export type SchoolAdminUserDetail = z.infer<typeof SchoolAdminUserDetailSchema>

/**
 * `PUT /admin-sekolah/pelajar/{id}` and `/guru/{id}` body. Other keys (role, school, status, grade,
 * IC number) are ignored, never an error (mass-assignment waiver of BE-NFR-05). `phone: null` clears it, an absent `phone` keeps it. A
 * `newPassword` (with its confirmation) replaces the hash and revokes ALL the target's sessions.
 * Validation (422, Laravel English text, field = key): `name` required, at most 255; `email`
 * required, valid, at most 255, unique among ALL other users of every school ("The email has already
 * been taken.", see the e-mail enumeration note on the create-pupil route: accepted trade-off);
 * `phone` at most 14; `newPassword` 8 to 255 characters and confirmed ("The new password field
 * confirmation does not match."). Mass assignment waiver: the server never binds `role`, `schoolId`,
 * `isActive`, `grade` or `icNumber` from the body (they are ignored, not a 422); the implementation
 * proves it with a test.
 */
export const SchoolAdminUserUpdateRequestSchema = z
  .object({
    name: nonBlank(255),
    email: z.email().max(255),
    phone: phone.nullable().optional(),
    newPassword: password8.optional(),
    newPasswordConfirmation: passwordConfirmation.optional(),
  })
  .meta({ id: 'SchoolAdminUserUpdateRequest' })
export type SchoolAdminUserUpdateRequest = z.infer<typeof SchoolAdminUserUpdateRequestSchema>

/**
 * `POST .../reset-password` body. 422 (field `newPassword`): "The new password field is required.",
 * "The new password field must be at least 8 characters.", "The new password field must not be
 * greater than 255 characters.", "The new password field confirmation does not match.".
 */
export const SchoolAdminResetPasswordRequestSchema = z
  .object({ newPassword: password8, newPasswordConfirmation: passwordConfirmation })
  .meta({ id: 'SchoolAdminResetPasswordRequest' })
export type SchoolAdminResetPasswordRequest = z.infer<typeof SchoolAdminResetPasswordRequestSchema>

/** Write result `{ data, status }` with the user (update: "Pengguna berjaya dikemaskini."; create teacher: "Pengguna berjaya didaftarkan."). */
export const SchoolAdminUserWriteResultSchema = z
  .object({ data: SchoolAdminUserDetailSchema, status: z.string().min(1) })
  .meta({ id: 'SchoolAdminUserWriteResult' })
export type SchoolAdminUserWriteResult = z.infer<typeof SchoolAdminUserWriteResultSchema>

/** `data: { reset: true }`, status "Pengguna berjaya dikemaskini.". The new password is never echoed. */
export const SchoolAdminResetResultSchema = z
  .object({ data: z.object({ reset: z.literal(true) }), status: z.string().min(1) })
  .meta({ id: 'SchoolAdminResetResult' })
export type SchoolAdminResetResult = z.infer<typeof SchoolAdminResetResultSchema>
