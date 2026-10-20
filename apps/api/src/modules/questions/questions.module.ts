import { Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { CurriculumModule, CurriculumPorts } from '../curriculum'
import { FilesModule } from '../files'
import { UsersModule } from '../users'
import { QuestionCountsAdapter } from './curriculum-bridge'
import { QuestionsRepository } from './questions.repository'
import { QuestionsService } from './questions.service'

/**
 * Question bank (M04, BE-09). Exports `QuestionsRepository` and `QuestionsService` for the other cards
 * (BE-10 workflow, BE-12 practice, BE-15, BE-17, BE-18, BE-41). It plugs its active-question counts
 * into the curriculum catalogue through `CurriculumPorts` (no curriculum file is edited).
 *
 * Part C adds the three controllers (`http/index.ts`) to `controllers` below.
 */
@Module({
  imports: [CurriculumModule, UsersModule, FilesModule, AuditModule],
  controllers: [],
  providers: [QuestionsRepository, QuestionsService, QuestionCountsAdapter],
  exports: [QuestionsRepository, QuestionsService],
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
