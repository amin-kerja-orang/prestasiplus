import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AI_PROVIDER_IDS,
  INTAKE_DASHBOARD_BATCH_ROWS_MAX,
  INTAKE_DASHBOARD_BATCH_STATUSES,
  INTAKE_DASHBOARD_CAP_PERCENT,
  INTAKE_DASHBOARD_TAG_FIELDS,
  INTAKE_DASHBOARD_TAG_PATHS,
  INTAKE_DASHBOARD_WARN_PERCENT,
  type AiProviderId,
  type IntakeBudget,
  type IntakeBudgetSource,
  type IntakeCost,
  type IntakeDashboard,
} from '@pp/contract'

import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { INTAKE_BUDGET_ENV } from './intake-dashboard.constants'
import { INTAKE_DASHBOARD_SOURCE, type IntakeDashboardSource } from './intake-dashboard.ports'
import { daysOfMonth, monthRange, mytMonthOf, type MonthRange } from './month'

/** `n / d * 100` rounded half-up to one decimal with integer arithmetic; null when `d` is 0 (never a fake 0 %). */
export function percent(n: number, d: number): number | null {
  if (d <= 0) return null
  return Math.round((n * 1000) / d) / 10
}

/**
 * Card AC5 and BE-36 `AiStatus`: percent used rounded to one decimal; flags from the EXACT ratio (79.96 % shows 80.0 but is
 * not yet a warning). A cap of 0 means every new extraction is queued (AiSettings.monthlyBudgetSen), so it is exhausted;
 * its percent follows AiStatus (0 with no cost, 100 with cost).
 */
export function budgetOf(costSen: number, budgetSen: number, budgetSource: IntakeBudgetSource): IntakeBudget {
  const percentUsed = budgetSen === 0 ? (costSen > 0 ? 100 : 0) : Math.round((costSen * 1000) / budgetSen) / 10
  const capReached = budgetSen === 0 || costSen * 100 >= budgetSen * INTAKE_DASHBOARD_CAP_PERCENT
  const warnReached = capReached || costSen * 100 >= budgetSen * INTAKE_DASHBOARD_WARN_PERCENT
  return {
    costSen,
    budgetSen,
    budgetSource,
    remainingSen: Math.max(0, budgetSen - costSen),
    percentUsed,
    budgetState: capReached ? 'exhausted' : warnReached ? 'warning' : 'ok',
    warnReached,
    capReached,
  }
}

const KNOWN_PROVIDERS = new Set<string>(AI_PROVIDER_IDS)
const providerOf = (p: string | null): AiProviderId | null => (p !== null && KNOWN_PROVIDERS.has(p) ? (p as AiProviderId) : null)

/**
 * BE-40 read models (v2-question-bank US-29, AC-29.1, AC-29.2, NFR-03). Admin Pusat only (controller). Raw counts come
 * from the source port; this service owns the month, the rates, the rounding and the budget rules.
 */
