import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum/curriculum.module'
import { FilesModule } from '../../files'
import { SchoolsModule } from '../../schools'
import { UsersModule } from '../../users'
import { UsersDirectoryAdapter } from './adapters'
import { HeadcountFactsService } from './headcount/headcount-facts.service'
import { HeadcountController } from './headcount/headcount.controllers'
import { HeadcountRepository } from './headcount/headcount.repository'
import { HeadcountService } from './headcount/headcount.service'
import { CtxFactory } from './http/request'
import { AnalyticsController, ItemAnalysisController, PerformanceController } from './http/performance.controllers'
import { PublicStudentController, SocialController } from './http/social.controllers'
import { PerformancePorts, DIRECTORY_PORT, TIMELINE_READ_PORT } from './ports'
import {
  AnalyticsService,
  ClassPerformanceService,
  ItemAnalysisService,
  LeaderboardService,
  PublicProfileService,
  RankingService,
  SchoolPerformanceService,
  StatsService,
  StudentPerformanceService,
  WeeklyReportService,
} from './services'
import { TimelineReadAdapter } from './timeline/timeline-read.adapter'
import { TimelineUploadInterceptor } from './timeline/timeline-upload.interceptor'
import { TimelineController } from './timeline/timeline.controllers'
import { TimelineRepository } from './timeline/timeline.repository'
import { TimelineService } from './timeline/timeline.service'

/**
 * Prestasi, Analitik and Analisa Item (BE-19 slice, 12 read routes) over the Bijak aggregate.
 * No tables and no writes. BE-16 calls `PerformancePorts.provideBijak(...)` and BE-17 calls
 * `provideClasses(...)` from their own `onModuleInit`; until then every route answers the contract's
 * empty payload. The services and ports are exported for BE-21.
 */
@Module({
  imports: [AuditModule, ThrottleModule, UsersModule, SchoolsModule, CurriculumModule, FilesModule],
  controllers: [AnalyticsController, PerformanceController, ItemAnalysisController, SocialController, PublicStudentController, HeadcountController, TimelineController],
  providers: [
    PerformancePorts,
    { provide: DIRECTORY_PORT, useClass: UsersDirectoryAdapter },
    CtxFactory,
    StatsService,
    AnalyticsService,
    StudentPerformanceService,
    SchoolPerformanceService,
    ClassPerformanceService,
    ItemAnalysisService,
    RankingService,
    LeaderboardService,
    PublicProfileService,
    WeeklyReportService,
    HeadcountRepository,
    HeadcountService,
    TimelineRepository,
    TimelineService,
    TimelineUploadInterceptor,
    { provide: TIMELINE_READ_PORT, useClass: TimelineReadAdapter },
    HeadcountFactsService,
  ],
  exports: [
    PerformancePorts,
    StatsService,
    AnalyticsService,
    StudentPerformanceService,
    SchoolPerformanceService,
    ClassPerformanceService,
    ItemAnalysisService,
    HeadcountFactsService,
  ],
})
export class PerformanceModule {}
