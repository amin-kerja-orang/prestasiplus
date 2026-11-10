import { z } from '../../zod'
import { IdSchema } from '../../common/ids'

/**
 * Kertas Subjektif page-image documents (V2 parity, migration 0265): a subjective past paper (Kertas 2/3/4) served as page images with a
 * revealable marking scheme. These are the V2 `paper_documents` / `paper_document_pages` (V2 routes `/kertas-subjektif`,
 * `/kertas-subjektif/{paper}`, `/admin/kertas-subjektif`, `/admin/kertas-subjektif/{paper}/terbit`). They sit beside the question-based
 * Kertas Subjektif papers (`/bijak/papers?surface=subjektif`) in one pupil list and one admin list.
 *
 * Serving whitelist (as V2): a pupil reads PUBLISHED documents only and only their page images (`/api/files/{token}`, purpose `kertas_page`).
 * Nothing here carries an answer key: the scheme is page images the pupil reveals on screen after trying the paper.
 */

export const KERTAS_DOKUMEN_MESSAGES = {
  notFound: 'Kertas tidak ditemui',
  published: '“{title}” kini diterbitkan.',
  hidden: '“{title}” disembunyikan daripada pelajar.',
  noPages: '“{title}” tiada halaman — tidak boleh diterbitkan.',
} as const

export const KERTAS_DOKUMEN_KERTAS = [2, 3, 4] as const

const Kertas = z.number().int().min(2).max(4).meta({ description: 'Kertas 2, 3 or 4.', example: 2 })

/** A document row as a pupil lists it. */
export const KertasDokumenSummarySchema = z
  .strictObject({
    id: IdSchema,
    title: z.string().min(1),
    subject: z.string().nullable().meta({ description: 'Subject code; null = "Lain-lain" (V2 group name).' }),
    subjectName: z.string().nullable(),
    kertas: Kertas,
    negeri: z.string().nullable().meta({ description: 'Negeri or board label as printed (free text).' }),
    year: z.number().int().nullable(),
    pageCount: z.number().int().min(0).meta({ description: 'Pages of the question paper (`m/s`).' }),
    schemePageCount: z.number().int().min(0),
    marks: z.number().int().nullable().meta({ description: '`markah`; null = not stated.' }),
    durationMinutes: z.number().int().nullable().meta({ description: '`min`; null = not stated.' }),
  })
  .meta({ id: 'KertasDokumenSummary' })
export type KertasDokumenSummary = z.infer<typeof KertasDokumenSummarySchema>

export const KertasDokumenPageSchema = z
  .strictObject({
    position: z.number().int().min(1),
    url: z.string().min(1).meta({ description: 'Relative `/api/files/{token}`; the file read rule admits the page while the document is published.' }),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
  })
  .meta({ id: 'KertasDokumenPage' })
export type KertasDokumenPage = z.infer<typeof KertasDokumenPageSchema>

/** One document with its pages (pupil view and the admin preview). */
export const KertasDokumenSchema = KertasDokumenSummarySchema.extend({
  paperPages: z.array(KertasDokumenPageSchema),
  schemePages: z.array(KertasDokumenPageSchema),
}).meta({ id: 'KertasDokumen' })
export type KertasDokumen = z.infer<typeof KertasDokumenSchema>

export const KERTAS_DOKUMEN_STATUSES = ['draf', 'terbit'] as const
export const KertasDokumenStatusSchema = z.enum(KERTAS_DOKUMEN_STATUSES).meta({ id: 'KertasDokumenStatus' })
export type KertasDokumenStatus = z.infer<typeof KertasDokumenStatusSchema>

/** An admin row: the summary plus the publish state. */
export const KertasDokumenAdminRowSchema = KertasDokumenSummarySchema.extend({
  status: KertasDokumenStatusSchema,
}).meta({ id: 'KertasDokumenAdminRow' })
export type KertasDokumenAdminRow = z.infer<typeof KertasDokumenAdminRowSchema>

export const KertasDokumenAdminDetailSchema = KertasDokumenSchema.extend({
  status: KertasDokumenStatusSchema,
}).meta({ id: 'KertasDokumenAdminDetail' })
export type KertasDokumenAdminDetail = z.infer<typeof KertasDokumenAdminDetailSchema>

/** `GET /admin/kertas-dokumen` query (the V2 filters: subject, kertas, status; 30 per page in V2). */
export const KertasDokumenAdminQuerySchema = z
  .strictObject({
    subject: z.string().trim().min(1).max(32).optional().meta({ description: 'Subject code.' }),
    kertas: z.coerce.number().int().min(2).max(4).optional(),
    status: KertasDokumenStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
  })
  .meta({ id: 'KertasDokumenAdminQuery' })
export type KertasDokumenAdminQuery = z.infer<typeof KertasDokumenAdminQuerySchema>

/** The three tiles of V2 (`Jumlah Kertas`, `Diterbitkan`, `Ada Skema`), over the whole set (the filters are ignored). */
export const KertasDokumenCountsSchema = z
  .strictObject({ total: z.number().int().min(0), published: z.number().int().min(0), withScheme: z.number().int().min(0) })
  .meta({ id: 'KertasDokumenCounts' })
export type KertasDokumenCounts = z.infer<typeof KertasDokumenCountsSchema>

export const KertasDokumenAdminListSchema = z
  .strictObject({
    rows: z.array(KertasDokumenAdminRowSchema),
    total: z.number().int().min(0).meta({ description: 'Rows matching the filters (all pages).' }),
    counts: KertasDokumenCountsSchema,
  })
  .meta({ id: 'KertasDokumenAdminList' })
export type KertasDokumenAdminList = z.infer<typeof KertasDokumenAdminListSchema>

export const KertasDokumenToggleResultSchema = z
  .strictObject({ id: IdSchema, title: z.string(), status: KertasDokumenStatusSchema })
  .meta({ id: 'KertasDokumenToggleResult' })
export type KertasDokumenToggleResult = z.infer<typeof KertasDokumenToggleResultSchema>
