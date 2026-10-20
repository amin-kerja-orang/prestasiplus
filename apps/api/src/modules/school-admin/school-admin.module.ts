import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { PerutusanModule } from '../content/perutusan'
import { NotificationsModule } from '../notifications'
import { SchoolsModule } from '../schools'
import { SubscriptionsModule } from '../subscriptions'
import { UsersModule } from '../users'
import { DashboardService } from './dashboard.service'
import { PendingTeachersService } from './pending-teachers.service'
import { SchoolAdminController } from './school-admin.controller'
import { NoSchoolClasses, NoSchoolPerformance, SCHOOL_CLASS_COUNT_PORT, SCHOOL_PERFORMANCE_PORT } from './school-admin.ports'

/**
 * Admin Sekolah slice of BE-21 (M27): the school dashboard and the pending-teacher verification. No tables of its own.
 * The Bijak figures and the class count come through ports with fail-closed defaults (see `school-admin.ports.ts`).
 * TODO(BE-19 merge) / TODO(BE-17 merge): replace the two default providers.
 */
@Module({
  imports: [AuditModule, ThrottleModule, NotificationsModule, PerutusanModule, SchoolsModule, SubscriptionsModule, UsersModule],
  controllers: [SchoolAdminController],
  providers: [
    DashboardService,
    PendingTeachersService,
    { provide: SCHOOL_PERFORMANCE_PORT, useClass: NoSchoolPerformance },
    { provide: SCHOOL_CLASS_COUNT_PORT, useClass: NoSchoolClasses },
  ],
})
export class SchoolAdminModule {}
