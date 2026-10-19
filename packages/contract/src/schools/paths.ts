import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import {
  AdminSchoolSchema,
  ClassLevelSchema,
  ExistingStudentSchema,
  ExistingStudentsQuerySchema,
  JpnSchema,
  PpdSchema,
  SchoolInputSchema,
  SchoolListMetaSchema,
  SchoolListQuerySchema,
  SchoolOptionSchema,
  SchoolOptionsQuerySchema,
  SchoolSearchQuerySchema,
  SchoolSummarySchema,
  SchoolToggleResultSchema,
  SchoolTypeSchema,
  statusEnvelopeOf,
} from './schema'

/** Components contributed by BE-05 (schools); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const SCHOOLS_COMPONENT_SCHEMAS = {
  SchoolType: SchoolTypeSchema,
  SchoolSummary: SchoolSummarySchema,
  AdminSchool: AdminSchoolSchema,
  SchoolOption: SchoolOptionSchema,
  SchoolListMeta: SchoolListMetaSchema,
  SchoolListQuery: SchoolListQuerySchema,
  SchoolInput: SchoolInputSchema,
  SchoolToggleResult: SchoolToggleResultSchema,
  SchoolOptionsQuery: SchoolOptionsQuerySchema,
  SchoolSearchQuery: SchoolSearchQuerySchema,
  Jpn: JpnSchema,
  Ppd: PpdSchema,
  ClassLevel: ClassLevelSchema,
  ExistingStudentsQuery: ExistingStudentsQuerySchema,
  ExistingStudent: ExistingStudentSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const idParam = z.object({ id: z.string().min(1).meta({ description: 'Opaque entity id.' }) })

/** Registers the BE-05 school, JPN/PPD and school-lookup endpoints. */
export function registerSchoolsPaths(registry: OpenAPIRegistry): void {
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const forbidden = err('FORBIDDEN (not an admin) or CSRF_INVALID on mutations.')
  const notFound = err('NOT_FOUND.')
  const invalid = err('VALIDATION_ERROR with `fields`.')
  const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
  const tags = ['schools']

  registry.registerPath({
    method: 'get',
    path: '/admin/schools',
    tags,
    summary: 'List schools (30 per page, name A to Z)',
    description: '`meta.counts` {total, active, inactive} covers all schools; `meta.types` lists the distinct types present.',
    request: { query: SchoolListQuerySchema },
    responses: {
      200: json(z.object({ data: z.array(AdminSchoolSchema), meta: SchoolListMetaSchema }), 'A page of schools.'),
      401: unauthorized,
      403: forbidden,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/schools/options',
    tags,
    summary: 'Every school as {id, name}, active and inactive, name A to Z, no paging',
    responses: { 200: json(envelopeOf(z.array(SchoolOptionSchema)), 'School options.'), 401: unauthorized, 403: forbidden },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/schools/{id}',
    tags,
    summary: 'One school',
    request: { params: idParam },
    responses: { 200: json(envelopeOf(AdminSchoolSchema), 'The school.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/schools',
    tags,
    summary: 'Create a school',
    description: 'status: "Sekolah berjaya disimpan.". A duplicate code (case-insensitive) is 422 `fields.code`.',
    request: { body: body(SchoolInputSchema) },
    responses: { 201: json(statusEnvelopeOf(AdminSchoolSchema), 'Created.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/schools/{id}',
    tags,
    summary: 'Update a school',
    description: 'status: "Sekolah berjaya disimpan.". The school own code is not a duplicate; absent `isActive` keeps the stored value.',
    request: { params: idParam, body: body(SchoolInputSchema) },
    responses: {
      200: json(statusEnvelopeOf(AdminSchoolSchema), 'Updated.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      422: invalid,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/schools/{id}/toggle',
    tags,
    summary: 'Flip the active flag of a school (a school is never deleted)',
    description: 'status: "Status sekolah berjaya dikemaskini.".',
    request: { params: idParam },
    responses: {
      200: json(statusEnvelopeOf(SchoolToggleResultSchema), 'New value.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/schools/{id}/students',
    tags,
    summary: 'Existing students of a school (at most 200, name A to Z), for the import screen',
    request: { params: idParam, query: ExistingStudentsQuerySchema },
    responses: {
      200: json(envelopeOf(z.array(ExistingStudentSchema)), 'Students.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/schools',
    tags,
    summary: 'Every school as {id, name} (admin; `all=1` required)',
    description: 'Same data as GET /admin/schools/options. Without `all=1`: 422 `fields.all`.',
    request: { query: SchoolOptionsQuerySchema },
    responses: { 200: json(envelopeOf(z.array(SchoolOptionSchema)), 'School options.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })

  registry.registerPath({
    method: 'get',
    path: '/schools/search',
    tags,
    summary: 'Public school picker (login and register): active schools only, not paginated',
    description: 'No session needed. Sorted by name then id. Never returns the join code.',
    request: { query: SchoolSearchQuerySchema },
    responses: { 200: json(envelopeOf(z.array(SchoolSummarySchema)), 'Matching schools.') },
  })

  registry.registerPath({
    method: 'get',
    path: '/jpn',
    tags,
    summary: 'Public JPN (state department) list, by id',
    responses: { 200: json(envelopeOf(z.array(JpnSchema)), 'JPN list.') },
  })

  registry.registerPath({
    method: 'get',
    path: '/jpn/{id}/ppd',
    tags,
    summary: 'Public PPD list of one JPN, by code',
    request: { params: idParam },
    responses: { 200: json(envelopeOf(z.array(PpdSchema)), 'PPD list.'), 404: notFound },
  })
}
