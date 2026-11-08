import { Module } from '@nestjs/common'

import { BattleCoreModule } from '../battle-core.module'
import { BattleEngine } from './battle-engine.service'

/** Shared battle logic of the queue and arena sub-modules (creation of a battle, bots, M14 report). */
@Module({ imports: [BattleCoreModule], providers: [BattleEngine], exports: [BattleEngine] })
export class BattleEngineModule {}
