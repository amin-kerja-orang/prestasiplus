import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'

import { Public } from '../../../common/guards/decorators'
import { SESSION_RESOLVER, type SessionResolver } from '../../../common/guards/session-resolver'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { actorOf, optionalActorOf, type AuthedRequest } from './actor'
import { queryString } from './form-fields'
import { VIDEO_LIMITS } from './videos.constants'
import { VideosService, type VideoListQuery } from './videos.service'

/**
 * M09 videos (#27-#32). Reads are public (the library is visibility-filtered per viewer, so every answer is
 * `no-store`); writes need a session and CSRF (global guards). `form-context` is declared before `:id` so
 * it is not read as an id. An invalid id is the same 404 as an unknown or invisible one.
 */
@Controller('videos')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class VideosController {
  constructor(
    @Inject(VideosService) private readonly videos: VideosService,
    @Inject(SESSION_RESOLVER) private readonly sessions: SessionResolver,
  ) {}

  @Get()
  @Public()
  @RateLimit(VIDEO_LIMITS.publicRead)
  async list(@Req() req: AuthedRequest, @Query() query: VideoListQuery) {
    return this.videos.list(await optionalActorOf(this.sessions, req), query)
  }

  @Get('form-context')
  @RateLimit(VIDEO_LIMITS.read)
  async formContext(@Req() req: AuthedRequest) {
    return ok(await this.videos.formContext(actorOf(req)))
  }

  @Get(':id')
  @Public()
  @RateLimit(VIDEO_LIMITS.publicRead)
  async detail(@Req() req: AuthedRequest, @Param('id') id: string, @Query('for') forParam: unknown) {
    return ok(await this.videos.detail(await optionalActorOf(this.sessions, req), id, queryString(forParam) === 'edit'))
  }

  @Post()
  @HttpCode(201)
  @RateLimit(VIDEO_LIMITS.write)
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.videos.create(actorOf(req), body)
  }

  @Put(':id')
  @RateLimit(VIDEO_LIMITS.write)
  async update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.videos.update(actorOf(req), id, body)
  }

  @Delete(':id')
  @RateLimit(VIDEO_LIMITS.write)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.videos.remove(actorOf(req), id)
  }
}
