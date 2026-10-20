import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { AuthModule } from '../../auth'
import { FilesModule } from '../../files'
import { AdminScreenshotsController, ScreenshotUploadInterceptor } from './screenshots.controller'
import { ScreenshotsRepository } from './screenshots.repository'
import { ScreenshotsService } from './screenshots.service'

/** Private screenshot tool (BE-24 part A). Files are stored by BE-04 (`purpose=cms_screenshot`). */
@Module({
  imports: [AuditModule, AuthModule, ThrottleModule, FilesModule],
  controllers: [AdminScreenshotsController],
  providers: [ScreenshotsRepository, ScreenshotsService, ScreenshotUploadInterceptor],
})
export class ScreenshotsModule {}
