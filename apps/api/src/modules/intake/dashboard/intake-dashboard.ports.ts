import type { AiProviderId } from '@pp/contract'

import type { MonthRange } from './month'

/**
 * Read port of the intake dashboard (BE-40). The dashboard owns no table: it reads BE-37 (`intake_batches`), BE-38
 * (`intake_items`, `intake_item_events`, `duplicate_links`) and BE-36 (`ai_usage_logs`, `ai_settings`). The default
 * adapter is SQL over those tables (`SqlIntakeDashboardSource`) and reports, per store, whether it could read it: a
 * store whose card is not merged yet answers the empty aggregate with `available: false`, never an error.
 *
 * The port answers raw counts only; every rate, rounding and budget rule lives in `IntakeDashboardService`.
 */

export interface IntakeRaw {
  sources: { batches: boolean; items: boolean; duplicates: boolean }
  /** Submissions created in the month, by current status (statuses absent from the map are 0). */
  batchesByStatus: Record<string, number>
  /** Now: submissions waiting for extraction (submitted or processing). */
  pending: { count: number; oldestAt: Date | null }
  /** Now: items in an open review state. */
  queue: { count: number; oldestAt: Date | null }
  /** Items with an `accepted` event in the month. */
  accepted: number
  /** Accepted items with no edit event on the path, keyed by tag path (`tag.unit`, ...). */
  unchangedByPath: Record<string, number>
  /** Items created in the month, and of those the ones flagged as duplicates. */
  itemsCreated: number
  duplicateItems: number
}

export interface UsageTotalsRaw {
  calls: number
  costSen: number
  pages: number
  tokensIn: number
  tokensOut: number
}

export interface UsageRaw {
  available: boolean
  byDay: { day: string; calls: number; costSen: number }[]
  byProvider: ({ provider: string | null } & UsageTotalsRaw)[]
  /** Highest cost first, at most `limit + 1` rows so the caller can tell truncation. */
  byBatch: ({ batchId: string | null } & UsageTotalsRaw)[]
}

export interface IntakeDashboardSource {
  intake(range: MonthRange, tagPaths: readonly string[]): Promise<IntakeRaw>
  /** Usage of the month, optionally for one provider (contract id). Mock rows cost 0. */
  usage(range: MonthRange, provider: AiProviderId | null, batchLimit: number): Promise<UsageRaw>
  /** Month cost of every provider (mock = 0): what the BE-36 budget guard compares. */
  monthCost(range: MonthRange): Promise<{ available: boolean; costSen: number }>
  /** `ai_settings.monthly_budget_sen` (the admin override); null when the table or the row is missing. */
  budgetSetting(): Promise<{ available: boolean; budgetSen: number | null }>
}

export const INTAKE_DASHBOARD_SOURCE = Symbol('INTAKE_DASHBOARD_SOURCE')
