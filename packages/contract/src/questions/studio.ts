import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'

/**
 * Admin Studio extras (R1-F03b, T13) that the stimulus API (T32, `./stimuli`) does not cover: the DSKP picker and the intake figure
 * link. Groups and stimuli themselves are T32's (D90).
 *
 * Registered by `registerStudioPaths` (REQ-C-006).
 */

/** `POST /intake/stimuli/:id/link-references`: the open items of the batch that name the figure and were linked to it now. */
export const StudioFigureLinksSchema = z
  .object({ stimulusId: IdSchema, linkedItemIds: z.array(IdSchema) })
  .meta({ id: 'StudioFigureLinks' })
export type StudioFigureLinks = z.infer<typeof StudioFigureLinksSchema>

/* ------------------------------------------------------------------------------------------------- DSKP picker */

export const StudioDskpSpSchema = z.object({ id: IdSchema, code: z.string(), title: z.string(), skCode: z.string().nullable() }).meta({ id: 'StudioDskpSp' })
export const StudioDskpUnitSchema = z
  .object({ id: IdSchema, code: z.string(), title: z.string(), sps: z.array(StudioDskpSpSchema) })
  .meta({ id: 'StudioDskpUnit' })
export const StudioDskpQuerySchema = z
  .object({ subjectId: IdSchema, educationLevelId: IdSchema })
  .meta({ id: 'StudioDskpQuery' })
export const StudioDskpSchema = z.object({ units: z.array(StudioDskpUnitSchema) }).meta({ id: 'StudioDskp' })
export type StudioDskp = z.infer<typeof StudioDskpSchema>

/** Components contributed by the Studio extras (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const STUDIO_COMPONENT_SCHEMAS = {
  StudioFigureLinks: StudioFigureLinksSchema,
  StudioDskpSp: StudioDskpSpSchema,
  StudioDskpUnit: StudioDskpUnitSchema,
  StudioDskpQuery: StudioDskpQuerySchema,
  StudioDskp: StudioDskpSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const csrf = z.object({ 'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }) })

export function registerStudioPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/questions/studio/dskp',
    tags: ['questions'],
    summary: 'DSKP picker of the Studio: units with their SP for a subject and level',
    description: 'Admin Pusat only, read only. Declared before `/questions/{id}` in the API so `studio` is never read as an id.',
    request: { query: StudioDskpQuerySchema },
    responses: {
      200: json(envelopeOf(StudioDskpSchema), 'The units of the subject and level, each with its SP.'),
      401: err('UNAUTHORIZED: no valid session.'),
      403: err('FORBIDDEN (Admin Pusat only).'),
      422: err('VALIDATION_ERROR: `subjectId` or `educationLevelId` missing or not an id.'),
    },
  })
  registry.registerPath({
    method: 'post',
    path: '/intake/stimuli/{id}/link-references',
    tags: ['intake'],
    summary: 'Link a figure to every open item of its batch that names it (D90)',
    description:
      'Items that already have a stimulus, and accepted, rejected or duplicate items, are left alone; the linked items are gathered next to the first one. Idempotent. Guru on own batches, Admin Pusat on all; an id outside the caller\'s scope is 404.',
    request: { params: z.object({ id: IdSchema }), headers: [csrf] },
    responses: {
      200: json(envelopeOf(StudioFigureLinksSchema), 'The items linked now (empty when there is nothing left to link).'),
      401: err('UNAUTHORIZED: no valid session.'),
      403: err('FORBIDDEN (Guru or Admin Pusat only), or CSRF_INVALID.'),
      404: err('NOT_FOUND: unknown figure, or a batch outside the caller\'s scope.'),
    },
  })
}
