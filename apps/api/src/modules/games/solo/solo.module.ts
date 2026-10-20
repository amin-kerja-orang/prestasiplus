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
import { SpinService } from './spin/spin.service'
import { WeeklyController } from './weekly/weekly.controller'
import { WeeklyService } from './weekly/weekly.service'

/**
 * Solo area (agent C): single-player games (GET/check/reveal/submit), Roda Nasib (page + spin), Jutawan Ilmu,
 * the weekly competition and Uji Minda.
 * Registered BEFORE `RoomsModule` so `/games/solo/...`, `/games/roda-nasib`, `/games/jutawan`,
 * `/games/pertandingan` and `/games/uji-minda` win over `/games/:game/...`.
 */
@Module({
  imports: [GamesCoreModule],
  controllers: [SoloController, SpinController, JutawanController, WeeklyController],
  providers: [SoloRepository, SoloItemBuilder, SoloService, SpinService, JutawanRepository, JutawanService, WeeklyService],
  exports: [],
})
export class SoloGamesModule {}
