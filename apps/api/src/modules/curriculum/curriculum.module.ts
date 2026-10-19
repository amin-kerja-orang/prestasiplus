import { Module } from '@nestjs/common'

import { AdminCurriculumController, AdminEducationLevelsController, AdminSubjectsController } from './admin.controller'
import { CurriculumAdminService } from './admin.service'
import { CurriculumRepository } from './curriculum.repository'
import { CurriculumLearnerController } from './learner.controller'
import { CurriculumLearnerService } from './learner.service'
import {
  NoQuestionCounts,
  NoTopicProgress,
  QUESTION_COUNT_PROVIDER,
  TOPIC_PROGRESS_PROVIDER,
} from './providers'

/**
 * Curriculum (M03, BE-08): levels, subjects, chapters, topics, subtopics, the DSKP node tree and the
 * learner catalogue. It exports `CurriculumRepository` (`subjects()`, `levels()`, `chapters()`,
 * `node()`) for the other cards. BE-13 replaces `TOPIC_PROGRESS_PROVIDER` and BE-09 replaces
 * `QUESTION_COUNT_PROVIDER`; until then both answer "nothing yet".
 */
@Module({
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
    { provide: TOPIC_PROGRESS_PROVIDER, useClass: NoTopicProgress },
    { provide: QUESTION_COUNT_PROVIDER, useClass: NoQuestionCounts },
  ],
  exports: [CurriculumRepository, TOPIC_PROGRESS_PROVIDER, QUESTION_COUNT_PROVIDER],
})
export class CurriculumModule {}
