import { Module } from '@nestjs/common'

import { GamesCoreModule } from '../core/core.module'
import { LeaguesController } from './leagues.controller'
import { LeaguesRepository } from './leagues.repository'
import { LeaguesService } from './leagues.service'
import { SekolahBersaingController } from './sekolah-bersaing.controller'

/** Leagues area (BE-45 agent D): leagues (list/create/join/detail) and the Sekolah Bersaing board. */
@Module({
  imports: [GamesCoreModule],
  controllers: [LeaguesController, SekolahBersaingController],
  providers: [LeaguesService, LeaguesRepository],
  exports: [],
})
export class LeaguesModule {}
