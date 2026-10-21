import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { AuthModule } from '../../auth'
import { ClassesModule } from '../../classes'
import { SchoolsModule } from '../../schools'
import { UsersModule } from '../../users'
import { ManagedUsersService } from './managed-users.service'
import { PupilsController } from './pupils.controller'
import { PupilsService } from './pupils.service'
import { TeachersController } from './teachers.controller'
import { TeachersService } from './teachers.service'

/**
 * Teachers and pupils of the school (BE-21 Part A, 14 routes under `/admin-sekolah/guru` and `/admin-sekolah/pelajar`).
 * No tables of its own: users, classes, schools and audit go through their owners' repositories.
 */
@Module({
  imports: [AuditModule, AuthModule, ClassesModule, SchoolsModule, ThrottleModule, UsersModule],
  controllers: [TeachersController, PupilsController],
  providers: [ManagedUsersService, TeachersService, PupilsService],
})
export class PeopleModule {}
