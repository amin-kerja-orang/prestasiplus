import { Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { ThrottleModule } from '../../common/throttle'
import { CurriculumModule, CurriculumPorts } from '../curriculum'
import { FilesModule } from '../files'
import { UsersModule } from '../users'
import { QuestionsBijakPoolSource } from './bijak-pool'
import { ServabilityReadsService, ServabilityService } from './serving'
import { ServabilityController } from './http/servability.controller'
import { QuestionCountsAdapter } from './curriculum-bridge'
import { AdminQuestionsController, GuruQuestionsController, StructuredQuestionsController } from './http'
import { PkskQuestionsService } from './pksk.service'
import { QuestionsRepository } from './questions.repository'
import { QuestionsService } from './questions.service'

/**
 * Question bank (M04, BE-09). Exports `QuestionsRepository` and `QuestionsService` for the other cards
 * (BE-10 workflow, BE-12 practice, BE-15, BE-17, BE-18, BE-41). It plugs its active-question counts
 * into the curriculum catalogue through `CurriculumPorts` (no curriculum file is edited).
 *
 * The three controllers live in `http/` (BE-09 Part C).
 */
@Module({
  imports: [CurriculumModule, UsersModule, FilesModule, AuditModule, ThrottleModule],
  controllers: [AdminQuestionsController, StructuredQuestionsController, GuruQuestionsController, ServabilityController],
  providers: [QuestionsRepository, QuestionsService, PkskQuestionsService, QuestionCountsAdapter, QuestionsBijakPoolSource, ServabilityService, ServabilityReadsService],
  exports: [QuestionsRepository, QuestionsService, PkskQuestionsService, QuestionsBijakPoolSource, ServabilityService],
})
export class QuestionsModule implements OnModuleInit {
  constructor(
    private readonly ports: CurriculumPorts,
    private readonly counts: QuestionCountsAdapter,
  ) {}

  onModuleInit(): void {
    this.ports.provideQuestionCounts(this.counts)
  }
}
