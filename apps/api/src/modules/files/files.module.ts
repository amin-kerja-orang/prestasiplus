import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { FILE_STORAGE } from './file-storage'
import { DeleteGuard, FilesController, UploadGuard, UploadInterceptor } from './files.controller'
import { FilesConfig } from './files.config'
import { FilesService } from './files.service'
import { LocalDiskStorage } from './local-disk.storage'
import { DownloadThrottle, UploadThrottle } from './upload-throttle'

/**
 * File storage and the `/api/files` routes (BE-04). Other modules inject `FilesService` for
 * derived files and downloads; the bytes sit behind the `FILE_STORAGE` token (local volume).
 * `FilesConfig` is created once and shared by the storage factory, the throttles and the upload interceptor.
 */
@Module({
  imports: [
    AuditModule,
    AuthModule, // SESSION_RESOLVER for the public-or-signed-in download route
  ],
  controllers: [FilesController],
  providers: [
    FilesConfig,
    UploadThrottle,
    DownloadThrottle,
    UploadGuard,
    DeleteGuard,
    UploadInterceptor,
    FilesService,
    { provide: FILE_STORAGE, inject: [FilesConfig], useFactory: (config: FilesConfig) => new LocalDiskStorage(config.storageDir) },
  ],
  exports: [FilesService, FILE_STORAGE],
})
export class FilesModule {}
