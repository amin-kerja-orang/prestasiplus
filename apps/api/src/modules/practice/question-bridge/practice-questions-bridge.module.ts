import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common'

import { QuestionsModule } from '../../questions'
import { UsersModule } from '../../users'
import { PracticeModule } from '../practice.module'
import { PracticePorts } from '../ports'
import { Be09PracticeQuestionSource } from './be09-practice-question-source'

/**
 * Binds BE-12's `PracticePorts.provideQuestions` to the BE-09 question bank (`Be09PracticeQuestionSource`),
 * replacing the empty-bank placeholder in the real app. Kept apart from `PracticeModule` so the practice
 * specs (which boot `PracticeModule` alone with a fake bank) keep their fakes. A source that is already
 * bound (a test fake plugged in before `app.init()`) is left as it is and logged, never overwritten.
 */
@Module({
  imports: [QuestionsModule, UsersModule, PracticeModule],
  providers: [Be09PracticeQuestionSource],
  exports: [Be09PracticeQuestionSource],
})
export class PracticeQuestionsBridgeModule implements OnModuleInit {
  private readonly logger = new Logger(PracticeQuestionsBridgeModule.name)

  constructor(
    @Inject(PracticePorts) private readonly ports: PracticePorts,
    @Inject(Be09PracticeQuestionSource) private readonly source: Be09PracticeQuestionSource,
  ) {}

  onModuleInit(): void {
    try {
      this.ports.provideQuestions(this.source)
    } catch (err) {
      this.logger.warn(`practice question source already bound, keeping it: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
