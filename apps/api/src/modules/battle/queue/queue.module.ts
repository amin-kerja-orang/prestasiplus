import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { BattleCoreModule } from '../battle-core.module'
import { BattleEngineModule } from '../engine'
import { ForfeitService } from './forfeit.service'
import { InvitationsController } from './invitations.controller'
import { InvitationsService } from './invitations.service'
import { QueueController } from './queue.controller'
import { QueueCancelController } from './queue-cancel.controller'
import { QueueService } from './queue.service'

/** Battle queue, invitations and forfeit (BE-44, routes M16-02 to M16-14). */
@Module({
  imports: [ThrottleModule, BattleCoreModule, BattleEngineModule],
  controllers: [QueueController, QueueCancelController, InvitationsController],
  providers: [QueueService, InvitationsService, ForfeitService],
})
export class BattleQueueModule {}
