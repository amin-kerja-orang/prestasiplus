import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards'
import { NoStoreInterceptor } from '../../../common/http'
import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type AuditActor } from './actor'
import { BIJAK_BUILDER_LIMITS } from './builder.constants'
import { BuilderService } from './builder.service'

/**
 * Paper builder (BE-39), Admin Pusat only. Bodies and the list query are read raw and parsed in the
 * service, so that a missing paper is 404 before a bad body is 422 (the mock's order). CSRF on every
 * mutation is enforced by the session guard. `POST preview` is declared before the `:id` routes.
 */
@Controller('admin/papers')
@Roles('admin')
@UseGuards(RateLimitGuard)
export class BuilderController {
  constructor(@Inject(BuilderService) private readonly builder: BuilderService) {}

  @Get()
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  list(@Query() query: unknown) {
    return this.builder.list(query)
  }

  @Post()
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async create(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.builder.create(actor, body))
  }

  /** "Pratonton kolam"; declared before `:id` (R1-B09a). */
  @Get('pool-preview')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  async poolPreview(@Query() query: unknown) {
    return ok(await this.builder.poolPreview(query))
  }

  /** Jana set (draft paper by `composeStandardPaper`, exact or refuse). */
  @Post('generate')
  @RateLimit(BIJAK_BUILDER_LIMITS.generate)
  async generate(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.builder.generateDraft(actor, body))
  }

  @Post('preview')
  @HttpCode(200)
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  @UseInterceptors(NoStoreInterceptor)
  async preview(@Body() body: unknown) {
    return ok(await this.builder.preview(body))
  }

  @Get(':id')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  async get(@Param('id') id: string) {
    return ok(await this.builder.get(id))
  }

  @Put(':id')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async update(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.builder.update(actor, id, body))
  }

  @Delete(':id')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async remove(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.builder.remove(actor, id))
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async publish(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.builder.publish(actor, id, body))
  }

  @Get(':id/review')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  async review(@Param('id') id: string) {
    return ok(await this.builder.review(id))
  }

  @Get(':id/student-view')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  async studentView(@Param('id') id: string) {
    return ok(await this.builder.studentView(id))
  }

  @Get(':id/sections/:sid/pool')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  sectionPool(@Param('id') id: string, @Param('sid') sid: string, @Query() query: unknown) {
    return this.builder.sectionPool(id, sid, query)
  }

  @Post(':id/placements')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async addPlacement(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.builder.addPlacement(actor, id, body))
  }

  @Delete(':id/placements/:questionId')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async removePlacement(@Actor() actor: AuditActor, @Param('id') id: string, @Param('questionId') questionId: string) {
    return ok(await this.builder.removePlacement(actor, id, questionId))
  }

  @Put(':id/sections/:sid/order')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async reorder(@Actor() actor: AuditActor, @Param('id') id: string, @Param('sid') sid: string, @Body() body: unknown) {
    return ok(await this.builder.reorderSection(actor, id, sid, body))
  }

  /** R1-T34 "Sunting petikan": the title of a stimulus group on the paper. */
  @Put(':id/groups/:groupId')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async groupLabel(@Actor() actor: AuditActor, @Param('id') id: string, @Param('groupId') groupId: string, @Body() body: unknown) {
    return ok(await this.builder.setGroupLabel(actor, id, groupId, body))
  }

  @Post(':id/copy')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async copy(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.builder.copy(actor, id))
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async withdraw(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.builder.withdraw(actor, id))
  }
}
