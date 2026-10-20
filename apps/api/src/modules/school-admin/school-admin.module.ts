import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { ClassesModule } from '../classes'
import { PerutusanModule } from '../content/perutusan'
import { NotificationsModule } from '../notifications'
import { PerformanceModule, SchoolPerformanceService } from '../reports/performance'
import { SchoolsModule } from '../schools'
import { SubscriptionsModule } from '../subscriptions'
import { UsersModule } from '../users'
import { AmaranModule } from './amaran/amaran.module'
import { DashboardService } from './dashboard.service'
import { PeopleModule } from './people/people.module'
import { PendingTeachersService } from './pending-teachers.service'
import { SchoolReportsModule } from './reports/school-reports.module'
import { SchoolAdminController } from './school-admin.controller'
import { SCHOOL_CLASS_COUNT_PORT, SCHOOL_PERFORMANCE_PORT } from './school-admin.ports'
import { SchoolClassesAdapter } from './school-classes.adapter'

/**
 * Admin Sekolah slice of BE-21 (M27): the school dashboard and the pending-teacher verification. No tables of its own.
 * The Bijak figures come from BE-19's `SchoolPerformanceService` through `SCHOOL_PERFORMANCE_PORT`; the class count comes from
 * BE-17's `ClassesRepository` through `SCHOOL_CLASS_COUNT_PORT` (`SchoolClassesAdapter`).
 */
@Module({
  imports: [AuditModule, ClassesModule, ThrottleModule, NotificationsModule, PerformanceModule, PerutusanModule, SchoolsModule, SubscriptionsModule, UsersModule, PeopleModule, SchoolReportsModule, AmaranModule],
  // SchoolAdminController is registered first: guru/pending must match before any guru/:id of the sub-modules.
  controllers: [SchoolAdminController],
  providers: [
    DashboardService,
    PendingTeachersService,
    { provide: SCHOOL_PERFORMANCE_PORT, useExisting: SchoolPerformanceService },
    { provide: SCHOOL_CLASS_COUNT_PORT, useClass: SchoolClassesAdapter },
  ],
})
export class SchoolAdminModule {}
