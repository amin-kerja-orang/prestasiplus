import { Module, type OnModuleInit } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { CurriculumModule } from '../curriculum'
import { PracticeModule, PracticePorts } from '../practice'
import { QuestionsModule } from '../questions'
import { WalletModule, WalletService } from '../wallet'
import { SpmCatalogService } from './catalog.service'
import { DutaController } from './duta.controller'
import { DutaService } from './duta.service'
import { SpmHistoryService } from './history.service'
import { SpmHubService } from './hub.service'
import { SpmMockService } from './mock.service'
import { SpmMocksController } from './mocks.controller'
import { SpmPoolService } from './pool.service'
import { SPM_COIN_SOURCES } from './config'
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
  imports: [ThrottleModule, CurriculumModule, QuestionsModule, PracticeModule, WalletModule],
  controllers: [SpmController, SpmMocksController, WalkthroughController, DutaController],
  providers: [
    SpmRepository,
    SpmCatalogService,
    SpmPoolService,
    SpmTrackingService,
    SpmHubService,
    SpmHistoryService,
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
    private readonly ports: SpmPorts,
    private readonly repo: SpmRepository,
    private readonly wallet: WalletService,
  ) {}

  onModuleInit(): void {
    this.practicePorts.provideRamalan(this.tracking)
    this.ports.providePapers({ countPublishedSubjektif: () => this.repo.countPublishedSubjektifPapers() })
    // S3-T07 part F: the Syiling tiles read the M14 ledger (`quiz_spm`), never `practice_answers`. The answer-store and history
    // adapters belong to `practice/` (S5) and are bound by `PracticeSpmReadsModule`.
    this.ports.provideCoins({ earnedCoins: (userId, options) => this.wallet.earnedFromSources(userId, SPM_COIN_SOURCES, { includeTest: options.includeTest }) })
  }
}
