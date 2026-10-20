import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../../common/throttle'
import { CurriculumModule } from '../../../curriculum'
import { QuestionsModule } from '../../../questions'
import { SchoolsModule } from '../../../schools'
import { UsersModule } from '../../../users'
import { StructuredAttemptsRepository } from './attempts.repository'
import { StructuredListingRepository } from './listing.repository'
import { StructuredService } from './structured.service'
import { SpmTargetsRepository } from './targets.repository'
import { SpmTargetsService } from './targets.service'
import { SpmTargetsController, StructuredController } from './writes.controller'

/**
 * BE-13 (writes): SPM targets (`GET` / `PUT /spm-targets`) and structured questions (list, detail,
 * `POST .../attempts`). Tables `spm_targets` and `structured_attempts` (migration 0022). The question
 * bank is read through `QuestionsRepository` only.
 */
@Module({
  imports: [ThrottleModule, CurriculumModule, QuestionsModule, UsersModule, SchoolsModule],
  controllers: [SpmTargetsController, StructuredController],
  providers: [SpmTargetsRepository, SpmTargetsService, StructuredAttemptsRepository, StructuredListingRepository, StructuredService],
})
export class PracticeTargetsStructuredModule {}
