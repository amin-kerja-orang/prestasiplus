import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { PracticeRepository } from './practice.repository'

/** A session with no check and no start for this long is abandoned (DM-66, D115). */
export const PRACTICE_IDLE_MS = 2 * 60 * 60 * 1000
/** Sessions abandoned per statement, and the most statements per pass (so one pass moves at most 10 000). */
export const SWEEP_BATCH = 500
export const SWEEP_MAX_ITERATIONS = 20
/** Default period of the scheduled sweep: 5 minutes. */
export const DEFAULT_PRACTICE_SWEEP_MS = 300_000

/**
 * Moves practice sessions idle for 2 hours to `abandoned` (S5-T15, DM-66). A plain interval, no `@nestjs/schedule`
 * (same shape as `AttemptSweeper`). `PRACTICE_SWEEP_INTERVAL_MS` sets the period (0 = off; off by default under
 * NODE_ENV=test, where specs call `sweep()` themselves). Pending checks are kept, no answer row, no reward.
 * Several API instances are safe: the statement locks with SKIP LOCKED and re-checks the status.
 */
@Injectable()
export class PracticeSessionSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PracticeSessionSweeper.name)
  private timer: NodeJS.Timeout | undefined
  private running = false

  constructor(
    @Inject(PracticeRepository) private readonly repo: PracticeRepository,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('PRACTICE_SWEEP_INTERVAL_MS')
    const parsed = raw === undefined || raw === '' ? undefined : Number.parseInt(String(raw), 10)
    const ms = parsed !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : this.config.get<string>('NODE_ENV') === 'test' ? 0 : DEFAULT_PRACTICE_SWEEP_MS
    if (ms === 0) return
    this.timer = setInterval(() => void this.sweep(), ms)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  /** True while the interval timer is armed (for tests). */
  get active(): boolean {
    return this.timer !== undefined
  }

  /** One pass. Loops the batch statement until a short batch (at most 20 rounds); returns how many sessions were abandoned; never throws (a failing pass is logged). */
  async sweep(now: Date = new Date()): Promise<number> {
    if (this.running) return 0
    this.running = true
    try {
      const cutoff = new Date(now.getTime() - PRACTICE_IDLE_MS)
      let total = 0
      for (let i = 0; i < SWEEP_MAX_ITERATIONS; i++) {
        const n = await this.repo.abandonIdle(cutoff, SWEEP_BATCH)
        total += n
        if (n < SWEEP_BATCH) break
      }
      return total
    } catch (err) {
      this.logger.warn(`Practice session sweep failed: ${err instanceof Error ? err.message : String(err)}`)
      return 0
    } finally {
      this.running = false
    }
  }
}
