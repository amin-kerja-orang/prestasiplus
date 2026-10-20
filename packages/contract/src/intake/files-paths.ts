import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import {
  INTAKE_BATCH_STATUS_LABELS,
  INTAKE_FILE_MESSAGES,
  IntakeBatchCreateSchema,
  IntakeBatchDetailEnvelopeSchema,
  IntakeBatchDetailSchema,
  IntakeBatchListQuerySchema,
  IntakeBatchListResponseSchema,
  IntakeBatchStatusSchema,
  IntakeBatchSummaryEnvelopeSchema,
  IntakeBatchSummarySchema,
  IntakeBboxSchema,
  IntakeCopyrightSchema,
  IntakeFigureRefSchema,
  IntakeFileErrorCodeSchema,
  IntakeFileProgressSchema,
  IntakeFileStatusSchema,
  IntakeFileSummarySchema,
  IntakeOwnerRefSchema,
  IntakePageInfoSchema,
  IntakePageListEnvelopeSchema,
  IntakePageListSchema,
  IntakePageOcrStatusSchema,
  IntakePaperTypeSchema,
  IntakeTextBlockSchema,
  IntakeTextSourceSchema,
  IntakeUploadMultipartSchema,
  IntakeUploadResultEnvelopeSchema,
  IntakeUploadResultSchema,
} from './files'
import { registerIntakeRoute } from './rate-limit'

