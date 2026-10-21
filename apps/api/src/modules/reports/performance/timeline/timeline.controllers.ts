import {
  type CanActivate,
  type ExecutionContext,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../../../common/errors/api-error'
import { NoStoreInterceptor, ok } from '../../../../common/http'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../../../common/throttle'
import { ctxOf, overloadTo429 } from '../http/request'
import { TimelineUploadInterceptor } from './timeline-upload.interceptor'
import { mayPost, TimelineService } from './timeline.service'
import type { RawPhoto } from './timeline.validation'

type Req = Request & RequestWithAuth

/** Same per-user read budget as the other performance routes (D57a). */
const READ = {
  bucket: 'performance.read',
  env: 'THROTTLE_PERFORMANCE_READ_PER_MINUTE',
  default: 120,
  per: 'user',
} as const satisfies RateLimitSpec

/** New posts: 10 per minute per user (own bucket, counted per process). */
export const TIMELINE_WRITE_PER_MINUTE = 10
const WRITE = {
  bucket: 'performance.timeline.write',
  env: 'THROTTLE_TIMELINE_WRITE_PER_MINUTE',
  default: TIMELINE_WRITE_PER_MINUTE,
  per: 'user',
} as const satisfies RateLimitSpec

/**
 * Runs BEFORE the body is read, so a role that may not post costs no upload buffer (403 `This action is
 * unauthorized.`). The global guards (session, CSRF) and the rate limit ran first.
 */
@Injectable()
export class TimelineWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Req>()
    if (!mayPost(ctxOf(req))) throw ApiError.of('FORBIDDEN')
    return true
  }
}

/** What `FileFieldsInterceptor` puts on the request: the `photos` and `photos[]` parts. */
interface PhotoParts {
  photos?: RawPhoto[]
  'photos[]'?: RawPhoto[]
}

/**
 * The pupil's own timeline (S16, S17). GET lists the caller's own non-test posts (any signed-in role); POST
 * (multipart, CSRF) is for a student or an admin in Mod Pelajar. Every answer is `no-store`.
 */
@Controller('timeline')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class TimelineController {
  constructor(@Inject(TimelineService) private readonly timeline: TimelineService) {}

  @Get()
  @RateLimit(READ)
  async mine(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.timeline.mine(ctxOf(req))))
  }

  @Post()
  @HttpCode(201)
  @RateLimit(WRITE)
  @UseGuards(TimelineWriteGuard)
  @UseInterceptors(TimelineUploadInterceptor)
  async create(@Body() body: unknown, @UploadedFiles() parts: PhotoParts | undefined, @Req() req: Req) {
    const photos = [...(parts?.photos ?? []), ...(parts?.['photos[]'] ?? [])].map((f) => ({ buffer: f.buffer }))
    return ok(await overloadTo429(async () => this.timeline.create(ctxOf(req), body, photos)))
  }
}
