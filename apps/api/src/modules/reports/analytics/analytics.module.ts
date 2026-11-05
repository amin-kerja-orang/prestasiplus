import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { ClassesModule } from '../../classes'
import { CurriculumModule } from '../../curriculum'
import { GamesModule } from '../../games'
import { QuestionsModule } from '../../questions'
import { UsersModule } from '../../users'
import { AnalyticsRepository } from './analytics.repository'
import { AdminCentralController, MonitoringReportsController, TeacherReportsController } from './http/analytics.controllers'
import { ItemAnalysisService } from './services/item-analysis.service'
import { AdminCentralService, MonitoringService } from './services/monitoring.service'
import { ReportService } from './services/report.service'
import { StudentDetailService } from './services/student-detail.service'

/**
 * M11 teacher analytics and monitoring (BE-20, 7 read routes). The only table is `monitoring_flags` (migration 0023,
 * read here); everything else is computed from users, schools, classes (through `ClassesRepository`), practice and the
 * question bank. Not to be confused with BE-19's `PerformanceModule` (`/analytics/*`).
 */
@Module({
  imports: [ThrottleModule, ClassesModule, UsersModule, CurriculumModule, QuestionsModule, GamesModule],
  controllers: [MonitoringReportsController, TeacherReportsController, AdminCentralController],
  providers: [AnalyticsRepository, MonitoringService, AdminCentralService, StudentDetailService, ReportService, ItemAnalysisService],
  exports: [AnalyticsRepository],
})
export class AnalyticsReportsModule {}
