import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { NotificationsController } from './notifications.controller'
import { NotificationsRepository } from './notifications.repository'
import { NotificationsService } from './notifications.service'

/**
 * M01 notification inbox (BE-06 part B). Exports `NotificationsService` (`push`) for the modules
 * that notify users (BE-24, BE-36, the account flows).
 */
@Module({
  imports: [ThrottleModule],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
