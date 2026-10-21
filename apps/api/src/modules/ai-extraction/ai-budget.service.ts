import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AiBudgetState, AiProviderId, AiSettings } from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { NotificationsService } from '../notifications'
import { UsersRepository } from '../users'
import { AiConfig } from './ai.config'
import { AI_DEFAULTS, AI_NOTIFICATION_TYPES } from './ai.constants'
import { AiError } from './ai.errors'
import { AiRepository } from './ai.repository'
import { malaysiaMonthOf, type MalaysiaMonth } from './month'

export interface BudgetView {
  /** The cap in sen; null when neither `ai_settings` nor `AI_MONTHLY_BUDGET_SEN` gives one. */
  budgetSen: number | null
  warnPercent: number
  notifyAt80: boolean
  notifyAt100: boolean
  /** Null until the first PUT /ai/settings. */
  updatedAt: Date | null
}

export interface BudgetFigures {
  month: MalaysiaMonth
  costSen: number
  /** 0 when no cap is configured (the contract has no null here). */
  budgetSen: number
  remainingSen: number
  percentUsed: number
  state: AiBudgetState
}

const rm = (sen: number): string => `RM${(sen / 100).toFixed(2)}`

/**
 * Monthly budget (AC6, AC-29.2). The month is the Malaysia calendar month. The cap is `ai_settings.monthly_budget_sen`,
 * else `AI_MONTHLY_BUDGET_SEN`, else none. With no cap the mock is unrestricted (it costs nothing) and every paid
 * provider is refused: a paid provider never runs without a cap an admin has set.
 *
 *  - at `warn_percent` (80) one notification per month per active Admin Pusat (`last_warned_month` makes it once);
 *  - at 100% a call is refused with `AI_BUDGET_EXHAUSTED` (the caller may queue it) and, once per month, a second
 *    notification says so (`last_capped_month`).
 * The figures are summed from `ai_usage_logs`, the same rule as the BE-40 dashboard (mock rows count 0).
 */
@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name)

  constructor(
    @Inject(AiRepository) private readonly repo: AiRepository,
    @Inject(AiConfig) private readonly config: AiConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  async view(): Promise<BudgetView> {
    const row = await this.repo.settings()
    if (!row) return { budgetSen: this.config.envBudgetSen, warnPercent: AI_DEFAULTS.warnPercent, notifyAt80: true, notifyAt100: true, updatedAt: null }
    return { budgetSen: row.monthlyBudgetSen, warnPercent: row.warnPercent, notifyAt80: row.notifyAt80, notifyAt100: row.notifyAt100, updatedAt: row.updatedById === null ? null : row.updatedAt }
  }

  /** The settings as the contract returns them. */
  async settings(): Promise<AiSettings> {
    const v = await this.view()
    return { monthlyBudgetSen: v.budgetSen ?? 0, notifyAt80: v.notifyAt80, notifyAt100: v.notifyAt100, updatedAt: v.updatedAt ? toMytTimestamp(v.updatedAt) : null }
  }

  async monthToDateCostSen(month: MalaysiaMonth = malaysiaMonthOf(this.clock.now())): Promise<number> {
    return this.repo.costBetween(month.from, month.to)
  }

  async figures(provider: AiProviderId): Promise<BudgetFigures> {
    const month = malaysiaMonthOf(this.clock.now())
    const [v, costSen] = await Promise.all([this.view(), this.monthToDateCostSen(month)])
    const budgetSen = v.budgetSen ?? 0
    const reached = v.budgetSen === null ? provider !== 'mock' : costSen >= budgetSen
    const warn = v.budgetSen !== null && costSen * 100 >= budgetSen * v.warnPercent
    const percentUsed = budgetSen === 0 ? (costSen > 0 ? 100 : 0) : Math.round((costSen * 1000) / budgetSen) / 10
    return { month, costSen, budgetSen, remainingSen: Math.max(0, budgetSen - costSen), percentUsed, state: reached ? 'exhausted' : warn ? 'warning' : 'ok' }
  }

  /** Refuses the call with `AI_BUDGET_EXHAUSTED` when the month's cap is reached (also for `generateText`, AC9). */
  async assertAvailable(provider: AiProviderId): Promise<void> {
    const f = await this.figures(provider)
    if (f.state !== 'exhausted') return
    await this.noticeBestEffort(f, 'capped')
    throw AiError.budgetExhausted()
  }

  /** After a successful call: sends the once-a-month 80% warning when it is due. Never throws into the caller. */
  async afterCall(provider: AiProviderId): Promise<void> {
    try {
      const f = await this.figures(provider)
      if (f.state === 'warning') await this.notice(f, 'warning')
      else if (f.state === 'exhausted') await this.notice(f, 'capped')
    } catch {
      // Logged without detail: a notification problem must never fail a paid call that already succeeded.
      this.logger.warn('budget notification failed')
    }
  }

  private async noticeBestEffort(f: BudgetFigures, kind: 'warning' | 'capped'): Promise<void> {
    try {
      await this.notice(f, kind)
    } catch {
      this.logger.warn('budget notification failed')
    }
  }

  /**
   * One notification per active Admin Pusat, once per month and kind. The claim of the month and the notifications are one
   * transaction: if a notification cannot be written the claim rolls back and a later call tries again.
   */
  private async notice(f: BudgetFigures, kind: 'warning' | 'capped'): Promise<void> {
    const v = await this.view()
    if (v.budgetSen === null) return
    if (kind === 'warning' ? !v.notifyAt80 : !v.notifyAt100) return
    await this.repo.ensureSettings(v.budgetSen)
    await this.prisma.transaction(async () => {
      const claimed = kind === 'warning' ? await this.repo.claimWarnedMonth(f.month.firstDay) : await this.repo.claimCappedMonth(f.month.firstDay)
      if (!claimed) return
      const text =
        kind === 'warning'
          ? { type: AI_NOTIFICATION_TYPES.budgetWarning, title: 'Bajet AI bulan ini hampir habis', body: `Kos AI bulan ${f.month.month} telah mencapai ${String(f.percentUsed)}% daripada had bulanan (${rm(f.costSen)} daripada ${rm(f.budgetSen)}).` }
          : { type: AI_NOTIFICATION_TYPES.budgetCapped, title: 'Had bajet AI bulanan dicapai', body: `Kos AI bulan ${f.month.month} telah mencapai had bulanan (${rm(f.costSen)} daripada ${rm(f.budgetSen)}). Pengekstrakan baharu ditunda sehingga had dinaikkan.` }
      for (const adminId of await this.users.activeAdminIds()) await this.notifications.push(adminId, { ...text, category: 'system' })
    })
  }
}
