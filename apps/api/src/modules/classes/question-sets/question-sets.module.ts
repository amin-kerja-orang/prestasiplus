import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum'
import { PracticeModule } from '../../practice'
import { QuestionsModule } from '../../questions'
import { FilesConfig } from '../../files/files.config'
import { IntakeFilesModule } from '../../intake/files'
import { OcrModule } from '../../ocr'
import { ClassesModule } from '../classes.module'
import { GuruPaperIntakeAdapter } from './guru-paper-intake.adapter'
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
  imports: [AuditModule, ThrottleModule, ClassesModule, CurriculumModule, PracticeModule, QuestionsModule, IntakeFilesModule, OcrModule],
  controllers: [StudentQuestionSetsController, TeacherQuestionToolsController],
  providers: [QuestionSetsRepository, QuestionSetsService, QuestionSetAssignments, QuestionSetsPorts, QuestionPapersService, DskpService, PaperUploadSlots, GuruPaperIntakeAdapter, FilesConfig],
  exports: [QuestionSetAssignments, QuestionSetsPorts],
})
export class QuestionSetsModule implements OnModuleInit {
  constructor(
    @Inject(QuestionSetsPorts) private readonly ports: QuestionSetsPorts,
    @Inject(GuruPaperIntakeAdapter) private readonly adapter: GuruPaperIntakeAdapter,
  ) {}

  /** S1-T08: binds the real paper intake (a teacher's paper becomes a `source = guru` intake batch). A second bind throws "already set". */
  onModuleInit(): void {
    this.ports.provideIntake(this.adapter)
  }
}
