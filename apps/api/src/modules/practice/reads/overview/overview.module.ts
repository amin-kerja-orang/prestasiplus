import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { BannersModule } from '../../../content/banners/banners.module'
import { CurriculumModule, CurriculumPorts } from '../../../curriculum'
import { QuestionsModule } from '../../../questions'
import { SubscriptionsModule } from '../../../subscriptions'
import { UsersModule } from '../../../users'
import { WalletModule } from '../../../wallet'
import { OverviewController } from './overview.controller'
import { OverviewRepository } from './overview.repository'
import { DEFAULT_OVERVIEW_OPTIONS, OVERVIEW_OPTIONS, OverviewService } from './overview.service'
import { OverviewTopicProgress } from './topic-progress.provider'

/**
 * BE-13 overview reads: dashboard (S1), practice subjects (S2, S3), chapter subjects (S4, S5), and the M03
 * topic progress provider (card AC8). It plugs the provider into `CurriculumPorts.provideTopicProgress` from
 * its own `onModuleInit` (the pattern of `providers.ts`); no curriculum file is edited.
 */
@Module({
  imports: [CurriculumModule, QuestionsModule, SubscriptionsModule, UsersModule, WalletModule, BannersModule],
  controllers: [OverviewController],
  providers: [OverviewRepository, OverviewService, OverviewTopicProgress, { provide: OVERVIEW_OPTIONS, useValue: DEFAULT_OVERVIEW_OPTIONS }],
  exports: [OverviewTopicProgress],
})
export class PracticeOverviewReadsModule implements OnModuleInit {
  constructor(
    @Inject(CurriculumPorts) private readonly ports: CurriculumPorts,
    @Inject(OverviewTopicProgress) private readonly progress: OverviewTopicProgress,
  ) {}

  onModuleInit(): void {
    this.ports.provideTopicProgress(this.progress)
  }
}
