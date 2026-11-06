import { Module } from '@nestjs/common'

import { ClassesModule } from '../classes'
import { CurriculumModule } from '../curriculum'
import { PkskModule } from '../pksk'
import { QuestionsModule } from '../questions'
import { SchoolsModule } from '../schools'
import { UsersModule } from '../users'
import { BattleDeps } from './battle.deps'
import { BattleReadService } from './battle-read.service'
import { BattleRawErrorFilter } from './raw-response'

/**
 * Providers shared by the four battle sub-modules (queue, arena, standings, tournaments). `PrismaService` and `CLOCK`
 * come from the global `DbModule`. Not registered in `modules/index.ts` itself: `BattleModule` imports it.
 */
@Module({
  imports: [ClassesModule, UsersModule, SchoolsModule, CurriculumModule, QuestionsModule, PkskModule],
  providers: [BattleDeps, BattleReadService, BattleRawErrorFilter],
  exports: [BattleDeps, BattleReadService, BattleRawErrorFilter],
})
export class BattleCoreModule {}
