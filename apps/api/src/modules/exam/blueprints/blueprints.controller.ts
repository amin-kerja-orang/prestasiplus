import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common'

import { Roles } from '../../../common/guards'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { BIJAK_BUILDER_LIMITS } from '../builder/builder.constants'
import { Actor, type AuditActor } from './actor'
import { BlueprintsService } from './blueprints.service'

/**
 * Blueprint ("Kontrak") admin of the Bijak SPM paper builder (BE-39, bijak-spm BJS-08): Admin Pusat only
 * (AC-32.1, AC-39.3). Bodies are read raw and parsed in the service so that 404 and 409 come before 422 (mock
 * order). CSRF on every write is enforced by the session guard.
 */
@Roles('admin')
@UseGuards(RateLimitGuard)
@Controller('admin/blueprints')
export class BlueprintsController {
  constructor(@Inject(BlueprintsService) private readonly blueprints: BlueprintsService) {}

  @Get()
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  list(@Query() query: unknown) {
    return this.blueprints.list(query)
  }

  @Get(':subject/:kertas')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  get(@Param('subject') subject: string, @Param('kertas') kertas: string) {
    return this.blueprints.get(subject, kertas)
  }

  @Post()
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  create(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.blueprints.create(actor, body)
  }

  @Post(':subject/:kertas/versions')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  addVersion(@Actor() actor: AuditActor, @Param('subject') subject: string, @Param('kertas') kertas: string, @Body() body: unknown) {
    return this.blueprints.addVersion(actor, subject, kertas, body)
  }

  @Post(':subject/:kertas/retire')
  @HttpCode(200)
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  retire(@Actor() actor: AuditActor, @Param('subject') subject: string, @Param('kertas') kertas: string) {
    return this.blueprints.retire(actor, subject, kertas)
  }
}
