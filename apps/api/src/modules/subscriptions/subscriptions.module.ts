import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { AuthModule } from '../auth'
import { SchoolsModule } from '../schools'
import { IcService } from '../users/credentials'
import { UsersModule } from '../users'
import { COMP_CLASSROOM_PORT, NoClassroomsPort } from './comp-students/classroom.port'
import { CompStudentsController } from './comp-students/comp-students.controller'
import { CompStudentsRepository } from './comp-students/comp-students.repository'
import { CompStudentsService } from './comp-students/comp-students.service'
import { QuotaController } from './quota.controller'
import { QuotaService } from './quota.service'
import { StudentImportService } from './student-import.service'
import { SubscriptionService } from './subscription.service'
import { SubscriptionsController } from './subscriptions.controller'
import { SubscriptionsRepository } from './subscriptions.repository'
import { SchoolSubscriptionsService } from './subscriptions.service'
import { UserPackagesController } from './user-packages.controller'
import { UserPackagesService } from './user-packages.service'

/**
 * School subscriptions, quota, student import, user packages and complimentary students (BE-25
 * part A). Exports `SubscriptionService` (`isSubscribed`, `trial`, `incrementTrialUsed`) for BE-12 and
 * the other cards, `QuotaService` and `SubscriptionsRepository` (ADR-0014 doorway to its tables).
 * `COMP_CLASSROOM_PORT` is the seam to the classroom owner (BE-17); the default finds no classroom.
 */
@Module({
  imports: [AuditModule, AuthModule, SchoolsModule, ThrottleModule, UsersModule],
  controllers: [SubscriptionsController, QuotaController, UserPackagesController, CompStudentsController],
  providers: [
    SubscriptionsRepository,
    CompStudentsRepository,
    SchoolSubscriptionsService,
    QuotaService,
    StudentImportService,
    UserPackagesService,
    CompStudentsService,
    SubscriptionService,
    IcService,
    { provide: COMP_CLASSROOM_PORT, useClass: NoClassroomsPort },
  ],
  exports: [SubscriptionService, QuotaService, SubscriptionsRepository, COMP_CLASSROOM_PORT],
})
export class SubscriptionsModule {}
