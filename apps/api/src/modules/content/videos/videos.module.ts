import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { AuthModule } from '../../auth'
import { CurriculumModule } from '../../curriculum'
import { SchoolsModule } from '../../schools'
import { UsersModule } from '../../users'
import { CurriculumSubjectLookup, SUBJECT_LOOKUP } from './subject-lookup'
import { VideosController } from './videos.controller'
import { VideosRepository } from './videos.repository'
import { VideosService } from './videos.service'

/**
 * M09 videos (BE-24 part B). Exports `VideosRepository`, the only doorway to `videos` and `video_schools` (ADR-0014).
 * Subjects are read through the BE-08 curriculum repository behind the `SUBJECT_LOOKUP` port.
 */
@Module({
  imports: [AuditModule, AuthModule, CurriculumModule, SchoolsModule, UsersModule, ThrottleModule],
  controllers: [VideosController],
  providers: [VideosRepository, VideosService, { provide: SUBJECT_LOOKUP, useClass: CurriculumSubjectLookup }],
  exports: [VideosRepository],
})
export class VideosModule {}
