import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { AuthModule } from '../../auth'
import { ContentSharedModule } from '../shared'
import { AdminNotesController } from './notes.controller'
import { NotesRepository } from './notes.repository'
import { NotesService } from './notes.service'

/** Admin notes (BE-24 part A). */
@Module({
  imports: [AuditModule, AuthModule, ThrottleModule, ContentSharedModule],
  controllers: [AdminNotesController],
  providers: [NotesRepository, NotesService],
})
export class NotesModule {}
