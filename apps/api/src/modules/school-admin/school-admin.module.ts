import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { PerutusanModule } from '../content/perutusan'
import { NotificationsModule } from '../notifications'
import { PerformanceModule, SchoolPerformanceService } from '../reports/performance'
import { SchoolsModule } from '../schools'
import { SubscriptionsModule } from '../subscriptions'
import { UsersModule } from '../users'
import { DashboardService } from './dashboard.service'
import { PendingTeachersService } from './pending-teachers.service'
import { SchoolAdminController } from './school-admin.controller'
import { NoSchoolClasses, SCHOOL_CLASS_COUNT_PORT, SCHOOL_PERFORMANCE_PORT } from './school-admin.ports'

/**
 * Admin Sekolah slice of BE-21 (M27): the school dashboard and the pending-teacher verification. No tables of its own.
 * The Bijak figures come from BE-19's `SchoolPerformanceService` through `SCHOOL_PERFORMANCE_PORT`; the class count still comes
 * through a port with a fail-closed default (see `school-admin.ports.ts`).
 * TODO(BE-17 merge): replace the class-count default provider.
 */
@Module({
  imports: [AuditModule, ThrottleModule, NotificationsModule, PerformanceModule, PerutusanModule, SchoolsModule, SubscriptionsModule, UsersModule],
  controllers: [SchoolAdminController],
  providers: [
    DashboardService,
    PendingTeachersService,
    { provide: SCHOOL_PERFORMANCE_PORT, useExisting: SchoolPerformanceService },
    { provide: SCHOOL_CLASS_COUNT_PORT, useClass: NoSchoolClasses },
  ],
})
export class SchoolAdminModule {}
