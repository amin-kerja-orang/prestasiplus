import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { OverviewService } from './overview.service'

/** The warm-up starts this long after boot, so the migrations and the first requests of a deploy are not competing with it. */
export const BANK_WARM_DELAY_MS = 2_000

/**
 * Fills the grouped bank counts (the pupil dashboard and the practice subject cards read them) once when the application starts, so the first pupil does not
 * wait for the counting statement (3.8 s on UAT's 450 thousand questions before the fixes). Never blocks start-up and a failure only logs. Same switch as the
 * admin overview warm-up: `SERVABILITY_OVERVIEW_WARM=true|false`; unset means on in production and off elsewhere (specs and local runs do not start it).
 */
@Injectable()
export class BankCountsWarmer implements OnApplicationBootstrap {
  private readonly logger = new Logger(BankCountsWarmer.name)

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(OverviewService) private readonly overview: OverviewService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.enabled()) return
    setTimeout(() => {
      void this.overview.warm().then(
        () => this.logger.log('practice bank counts warmed'),
        (e: unknown) => this.logger.warn(`practice bank counts warm-up failed: ${e instanceof Error ? e.message : String(e)}`),
      )
    }, BANK_WARM_DELAY_MS).unref()
  }

  private enabled(): boolean {
    const flag = this.config.get<string>('SERVABILITY_OVERVIEW_WARM')
    return flag === undefined || flag === '' ? this.config.get<string>('NODE_ENV') === 'production' : flag === 'true'
  }
}
