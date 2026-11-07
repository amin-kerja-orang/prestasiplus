import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import {
  HeatmapBandSchema,
  HeatmapChapterSchema,
  HeatmapResponseSchema,
  HeatmapStateSchema,
  HeatmapSubjectSchema,
} from './schema'

/** Components contributed by BE-48 (reshaped by S10-T05, API-DSKP-08) (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const HEATMAP_COMPONENT_SCHEMAS = {
  HeatmapBand: HeatmapBandSchema,
  HeatmapState: HeatmapStateSchema,
  HeatmapChapter: HeatmapChapterSchema,
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
      "Roles student and admin only; the data is always the session user's own. Any query parameter is ignored (no user parameter exists). No AI call, no stored copy: computed on every request.",
      "Rules (API-DSKP-08): (1) the caller's own answers (every practice mode, every row of practice_answers; Mod Pelajar reads its own is_test rows) that have a chapter are grouped by chapter id. Answers without a chapter are not grouped. (2) There is no minimum number of attempts. (3) A subject is listed only when the caller has at least one attempt on a Bab-linked question of it; its block then lists every active chapter of that subject in Tingkatan 1 to 5 (no Darjah). (4) A chapter with no attempt has state belum-cuba, attempts 0, correct 0 and accuracy null. (5) accuracy = 100 x correct / attempts rounded half up to one decimal (null when attempts = 0). (6) state on the whole percent, rounded half away from zero: red < 50, amber 50..79, green >= 80. (7) Subjects: Subjek Teras first, then name ascending, then id. Chapters: Bab number ascending (no number last), then Tingkatan, then chapter id. (8) With no Bab-linked attempt the body is { data: { subjects: [] } }.",
    ].join('\n'),
    responses: {
      200: json(
        HeatmapResponseSchema,
        'Subjects with all their chapters as tiles; `subjects` is empty when the caller has no Bab-linked attempt.',
      ),
      401: err('UNAUTHORIZED "Sesi anda telah tamat. Sila log masuk semula." (no valid session).'),
      403: err(
        'FORBIDDEN "Anda tidak dibenarkan melakukan tindakan ini." (any role other than student or admin).',
      ),
    },
  })
}
