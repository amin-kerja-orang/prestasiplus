import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { RoleCodeSchema } from '../common/enums'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { ClassLevelSchema, SchoolSummarySchema } from '../schools/schema'

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
export const UserRolesSchema = z
  .array(RoleCodeSchema)
  .min(1)
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
    page: z.coerce.number().int().min(1).default(1),
  })
  .meta({ id: 'UserListQuery' })

export const UserFiltersSchema = z
  .object({ schools: z.array(z.object({ id: IdSchema, name: z.string().min(1) })) })
  .meta({ id: 'UserFilters' })

const fields = {
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255).nullish(),
  username: z.string().trim().min(1).max(255).nullish(),
  phone: z.string().trim().max(14).nullish(),
  grade: z.number().int().min(1).max(11).nullish(),
  icNumber: z.string().trim().max(14).nullish().meta({ description: 'Accepted on input only; stored as hash + mask.' }),
  schoolId: IdSchema.nullish(),
  linkedStudentIds: z.array(IdSchema).optional(),
  ppdState: z.string().trim().min(1).nullish().meta({ description: 'A JPN name.' }),
  ppdDistrict: z.string().trim().min(1).nullish().meta({ description: 'A PPD code of the chosen JPN (the school district value).' }),
  isActive: z.boolean().optional(),
}

/** POST /admin/users. Field rules that depend only on the body; existence/uniqueness checks are the server's. */
export const CreateUserRequestSchema = z
  .object({
    roles: UserRolesSchema,
    ...fields,
    password: z.string().min(PASSWORD_MIN),
    passwordConfirmation: z.string(),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.password !== v.passwordConfirmation) bad('password', 'password confirmation does not match')
    if (!v.email && !v.username) bad('email', 'email or username is required')
    if (v.roles.includes('student') && v.grade == null) bad('grade', 'grade is required for student')
    if (v.roles.includes('school_admin') && !v.schoolId) bad('schoolId', 'schoolId is required for school_admin')
    if (v.roles.includes('ppd_officer') && !v.ppdState) bad('ppdState', 'ppdState is required for ppd_officer')
    if (v.roles.includes('ppd_officer') && !v.ppdDistrict) bad('ppdDistrict', 'ppdDistrict is required for ppd_officer')
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
    newPassword: z.string().min(PASSWORD_MIN).nullish(),
    newPasswordConfirmation: z.string().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword && v.newPassword !== v.newPasswordConfirmation)
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'password confirmation does not match' })
  })
  .meta({ id: 'UpdateUserRequest' })
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>

export const DeletedResultSchema = z.object({ deleted: z.number().int().min(0) }).meta({ id: 'DeletedResult' })
export const UserToggleResultSchema = z.object({ isActive: z.boolean() }).meta({ id: 'UserToggleResult' })

/** POST /admin/users/bulk-delete. Unknown ids are skipped; the acting account in the list is 422 `fields.ids`. */
export const BulkDeleteRequestSchema = z
  .object({ ids: z.array(IdSchema).min(1) })
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
  role: BulkImportRoleSchema,
  defaultPassword: z.string().min(PASSWORD_MIN).nullish().meta({ description: 'Blank uses the configured bulk default.' }),
  importMode: ImportModeSchema,
  pasteContent: z.string().nullish().meta({ description: 'Used when importMode is paste.' }),
}
const schoolRequired = (v: { role: string; schoolId?: string | null }, ctx: z.core.$RefinementCtx) => {
  if ((SCHOOL_REQUIRED_IMPORT_ROLES as readonly string[]).includes(v.role) && !v.schoolId)
    ctx.addIssue({ code: 'custom', path: ['schoolId'], message: 'schoolId is required for this role' })
}

/**
 * POST /admin/users/bulk-import as JSON. `csvFile` is the file text; rows are
 * `name, email, phone?, password?`. No data rows is 422 "Tiada data untuk diimport." on
 * `fields.csvFile` or `fields.pasteContent`. The mock sets no file-size or row limit.
 */
export const BulkImportRequestSchema = z
  .object({ ...importBase, schoolId: IdSchema.nullish(), csvFile: z.string().nullish().meta({ description: 'CSV text, used when importMode is csv.' }) })
  .superRefine(schoolRequired)
  .meta({ id: 'BulkImportRequest' })

/** The same request as multipart/form-data: every value is text and `csvFile` is the uploaded file. */
export const BulkImportMultipartSchema = z
  .object({ ...importBase, schoolId: z.string().nullish(), csvFile: z.string().meta({ format: 'binary' }).nullish() })
  .superRefine(schoolRequired)
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
