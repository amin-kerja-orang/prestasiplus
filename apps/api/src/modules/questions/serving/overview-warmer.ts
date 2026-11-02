import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { OverviewCache } from './overview-cache'
import { ServabilityReadsService } from './servability-reads.service'

/**
 * REQ-B-022(a): fills the H-A21 overview cache once when the application starts, so the first admin does not wait for the cold
 * compute (about 30 s on a bank of 400,000 questions). Never blocks start-up (the compute is not awaited) and a failure only logs:
 * the first reader then computes as before. `SERVABILITY_OVERVIEW_WARM=true|false`; unset means on in production and off elsewhere,
 * so the specs and local runs do not start a bank-wide read nobody asked for.
 *
 * Runs once PER API INSTANCE at boot, with no jitter or leader election (decision A4): R1 runs a single API instance (api-runbook
 * "Single instance"; production-vps section 14; the rate-limit buckets already require it), so there is one warm-up per deploy. If the API
 * is ever scaled out, N instances would each start the bank-wide read at the same time; add jitter or a lock before doing so.
 */
@Injectable()
export class OverviewWarmer implements OnApplicationBootstrap {
  private readonly logger = new Logger(OverviewWarmer.name)

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(OverviewCache) private readonly cache: OverviewCache,
    @Inject(ServabilityReadsService) private readonly reads: ServabilityReadsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.enabled()) return
    // Same compute function as the route, so a reader that arrives meanwhile joins this single flight.
    void this.cache.get(() => this.reads.overview()).then(
      () => this.logger.log('servability overview warmed'),
      (e: unknown) => this.logger.warn(`servability overview warm-up failed: ${e instanceof Error ? e.message : String(e)}`),
    )
  }

  private enabled(): boolean {
    const flag = this.config.get<string>('SERVABILITY_OVERVIEW_WARM')
    return flag === undefined || flag === '' ? this.config.get<string>('NODE_ENV') === 'production' : flag === 'true'
  }
}
