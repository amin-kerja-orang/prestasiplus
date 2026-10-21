import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { BattleCoreModule } from '../battle-core.module'
import { StandingsController } from './standings.controller'
import { StandingsRepository } from './standings.repository'
import { StandingsService } from './standings.service'

/**
 * Battle standings, school page and history (BE-44, M16-18..21). Shared providers (`BattleDeps`, `BattleReadService`)
 * come from `BattleCoreModule`; `PrismaService` and `CLOCK` from the global `DbModule`.
 */
@Module({
  imports: [BattleCoreModule, ThrottleModule],
  controllers: [StandingsController],
  providers: [StandingsRepository, StandingsService],
})
export class BattleStandingsModule {}
