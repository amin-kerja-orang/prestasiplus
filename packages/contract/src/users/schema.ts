import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { ROLE_CODES } from '../common/enums'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { ClassLevelSchema, SchoolSummarySchema, V, enumField, optionalText, requiredText } from '../schools/schema'

/**
 * M02 users wire contract (BE-05, contract-only). Source: the M02 mock handlers (`users-admin.ts`,
 * `users-shape.ts`, `users-rules.ts`, `imports.ts`, `admin-config.ts`), realigned per
 * `docs/architecture/v2-frontend.md` section 6: `roles[]`, `username`, nullable e-mail, two status
 * flags, masked IC only, string ids. The IC is accepted on input (`icNumber`) and every response
 * carries `icMasked` only. `legacy_*` columns never appear.
 */

export const USERS_PAGE_SIZE = 25
export const STUDENT_SEARCH_LIMIT = 15
export const STUDENT_SEARCH_MIN_CHARS = 2
export const PASSWORD_MIN = 6

/** Exact flash texts of the mock. */
export const USER_MESSAGES = {
  created: 'Pengguna berjaya didaftarkan.',
  updated: 'Pengguna berjaya dikemaskini.',
  deleted: 'Pengguna berjaya dipadam.',
  toggled: 'Status pengguna berjaya dikemaskini.',
  ownDelete: 'Anda tidak boleh memadam akaun sendiri.',
  noData: 'Tiada data untuk diimport.',
} as const
export const usersDeletedText = (n: number): string => `${String(n)} pengguna berjaya dipadam.`
export const usersImportedText = (r: { created: number; skipped: number; failed: number }): string =>
  `Import selesai: ${String(r.created)} pengguna didaftarkan, ${String(r.skipped)} dilangkau, ${String(r.failed)} gagal.`

/** Messages of failed import lines (`ImportResult.errors[].message`). */
export const IMPORT_ROW_MESSAGES = {
  noName: 'Nama diperlukan.',
  nameLong: 'Nama tidak boleh melebihi 255 aksara.',
  badEmail: 'Emel tidak sah.',
  phoneLong: 'Nombor telefon tidak boleh melebihi 14 aksara.',
  passwordShort: 'Kata laluan mesti sekurang-kurangnya 6 aksara.',
} as const

/** `xxxxxx-xx-xx` plus the last two digits. Anything else (a clear IC) fails this schema. */
export const IcMaskedSchema = z
  .string()
  .regex(/^xxxxxx-xx-xx\d{2}$/, 'IC must be the masked form xxxxxx-xx-xxNN')
  .meta({ id: 'IcMasked', description: 'Masked IC: "xxxxxx-xx-xx" + last 2 digits. The clear IC never leaves the API.', example: 'xxxxxx-xx-xx34' })

/**
 * Role list of an account (replaces the mock single `role`). Rules shared with the session:
 * unique, `student` never combines with another role, `admin` is single-role.
 */
const RoleInputSchema = enumField(ROLE_CODES, 'role')
export const UserRolesSchema = z
  .array(RoleInputSchema, { error: V.required('role') })
  .min(1, { error: V.required('role') })
  .superRefine((roles, ctx) => {
    if (new Set(roles).size !== roles.length) ctx.addIssue({ code: 'custom', message: 'roles must be unique' })
    if (roles.includes('student') && roles.length > 1)
      ctx.addIssue({ code: 'custom', message: 'student never combines with another role' })
    if (roles.includes('admin') && roles.length > 1)
      ctx.addIssue({ code: 'custom', message: 'admin is single-role' })
  })
  .meta({ id: 'UserRoles' })
export type UserRoles = z.infer<typeof UserRolesSchema>

export const StudentSearchItemSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    classLevel: ClassLevelSchema.nullable(),
    schoolName: z.string().nullable(),
  })
  .meta({ id: 'StudentSearchItem' })
export type StudentSearchItem = z.infer<typeof StudentSearchItemSchema>

