import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum'
import { FilesModule } from '../../files'
import { PracticeModule } from '../../practice'
import { QuestionsModule } from '../../questions'
import { BijakPapersModule } from '../papers'
import { KuizController } from './kuiz.controller'
import { KuizService } from './kuiz.service'

/**
 * Bijak SPM Simulasi Kuiz (R1-B16): the random quiz (stored as a practice session, U8) and the per-paper quiz (not stored).
 * Reads the question bank, papers and files only through their exported repositories and services, and writes only through
 * `PracticeRepository`. It owns no table.
 */
@Module({
  imports: [ThrottleModule, QuestionsModule, CurriculumModule, FilesModule, PracticeModule, BijakPapersModule],
  controllers: [KuizController],
  providers: [KuizService],
  exports: [KuizService],
})
export class BijakKuizModule {}
