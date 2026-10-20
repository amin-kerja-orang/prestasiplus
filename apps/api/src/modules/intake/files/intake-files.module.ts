import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { FilesModule } from '../../files'
import { FilesConfig } from '../../files/files.config'
import { JobsModule } from '../../jobs'
import { OcrModule } from '../../ocr'
import { AI_EXTRACTOR, DisabledAiExtractor } from './ai-extractor'
import { IntakeFilesController, IntakeUploadGuard } from './intake-files.controller'
import { IntakeFilesConfig } from './intake-files.config'
import { IntakeFilesService } from './intake-files.service'
import { IntakeExtractionInput } from './intake-extraction-input'
import { IntakeFiguresService } from './intake-figures.service'
import { IntakeProcessingService } from './intake-processing.service'
import { IntakeUploadInterceptor } from './intake-upload.interceptor'
import { IntakeUploadService } from './intake-upload.service'

/**
 * Intake submissions, PDF upload, page/figure/original serving, the background handlers (`intake.process_file`,
 * `intake.page`, `intake.crop_figure`) and the hand-off to the AI extractor (BE-37). BE-38 uses
 * `IntakeExtractionInput` and `AI_EXTRACTOR` (replace the default with `{ provide: AI_EXTRACTOR, ... }` in the
 * module that registers a real adapter) and `IntakeFiguresService.enqueueCrop`.
 */
@Module({
  imports: [AuditModule, FilesModule, JobsModule, OcrModule, ThrottleModule],
  controllers: [IntakeFilesController],
  providers: [
    FilesConfig, // pure settings reader (INTAKE_MAX_FILE_MB); FilesModule does not export its instance
    IntakeFilesConfig,
    IntakeFilesService,
    IntakeUploadService,
    IntakeUploadGuard,
    IntakeUploadInterceptor,
    IntakeFiguresService,
    IntakeProcessingService,
    IntakeExtractionInput,
    { provide: AI_EXTRACTOR, useClass: DisabledAiExtractor },
  ],
  exports: [IntakeFilesService, IntakeFiguresService, IntakeProcessingService, IntakeExtractionInput, AI_EXTRACTOR],
})
export class IntakeFilesModule {}
