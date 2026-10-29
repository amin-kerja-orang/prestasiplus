import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { AuthModule } from '../auth'
import { ParentLinksModule } from '../parents/parent-links.module'
import { SchoolsModule } from '../schools'
import { IcService } from './credentials'
import { ImportJobsRepository, UserImportService } from './import'
import { LookupsController } from './lookups.controller'
import { ThrottleModule } from '../../common/throttle'
import { UsersController } from './users.controller'
import { UsersPorts } from './users.ports'
import { UsersRepository } from './users.repository'
import { UsersService } from './users.service'

/**
 * Users and bulk import (BE-05 part A). Exports `UsersRepository` (`get`, `findByEmail`, `search`)
 * for the other cards (ADR-0014) and `ImportJobsRepository` plus the import helpers for BE-25. `UsersPorts` is
 * the holder the classes module binds its teacher-classes read into (the teacher classrooms lookup).
 */
@Module({
  imports: [AuditModule, AuthModule, SchoolsModule, ThrottleModule, ParentLinksModule],
  controllers: [UsersController, LookupsController],
  providers: [UsersPorts, UsersRepository, ImportJobsRepository, UsersService, UserImportService, IcService],
  exports: [UsersRepository, ImportJobsRepository, UsersPorts],
})
export class UsersModule {}
