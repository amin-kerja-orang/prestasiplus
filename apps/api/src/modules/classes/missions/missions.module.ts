import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum'
import { PracticeModule, PracticePorts } from '../../practice'
import { QuestionsModule } from '../../questions'
import { ClassesModule } from '../classes.module'
import { ClassesPorts } from '../ports'
import { QuestionSetsModule } from '../question-sets'
import { MissionsController } from './missions.controller'
import { MissionsRepository } from './missions.repository'
import { MissionsService } from './missions.service'
import { PracticeAssignmentsAdapter } from './practice-assignments.adapter'
import { QuestionPool } from './question-pool'
import { RemedialController } from './remedial.controller'
import { RemedialService } from './remedial.service'

/**
 * BE-18 (M10 part B), missions and remedial half: `GET /missions/today`, `/remedial-tests/*`, the teacher
 * remedial progress and the Command Center remedial scan, generate and cancel. On init it binds BE-12's
 * `PracticePorts.provideAssignments` (missions, remedial tests and, through `QuestionSetAssignments`,
 * question sets) and BE-17's `ClassesPorts.provideMissions`. A port that is already bound (a test fake
 * plugged in before `app.init()`) is left as it is and logged, never overwritten.
 */
@Module({
  imports: [AuditModule, ThrottleModule, CurriculumModule, QuestionsModule, ClassesModule, PracticeModule, QuestionSetsModule],
  controllers: [MissionsController, RemedialController],
  providers: [MissionsRepository, MissionsService, RemedialService, QuestionPool, PracticeAssignmentsAdapter],
  exports: [MissionsRepository],
})
export class MissionsModule implements OnModuleInit {
  private readonly logger = new Logger(MissionsModule.name)

  constructor(
    @Inject(PracticePorts) private readonly practicePorts: PracticePorts,
    @Inject(ClassesPorts) private readonly classesPorts: ClassesPorts,
    @Inject(PracticeAssignmentsAdapter) private readonly adapter: PracticeAssignmentsAdapter,
    @Inject(MissionsRepository) private readonly missions: MissionsRepository,
  ) {}

  onModuleInit(): void {
    try {
      this.practicePorts.provideAssignments(this.adapter)
    } catch (err) {
      this.logger.warn(`assignment source already bound, keeping it: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      this.classesPorts.provideMissions({ hasMission: (teacherId) => this.missions.teacherHasMission(teacherId) })
    } catch (err) {
      this.logger.warn(`teacher missions provider already bound, keeping it: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
