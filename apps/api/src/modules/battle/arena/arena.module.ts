import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { BattleCoreModule } from '../battle-core.module'
import { BattleEngineModule } from '../engine'
import { ArenaController } from './arena.controller'
import { ArenaService } from './arena.service'

/** Battle lobby and arena (BE-44, routes M16-15 to M16-17). */
@Module({
  imports: [ThrottleModule, BattleCoreModule, BattleEngineModule],
  controllers: [ArenaController],
  providers: [ArenaService],
})
export class BattleArenaModule {}
