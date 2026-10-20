import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { ClassesModule } from '../../classes'
import { AnalyticsRepository } from './analytics.repository'
import { MonitoringReportsController, TeacherReportsController } from './http/analytics.controllers'
import { ItemAnalysisService } from './services/item-analysis.service'
import { MonitoringService } from './services/monitoring.service'
import { ReportService } from './services/report.service'
import { StudentDetailService } from './services/student-detail.service'

/**
 * M11 teacher analytics and monitoring (BE-20, 7 read routes). The only table is `monitoring_flags` (migration 0023,
 * read here); everything else is computed from users, schools, classes (through `ClassesRepository`), practice and the
 * question bank. Not to be confused with BE-19's `PerformanceModule` (`/analytics/*`).
 */
@Module({
  imports: [ThrottleModule, ClassesModule],
  controllers: [MonitoringReportsController, TeacherReportsController],
  providers: [AnalyticsRepository, MonitoringService, StudentDetailService, ReportService, ItemAnalysisService],
  exports: [AnalyticsRepository],
})
export class AnalyticsReportsModule {}
