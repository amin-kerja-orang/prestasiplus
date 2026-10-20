import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { ClassesModule } from '../../classes'
import { TextPdfAdapter } from './adapters/text-pdf.adapter'
import { FeedbackController, KirkpatrickController } from './http/kirkpatrick.controllers'
import { KirkpatrickRepository } from './kirkpatrick.repository'
import { PDF_PORT } from './ports/pdf.port'
import { ExportService } from './services/export.service'
import { FeedbackService } from './services/feedback.service'
import { InterventionsService } from './services/interventions.service'
import { LevelsService } from './services/levels.service'
import { StudentService } from './services/student.service'

/**
 * M12 Kirkpatrick (BE-20): the four-level read models, the intervention log, the monthly feedback and the
 * impact-chain PDF (14 routes). Tables: `feedback`, `interventions` (migration 0023); everything else is computed
 * from users, schools and practice. The PDF writer sits behind `PDF_PORT`.
 */
@Module({
  imports: [AuditModule, ThrottleModule, ClassesModule],
  controllers: [KirkpatrickController, FeedbackController],
  providers: [
    KirkpatrickRepository,
    LevelsService,
    StudentService,
    InterventionsService,
    FeedbackService,
    ExportService,
    TextPdfAdapter,
    { provide: PDF_PORT, useExisting: TextPdfAdapter },
  ],
  exports: [KirkpatrickRepository, LevelsService],
})
export class KirkpatrickModule {}
