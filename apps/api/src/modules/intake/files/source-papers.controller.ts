import { Controller, Get, Inject, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { SourcePaperDetailSchema, SourcePaperListQuerySchema, SourcePaperRowSchema, type SourcePaperListQuery } from '@pp/contract'

import { Roles } from '../../../common/guards'
import { NoStoreInterceptor, ok, okList } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { INTAKE_LIMITS } from './intake-files.config'
import { SourcePapersService } from './source-papers.service'

/**
 * `/admin/source-papers*` (S2-T09, API-Q-23). Sumber Kertas, a read-only registry. Admin Pusat only: 401 without a session, 403 for every
 * other role (`@Roles('admin')`). GET only (no CSRF). An unknown id, or a guru batch, is 404.
 */
@Controller('admin/source-papers')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class SourcePapersController {
  constructor(@Inject(SourcePapersService) private readonly papers: SourcePapersService) {}

  @Get()
  @RateLimit(INTAKE_LIMITS.read)
  async list(@Query(new ZodValidationPipe(SourcePaperListQuerySchema)) query: SourcePaperListQuery) {
    const { data, meta } = await this.papers.list(query)
    return okList(
      data.map((r) => SourcePaperRowSchema.parse(r)),
      meta,
    )
  }

  @Get(':id')
  @RateLimit(INTAKE_LIMITS.read)
  async one(@Param('id') id: string) {
    return ok(SourcePaperDetailSchema.parse(await this.papers.detail(id)))
  }
}
