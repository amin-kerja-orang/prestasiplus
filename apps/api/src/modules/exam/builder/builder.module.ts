import { Inject, Module, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { BijakPapersModule } from '../../bijak/papers'
import { QuestionsModule } from '../../questions'
import { BuilderController } from './builder.controller'
import { BuilderRepository } from './builder.repository'
import { BuilderService } from './builder.service'
import { SectionPoolsController } from './section-pool.controller'
import { SectionPoolService } from './section-pool.service'
import { CompositeBuilderQuestionSource } from './composite.source'
import { PocBuilderQuestionSource } from './poc-builder-source'
import { BijakBuilderPorts } from './ports'
import { QuestionBankBuilderSource } from './question-bank.source'

/**
 * Paper builder (BE-39): the admin write side of the Bijak SPM papers. It registers the BE-09 backed
 * question source on `BijakBuilderPorts` from `onModuleInit` (the `CurriculumPorts` pattern, see
 * `ports.ts`). Tests swap the source by overriding the `QuestionBankBuilderSource` provider.
 */
@Module({
  imports: [AuditModule, ThrottleModule, QuestionsModule, BijakPapersModule],
  controllers: [BuilderController, SectionPoolsController],
  providers: [BijakBuilderPorts, BuilderRepository, BuilderService, SectionPoolService, QuestionBankBuilderSource],
  exports: [BijakBuilderPorts, BuilderRepository],
})
export class ExamBuilderModule implements OnModuleInit {
  constructor(
    @Inject(BijakBuilderPorts) private readonly ports: BijakBuilderPorts,
    @Inject(QuestionBankBuilderSource) private readonly bank: QuestionBankBuilderSource,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    // BIJAK_POC_QUESTIONS on (staging/demo): the builder sees the PoC questions plus the bank, like the
    // papers/attempts ports (BijakIntegrationModule). Off: the bank alone.
    const v: unknown = this.config.get('BIJAK_POC_QUESTIONS')
    const poc = v === true || v === 'true' || v === '1'
    this.ports.provideQuestionSource(poc ? new CompositeBuilderQuestionSource(new PocBuilderQuestionSource(), this.bank) : this.bank)
  }
}
