import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { AuthModule } from '../auth'
import { ClassesModule } from '../classes'
import { SchoolsModule } from '../schools'
import { IcService } from '../users/credentials'
import { UsersModule } from '../users'
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
 * `COMP_CLASSROOM_PORT` is the seam to the classroom owner: ClassesModule (BE-17) provides and exports the real one.
 */
@Module({
  imports: [AuditModule, AuthModule, ClassesModule, SchoolsModule, ThrottleModule, UsersModule],
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
  ],
  exports: [SubscriptionService, QuotaService, SubscriptionsRepository],
})
export class SubscriptionsModule {}
