import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum'
import { FilesModule } from '../../files'
import { JobsModule } from '../../jobs'
import { QuestionsModule } from '../../questions'
import { IntakeFilesModule } from '../files'
import { CurriculumFactsService } from './curriculum-facts'
import { DuplicateDetector } from './duplicate-detector'
import { IntakeExtractionService } from './extraction.service'
import { IntakeWorkflowController } from './intake-workflow.controller'
import { ItemViews } from './item-views'
import { IntakeReviewService } from './review.service'
import { IntakeStimuliService } from './stimuli.service'
import { IntakeWorkflowConfig } from './workflow.config'

/** Extraction orchestration, the review queue and accept-to-Draf (BE-38). The AI provider is the `AI_EXTRACTOR` port only. */
@Module({
  imports: [AuditModule, CurriculumModule, FilesModule, IntakeFilesModule, JobsModule, QuestionsModule, ThrottleModule],
  controllers: [IntakeWorkflowController],
  providers: [IntakeWorkflowConfig, CurriculumFactsService, DuplicateDetector, ItemViews, IntakeExtractionService, IntakeReviewService, IntakeStimuliService],
  exports: [IntakeExtractionService, IntakeReviewService],
})
export class IntakeWorkflowModule {}