export const AdminUserListItemSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    email: z.string().nullable(),
    username: z.string().nullable(),
    phone: z.string().nullable(),
    roles: UserRolesSchema,
    school: z.object({ id: IdSchema, name: z.string().min(1) }).nullable(),
    isActive: z.boolean(),
    isSuspended: z.boolean(),
    createdAt: TimestampSchema,
    avatarUrl: z.string().nullable(),
  })
  .meta({ id: 'AdminUserListItem' })
export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>

export const SUBSCRIPTION_PACKAGES = ['none', 'regular_monthly', 'personal'] as const

/** `AdminUserDetail`. `subscriptionPackage`/`hasPkskSubscription` are derived read-only (BE-25). */
export const AdminUserDetailSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    email: z.string().nullable(),
    username: z.string().nullable(),
    phone: z.string().nullable(),
    roles: UserRolesSchema,
    grade: z.number().int().min(1).max(11).nullable(),
    schoolId: IdSchema.nullable(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    lastLoginAt: TimestampSchema.nullable(),
    school: SchoolSummarySchema.nullable(),
    landingPath: z.string().startsWith('/').nullable(),
    icMasked: IcMaskedSchema.nullable(),
    isActive: z.boolean(),
    isSuspended: z.boolean(),
    subscriptionPackage: z.enum(SUBSCRIPTION_PACKAGES),
    hasPkskSubscription: z.boolean(),
    ppdState: z.string().nullable(),
    ppdDistrict: z.string().nullable(),
    linkedStudents: z.array(StudentSearchItemSchema).meta({ description: 'Children of a parent; [] for every other account.' }),
  })
  .meta({ id: 'AdminUserDetail' })
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>

/** `meta.roleCounts`: all users per role, ignoring the filters (the 7 stat cards). */
export const RoleCountsSchema = z
  .object({
    student: z.number().int().min(0),
    teacher: z.number().int().min(0),
    parent: z.number().int().min(0),
    sponsor: z.number().int().min(0),
    schoolAdmin: z.number().int().min(0),
    ppdOfficer: z.number().int().min(0),
    admin: z.number().int().min(0),
  })
  .meta({ id: 'RoleCounts' })

export const UserListMetaSchema = ListMetaSchema.extend({ roleCounts: RoleCountsSchema }).meta({ id: 'UserListMeta' })

/** GET /admin/users. Page size is fixed (25); newest first. Unknown role/school values match nothing. */
export const UserListQuerySchema = z
  .object({
    role: z.string().optional().meta({ description: 'A role code; any other non-empty value gives an empty page.' }),
    schoolId: z.string().optional().meta({ description: 'School id; an unknown id gives an empty page.' }),
    isActive: z.string().optional().meta({ description: '"1" or "0"; other values mean no filter.' }),
    search: z.string().optional().meta({ description: 'Case-insensitive substring of name or e-mail.' }),
    page: z.string().optional().meta({ description: 'Page number; a missing, non-numeric or < 1 value is treated as 1 (not an error).' }),
  })
  .meta({ id: 'UserListQuery' })

export const UserFiltersSchema = z
  .object({ schools: z.array(z.object({ id: IdSchema, name: z.string().min(1) })) })
  .meta({ id: 'UserFilters' })

/** An id in a body: an opaque string; blank means null. */
const bodyId = z.string().max(64).nullish()
/** Grade 1..11, sent as a number or a digit string (the mock accepts both). */
const gradeField = z
  .union([z.number().int(), z.string().regex(/^\d+$/)], { error: V.invalid('grade') })
  .refine((v) => Number(v) >= 1 && Number(v) <= 11, { error: V.invalid('grade') })
  .nullish()
/** Laravel-style boolean as the mock reads it (true, 1, "1", "true", "on", "yes" are true; anything else false). */
const looseBool = z.union([z.boolean(), z.number(), z.string()]).optional().meta({ description: 'Coerced like Laravel boolean(); never rejected.' })

