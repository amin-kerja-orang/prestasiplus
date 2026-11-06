import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { LeaguesService } from '../../games/leagues/leagues.service'

/** Default period of the league standings job: 1 hour (FR-GM-15.3). */
export const DEFAULT_LEAGUE_STANDINGS_MS = 3_600_000

/**
 * Hourly league standings (S7-T06 part 3, FR-GM-15.3, AC-GM-15.1/15.4). A plain interval, no `@nestjs/schedule` and no
 * `JobsService.register` (same shape as `PracticeSessionSweeper`). `LEAGUE_STANDINGS_INTERVAL_MS` sets the period
 * (0 = off; off by default under NODE_ENV=test, where specs call `run()` themselves). All SQL lives in
 * `LeaguesService.recomputeStandings`, which writes a league once per clock hour, so several API instances are safe.
 */
@Injectable()
export class LeagueStandingsJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeagueStandingsJob.name)
  private timer: NodeJS.Timeout | undefined
  private running = false

  constructor(
    @Inject(LeaguesService) private readonly leagues: LeaguesService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('LEAGUE_STANDINGS_INTERVAL_MS')
    const parsed = raw === undefined || raw === '' ? undefined : Number.parseInt(String(raw), 10)
    const ms = parsed !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : this.config.get<string>('NODE_ENV') === 'test' ? 0 : DEFAULT_LEAGUE_STANDINGS_MS
    if (ms === 0) return
    this.timer = setInterval(() => void this.run(), ms)
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

  /** One pass; never throws (a failing pass is logged and the next tick tries again). */
  async run(now?: Date): Promise<{ recomputed: number; frozen: number }> {
    if (this.running) return { recomputed: 0, frozen: 0 }
    this.running = true
    try {
      return await this.leagues.recomputeStandings(now)
    } catch (err) {
      this.logger.warn(`League standings job failed: ${err instanceof Error ? err.message : String(err)}`)
      return { recomputed: 0, frozen: 0 }
    } finally {
      this.running = false
    }
  }
}
