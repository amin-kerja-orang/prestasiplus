import { Inject, Injectable } from '@nestjs/common'
import type { AiCallPurpose } from '@pp/contract'

import { Prisma } from '../../db/generated/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

export interface SettingsRow {
  monthlyBudgetSen: number
  warnPercent: number
  notifyAt80: boolean
  notifyAt100: boolean
  updatedById: string | null
  updatedAt: Date
}

export interface UsageInsert {
  runId: string | null
  batchId: string | null
  actorId: string | null
  provider: string
  model: string
  purpose: AiCallPurpose
  pages: number
  tokensIn: number
  tokensOut: number
  costSen: number
  /** The time of the call (the injected clock, so the Malaysia month of the row is deterministic in tests). */
  at: Date
}

export interface UsageRowRecord {
  id: string
  createdAt: Date
  purpose: string
  provider: string
  model: string
  runId: string | null
  batchId: string | null
  actorId: string | null
  pages: number
  tokensIn: number
  tokensOut: number
  costSen: number
}

export interface UsageFilter {
  from: Date
  to: Date
  batchId?: string
  /** Database form (`openai_compatible`). */
  provider?: string
}

export interface RunStart {
  kind: 'extract_paper' | 'suggest_tags'
  provider: string
  model: string
  batchId: string | null
  intakeFileId?: string | null
  jobId?: string | null
  requestedById: string | null
  status: 'queued' | 'running'
  startedAt: Date | null
}

/** Decimal-string id to bigint, or null for a missing or malformed one (a bad optional id never breaks a log write). */
export function bigOrNull(id: string | null | undefined): bigint | null {
  if (id === null || id === undefined) return null
  try {
    return idFromString(id)
  } catch {
    return null
  }
}

const idOrNull = (v: bigint | null): string | null => (v === null ? null : idToString(v))

/**
 * The only doorway to `ai_extraction_runs`, `ai_usage_logs` and `ai_settings` (ADR-0014). `ai_usage_logs` has an insert
 * path and read paths only: no update, no delete (G-17). No method here takes or returns document text.
 */
