import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MulterModule } from '@nestjs/platform-express'

import type { Env } from '../../common/config/env.schema'
import { AuditModule } from '../../common/audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { FILE_STORAGE } from './file-storage'
import { DeleteGuard, FilesController, UploadErrorInterceptor, UploadGuard } from './files.controller'
import { FilesConfig } from './files.config'
import { FilesService } from './files.service'
import { LocalDiskStorage } from './local-disk.storage'
import { UploadThrottle } from './upload-throttle'

/**
 * File storage and the `/api/files` routes (BE-04). Other modules inject `FilesService` for
 * derived files and downloads; the bytes sit behind the `FILE_STORAGE` token (local volume).
 */
@Module({
  imports: [
    AuditModule,
    AuthModule, // SESSION_RESOLVER for the public-or-signed-in download route
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (env: ConfigService<Env, true>) => ({
        // Memory storage on purpose: the bytes are inspected and rewritten before anything touches the disk.
        limits: { fileSize: new FilesConfig(env).maxUploadBytes, files: 1, fields: 4, fieldSize: 1024, parts: 6, headerPairs: 50 },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [
    FilesConfig,
    UploadThrottle,
    UploadGuard,
    DeleteGuard,
    UploadErrorInterceptor,
    FilesService,
    { provide: FILE_STORAGE, inject: [FilesConfig], useFactory: (config: FilesConfig) => new LocalDiskStorage(config.storageDir) },
  ],
  exports: [FilesService, FILE_STORAGE],
})
export class FilesModule {}
