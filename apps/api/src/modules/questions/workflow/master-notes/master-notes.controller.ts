import { Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { MASTER_NOTE_ACTIONS, type MasterNoteAction } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { NoStoreInterceptor } from '../../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { AdminOnly } from '../actor'
import { WORKFLOW_ADMIN_WRITE_LIMIT } from '../quality/limits'
import { MasterNotesService } from './master-notes.service'

/** `page`: a missing or invalid value means 1 (an out-of-range page is an empty page). */
const pageOf = (v: unknown): number => (typeof v === 'string' && /^[1-9]\d{0,8}$/.test(v) ? Number(v) : 1)

/** Master notes, S12. Admin Pusat only. */
@AdminOnly()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('master-notes')
export class MasterNotesController {
  constructor(@Inject(MasterNotesService) private readonly notes: MasterNotesService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.notes.list(typeof query.tab === 'string' ? query.tab : undefined, pageOf(query.page))
  }

  @Post(':id/:action')
  @HttpCode(200)
  @RateLimit(WORKFLOW_ADMIN_WRITE_LIMIT)
  act(@Param('id') id: string, @Param('action') action: string) {
    if (!(MASTER_NOTE_ACTIONS as readonly string[]).includes(action)) throw ApiError.of('NOT_FOUND')
    return this.notes.act(id, action as MasterNoteAction)
  }
}
