import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { AUTH_ERROR_MESSAGES } from '../auth/errors'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { FilePurposeSchema, FileRefSchema, UploadFileMultipartSchema, UploadFileQuerySchema } from './schema'

/** Components contributed by BE-04; appended to COMPONENT_SCHEMAS in openapi.ts. */
export const FILES_COMPONENT_SCHEMAS = {
  FilePurpose: FilePurposeSchema,
  FileRef: FileRefSchema,
  UploadFileQuery: UploadFileQuerySchema,
  UploadFileMultipartRequest: UploadFileMultipartSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const limited = {
  ...err(`RATE_LIMITED "${AUTH_ERROR_MESSAGES.RATE_LIMITED}" with retryAfter and the Retry-After header (D57a).`),
  headers: {
    'Retry-After': { description: 'Seconds until a retry is allowed.', schema: { type: 'integer' as const, minimum: 1 } },
  },
}

/** Registers the three `/files` routes. */
export function registerFilesPaths(registry: OpenAPIRegistry): void {
  const csrf = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
  })
  const unauthorized = err('UNAUTHORIZED (no valid session).')
  const forbidden = err('FORBIDDEN: the active role may not upload this purpose, or CSRF_INVALID.')
  const notFound = err('NOT_FOUND: unknown id, or a file the caller may not see.')
  const idParam = z.object({ id: IdSchema })

  registry.registerPath({
    method: 'post',
    path: '/files',
    tags: ['files'],
    summary: 'Upload one file',
    description:
      'multipart/form-data, one part `file`; query `purpose`. The type is decided from the content (magic bytes), never the name or header. Raster images are stored with metadata (EXIF GPS, text chunks) removed, so `size` is the stored size. Role per purpose: avatar any signed-in role; bijak_photo student; question_image admin or teacher; cms_image admin; audio_kbat admin (mp3, m4a, wav, ogg, 20 MB); cms_screenshot admin. Limits per purpose are in FILE_PURPOSE_RULES (avatar 2048 KB jpeg/png/webp; bijak_photo 5 MB jpeg/png), capped by MAX_UPLOAD_MB. A wrong type or an oversize file is 422 `fields.file`. Rate limited per user.',
    request: {
      headers: csrf,
      query: UploadFileQuerySchema,
      body: { required: true, content: { 'multipart/form-data': { schema: UploadFileMultipartSchema } } },
    },
    responses: {
      201: json(envelopeOf(FileRefSchema), 'The stored file.'),
      401: unauthorized,
      403: forbidden,
      422: err('VALIDATION_ERROR: fields.file (missing, wrong type, oversize) or fields.purpose (unknown).'),
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/files/{id}',
    tags: ['files'],
    summary: 'Download a file',
    description:
      'Bytes with the stored Content-Type, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache` (cms_image: `private, max-age=300`) and Content-Disposition. The id is the opaque token from FileRef. Every read is checked by purpose AND ownership and fails closed: bijak_photo the owner only; question_image staff only (admin, teacher); avatar the owner, admin, and school_admin or ppd_officer whose scope covers the owner (a teacher gets 404 until class membership exists, BE-17; classmates are not entitled here); cms_image public (interim, until BE-24 publish gating); audio_kbat and cms_screenshot admin only, fail closed (students play audio only through GET /audio-kbat-sets/{id}/sections/{no}/audio); derived intake files the owner or admin. Anyone else, an unknown id and a malformed token are all 404 (never 403). Rate limited per user (anonymous cms_image reads per address): 429.',
    request: { params: idParam },
    responses: {
      200: {
        description: 'The file bytes.',
        content: { 'image/*': { schema: { type: 'string' as const, format: 'binary' } } },
      },
      401: unauthorized,
      404: notFound,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/files/{id}',
    tags: ['files'],
    summary: 'Delete an own file',
    request: { headers: csrf, params: idParam },
    responses: { 204: { description: 'Deleted.' }, 401: unauthorized, 403: forbidden, 404: notFound, 429: limited },
  })
}
