import { Module } from '@nestjs/common'

import { GamesCoreModule } from '../core/core.module'
import { AdminGamesController } from './admin/admin-games.controller'
import { AdminGamesService } from './admin/admin-games.service'
import { QuickMatchController } from './quick-match.controller'
import { QuickMatchService } from './quick-match.service'
import { RoomSecrets } from './room-secrets'
import { RoomsController } from './rooms.controller'
import { RoomsRepository } from './rooms.repository'
import { RoomsService } from './rooms.service'

/**
 * Rooms area: hub, lobby, rooms (create/join/view/start/action), Papan Bijak quick match and the admin game
 * settings routes. `SoloGamesModule` is registered before this module (see games.module.ts), so the static solo
 * paths win over `/games/:game/...`; `GET /games/hub` is the first route of `RoomsController`.
 */
@Module({
  imports: [GamesCoreModule],
  controllers: [RoomsController, QuickMatchController, AdminGamesController],
  providers: [RoomSecrets, RoomsRepository, RoomsService, QuickMatchService, AdminGamesService],
  exports: [],
})
export class RoomsModule {}
