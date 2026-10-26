import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common'

import { ClassesModule } from '../classes.module'
import { ClassesPorts } from '../ports'
import { TeacherQuestionStatsProvider } from './teacher-question-stats.provider'

/**
 * Binds `ClassesPorts.provideQuestions` to the real teacher question counts (SW12-02), replacing the
 * "nothing yet" default in the real app. Kept apart from `ClassesModule` so the classes specs (which boot
 * `ClassesModule` alone and plug a fake) keep their fakes, the same pattern as `PracticeQuestionsBridgeModule`.
 * A provider that is already bound (a test fake plugged in before `app.init()`) is left as it is and logged.
 */
@Module({
  imports: [ClassesModule],
  providers: [TeacherQuestionStatsProvider],
  exports: [TeacherQuestionStatsProvider],
})
export class ClassesQuestionsBridgeModule implements OnModuleInit {
  private readonly logger = new Logger(ClassesQuestionsBridgeModule.name)

  constructor(
    @Inject(ClassesPorts) private readonly ports: ClassesPorts,
    @Inject(TeacherQuestionStatsProvider) private readonly provider: TeacherQuestionStatsProvider,
  ) {}

  onModuleInit(): void {
    try {
      this.ports.provideQuestions(this.provider)
    } catch (err) {
      // Only "already set" (a test fake bound before init) is tolerated; anything else fails the boot.
      if (!(err instanceof Error && /already set/.test(err.message))) throw err
      this.logger.warn(`teacher question provider already bound, keeping it: ${err.message}`)
    }
  }
}
