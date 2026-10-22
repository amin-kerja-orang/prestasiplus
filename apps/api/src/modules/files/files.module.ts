import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { ClamdScanner } from './clamd.scanner'
import { FILE_STORAGE, type FileStorage } from './file-storage'
import { DeleteGuard, FilesController, UploadGuard, UploadInterceptor } from './files.controller'
import { FilesConfig } from './files.config'
import { FilesService } from './files.service'
import { LocalDiskStorage } from './local-disk.storage'
import { MALWARE_SCANNER, type MalwareScanner } from './malware-scanner'
import { ScanningFileStorage } from './scanning-file-storage'
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
    {
      // AZ-188: MALWARE_SCAN=off gives no scanner (null); clamd gives the INSTREAM client.
      provide: MALWARE_SCANNER,
      inject: [FilesConfig],
      useFactory: (config: FilesConfig): MalwareScanner | null =>
        config.malwareScan === 'clamd' ? new ClamdScanner({ host: config.clamavHost, port: config.clamavPort, timeoutMs: config.clamavTimeoutMs }) : null,
    },
    {
      provide: FILE_STORAGE,
      inject: [FilesConfig, MALWARE_SCANNER],
      useFactory: (config: FilesConfig, scanner: MalwareScanner | null): FileStorage => {
        const disk = new LocalDiskStorage(config.storageDir)
        return scanner ? new ScanningFileStorage(disk, scanner) : disk
      },
    },
  ],
  exports: [FilesService, FILE_STORAGE, MALWARE_SCANNER],
})
export class FilesModule {}
