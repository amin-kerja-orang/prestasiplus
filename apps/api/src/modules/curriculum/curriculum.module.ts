import { Module } from '@nestjs/common'

import { AdminCurriculumController, AdminEducationLevelsController, AdminSubjectsController } from './admin.controller'
import { CurriculumAdminService } from './admin.service'
import { CurriculumRepository } from './curriculum.repository'
import { CurriculumLearnerController } from './learner.controller'
import { CurriculumLearnerService } from './learner.service'
import { AuditModule } from '../../common/audit'
import { CurriculumPorts } from './providers'

/**
 * Curriculum (M03, BE-08): levels, subjects, chapters, topics, subtopics, the DSKP node tree and the
 * learner catalogue. It exports `CurriculumRepository` (`subjects()`, `levels()`, `chapters()`,
 * `node()`) and `CurriculumPorts` for the other cards. BE-13 calls
 * `ports.provideTopicProgress(...)` and BE-09 calls `ports.provideQuestionCounts(...)` from their
 * own `onModuleInit` (see `providers.ts`); until then both answer "nothing yet". Neither card edits
 * this file. Every admin write records an `audit_events` row (`curriculum.*` actions).
 */
@Module({
  imports: [AuditModule],
  controllers: [
    CurriculumLearnerController,
    AdminEducationLevelsController,
    AdminSubjectsController,
    AdminCurriculumController,
  ],
  providers: [
    CurriculumRepository,
    CurriculumAdminService,
    CurriculumLearnerService,
    CurriculumPorts,
  ],
  exports: [CurriculumRepository, CurriculumPorts],
})
export class CurriculumModule {}
