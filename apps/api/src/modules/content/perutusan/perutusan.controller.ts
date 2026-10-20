import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'

import { Public, Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok, okList } from '../../../common/http'
import { listMeta } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { actorOf, type AuthedRequest } from '../videos/actor'
import { PERUTUSAN_LIMITS } from './perutusan.constants'
import { PerutusanService, type UploadedPart } from './perutusan.service'
import { PerutusanUploadInterceptor } from './perutusan.upload'

type UploadMap = Record<string, UploadedPart[] | undefined>

/** The feed and "mine" are unpaged: one page that holds everything (the mock answers `unpaged`). */
const unpaged = <T>(data: T[]) => okList(data, listMeta(1, Math.max(1, data.length), data.length))

/**
 * M09 Perutusan (#33-#39). Every route needs a session (global guard) and every answer is `no-store` (personal feed).
 * The static paths `mine` and `compose-context` are declared before `:id`. An invisible or unknown post, and a malformed
 * id, are the same 404. Writing a post is for `admin` and `school_admin` (BR-M09-22); reacting and commenting is for
 * anyone who can see the post.
 */
@Controller('perutusan')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PerutusanController {
  constructor(@Inject(PerutusanService) private readonly perutusan: PerutusanService) {}

  @Get()
  @RateLimit(PERUTUSAN_LIMITS.read)
  async list(@Req() req: AuthedRequest) {
    return unpaged(await this.perutusan.list(actorOf(req)))
  }

  @Get('mine')
  @RateLimit(PERUTUSAN_LIMITS.read)
  async mine(@Req() req: AuthedRequest) {
    return unpaged(await this.perutusan.mine(actorOf(req)))
  }

  @Get('compose-context')
  @RateLimit(PERUTUSAN_LIMITS.read)
  async composeContext(@Req() req: AuthedRequest) {
    return ok(await this.perutusan.composeContext(actorOf(req)))
  }

  @Get(':id')
  @RateLimit(PERUTUSAN_LIMITS.read)
  async detail(@Req() req: AuthedRequest, @Param('id') id: string) {
    return ok(await this.perutusan.detail(actorOf(req), id))
  }

  @Post()
  @HttpCode(201)
  @Roles('admin', 'school_admin')
  @RateLimit(PERUTUSAN_LIMITS.write)
  @UseInterceptors(PerutusanUploadInterceptor)
  async create(@Req() req: AuthedRequest, @Body() body: unknown, @UploadedFiles() files: UploadMap | undefined) {
    const f = files ?? {}
    return this.perutusan.create(actorOf(req), body, {
      images: [...(f.images ?? []), ...(f['images[]'] ?? [])],
      documents: [...(f.documents ?? []), ...(f['documents[]'] ?? [])],
    })
  }

  @Post(':id/reactions')
  @HttpCode(200)
  @RateLimit(PERUTUSAN_LIMITS.react)
  async react(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.perutusan.react(actorOf(req), id, body))
  }

  @Post(':id/comments')
  @HttpCode(201)
  @RateLimit(PERUTUSAN_LIMITS.write)
  async comment(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.perutusan.comment(actorOf(req), id, body)
  }
}

/** The public share page of a perutusan (#40): a guest may read a public, published post. Limited per client address. */
@Controller('public/perutusan')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PublicPerutusanController {
  constructor(@Inject(PerutusanService) private readonly perutusan: PerutusanService) {}

  @Get(':id')
  @Public()
  @RateLimit(PERUTUSAN_LIMITS.publicRead)
  async detail(@Param('id') id: string) {
    return ok(await this.perutusan.publicDetail(id))
  }
}
