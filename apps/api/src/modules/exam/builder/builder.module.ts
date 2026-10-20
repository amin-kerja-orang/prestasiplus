import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { QuestionsModule } from '../../questions'
import { BuilderController } from './builder.controller'
import { BuilderRepository } from './builder.repository'
import { BuilderService } from './builder.service'
import { BijakBuilderPorts } from './ports'
import { QuestionBankBuilderSource } from './question-bank.source'

/**
 * Paper builder (BE-39): the admin write side of the Bijak SPM papers. It registers the BE-09 backed
 * question source on `BijakBuilderPorts` from `onModuleInit` (the `CurriculumPorts` pattern, see
 * `ports.ts`). Tests swap the source by overriding the `QuestionBankBuilderSource` provider.
 */
@Module({
  imports: [AuditModule, ThrottleModule, QuestionsModule],
  controllers: [BuilderController],
  providers: [BijakBuilderPorts, BuilderRepository, BuilderService, QuestionBankBuilderSource],
  exports: [BijakBuilderPorts, BuilderRepository],
})
export class ExamBuilderModule implements OnModuleInit {
  constructor(
    @Inject(BijakBuilderPorts) private readonly ports: BijakBuilderPorts,
    @Inject(QuestionBankBuilderSource) private readonly bank: QuestionBankBuilderSource,
  ) {}

  onModuleInit(): void {
    this.ports.provideQuestionSource(this.bank)
  }
}
