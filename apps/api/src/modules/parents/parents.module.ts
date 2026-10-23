import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { AuthModule } from '../auth'
import { SchoolsModule } from '../schools'
import { UsersModule } from '../users'
import { ParentLinksModule } from './parent-links.module'
import { ParentsController } from './parents.controller'
import { ParentsService } from './parents.service'

/**
 * Parent invites and parent-student links (BE-25 part B, L45 "Jemput Ibu Bapa"). Exports
 * `ParentsRepository`, the only doorway to `parent_invites` and `parent_links` (ADR-0014).
 */
@Module({
  imports: [AuditModule, AuthModule, SchoolsModule, UsersModule, ThrottleModule, ParentLinksModule],
  controllers: [ParentsController],
  providers: [ParentsService],
  exports: [ParentLinksModule],
})
export class ParentsModule {}
