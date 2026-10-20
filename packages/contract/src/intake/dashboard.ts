import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { DateOnlySchema, TimestampSchema } from '../common/time'
import { AI_BUDGET_STATES, AiBudgetStateSchema, AiMonthSchema, AiProviderIdSchema } from '../ai/schema'
import { registerRoute } from '../ai/rate-limit'

/**
 * Intake dashboard (card BE-40, v2-question-bank US-29 / AC-29.1, AC-29.2, NFR-03). Two Admin Pusat
 * read models over the BE-36 (`ai_usage_logs`, `ai_settings`), BE-37 (`intake_batches`) and BE-38
 * (`intake_items`, `intake_item_events`, `duplicate_links`) stores. No mock route and no screen exist
 * (catalogue OQ-API-B2-29): every shape here is authored from AC-29.1 and is [PROPOSED].
 *
 * Definitions (all [PROPOSED], listed in the BE-40 PR):
 * - The month is the Malaysia calendar month (Asia/Kuala_Lumpur, fixed UTC+8): `from` inclusive,
 *   `to` exclusive. Default: the current Malaysia month.
 * - Mod Pelajar / test submissions (`intake_batches.is_test`) are never counted.
 * - The queue is a snapshot at `generatedAt`, whatever the month.
 * - A rate is a percentage rounded to one decimal; `null` when its denominator is 0 (never 0 %).
 * - Mock-provider usage always costs 0 (card AC3), whatever the logged value.
 * - When a store does not exist yet on the server (its card is not merged), its figures are the
 *   empty aggregate and `sources` says which stores were read.
 */

/* ------------------------------------------------------------------------------------------ */
/* Shared                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/**
 * Submission statuses counted by the dashboard. Same codes as the BE-37 batch status (Dihantar,
 * Sedang diproses, Sedia untuk semakan, Gagal, Dibatalkan); a separate constant so this file does
 * not depend on BE-37's contract file.
 */
export const INTAKE_DASHBOARD_BATCH_STATUSES = ['submitted', 'processing', 'ready_for_review', 'failed', 'cancelled'] as const
export const IntakeDashboardBatchStatusSchema = z.enum(INTAKE_DASHBOARD_BATCH_STATUSES).meta({
  id: 'IntakeDashboardBatchStatus',
  description: '[PROPOSED] Submission (intake batch) status, the BE-37 codes: submitted, processing, ready_for_review, failed, cancelled.',
})
export type IntakeDashboardBatchStatus = z.infer<typeof IntakeDashboardBatchStatusSchema>

/**
 * Tag fields of "percentage of tags accepted unchanged per field" (BE-40 open question 1, working
 * assumption: subject, level, chapter, DSKP topic, difficulty). Mapped to the CurriculumTag paths of
 * the intake item: chapter = `tag.unit`, DSKP topic = `tag.sp`, difficulty = `tag.tp` [PROPOSED].
 */
export const INTAKE_DASHBOARD_TAG_FIELDS = ['subject', 'level', 'chapter', 'dskpTopic', 'difficulty'] as const
export const IntakeDashboardTagFieldSchema = z.enum(INTAKE_DASHBOARD_TAG_FIELDS).meta({
  id: 'IntakeDashboardTagField',
  description: '[PROPOSED] subject = tag.subject, level = tag.level, chapter = tag.unit, dskpTopic = tag.sp, difficulty = tag.tp.',
})
export type IntakeDashboardTagField = z.infer<typeof IntakeDashboardTagFieldSchema>

export const INTAKE_DASHBOARD_TAG_PATHS = {
  subject: 'tag.subject',
  level: 'tag.level',
  chapter: 'tag.unit',
  dskpTopic: 'tag.sp',
  difficulty: 'tag.tp',
} as const satisfies Record<IntakeDashboardTagField, string>

/** Budget thresholds, the same as BE-36 `AiBudgetState`: warning from 80 %, exhausted from 100 %. */
export const INTAKE_DASHBOARD_WARN_PERCENT = 80
export const INTAKE_DASHBOARD_CAP_PERCENT = 100

const count = z.number().int().min(0)
const sen = z.number().int().min(0)
const rate = z.number().min(0).max(100).nullable()

export const IntakeDashboardQuerySchema = z
  .object({
    month: AiMonthSchema.optional().meta({ description: 'Malaysia month YYYY-MM. Defaults to the current Malaysia month.' }),
  })
  .meta({ id: 'IntakeDashboardQuery', description: '[PROPOSED] Query of GET /intake/dashboard. Unknown keys are ignored (as AiUsageQuery).' })
export type IntakeDashboardQuery = z.infer<typeof IntakeDashboardQuerySchema>

