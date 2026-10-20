import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'

import { listMeta, ok, okList } from '../../common/http/respond'
import { Roles } from '../../common/guards'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor, type AuditActor } from './actor'
import { CurriculumAdminService } from './admin.service'
import { CURRICULUM_LIMITS } from './curriculum.constants'
import { BoundedQueryPipe } from './validation'

const unpaged = <T>(items: T[]) => okList(items, listMeta(1, Math.max(1, items.length), items.length))

/**
 * Admin routes of M03 (SRS #1 to #24): the `admin` role only (Admin Pusat). Bodies are read raw and
 * validated in the service so that a missing record is 404 before a bad body is 422, like the mock.
 * CSRF on every mutation is enforced by the session guard (BE-03). Every write is rate limited per
 * user (`CURRICULUM_LIMITS.write`, 429 `RATE_LIMITED`); reads are not.
 */
@Roles('admin')
@UseGuards(RateLimitGuard)
@Controller('admin/education-levels')
export class AdminEducationLevelsController {
  constructor(@Inject(CurriculumAdminService) private readonly admin: CurriculumAdminService) {}

  @Get()
  async list() {
    return unpaged(await this.admin.listLevels())
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(await this.admin.getLevel(id))
  }

  @Post()
  @RateLimit(CURRICULUM_LIMITS.write)
  create(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createLevel(actor, body)
  }

  @Put(':id')
  @RateLimit(CURRICULUM_LIMITS.write)
  update(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateLevel(actor, id, body)
  }

  @Patch(':id/active')
  @RateLimit(CURRICULUM_LIMITS.write)
  async setActive(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.setLevelActive(actor, id, body))
  }

  @Delete(':id')
  @RateLimit(CURRICULUM_LIMITS.write)
  remove(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteLevel(actor, id)
  }
}

@Roles('admin')
@UseGuards(RateLimitGuard)
@Controller('admin/subjects')
export class AdminSubjectsController {
  constructor(@Inject(CurriculumAdminService) private readonly admin: CurriculumAdminService) {}

  @Get()
  async list() {
    return unpaged(await this.admin.listSubjects())
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(await this.admin.getSubject(id))
  }

  @Post()
  @RateLimit(CURRICULUM_LIMITS.write)
  create(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createSubject(actor, body)
  }

  @Put(':id')
  @RateLimit(CURRICULUM_LIMITS.write)
  update(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateSubject(actor, id, body)
  }

  @Patch(':id/active')
  @RateLimit(CURRICULUM_LIMITS.write)
  async setActive(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.setSubjectActive(actor, id, body))
  }

  @Delete(':id')
  @RateLimit(CURRICULUM_LIMITS.write)
  remove(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteSubject(actor, id)
  }
}

@Roles('admin')
@UseGuards(RateLimitGuard)
@Controller('admin/curriculum')
export class AdminCurriculumController {
  constructor(@Inject(CurriculumAdminService) private readonly admin: CurriculumAdminService) {}

  @Get()
  async tree(@Query(new BoundedQueryPipe()) query: unknown) {
    return ok(await this.admin.tree(query))
  }

  @Get('chapters/:id')
  async getChapter(@Param('id') id: string) {
    return ok(await this.admin.getChapter(id))
  }

  @Post('chapters')
  @RateLimit(CURRICULUM_LIMITS.write)
  createChapter(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createChapter(actor, body)
  }

  @Put('chapters/:id')
  @RateLimit(CURRICULUM_LIMITS.write)
  updateChapter(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateChapter(actor, id, body)
  }

  @Delete('chapters/:id')
  @RateLimit(CURRICULUM_LIMITS.write)
  deleteChapter(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteChapter(actor, id)
  }

  @Get('topics/:id')
  async getTopic(@Param('id') id: string) {
    return ok(await this.admin.getTopic(id))
  }

  @Post('topics')
  @RateLimit(CURRICULUM_LIMITS.write)
  createTopic(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createTopic(actor, body)
  }

  @Put('topics/:id')
  @RateLimit(CURRICULUM_LIMITS.write)
  updateTopic(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateTopic(actor, id, body)
  }

  @Delete('topics/:id')
  @RateLimit(CURRICULUM_LIMITS.write)
  deleteTopic(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteTopic(actor, id)
  }

  @Post('subtopics')
  @RateLimit(CURRICULUM_LIMITS.write)
  createSubtopic(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createSubtopic(actor, body)
  }

  @Put('subtopics/:id')
  @RateLimit(CURRICULUM_LIMITS.write)
  updateSubtopic(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateSubtopic(actor, id, body)
  }

  @Delete('subtopics/:id')
  @RateLimit(CURRICULUM_LIMITS.write)
  deleteSubtopic(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteSubtopic(actor, id)
  }
}
