import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SpmCatalogService } from './catalog.service'
import { mapBounded } from './hub.service'
import { SpmPoolService } from './pool.service'

/** The warm-up starts this long after boot, so the migrations and the first requests of a deploy are not competing with it. */
export const POOL_WARM_DELAY_MS = 3_000
/** Subjects counted at the same time by the warm-up (each is one bank-wide count). */
export const POOL_WARM_PARALLEL = 2

/**
 * Fills the SPM pool counts (Latih Tubi cells and Databank count of every configured subject) once when the application starts, so the first pupil
 * who opens the SPM hub does not wait for them (about 20 bank-wide counts: 18 s on UAT's 450 thousand questions before the fixes). Never blocks start-up
 * and a failure only logs: the first reader then computes as before. Same switch as the admin overview warm-up: `SERVABILITY_OVERVIEW_WARM=true|false`;
 * unset means on in production and off elsewhere, so the specs and local runs do not start a bank-wide read nobody asked for. Once per API instance.
 */
@Injectable()
export class SpmPoolWarmer implements OnApplicationBootstrap {
  private readonly logger = new Logger(SpmPoolWarmer.name)

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(SpmCatalogService) private readonly catalog: SpmCatalogService,
    @Inject(SpmPoolService) private readonly pool: SpmPoolService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.enabled()) return
    setTimeout(() => {
      void this.warm().then(
        () => this.logger.log('spm pool counts warmed'),
        (e: unknown) => this.logger.warn(`spm pool warm-up failed: ${e instanceof Error ? e.message : String(e)}`),
      )
    }, POOL_WARM_DELAY_MS).unref()
  }

  /** The same reads the hub makes, so what it finds is what this filled. */
  async warm(): Promise<void> {
    const subjects = await this.catalog.spmSubjects()
    await mapBounded(subjects, POOL_WARM_PARALLEL, async (s) => {
      await this.pool.latihTubiCells(s.subjectId)
      if (s.databankOrder !== null) await this.pool.databankCount(s.subjectId)
    })
  }

  private enabled(): boolean {
    const flag = this.config.get<string>('SERVABILITY_OVERVIEW_WARM')
    return flag === undefined || flag === '' ? this.config.get<string>('NODE_ENV') === 'production' : flag === 'true'
  }
}
