import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { ListMetaSchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { registerRoute } from '../ai/rate-limit'
import { IntakePaperTypeSchema } from './files'

/**
 * Sumber Kertas (card S2-T09, PRD30 R1-ADM-Q-19, PRD60 API-Q-23). A read-only registry over the Admin Pusat intake batches that
 * carry a Tahun (D115: no `migrated` source in R1). Guru batches (Kiriman Guru) are never listed. The id of a row is the batch id.
 */

export const SOURCE_PAPER_PAGE_SIZE = 25
export const SOURCE_PAPER_SOURCE_LABEL = 'Import (PDF/DOCX)'

/** BM copy of the screen (PRD30 R1-ADM-Q-19). */
export const SOURCE_PAPER_MESSAGES = {
  title: 'Sumber Kertas',
  subtitle: 'Registri provenance kertas peperiksaan',
  detailTitle: 'Butiran Sumber Kertas',
  back: '← Kembali ke Sumber Kertas',
  empty: 'Tiada kertas dijumpai.',
  emptyQuestions: 'Belum ada soalan diimport untuk kertas ini.',
  notFound: 'Kertas tidak dijumpai.',
} as const

export const SourcePaperListQuerySchema = z
  .strictObject({
    q: z.string().trim().max(200).optional(),
    subject: z.string().trim().min(1).max(32).optional().meta({ description: 'Subject code (upper-case).' }),
    year: z.coerce.number().int().min(1900).max(2100).optional(),
    negeri: z.string().trim().min(1).max(100).optional().meta({ description: 'Negeri / badan, matched case-insensitively.' }),
    kertas: z.coerce.number().int().min(1).max(4).optional(),
    jenis: IntakePaperTypeSchema.optional().meta({ description: 'Jenis = the batch paper type.' }),
    needsReview: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true' || v === '1'))
      .meta({ type: 'string', enum: ['true', 'false'], description: 'true = only papers that need review.' }),
    page: z.coerce.number().int().min(1).default(1),
  })
  .meta({ id: 'SourcePaperListQuery', description: `[PROPOSED] Filters of GET /admin/source-papers. ${SOURCE_PAPER_PAGE_SIZE} per page, newest year first.` })
export type SourcePaperListQuery = z.infer<typeof SourcePaperListQuerySchema>

export const SourcePaperRowSchema = z
  .strictObject({
    id: IdSchema.meta({ description: 'The batch id.' }),
    title: z.string(),
    subject: z.string().meta({ description: 'Subject code.' }),
    subjectName: z.string().nullable().optional(),
    year: z.number().int(),
    kertas: z.number().int().min(1).max(4).nullable(),
    negeri: z.string().nullable().meta({ description: 'Negeri / badan; null renders as "—".' }),
    paperType: IntakePaperTypeSchema.meta({ description: 'Jenis.' }),
    questions: z.number().int().min(0).meta({ description: 'Bilangan Soalan: accepted items that became a question.' }),
    source: z.literal('intake'),
    sourceLabel: z.string(),
    needsReview: z.boolean().meta({ description: 'Any open item (generated, needs_review, duplicate) or batch status failed.' }),
    hasScheme: z.boolean().meta({ description: 'At least one question, and every one has a key or scheme on all its leaves.' }),
    batchId: IdSchema,
  })
  .meta({ id: 'SourcePaperRow', description: '[PROPOSED] One registry row. Badge: needsReview -> Perlu Semakan, else !hasScheme -> Skema, else OK.' })
export type SourcePaperRow = z.infer<typeof SourcePaperRowSchema>

export const SourcePaperSubjectOptionSchema = z.strictObject({ code: z.string(), name: z.string().nullable() }).meta({ id: 'SourcePaperSubjectOption' })

export const SourcePaperListMetaSchema = ListMetaSchema.extend({
  totalPapers: z.number().int().min(0).meta({ description: 'Tile Jumlah Kertas (whole registry, filters ignored).' }),
  needsReviewCount: z.number().int().min(0).meta({ description: 'Tile Perlu Semakan (whole registry, filters ignored).' }),
  options: z.strictObject({
    years: z.array(z.number().int()),
    negeri: z.array(z.string()),
    subjects: z.array(SourcePaperSubjectOptionSchema),
  }),
}).meta({ id: 'SourcePaperListMeta' })
export type SourcePaperListMeta = z.infer<typeof SourcePaperListMetaSchema>

export const SourcePaperListResponseSchema = z
  .object({ data: z.array(SourcePaperRowSchema), meta: SourcePaperListMetaSchema })
  .meta({ id: 'SourcePaperListResponse' })
export type SourcePaperListResponse = z.infer<typeof SourcePaperListResponseSchema>

export const SourcePaperIssueSchema = z
  .strictObject({
    itemId: IdSchema.nullable(),
    where: z.string(),
    message: z.string(),
  })
  .meta({ id: 'SourcePaperIssue', description: '[PROPOSED] Isu Import: a failed batch or file, or an item still open.' })
export type SourcePaperIssue = z.infer<typeof SourcePaperIssueSchema>

export const SourcePaperQuestionSchema = z
  .strictObject({
    no: z.string().meta({ description: 'Printed question number.' }),
    questionId: IdSchema,
    excerpt: z.string().meta({ description: 'Stem cut at 120 characters with "...".' }),
    parts: z.number().int().min(0).meta({ description: 'Bilangan Bahagian.' }),
  })
  .meta({ id: 'SourcePaperQuestion' })
export type SourcePaperQuestion = z.infer<typeof SourcePaperQuestionSchema>

export const SourcePaperDetailSchema = SourcePaperRowSchema.extend({
  fileNames: z.array(z.string()).meta({ description: 'Fail: the stored source file names.' }),
  issues: z.array(SourcePaperIssueSchema),
  questionList: z.array(SourcePaperQuestionSchema),
}).meta({ id: 'SourcePaperDetail', description: '[PROPOSED] The facts of Q-19, the import issues and the imported questions.' })
export type SourcePaperDetail = z.infer<typeof SourcePaperDetailSchema>

export const SourcePaperDetailEnvelopeSchema = z.object({ data: SourcePaperDetailSchema }).meta({ id: 'SourcePaperDetailEnvelope' })

export const SOURCE_PAPERS_COMPONENT_SCHEMAS = {
  SourcePaperListQuery: SourcePaperListQuerySchema,
  SourcePaperRow: SourcePaperRowSchema,
  SourcePaperSubjectOption: SourcePaperSubjectOptionSchema,
  SourcePaperListMeta: SourcePaperListMetaSchema,
  SourcePaperListResponse: SourcePaperListResponseSchema,
  SourcePaperIssue: SourcePaperIssueSchema,
  SourcePaperQuestion: SourcePaperQuestionSchema,
  SourcePaperDetail: SourcePaperDetailSchema,
  SourcePaperDetailEnvelope: SourcePaperDetailEnvelopeSchema,
} as const

export const SOURCE_PAPERS_TAG = 'source-papers'

const NO_STORE = {
  'Cache-Control': { description: 'no-store.', schema: { type: 'string' as const, enum: ['no-store'] } },
}
const err = (description: string) => ({ description, content: { 'application/json': { schema: ErrorBodySchema } } })
const ROLE_NOTE = 'Admin Pusat only (role code `admin`); every other role gets 403, no session 401. Read-only: GET only, no CSRF.'

export function registerSourcePapersPaths(registry: OpenAPIRegistry): void {
  registerRoute(
    registry,
    {
      method: 'get',
      path: '/admin/source-papers',
      tags: [SOURCE_PAPERS_TAG],
      summary: 'Sumber Kertas: registry of intake papers with Tahun',
      description: `Admin intake batches that carry a Tahun; guru batches are excluded. Negeri is read from the linked source paper until intake_batches.exam_board exists (DM-85). ${ROLE_NOTE}`,
      request: { query: SourcePaperListQuerySchema },
      responses: {
        200: { description: 'One page (25) with the tile totals and the filter options.', headers: NO_STORE, content: { 'application/json': { schema: SourcePaperListResponseSchema } } },
        401: err('UNAUTHORIZED (no valid session).'),
        403: err('FORBIDDEN (the active role is not Admin Pusat).'),
        422: err('VALIDATION_ERROR (a filter is malformed).'),
      },
    },
    true,
  )
  registerRoute(
    registry,
    {
      method: 'get',
      path: '/admin/source-papers/{id}',
      tags: [SOURCE_PAPERS_TAG],
      summary: 'Butiran Sumber Kertas',
      description: `The facts, the import issues and the imported questions of one registry paper. ${ROLE_NOTE}`,
      request: { params: z.object({ id: IdSchema }) },
      responses: {
        200: { description: 'The paper.', headers: NO_STORE, content: { 'application/json': { schema: SourcePaperDetailEnvelopeSchema } } },
        401: err('UNAUTHORIZED (no valid session).'),
        403: err('FORBIDDEN (the active role is not Admin Pusat).'),
        404: err('NOT_FOUND (unknown id, a guru batch, or a batch without Tahun).'),
      },
    },
    true,
  )
}
