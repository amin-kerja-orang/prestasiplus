import { Module } from '@nestjs/common'

import { BattleCoreModule } from './battle-core.module'
import { BattleArenaModule } from './arena'
import { BattleQueueModule } from './queue'
import { BattleStandingsModule } from './standings'
import { BattleTournamentsModule } from './tournaments'

/**
 * Battle (M16 battle part, BE-44): queue/invitations/forfeit, the arena, standings/history/school page and
 * tournaments, one sub-module per folder. Exports `BattleReadService` (`countFor`, `windowCounts`, `hasBattled`) for
 * BE-20, BE-22 and BE-45. Fidelity and routes: docs/plan/backend-tasks/BE-44-battle.md. Hand-off notes: ./README.md.
 */
@Module({
  imports: [BattleCoreModule, BattleQueueModule, BattleArenaModule, BattleStandingsModule, BattleTournamentsModule],
  exports: [BattleCoreModule],
})
export class BattleModule {}
