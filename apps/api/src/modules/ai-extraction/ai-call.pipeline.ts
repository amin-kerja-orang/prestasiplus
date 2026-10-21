import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AiCallPurpose, AiUsage } from '@pp/contract'

import { CLOCK, type Clock } from '../../db/clock'
import { UsersRepository } from '../users'
import { AiBudgetService } from './ai-budget.service'
import { AiRunsService } from './ai-runs.service'
import { AiConfig } from './ai.config'
import { AI_PROVIDER, AI_SLEEP, toDbProvider } from './ai.constants'
import { AiCancelledError, AiError } from './ai.errors'
import { AiRepository } from './ai.repository'
import type { AiCallerContext, AiSleep, ExtractionProvider, ProviderCallOptions, Tokens } from './ai.types'
import { AiRateLimiter, type RateBucket } from './limits/rate-limiter'
import { Semaphore } from './limits/semaphore'
import { costSenOf, priceFor } from './pricing'
import { withRetry } from './retry'

export interface PipelineCall<T extends Tokens> {
  purpose: AiCallPurpose
  ctx: AiCallerContext
  signal?: AbortSignal | undefined
  /** Pages sent (0 for text-only operations). */
  pages: number
  /** Manage an `ai_extraction_runs` row for this call. */
  run?: 'extract_paper' | 'suggest_tags'
  /** The provider call, on input that is already redacted. */
  call: (options: ProviderCallOptions) => Promise<T>
}

/**
 * The one path every provider call takes (extractPaper, suggestTags, generateText, health check), so that every rule
 * applies to every operation and every adapter in the same way:
 *
 *   budget guard -> rate limits (global, user, school) -> [per attempt: concurrency slot -> budget re-check -> (first
 *   attempt) run start -> call with timeout] -> backoff sleep without a slot -> ... -> ONE usage row (priced from the table)
 *   -> run end -> 80% notification.
 *
 * A refused call (budget, rate limit) costs nothing and writes no usage row and no run. A call that fails with no reply
 * (network error, 429, 5xx, timeout) writes no usage row, because nothing was billed; its run ends `failed` with the
 * AI_* code. A 2xx reply that cannot be used WAS billed: it writes one usage row with its tokens and cost (per such
 * attempt) before the run ends `failed`.
 */
@Injectable()
export class AiCallPipeline {
  private readonly logger = new Logger(AiCallPipeline.name)
  private readonly semaphore: Semaphore
  private readonly limiter: AiRateLimiter
  private readonly warnedUnpriced = new Set<string>()

