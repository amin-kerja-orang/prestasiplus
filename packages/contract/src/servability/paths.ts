import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf, listEnvelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import {
  ServabilityAttentionCountSchema,
  ServabilityBatchRequestSchema,
  ServabilityBatchResultSchema,
  ServabilityDatabankRowSchema,
  ServabilityLaneQuerySchema,
  ServabilityLaneSubjectSchema,
  ServabilityOverviewActivitySchema,
  ServabilityOverviewSchema,
  ServabilityPaperRowSchema,
} from './reads'
import {
  ServabilityActivityResultSchema,
  ServabilityActivitySchema,
  ServabilityReasonCodeSchema,
  ServabilityReasonSchema,
  ServabilityReportSchema,
} from './schema'

/** Components contributed by R1-T29 and R1-T30 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const SERVABILITY_COMPONENT_SCHEMAS = {
  ServabilityActivity: ServabilityActivitySchema,
  ServabilityReasonCode: ServabilityReasonCodeSchema,
  ServabilityReason: ServabilityReasonSchema,
  ServabilityActivityResult: ServabilityActivityResultSchema,
  ServabilityReport: ServabilityReportSchema,
  ServabilityBatchRequest: ServabilityBatchRequestSchema,
  ServabilityBatchResult: ServabilityBatchResultSchema,
  ServabilityOverviewActivity: ServabilityOverviewActivitySchema,
  ServabilityOverview: ServabilityOverviewSchema,
  ServabilityLaneQuery: ServabilityLaneQuerySchema,
  ServabilityLaneSubject: ServabilityLaneSubjectSchema,
  ServabilityDatabankRow: ServabilityDatabankRowSchema,
  ServabilityAttentionCount: ServabilityAttentionCountSchema,
  ServabilityPaperRow: ServabilityPaperRowSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }) })
const unauthorized = err('UNAUTHORIZED: no valid session.')
const forbidden = err('FORBIDDEN (not Admin Pusat), or CSRF_INVALID on the batch POST.')
const invalid = err('VALIDATION_ERROR: `fields` keyed by input name (BM messages).')

/**
 * R1-B11 "Dilihat murid di": the admin reads. Admin Pusat only. All are read-only; the batch is a POST only because it carries a
 * body of ids, so it needs the CSRF header like every POST. Per-user rate limit `THROTTLE_SERVABILITY_READ_PER_MINUTE` (default 120).
 */
export function registerServabilityPaths(registry: OpenAPIRegistry): void {
  const tags = ['servability']
  registry.registerPath({
    method: 'get',
    path: '/admin/servability/questions/{id}',
    tags,
    summary: 'Where one question is served to pupils, and why not',
    request: { params: z.object({ id: IdSchema }) },
    responses: {
      200: json(envelopeOf(ServabilityReportSchema), 'The report; `versionNo` is the live version evaluated.'),
      401: unauthorized,
      403: forbidden,
      404: err('NOT_FOUND: unknown id, a PKSK question or a Darjah question.'),
    },
  })
  registry.registerPath({
    method: 'post',
    path: '/admin/servability/questions/batch',
    tags,
    summary: 'Reports of up to 100 questions',
    request: { headers: csrf, body: { required: true, content: { 'application/json': { schema: ServabilityBatchRequestSchema } } } },
    responses: { 200: json(envelopeOf(ServabilityBatchResultSchema), 'Reports in request order; unknown ids in `notFound`.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  registry.registerPath({
    method: 'get',
    path: '/admin/servability/overview',
    tags,
    summary: 'Served and not-served counts per activity (hub cards)',
    responses: { 200: json(envelopeOf(ServabilityOverviewSchema), 'One entry per activity, with how the count was obtained.'), 401: unauthorized, 403: forbidden },
  })
  registry.registerPath({
    method: 'get',
    path: '/admin/servability/lanes/databank',
    tags,
    summary: 'Lane "Databank Soalan": bank questions of the Databank subjects with their reasons',
    request: { query: ServabilityLaneQuerySchema },
    responses: { 200: json(listEnvelopeOf(ServabilityDatabankRowSchema), 'A page of rows, newest first. `status` filters the lifecycle code.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  registry.registerPath({
    method: 'get',
    path: '/admin/servability/lanes/bijak-spm',
    tags,
    summary: 'Lane "Bijak SPM": papers with the count of placed questions the bridge cannot serve',
    request: { query: ServabilityLaneQuerySchema },
    responses: { 200: json(listEnvelopeOf(ServabilityPaperRowSchema), 'A page of papers, newest first. `status` is draft or published.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
}
