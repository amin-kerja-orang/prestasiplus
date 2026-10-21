import { Inject, Injectable } from '@nestjs/common'
import {
  AI_MESSAGES,
  type AiSettings,
  type AiSettingsUpdate,
  type AiStatus,
  type AiTestResult,
  type AiUsageQuery,
  type AiUsageRow,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { AiBudgetService } from './ai-budget.service'
import { AiCallPipeline } from './ai-call.pipeline'
import { AiExtractionService } from './ai-extraction.service'
import { AI_AUDIT_ACTIONS, fromDbProvider, toDbProvider } from './ai.constants'
import { AiError } from './ai.errors'
import { AiRepository } from './ai.repository'
import { malaysiaMonth, malaysiaMonthOf } from './month'

export interface AdminActor {
  userId: string
  role: string
  requestId: string | null
  ip: string | null
  isTest: boolean
}

/** Maps an in-process AI failure to the HTTP error of the contract (503 for the AI_* codes, 429 with Retry-After). */
export function toApiError(err: AiError): ApiError {
  if (err.code === 'RATE_LIMITED') return ApiError.of('RATE_LIMITED', { retryAfter: err.retryAfter ?? 1 })
  if (err.code === 'AI_BUDGET_EXHAUSTED') return new ApiError({ code: 'AI_BUDGET_EXHAUSTED', status: 503, message: AI_MESSAGES.budgetExhausted })
  // AI_PROVIDER_ERROR and AI_TIMEOUT are in-process codes; HTTP callers see AI_UNAVAILABLE (contract AiFailureCode).
  return new ApiError({ code: 'AI_UNAVAILABLE', status: 503, message: err.code === 'AI_UNAVAILABLE' ? err.message : AI_MESSAGES.unavailable })
}

/** The four admin routes (`/ai/status`, `/ai/usage`, `/ai/settings`, `/ai/test`). Admin Pusat only (controller). */
@Injectable()
export class AiAdminService {
  constructor(
    @Inject(AiCallPipeline) private readonly pipeline: AiCallPipeline,
    @Inject(AiBudgetService) private readonly budget: AiBudgetService,
    @Inject(AiExtractionService) private readonly ai: AiExtractionService,
    @Inject(AiRepository) private readonly repo: AiRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async status(): Promise<AiStatus> {
    const provider = this.pipeline.provider
    const configured = provider.isConfigured()
    const f = await this.budget.figures(provider.id)
    return {
      provider: provider.id,
      model: provider.model === '' ? null : provider.model,
      configured,
      capabilities: configured ? provider.capabilities : null,
      month: f.month.month,
      monthToDateCostSen: f.costSen,
      budgetSen: f.budgetSen,
      remainingSen: f.remainingSen,
      percentUsed: f.percentUsed,
      budgetState: f.state,
      settings: await this.budget.settings(),
    }
  }

  async usage(query: AiUsageQuery): Promise<{ rows: AiUsageRow[]; meta: ReturnType<typeof listMeta> }> {
    const month = query.month ? malaysiaMonth(query.month) : malaysiaMonthOf(this.clock.now())
    const { rows, total } = await this.repo.usagePage(
      { from: month.from, to: month.to, ...(query.batchId ? { batchId: query.batchId } : {}), ...(query.provider ? { provider: toDbProvider(query.provider) } : {}) },
      (query.page - 1) * query.pageSize,
      query.pageSize,
    )
    return {
      rows: rows.map((r) => ({
        id: r.id,
        createdAt: toMytTimestamp(r.createdAt),
        purpose: r.purpose as AiUsageRow['purpose'],
        provider: fromDbProvider(r.provider),
        model: r.model,
        runId: r.runId,
        batchId: r.batchId,
        actorId: r.actorId,
        pages: r.pages,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        costSen: r.costSen,
      })),
      meta: listMeta(query.page, query.pageSize, total),
    }
  }

  /** Full replace of the cap and the two toggles; the change and its audit row commit together (actor, old and new value). */
  async updateSettings(actor: AdminActor, body: AiSettingsUpdate): Promise<AiSettings> {
    await this.prisma.transaction(async (tx) => {
      const before = await this.budget.view()
      await this.repo.upsertSettings({ ...body, updatedById: actor.userId, now: this.clock.now() })
      await this.audit.record({
        action: AI_AUDIT_ACTIONS.SETTINGS_UPDATED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        targetType: 'ai_settings',
        targetId: '1',
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        details: {
          before: { monthlyBudgetSen: before.budgetSen, notifyAt80: before.notifyAt80, notifyAt100: before.notifyAt100 },
          after: { monthlyBudgetSen: body.monthlyBudgetSen, notifyAt80: body.notifyAt80, notifyAt100: body.notifyAt100 },
        },
        tx,
      })
    })
    return this.budget.settings()
  }

  async test(actor: AdminActor): Promise<AiTestResult> {
    try {
      return await this.ai.healthCheck({ actorId: actor.userId })
    } catch (err) {
      if (err instanceof AiError) throw toApiError(err)
      throw err
    }
  }
}
