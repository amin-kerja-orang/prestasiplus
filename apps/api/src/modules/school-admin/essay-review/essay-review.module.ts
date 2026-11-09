import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { EssayReviewCentralController, EssayReviewSchoolController } from './essay-review.controller'
import { EssayReviewService } from './essay-review.service'

/** Tanda Karangan (V2 `/spm/tanda-karangan`): the AI mark proposals awaiting a person. Owns `essay_review_proposals`. */
@Module({
  imports: [AuditModule, ThrottleModule],
  controllers: [EssayReviewSchoolController, EssayReviewCentralController],
  providers: [EssayReviewService],
})
export class EssayReviewModule {}
