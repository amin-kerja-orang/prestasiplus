import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import {
  HeatmapBandSchema,
  HeatmapResponseSchema,
  HeatmapSubjectSchema,
  HeatmapTopicSchema,
} from './schema'

/** Components contributed by BE-48 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const HEATMAP_COMPONENT_SCHEMAS = {
  HeatmapBand: HeatmapBandSchema,
  HeatmapTopic: HeatmapTopicSchema,
  HeatmapSubject: HeatmapSubjectSchema,
  HeatmapResponse: HeatmapResponseSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** Registers the one M25 route (BE-48). Bodies are `{ data }` or `{ error }`. */
export function registerHeatmapPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/buku-nota/heatmap',
    tags: ['heatmap'],
    summary: 'Own weak-topic heatmap (Heatmap Topik Lemah)',
    description: [
      'Roles student and admin only; the data is always the session user\'s own. Any query parameter is ignored (no user parameter exists). No AI call, no stored copy: computed on every request.',
      'Rules: (1) the caller\'s own answers that have a chapter are grouped by chapter id (never by name); answers without a chapter are not grouped. (2) A chapter is shown only with at least 5 attempts (HEATMAP_MIN_ATTEMPTS). (3) percent = floor((200 x correct + attempts) / (2 x attempts)), round half up. (4) band on the rounded percent: red < 50, amber 50..79, green >= 80. (5) Names come from the curriculum; a shown chapter whose chapter or subject is not found is skipped. (6) Topics inside a subject: raw accuracy ascending (exact integer cross-multiplication), then name ascending (code-unit comparison), then chapter id ascending (numeric). Subjects: curriculum order ascending, then subject id (numeric). (7) A subject with no shown chapter has no block; with none at all the body is { data: { subjects: [] } }.',
    ].join('\n'),
    responses: {
      200: json(HeatmapResponseSchema, 'Subjects with their shown topics; `subjects` is empty when no chapter reaches 5 attempts.'),
      401: err('UNAUTHORIZED "Unauthenticated." (no valid session).'),
      403: err('FORBIDDEN "This action is unauthorized." (any role other than student or admin).'),
    },
  })
}
