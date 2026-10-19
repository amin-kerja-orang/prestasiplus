import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { ROLE_CODES } from '../common/enums'
import { ErrorPayloadSchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { ClassLevelSchema, SchoolSummarySchema, V, enumField, mockOptionalText, mockRequiredText, type AccessRule } from '../schools/schema'

/**
 * M02 users wire contract (BE-05, contract-only). Source: the M02 mock handlers (`users-admin.ts`,
 * `users-shape.ts`, `users-rules.ts`, `imports.ts`, `admin-config.ts`), realigned per
 * `docs/architecture/v2-frontend.md` section 6: `roles[]`, `username`, nullable e-mail, two status
 * flags, masked IC only, string ids. The IC is accepted on input (`icNumber`) and every response
 * carries `icMasked` only. `legacy_*` columns never appear.
 */

export const USERS_PAGE_SIZE = 25
export const STUDENT_SEARCH_LIMIT = 15
/** Raised from the mock value 2 (security review BE-05): a 2-letter query enumerates minors. */
export const STUDENT_SEARCH_MIN_CHARS = 3
export const PASSWORD_MIN = 6
/** Upper bound for every password field (slow hash, DoS). Passwords are never echoed in `fields` or logged. */
export const PASSWORD_MAX = 128
/** Bulk-import caps (new in v2; the mock has none). */
export const IMPORT_MAX_CHARS = 1_048_576
export const IMPORT_MAX_ROWS = 1000

/**
 * Roles a caller may assign on POST/PUT /admin/users (D57e): only roles at or below its own.
 * The server enforces it (403 FORBIDDEN) and also keeps school_admin inside its own school
 * (a body `schoolId` of another school is 422 `fields.schoolId` "The selected school id is invalid.").
 */
export const ASSIGNABLE_ROLES = {
  admin: ['admin', 'school_admin', 'ppd_officer', 'teacher', 'student', 'parent', 'sponsor'],
  school_admin: ['student', 'teacher'],
} as const

const OWN = 'admin: all users; school_admin: own school only (an out-of-scope id is 404, never 403)'
export const USER_ACCESS = {
  'GET /admin/users': { roles: ['admin', 'school_admin'], scope: OWN + '; meta.roleCounts is scoped the same way' },
  'GET /admin/users/filters': { roles: ['admin', 'school_admin'], scope: 'admin: all schools with users; school_admin: own school only' },
  'GET /admin/users/{id}': { roles: ['admin', 'school_admin'], scope: OWN },
  'POST /admin/users': { roles: ['admin', 'school_admin'], scope: 'admin: any role; school_admin: student or teacher in own school (ASSIGNABLE_ROLES)' },
  'PUT /admin/users/{id}': { roles: ['admin', 'school_admin'], scope: 'admin: any role; school_admin: student or teacher in own school, target in own school (ASSIGNABLE_ROLES)' },
  'DELETE /admin/users/{id}': { roles: ['admin', 'school_admin'], scope: OWN },
  'POST /admin/users/bulk-delete': { roles: ['admin', 'school_admin'], scope: OWN + '; ids outside scope are skipped as unknown' },
  'POST /admin/users/{id}/toggle-active': { roles: ['admin', 'school_admin'], scope: OWN },
  'POST /admin/users/bulk-import': { roles: ['admin', 'school_admin'], scope: 'admin: any import role; school_admin: teacher only, into own school' },
  'GET /students/search': { roles: ['admin', 'school_admin', 'teacher'], scope: 'admin: all students; school_admin and teacher: own school only. student, parent, sponsor, ppd_officer: 403' },
  'GET /admin/teachers': { roles: ['admin', 'school_admin'], scope: 'admin: all teachers; school_admin: own school only' },
  'GET /admin/teachers/{id}/classrooms': { roles: ['admin', 'school_admin'], scope: 'admin: any teacher; school_admin: own school teachers only' },
} as const satisfies Record<string, AccessRule>

/** Exact flash texts of the mock. */
export const USER_MESSAGES = {
  created: 'Pengguna berjaya didaftarkan.',
  updated: 'Pengguna berjaya dikemaskini.',
  deleted: 'Pengguna berjaya dipadam.',
  toggled: 'Status pengguna berjaya dikemaskini.',
  ownDelete: 'Anda tidak boleh memadam akaun sendiri.',
  noData: 'Tiada data untuk diimport.',
  /** New in v2 (security review): the mock has no import caps. */
  importTooLarge: 'Data import melebihi had 1 MB.',
  importTooManyRows: 'Data import melebihi had 1000 baris.',
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
    mustChangePassword: z.boolean().meta({ description: 'True for an account with a server-generated initial password, or whose password an admin set (D55c, D59b). Cleared when the user changes it.' }),
    ppdState: z.string().nullable(),
    ppdDistrict: z.string().nullable(),
    linkedStudents: z.array(StudentSearchItemSchema).meta({ description: 'Children of a parent; [] for every other account.' }),
  })
  .meta({ id: 'AdminUserDetail' })
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>

