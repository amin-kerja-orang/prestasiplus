import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf, listEnvelopeOf, ListMetaSchema } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import {
  QuestionBulkRequestSchema,
  QuestionBulkResultSchema,
  QuestionCreateRequestSchema,
  QuestionCurriculumTagSchema,
  QuestionDeleteResultSchema,
  QuestionDetailSchema,
  QuestionGuruCreateRequestSchema,
  QuestionGuruDetailSchema,
  QuestionGuruQuerySchema,
  QuestionGuruRemoveResultSchema,
  QuestionGuruSummarySchema,
  QuestionGuruUpdateRequestSchema,
  QuestionKbatLevelSchema,
  QuestionLeafModeSchema,
  QuestionLeafPartSchema,
  QuestionListQuerySchema,
  QuestionMarkPointSchema,
  QuestionNamedRefSchema,
  QuestionPartSchema,
  QuestionPublicPartSchema,
  QuestionPublicSchema,
  QuestionRichTextSchema,
  QuestionRowSchema,
  QuestionSchema,
  QuestionStatusSchema,
  QuestionStimulusGroupSchema,
  QuestionStimulusSchema,
  QuestionStructuredDetailSchema,
  QuestionStructuredListQuerySchema,
  QuestionStructuredRowSchema,
  QuestionStructuredStatsSchema,
  QuestionStructuredSubSchema,
  QuestionSummarySchema,
  QuestionTypeSchema,
  QuestionUpdateRequestSchema,
  mutationEnvelopeOf,
} from './schema'

