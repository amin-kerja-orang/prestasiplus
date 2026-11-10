import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { LATIH_TUBI_LANE_SCOPE, OverviewCache } from './overview-cache'
import { ServabilityReadsService } from './servability-reads.service'

/** The warm-up starts this long after boot, after the overview warm-up has taken its place in the database queue. */
export const LANE_WARM_DELAY_MS = 5_000

/**
 * Fills the two bank-wide counts of the admin Latih Tubi lane (13 s on UAT's 450 thousand questions) once when the application starts, so the first admin who
 * opens the lane does not wait for them. Not awaited, a failure only logs. Same switch as the overview warm-up (`SERVABILITY_OVERVIEW_WARM=true|false`; unset
 * means on in production and off elsewhere). Once per API instance, a few seconds after the overview warm-up so the two do not compete.
 */
@Injectable()
export class LatihTubiLaneWarmer implements OnApplicationBootstrap {
  private readonly logger = new Logger(LatihTubiLaneWarmer.name)

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(OverviewCache) private readonly cache: OverviewCache,
    @Inject(ServabilityReadsService) private readonly reads: ServabilityReadsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.enabled()) return
    setTimeout(() => {
      // Same compute function as the route, so a reader that arrives meanwhile joins this single flight.
      void this.cache.get(() => this.reads.latihTubiLaneCounts(), LATIH_TUBI_LANE_SCOPE).then(
        () => this.logger.log('servability latih-tubi lane counts warmed'),
        (e: unknown) => this.logger.warn(`servability latih-tubi lane warm-up failed: ${e instanceof Error ? e.message : String(e)}`),
      )
    }, LANE_WARM_DELAY_MS).unref()
  }

  private enabled(): boolean {
    const flag = this.config.get<string>('SERVABILITY_OVERVIEW_WARM')
    return flag === undefined || flag === '' ? this.config.get<string>('NODE_ENV') === 'production' : flag === 'true'
  }
}
