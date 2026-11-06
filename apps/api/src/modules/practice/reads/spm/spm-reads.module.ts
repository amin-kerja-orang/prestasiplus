import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { BijakAttemptsModule } from '../../../bijak/attempts'
import { CurriculumModule } from '../../../curriculum'
import { SpmModule, SpmPorts } from '../../../spm'
import { PracticeSpmAnswerStats } from './spm-answer-stats.adapter'
import { PracticeSpmHistory } from './spm-history.adapter'

/**
 * Practice reads for the SPM hub (S3-T07 part F, rulings Q1 and Q6): the answer-store statistics of "Prestasi SPM Anda" and the
 * merged Sejarah Kuiz SPM list. The SPM module defines the ports (`SpmPorts`, the `SpmPaperSource` pattern); the adapters live
 * here because S5 owns `practice_answers` and `practice_sessions`. Binds them once from `onModuleInit` (a second `provide*` throws).
 */
@Module({
  imports: [SpmModule, BijakAttemptsModule, CurriculumModule],
  providers: [PracticeSpmAnswerStats, PracticeSpmHistory],
})
export class PracticeSpmReadsModule implements OnModuleInit {
  constructor(
    @Inject(SpmPorts) private readonly ports: SpmPorts,
    @Inject(PracticeSpmAnswerStats) private readonly answerStats: PracticeSpmAnswerStats,
    @Inject(PracticeSpmHistory) private readonly history: PracticeSpmHistory,
  ) {}

  onModuleInit(): void {
    this.ports.provideAnswerStats(this.answerStats)
    this.ports.provideHistory(this.history)
  }
}
