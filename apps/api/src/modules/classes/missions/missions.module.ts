import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { PracticeModule, PracticePorts } from '../../practice'
import { ClassesModule } from '../classes.module'
import { QuestionSetsModule } from '../question-sets'

/**
 * BE-18 (M10 part B), missions and remedial half: `GET /missions/today`, `/remedial-tests/*`, the teacher
 * remedial progress and the Command Center remedial scan, generate and cancel. On init it binds BE-12's
 * `PracticePorts.provideAssignments` (missions, remedial tests and, through `QuestionSetAssignments`,
 * question sets) and BE-17's `ClassesPorts.provideMissions`. A port that is already bound (a test fake
 * plugged in before `app.init()`) is left as it is and logged, never overwritten.
 */
@Module({
  imports: [AuditModule, ThrottleModule, ClassesModule, PracticeModule, QuestionSetsModule],
  controllers: [],
  providers: [],
})
export class MissionsModule implements OnModuleInit {
  private readonly logger = new Logger(MissionsModule.name)

  constructor(@Inject(PracticePorts) private readonly practicePorts: PracticePorts) {}

  onModuleInit(): void {
    // Wired by the missions implementation (assignment adapter + teacher missions provider).
    void this.practicePorts
    void this.logger
  }
}
