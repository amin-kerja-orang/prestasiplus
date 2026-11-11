import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { DatabankService } from './databank.service'

/** The warm-up starts this long after boot, after the other bank warm-ups have taken their place in the database queue. */
export const DATABANK_WARM_DELAY_MS = 8_000

/**
 * Fills the teacher Databank snapshot (the servable set, 1.8 s on UAT's 457 thousand questions) once when the application starts, so the first
 * teacher does not wait for it. Never blocks start-up; a failure only logs. Same switch as the other warm-ups: `SERVABILITY_OVERVIEW_WARM=true|false`
 * (unset means on in production, off elsewhere).
 */
@Injectable()
export class DatabankWarmer implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabankWarmer.name)

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DatabankService) private readonly databank: DatabankService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.enabled()) return
    setTimeout(() => {
      void this.databank.warm().then(
        () => this.logger.log('teacher databank snapshot warmed'),
        (e: unknown) => this.logger.warn(`teacher databank warm-up failed: ${e instanceof Error ? e.message : String(e)}`),
      )
    }, DATABANK_WARM_DELAY_MS).unref()
  }

  private enabled(): boolean {
    const flag = this.config.get<string>('SERVABILITY_OVERVIEW_WARM')
    return flag === undefined || flag === '' ? this.config.get<string>('NODE_ENV') === 'production' : flag === 'true'
  }
}