/** Components contributed by BE-09 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const QUESTIONS_COMPONENT_SCHEMAS = {
  QuestionStatus: QuestionStatusSchema,
  QuestionType: QuestionTypeSchema,
  QuestionNamedRef: QuestionNamedRefSchema,
  QuestionRichText: QuestionRichTextSchema,
  QuestionKbatLevel: QuestionKbatLevelSchema,
  QuestionLeafMode: QuestionLeafModeSchema,
  QuestionMarkPoint: QuestionMarkPointSchema,
  QuestionLeafPart: QuestionLeafPartSchema,
  QuestionPart: QuestionPartSchema,
  QuestionPublicPart: QuestionPublicPartSchema,
  QuestionCurriculumTag: QuestionCurriculumTagSchema,
  QuestionStimulus: QuestionStimulusSchema,
  QuestionStimulusGroup: QuestionStimulusGroupSchema,
  QuestionRow: QuestionRowSchema,
  QuestionSummary: QuestionSummarySchema,
  Question: QuestionSchema,
  QuestionDetail: QuestionDetailSchema,
  QuestionCreateRequest: QuestionCreateRequestSchema,
  QuestionUpdateRequest: QuestionUpdateRequestSchema,
  QuestionBulkRequest: QuestionBulkRequestSchema,
  QuestionStructuredRow: QuestionStructuredRowSchema,
  QuestionStructuredSub: QuestionStructuredSubSchema,
  QuestionStructuredDetail: QuestionStructuredDetailSchema,
  QuestionGuruSummary: QuestionGuruSummarySchema,
  QuestionGuruDetail: QuestionGuruDetailSchema,
  QuestionGuruCreateRequest: QuestionGuruCreateRequestSchema,
  QuestionGuruUpdateRequest: QuestionGuruUpdateRequestSchema,
  QuestionPublic: QuestionPublicSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
const idParams = z.object({ id: IdSchema })
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

const unauthorized = err('UNAUTHORIZED: no valid session.')
const forbidden = err('FORBIDDEN, or CSRF_INVALID when X-CSRF-Token is missing or wrong.')
const notFound = err('NOT_FOUND: unknown id (for Guru routes also another teacher\'s question; ids cannot be probed).')
const invalid = err('VALIDATION_ERROR: one response, `fields` keyed by input name (BM messages), `message` = first message plus the count of the others.')

const StructuredListEnvelope = z.object({
  data: z.array(QuestionStructuredRowSchema),
  meta: ListMetaSchema.extend({ stats: QuestionStructuredStatsSchema }),
})

/** Registers the BE-09 endpoints. Admin routes: Admin Pusat only. Guru routes: Guru or Admin (mock teacherOnly), own rows only. GET /guru/questions/template and POST /guru/questions/import (BE-10) and GET /guru/contributions (BE-17) belong to other cards. */
export function registerQuestionsPaths(registry: OpenAPIRegistry): void {
  const admin = ['questions']
  const guru = ['questions', 'guru']

  registry.registerPath({
    method: 'get',
    path: '/questions',
    tags: admin,
    summary: 'Admin question list (newest first)',
    description:
      'Page size 20 (max 100). Unknown filter values match nothing, except `status`, which must be one of the v2 codes (422 otherwise, D54a). Legacy PKSK rows are never listed.',
    request: { query: QuestionListQuerySchema },
    responses: {
      200: json(listEnvelopeOf(QuestionRowSchema), 'A page of rows.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
    },
  })
  registry.registerPath({
    method: 'get',
    path: '/questions/summary',
    tags: admin,
    summary: 'Total and one tile per active subject',
    responses: { 200: json(envelopeOf(QuestionSummarySchema), 'Summary.'), 401: unauthorized, 403: forbidden },
  })
  registry.registerPath({
    method: 'post',
    path: '/questions/bulk-action',
    tags: admin,
    summary: 'Apply one lifecycle action to many questions',
    description:
      'Unknown ids are skipped silently; duplicates count once. Flash: "<n> soalan berjaya dikemaskini." Transition rules and "only Admin Pusat publishes" belong to BE-10; forbidden transitions and their error are BE-10 to define. `approved` runs the merged approve gate (ADR-0027: tag, keys, rights not "belum jelas", duplicates, DSKP-complete for an SPM-bound question) per id, the same as `POST /questions/{id}/status`: a refused id is a `failed[]` entry (VALIDATION_ERROR with the gate `fields`), the others are applied. `POST /questions` with `status: approved` runs the same gate (422, nothing stored).',
    request: { headers: [csrf], body: body(QuestionBulkRequestSchema) },
    responses: {
      200: json(mutationEnvelopeOf(QuestionBulkResultSchema), 'Rows affected, with the flash text.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
    },
  })
  registry.registerPath({
    method: 'post',
    path: '/questions',
    tags: admin,
    summary: 'Create a question',
    description:
      'JSON only. Images are ids of files already uploaded with `POST /files?purpose=question_image` (JPG/PNG/WebP up to 2MB): `questionImageFileId`, `optionImageFileIds[i]`; their errors use the keys `questionImage` and `optionImages.<i>`. `kertas` (1 to 3) feeds the paper builder; error key `kertas`. Status defaults to `draft`. Service rule (not enforced by the body schema): `status: approved` needs subject, level, unit, SP and TP (422). A bad MCQ option is always reported under the single key `options`. Flash: "Soalan berjaya ditambah."',
    request: { headers: [csrf], body: body(QuestionCreateRequestSchema) },
    responses: {
      201: json(mutationEnvelopeOf(QuestionSchema), 'Created.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
    },
  })
  registry.registerPath({
    method: 'get',
    path: '/questions/{id}',
    tags: admin,
    summary: 'Admin question detail (with key and DSKP chain)',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(QuestionDetailSchema), 'The question.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })
  registry.registerPath({
    method: 'put',
    path: '/questions/{id}',
    tags: admin,
    summary: 'Edit a question',
    description: 'Required: subjectId, educationLevelId, difficultyLevel, questionText. Flash: "Soalan berjaya dikemaskini." Status changes go through bulk-action / BE-10.',
    request: { params: idParams, headers: [csrf], body: body(QuestionUpdateRequestSchema) },
    responses: {
      200: json(mutationEnvelopeOf(QuestionSchema), 'Updated.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      422: invalid,
    },
  })
  registry.registerPath({
    method: 'delete',
    path: '/questions/{id}',
    tags: admin,
    summary: 'Delete a question permanently',
    description: 'Answers 200 with a flash ("Soalan berjaya dipadam."), not 204, as the mock does.',
    request: { params: idParams, headers: [csrf] },
    responses: {
      200: json(mutationEnvelopeOf(QuestionDeleteResultSchema), 'Deleted.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/structured-questions',
    tags: ['questions'],
    summary: 'Admin list of structured questions (25 per page)',
    description: '`meta.stats` covers the whole store, not the filter. Unknown filter values match nothing.',
    request: { query: QuestionStructuredListQuerySchema },
    responses: { 200: json(StructuredListEnvelope, 'A page of rows.'), 401: unauthorized, 403: forbidden },
  })
  registry.registerPath({
    method: 'get',
    path: '/structured-questions/{id}',
    tags: ['questions'],
    summary: 'Structured question with sub-questions',
    request: { params: idParams },
    responses: {
      200: json(envelopeOf(QuestionStructuredDetailSchema), 'The question.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/questions',
    tags: guru,
    summary: 'Soalan Saya: the caller\'s own questions (20 per page, id ascending)',
    request: { query: QuestionGuruQuerySchema },
    responses: { 200: json(listEnvelopeOf(QuestionGuruSummarySchema), 'A page.'), 401: unauthorized, 403: forbidden },
  })
  registry.registerPath({
    method: 'post',
    path: '/guru/questions',
    tags: guru,
    summary: 'Submit a question (saved as `review`, owner = caller)',
    description: 'JSON only (images as `questionImageFileId` / `optionImageFileIds`). No flash. Counts toward the teacher contribution tiers (BE-17/BE-23 side effect).',
    request: { headers: [csrf], body: body(QuestionGuruCreateRequestSchema) },
    responses: {
      201: json(envelopeOf(QuestionGuruDetailSchema), 'Created.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
    },
  })
  registry.registerPath({
    method: 'get',
    path: '/guru/questions/{id}',
    tags: guru,
    summary: 'Own question detail',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(QuestionGuruDetailSchema), 'The question.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })
  registry.registerPath({
    method: 'put',
    path: '/guru/questions/{id}',
    tags: guru,
    summary: 'Edit own question',
    request: { params: idParams, headers: [csrf], body: body(QuestionGuruUpdateRequestSchema) },
    responses: {
      200: json(envelopeOf(QuestionGuruDetailSchema), 'Updated.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      422: invalid,
    },
  })
  registry.registerPath({
    method: 'delete',
    path: '/guru/questions/{id}',
    tags: guru,
    summary: 'Delete own question (the contribution credit is not taken back)',
    request: { params: idParams, headers: [csrf] },
    responses: { 200: json(envelopeOf(QuestionGuruRemoveResultSchema), 'Removed.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })
}
