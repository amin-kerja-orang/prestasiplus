import { z } from '../zod'
import { TimestampSchema } from '../common/time'
import { count } from './util'

/**
 * Sejarah Kuiz SPM (`GET /spm/history`, API-BIJAK-07, card S3-T07 part F). One merged, server-paged list of the
 * caller's closed SPM sittings: completed practice sessions (`practice_sessions`) and closed Bijak sittings
 * (`exam_attempts`, mode from `paper_kind`), newest first. Abandoned, in-progress and swept sessions are never listed.
 */

/** Rows per page (D10 FR-MUR-13-2: 15 per page). */
export const SPM_HISTORY_PAGE_SIZE = 15

/**
 * The chip filter, query key `mod`. `past_year` and `ramalan` are the legacy read-only values: they are accepted as
 * aliases of `databank` and `tracking_a` (the chip "Tahun Lepas" lists both, "Tracking A" lists both).
 */
export const SPM_HISTORY_MODS = ['all', 'databank', 'latih_tubi', 'tracking_a', 'past_year', 'ramalan'] as const
export const SpmHistoryModSchema = z.enum(SPM_HISTORY_MODS).meta({ id: 'SpmHistoryMod' })
export type SpmHistoryMod = z.infer<typeof SpmHistoryModSchema>

/**
 * The canonical mode of a row (OPT-MODE-SESI). Legacy `past_year` and `ramalan` sessions are reported as `databank` and
 * `tracking_a`. `simulasi` = a Bijak SPM paper sitting, `subjektif` = a Kertas Subjektif sitting, `structured` = a Soalan
 * Berstruktur sitting, `kuiz` = a Simulasi - Kuiz session.
 */
export const SPM_HISTORY_ROW_MODES = ['databank', 'latih_tubi', 'tracking_a', 'simulasi', 'subjektif', 'structured', 'kuiz'] as const
export const SpmHistoryRowModeSchema = z.enum(SPM_HISTORY_ROW_MODES).meta({ id: 'SpmHistoryRowMode' })
export type SpmHistoryRowMode = z.infer<typeof SpmHistoryRowModeSchema>

export const SpmHistoryQuerySchema = z
  .object({
    mod: SpmHistoryModSchema.optional().meta({ description: 'Chip filter; default `all`. An unknown value is 422.' }),
    type: SpmHistoryModSchema.optional().meta({ description: 'Alias of `mod` (old links). `mod` wins when both are sent.' }),
    halaman: z.coerce.number().int().min(1).optional().meta({ description: '1-based page number; default 1. A page past the last one returns no rows.' }),
  })
  .meta({ id: 'SpmHistoryQuery' })
export type SpmHistoryQuery = z.infer<typeof SpmHistoryQuerySchema>

/** One row of the Sejarah list. */
export const SpmHistoryRowSchema = z
  .strictObject({
    id: z.uuid().meta({ description: 'Id of the practice session or of the Bijak attempt.' }),
    mode: SpmHistoryRowModeSchema,
    subject: z.strictObject({
      code: z.string().min(1).meta({ description: 'Curriculum subject code; "UMUM" for a session with no subject.' }),
      name: z.string().min(1),
    }),
    correct: count.meta({ description: 'Correct answers of a session; whole marks (rounded) scored of a Bijak sitting.' }),
    total: count.meta({ description: 'Questions of a session; whole marks (rounded) available of a Bijak sitting.' }),
    percent: z.number().int().min(0).max(100).meta({ description: 'Whole number, rounded half up; 0 when `total` is 0.' }),
    coins: count.meta({ description: 'The sitting\'s own coins (the display value stored with the session or result), not the wallet.' }),
    durationSeconds: count.meta({ description: 'Time spent; a Bijak sitting counts its elapsed time capped at the deadline.' }),
    completedAt: TimestampSchema.meta({ description: 'Completion (practice) or submit (Bijak) time; the sort key, newest first.' }),
  })
  .meta({ id: 'SpmHistoryRow' })
export type SpmHistoryRow = z.infer<typeof SpmHistoryRowSchema>

/**
 * The four tiles, over ALL modes (never narrowed by the chip or the page); the same figures as `SpmOverview.me`
 * (answers: `practice_answers` of the SPM modes; sessions: completed sessions plus closed sittings; coins: M14 ledger).
 */
export const SpmMyStatsSchema = z
  .strictObject({
    sessions: count.meta({ description: 'Completed practice sessions plus closed Bijak sittings (abandoned and in-progress never count).' }),
    avgAccuracy: z.number().int().min(0).max(100).nullable().meta({
      description: 'Pooled correct / answered x 100 over the SPM-mode answers, a whole number rounded half up; null (shown "—") with 0 answers.',
    }),
    coins: count.meta({ description: 'Syiling earned from the SPM sources of the M14 wallet ledger.' }),
    answered: count.meta({ description: 'Answer rows of the SPM modes.' }),
  })
  .meta({ id: 'SpmMyStats' })
export type SpmMyStats = z.infer<typeof SpmMyStatsSchema>

export const SpmHistoryMetaSchema = z
  .strictObject({
    page: z.number().int().min(1).meta({ description: 'The requested page (1-based).' }),
    pageSize: z.literal(SPM_HISTORY_PAGE_SIZE),
    pageCount: z.number().int().min(1).meta({ description: 'ceil(total / pageSize), at least 1 (the pager reads "Halaman {page} daripada {pageCount}").' }),
    total: count.meta({ description: 'Rows under the active chip.' }),
    mod: SpmHistoryModSchema.meta({ description: 'The chip applied (the alias already resolved; `all` when none was sent).' }),
    stats: SpmMyStatsSchema,
  })
  .meta({ id: 'SpmHistoryMeta' })

export const SpmHistoryResponseSchema = z
  .strictObject({ data: z.array(SpmHistoryRowSchema), meta: SpmHistoryMetaSchema })
  .meta({ id: 'SpmHistoryResponse' })
export type SpmHistoryResponse = z.infer<typeof SpmHistoryResponseSchema>
