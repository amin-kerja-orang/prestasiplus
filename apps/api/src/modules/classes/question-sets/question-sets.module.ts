import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { ClassesModule } from '../classes.module'
import { QuestionSetAssignments } from './question-sets.assignments'

/**
 * BE-18 (M10 part B), question sets half: the student "Set Soalan Guru" list, the teacher question paper
 * upload, the Audio KBAT template downloads and the teacher DSKP picks. Exports `QuestionSetAssignments`
 * (the question_set resolution the missions module's practice adapter delegates to).
 */
@Module({
  imports: [AuditModule, ThrottleModule, ClassesModule],
  controllers: [],
  providers: [QuestionSetAssignments],
  exports: [QuestionSetAssignments],
})
export class QuestionSetsModule {}
