import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  KertasDokumenAdminDetailSchema,
  KertasDokumenAdminListSchema,
  KertasDokumenAdminQuerySchema,
  KertasDokumenAdminRowSchema,
  KertasDokumenCountsSchema,
  KertasDokumenPageSchema,
  KertasDokumenSchema,
  KertasDokumenStatusSchema,
  KertasDokumenSummarySchema,
  KertasDokumenToggleResultSchema,
} from './schema'

/** Components of the Kertas Subjektif documents (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const KERTAS_DOKUMEN_COMPONENT_SCHEMAS = {
  KertasDokumenSummary: KertasDokumenSummarySchema,
  KertasDokumenPage: KertasDokumenPageSchema,
  KertasDokumen: KertasDokumenSchema,
  KertasDokumenStatus: KertasDokumenStatusSchema,
  KertasDokumenAdminRow: KertasDokumenAdminRowSchema,
  KertasDokumenAdminDetail: KertasDokumenAdminDetailSchema,
  KertasDokumenAdminQuery: KertasDokumenAdminQuerySchema,
  KertasDokumenCounts: KertasDokumenCountsSchema,
  KertasDokumenAdminList: KertasDokumenAdminListSchema,
  KertasDokumenToggleResult: KertasDokumenToggleResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const IdParams = z.object({ id: IdSchema.meta({ description: 'Document id.' }) })
const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN = err('FORBIDDEN (the active role may not use this route).')
const NOT_FOUND = err('NOT_FOUND "Kertas tidak ditemui" (unknown id, or a document that is not published).')

/**
 * Registers the Kertas Subjektif document routes (V2 parity, 0265): the pupil list and view, the Admin Pusat list, preview and
 * Terbit/Sembunyi toggle. Every response body is `{ data }` or `{ error }`.
 */
export function registerKertasDokumenPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/bijak/kertas-dokumen',
    tags: ['kertas-dokumen'],
    summary: 'Kertas Subjektif page-image documents a pupil can open (published only)',
    description:
      'V2 `GET /kertas-subjektif`. Published documents only, ordered Kertas then Negeri; the screen groups them by subject beside the question-based papers. Student role (admin inside Mod Pelajar).',
    responses: { 200: json(envelopeOf(z.array(KertasDokumenSummarySchema)), 'Published documents.'), 401: UNAUTHORIZED, 403: FORBIDDEN },
  })

  registry.registerPath({
    method: 'get',
    path: '/bijak/kertas-dokumen/{id}',
    tags: ['kertas-dokumen'],
    summary: 'One published document with its paper and scheme page images',
    description: 'V2 `GET /kertas-subjektif/{paper}`. 404 for an unknown id or a Draf document (never serves an unpublished page). Student role.',
    request: { params: IdParams },
    responses: { 200: json(envelopeOf(KertasDokumenSchema), 'The document.'), 401: UNAUTHORIZED, 403: FORBIDDEN, 404: NOT_FOUND },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/kertas-dokumen',
    tags: ['kertas-dokumen'],
    summary: 'Admin list of every document with its publish state and the three tiles',
    description: 'V2 `GET /admin/kertas-subjektif`: filters subject, kertas, status; ordered subject, kertas, negeri. `counts` ignores the filters. Admin Pusat only.',
    request: { query: KertasDokumenAdminQuerySchema },
    responses: { 200: json(envelopeOf(KertasDokumenAdminListSchema), 'Documents.'), 401: UNAUTHORIZED, 403: FORBIDDEN, 422: err('VALIDATION_ERROR (a bad filter).') },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/kertas-dokumen/{id}',
    tags: ['kertas-dokumen'],
    summary: 'Admin preview of one document (any status)',
    description: 'The `Pratonton` link of V2: the same view a pupil gets, readable for a Draf document too. Admin Pusat only.',
    request: { params: IdParams },
    responses: { 200: json(envelopeOf(KertasDokumenAdminDetailSchema), 'The document.'), 401: UNAUTHORIZED, 403: FORBIDDEN, 404: NOT_FOUND },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/kertas-dokumen/{id}/terbit',
    tags: ['kertas-dokumen'],
    summary: 'Flip the publish state (Terbit / Sembunyi)',
    description:
      'V2 `POST /admin/kertas-subjektif/{paper}/terbit`. A published document is hidden; a Draf one is published only when it has at least one paper page, else 422 "“{title}” tiada halaman — tidak boleh diterbitkan.". Audited. Admin Pusat only; CSRF required.',
    request: { params: IdParams },
    responses: {
      200: json(envelopeOf(KertasDokumenToggleResultSchema), 'The new state.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      404: err('NOT_FOUND "Kertas tidak ditemui".'),
      422: err('VALIDATION_ERROR (no page: the title line above).'),
    },
  })
}
