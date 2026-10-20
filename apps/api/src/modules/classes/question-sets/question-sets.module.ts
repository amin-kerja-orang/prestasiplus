import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum'
import { PracticeModule } from '../../practice'
import { QuestionsModule } from '../../questions'
import { ClassesModule } from '../classes.module'
import { DskpService } from './dskp.service'
import { PaperUploadSlots } from './paper-upload.slots'
import { QuestionPapersService } from './question-papers.service'
import { QuestionSetAssignments } from './question-sets.assignments'
import { StudentQuestionSetsController, TeacherQuestionToolsController } from './question-sets.controller'
import { QuestionSetsPorts } from './question-sets.ports'
import { QuestionSetsRepository } from './question-sets.repository'
import { QuestionSetsService } from './question-sets.service'

/**
 * BE-18 (M10 part B), question sets half: the student "Set Soalan Guru" list, the teacher question paper
 * upload, the Audio KBAT template downloads and the teacher DSKP picks. Exports `QuestionSetAssignments`
 * (the question_set resolution the missions module's practice adapter delegates to).
 */
@Module({
  imports: [AuditModule, ThrottleModule, ClassesModule, CurriculumModule, PracticeModule, QuestionsModule],
  controllers: [StudentQuestionSetsController, TeacherQuestionToolsController],
  providers: [QuestionSetsRepository, QuestionSetsService, QuestionSetAssignments, QuestionSetsPorts, QuestionPapersService, DskpService, PaperUploadSlots],
  exports: [QuestionSetAssignments, QuestionSetsPorts],
})
export class QuestionSetsModule {}
