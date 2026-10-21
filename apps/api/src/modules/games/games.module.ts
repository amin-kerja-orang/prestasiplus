import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { CurriculumModule } from '../curriculum'
import { QuestionsModule } from '../questions'
import { SchoolsModule } from '../schools'
import { UsersModule } from '../users'
import { WalletModule } from '../wallet'
import { GamesCoreModule } from './core/core.module'
import { LeaguesModule } from './leagues/leagues.module'
import { RoomsModule } from './rooms/rooms.module'
import { SoloGamesModule } from './solo/solo.module'

/**
 * Games and competitions (BE-45, M16 part 2). Exports the shared core (ports, `GameReadService`) for BE-13 / BE-20 /
 * BE-23 / BE-44 bindings.
 *
 * ROUTE ORDER: Express matches in registration order. `SoloGamesModule` is imported BEFORE `RoomsModule`, so the
 * static paths (`/games/solo/...`, `/games/roda-nasib`, `/games/jutawan`, `/games/pertandingan`, `/games/uji-minda`)
 * win over `/games/:game/...` of the rooms controller. `GET /games/hub` lives in `RoomsModule`: declare it before
 * any `:game` route in that controller (it is a different tail from `/games/:game/lobby`, but keep it first).
 * Do not reorder the imports below.
 */
@Module({
  imports: [
    ThrottleModule,
    WalletModule,
    QuestionsModule,
    CurriculumModule,
    UsersModule,
    SchoolsModule,
    GamesCoreModule,
    SoloGamesModule,
    RoomsModule,
    LeaguesModule,
  ],
  exports: [GamesCoreModule],
})
export class GamesModule {}
