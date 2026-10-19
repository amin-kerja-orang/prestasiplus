import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { ErrorBodySchema } from '../common/error'
import { csrfHeaders, jsonNoStore, rateLimitedResponse } from './http'
import {
  SCHOOL_ACCESS,
  accessLine,
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
const access = (key: keyof typeof SCHOOL_ACCESS) => accessLine(SCHOOL_ACCESS, key)
const idParam = z.object({ id: IdSchema })

/** Registers the BE-05 school, JPN/PPD and school-lookup endpoints. */
export function registerSchoolsPaths(registry: OpenAPIRegistry): void {
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const forbidden = err('FORBIDDEN (role not allowed for this operation, see Access) or CSRF_INVALID on mutations.')
  const notFound = err('NOT_FOUND (also for an id outside the caller scope, so ids cannot be probed).')
  const invalid = err('VALIDATION_ERROR with `fields`.')
  const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
  const tags = ['schools']
  const limited = rateLimitedResponse
  const csrf = [csrfHeaders]

  registry.registerPath({
    method: 'get',
    path: '/admin/schools',
    tags,
    summary: 'List schools (30 per page, name A to Z)',
    description: `${access('GET /admin/schools')} \`meta.counts\` {total, active, inactive} covers all schools; \`meta.types\` lists the distinct types present. Responses carry the join code (a bearer secret): no-store.`,
    request: { query: SchoolListQuerySchema },
    responses: {
      200: jsonNoStore(z.object({ data: z.array(AdminSchoolSchema), meta: SchoolListMetaSchema }), 'A page of schools.'),
      401: unauthorized,
      403: forbidden,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/schools/options',
    tags,
    summary: 'Every school as {id, name}, active and inactive, name A to Z, no paging',
    description: access('GET /admin/schools/options'),
    responses: { 200: json(envelopeOf(z.array(SchoolOptionSchema)), 'School options.'), 401: unauthorized, 403: forbidden, 429: limited },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/schools/{id}',
    tags,
    summary: 'One school',
    description: `${access('GET /admin/schools/{id}')} Includes the join code: no-store.`,
    request: { params: idParam },
    responses: { 200: jsonNoStore(envelopeOf(AdminSchoolSchema), 'The school.'), 401: unauthorized, 403: forbidden, 404: notFound, 429: limited },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/schools',
    tags,
    summary: 'Create a school',
    description: `${access('POST /admin/schools')} status: "Sekolah berjaya disimpan.". A duplicate code (case-insensitive) is 422 \`fields.code\`. Unknown keys (such as \`joinCode\`) are rejected with 422 (BE-NFR-05, strict request bodies); the server generates the join code.`,
    request: { headers: csrf, body: body(SchoolInputSchema) },
    responses: {
      201: jsonNoStore(statusEnvelopeOf(AdminSchoolSchema), 'Created.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/schools/{id}',
    tags,
    summary: 'Update a school',
    description: `${access('PUT /admin/schools/{id}')} status: "Sekolah berjaya disimpan.". The school own code is not a duplicate; absent \`isActive\` keeps the stored value. Unknown keys are rejected with 422 (BE-NFR-05, strict request bodies).`,
    request: { headers: csrf, params: idParam, body: body(SchoolInputSchema) },
    responses: {
      200: jsonNoStore(statusEnvelopeOf(AdminSchoolSchema), 'Updated.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      422: invalid,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/schools/{id}/toggle',
    tags,
    summary: 'Flip the active flag of a school (a school is never deleted)',
    description: `${access('POST /admin/schools/{id}/toggle')} status: "Status sekolah berjaya dikemaskini.".`,
    request: { headers: csrf, params: idParam },
    responses: {
      200: json(statusEnvelopeOf(SchoolToggleResultSchema), 'New value.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/schools/{id}/students',
    tags,
    summary: 'Existing students of a school (at most 200, name A to Z), for the import screen',
    description: `${access('GET /admin/schools/{id}/students')} Returns e-mail and DELIMa id of minors: no-store.`,
    request: { params: idParam, query: ExistingStudentsQuerySchema },
    responses: {
      200: jsonNoStore(envelopeOf(z.array(ExistingStudentSchema)), 'Students.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/schools',
    tags,
    summary: 'Every school as {id, name} (admin; `all=1` required)',
    description: `${access('GET /schools')} Same data as GET /admin/schools/options. Without \`all=1\`: 422 \`fields.all\`.`,
    request: { query: SchoolOptionsQuerySchema },
    responses: { 200: json(envelopeOf(z.array(SchoolOptionSchema)), 'School options.'), 401: unauthorized, 403: forbidden, 422: invalid, 429: limited },
  })

  registry.registerPath({
    method: 'get',
    path: '/schools/search',
    tags,
    summary: 'Public school picker (login and register): active schools only, not paginated',
    description: `${access('GET /schools/search')} Sorted by name then id. Never returns the join code. \`limit\` is capped at 100. Rate limited (unauthenticated).`,
    request: { query: SchoolSearchQuerySchema },
    responses: { 200: json(envelopeOf(z.array(SchoolSummarySchema)), 'Matching schools.'), 429: limited },
  })

  registry.registerPath({
    method: 'get',
    path: '/jpn',
    tags,
    summary: 'Public JPN (state department) list, by id',
    description: `${access('GET /jpn')} Rate limited (unauthenticated).`,
    responses: { 200: json(envelopeOf(z.array(JpnSchema)), 'JPN list.'), 429: limited },
  })

  registry.registerPath({
    method: 'get',
    path: '/jpn/{id}/ppd',
    tags,
    summary: 'Public PPD list of one JPN, by code',
    description: `${access('GET /jpn/{id}/ppd')} Rate limited (unauthenticated).`,
    request: { params: idParam },
    responses: { 200: json(envelopeOf(z.array(PpdSchema)), 'PPD list.'), 404: notFound, 429: limited },
  })
}