/** Components contributed by BE-37 (appended to COMPONENT_SCHEMAS in openapi.ts). Every id is prefixed `Intake`. */
export const INTAKE_FILES_COMPONENT_SCHEMAS = {
  IntakeBatchStatus: IntakeBatchStatusSchema,
  IntakeFileStatus: IntakeFileStatusSchema,
  IntakePageOcrStatus: IntakePageOcrStatusSchema,
  IntakeTextSource: IntakeTextSourceSchema,
  IntakePaperType: IntakePaperTypeSchema,
  IntakeCopyright: IntakeCopyrightSchema,
  IntakeFileErrorCode: IntakeFileErrorCodeSchema,
  IntakeBatchCreate: IntakeBatchCreateSchema,
  IntakeBatchListQuery: IntakeBatchListQuerySchema,
  IntakeUploadMultipartRequest: IntakeUploadMultipartSchema,
  IntakeOwnerRef: IntakeOwnerRefSchema,
  IntakeFileProgress: IntakeFileProgressSchema,
  IntakeFileSummary: IntakeFileSummarySchema,
  IntakeBatchSummary: IntakeBatchSummarySchema,
  IntakeBatchDetail: IntakeBatchDetailSchema,
  IntakeUploadResult: IntakeUploadResultSchema,
  IntakeBbox: IntakeBboxSchema,
  IntakeTextBlock: IntakeTextBlockSchema,
  IntakeFigureRef: IntakeFigureRefSchema,
  IntakePageInfo: IntakePageInfoSchema,
  IntakePageList: IntakePageListSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const idParams = z.object({ id: IdSchema })
const pageParams = z.object({
  id: IdSchema,
  n: z.coerce.number().int().min(1).meta({ description: 'Page number, 1-based.' }),
})
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

const ROLES =
  'Roles (D40a): Guru (`teacher`) on the batches they own, Admin Pusat (`admin`) on all. Admin Sekolah, PPD, Murid and every other role get 403.'

const unauthorized = err('UNAUTHORIZED: no valid session.')
const forbidden = err('FORBIDDEN (a role without access), or CSRF_INVALID when X-CSRF-Token is missing or wrong.')
const invalid = err('VALIDATION_ERROR: one response, `fields` keyed by input name (BM messages).')
const notFound = (what: string) =>
  err(`NOT_FOUND: unknown ${what}, or one outside the caller scope (the two are not told apart; never 403 on an id).`)

const bytes = (description: string, types: string[]) => ({
  description,
  headers: {
    'X-Content-Type-Options': { description: 'Always `nosniff`.', schema: { type: 'string' as const } },
    'Cache-Control': { description: 'Always `no-store`.', schema: { type: 'string' as const } },
    'Content-Disposition': { description: '`inline`; the original is `attachment; filename="..."`.', schema: { type: 'string' as const } },
  },
  content: Object.fromEntries(types.map((t) => [t, { schema: { type: 'string' as const, format: 'binary' } }])),
})
const IMAGE_TYPES = ['image/webp', 'image/png', 'image/jpeg']

/**
 * Registers the BE-37 routes (10). Paths are relative to the `/api` server. [PROPOSED] unless the card
 * names them (the card names create, upload, list, get, page image, thumb, figure image, original and
 * cancel); `GET /intake/files/{id}/pages` carries the page text and blocks the review UI needs.
 */
export function registerIntakeFilesPaths(registry: OpenAPIRegistry): void {
  const tags = ['intake']

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/batches',
    tags,
    summary: 'Create a submission with its declaration',
    description: `Card BE-37 (prototype createIntakeBatch). ${ROLES} Status starts \`submitted\` (${INTAKE_BATCH_STATUS_LABELS.submitted}); files are added with POST /intake/batches/{id}/files. A teacher may have a limited number of open batches (INTAKE_MAX_ACTIVE_BATCHES; Admin Pusat exempt): over it is 429 RATE_LIMITED. \`declaration\` must be \`true\`.`,
    request: { headers: csrf, body: { required: true, content: { 'application/json': { schema: IntakeBatchCreateSchema } } } },
    responses: {
      201: json(IntakeBatchSummaryEnvelopeSchema, 'The new submission.'),
      401: unauthorized,
      403: forbidden,
      413: err('PAYLOAD_TOO_LARGE: the JSON body is too large.'),
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/batches',
    tags,
    summary: 'List submissions (paginated)',
    description: `Card BE-37 (prototype listIntakeBatches). ${ROLES} A Guru sees own batches only; Admin Pusat sees all. Newest first; page size 20 (max 100).`,
    request: { query: IntakeBatchListQuerySchema },
    responses: {
      200: json(IntakeBatchListResponseSchema, 'A page of submissions.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/batches/{id}',
    tags,
    summary: 'One submission with its files and per-file progress',
    description: `Card BE-37 (prototype getIntakeBatch). ${ROLES} The client polls this while \`status\` is submitted or processing.`,
    request: { params: idParams },
    responses: {
      200: json(IntakeBatchDetailEnvelopeSchema, 'The submission.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('batch'),
    },
  })

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/batches/{id}/files',
    tags,
    summary: 'Upload one or more PDF files to a submission',
    description:
      `Card BE-37. ${ROLES} multipart/form-data, parts named \`files\` (PDF only). The type is decided from the content (magic bytes), never the name. All-or-nothing: if any file is refused nothing is stored (422, \`fields.files\`, one BM message). Refusals: "${INTAKE_FILE_MESSAGES.type}", "${INTAKE_FILE_MESSAGES.size(20)}" (INTAKE_MAX_FILE_MB), "${INTAKE_FILE_MESSAGES.pages(200)}" (OCR_MAX_PAGES), "${INTAKE_FILE_MESSAGES.encrypted}", "${INTAKE_FILE_MESSAGES.corrupt}", "${INTAKE_FILE_MESSAGES.tooComplex}", "${INTAKE_FILE_MESSAGES.duplicate}" (same hash as a file in another batch that is not failed or cancelled), "${INTAKE_FILE_MESSAGES.tooManyFiles(10)}" [PROPOSED copy]. ` +
      `A batch that no longer accepts files (cancelled, failed, or already processed) is 409 CONFLICT "${INTAKE_FILE_MESSAGES.batchClosed}". Over the daily page quota (INTAKE_DAILY_PAGE_QUOTA; Admin Pusat exempt) is 429 RATE_LIMITED "${INTAKE_FILE_MESSAGES.quota}". On success processing is queued and the batch becomes \`processing\`; the response lists the stored files.`,
    request: {
      headers: csrf,
      params: idParams,
      body: { required: true, content: { 'multipart/form-data': { schema: IntakeUploadMultipartSchema } } },
    },
    responses: {
      201: json(IntakeUploadResultEnvelopeSchema, 'The stored files.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('batch'),
      409: err(`CONFLICT "${INTAKE_FILE_MESSAGES.batchClosed}": the batch no longer accepts files.`),
      413: err('PAYLOAD_TOO_LARGE: the request is over the body limit (nginx may answer first).'),
      422: invalid,
    },
  })

  registerIntakeRoute(registry, {
    method: 'post',
    path: '/intake/batches/{id}/cancel',
    tags,
    summary: 'Cancel a submission and its pending jobs',
    description: `Card BE-37. ${ROLES} Queued and running jobs of the batch are cancelled; status becomes \`cancelled\` (${INTAKE_BATCH_STATUS_LABELS.cancelled} [PROPOSED]). Idempotent on a batch that is already cancelled (200). A batch that is \`ready_for_review\` or \`failed\` cannot be cancelled: 409 CONFLICT. The request body is empty.`,
    request: { headers: csrf, params: idParams },
    responses: {
      200: json(IntakeBatchDetailEnvelopeSchema, 'The batch after cancellation.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('batch'),
      409: err('CONFLICT: the batch has already finished (ready_for_review or failed).'),
    },
  })

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/files/{id}/pages',
    tags,
    summary: 'Pages of a file: text, source, blocks, figures, status',
    description: `[PROPOSED] Gives the review UI what the prototype OCR produced client-side (PageText, blocks). ${ROLES} The page image is a separate route; \`hasImage\` says whether it exists.`,
    request: { params: idParams },
    responses: {
      200: json(IntakePageListEnvelopeSchema, 'All pages, in page order.'),
      401: unauthorized,
      403: forbidden,
      404: notFound('file'),
    },
  })

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/files/{id}/pages/{n}/image',
    tags,
    summary: 'Rendered page image',
    description: `Card BE-37. ${ROLES} Authenticated and scope-checked; there is no public URL. Stored Content-Type, \`nosniff\`, \`no-store\`. A page without an image is 404. Rate limited per user.`,
    request: { params: pageParams },
    responses: {
      200: bytes('The page image.', IMAGE_TYPES),
      401: unauthorized,
      403: forbidden,
      404: notFound('page'),
    },
  }, true)

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/files/{id}/pages/{n}/thumb',
    tags,
    summary: 'Page thumbnail',
    description: `Card BE-37. ${ROLES} Same rules as the page image; 240 px wide.`,
    request: { params: pageParams },
    responses: {
      200: bytes('The thumbnail.', IMAGE_TYPES),
      401: unauthorized,
      403: forbidden,
      404: notFound('page'),
    },
  }, true)

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/figures/{id}/image',
    tags,
    summary: 'Figure crop image',
    description: `Card BE-37. ${ROLES} Same rules as the page image.`,
    request: { params: idParams },
    responses: {
      200: bytes('The figure crop.', IMAGE_TYPES),
      401: unauthorized,
      403: forbidden,
      404: notFound('figure'),
    },
  }, true)

  registerIntakeRoute(registry, {
    method: 'get',
    path: '/intake/files/{id}/original',
    tags,
    summary: 'Download the stored original PDF',
    description: `Card BE-37 (replaces the mock GET /api/question-submissions/:id/files/:index). ${ROLES} \`Content-Disposition: attachment; filename="<sanitised>.pdf"\`, \`application/pdf\`, \`nosniff\`. Anyone else gets 404.`,
    request: { params: idParams },
    responses: {
      200: bytes('The PDF bytes.', ['application/pdf']),
      401: unauthorized,
      403: forbidden,
      404: notFound('file'),
    },
  }, true)
}
