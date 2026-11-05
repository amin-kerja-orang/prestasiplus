import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * M25 Heatmap Topik Lemah read model (BE-48, reshaped by S10-T05 to API-DSKP-08).
 *
 * S10-T05 (D115 D-D): there is no minimum number of attempts; a chapter of a practised subject with no attempt
 * is a grey `belum-cuba` tile; the body is `subjects[{ id, name, chapters[{ id, number, name, attempts, correct,
 * accuracy, state }] }]`.
 *
 * Ids are decimal-string `Id`s (D53 UD-1). No table: the body is computed on every request from the caller's
 * answer log and the curriculum (D12, G-15).
 */

/** BR-M25-03 thresholds on the rounded percent: red below 50, amber 50-79, green from 80. */
export const HEATMAP_AMBER_MIN_PERCENT = 50
export const HEATMAP_GREEN_MIN_PERCENT = 80

export const HEATMAP_BANDS = ['red', 'amber', 'green'] as const
export const HeatmapBandSchema = z.enum(HEATMAP_BANDS).meta({
  id: 'HeatmapBand',
  description:
    'Colour band on the whole percent (rounded half away from zero): red when percent < 50, amber when 50 <= percent <= 79, green when percent >= 80.',
})
export type HeatmapBand = z.infer<typeof HeatmapBandSchema>

/** The `state` of a tile: a band, or `belum-cuba` (a chapter with no attempt). */
export const HEATMAP_NOT_TRIED = 'belum-cuba' as const
export const HEATMAP_STATES = [...HEATMAP_BANDS, HEATMAP_NOT_TRIED] as const
export const HeatmapStateSchema = z.enum(HEATMAP_STATES).meta({
  id: 'HeatmapState',
  description:
    'Tile state: red, amber or green on the whole percent (red < 50, amber 50..79, green >= 80), or belum-cuba when the chapter has no attempt.',
})
export type HeatmapState = z.infer<typeof HeatmapStateSchema>

/** Band of an already rounded whole percent (FR-MUR-14-7). */
export function heatmapBand(percent: number): HeatmapBand {
  if (percent < HEATMAP_AMBER_MIN_PERCENT) return 'red'
  if (percent < HEATMAP_GREEN_MIN_PERCENT) return 'amber'
  return 'green'
}

/**
 * Whole percent, `round(100 x correct / attempts)` half away from zero, in integer arithmetic:
 * `floor((200 x correct + attempts) / (2 x attempts))` (the figures are never negative). 0 when there are no attempts.
 */
export function heatmapPercent(correct: number, attempts: number): number {
  return attempts <= 0 ? 0 : Math.floor((200 * correct + attempts) / (2 * attempts))
}

/**
 * The wire accuracy (60 section 4.6, START-HERE 11): `100 x correct / attempts` rounded half up to ONE decimal,
 * computed in integers (`floor((2000 x correct + attempts) / (2 x attempts)) / 10`); `null` when there are no attempts.
 */
export function heatmapAccuracy(correct: number, attempts: number): number | null {
  return attempts <= 0 ? null : Math.floor((2000 * correct + attempts) / (2 * attempts)) / 10
}

/** One tile (API-DSKP-08): a chapter (Bab) of a practised subject, derived per request. */
export const HeatmapChapterSchema = z
  .strictObject({
    id: IdSchema,
    number: z
      .number()
      .int()
      .nullable()
      .meta({
        description:
          'Bab number from the curriculum; null when the chapter has none (listed after the numbered ones).',
      }),
    name: z.string().min(1).meta({ description: 'Chapter name from the curriculum.' }),
    attempts: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "The caller's answers in this chapter, in every practice mode. 0 for a belum-cuba tile.",
      }),
    correct: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Of those, the correct ones (<= attempts).' }),
    accuracy: z
      .number()
      .min(0)
      .max(100)
      .nullable()
      .refine((a) => a === null || Number(a.toFixed(1)) === a, {
        message: 'accuracy has at most one decimal',
      })
      .meta({
        description:
          '100 x correct / attempts rounded to one decimal (a value with no fraction has none: 50, not 50.0); null when attempts = 0.',
      }),
    state: HeatmapStateSchema,
  })
  .refine((t) => t.correct <= t.attempts, {
    message: 'correct must not exceed attempts',
    path: ['correct'],
  })
  .refine((t) => (t.attempts === 0) === (t.accuracy === null), {
    message: 'accuracy is null exactly when attempts is 0',
    path: ['accuracy'],
  })
  .refine((t) => (t.attempts === 0) === (t.state === HEATMAP_NOT_TRIED), {
    message: 'state is belum-cuba exactly when attempts is 0',
    path: ['state'],
  })
  .meta({ id: 'HeatmapChapter' })
export type HeatmapChapter = z.infer<typeof HeatmapChapterSchema>

/** One subject block: a subject with at least one attempt on a Bab-linked question, listing ALL its chapters. */
export const HeatmapSubjectSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().min(1).meta({ description: 'Subject name from the curriculum.' }),
    chapters: z.array(HeatmapChapterSchema).min(1).meta({
      description:
        'Every active chapter of the subject in Tingkatan 1 to 5, ordered by Bab number ascending (no number last), then Tingkatan, then chapter id (numeric).',
    }),
  })
  .meta({ id: 'HeatmapSubject' })
export type HeatmapSubject = z.infer<typeof HeatmapSubjectSchema>

/**
 * 200 body of `GET /buku-nota/heatmap`: `{ data: { subjects } }`. Subjects: Subjek Teras first, then name ascending.
 * No Bab-linked attempt at all gives `{ data: { subjects: [] } }`.
 */
export const HeatmapResponseSchema = z
  .strictObject({
    data: z.strictObject({
      subjects: z.array(HeatmapSubjectSchema),
    }),
  })
  .meta({ id: 'HeatmapResponse' })
export type HeatmapResponse = z.infer<typeof HeatmapResponseSchema>
