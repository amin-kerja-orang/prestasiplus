import { Module } from '@nestjs/common'

import { GamesCoreModule } from '../core/core.module'

/**
 * Rooms area (agent B): hub, lobby, rooms (create/join/view/start/action), Papan Bijak quick match and the admin
 * game settings routes. Fill `controllers` and `providers`; do not edit any other module file.
 * Hub (`GET /games/hub`) is declared here but its static route must come BEFORE any `:game` param route inside
 * the controller; across modules `SoloGamesModule` is registered before this module (see games.module.ts).
 */
@Module({
  imports: [GamesCoreModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class RoomsModule {}