  constructor(
    @Inject(AI_PROVIDER) readonly provider: ExtractionProvider,
    @Inject(AiConfig) private readonly config: AiConfig,
    @Inject(AiBudgetService) private readonly budget: AiBudgetService,
    @Inject(AiRepository) private readonly repo: AiRepository,
    @Inject(AiRunsService) private readonly runs: AiRunsService,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AI_SLEEP) private readonly sleep: AiSleep,
  ) {
    this.semaphore = new Semaphore(config.maxConcurrency)
    this.limiter = new AiRateLimiter(() => this.clock.now().getTime())
    if (config.prices.problem) this.logger.warn(config.prices.problem)
  }

  /** Concurrency counters (tests and diagnostics). */
  get concurrency(): { inFlight: number; waiting: number; peak: number; max: number } {
    return { inFlight: this.semaphore.inFlight, waiting: this.semaphore.waiting, peak: this.semaphore.peak, max: this.semaphore.max }
  }

  async execute<T extends Tokens>(args: PipelineCall<T>): Promise<{ value: T; usage: AiUsage }> {
    const provider = this.provider
    if (!provider.isConfigured()) throw AiError.notConfigured()
    if (args.signal?.aborted) throw new AiCancelledError()

    await this.budget.assertAvailable(provider.id)
    await this.enforceLimits(args.ctx)

    // The run starts only once the call really gets a slot and the budget is re-checked (below), so a call that is queued
    // behind others and then refused leaves no run behind.
    let runId: string | null = null
    const billedTotals = { pages: 0, tokensIn: 0, tokensOut: 0, costSen: 0 }
    const log = async (usage: { pages: number; tokensIn: number; tokensOut: number; costSen: number }): Promise<void> => {
      await this.repo.insertUsage({
        runId,
        batchId: args.ctx.batchId ?? null,
        actorId: args.ctx.actorId ?? null,
        provider: toDbProvider(provider.id),
        model: provider.model,
        purpose: args.purpose,
        pages: usage.pages,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        costSen: usage.costSen,
        at: this.clock.now(),
      })
    }

    /**
     * Before every attempt (the first and each retry): take a concurrency slot, then check the budget again, because the
     * cap may have been reached while this call was queued or sleeping in a backoff. The slot is held for the provider
     * call only, never for a backoff sleep.
     */
    const gate = async (): Promise<() => void> => {
      const release = await this.semaphore.acquire(args.signal)
      try {
        await this.budget.assertAvailable(provider.id)
        if (runId === null && args.run) {
          runId = await this.runs.begin({
            kind: args.run,
            provider: provider.id,
            model: provider.model,
            batchId: args.ctx.batchId ?? null,
            requestedById: args.ctx.actorId ?? null,
            runId: args.ctx.runId ?? null,
          })
        }
      } catch (err) {
        release()
        throw err
      }
      return release
    }

    try {
      const { value } = await withRetry((o) => args.call(o), {
        maxRetries: this.config.maxRetries,
        baseMs: this.config.retryBaseMs,
        maxMs: this.config.retryMaxMs,
        timeoutMs: this.config.timeoutMs,
        sleep: this.sleep,
        random: Math.random,
        signal: args.signal,
        gate,
        // A 2xx reply that cannot be used was billed all the same: one usage row per such attempt.
        onBilled: async (billed) => {
          const usage = this.price(billed, args.pages)
          billedTotals.pages += usage.pages
          billedTotals.tokensIn += usage.tokensIn
          billedTotals.tokensOut += usage.tokensOut
          billedTotals.costSen += usage.costSen
          try {
            await log(usage)
          } catch {
            this.logger.warn('usage row of an unusable reply could not be written')
          }
        },
        // The usage row is written while the slot is still held: a queued call re-checks the budget only after it.
        onSuccess: async (v) => {
          await log(this.price(v, args.pages))
        },
      })
      const usage = this.price(value, args.pages)
      if (runId) await this.runs.succeed(runId, { pages: usage.pages, tokensIn: usage.tokensIn + billedTotals.tokensIn, tokensOut: usage.tokensOut + billedTotals.tokensOut, costSen: usage.costSen + billedTotals.costSen })
      await this.budget.afterCall(provider.id)
      return { value, usage: { provider: provider.id, model: provider.model, ...usage } }
    } catch (err) {
      if (runId) {
        if (err instanceof AiCancelledError) await this.runs.cancel(runId).catch(() => undefined)
        else await this.runs.fail(runId, err instanceof AiError ? err.code : 'AI_PROVIDER_ERROR', billedTotals.tokensIn + billedTotals.tokensOut > 0 ? billedTotals : undefined).catch(() => undefined)
      }
      throw err
    }
  }

  private price(value: Tokens, pages: number): { pages: number; tokensIn: number; tokensOut: number; costSen: number } {
    const base = { pages, tokensIn: value.tokensIn, tokensOut: value.tokensOut }
    if (this.provider.id === 'mock') return { ...base, costSen: 0 }
    const entry = priceFor(this.config.prices.table, this.provider.id, this.provider.model)
    if (!entry) {
      const key = `${this.provider.id}:${this.provider.model}`
      if (!this.warnedUnpriced.has(key)) {
        this.warnedUnpriced.add(key)
        this.logger.warn(`no price in AI_PRICE_TABLE_JSON for provider=${this.provider.id} model=${this.provider.model}; cost recorded as 0`)
      }
      return { ...base, costSen: 0 }
    }
    return { ...base, costSen: costSenOf(entry, base) }
  }

  private async enforceLimits(ctx: AiCallerContext): Promise<void> {
    const buckets: RateBucket[] = [{ key: 'global', limit: this.config.ratePerMin }]
    if (ctx.actorId) {
      buckets.push({ key: `user:${ctx.actorId}`, limit: this.config.ratePerUserPerMin })
      const schoolId = await this.users
        .get(ctx.actorId)
        .then((u) => u?.schoolId ?? null)
        .catch(() => null)
      if (schoolId) buckets.push({ key: `school:${schoolId}`, limit: this.config.ratePerSchoolPerMin })
    }
    this.limiter.consume(buckets)
  }
}
