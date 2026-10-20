import { Module } from '@nestjs/common'

import { CurriculumModule } from '../curriculum'
import { QuestionsModule } from '../questions'
import { SchoolsModule } from '../schools'
import { UsersModule } from '../users'
import { BattleDeps } from './battle.deps'
import { BattleReadService } from './battle-read.service'
import { GAME_RESULT_PORT, NoopGameResultPort } from './game-result.port'
import { BattleRawErrorFilter } from './raw-response'

/**
 * Providers shared by the four battle sub-modules (queue, arena, standings, tournaments). `PrismaService` and `CLOCK`
 * come from the global `DbModule`. Not registered in `modules/index.ts` itself: `BattleModule` imports it.
 */
@Module({
  imports: [UsersModule, SchoolsModule, CurriculumModule, QuestionsModule],
  providers: [BattleDeps, BattleReadService, BattleRawErrorFilter, { provide: GAME_RESULT_PORT, useClass: NoopGameResultPort }],
  exports: [BattleDeps, BattleReadService, BattleRawErrorFilter, GAME_RESULT_PORT],
})
export class BattleCoreModule {}
