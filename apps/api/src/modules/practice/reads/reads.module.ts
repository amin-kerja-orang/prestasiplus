import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { PerformanceModule } from '../../reports/performance/performance.module'
import { PerformancePorts } from '../../reports/performance/ports'
import { PracticeAnalyticsReadsModule } from './analytics/analytics.module'
import { PracticeOverviewReadsModule } from './overview/overview.module'
import { PerformancePracticeReadAdapter } from './performance-practice-read.adapter'
import { PracticeTargetsStructuredModule } from './writes/writes.module'

/**
 * Practice read models (M05 reads, BE-13): the learner read routes and the two small writes around them
 * (`PUT /spm-targets`, `POST /practice/structured/:id/attempts`). Every figure is the caller's own and is
 * computed from the answer rows' dimensions (v2-data-migration 4.4), never from a live join to `questions`.
 * BE-12's tables are read only (no writes to BE-12's tables).
 *
 * On init it binds `PerformancePracticeReadAdapter` into BE-19's `PerformancePorts` (the reports'
 * `PracticeReadPort`: rankings, practice leaderboard, public profile).
 */
@Module({
  imports: [PracticeOverviewReadsModule, PracticeAnalyticsReadsModule, PracticeTargetsStructuredModule, PerformanceModule],
  providers: [PerformancePracticeReadAdapter],
})
export class PracticeReadsModule implements OnModuleInit {
  constructor(
    @Inject(PerformancePorts) private readonly performance: PerformancePorts,
    @Inject(PerformancePracticeReadAdapter) private readonly practiceRead: PerformancePracticeReadAdapter,
  ) {}

  /** Binds the real practice read port of BE-19's reports (once; `providePractice` throws on a second call). */
  onModuleInit(): void {
    this.performance.providePractice(this.practiceRead)
  }
}
