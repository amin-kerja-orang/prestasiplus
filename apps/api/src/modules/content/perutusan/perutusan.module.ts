import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { AuthModule } from '../../auth'
import { FilesModule } from '../../files'
import { SchoolsModule } from '../../schools'
import { UsersModule } from '../../users'
import { ContentSharedModule } from '../shared'
import { PerutusanController, PublicPerutusanController } from './perutusan.controller'
import { PerutusanFileStore } from './perutusan.files'
import { PerutusanRepository } from './perutusan.repository'
import { PerutusanService } from './perutusan.service'
import { PerutusanUploadInterceptor } from './perutusan.upload'

/**
 * M09 Perutusan (BE-24 part B). Exports `PerutusanRepository`, the only doorway to `perutusan` and its file, comment,
 * reaction and read tables (ADR-0014). Attachments go to the BE-04 `FILE_STORAGE` through `PerutusanFileStore`.
 */
@Module({
  imports: [AuditModule, AuthModule, FilesModule, SchoolsModule, UsersModule, ThrottleModule, ContentSharedModule],
  controllers: [PerutusanController, PublicPerutusanController],
  providers: [PerutusanRepository, PerutusanFileStore, PerutusanService, PerutusanUploadInterceptor],
  exports: [PerutusanRepository],
})
export class PerutusanModule {}
