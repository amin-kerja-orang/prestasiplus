import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { statusEnvelopeOf } from '../schools/schema'
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
const idParam = z.object({ id: z.string().min(1).meta({ description: 'Opaque user id.' }) })

/**
 * Registers the BE-05 user endpoints. `POST /admin/users/{id}/impersonate` is intentionally absent
 * (UD-2); Mod Pelajar is `POST /session/mode`. Subscriptions, packages and comp students are BE-25.
 */
export function registerUsersPaths(registry: OpenAPIRegistry): void {
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const forbidden = err('FORBIDDEN (role not allowed) or CSRF_INVALID on mutations.')
  const notFound = err('NOT_FOUND.')
  const invalid = err('VALIDATION_ERROR with `fields` (field name to BM message).')
  const tags = ['users']
  const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

  registry.registerPath({
    method: 'get',
    path: '/admin/users',
    tags,
    summary: 'List users (25 per page, newest first)',
    description:
      'Filters combine with AND. `meta.roleCounts` counts all users per role and ignores the filters. Responses carry the masked IC only.',
    request: { query: UserListQuerySchema },
    responses: {
      200: json(z.object({ data: z.array(AdminUserListItemSchema), meta: UserListMetaSchema }), 'A page of users.'),
      401: unauthorized,
      403: forbidden,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/users/filters',
    tags,
    summary: 'Schools that have at least one user (filter options), by name',
    responses: { 200: json(envelopeOf(UserFiltersSchema), 'Filter options.'), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/users/{id}',
    tags,
    summary: 'User detail',
    request: { params: idParam },
    responses: { 200: json(envelopeOf(AdminUserDetailSchema), 'The user.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users',
    tags,
    summary: 'Create a user',
    description: 'status: "Pengguna berjaya didaftarkan.". The IC is accepted as `icNumber` and stored as hash + mask only.',
    request: { body: body(CreateUserRequestSchema) },
    responses: { 201: json(statusEnvelopeOf(AdminUserDetailSchema), 'Created.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/users/{id}',
    tags,
    summary: 'Update a user',
    description: 'status: "Pengguna berjaya dikemaskini.". Absent keys keep the stored value.',
    request: { params: idParam, body: body(UpdateUserRequestSchema) },
    responses: {
      200: json(statusEnvelopeOf(AdminUserDetailSchema), 'Updated.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      422: invalid,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/users/{id}',
    tags,
    summary: 'Delete a user',
    description:
      'status: "Pengguna berjaya dipadam.". Returns 200 with a body (not 204). The mock cascades (parent links, invites, packages, complimentary profile, sessions). The own account is 422 `fields.id` "Anda tidak boleh memadam akaun sendiri.".',
    request: { params: idParam },
    responses: {
      200: json(statusEnvelopeOf(DeletedResultSchema), 'Deleted.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      422: invalid,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users/bulk-delete',
    tags,
    summary: 'Delete several users',
    description:
      'status: "{n} pengguna berjaya dipadam.". Unknown ids are skipped. A list containing the own account is 422 `fields.ids` "Anda tidak boleh memadam akaun sendiri.".',
    request: { body: body(BulkDeleteRequestSchema) },
    responses: { 200: json(statusEnvelopeOf(DeletedResultSchema), 'Deleted.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users/{id}/toggle-active',
    tags,
    summary: 'Flip the active flag of a user',
    description: 'status: "Status pengguna berjaya dikemaskini.".',
    request: { params: idParam },
    responses: { 200: json(statusEnvelopeOf(UserToggleResultSchema), 'New value.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users/bulk-import',
    tags,
    summary: 'Import teachers, parents, school admins or PPD officers from CSV text or a paste',
    description:
      'Roles limited to teacher, parent, school_admin, ppd_officer; schoolId is required for teacher and school_admin. Rows are `name, email, phone?, password?`; the first line is a header when its second column is not an e-mail. Failed lines are reported in `errors`; duplicates are counted as skipped. No data rows is 422 "Tiada data untuk diimport." on `fields.csvFile` or `fields.pasteContent`. status: "Import selesai: {created} pengguna didaftarkan, {skipped} dilangkau, {failed} gagal.".',
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: BulkImportRequestSchema },
          'multipart/form-data': { schema: BulkImportMultipartSchema },
        },
      },
    },
    responses: { 200: json(statusEnvelopeOf(ImportResultSchema), 'Import report.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })

  registry.registerPath({
    method: 'get',
    path: '/students/search',
    tags,
    summary: 'Student picker: up to 15 students by name or e-mail (any signed-in role)',
    request: { query: StudentSearchQuerySchema },
    responses: { 200: json(envelopeOf(z.array(StudentSearchItemSchema)), 'Students; [] for a query under 2 characters.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/teachers',
    tags,
    summary: 'Every teacher {id, name, email}, by name',
    responses: { 200: json(envelopeOf(z.array(TeacherOptionSchema)), 'Teachers.'), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/teachers/{id}/classrooms',
    tags,
    summary: 'Active classes of a teacher',
    description: '[] for none or an unknown teacher (no 404). Empty until the class module exists.',
    request: { params: idParam },
    responses: { 200: json(envelopeOf(z.array(TeacherClassroomOptionSchema)), 'Classes.'), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/config/defaults',
    tags,
    summary: 'Configured default passwords shown on the admin forms',
    responses: { 200: json(envelopeOf(AdminDefaultsSchema), 'Defaults.'), 401: unauthorized, 403: forbidden },
  })
}