const fields = {
  name: requiredText('name', 255),
  email: z
    .string({ error: V.string('email') })
    .trim()
    .email({ error: V.email('email') })
    .max(255, { error: V.max('email', 255) })
    .nullish()
    .meta({ description: 'Unique, case-insensitive (server: 422 "The email has already been taken.").' }),
  username: optionalText('username', 255).meta({ description: 'Unique per school (server).' }),
  phone: optionalText('phone', 14),
  grade: gradeField,
  icNumber: optionalText('ic number', 14).meta({ description: 'Accepted on input only; stored as hash + mask.' }),
  schoolId: bodyId.meta({ description: 'Must exist (server: 422 "The selected school id is invalid.").' }),
  linkedStudentIds: z
    .array(z.string().max(64), { error: V.invalid('linked student ids') })
    .optional()
    .meta({ description: 'Parents only; every id must be a student (server).' }),
  ppdState: optionalText('ppd state', 255).meta({ description: 'A JPN name (server: "The selected ppd state is invalid.").' }),
  ppdDistrict: optionalText('ppd district', 255).meta({ description: 'A PPD code of the chosen JPN (server: "The selected ppd district is invalid.").' }),
  isActive: looseBool,
}

/** POST /admin/users. Field rules that depend only on the body; existence/uniqueness checks are the server's. */
export const CreateUserRequestSchema = z
  .object({
    roles: UserRolesSchema,
    ...fields,
    password: z
      .string({ error: V.required('password') })
      .min(1, { error: V.required('password') })
      .min(PASSWORD_MIN, { error: V.min('password', PASSWORD_MIN) }),
    passwordConfirmation: z.string().nullish(),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.password !== v.passwordConfirmation) bad('password', V.confirmed('password'))
    if (!v.email && !v.username) bad('email', V.required('email'))
    if (v.roles.includes('student') && v.grade == null) bad('grade', V.requiredWhen('grade', 'role is student'))
    if (v.roles.includes('school_admin') && !v.schoolId) bad('schoolId', V.requiredWhen('school id', 'role is school_admin'))
    if (v.roles.includes('ppd_officer') && !v.ppdState) bad('ppdState', V.required('ppd state'))
    if (v.roles.includes('ppd_officer') && !v.ppdDistrict) bad('ppdDistrict', V.requiredWhen('ppd district', 'role is ppd_officer'))
  })
  .meta({ id: 'CreateUserRequest' })
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>

/**
 * PUT /admin/users/:id. A key that is absent leaves the stored value unchanged; `null` clears
 * `phone`, `schoolId`, `icNumber`. `roles` replaces the whole list. The subscription is derived
 * (BE-25) and is not accepted here.
 */
export const UpdateUserRequestSchema = z
  .object({
    roles: UserRolesSchema,
    ...fields,
    newPassword: z.string().min(PASSWORD_MIN, { error: V.min('new password', PASSWORD_MIN) }).nullish(),
    newPasswordConfirmation: z.string().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword && v.newPassword !== v.newPasswordConfirmation)
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: V.confirmed('new password') })
  })
  .meta({ id: 'UpdateUserRequest' })
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>

export const DeletedResultSchema = z.object({ deleted: z.number().int().min(0) }).meta({ id: 'DeletedResult' })
export const UserToggleResultSchema = z.object({ isActive: z.boolean() }).meta({ id: 'UserToggleResult' })

/** POST /admin/users/bulk-delete. Unknown ids are skipped; the acting account in the list is 422 `fields.ids`. */
export const BulkDeleteRequestSchema = z
  .object({
    ids: z
      .array(z.string().max(64), {
        error: (i) => (i.input === undefined || i.input === null ? V.required('ids') : 'The ids field must be an array of integers.'),
      })
      .min(1, { error: V.required('ids') }),
  })
  .meta({ id: 'BulkDeleteRequest' })

export const StudentSearchQuerySchema = z
  .object({ q: z.string().optional().meta({ description: `Fewer than ${String(STUDENT_SEARCH_MIN_CHARS)} characters returns [].` }) })
  .meta({ id: 'StudentSearchQuery' })

