import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { ErrorBodySchema } from '../common/error'
import { accessLine, statusEnvelopeOf } from '../schools/schema'
import { csrfHeaders, jsonNoStore, rateLimitedResponse } from '../schools/http'
import {
  CreatedUserSchema,
  UpdatedUserSchema,
  ImportCredentialSchema,
  AdminUserDetailSchema,
  AdminUserListItemSchema,
  BulkDeleteRequestSchema,
  BulkImportMultipartSchema,
  BulkImportRequestSchema,
  BulkImportRoleSchema,
  CreateUserRequestSchema,
  DeletedResultSchema,
  IcMaskedSchema,
  ImportModeSchema,
  ImportResultSchema,
  ImportRowErrorSchema,
  ImportRoleForbiddenSchema,
  LastAdminConflictSchema,
  RoleCountsSchema,
  StudentSearchItemSchema,
  StudentSearchQuerySchema,
  TeacherClassroomOptionSchema,
  TeacherOptionSchema,
  UpdateUserRequestSchema,
  UserFiltersSchema,
  UserListMetaSchema,
  UserListQuerySchema,
  UserRolesSchema,
  UserToggleResultSchema,
  USER_ACCESS,
} from './schema'

/** Components contributed by BE-05 (users); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const USERS_COMPONENT_SCHEMAS = {
  IcMasked: IcMaskedSchema,
  UserRoles: UserRolesSchema,
  StudentSearchItem: StudentSearchItemSchema,
  AdminUserListItem: AdminUserListItemSchema,
  AdminUserDetail: AdminUserDetailSchema,
  RoleCounts: RoleCountsSchema,
  UserListMeta: UserListMetaSchema,
  UserListQuery: UserListQuerySchema,
  UserFilters: UserFiltersSchema,
  CreateUserRequest: CreateUserRequestSchema,
  UpdateUserRequest: UpdateUserRequestSchema,
  DeletedResult: DeletedResultSchema,
  UserToggleResult: UserToggleResultSchema,
  BulkDeleteRequest: BulkDeleteRequestSchema,
  StudentSearchQuery: StudentSearchQuerySchema,
  BulkImportRole: BulkImportRoleSchema,
  ImportMode: ImportModeSchema,
  BulkImportRequest: BulkImportRequestSchema,
  BulkImportMultipartRequest: BulkImportMultipartSchema,
  ImportRowError: ImportRowErrorSchema,
  ImportRoleForbidden: ImportRoleForbiddenSchema,
  LastAdminConflict: LastAdminConflictSchema,
  ImportResult: ImportResultSchema,
  TeacherOption: TeacherOptionSchema,
  TeacherClassroomOption: TeacherClassroomOptionSchema,
  CreatedUser: CreatedUserSchema,
  UpdatedUser: UpdatedUserSchema,
  ImportCredential: ImportCredentialSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const access = (key: keyof typeof USER_ACCESS) => accessLine(USER_ACCESS, key)
const idParam = z.object({ id: IdSchema })

/**
 * Registers the BE-05 user endpoints. `POST /admin/users/{id}/impersonate` is intentionally absent
 * (UD-2); Mod Pelajar is `POST /session/mode`. Subscriptions, packages and comp students are BE-25.
 */
