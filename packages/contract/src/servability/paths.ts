import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import {
  ServabilityAttentionCountSchema,
  ServabilityBatchRequestSchema,
  ServabilityBatchResultSchema,
  ServabilityDatabankRowSchema,
  ServabilityLaneAttentionSchema,
  ServabilityLaneQuerySchema,
  ServabilityLaneRowSchema,
  ServabilityLatihTubiCellSchema,
  ServabilityLatihTubiLaneSchema,
  ServabilityLaneSubjectSchema,
  servabilityLaneListOf,
  ServabilityOverviewActivitySchema,
  ServabilityOverviewSchema,
  ServabilityPaperRowSchema,
  QuestionPaperServabilityMetaSchema,
  QuestionPaperServabilityResponseSchema,
  QuestionPaperServabilityRowSchema,
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
  ServabilityLaneAttention: ServabilityLaneAttentionSchema,
  ServabilityLaneRow: ServabilityLaneRowSchema,
  ServabilityLatihTubiCell: ServabilityLatihTubiCellSchema,
  ServabilityDatabankRow: ServabilityDatabankRowSchema,
  ServabilityAttentionCount: ServabilityAttentionCountSchema,
  ServabilityPaperRow: ServabilityPaperRowSchema,
  QuestionPaperServabilityRow: QuestionPaperServabilityRowSchema,
  QuestionPaperServabilityMeta: QuestionPaperServabilityMetaSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }) })
const unauthorized = err('UNAUTHORIZED: no valid session.')
const forbidden = err('FORBIDDEN (not Admin Pusat), or CSRF_INVALID on the batch POST.')
const invalid = err('VALIDATION_ERROR: `fields` keyed by input name (BM messages).')

/**
 * R1-B11 "Dilihat murid di": the admin reads. Admin Pusat only. All are read-only; the batch is a POST only because it carries a
 * body of ids, so it needs the CSRF header like every POST. Per-user rate limit `THROTTLE_SERVABILITY_READ_PER_MINUTE` (default 120); the overview has its own, smaller bucket (`THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE`, default 6).
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
    method: 'get',
    path: '/admin/questions/{id}/paper-servability',
    tags,
    summary: 'The published papers that carry a question, and whether pupils can open each (AC-04.3 / AC-04.4)',
    request: { params: z.object({ id: IdSchema }) },
    responses: {
      200: json(
        QuestionPaperServabilityResponseSchema,
        'One row per published admin paper (kind pilihan; a pupil\'s generated paper is never listed) that places the question, by paper id, at most the first 200; `meta.total` counts all of them and `meta.truncated` says the list is cut. `[]` when it is on none.',
      ),
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
    responses: {
      200: json(envelopeOf(ServabilityOverviewSchema), 'One entry per activity, with how the count was obtained. Costly (counts the whole bank): its own small rate limit `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE` (default 6), 429 above.'),
      401: unauthorized,
      403: forbidden,
      429: err('RATE_LIMITED: more than the overview limit per minute for this user.'),
    },
  })
  registry.registerPath({
    method: 'get',
    path: '/admin/servability/lanes/databank',
    tags,
    summary: 'Lane "Databank Soalan": bank questions of the Databank subjects with their reasons',
    request: { query: ServabilityLaneQuerySchema },
    responses: { 200: json(servabilityLaneListOf(ServabilityDatabankRowSchema), 'A page of rows, newest first, and `subjects` (the options of the Subjek filter). `status` filters the lifecycle code.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  registry.registerPath({
    method: 'get',
    path: '/admin/servability/lanes/bijak-spm',
    tags,
    summary: 'Lane "Bijak SPM": papers with the count of placed questions the bridge cannot serve',
    request: { query: ServabilityLaneQuerySchema },
    responses: { 200: json(servabilityLaneListOf(ServabilityPaperRowSchema), 'A page of papers, newest first, and `subjects` (the options of the Subjek filter). `status` is draft, ready, published or withdrawn.'), 401: unauthorized, 403: forbidden, 422: invalid },
  })
  const lane = (name: string, summary: string, schema: z.ZodType, description: string) =>
    registry.registerPath({
      method: 'get',
      path: `/admin/servability/lanes/${name}`,
      tags,
      summary,
      request: { query: ServabilityLaneQuerySchema },
      responses: { 200: json(schema, description), 401: unauthorized, 403: forbidden, 422: invalid },
    })
  lane('latih-tubi', 'Lane "Latih Tubi": subjects x Tingkatan with servable counts and the switch state', ServabilityLatihTubiLaneSchema, 'A page of cells; `count` counts questions; `meta.switchEnabled` is the `latih-tubi` switch. `status` is ignored.')
  lane('tracking-a', 'Lane "Tracking A": one row per set, with the sets that are not complete', servabilityLaneListOf(ServabilityLaneRowSchema), 'A page of sets, sorted by title. `status` is ignored.')
  lane('subjektif', 'Lane "Subjektif": structured and essay questions', servabilityLaneListOf(ServabilityLaneRowSchema), 'A page of questions, newest first. `status` filters the lifecycle code.')
  lane('kertas-subjektif', 'Lane "Kertas Subjektif": the Kertas Subjektif papers', servabilityLaneListOf(ServabilityLaneRowSchema), 'A page of papers, newest first; empty until papers carry a surface (DM-23).')
}