/** Roles the S4 bulk import can create (mock BULK_IMPORT_ROLES). */
export const BULK_IMPORT_ROLES = ['teacher', 'parent', 'school_admin', 'ppd_officer'] as const
export const BulkImportRoleSchema = z.enum(BULK_IMPORT_ROLES).meta({ id: 'BulkImportRole' })
export const IMPORT_MODES = ['csv', 'paste'] as const
export const ImportModeSchema = z.enum(IMPORT_MODES).meta({ id: 'ImportMode' })
export const SCHOOL_REQUIRED_IMPORT_ROLES = ['teacher', 'school_admin'] as const

const importBase = {
  role: enumField(BULK_IMPORT_ROLES, 'role'),
  defaultPassword: z
    .string()
    .refine((v) => v.trim() === '' || [...v.trim()].length >= PASSWORD_MIN, { error: V.min('default password', PASSWORD_MIN) })
    .nullish()
    .meta({ description: 'Blank or absent uses the configured bulk default.' }),
  importMode: enumField(IMPORT_MODES, 'import mode'),
  pasteContent: z.string().nullish().meta({ description: 'Used when importMode is paste.' }),
}
const importRules = (
  v: { role: string; schoolId?: string | null; importMode: string; csvFile?: string | null; pasteContent?: string | null },
  ctx: z.core.$RefinementCtx,
) => {
  if ((SCHOOL_REQUIRED_IMPORT_ROLES as readonly string[]).includes(v.role) && !v.schoolId)
    ctx.addIssue({ code: 'custom', path: ['schoolId'], message: V.required('school id') })
  // No data rows is a 422 on the field of the chosen mode; blank text certainly has none.
  const text = v.importMode === 'csv' ? v.csvFile : v.pasteContent
  if (typeof text !== 'string' || text.trim() === '')
    ctx.addIssue({ code: 'custom', path: [v.importMode === 'csv' ? 'csvFile' : 'pasteContent'], message: USER_MESSAGES.noData })
}

/**
 * POST /admin/users/bulk-import as JSON. `csvFile` is the file text; rows are
 * `name, email, phone?, password?`. No data rows is 422 "Tiada data untuk diimport." on
 * `fields.csvFile` or `fields.pasteContent`. The mock sets no file-size or row limit.
 */
export const BulkImportRequestSchema = z
  .object({ ...importBase, schoolId: bodyId, csvFile: z.string().nullish().meta({ description: 'CSV text, used when importMode is csv.' }) })
  .superRefine(importRules)
  .meta({ id: 'BulkImportRequest' })

/** The same request as multipart/form-data: every value is text and `csvFile` is the uploaded file. */
export const BulkImportMultipartSchema = z
  .object({ ...importBase, schoolId: bodyId, csvFile: z.string().meta({ format: 'binary' }).nullish() })
  .superRefine(importRules)
  .meta({ id: 'BulkImportMultipartRequest' })

export const ImportRowErrorSchema = z
  .object({ line: z.number().int().min(1).meta({ description: '1-based line of the file or paste.' }), message: z.string().min(1) })
  .meta({ id: 'ImportRowError' })

/** `errors` lists the failed lines only. */
export const ImportResultSchema = z
  .object({
    created: z.number().int().min(0),
    skipped: z.number().int().min(0),
    failed: z.number().int().min(0),
    errors: z.array(ImportRowErrorSchema),
  })
  .meta({ id: 'ImportResult' })
export type ImportResult = z.infer<typeof ImportResultSchema>

export const TeacherOptionSchema = z
  .object({ id: IdSchema, name: z.string().min(1), email: z.string().nullable() })
  .meta({ id: 'TeacherOption' })
export const TeacherClassroomOptionSchema = z
  .object({ id: IdSchema, name: z.string().min(1), classCode: z.string().min(1) })
  .meta({ id: 'TeacherClassroomOption' })

/** GET /admin/config/defaults: configured default passwords (OQ-API-B1-16: confirm exposing them). */
export const AdminDefaultsSchema = z
  .object({
    schoolAdminDefaultPassword: z.string(),
    bulkImportDefaultPassword: z.string(),
    compStudentDefaultPassword: z.string(),
  })
  .meta({ id: 'AdminDefaults' })
