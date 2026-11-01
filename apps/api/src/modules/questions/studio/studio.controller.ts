import { Controller, Get, Inject, Query } from '@nestjs/common'
import { StudioDskpQuerySchema } from '@pp/contract'

import { Roles } from '../../../common/guards'
import { ok } from '../../../common/http/respond'
import { parseBody } from '../http/parse'
import { StudioDskpService } from './studio-dskp.service'

/**
 * The DSKP picker of the Studio (R1-F03b): units with their SP for a subject and level. Admin Pusat only, read only. The
 * stimulus and group writes are T32's (`/api/stimuli`, `/api/stimulus-groups*`); this file holds only what T32 lacks.
 */
@Roles('admin')
@Controller('questions/studio')
export class StudioController {
  constructor(@Inject(StudioDskpService) private readonly dskp: StudioDskpService) {}

  @Get('dskp')
  async units(@Query() query: unknown) {
    const q = parseBody(StudioDskpQuerySchema, query)
    return ok(await this.dskp.units(q.subjectId, q.educationLevelId))
  }
}
