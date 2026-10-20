import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum/curriculum.module'
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
import { PerformancePorts, DIRECTORY_PORT } from './ports'
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

/**
 * Prestasi, Analitik and Analisa Item (BE-19 slice, 12 read routes) over the Bijak aggregate.
 * No tables and no writes. BE-16 calls `PerformancePorts.provideBijak(...)` and BE-17 calls
 * `provideClasses(...)` from their own `onModuleInit`; until then every route answers the contract's
 * empty payload. The services and ports are exported for BE-21.
 */
@Module({
  imports: [AuditModule, ThrottleModule, UsersModule, SchoolsModule, CurriculumModule],
  controllers: [AnalyticsController, PerformanceController, ItemAnalysisController, SocialController, PublicStudentController, HeadcountController],
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