@Injectable()
export class AiRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /* ----------------------------------------------------------------------------------- runs */

  async createRun(input: RunStart): Promise<string> {
    const row = await this.db.aiExtractionRun.create({
      data: {
        kind: input.kind,
        provider: input.provider,
        model: input.model,
        status: input.status,
        batchId: bigOrNull(input.batchId),
        intakeFileId: bigOrNull(input.intakeFileId),
        jobId: bigOrNull(input.jobId),
        requestedById: bigOrNull(input.requestedById),
        startedAt: input.startedAt,
      },
      select: { id: true },
    })
    return idToString(row.id)
  }

  /** Marks an existing run `running`; false when no such run exists. */
  async startRun(id: string, provider: string, model: string, now: Date): Promise<boolean> {
    const big = bigOrNull(id)
    if (big === null) return false
    const res = await this.db.aiExtractionRun.updateMany({ where: { id: big }, data: { status: 'running', provider, model, startedAt: now, finishedAt: null, errorCode: null } })
    return res.count > 0
  }

  async finishRun(id: string, data: { status: 'succeeded' | 'failed' | 'cancelled'; finishedAt: Date; pages?: number; tokensIn?: number; tokensOut?: number; costSen?: number; errorCode?: string | null }): Promise<void> {
    const big = bigOrNull(id)
    if (big === null) return
    await this.db.aiExtractionRun.updateMany({
      where: { id: big },
      data: {
        status: data.status,
        finishedAt: data.finishedAt,
        ...(data.pages !== undefined ? { pages: data.pages } : {}),
        ...(data.tokensIn !== undefined ? { tokensIn: data.tokensIn } : {}),
        ...(data.tokensOut !== undefined ? { tokensOut: data.tokensOut } : {}),
        ...(data.costSen !== undefined ? { costSen: data.costSen } : {}),
        errorCode: data.errorCode ?? null,
      },
    })
  }

  /* ----------------------------------------------------------------------------------- usage */

  /**
   * Appends one usage row. A foreign key that does not exist (a batch, run or actor id the caller got wrong) must not
   * lose a call that was already paid for, so the row is then written without those references.
   */
  async insertUsage(u: UsageInsert): Promise<void> {
    const data = (withRefs: boolean) => ({
      runId: withRefs ? bigOrNull(u.runId) : null,
      batchId: withRefs ? bigOrNull(u.batchId) : null,
      actorUserId: withRefs ? bigOrNull(u.actorId) : null,
      provider: u.provider,
      model: u.model,
      purpose: u.purpose,
      pages: u.pages,
      tokensIn: u.tokensIn,
      tokensOut: u.tokensOut,
      costSen: u.costSen,
      createdAt: u.at,
    })
    try {
      await this.db.aiUsageLog.create({ data: data(true) })
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2003') throw err
      await this.db.aiUsageLog.create({ data: data(false) })
    }
  }

  /** Month-to-date cost: mock rows count 0 whatever was logged (the same rule as the BE-40 dashboard). */
  async costBetween(from: Date, to: Date): Promise<number> {
    const rows = await this.db.$queryRaw<{ cost: bigint | null }[]>`
      SELECT coalesce(sum(CASE WHEN u.provider = 'mock' THEN 0 ELSE u.cost_sen END), 0)::bigint AS cost
      FROM ai_usage_logs u WHERE u.created_at >= ${from} AND u.created_at < ${to}`
    return Number(rows[0]?.cost ?? 0)
  }

  private usageWhere(f: UsageFilter): Prisma.AiUsageLogWhereInput {
    const batch = bigOrNull(f.batchId)
    return {
      createdAt: { gte: f.from, lt: f.to },
      ...(f.batchId !== undefined ? { batchId: batch ?? -1n } : {}),
      ...(f.provider ? { provider: f.provider } : {}),
    }
  }

  async usagePage(f: UsageFilter, skip: number, take: number): Promise<{ rows: UsageRowRecord[]; total: number }> {
    const where = this.usageWhere(f)
    const [rows, total] = await Promise.all([
      this.db.aiUsageLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
      this.db.aiUsageLog.count({ where }),
    ])
    return {
      total,
      rows: rows.map((r) => ({
        id: idToString(r.id),
        createdAt: r.createdAt,
        purpose: r.purpose,
        provider: r.provider,
        model: r.model,
        runId: idOrNull(r.runId),
        batchId: idOrNull(r.batchId),
        actorId: idOrNull(r.actorUserId),
        pages: r.pages,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        costSen: r.costSen,
      })),
    }
  }

  /* --------------------------------------------------------------------------------- settings */

  async settings(): Promise<SettingsRow | null> {
    const r = await this.db.aiSettings.findUnique({ where: { id: 1 } })
    return r
      ? { monthlyBudgetSen: r.monthlyBudgetSen, warnPercent: r.warnPercent, notifyAt80: r.notifyAt80, notifyAt100: r.notifyAt100, updatedById: idOrNull(r.updatedById), updatedAt: r.updatedAt }
      : null
  }

  /** Creates the singleton row when it is missing (seeded from `AI_MONTHLY_BUDGET_SEN`); an existing row is left alone. */
  async ensureSettings(initialBudgetSen: number): Promise<void> {
    await this.db.$executeRaw`INSERT INTO ai_settings (id, monthly_budget_sen) VALUES (1, ${initialBudgetSen}) ON CONFLICT (id) DO NOTHING`
  }

  async upsertSettings(input: { monthlyBudgetSen: number; notifyAt80: boolean; notifyAt100: boolean; updatedById: string | null; now: Date }): Promise<void> {
    const by = bigOrNull(input.updatedById)
    await this.db.aiSettings.upsert({
      where: { id: 1 },
      create: { id: 1, monthlyBudgetSen: input.monthlyBudgetSen, notifyAt80: input.notifyAt80, notifyAt100: input.notifyAt100, updatedById: by, updatedAt: input.now },
      update: { monthlyBudgetSen: input.monthlyBudgetSen, notifyAt80: input.notifyAt80, notifyAt100: input.notifyAt100, updatedById: by, updatedAt: input.now },
    })
  }

  /**
   * Claims the once-per-month 80% warning: true for exactly one caller per Malaysia month (`firstDay` = `YYYY-MM-01`),
   * however many calls race. `last_warned_month` is the idempotence key.
   */
  async claimWarnedMonth(firstDay: string): Promise<boolean> {
    const n = await this.db.$executeRaw`UPDATE ai_settings SET last_warned_month = ${firstDay}::date WHERE id = 1 AND last_warned_month IS DISTINCT FROM ${firstDay}::date`
    return n > 0
  }

  /** Same for the 100% notice (`last_capped_month`). Also marks the month as warned so no 80% notice follows it. */
  async claimCappedMonth(firstDay: string): Promise<boolean> {
    const n = await this.db.$executeRaw`UPDATE ai_settings SET last_capped_month = ${firstDay}::date, last_warned_month = ${firstDay}::date WHERE id = 1 AND last_capped_month IS DISTINCT FROM ${firstDay}::date`
    return n > 0
  }
}
