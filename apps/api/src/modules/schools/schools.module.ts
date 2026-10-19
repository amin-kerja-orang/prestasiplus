import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { RateLimitGuard, RateLimiter } from './rate-limit'
import { SchoolsAdminController, SchoolsPublicController } from './schools.controller'
import { SchoolsRepository } from './schools.repository'
import { SchoolsService } from './schools.service'

/**
 * Schools, JPN and PPD (BE-05 part B): the admin school routes, the public pickers and the
 * repository other modules use. It exports `SchoolsRepository`, the only doorway to `schools`,
 * `jpns` and `ppds` (ADR-0014).
 */
@Module({
  imports: [AuditModule],
  controllers: [SchoolsAdminController, SchoolsPublicController],
  providers: [SchoolsRepository, SchoolsService, RateLimiter, RateLimitGuard],
  exports: [SchoolsRepository],
})
export class SchoolsModule {}
