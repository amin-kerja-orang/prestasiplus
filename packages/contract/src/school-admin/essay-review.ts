import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { listEnvelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'

/**
 * Tanda Karangan, "semakan AI" (V2 Panel `/spm/tanda-karangan`, `EssayReviewController`). The AI proposes a mark for an essay
 * answer; school staff see the question, the scheme, the pupil's answer and the proposal, then confirm or adjust the mark
 * ("Sahkan"). The mark counts only once a person confirmed it. The queue is the proposals that are still `pending`.
 *
 * Two doors to the same data. `/admin-sekolah/tanda-karangan` is the school admin: the school comes from the session, never from
 * the request. `/admin/spm/tanda-karangan` is Admin Pusat (the national admin): every school. Any other role is 403.
 */

/** One pending proposal. The essay is child data: `no-store`, never logged. */
export const EssayReviewRowSchema = z
  .object({
    id: IdSchema,
    student: z.string().meta({ description: 'The pupil name, or an em dash.' }),
    questionNo: z.string().nullable(),
    stem: z.string().meta({ description: 'Plain text.' }),
    marks: z.number().int().min(0).meta({ description: 'The maximum mark of the part.' }),
    proposed: z.number().int().min(0).nullable().meta({ description: 'The AI proposal; null when it gave none.' }),
    rationale: z.string(),
    points: z.array(z.object({ id: z.number().optional(), covered: z.boolean().optional(), awarded: z.number().optional() })),
    scheme: z.array(z.string()),
    essay: z.string().meta({ description: "The pupil's answer." }),
  })
  .meta({ id: 'EssayReviewRow' })
export type EssayReviewRow = z.infer<typeof EssayReviewRowSchema>

/** `meta.totalItems` is the number waiting ("N menunggu"). */
export const EssayReviewListResponseSchema = listEnvelopeOf(EssayReviewRowSchema).meta({ id: 'EssayReviewListResponse' })
export type EssayReviewListResponse = z.infer<typeof EssayReviewListResponseSchema>

export const EssayReviewConfirmRequestSchema = z
  .object({ marks: z.number().int().min(0).max(65535) })
  .meta({ id: 'EssayReviewConfirmRequest' })
export type EssayReviewConfirmRequest = z.infer<typeof EssayReviewConfirmRequestSchema>

export const EssayReviewConfirmResultSchema = z
  .object({
    data: z.object({ id: IdSchema, finalMarks: z.number().int().min(0).meta({ description: 'The mark kept: the request clamped to the part maximum.' }) }),
    status: z.string().min(1).meta({ description: 'Markah karangan disahkan.' }),
  })
  .meta({ id: 'EssayReviewConfirmResult' })
export type EssayReviewConfirmResult = z.infer<typeof EssayReviewConfirmResultSchema>

/** Copy of the page, exactly as V2. */
export const ESSAY_REVIEW_COPY = {
  title: 'Tanda Karangan',
  heading: 'Tanda Karangan (semakan AI)',
  intro: 'AI mencadangkan markah untuk setiap karangan berdasarkan skema. Sahkan atau laraskan — markah hanya dikira setelah cikgu mengesahkan.',
  empty: 'Tiada karangan menunggu semakan.',
  confirmed: 'Markah karangan disahkan.',
} as const

export const ESSAY_REVIEW_COMPONENT_SCHEMAS = {
  EssayReviewRow: EssayReviewRowSchema,
  EssayReviewListResponse: EssayReviewListResponseSchema,
  EssayReviewConfirmRequest: EssayReviewConfirmRequestSchema,
  EssayReviewConfirmResult: EssayReviewConfirmResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const IdParams = z.object({ id: IdSchema.meta({ description: 'Digits only.' }) })
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }) })
const ListQuery = z.object({ page: z.coerce.number().int().min(1).optional() })
const NO_STORE_HEADERS = { 'Cache-Control': { description: "no-store (the body holds pupils' work).", schema: { type: 'string' as const } } }
const UNAUTHORIZED = err('UNAUTHORIZED "Sesi anda telah tamat. Sila log masuk semula." (no valid session).')
const FORBIDDEN = err('FORBIDDEN "Anda tidak dibenarkan melakukan tindakan ini." (role is neither school_admin nor admin, or a school admin without a school), or CSRF_INVALID on the POST.')
const RATE_LIMITED = err('RATE_LIMITED "Terlalu banyak percubaan. Sila cuba sebentar lagi." with error.retryAfter in seconds.')

export function registerEssayReviewPaths(registry: OpenAPIRegistry): void {
  for (const base of ['/admin-sekolah/tanda-karangan', '/admin/spm/tanda-karangan']) {
    const who = base.startsWith('/admin-sekolah') ? 'the school of the session' : 'every school'
    registry.registerPath({
      method: 'get',
      path: base,
      tags: ['essay-review'],
      summary: 'Essays waiting for a person to confirm the AI mark',
      description: `Proposals with status pending of ${who}, newest first, 20 per page; meta.totalItems is the count waiting. Sent with Cache-Control: no-store. Rate limited (429).`,
      request: { query: ListQuery },
      responses: { 200: { ...json(EssayReviewListResponseSchema, 'The waiting proposals (empty list when none).'), headers: NO_STORE_HEADERS }, 401: UNAUTHORIZED, 403: FORBIDDEN, 429: RATE_LIMITED },
    })
    registry.registerPath({
      method: 'post',
      path: `${base}/{id}/sahkan`,
      tags: ['essay-review'],
      summary: 'Confirm or adjust the mark of one essay',
      description: `Records the final mark (clamped to the part maximum), who confirmed it and when. Scope: ${who}; a proposal outside it is indistinguishable from an unknown id (404). A confirmed proposal can be adjusted again. Rate limited (429).`,
      request: { params: IdParams, headers: [csrf], body: { content: { 'application/json': { schema: EssayReviewConfirmRequestSchema } } } },
      responses: {
        200: json(EssayReviewConfirmResultSchema, 'Confirmed; status "Markah karangan disahkan.".'),
        401: UNAUTHORIZED,
        403: FORBIDDEN,
        404: err('NOT_FOUND (unknown id or outside the scope).'),
        422: err('VALIDATION_ERROR: marks is required, an integer from 0 to 65535.'),
        429: RATE_LIMITED,
      },
    })
  }
}
