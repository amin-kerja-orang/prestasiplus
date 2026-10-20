import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { QUESTION_WORKFLOW_IMAGE_MAX_BYTES, questionWorkflowFile, questionWorkflowMutationOf } from './common'

/**
 * Diagram audit, S11 "Soalan Perlu Gambar Rajah" (mock `handlers/diagram-audit.ts`, SRS BR-M04-19,
 * FR-M04-95 to 101). Routes: `GET /diagram-audit`, `POST /diagram-audit/{kind}/{id}/image`,
 * `POST /diagram-audit/{kind}/{id}/dismiss`. Admin only. Image storage is BE-04.
 *
 * Difference from the mock: ids are strings (UD-1).
 */

export const DIAGRAM_AUDIT_MESSAGES = {
  fileRequired: 'Sila pilih fail gambar.',
  fileType: 'Gambar mesti jenis JPG, PNG, WebP atau GIF dan tidak melebihi 2MB.',
  uploaded: 'Gambar rajah berjaya dimuat naik.',
  dismissed: 'Soalan telah dikeluarkan daripada senarai audit.',
} as const

export const DIAGRAM_AUDIT_PAGE_SIZE = 20
/** Longer structured text is cut at this length plus "..." (FR-M04-98). */
export const DIAGRAM_AUDIT_EXCERPT_LENGTH = 400
/** Number of subject pills in `meta.bySubject`. */
export const DIAGRAM_AUDIT_PILL_COUNT = 10
/** JPG, PNG, WebP or GIF; SVG and every other type are refused (SEC-M04-02). */
export const DIAGRAM_AUDIT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export const DIAGRAM_AUDIT_KINDS = ['mcq', 'structured'] as const
export const DiagramAuditKindSchema = z
  .enum(DIAGRAM_AUDIT_KINDS)
  .meta({ id: 'DiagramAuditKind', description: 'mcq = objective question, structured = subjective question. Any other value does not match the route (404).' })

/**
 * Query. `subjectId` filters both lists, `schoolId` the MCQ list only (creators who are teachers,
 * school admins or admins of that school). A malformed or unknown filter matches nothing.
 * `mcqPage` / `strPage`: invalid means 1. Page size is fixed at 20.
 */
export const DiagramAuditQuerySchema = z
  .object({
    subjectId: IdSchema.optional(),
    schoolId: IdSchema.optional(),
    mcqPage: z.coerce.number().int().min(1).optional(),
    strPage: z.coerce.number().int().min(1).optional(),
  })
  .meta({ id: 'DiagramAuditQuery' })

const DiagramRef = z.strictObject({ id: IdSchema, name: z.string() })
const CreatedBy = z.strictObject({ id: IdSchema, name: z.string().nullable() })

export const DiagramAuditMcqItemSchema = z
  .strictObject({
    id: IdSchema,
    questionText: z.string(),
    subject: DiagramRef.nullable(),
    createdBy: CreatedBy,
    sourceFile: z.string().nullable(),
    sourcePage: z.number().int().nullable(),
  })
  .meta({ id: 'DiagramAuditMcqItem' })

export const DiagramAuditStructuredItemSchema = z
  .strictObject({
    id: IdSchema,
    stimulusExcerpt: z.string(),
    subject: DiagramRef.nullable(),
    createdBy: CreatedBy,
    sourceFile: z.string().nullable(),
    sourcePage: z.number().int().nullable(),
  })
  .meta({ id: 'DiagramAuditStructuredItem' })

/** Pager of one list: `from` / `to` are 1-based and `null` on an empty page. */
export const DiagramAuditPageMetaSchema = z
  .strictObject({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(1),
    from: z.number().int().min(1).nullable(),
    to: z.number().int().min(1).nullable(),
  })
  .meta({ id: 'DiagramAuditPageMeta' })

export const DiagramAuditMetaSchema = z
  .strictObject({
    stats: z.strictObject({
      mcq: z.number().int().min(0),
      structured: z.number().int().min(0),
      total: z.number().int().min(0),
    }).meta({ description: 'The stat cards, under the active filters.' }),
    bySubject: z
      .array(z.strictObject({ name: z.string(), count: z.number().int().min(1) }))
      .max(DIAGRAM_AUDIT_PILL_COUNT)
      .meta({ description: 'Top 10 subjects by flagged MCQ count, global under every filter; ties by id.' }),
    unfilteredMcq: z.number().int().min(0).meta({ description: 'Flagged MCQ count without filters (the SHU badge).' }),
  })
  .meta({ id: 'DiagramAuditMeta' })

/**
 * Body of `GET /diagram-audit`: `data` holds both lists (id descending) and `meta` the aggregates,
 * NOT the standard list meta (mock `ok(data, { meta })`).
 */
export const DiagramAuditResponseSchema = z
  .strictObject({
    data: z.strictObject({
      mcq: z.strictObject({ items: z.array(DiagramAuditMcqItemSchema), meta: DiagramAuditPageMetaSchema }),
      structured: z.strictObject({ items: z.array(DiagramAuditStructuredItemSchema), meta: DiagramAuditPageMetaSchema }),
    }),
    meta: DiagramAuditMetaSchema,
  })
  .meta({ id: 'DiagramAuditResponse' })
export type DiagramAuditResponse = z.infer<typeof DiagramAuditResponseSchema>

const image = questionWorkflowFile({
  maxBytes: QUESTION_WORKFLOW_IMAGE_MAX_BYTES,
  mimes: DIAGRAM_AUDIT_IMAGE_MIME_TYPES,
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  description: 'JPG, PNG, WebP or GIF (SVG refused), at most 2 MB. Storage: BE-04.',
})

/** Body of `POST /diagram-audit/{kind}/{id}/image`, `multipart/form-data`. 422 `fields.image`: missing or not an image "Sila pilih fail gambar."; wrong type or size "Gambar mesti jenis JPG, PNG, WebP atau GIF dan tidak melebihi 2MB.". */
export const DiagramAuditImageRequestSchema = z.object({ image }).meta({ id: 'DiagramAuditImageRequest' })

export const DiagramAuditResultSchema = z
  .strictObject({ id: IdSchema, needsDiagram: z.literal(false) })
  .meta({ id: 'DiagramAuditResult' })

/** 200 body of image and dismiss `{ data: { id, needsDiagram: false }, status }`. */
export const DiagramAuditMutationSchema = questionWorkflowMutationOf(DiagramAuditResultSchema).meta({
  id: 'DiagramAuditMutation',
})
