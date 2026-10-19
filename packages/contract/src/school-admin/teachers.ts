import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { count, nonBlank } from './common'
import { SchoolAdminUserListMetaSchema } from './users'

/**
 * Teacher management of the Admin Sekolah (S7, S10, S11): list, detail, CSV export, create, update,
 * toggle active, reset password. Routes are under `/admin-sekolah/guru`.
 */

export const SchoolAdminTeacherRowSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    initials: z.string().min(1).max(2).meta({ description: 'Up to two upper-case initials.' }),
    email: z.string(),
    phone: z.string().nullable(),
    classCount: count.meta({ description: 'Active classes owned by the teacher.' }),
    lastLoginAt: TimestampSchema.nullable(),
    isActive: z.boolean(),
    createdAt: TimestampSchema,
    canEdit: z.boolean().meta({ description: 'True only for an active teacher (equals isActive).' }),
  })
  .meta({ id: 'SchoolAdminTeacherRow' })
export type SchoolAdminTeacherRow = z.infer<typeof SchoolAdminTeacherRowSchema>

/** Active first, then id descending; 25 per page. */
export const SchoolAdminTeacherListResponseSchema = z
  .object({ data: z.array(SchoolAdminTeacherRowSchema), meta: SchoolAdminUserListMetaSchema })
  .meta({ id: 'SchoolAdminTeacherListResponse' })
export type SchoolAdminTeacherListResponse = z.infer<typeof SchoolAdminTeacherListResponseSchema>

/**
 * `POST /admin-sekolah/guru` body. The teacher is created ACTIVE, with role teacher and the caller
 * school; `role`, `schoolId` and any other key are ignored. Validation (422, Laravel English text):
 * `name` required, at most 255; `email` required, valid, at most 255, unique; `phone` at most 14;
 * `password` required, at least 6, confirmed ("The password field confirmation does not match.").
 */
export const SchoolAdminTeacherCreateRequestSchema = z
  .object({
    name: nonBlank(255),
    email: z.email().max(255),
    phone: z.string().max(14).nullable().optional(),
    password: z.string().min(6).meta({ writeOnly: true }),
    passwordConfirmation: z.string().meta({ writeOnly: true }),
  })
  .meta({ id: 'SchoolAdminTeacherCreateRequest' })
export type SchoolAdminTeacherCreateRequest = z.infer<typeof SchoolAdminTeacherCreateRequestSchema>

/** `data: { isActive }` is the NEW state; status "Status pengguna berjaya dikemaskini.". */
export const SchoolAdminToggleActiveResultSchema = z
  .object({ data: z.object({ isActive: z.boolean() }), status: z.string().min(1) })
  .meta({ id: 'SchoolAdminToggleActiveResult' })
export type SchoolAdminToggleActiveResult = z.infer<typeof SchoolAdminToggleActiveResultSchema>
