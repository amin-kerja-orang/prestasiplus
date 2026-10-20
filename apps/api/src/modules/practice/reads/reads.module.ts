import { Module } from '@nestjs/common'

import { PracticeAnalyticsReadsModule } from './analytics/analytics.module'
import { PracticeOverviewReadsModule } from './overview/overview.module'
import { PracticeTargetsStructuredModule } from './writes/writes.module'

/**
 * Practice read models (M05 reads, BE-13): the learner read routes and the two small writes around them
 * (`PUT /spm-targets`, `POST /practice/structured/:id/attempts`). Every figure is the caller's own and is
 * computed from the answer rows' dimensions (v2-data-migration 4.4), never from a live join to `questions`.
 * BE-12's tables are read only (no writes to BE-12's tables).
 */
@Module({
  imports: [PracticeOverviewReadsModule, PracticeAnalyticsReadsModule, PracticeTargetsStructuredModule],
})
export class PracticeReadsModule {}