/**
 * Response of POST /admin/users (D59b): the detail plus the server-generated initial password, shown
 * once to the creator. Never logged, never stored in clear and never retrievable again.
 */
export const CreatedUserSchema = AdminUserDetailSchema.extend({
  mustChangePassword: z.literal(true),
  generatedPassword: z.string().min(1).meta({ description: 'Random per account, shown once, never retrievable again. The response is no-store.' }),
}).meta({ id: 'CreatedUser' })
export type CreatedUser = z.infer<typeof CreatedUserSchema>

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
  name: mockRequiredText('name', 255),
  email: z
    .string({ error: V.string('email') })
    .trim()
    .email({ error: V.email('email') })
    .max(255, { error: V.max('email', 255) })
    .nullish()
    .meta({ description: 'Unique, case-insensitive (server: 422 "The email has already been taken.").' }),
  username: mockOptionalText('username', 255).meta({ description: 'Unique per school (server).' }),
  phone: mockOptionalText('phone', 14),
  grade: gradeField,
  icNumber: mockOptionalText('ic number', 14).meta({ description: 'Accepted on input only; stored as hash + mask.' }),
  schoolId: bodyId.meta({ description: 'Must exist (server: 422 "The selected school id is invalid.").' }),
  linkedStudentIds: z
    .array(z.string().max(64), { error: V.invalid('linked student ids') })
    .optional()
    .meta({ description: 'Parents only; every id must be a student (server).' }),
  ppdState: mockOptionalText('ppd state', 255).meta({ description: 'A JPN name (server: "The selected ppd state is invalid.").' }),
  ppdDistrict: mockOptionalText('ppd district', 255).meta({ description: 'A PPD code of the chosen JPN (server: "The selected ppd district is invalid.").' }),
  isActive: looseBool,
}

/**
 * POST /admin/users. D59: there is no password field. The server generates a random initial password
 * for the account and returns it once in the response (`generatedPassword`). Field rules that depend
 * only on the body; existence/uniqueness checks are the server's.
 */
