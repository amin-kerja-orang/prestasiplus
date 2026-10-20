import { Module } from '@nestjs/common'

import { PracticeAnalyticsController } from './analytics.controller'
import { PracticeAnalyticsRepository } from './analytics.repository'
import { PracticeAnalyticsService } from './analytics.service'

/**
 * BE-13: history, progress, corrections, mastery and the revision views (S6-S12). Exports the
 * repository for BE-48 (`chapterAnswerCounts`).
 */
@Module({
  controllers: [PracticeAnalyticsController],
  providers: [PracticeAnalyticsRepository, PracticeAnalyticsService],
  exports: [PracticeAnalyticsRepository],
})
export class PracticeAnalyticsReadsModule {}