@Injectable()
export class IntakeDashboardService {
  constructor(
    @Inject(INTAKE_DASHBOARD_SOURCE) private readonly source: IntakeDashboardSource,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  private rangeOf(month: string | undefined, now: Date): MonthRange {
    return monthRange(month ?? mytMonthOf(now))
  }

  /** `AI_MONTHLY_BUDGET_SEN` (BE-36's variable): a non-negative integer, else unset. */
  private envBudget(): number | null {
    const raw = this.config.get<string | number | undefined>(INTAKE_BUDGET_ENV)
    if (raw === undefined || raw === null || String(raw).trim() === '') return null
    const s = String(raw).trim()
    if (!/^\d{1,12}$/.test(s)) return null
    return Number(s)
  }

  private async budget(range: MonthRange): Promise<{ budget: IntakeBudget; usage: boolean; settings: boolean }> {
    const [cost, setting] = await Promise.all([this.source.monthCost(range), this.source.budgetSetting()])
    const env = this.envBudget()
    let budgetSen = 0
    let src: IntakeBudgetSource = 'none'
    if (setting.budgetSen !== null) {
      budgetSen = setting.budgetSen
      src = 'settings'
    } else if (env !== null) {
      budgetSen = env
      src = 'env'
    }
    return { budget: budgetOf(cost.costSen, budgetSen, src), usage: cost.available, settings: setting.available }
  }

  async dashboard(month: string | undefined): Promise<IntakeDashboard> {
    const now = this.clock.now()
    const range = this.rangeOf(month, now)
    const paths = INTAKE_DASHBOARD_TAG_FIELDS.map((f) => INTAKE_DASHBOARD_TAG_PATHS[f])
    const [raw, money] = await Promise.all([this.source.intake(range, paths), this.budget(range)])

    const byStatus = INTAKE_DASHBOARD_BATCH_STATUSES.map((status) => ({ status, count: raw.batchesByStatus[status] ?? 0 }))
    const succeeded = raw.batchesByStatus.ready_for_review ?? 0
    const failed = raw.batchesByStatus.failed ?? 0
    const age = (at: Date | null) => (at === null ? null : Math.max(0, Math.floor((now.getTime() - at.getTime()) / 1000)))

    return {
      month: range.month,
      from: toMytTimestamp(range.from),
      to: toMytTimestamp(range.to),
      generatedAt: toMytTimestamp(now),
      submissions: { total: byStatus.reduce((s, r) => s + r.count, 0), byStatus },
      queue: {
        items: raw.queue.count,
        oldestItemAt: raw.queue.oldestAt === null ? null : toMytTimestamp(raw.queue.oldestAt),
        oldestItemAgeSeconds: age(raw.queue.oldestAt),
        pendingSubmissions: raw.pending.count,
        oldestPendingSubmissionAt: raw.pending.oldestAt === null ? null : toMytTimestamp(raw.pending.oldestAt),
      },
      extraction: { succeeded, failed, successRate: percent(succeeded, succeeded + failed) },
      tagAcceptance: {
        acceptedItems: raw.accepted,
        fields: INTAKE_DASHBOARD_TAG_FIELDS.map((field) => {
          const path = INTAKE_DASHBOARD_TAG_PATHS[field]
          const unchanged = raw.unchangedByPath[path] ?? 0
          return { field, path, unchanged, ratePercent: percent(unchanged, raw.accepted) }
        }),
      },
      duplicates: { items: raw.itemsCreated, duplicates: raw.duplicateItems, ratePercent: percent(raw.duplicateItems, raw.itemsCreated) },
      aiCost: money.budget,
      sources: { ...raw.sources, usage: money.usage, settings: money.settings },
    }
  }

  async cost(month: string | undefined, provider: AiProviderId | null): Promise<IntakeCost> {
    const now = this.clock.now()
    const range = this.rangeOf(month, now)
    const [usage, money] = await Promise.all([this.source.usage(range, provider, INTAKE_DASHBOARD_BATCH_ROWS_MAX), this.budget(range)])

    const perDay = new Map(usage.byDay.map((d) => [d.day, d]))
    const byDay = daysOfMonth(range.month).map((day) => ({ day, calls: perDay.get(day)?.calls ?? 0, costSen: perDay.get(day)?.costSen ?? 0 }))
    const byProvider = usage.byProvider.map((r) => ({ ...r, provider: providerOf(r.provider) }))
    const total = byProvider.reduce(
      (t, r) => ({
        calls: t.calls + r.calls,
        costSen: t.costSen + r.costSen,
        pages: t.pages + r.pages,
        tokensIn: t.tokensIn + r.tokensIn,
        tokensOut: t.tokensOut + r.tokensOut,
      }),
      { calls: 0, costSen: 0, pages: 0, tokensIn: 0, tokensOut: 0 },
    )
    return {
      month: range.month,
      from: toMytTimestamp(range.from),
      to: toMytTimestamp(range.to),
      generatedAt: toMytTimestamp(now),
      provider,
      total,
      byDay,
      byProvider,
      byBatch: usage.byBatch.slice(0, INTAKE_DASHBOARD_BATCH_ROWS_MAX),
      byBatchTruncated: usage.byBatch.length > INTAKE_DASHBOARD_BATCH_ROWS_MAX,
      budget: money.budget,
      sources: { usage: usage.available, settings: money.settings },
    }
  }
}
