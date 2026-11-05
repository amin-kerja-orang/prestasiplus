import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { QuestionsModule } from '../../questions'
import { PersonalQuestionsController } from './personal-questions.controller'
import { PersonalQuestionsRepository } from './personal-questions.repository'
import { PersonalQuestionsService } from './personal-questions.service'

/**
 * Alat Soalan tools of the teacher (S6-T16): Soalan & Rujukan, the personal MCQ with a reference link (API-GUR-24). The create route is
 * mounted here with the rest: this part is stacked on the exclusion part (S6-T16-private-exclusion), which must merge first.
 */
@Module({
  imports: [AuditModule, ThrottleModule, QuestionsModule],
  controllers: [PersonalQuestionsController],
  providers: [PersonalQuestionsRepository, PersonalQuestionsService],
})
export class TeacherToolsModule {}