export const IntakeDashboardCostQuerySchema = z
  .object({
    month: AiMonthSchema.optional().meta({ description: 'Malaysia month YYYY-MM. Defaults to the current Malaysia month.' }),
    provider: AiProviderIdSchema.optional().meta({
      description: 'Only usage of this provider in the breakdowns and the total (card AC3: leave out `mock` development runs by choosing the real provider). The budget block is never filtered.',
    }),
  })
  .meta({ id: 'IntakeDashboardCostQuery', description: '[PROPOSED] Query of GET /intake/dashboard/cost. Unknown keys are ignored (as AiUsageQuery).' })
export type IntakeDashboardCostQuery = z.infer<typeof IntakeDashboardCostQuerySchema>

export const IntakeDashboardSourcesSchema = z
  .object({
    batches: z.boolean().meta({ description: 'intake_batches (BE-37) was readable.' }),
    items: z.boolean().meta({ description: 'intake_items and intake_item_events (BE-38) were readable.' }),
    duplicates: z.boolean().meta({ description: 'duplicate_links (BE-38) was readable; without it only items marked Pendua count.' }),
    usage: z.boolean().meta({ description: 'ai_usage_logs (BE-36) was readable.' }),
    settings: z.boolean().meta({ description: 'ai_settings (BE-36) was readable.' }),
  })
  .strict()
  .meta({
    id: 'IntakeDashboardSources',
    description: '[PROPOSED] Which stores the figures come from. A false store contributes the empty aggregate (its card is not merged on this server yet).',
  })
export type IntakeDashboardSources = z.infer<typeof IntakeDashboardSourcesSchema>

export const INTAKE_BUDGET_SOURCES = ['settings', 'env', 'none'] as const
export const IntakeBudgetSourceSchema = z.enum(INTAKE_BUDGET_SOURCES).meta({
  id: 'IntakeBudgetSource',
  description: '[PROPOSED] Where the cap comes from: settings = ai_settings.monthly_budget_sen (the admin override), env = AI_MONTHLY_BUDGET_SEN, none = neither (cap 0).',
})
export type IntakeBudgetSource = z.infer<typeof IntakeBudgetSourceSchema>

export const IntakeBudgetSchema = z
  .object({
    costSen: sen.meta({ description: 'Month cost of every provider (mock counts 0). This is what the BE-36 budget guard compares.' }),
    budgetSen: sen,
    budgetSource: IntakeBudgetSourceSchema,
    remainingSen: sen.meta({ description: 'max(0, budgetSen - costSen).' }),
    percentUsed: z.number().min(0).meta({
      description: 'costSen / budgetSen * 100 rounded to one decimal; 0 when budgetSen is 0 and costSen is 0, 100 when budgetSen is 0 and costSen > 0 (as AiStatus.percentUsed).',
    }),
    budgetState: AiBudgetStateSchema.meta({
      description: `${AI_BUDGET_STATES.join(' / ')} from the exact (unrounded) ratio: warning from ${INTAKE_DASHBOARD_WARN_PERCENT} %, exhausted from ${INTAKE_DASHBOARD_CAP_PERCENT} %. A cap of 0 is exhausted (every new extraction is queued, AiSettings.monthlyBudgetSen).`,
    }),
    warnReached: z.boolean().meta({ description: `True from ${INTAKE_DASHBOARD_WARN_PERCENT} % (AC-29.2 notification threshold).` }),
    capReached: z.boolean().meta({ description: `True from ${INTAKE_DASHBOARD_CAP_PERCENT} % (new extractions are queued, AC-29.2).` }),
  })
  .strict()
  .meta({ id: 'IntakeBudget', description: '[PROPOSED] AI cost of the month against the monthly cap (NFR-03, AC-29.2).' })
export type IntakeBudget = z.infer<typeof IntakeBudgetSchema>

/* ------------------------------------------------------------------------------------------ */
/* GET /intake/dashboard                                                                       */
/* ------------------------------------------------------------------------------------------ */

