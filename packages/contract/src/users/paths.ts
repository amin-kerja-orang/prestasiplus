import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { accessLine, statusEnvelopeOf } from '../schools/schema'
import { csrfHeaders, jsonNoStore, rateLimitedResponse } from '../schools/http'
import {
  AdminDefaultsSchema,
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
  ImportResult: ImportResultSchema,
  TeacherOption: TeacherOptionSchema,
  TeacherClassroomOption: TeacherClassroomOptionSchema,
  AdminDefaults: AdminDefaultsSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const access = (key: keyof typeof USER_ACCESS) => accessLine(USER_ACCESS, key)
const idParam = z.object({ id: z.string().min(1).meta({ description: 'Opaque user id.' }) })

/**
 * Registers the BE-05 user endpoints. `POST /admin/users/{id}/impersonate` is intentionally absent
 * (UD-2); Mod Pelajar is `POST /session/mode`. Subscriptions, packages and comp students are BE-25.
 */
export function registerUsersPaths(registry: OpenAPIRegistry): void {
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const forbidden = err('FORBIDDEN (role not allowed for this operation or role not assignable by the caller, see Access) or CSRF_INVALID on mutations.')
  const conflict = err('CONFLICT: would remove, demote or deactivate the last active admin or the caller own admin role.')
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
    description: `${access('GET /admin/users')} Filters combine with AND. \`meta.roleCounts\` counts users per role and ignores the filters (but not the caller scope). Responses carry the masked IC only and are no-store.`,
    request: { query: UserListQuerySchema },
    responses: {
      200: jsonNoStore(z.object({ data: z.array(AdminUserListItemSchema), meta: UserListMetaSchema }), 'A page of users.'),
      401: unauthorized,
      403: forbidden,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/users/filters',
    tags,
    summary: 'Schools that have at least one user (filter options), by name',
    description: access('GET /admin/users/filters'),
    responses: { 200: json(envelopeOf(UserFiltersSchema), 'Filter options.'), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/users/{id}',
    tags,
    summary: 'User detail',
    description: `${access('GET /admin/users/{id}')} Personal data: no-store. The server audits reads (ids only).`,
    request: { params: idParam },
    responses: { 200: jsonNoStore(envelopeOf(AdminUserDetailSchema), 'The user.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users',
    tags,
    summary: 'Create a user',
    description: `${access('POST /admin/users')} status: "Pengguna berjaya didaftarkan.". The IC is accepted as \`icNumber\` and stored as hash + mask only; a validation error never echoes it. Passwords are never echoed in \`fields\`, error bodies or logs. An account created here is flagged \`mustChangePassword\`. Unknown keys are rejected with 422. A role the caller may not assign is 403 FORBIDDEN; a \`schoolId\` outside the caller scope is 422 \`fields.schoolId\`. The distinct "has already been taken" message (e-mail, username) is shown to admin only; for school_admin the server must not reveal that the account belongs to another school.`,
    request: { headers: csrf, body: body(CreateUserRequestSchema) },
    responses: {
      201: jsonNoStore(statusEnvelopeOf(AdminUserDetailSchema), 'Created.'),
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
    description: `${access('PUT /admin/users/{id}')} status: "Pengguna berjaya dikemaskini.". Absent keys keep the stored value. Changing a password (\`newPassword\`) flags \`mustChangePassword\`; a password, role or status change revokes the target sessions. Unknown keys are rejected with 422. A role the caller may not assign is 403; the server refuses to demote, deactivate or remove the last active admin or the caller's own admin role (409 CONFLICT). Uniqueness copy as on create.`,
    request: { headers: csrf, params: idParam, body: body(UpdateUserRequestSchema) },
    responses: {
      200: jsonNoStore(statusEnvelopeOf(AdminUserDetailSchema), 'Updated.'),
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
    description: `${access('POST /admin/users/bulk-delete')} status: "{n} pengguna berjaya dipadam.". Unknown ids are skipped. A list containing the own account is 422 \`fields.ids\` "Anda tidak boleh memadam akaun sendiri.". Unknown keys are rejected with 422.`,
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
    description: `${access('POST /admin/users/bulk-import')} Roles limited to teacher, parent, school_admin, ppd_officer; schoolId is required for teacher and school_admin. Rows are \`name, email, phone?, password?\`; the first line is a header when its second column is not an e-mail. Caps: 1,048,576 characters and 1000 non-blank rows (a multipart file over 1 MB is 413; more rows is 422 \`fields.csvFile\`/\`fields.pasteContent\`); a row password is at most 128 characters. Failed lines are reported in \`errors\`; duplicates are counted as skipped (for school_admin the server must not reveal e-mails of other schools). Accounts created with the default password are flagged \`mustChangePassword\` (see \`mustChangePasswordCount\`). No data rows is 422 "Tiada data untuk diimport." on \`fields.csvFile\` or \`fields.pasteContent\`. status: "Import selesai: {created} pengguna didaftarkan, {skipped} dilangkau, {failed} gagal.". Tightly rate limited. Unknown keys are rejected with 422.`,
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
      403: forbidden,
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
    description: `${access('GET /students/search')} A query under 3 characters returns []. Returns names of minors: no-store. Rate limited.`,
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
    responses: { 200: jsonNoStore(envelopeOf(z.array(TeacherOptionSchema)), 'Teachers.'), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/teachers/{id}/classrooms',
    tags,
    summary: 'Active classes of a teacher',
    description: `${access('GET /admin/teachers/{id}/classrooms')} [] for none or an unknown teacher (no 404). Empty until the class module exists.`,
    request: { params: idParam },
    responses: { 200: json(envelopeOf(z.array(TeacherClassroomOptionSchema)), 'Classes.'), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/config/defaults',
    tags,
    summary: 'Configured default passwords shown on the admin forms',
    description: `${access('GET /admin/config/defaults')} Credentials in the body: always \`Cache-Control: no-store\`; school_admin and every other role get 403. Accounts created with a default password are flagged \`mustChangePassword\` (D55c, D57c). OQ-API-B1-16: confirm that these values may be returned at all.`,
    responses: { 200: jsonNoStore(envelopeOf(AdminDefaultsSchema), 'Defaults.'), 401: unauthorized, 403: forbidden },
  })
}
