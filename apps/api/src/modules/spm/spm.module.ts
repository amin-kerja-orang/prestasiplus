import { Module, type OnModuleInit } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { CurriculumModule } from '../curriculum'
import { PracticeModule, PracticePorts } from '../practice'
import { QuestionsModule } from '../questions'
import { SpmCatalogService } from './catalog.service'
import { DutaController } from './duta.controller'
import { DutaService } from './duta.service'
import { SpmHubService } from './hub.service'
import { SpmMockService } from './mock.service'
import { SpmMocksController } from './mocks.controller'
import { SpmPoolService } from './pool.service'
import { SpmPorts } from './ports'
import { SpmController } from './spm.controller'
import { SpmRepository } from './spm.repository'
import { SpmTrackingService } from './tracking.service'
import { WalkthroughController, WalkthroughUploadInterceptor } from './walkthrough.controller'
import { WalkthroughService } from './walkthrough.service'

/**
 * SPM hub (M06, BE-41): Tahun Lepas, Latih Tubi, Tracking A, Subjektif, the SPM mock exam, the simulated
 * walkthrough and the Duta card (provisional, M24). Reads the curriculum, the question bank and practice history
 * through their services only. Binds `SpmTrackingService` to the `ramalan` port of the practice module; exports
 * `SpmPorts` (BE-13 plugs the structured-attempt adapter in from its own `onModuleInit`).
 */
@Module({
  imports: [ThrottleModule, CurriculumModule, QuestionsModule, PracticeModule],
  controllers: [SpmController, SpmMocksController, WalkthroughController, DutaController],
  providers: [
    SpmRepository,
    SpmCatalogService,
    SpmPoolService,
    SpmTrackingService,
    SpmHubService,
    SpmMockService,
    WalkthroughService,
    WalkthroughUploadInterceptor,
    DutaService,
    SpmPorts,
  ],
  exports: [SpmTrackingService, SpmPorts],
})
export class SpmModule implements OnModuleInit {
  constructor(
    private readonly practicePorts: PracticePorts,
    private readonly tracking: SpmTrackingService,
  ) {}

  onModuleInit(): void {
    this.practicePorts.provideRamalan(this.tracking)
  }
}