export const IntakeDashboardSchema = z
  .object({
    month: AiMonthSchema,
    from: TimestampSchema.meta({ description: 'First instant of the month (00:00 +08:00), inclusive.' }),
    to: TimestampSchema.meta({ description: 'First instant of the next month, exclusive.' }),
    generatedAt: TimestampSchema.meta({ description: 'Server time of the answer; the queue snapshot is taken at this instant.' }),
    submissions: z
      .object({
        total: count,
        byStatus: z
          .array(z.object({ status: IntakeDashboardBatchStatusSchema, count }).strict())
          .meta({ description: 'Every status, in the order of INTAKE_DASHBOARD_BATCH_STATUSES, zero included.' }),
      })
      .strict()
      .meta({ description: 'Submissions (intake batches) created in the month, by their current status.' }),
    queue: z
      .object({
        items: count.meta({ description: 'Review queue size now: items in an open state (generated, needs_review, duplicate).' }),
        oldestItemAt: TimestampSchema.nullable().meta({ description: 'Creation time of the oldest open item; null when the queue is empty.' }),
        oldestItemAgeSeconds: count.nullable().meta({ description: 'generatedAt - oldestItemAt in whole seconds; null when the queue is empty.' }),
        pendingSubmissions: count.meta({ description: 'Submissions waiting for extraction now (submitted or processing), including the ones queued by the budget cap.' }),
        oldestPendingSubmissionAt: TimestampSchema.nullable(),
      })
      .strict()
      .meta({ description: 'Snapshot at generatedAt, not limited to the month.' }),
    extraction: z
      .object({
        succeeded: count.meta({ description: 'Submissions of the month that reached ready_for_review.' }),
        failed: count.meta({ description: 'Submissions of the month that ended failed.' }),
        successRate: rate.meta({ description: 'succeeded / (succeeded + failed) * 100, one decimal; null when both are 0. Submissions still pending or cancelled are not counted.' }),
      })
      .strict(),
    tagAcceptance: z
      .object({
        acceptedItems: count.meta({ description: 'Items accepted (an `accepted` event) in the month.' }),
        fields: z
          .array(
            z
              .object({
                field: IntakeDashboardTagFieldSchema,
                path: z.string().meta({ description: 'The item field path, e.g. tag.unit.' }),
                unchanged: count.meta({ description: 'Accepted items with no edit event on this field (the AI tag was kept).' }),
                ratePercent: rate.meta({ description: 'unchanged / acceptedItems * 100, one decimal; null when acceptedItems is 0.' }),
              })
              .strict(),
          )
          .meta({ description: 'Every field, in the order of INTAKE_DASHBOARD_TAG_FIELDS.' }),
      })
      .strict()
      .meta({ description: 'Percentage of AI tags accepted unchanged, per field.' }),
    duplicates: z
      .object({
        items: count.meta({ description: 'Items created in the month.' }),
        duplicates: count.meta({ description: 'Of those, items with an exact or near duplicate finding, or marked Pendua. Variants are informational and not counted.' }),
        ratePercent: rate.meta({ description: 'duplicates / items * 100, one decimal; null when items is 0.' }),
      })
      .strict(),
    aiCost: IntakeBudgetSchema,
    sources: IntakeDashboardSourcesSchema,
  })
  .strict()
  .meta({ id: 'IntakeDashboard', description: '[PROPOSED] Every AC-29.1 figure for one Malaysia month (card BE-40).' })
export type IntakeDashboard = z.infer<typeof IntakeDashboardSchema>

/* ------------------------------------------------------------------------------------------ */
/* GET /intake/dashboard/cost                                                                  */
/* ------------------------------------------------------------------------------------------ */

/** At most this many batches are listed in `byBatch` (highest cost first). */
export const INTAKE_DASHBOARD_BATCH_ROWS_MAX = 100

const usageTotals = {
  calls: count,
  costSen: sen,
  pages: count,
  tokensIn: count,
  tokensOut: count,
}

export const IntakeCostDaySchema = z
  .object({ day: DateOnlySchema.meta({ description: 'Malaysia calendar day.' }), calls: count, costSen: sen })
  .strict()
  .meta({ id: 'IntakeCostDay', description: '[PROPOSED] Usage of one Malaysia day.' })

export const IntakeCostProviderSchema = z
  .object({
    provider: AiProviderIdSchema.nullable().meta({ description: 'Null for rows without a provider (migrated legacy log rows).' }),
    ...usageTotals,
  })
  .strict()
  .meta({ id: 'IntakeCostProvider', description: '[PROPOSED] Usage of one provider. The mock provider always costs 0.' })

export const IntakeCostBatchSchema = z
  .object({
    batchId: IdSchema.nullable().meta({ description: 'Null for calls not tied to a submission (health check, Cikgu Alesa text).' }),
    ...usageTotals,
  })
  .strict()
  .meta({ id: 'IntakeCostBatch', description: '[PROPOSED] Usage of one submission.' })

