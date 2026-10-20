import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { BijakAttemptsService } from './attempts.service'

/** Default period of the scheduled sweep. */
export const DEFAULT_SWEEP_SECONDS = 60

/**
 * Closes unattended exam attempts `GRACE_SECONDS` after their deadline (status `auto_submitted`,
 * graded from the last saved answers). It is a plain interval (no `@nestjs/schedule` dependency).
 * `BIJAK_SWEEP_INTERVAL_SECONDS` sets the period (0 = off; off by default under NODE_ENV=test, where
 * specs call `sweep()` themselves). Running it on several API instances is safe: every close takes
 * the attempt row lock and re-checks, so an attempt is graded once. The same close also runs lazily
 * whenever the student (or `history`) touches an expired attempt, so correctness never depends on
 * the timer.
 */
@Injectable()
export class AttemptSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttemptSweeper.name)
  private timer: NodeJS.Timeout | undefined
  private running = false

  constructor(
    @Inject(BijakAttemptsService) private readonly attempts: BijakAttemptsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('BIJAK_SWEEP_INTERVAL_SECONDS')
    const parsed = raw === undefined || raw === '' ? undefined : Number.parseInt(String(raw), 10)
    const seconds = parsed !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : this.config.get<string>('NODE_ENV') === 'test' ? 0 : DEFAULT_SWEEP_SECONDS
    if (seconds === 0) return
    this.timer = setInterval(() => void this.sweep(), seconds * 1000)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  /** One pass. Returns how many attempts were closed; never throws (a failing pass is logged). */
  async sweep(): Promise<number> {
    if (this.running) return 0
    this.running = true
    try {
      return await this.attempts.sweepExpired()
    } catch (err) {
      this.logger.warn(`Attempt sweep failed: ${err instanceof Error ? err.message : String(err)}`)
      return 0
    } finally {
      this.running = false
    }
  }
}
