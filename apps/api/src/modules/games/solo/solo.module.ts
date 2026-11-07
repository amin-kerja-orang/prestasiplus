import { Module } from '@nestjs/common'

import { GamesCoreModule } from '../core/core.module'
import { JutawanController } from './jutawan/jutawan.controller'
import { JutawanRepository } from './jutawan/jutawan.repository'
import { JutawanService } from './jutawan/jutawan.service'
import { SoloItemBuilder } from './play/solo-items'
import { SoloController } from './play/solo.controller'
import { SoloRepository } from './play/solo.repository'
import { SoloService } from './play/solo.service'
import { SpinController } from './spin/spin.controller'
import { SpinDraw } from './spin/spin-draw'
import { SpinService } from './spin/spin.service'

/**
 * Solo area (agent C): single-player games (GET/check/reveal/submit), Roda Nasib (page + spin), Jutawan Ilmu.
 * Registered BEFORE `RoomsModule` so `/games/solo/...`, `/games/roda-nasib`, `/games/jutawan`
 * win over `/games/:game/...`.
 */
@Module({
  imports: [GamesCoreModule],
  controllers: [SoloController, SpinController, JutawanController],
  providers: [SoloRepository, SoloItemBuilder, SoloService, SpinDraw, SpinService, JutawanRepository, JutawanService],
  exports: [SpinDraw],
})
export class SoloGamesModule {}