export const IntakeCostSchema = z
  .object({
    month: AiMonthSchema,
    from: TimestampSchema,
    to: TimestampSchema,
    generatedAt: TimestampSchema,
    provider: AiProviderIdSchema.nullable().meta({ description: 'The provider filter applied, null for all.' }),
    total: z.object(usageTotals).strict().meta({ description: 'Totals of the filtered rows.' }),
    byDay: z.array(IntakeCostDaySchema).meta({ description: 'Every day of the month in order, zero days included.' }),
    byProvider: z.array(IntakeCostProviderSchema).meta({ description: 'Providers with at least one call, highest cost first, then by provider id.' }),
    byBatch: z.array(IntakeCostBatchSchema).meta({
      description: `At most ${INTAKE_DASHBOARD_BATCH_ROWS_MAX} rows, highest cost first, then by id (the no-batch row last on a tie).`,
    }),
    byBatchTruncated: z.boolean().meta({ description: `True when more than ${INTAKE_DASHBOARD_BATCH_ROWS_MAX} batch rows exist.` }),
    budget: IntakeBudgetSchema.meta({ description: 'Never filtered by provider: the cap is for all usage.' }),
    sources: IntakeDashboardSourcesSchema.pick({ usage: true, settings: true }).strict(),
  })
  .strict()
  .meta({ id: 'IntakeCost', description: '[PROPOSED] AI cost by day, provider and submission, with the budget (card BE-40).' })
export type IntakeCost = z.infer<typeof IntakeCostSchema>

/* ------------------------------------------------------------------------------------------ */
/* Paths                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export const INTAKE_DASHBOARD_COMPONENT_SCHEMAS = {
  IntakeDashboardBatchStatus: IntakeDashboardBatchStatusSchema,
  IntakeDashboardTagField: IntakeDashboardTagFieldSchema,
  IntakeDashboardQuery: IntakeDashboardQuerySchema,
  IntakeDashboardCostQuery: IntakeDashboardCostQuerySchema,
  IntakeDashboardSources: IntakeDashboardSourcesSchema,
  IntakeBudgetSource: IntakeBudgetSourceSchema,
  IntakeBudget: IntakeBudgetSchema,
  IntakeDashboard: IntakeDashboardSchema,
  IntakeCostDay: IntakeCostDaySchema,
  IntakeCostProvider: IntakeCostProviderSchema,
  IntakeCostBatch: IntakeCostBatchSchema,
  IntakeCost: IntakeCostSchema,
} as const

/** Own tag: the conformance gate treats a tag with a registered route as built, and the BE-38 intake routes are not built yet. */
export const INTAKE_DASHBOARD_TAG = 'intake-dashboard'

const NO_STORE_HEADERS = {
  'Cache-Control': {
    description: 'no-store: platform cost and queue figures (D57b applied conservatively).',
    schema: { type: 'string' as const, enum: ['no-store'] },
  },
}
const noStore = (schema: z.ZodType, description: string) => ({
  description,
  headers: NO_STORE_HEADERS,
  content: { 'application/json': { schema } },
})
const err = (description: string) => ({ description, content: { 'application/json': { schema: ErrorBodySchema } } })

const ROLE_NOTE = 'Admin Pusat only (role code `admin`); every other role gets 403, no session 401. GET only: no CSRF.'

/** Registers the two read routes of BE-40. D57(a): reads are limited per user; 429 RATE_LIMITED is documented. */
export function registerIntakeDashboardPaths(registry: OpenAPIRegistry): void {
  registerRoute(
    registry,
    {
      method: 'get',
      path: '/intake/dashboard',
      tags: [INTAKE_DASHBOARD_TAG],
      summary: 'Intake dashboard: submissions, queue, extraction, tag acceptance, duplicates, AI cost',
      description: `Every AC-29.1 figure for one Malaysia month (default the current one). Test submissions are excluded; the queue is a snapshot at the time of the request. ${ROLE_NOTE}`,
      request: { query: IntakeDashboardQuerySchema },
      responses: {
        200: noStore(envelopeOf(IntakeDashboardSchema), 'Dashboard figures.'),
        401: err('UNAUTHORIZED (no valid session).'),
        403: err('FORBIDDEN (the active role is not Admin Pusat).'),
        422: err('VALIDATION_ERROR (month is not YYYY-MM).'),
      },
    },
    true,
  )
  registerRoute(
    registry,
    {
      method: 'get',
      path: '/intake/dashboard/cost',
      tags: [INTAKE_DASHBOARD_TAG],
      summary: 'AI cost of a month by day, provider and submission, with the budget',
      description: `Usage from ai_usage_logs grouped by Malaysia day, provider and submission, optionally for one provider; the budget block (cap from ai_settings, else AI_MONTHLY_BUDGET_SEN; percent used; 80 % / 100 % flags) always covers every provider. Mock-provider usage costs 0. ${ROLE_NOTE}`,
      request: { query: IntakeDashboardCostQuerySchema },
      responses: {
        200: noStore(envelopeOf(IntakeCostSchema), 'Cost figures.'),
        401: err('UNAUTHORIZED (no valid session).'),
        403: err('FORBIDDEN (the active role is not Admin Pusat).'),
        422: err('VALIDATION_ERROR (month is not YYYY-MM, unknown provider).'),
      },
    },
    true,
  )
}
