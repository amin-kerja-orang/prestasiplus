import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor } from '../../../common/http'
import type { RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { actorOf, CONTENT_LIMITS, queryText } from '../shared/content-support'
import { NotesService } from './notes.service'

type Req = Request & RequestWithAuth

/** Admin notes (M09 #10 to #14): admin only, `no-store`. There is no notes reader. */
@Controller('admin/notes')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class AdminNotesController {
  constructor(@Inject(NotesService) private readonly notes: NotesService) {}

  @Get()
  @RateLimit(CONTENT_LIMITS.adminRead)
  list(@Query() q: Record<string, unknown>) {
    return this.notes.list({ search: queryText(q, 'search'), subject: queryText(q, 'subject'), noteType: queryText(q, 'noteType'), page: queryText(q, 'page') })
  }

  @Get(':id')
  @RateLimit(CONTENT_LIMITS.adminRead)
  async get(@Param('id') id: string) {
    return { data: await this.notes.get(id) }
  }

  @Post()
  @HttpCode(201)
  @RateLimit(CONTENT_LIMITS.adminWrite)
  create(@Req() req: Req, @Body() body: unknown) {
    return this.notes.create(actorOf(req), body)
  }

  @Put(':id')
  @RateLimit(CONTENT_LIMITS.adminWrite)
  update(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.notes.update(actorOf(req), id, body)
  }

  @Delete(':id')
  @HttpCode(200)
  @RateLimit(CONTENT_LIMITS.adminWrite)
  remove(@Req() req: Req, @Param('id') id: string) {
    return this.notes.remove(actorOf(req), id)
  }
}
