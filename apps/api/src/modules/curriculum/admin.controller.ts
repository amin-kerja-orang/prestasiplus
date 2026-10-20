import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common'

import { listMeta, ok, okList } from '../../common/http/respond'
import { Roles } from '../../common/guards'
import { Actor, type AuditActor } from './actor'
import { CurriculumAdminService } from './admin.service'
import { BoundedQueryPipe } from './validation'

const unpaged = <T>(items: T[]) => okList(items, listMeta(1, Math.max(1, items.length), items.length))

/**
 * Admin routes of M03 (SRS #1 to #24): the `admin` role only (Admin Pusat). Bodies are read raw and
 * validated in the service so that a missing record is 404 before a bad body is 422, like the mock.
 * CSRF on every mutation is enforced by the session guard (BE-03).
 */
@Roles('admin')
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
  create(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createLevel(actor, body)
  }

  @Put(':id')
  update(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateLevel(actor, id, body)
  }

  @Patch(':id/active')
  async setActive(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.setLevelActive(actor, id, body))
  }

  @Delete(':id')
  remove(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteLevel(actor, id)
  }
}

@Roles('admin')
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
  create(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createSubject(actor, body)
  }

  @Put(':id')
  update(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateSubject(actor, id, body)
  }

  @Patch(':id/active')
  async setActive(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.setSubjectActive(actor, id, body))
  }

  @Delete(':id')
  remove(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteSubject(actor, id)
  }
}

@Roles('admin')
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
  createChapter(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createChapter(actor, body)
  }

  @Put('chapters/:id')
  updateChapter(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateChapter(actor, id, body)
  }

  @Delete('chapters/:id')
  deleteChapter(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteChapter(actor, id)
  }

  @Get('topics/:id')
  async getTopic(@Param('id') id: string) {
    return ok(await this.admin.getTopic(id))
  }

  @Post('topics')
  createTopic(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createTopic(actor, body)
  }

  @Put('topics/:id')
  updateTopic(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateTopic(actor, id, body)
  }

  @Delete('topics/:id')
  deleteTopic(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteTopic(actor, id)
  }

  @Post('subtopics')
  createSubtopic(@Actor() actor: AuditActor, @Body() body: unknown) {
    return this.admin.createSubtopic(actor, body)
  }

  @Put('subtopics/:id')
  updateSubtopic(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateSubtopic(actor, id, body)
  }

  @Delete('subtopics/:id')
  deleteSubtopic(@Actor() actor: AuditActor, @Param('id') id: string) {
    return this.admin.deleteSubtopic(actor, id)
  }
}
