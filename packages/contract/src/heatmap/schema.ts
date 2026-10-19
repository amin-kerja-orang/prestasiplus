import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * M25 Heatmap Topik Lemah read model (BE-48).
 *
 * The frontend mock (`src/modules/m25-ai-centre`, wire types `api/types.ts`, rules `api/settings.ts`,
 * repository `mock/repository/heatmap.ts`) is the wire spec. Difference from the mock: ids are
 * decimal-string `Id`s (D53 UD-1), where the mock has numbers (`subjectId`, `chapterId`).
 * Everything else keeps the mock's field names. No table: the body is computed on every request from
 * the caller's answer log and the curriculum (D12, G-15).
 */

/** K-M25-01: a chapter is shown only with at least this many of the caller's answers (a constant, not configurable). */
export const HEATMAP_MIN_ATTEMPTS = 5

/** BR-M25-03 thresholds on the rounded percent: red below 50, amber 50-79, green from 80. */
export const HEATMAP_AMBER_MIN_PERCENT = 50
export const HEATMAP_GREEN_MIN_PERCENT = 80

export const HEATMAP_BANDS = ['red', 'amber', 'green'] as const
export const HeatmapBandSchema = z
  .enum(HEATMAP_BANDS)
  .meta({
    id: 'HeatmapBand',
    description:
      'Colour band on the rounded percent: red when percent < 50, amber when 50 <= percent <= 79, green when percent >= 80. Never gray.',
  })
export type HeatmapBand = z.infer<typeof HeatmapBandSchema>

/** Band of an already rounded percent (BR-M25-03). */
export function heatmapBand(percent: number): HeatmapBand {
  if (percent < HEATMAP_AMBER_MIN_PERCENT) return 'red'
  if (percent < HEATMAP_GREEN_MIN_PERCENT) return 'amber'
  return 'green'
}

/**
 * FR-M25-27: `round(100 x correct / attempts)`, half up, in integer arithmetic:
 * `floor((200 x correct + attempts) / (2 x attempts))`. 0 when there are no attempts.
 */
export function heatmapPercent(correct: number, attempts: number): number {
  return attempts <= 0 ? 0 : Math.floor((200 * correct + attempts) / (2 * attempts))
}

/** One chapter cell (DATA-M25-01), derived per request; grouped by chapter id, never by name. */
export const HeatmapTopicSchema = z
  .strictObject({
    chapterId: IdSchema,
    name: z.string().min(1).meta({ description: 'Chapter name from the curriculum.' }),
    attempts: z
      .number()
      .int()
      .min(HEATMAP_MIN_ATTEMPTS)
      .meta({ description: 'The caller\'s answers in this chapter (answers without a chapter are not counted). Always >= 5.' }),
    correct: z.number().int().min(0).meta({ description: 'Of those, the correct ones (<= attempts).' }),
    percent: z
      .number()
      .int()
      .min(0)
      .max(100)
      .meta({ description: 'floor((200 x correct + attempts) / (2 x attempts)): round half up, integer 0..100.' }),
    band: HeatmapBandSchema,
  })
  .refine((t) => t.correct <= t.attempts, { message: 'correct must not exceed attempts', path: ['correct'] })
  .meta({ id: 'HeatmapTopic' })
export type HeatmapTopic = z.infer<typeof HeatmapTopicSchema>

/** One subject block (DATA-M25-02); only subjects with at least one shown chapter appear. */
export const HeatmapSubjectSchema = z
  .strictObject({
    subjectId: IdSchema,
    name: z.string().min(1).meta({ description: 'Subject name from the curriculum.' }),
    topics: z.array(HeatmapTopicSchema).min(1).meta({
      description:
        'Ordered by raw accuracy ascending (exact fractions: correct_a x attempts_b vs correct_b x attempts_a, not the rounded percent), then name ascending (code-unit comparison, as the mock), then chapter id ascending (numeric order of the bigint, not string order).',
    }),
  })
  .meta({ id: 'HeatmapSubject' })
export type HeatmapSubject = z.infer<typeof HeatmapSubjectSchema>

/**
 * 200 body of `GET /buku-nota/heatmap`: `{ data: { subjects } }`. Subjects are ordered by curriculum
 * subject order (`sort_order`) ascending, then subject id (numeric). No shown chapter at all gives
 * `{ data: { subjects: [] } }`.
 */
export const HeatmapResponseSchema = z
  .strictObject({
    data: z.strictObject({
      subjects: z.array(HeatmapSubjectSchema),
    }),
  })
  .meta({ id: 'HeatmapResponse' })
export type HeatmapResponse = z.infer<typeof HeatmapResponseSchema>
