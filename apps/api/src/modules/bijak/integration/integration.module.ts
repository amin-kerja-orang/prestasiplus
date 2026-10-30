import { Inject, Module, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { CurriculumModule } from '../../curriculum'
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
import { PocPoolSource } from '../papers/poc-pool-source'
import { PocQuestionSource } from '../papers/poc-question-source'
import { Be09BijakQuestionSource, CompositeBijakPoolSource, CompositeBijakQuestionSource, CompositePaperQuestionSource } from '../question-bridge'
import { WalletBijakReward, WalletPracticeReward } from './bindings'
import { PracticeFactsAdapter } from './practice-facts'
import { PrismaBijakAggregate } from './performance-bijak-aggregate'
import { PocBijakQuestionSource } from './poc-question-source'

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
 * - Questions, ALWAYS (#45 C2): `CompositeBijakQuestionSource` -> BE-16 `provideQuestionSource` and
 *   `CompositePaperQuestionSource` -> BE-15 `provideQuestionSource`. Ids in the reserved PoC block go to the
 *   PoC fixture (`PocBijakQuestionSource` / `PocQuestionSource`), so the seeded PoC papers keep working on a
 *   base that has BE-09; every other id goes to `Be09BijakQuestionSource` (the bank's live version, mapped
 *   to exam-core). Jana's `pool` stays on the PoC fixture (no BE-09 pool-tag mapping yet, #45 M8).
 *   This replaces the earlier `question_versions` gate, which left BE-16 with no question source at all
 *   once BE-09 merged.
 * - PoC questions are STAGING ONLY (LEAD decision 2026-10-20 16:00): the PoC fixtures are plugged in only when
 *   `BIJAK_POC_QUESTIONS` is true (default false). Off, reserved PoC ids are not served (start is 403 "not
 *   eligible", `getMany` omits them) and Jana's pool is empty (422 SHORTAGE); BE-09 questions work either way.
 */
@Module({
  imports: [BijakPapersModule, BijakAttemptsModule, BijakKuizModule, PracticeModule, WalletModule, QuestionsModule, CurriculumModule, PerformanceModule, GamificationModule],
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

  /** `BIJAK_POC_QUESTIONS` (parsed to a boolean by the env schema; a raw string is accepted too). */
  private pocEnabled(): boolean {
    const v: unknown = this.config.get('BIJAK_POC_QUESTIONS')
    return v === true || v === 'true' || v === '1'
  }

  onModuleInit(): void {
    this.attemptPorts.providePaperSource(this.paperSource)
    this.papersPorts.provideProgress(this.progress)
    this.papersPorts.provideServed(this.progress)
    this.attemptPorts.provideAggregate(this.aggregate)
    this.attemptPorts.provideReward(this.bijakReward)
    this.practicePorts.provideReward(this.practiceReward)
    this.gamificationPorts.providePracticeFacts(this.practiceFacts)
    const poc = this.pocEnabled()
    this.attemptPorts.provideQuestionSource(new CompositeBijakQuestionSource(poc ? new PocBijakQuestionSource() : null, this.bankQuestions))
    this.papersPorts.provideQuestionSource(new CompositePaperQuestionSource(poc ? new PocQuestionSource() : null, this.bankQuestions))
    this.papersPorts.providePoolSource(new CompositeBijakPoolSource(poc ? new PocPoolSource() : null, this.bankPool, this.progress))
    this.performancePorts.provideBijak(this.performanceAggregate)
  }
}
