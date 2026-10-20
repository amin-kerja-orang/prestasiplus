import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum/curriculum.module'
import { SchoolsModule } from '../../schools'
import { UsersModule } from '../../users'
import { UsersDirectoryAdapter } from './adapters'
import { CtxFactory } from './http/request'
import { AnalyticsController, ItemAnalysisController, PerformanceController } from './http/performance.controllers'
import { PerformancePorts, DIRECTORY_PORT } from './ports'
import {
  AnalyticsService,
  ClassPerformanceService,
  ItemAnalysisService,
  SchoolPerformanceService,
  StatsService,
  StudentPerformanceService,
} from './services'

/**
 * Prestasi, Analitik and Analisa Item (BE-19 slice, 12 read routes) over the Bijak aggregate.
 * No tables and no writes. BE-16 calls `PerformancePorts.provideBijak(...)` and BE-17 calls
 * `provideClasses(...)` from their own `onModuleInit`; until then every route answers the contract's
 * empty payload. The services and ports are exported for BE-21.
 */
@Module({
  imports: [ThrottleModule, UsersModule, SchoolsModule, CurriculumModule],
  controllers: [AnalyticsController, PerformanceController, ItemAnalysisController],
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
  ],
  exports: [
    PerformancePorts,
    StatsService,
    AnalyticsService,
    StudentPerformanceService,
    SchoolPerformanceService,
    ClassPerformanceService,
    ItemAnalysisService,
  ],
})
export class PerformanceModule {}
