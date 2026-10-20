import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { ClassesModule } from '../../classes'
import { CurriculumModule } from '../../curriculum'
import { AnalyticsReportsModule } from '../../reports/analytics'
import { SchoolsModule } from '../../schools'
import { UsersModule } from '../../users'
import { WalletModule } from '../../wallet'
import { ActivityService } from './activity.service'
import { ClassesService } from './classes.service'
import { HeatmapService } from './heatmap.service'
import { MonthlyService } from './monthly.service'
import { SchoolPopulation } from './population'
import { SchoolReportsController } from './school-reports.controller'
import { UsageService } from './usage.service'

/**
 * The five school reports and the class list of the Admin Sekolah (BE-21 Part B). No tables of its own: pupils and teachers come
 * from the users owner and BE-20's `AnalyticsRepository`, classes from BE-17, the DSKP tree from BE-08, coins from BE-11's wallet
 * service. Imported by `SchoolAdminModule` after `SchoolAdminController`, so the static `guru/pending` still wins over any `:id`.
 */
@Module({
  imports: [ThrottleModule, ClassesModule, CurriculumModule, AnalyticsReportsModule, SchoolsModule, UsersModule, WalletModule],
  controllers: [SchoolReportsController],
  providers: [SchoolPopulation, UsageService, ActivityService, MonthlyService, HeatmapService, ClassesService],
})
export class SchoolReportsModule {}
