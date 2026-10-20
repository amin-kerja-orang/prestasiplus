import { Controller, Get, Inject, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { NoStoreInterceptor } from '../../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { AdminOrGuru } from '../actor'
import { WORKFLOW_LOOKUP_LIMIT } from '../quality/limits'
import { DskpService } from './dskp.service'

/** DSKP cascade of the teacher's question form. Admin or Guru. Bare arrays, no envelope (live shape). */
@AdminOrGuru()
@UseGuards(RateLimitGuard)
@RateLimit(WORKFLOW_LOOKUP_LIMIT)
@UseInterceptors(NoStoreInterceptor)
@Controller('guru/dskp')
export class DskpController {
  constructor(@Inject(DskpService) private readonly dskp: DskpService) {}

  @Get('bidang')
  bidang(@Query() q: Record<string, unknown>) {
    return this.dskp.bidang(q.subjectId, q.educationLevelId)
  }

  @Get('sk')
  sk(@Query() q: Record<string, unknown>) {
    return this.dskp.sk(q.bidangId)
  }

  @Get('sp')
  sp(@Query() q: Record<string, unknown>) {
    return this.dskp.sp(q.skId)
  }
}
