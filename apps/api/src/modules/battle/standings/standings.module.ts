import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { LeaguesModule } from '../../games/leagues/leagues.module'
import { BattleCoreModule } from '../battle-core.module'
import { LeagueStandingsJob } from './league-standings.job'
import { StandingsController } from './standings.controller'
import { StandingsRepository } from './standings.repository'
import { StandingsService } from './standings.service'

/**
 * Battle standings, school page and history (BE-44, M16-18..21). Shared providers (`BattleDeps`, `BattleReadService`)
 * come from `BattleCoreModule`; the hourly league job (S7-T06 part 3) calls `LeaguesService` from `LeaguesModule`; `PrismaService` and `CLOCK` from the global `DbModule`.
 */
@Module({
  imports: [BattleCoreModule, ThrottleModule, LeaguesModule],
  controllers: [StandingsController],
  providers: [StandingsRepository, StandingsService, LeagueStandingsJob],
})
export class BattleStandingsModule {}
