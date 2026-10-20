import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { CurriculumModule } from '../../curriculum'
import { FilesModule } from '../../files'
import { AudioKbatAdminController, AudioKbatController, AudioUploadInterceptor } from './audio.controller'
import { AudioReadGate } from './audio-read-gate'
import { AudioRepository } from './audio.repository'
import { AudioService } from './audio.service'

/**
 * Audio KBAT (BE-24 part C): the student player (list, player data, section audio, attempt) and the admin
 * tools (list, template, create). Exports `AudioRepository`, the only doorway to `audio_kbat_sets` and
 * `audio_kbat_attempts` (ADR-0014). Section audio sits in `FILE_STORAGE` (BE-04), see the deviation row.
 */
@Module({
  imports: [AuditModule, ThrottleModule, FilesModule, CurriculumModule],
  controllers: [AudioKbatController, AudioKbatAdminController],
  providers: [AudioReadGate, AudioRepository, AudioService, AudioUploadInterceptor],
  exports: [AudioRepository],
})
export class AudioKbatModule {}
