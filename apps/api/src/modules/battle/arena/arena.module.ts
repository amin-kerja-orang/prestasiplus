import { Module } from '@nestjs/common'

import { BattleCoreModule } from '../battle-core.module'

/**
 * Battle arena (BE-44). Skeleton: the owner of this folder adds its controllers and providers here and nothing else
 * (no edit of `battle.module.ts`). Shared providers (`BattleDeps`, `BattleReadService`, `GAME_RESULT_PORT`,
 * `BattleRawErrorFilter`) come from `BattleCoreModule`.
 */
@Module({
  imports: [BattleCoreModule],
  controllers: [],
  providers: [],
})
export class BattleArenaModule {}
