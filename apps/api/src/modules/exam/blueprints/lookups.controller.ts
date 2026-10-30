import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'

import { Roles } from '../../../common/guards'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { BIJAK_BUILDER_LIMITS } from '../builder/builder.constants'
import { BlueprintLookupsService } from './lookups.service'

/**
 * Pickers of the blueprint editor (architecture 15.1, 15.2): the DSKP units of a subject and the Bijak subject
 * list. Admin Pusat only. They sit with the blueprints because their only consumer is the "Kontrak" editor.
 */
@Roles('admin')
@UseGuards(RateLimitGuard)
@Controller('admin/bijak')
export class BlueprintLookupsController {
  constructor(@Inject(BlueprintLookupsService) private readonly lookups: BlueprintLookupsService) {}

  @Get('dskp/units')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  units(@Query() query: unknown) {
    return this.lookups.units(query)
  }

  @Get('subjects')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  subjects() {
    return this.lookups.subjects()
  }
}
