import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common'

import { PrismaService } from '../../../db/prisma.service'
import { PracticeModule } from '../../practice'
import { PracticeAggregateService } from '../../practice/aggregate'
import { PracticePorts } from '../../practice/ports'
import { WalletModule } from '../../wallet'
import { BijakAttemptsModule } from '../attempts'
import { BijakAttemptPorts } from '../attempts/ports'
import { BijakAttemptProgress } from '../attempts/progress-source'
import { BijakPapersModule } from '../papers'
import { BijakPapersAttemptSource } from '../papers/attempt-source'
import { BijakPapersPorts } from '../papers/ports'
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
 * - `PocBijakQuestionSource` (stopgap)     -> BE-16 `provideQuestionSource`, ONLY while the BE-09 tables are
 *   absent. BE-09 replaces it (see `poc-question-source.ts`). BE-09's question ports are NOT bound here.
 */
@Module({
  imports: [BijakPapersModule, BijakAttemptsModule, PracticeModule, WalletModule],
  providers: [WalletBijakReward, WalletPracticeReward],
})
export class BijakIntegrationModule implements OnModuleInit {
  private readonly logger = new Logger(BijakIntegrationModule.name)

  constructor(
    @Inject(BijakAttemptPorts) private readonly attemptPorts: BijakAttemptPorts,
    @Inject(BijakPapersPorts) private readonly papersPorts: BijakPapersPorts,
    @Inject(BijakAttemptProgress) private readonly progress: BijakAttemptProgress,
    @Inject(PracticePorts) private readonly practicePorts: PracticePorts,
    @Inject(BijakPapersAttemptSource) private readonly paperSource: BijakPapersAttemptSource,
    @Inject(PracticeAggregateService) private readonly aggregate: PracticeAggregateService,
    @Inject(WalletBijakReward) private readonly bijakReward: WalletBijakReward,
    @Inject(WalletPracticeReward) private readonly practiceReward: WalletPracticeReward,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.attemptPorts.providePaperSource(this.paperSource)
    this.papersPorts.provideProgress(this.progress)
    this.papersPorts.provideServed(this.progress)
    this.attemptPorts.provideAggregate(this.aggregate)
    this.attemptPorts.provideReward(this.bijakReward)
    this.practicePorts.provideReward(this.practiceReward)
    if (!(await this.questionBankPresent())) {
      this.attemptPorts.provideQuestionSource(new PocBijakQuestionSource())
      this.logger.log('BE-09 question bank absent: Bijak attempts use the PoC question fixture')
    } else {
      this.logger.warn('BE-09 question bank present but no Bijak question source is bound: starting an attempt answers 422 until the BE-09 connector provides one')
    }
  }

  /** True once BE-09's `question_versions` table exists (then BE-09 binds the question source). */
  private async questionBankPresent(): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRaw<{ present: boolean }[]>`SELECT to_regclass('public.question_versions') IS NOT NULL AS present`
      return rows[0]?.present === true
    } catch {
      // No database reachable at boot: keep the default (no questions) rather than guess.
      return true
    }
  }
}
