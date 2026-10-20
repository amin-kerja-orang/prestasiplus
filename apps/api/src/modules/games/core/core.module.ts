import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { ClassesModule } from '../../classes'
import { CurriculumModule } from '../../curriculum'
import { QuestionsModule } from '../../questions'
import { SchoolsModule } from '../../schools'
import { UsersModule } from '../../users'
import { WalletModule } from '../../wallet'
import { SchoolBotPool } from './bot-pool'
import { GameQuestions } from './game-questions.service'
import { GameReadService } from './game-read.service'
import { GameUsers } from './game-users'
import { NamePrivacy } from './name-privacy.service'
import { GamesPorts } from './ports'
import { GameSubjects } from './subjects'
import { WalletGameRewards } from './wallet-rewards'

/**
 * Shared providers of the games module (BE-45 foundation). Sub-modules (`RoomsModule`, `SoloGamesModule`,
 * `LeaguesModule`) import this module only; it re-exports the owner modules they need (throttle, wallet, questions,
 * curriculum, users, schools), so a sub-module never has to list them. `DbModule` is global.
 */
@Module({
  imports: [ThrottleModule, WalletModule, QuestionsModule, CurriculumModule, UsersModule, SchoolsModule, ClassesModule],
  providers: [WalletGameRewards, SchoolBotPool, GamesPorts, GameSubjects, GameUsers, NamePrivacy, GameQuestions, GameReadService],
  exports: [
    ThrottleModule,
    WalletModule,
    QuestionsModule,
    CurriculumModule,
    UsersModule,
    SchoolsModule,
    GamesPorts,
    GameSubjects,
    GameUsers,
    NamePrivacy,
    GameQuestions,
    GameReadService,
  ],
})
export class GamesCoreModule {}
