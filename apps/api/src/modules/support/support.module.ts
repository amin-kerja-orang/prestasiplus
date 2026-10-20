import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { NotificationsModule } from '../notifications'
import { UsersModule } from '../users'
import { SupportConfigController, SupportController } from './support.controller'
import { SupportRepository } from './support.repository'
import { SupportService } from './support.service'

/**
 * Support tickets (M22) and the public support contact (BE-24 part C). Exports `SupportRepository`, the
 * only doorway to `support_tickets` and `support_config` (ADR-0014).
 */
@Module({
  imports: [AuditModule, ThrottleModule, NotificationsModule, UsersModule],
  controllers: [SupportController, SupportConfigController],
  providers: [SupportRepository, SupportService],
  exports: [SupportRepository],
})
export class SupportModule {}
