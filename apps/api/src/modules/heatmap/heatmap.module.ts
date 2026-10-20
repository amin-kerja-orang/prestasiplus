import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { CurriculumModule } from '../curriculum'
import { PracticeModule } from '../practice'
import { HeatmapController } from './heatmap.controller'
import { HeatmapService } from './heatmap.service'
import { HeatmapPorts } from './ports'

/**
 * Heatmap Topik Lemah (M25, BE-48): one read route, no table (D12). Reads answers through BE-12's
 * `PracticeRepository` (via `HeatmapPorts`) and names through BE-08's `CurriculumRepository`.
 */
@Module({
  imports: [ThrottleModule, CurriculumModule, PracticeModule],
  controllers: [HeatmapController],
  providers: [HeatmapPorts, HeatmapService],
  exports: [HeatmapPorts, HeatmapService],
})
export class HeatmapModule {}
