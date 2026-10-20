import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { BattleCoreModule } from '../battle-core.module'
import { TournamentsController } from './tournaments.controller'
import { TournamentsService } from './tournaments.service'

/** Battle tournaments (BE-44): banner, list, form options, create (admin) and detail. Shared providers come from `BattleCoreModule`. */
@Module({
  imports: [BattleCoreModule, ThrottleModule],
  controllers: [TournamentsController],
  providers: [TournamentsService],
})
export class BattleTournamentsModule {}
