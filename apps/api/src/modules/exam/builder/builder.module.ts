import { Inject, Module, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { QuestionsModule } from '../../questions'
import { BuilderController } from './builder.controller'
import { BuilderRepository } from './builder.repository'
import { BuilderService } from './builder.service'
import { CompositeBuilderQuestionSource } from './composite-source'
import { PocBuilderQuestionSource } from './poc-builder-source'
import { BijakBuilderPorts } from './ports'
import { QuestionBankBuilderSource } from './question-bank.source'

/**
 * Paper builder (BE-39): the admin write side of the Bijak SPM papers. It registers its question source on
 * `BijakBuilderPorts` from `onModuleInit` (the `CurriculumPorts` pattern, see `ports.ts`): the BE-09 backed
 * `QuestionBankBuilderSource`, wrapped in `CompositeBuilderQuestionSource` (demo fix B4, QA #61) so that,
 * when `BIJAK_POC_QUESTIONS` is on (staging / demo), the reserved PoC ids are served by the PoC fixture
 * (Terbit, version 1) like on the student side (`BijakIntegrationModule`). Off (the production default),
 * the bank is registered unwrapped and the builder sees the bank only, exactly as before. Tests swap the
 * bank by overriding the `QuestionBankBuilderSource` provider.
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
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /** `BIJAK_POC_QUESTIONS` (parsed to a boolean by the env schema; a raw string is accepted too). */
  private pocEnabled(): boolean {
    const v: unknown = this.config.get('BIJAK_POC_QUESTIONS')
    return v === true || v === 'true' || v === '1'
  }

  onModuleInit(): void {
    // Off: the bank itself is registered (no wrapper), so production behaves exactly as before the fix.
    this.ports.provideQuestionSource(this.pocEnabled() ? new CompositeBuilderQuestionSource(new PocBuilderQuestionSource(), this.bank) : this.bank)
  }
}