export const CreateUserRequestSchema = z
  .strictObject({
    roles: UserRolesSchema,
    ...fields,
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
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
  .strictObject({
    roles: UserRolesSchema,
    ...fields,
    newPassword: z
      .string()
      .min(PASSWORD_MIN, { error: V.min('new password', PASSWORD_MIN) })
      .max(PASSWORD_MAX, { error: V.max('new password', PASSWORD_MAX) })
      .nullish(),
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
  .strictObject({
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
/**
 * D58: roles each caller may import. school_admin imports teachers only (no parents, no school_admin,
 * no ppd_officer). The schema cannot see the caller, so the server enforces it with a typed 403.
 */
export const BULK_IMPORT_ROLES_BY_CALLER = {
  admin: BULK_IMPORT_ROLES,
  school_admin: ['teacher'],
} as const

/** D58: message of the 409 when a change would leave no active admin. */
export const LAST_ADMIN_MESSAGE = 'Admin terakhir tidak boleh dinyahaktifkan atau dipadam.'

/** 409 CONFLICT of PUT/DELETE/bulk-delete/toggle on the last active admin (message pinned). */
export const LastAdminConflictSchema = z
  .object({
    error: ErrorPayloadSchema.extend({ code: z.literal('CONFLICT'), message: z.literal(LAST_ADMIN_MESSAGE) }),
  })
  .meta({ id: 'LastAdminConflict' })

/** D58: BM copy of the 403 when a school_admin imports any role but teacher. */
export const IMPORT_ROLE_FORBIDDEN_MESSAGE = 'Admin sekolah hanya boleh mengimport guru.'

/** 403 of bulk-import when a school_admin asks for a role other than teacher (server-enforced). */
export const ImportRoleForbiddenSchema = z
  .object({ error: ErrorPayloadSchema.extend({ code: z.literal('FORBIDDEN'), message: z.literal(IMPORT_ROLE_FORBIDDEN_MESSAGE) }) })
  .meta({ id: 'ImportRoleForbidden' })

export const BulkImportRoleSchema = z.enum(BULK_IMPORT_ROLES).meta({ id: 'BulkImportRole' })
export const IMPORT_MODES = ['csv', 'paste'] as const
export const ImportModeSchema = z.enum(IMPORT_MODES).meta({ id: 'ImportMode' })
export const SCHOOL_REQUIRED_IMPORT_ROLES = ['teacher', 'school_admin'] as const

const importBase = {
  role: enumField(BULK_IMPORT_ROLES, 'role'),
  importMode: enumField(IMPORT_MODES, 'import mode'),
  pasteContent: z.string().max(IMPORT_MAX_CHARS, { error: USER_MESSAGES.importTooLarge }).nullish().meta({ description: 'Used when importMode is paste. At most 1,048,576 characters and 1000 rows.' }),
}
const importRules = (
  v: { role: string; schoolId?: string | null; importMode: string; csvFile?: string | null; pasteContent?: string | null },
  ctx: z.core.$RefinementCtx,
) => {
  if ((SCHOOL_REQUIRED_IMPORT_ROLES as readonly string[]).includes(v.role) && !v.schoolId)
    ctx.addIssue({ code: 'custom', path: ['schoolId'], message: V.required('school id') })
  // No data rows is a 422 on the field of the chosen mode; blank text certainly has none.
  const text = v.importMode === 'csv' ? v.csvFile : v.pasteContent
  const at = [v.importMode === 'csv' ? 'csvFile' : 'pasteContent']
  if (typeof text !== 'string' || text.trim() === '') ctx.addIssue({ code: 'custom', path: at, message: USER_MESSAGES.noData })
  else if (text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').length > IMPORT_MAX_ROWS)
    ctx.addIssue({ code: 'custom', path: at, message: USER_MESSAGES.importTooManyRows })
}

/**
 * POST /admin/users/bulk-import as JSON. `csvFile` is the file text; rows are
 * `name, email, phone?` (D59: no password column; any extra column is ignored and the server generates a random password per account). No data rows is 422 "Tiada data untuk diimport." on
 * `fields.csvFile` or `fields.pasteContent`. The mock sets no limit; v2 caps the text at 1,048,576 characters and 1000 non-blank rows (a multipart file over 1 MB is 413).
 */
export const BulkImportRequestSchema = z
  .strictObject({ ...importBase, schoolId: bodyId, csvFile: z.string().max(IMPORT_MAX_CHARS, { error: USER_MESSAGES.importTooLarge }).nullish().meta({ description: 'CSV text, used when importMode is csv. At most 1,048,576 characters and 1000 rows.' }) })
  .superRefine(importRules)
  .meta({ id: 'BulkImportRequest' })

/** The same request as multipart/form-data: every value is text and `csvFile` is the uploaded file. */
export const BulkImportMultipartSchema = z
  .strictObject({ ...importBase, schoolId: bodyId, csvFile: z.string().meta({ format: 'binary' }).nullish() })
  .superRefine(importRules)
  .meta({ id: 'BulkImportMultipartRequest' })

export const ImportRowErrorSchema = z
  .object({ line: z.number().int().min(1).meta({ description: '1-based line of the file or paste.' }), message: z.string().min(1) })
  .meta({ id: 'ImportRowError' })

/** One created account of an import with its one-time generated password (D59b). */
export const ImportCredentialSchema = z
  .object({
    line: z.number().int().min(1).meta({ description: '1-based line of the file or paste.' }),
    email: z.string(),
    generatedPassword: z.string().min(1),
    mustChangePassword: z.literal(true),
  })
  .meta({ id: 'ImportCredential' })

/** `errors` lists the failed lines only. */
export const ImportResultSchema = z
  .object({
    created: z.number().int().min(0),
    skipped: z.number().int().min(0),
    failed: z.number().int().min(0),
    errors: z.array(ImportRowErrorSchema),
    credentials: z.array(ImportCredentialSchema).meta({ description: 'One entry per created account (D59b): its generated password, shown once. The response is no-store.' }),
  })
  .meta({ id: 'ImportResult' })
export type ImportResult = z.infer<typeof ImportResultSchema>

export const TeacherOptionSchema = z
  .object({ id: IdSchema, name: z.string().min(1), email: z.string().nullable() })
  .meta({ id: 'TeacherOption' })
export const TeacherClassroomOptionSchema = z
  .object({ id: IdSchema, name: z.string().min(1), classCode: z.string().min(1) })
  .meta({ id: 'TeacherClassroomOption' })