export function registerUsersPaths(registry: OpenAPIRegistry): void {
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const forbidden = err('FORBIDDEN (role not allowed for this operation or role not assignable by the caller, see Access) or CSRF_INVALID on mutations.')
  const conflict = json(LastAdminConflictSchema, 'CONFLICT: would remove, demote or deactivate the last active admin or the caller own admin role (D58: message "Admin terakhir tidak boleh dinyahaktifkan atau dipadam.").')
  const limited = rateLimitedResponse
  const csrf = [csrfHeaders]
  const notFound = err('NOT_FOUND (also for an id outside the caller scope, so ids cannot be probed).')
  const invalid = err('VALIDATION_ERROR with `fields` (field name to BM message).')
  const tags = ['users']
  const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

  registry.registerPath({
    method: 'get',
    path: '/admin/users',
    tags,
    summary: 'List users (25 per page, newest first)',
    description: `${access('GET /admin/users')} Filters combine with AND. For a school_admin the list hides every row outside its school and every row whose roles are not all student, teacher or parent (other school_admins and higher roles never appear). \`meta.roleCounts\` counts users per role and ignores the filters (but not the caller scope). Responses carry the masked IC only and are no-store.`,
    request: { query: UserListQuerySchema },
    responses: {
      200: jsonNoStore(z.object({ data: z.array(AdminUserListItemSchema), meta: UserListMetaSchema }), 'A page of users.'),
      401: unauthorized,
      403: forbidden,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/users/filters',
    tags,
    summary: 'Schools that have at least one user (filter options), by name',
    description: access('GET /admin/users/filters'),
    responses: { 200: json(envelopeOf(UserFiltersSchema), 'Filter options.'), 401: unauthorized, 403: forbidden, 429: limited },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/users/{id}',
    tags,
    summary: 'User detail',
    description: `${access('GET /admin/users/{id}')} Personal data: no-store. The server audits reads (ids only). For a school_admin, \`linkedStudents\` lists only children in its own school and \`school\` is its own school; a target of a higher or equal role is 404.`,
    request: { params: idParam },
    responses: { 200: jsonNoStore(envelopeOf(AdminUserDetailSchema), 'The user.'), 401: unauthorized, 403: forbidden, 404: notFound, 429: limited },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users',
    tags,
    summary: 'Create a user',
    description: `${access('POST /admin/users')} status: "Pengguna berjaya didaftarkan.". D59b: the request has no password; the server generates a random initial password for the account and returns it once as \`generatedPassword\` (no-store, never logged, never retrievable again) with \`mustChangePassword: false\` (R39: no forced password change; the user can change it in /profile/edit). No shared default password is ever issued. The IC is accepted as \`icNumber\` and stored as hash + mask only; a validation error never echoes it. Passwords are never echoed in \`fields\`, error bodies or logs. Unknown keys are rejected with 422 (BE-NFR-05, strict request bodies). A role the caller may not assign is 403 FORBIDDEN; a \`schoolId\` outside the caller scope is 422 \`fields.schoolId\`. A duplicate e-mail or username is 422 \`fields.email\` / \`fields.username\` with the mock copy "The email has already been taken." / "The username has already been taken.". For a school_admin caller the answer is identical whether the existing account is in scope or in another school (and whatever its role), so its school and role never leak. Trade-off: the caller can still learn that the e-mail exists somewhere, since an exact uniqueness check cannot be hidden.`,
    request: { headers: csrf, body: body(CreateUserRequestSchema) },
    responses: {
      201: jsonNoStore(statusEnvelopeOf(CreatedUserSchema), 'Created, with the one-time generated password.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/users/{id}',
    tags,
    summary: 'Update a user',
    description: `${access('PUT /admin/users/{id}')} status: "Pengguna berjaya dikemaskini.". Absent keys keep the stored value, except \`roles\`, which is required and replaces the whole list. A school_admin may edit the non-role fields of an in-scope parent but may not change the roles of a parent target (403 FORBIDDEN, same pattern as a role the caller may not assign); assigning the parent role is admin-only. D59: there is no admin-chosen password. \`resetPassword: true\` makes the server generate a random one-time password, returned once as \`generatedPassword\` (no-store, never logged, never retrievable again); R39: the target is not flagged \`mustChangePassword\` (no forced change; the stored flag is left as is) and all its sessions are revoked. A role or status change also revokes the target sessions. Unknown keys are rejected with 422 (BE-NFR-05, strict request bodies). A role the caller may not assign is 403; the server refuses to demote, deactivate or remove the last active admin or the caller's own admin role (409 CONFLICT). Uniqueness copy and generic behaviour as on create; a target of a higher or equal role (or another school) is 404 for a school_admin.`,
    request: { headers: csrf, params: idParam, body: body(UpdateUserRequestSchema) },
    responses: {
      200: jsonNoStore(statusEnvelopeOf(UpdatedUserSchema), 'Updated; with generatedPassword only after resetPassword.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      409: conflict,
      422: invalid,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/users/{id}',
    tags,
    summary: 'Delete a user',
    description: `${access('DELETE /admin/users/{id}')} status: "Pengguna berjaya dipadam.". Returns 200 with a body (not 204). The mock cascades (parent links, invites, packages, complimentary profile, sessions); the server does it in one transaction, revokes sessions and audits (ids only). The own account is 422 \`fields.id\` "Anda tidak boleh memadam akaun sendiri."; the last active admin is 409.`,
    request: { headers: csrf, params: idParam },
    responses: {
      200: json(statusEnvelopeOf(DeletedResultSchema), 'Deleted.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      409: conflict,
      422: invalid,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users/bulk-delete',
    tags,
    summary: 'Delete several users',
    description: `${access('POST /admin/users/bulk-delete')} status: "{n} pengguna berjaya dipadam.". Unknown ids are skipped. A list containing the own account is 422 \`fields.ids\` "Anda tidak boleh memadam akaun sendiri.". Unknown keys are rejected with 422 (BE-NFR-05, strict request bodies).`,
    request: { headers: csrf, body: body(BulkDeleteRequestSchema) },
    responses: {
      200: json(statusEnvelopeOf(DeletedResultSchema), 'Deleted.'),
      401: unauthorized,
      403: forbidden,
      409: conflict,
      422: invalid,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users/{id}/toggle-active',
    tags,
    summary: 'Flip the active flag of a user',
    description: `${access('POST /admin/users/{id}/toggle-active')} status: "Status pengguna berjaya dikemaskini.". Deactivating revokes the target sessions; the last active admin cannot be deactivated (409).`,
    request: { headers: csrf, params: idParam },
    responses: {
      200: json(statusEnvelopeOf(UserToggleResultSchema), 'New value.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      409: conflict,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users/bulk-import',
    tags,
    summary: 'Import teachers, parents, school admins or PPD officers from CSV text or a paste',
    description: `${access('POST /admin/users/bulk-import')} Roles limited to teacher, parent, school_admin, ppd_officer (BULK_IMPORT_ROLES_BY_CALLER: a school_admin may import teachers only, never parents: 403 FORBIDDEN, D58); schoolId is required for teacher and school_admin. Rows are \`name, email, phone?\` (D59b: no password column, no default-password field); the first line is a header when its second column is not an e-mail. Caps: 1,048,576 characters and 1000 non-blank rows (a multipart file over 1 MB is 413; more rows is 422 \`fields.csvFile\`/\`fields.pasteContent\`). Failed lines are reported in \`errors\`; duplicates are counted as \`skipped\` by one rule for every caller: a duplicate in the caller school and one in another school are counted identically (trade-off: existence is revealed, not the school). Every created account gets a server-generated random password, returned once per row in \`credentials\` (no-store, never logged), with \`mustChangePassword\` false (R39: no forced change). No data rows is 422 "Tiada data untuk diimport." on \`fields.csvFile\` or \`fields.pasteContent\`. status: "Import selesai: {created} pengguna didaftarkan, {skipped} dilangkau, {failed} gagal.". Tightly rate limited. Unknown keys are rejected with 422 (BE-NFR-05, strict request bodies).`,
    request: {
      headers: csrf,
      body: {
        required: true,
        content: {
          'application/json': { schema: BulkImportRequestSchema },
          'multipart/form-data': { schema: BulkImportMultipartSchema },
        },
      },
    },
    responses: {
      200: jsonNoStore(statusEnvelopeOf(ImportResultSchema), 'Import report.'),
      401: unauthorized,
      403: json(
        z.union([ImportRoleForbiddenSchema, ErrorBodySchema]),
        'FORBIDDEN: a school_admin importing any role but teacher (D58, message "Admin sekolah hanya boleh mengimport guru.", server-enforced because the schema cannot see the caller), another role not allowed, or CSRF_INVALID.',
      ),
      413: err('PAYLOAD_TOO_LARGE: multipart file over 1 MB.'),
      422: invalid,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/students/search',
    tags,
    summary: 'Student picker: up to 15 students by name or e-mail (staff only, school-scoped)',
    description: `${access('GET /students/search')} Matches the student name only (not e-mail or phone: data minimisation); a query under 3 characters returns []. A teacher sees only students in its own classes, a school_admin its own school, admin all. Items carry no phone and, for scoped callers, no school name. Returns names of minors: no-store. Rate limited.`,
    request: { query: StudentSearchQuerySchema },
    responses: {
      200: jsonNoStore(envelopeOf(z.array(StudentSearchItemSchema)), 'Students; [] for a query under 3 characters.'),
      401: unauthorized,
      403: forbidden,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/teachers',
    tags,
    summary: 'Every teacher {id, name, email}, by name',
    description: `${access('GET /admin/teachers')} Personal data: no-store.`,
    responses: { 200: jsonNoStore(envelopeOf(z.array(TeacherOptionSchema)), 'Teachers.'), 401: unauthorized, 403: forbidden, 429: limited },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/teachers/{id}/classrooms',
    tags,
    summary: 'Active classes of a teacher',
    description: `${access('GET /admin/teachers/{id}/classrooms')} [] for none or an unknown teacher (no 404). Empty until the class module exists.`,
    request: { params: idParam },
    responses: { 200: json(envelopeOf(z.array(TeacherClassroomOptionSchema)), 'Classes.'), 401: unauthorized, 403: forbidden, 429: limited },
  })
}
