import { Module } from '@nestjs/common'

import { GamesCoreModule } from '../core/core.module'

/**
 * Solo area (agent C): single-player games (GET/check/reveal/submit), Roda Nasib (page + spin), Jutawan Ilmu,
 * the weekly competition and Uji Minda. Fill `controllers` and `providers`; do not edit any other module file.
 * Registered BEFORE `RoomsModule` so `/games/solo/...`, `/games/roda-nasib`, `/games/jutawan`,
 * `/games/pertandingan` and `/games/uji-minda` win over `/games/:game/...`.
 */
@Module({
  imports: [GamesCoreModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class SoloGamesModule {}
