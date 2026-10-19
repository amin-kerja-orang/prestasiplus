import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { AuthModule } from '../auth'
import { SchoolsModule } from '../schools'
import { IcService } from './credentials'
import { ImportJobsRepository, UserImportService } from './import'
import { LookupsController } from './lookups.controller'
import { UsersRateLimiter, UsersRateLimitGuard } from './rate-limit'
import { UsersController } from './users.controller'
import { UsersRepository } from './users.repository'
import { UsersService } from './users.service'

/**
 * Users and bulk import (BE-05 part A). Exports `UsersRepository` (`get`, `findByEmail`, `search`)
 * for the other cards (ADR-0014) and `ImportJobsRepository` plus the import helpers for BE-25.
 */
@Module({
  imports: [AuditModule, AuthModule, SchoolsModule],
  controllers: [UsersController, LookupsController],
  providers: [UsersRepository, ImportJobsRepository, UsersService, UserImportService, IcService, UsersRateLimiter, UsersRateLimitGuard],
  exports: [UsersRepository, ImportJobsRepository],
})
export class UsersModule {}
