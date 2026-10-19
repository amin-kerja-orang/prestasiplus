import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { nonBlank, SchoolAdminSchoolInfoSchema } from './common'
import { SchoolAdminUserDetailSchema, SchoolAdminUserListMetaSchema } from './users'

/**
 * Pupil management of the Admin Sekolah (S6, S9, S12): list, form options, detail, CSV export,
 * create (with the one-time credential), update, reset password. Routes are under
 * `/admin-sekolah/pelajar`. Pupils cannot be toggled active or inactive here.
 */

export const SchoolAdminPupilRowSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    initials: z.string().min(1).max(2).meta({ description: 'Up to two upper-case initials.' }),
    email: z.string(),
    phone: z.string().nullable(),
    gradeLabel: z.string().nullable().meta({ description: '"Tingkatan 1..5", "Darjah 1..6" or null.' }),
    classNames: z
      .array(z.string())
      .meta({ description: 'Names of the active enrolments of both class kinds, inactive classes left out.' }),
    isActive: z.boolean(),
    createdAt: TimestampSchema,
    canEdit: z.boolean().meta({ description: 'True only for an active pupil (equals isActive).' }),
  })
  .meta({ id: 'SchoolAdminPupilRow' })
export type SchoolAdminPupilRow = z.infer<typeof SchoolAdminPupilRowSchema>

/** Active first, then id descending; 25 per page. */
export const SchoolAdminPupilListResponseSchema = z
  .object({ data: z.array(SchoolAdminPupilRowSchema), meta: SchoolAdminUserListMetaSchema })
  .meta({ id: 'SchoolAdminPupilListResponse' })
export type SchoolAdminPupilListResponse = z.infer<typeof SchoolAdminPupilListResponseSchema>

/** `GET /admin-sekolah/pelajar/form-options`. Never carries the default password or its length. */
export const SchoolAdminPupilFormOptionsSchema = z
  .object({
    school: SchoolAdminSchoolInfoSchema,
    classes: z
      .array(z.object({ id: IdSchema, name: z.string() }))
      .meta({ description: 'Active classrooms of the school by name A to Z: the valid targets of `classId`.' }),
    passwordPlaceholder: z.literal('••••••••').meta({ description: 'Eight bullets.' }),
    passwordHint: z.literal('Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).'),
    passwordMinLength: z.literal(8),
  })
  .meta({ id: 'SchoolAdminPupilFormOptions' })
export type SchoolAdminPupilFormOptions = z.infer<typeof SchoolAdminPupilFormOptionsSchema>

/**
 * `POST /admin-sekolah/pelajar` body. The pupil is created ACTIVE with role student and the caller
 * school; `role`, `schoolId`, `isActive`, `grade`, `icNumber` are ignored. `password` empty or
 * absent = the configured default password. `classId` blank or absent = no class. Validation (422,
 * Laravel English text): `name` required, 3 to 255 ("The name field must be at least 3
 * characters."); `email` required, valid, at most 255, unique ("The email has already been
 * taken."); `password` 8 to 255 when given; `classId` an active classroom of the school ("The
 * selected class id is invalid.").
 */
export const SchoolAdminPupilCreateRequestSchema = z
  .object({
    name: nonBlank(255).min(3),
    email: z.email().max(255),
    password: z
      .union([z.literal(''), z.string().min(8).max(255)])
      .nullable()
      .optional()
      .meta({ writeOnly: true, description: 'Empty, null or absent = the default password; otherwise 8 to 255 characters.' }),
    classId: z.union([IdSchema, z.literal('')]).nullable().optional(),
  })
  .meta({ id: 'SchoolAdminPupilCreateRequest' })
export type SchoolAdminPupilCreateRequest = z.infer<typeof SchoolAdminPupilCreateRequestSchema>

/**
 * `201` result. `credential.password` (the typed or the default password) is returned ONLY here,
 * once, for the school admin to hand over; it is stored nowhere and must never be logged.
 */
export const SchoolAdminPupilCreatedResultSchema = z
  .object({
    data: SchoolAdminUserDetailSchema,
    credential: z.object({
      name: z.string(),
      school: z.string(),
      email: z.string(),
      password: z.string().min(1),
    }),
    status: z.string().min(1).meta({ description: 'Pelajar "{name}" berjaya dicipta.' }),
  })
  .meta({ id: 'SchoolAdminPupilCreatedResult' })
export type SchoolAdminPupilCreatedResult = z.infer<typeof SchoolAdminPupilCreatedResultSchema>
