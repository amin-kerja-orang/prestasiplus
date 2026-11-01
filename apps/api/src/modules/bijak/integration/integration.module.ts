import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { CurriculumModule } from '../../curriculum'
import { FilesModule } from '../../files'
import { GamificationModule, GamificationPorts } from '../../gamification'
import { PracticeModule } from '../../practice'
import { PracticeAggregateService } from '../../practice/aggregate'
import { PracticePorts } from '../../practice/ports'
import { QuestionsBijakPoolSource, QuestionsModule } from '../../questions'
import { PerformanceModule, PerformancePorts } from '../../reports/performance'
import { WalletModule } from '../../wallet'
import { BijakAttemptsModule } from '../attempts'
import { BijakAttemptPorts } from '../attempts/ports'
import { BijakAttemptProgress } from '../attempts/progress-source'
import { BijakKuizModule } from '../kuiz'
import { BijakPapersModule } from '../papers'
import { BijakPapersAttemptSource } from '../papers/attempt-source'
import { BijakPapersPorts } from '../papers/ports'
import { BankBijakPoolSource, BankPaperQuestionSource, Be09BijakQuestionSource } from '../question-bridge'
import { WalletBijakReward, WalletPracticeReward } from './bindings'
import { PracticeFactsAdapter } from './practice-facts'
import { PrismaBijakAggregate } from './performance-bijak-aggregate'

/**
 * Bijak SPM integration: plugs the separately built cards into each other's ports (the `CurriculumPorts`
 * pattern). It is the only module that imports all of them, so each card's own module and test app stay
 * standalone (their tests plug fakes into the same ports; a port set twice throws).
 *
 * - BE-15 `BijakPapersAttemptSource`      -> BE-16 `providePaperSource`
 * - BE-16 `BijakAttemptProgress`          -> BE-15 `provideProgress` + `provideServed` (resume id, last score,
 *   Jana's "prefer unseen"; #45 M1)
 * - BE-12 `PracticeAggregateService`      -> BE-16 `provideAggregate` (US-33, AC-33.4)
 * - BE-11 wallet credit (`quiz_spm`)       -> BE-16 `provideReward` (exam only, idempotent per attempt,
 *   nothing under Mod Pelajar: AC-20.3)
 * - BE-11 streak + wallet (source by mode)  -> BE-12 `PracticePorts.provideReward`
 * - BE-12 `PracticeFactsAdapter` (PracticeRepository reads) -> BE-23 `GamificationPorts.providePracticeFacts`
 *   (daily challenge progress, mastery, session counts; FIX-3 D-07)
 * - `PrismaBijakAggregate` (attempts + results + BE-09 bank, read only) -> BE-19 `PerformancePorts.provideBijak`
 * - Questions, ALWAYS (R1-B07): the question bank is the ONLY source. `Be09BijakQuestionSource` -> BE-16
 *   `provideQuestionSource`, `BankPaperQuestionSource` (its `getMany`) -> BE-15 `provideQuestionSource`, and
 *   `BankBijakPoolSource` (the bank's pool facts, `seen` from the attempts side) -> BE-15 `providePoolSource`.
 *   The PoC fixture and the composite id split are gone from `src` (the PoC export lives in `prisma/seed/poc/export`,
 *   the test doubles in `test/support/poc`). `BIJAK_POC_QUESTIONS` is a deprecated no-op: when set to true the API logs
 *   a warning at start and still serves the bank only.
 */
@Module({
  imports: [BijakPapersModule, BijakAttemptsModule, BijakKuizModule, PracticeModule, WalletModule, QuestionsModule, CurriculumModule, PerformanceModule, GamificationModule, FilesModule],
  providers: [WalletBijakReward, WalletPracticeReward, PracticeFactsAdapter, Be09BijakQuestionSource, PrismaBijakAggregate],
})
export class BijakIntegrationModule implements OnModuleInit {
  constructor(
    @Inject(BijakAttemptPorts) private readonly attemptPorts: BijakAttemptPorts,
    @Inject(BijakPapersPorts) private readonly papersPorts: BijakPapersPorts,
    @Inject(BijakAttemptProgress) private readonly progress: BijakAttemptProgress,
    @Inject(PracticePorts) private readonly practicePorts: PracticePorts,
    @Inject(BijakPapersAttemptSource) private readonly paperSource: BijakPapersAttemptSource,
    @Inject(PracticeAggregateService) private readonly aggregate: PracticeAggregateService,
    @Inject(WalletBijakReward) private readonly bijakReward: WalletBijakReward,
    @Inject(WalletPracticeReward) private readonly practiceReward: WalletPracticeReward,
    @Inject(Be09BijakQuestionSource) private readonly bankQuestions: Be09BijakQuestionSource,
    @Inject(QuestionsBijakPoolSource) private readonly bankPool: QuestionsBijakPoolSource,
    @Inject(PerformancePorts) private readonly performancePorts: PerformancePorts,
    @Inject(PrismaBijakAggregate) private readonly performanceAggregate: PrismaBijakAggregate,
    @Inject(GamificationPorts) private readonly gamificationPorts: GamificationPorts,
    @Inject(PracticeFactsAdapter) private readonly practiceFacts: PracticeFactsAdapter,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /** `BIJAK_POC_QUESTIONS` was removed by R1-B07; a deployment that still sets it to true is told once and nothing else changes. */
  private warnDeprecatedFlag(): void {
    const v: unknown = this.config.get('BIJAK_POC_QUESTIONS')
    if (v === true || v === 'true' || v === '1') {
      new Logger(BijakIntegrationModule.name).warn('BIJAK_POC_QUESTIONS is deprecated and ignored (R1-B07): Bijak serves questions from the question bank only. Remove it from the environment.')
    }
  }

  onModuleInit(): void {
    this.attemptPorts.providePaperSource(this.paperSource)
    this.papersPorts.provideProgress(this.progress)
    this.papersPorts.provideServed(this.progress)
    this.attemptPorts.provideAggregate(this.aggregate)
    this.attemptPorts.provideReward(this.bijakReward)
    this.practicePorts.provideReward(this.practiceReward)
    this.gamificationPorts.providePracticeFacts(this.practiceFacts)
    this.warnDeprecatedFlag()
    this.attemptPorts.provideQuestionSource(this.bankQuestions)
    this.papersPorts.provideQuestionSource(new BankPaperQuestionSource(this.bankQuestions))
    this.papersPorts.providePoolSource(new BankBijakPoolSource(this.bankPool, this.progress))
    this.performancePorts.provideBijak(this.performanceAggregate)
  }
}
