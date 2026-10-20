import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { CurriculumModule } from '../../curriculum'
import { PracticeModule } from '../../practice'
import { PracticeAggregateService } from '../../practice/aggregate'
import { PracticePorts } from '../../practice/ports'
import { QuestionsModule } from '../../questions'
import { WalletModule } from '../../wallet'
import { BijakAttemptsModule } from '../attempts'
import { BijakAttemptPorts } from '../attempts/ports'
import { BijakAttemptProgress } from '../attempts/progress-source'
import { BijakPapersModule } from '../papers'
import { BijakPapersAttemptSource } from '../papers/attempt-source'
import { BijakPapersPorts } from '../papers/ports'
import { PocQuestionSource } from '../papers/poc-question-source'
import { Be09BijakQuestionSource, CompositeBijakQuestionSource, CompositePaperQuestionSource } from '../question-bridge'
import { WalletBijakReward, WalletPracticeReward } from './bindings'
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
 * - Questions, ALWAYS (#45 C2): `CompositeBijakQuestionSource` -> BE-16 `provideQuestionSource` and
 *   `CompositePaperQuestionSource` -> BE-15 `provideQuestionSource`. Ids in the reserved PoC block go to the
 *   PoC fixture (`PocBijakQuestionSource` / `PocQuestionSource`), so the seeded PoC papers keep working on a
 *   base that has BE-09; every other id goes to `Be09BijakQuestionSource` (the bank's live version, mapped
 *   to exam-core). Jana's `pool` stays on the PoC fixture (no BE-09 pool-tag mapping yet, #45 M8).
 *   This replaces the earlier `question_versions` gate, which left BE-16 with no question source at all
 *   once BE-09 merged.
 */
@Module({
  imports: [BijakPapersModule, BijakAttemptsModule, PracticeModule, WalletModule, QuestionsModule, CurriculumModule],
  providers: [WalletBijakReward, WalletPracticeReward, Be09BijakQuestionSource],
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
  ) {}

  onModuleInit(): void {
    this.attemptPorts.providePaperSource(this.paperSource)
    this.papersPorts.provideProgress(this.progress)
    this.papersPorts.provideServed(this.progress)
    this.attemptPorts.provideAggregate(this.aggregate)
    this.attemptPorts.provideReward(this.bijakReward)
    this.practicePorts.provideReward(this.practiceReward)
    this.attemptPorts.provideQuestionSource(new CompositeBijakQuestionSource(new PocBijakQuestionSource(), this.bankQuestions))
    this.papersPorts.provideQuestionSource(new CompositePaperQuestionSource(new PocQuestionSource(), this.bankQuestions))
  }
}
