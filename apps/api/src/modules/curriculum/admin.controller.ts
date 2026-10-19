import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common'

import { listMeta, ok, okList } from '../../common/http/respond'
import { Roles } from '../../common/guards'
import { CurriculumAdminService } from './admin.service'

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
  create(@Body() body: unknown) {
    return this.admin.createLevel(body)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateLevel(id, body)
  }

  @Patch(':id/active')
  async setActive(@Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.setLevelActive(id, body))
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.admin.deleteLevel(id)
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
  create(@Body() body: unknown) {
    return this.admin.createSubject(body)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateSubject(id, body)
  }

  @Patch(':id/active')
  async setActive(@Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.setSubjectActive(id, body))
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.admin.deleteSubject(id)
  }
}

@Roles('admin')
@Controller('admin/curriculum')
export class AdminCurriculumController {
  constructor(@Inject(CurriculumAdminService) private readonly admin: CurriculumAdminService) {}

  @Get()
  async tree(@Query() query: unknown) {
    return ok(await this.admin.tree(query))
  }

  @Get('chapters/:id')
  async getChapter(@Param('id') id: string) {
    return ok(await this.admin.getChapter(id))
  }

  @Post('chapters')
  createChapter(@Body() body: unknown) {
    return this.admin.createChapter(body)
  }

  @Put('chapters/:id')
  updateChapter(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateChapter(id, body)
  }

  @Delete('chapters/:id')
  deleteChapter(@Param('id') id: string) {
    return this.admin.deleteChapter(id)
  }

  @Get('topics/:id')
  async getTopic(@Param('id') id: string) {
    return ok(await this.admin.getTopic(id))
  }

  @Post('topics')
  createTopic(@Body() body: unknown) {
    return this.admin.createTopic(body)
  }

  @Put('topics/:id')
  updateTopic(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateTopic(id, body)
  }

  @Delete('topics/:id')
  deleteTopic(@Param('id') id: string) {
    return this.admin.deleteTopic(id)
  }

  @Post('subtopics')
  createSubtopic(@Body() body: unknown) {
    return this.admin.createSubtopic(body)
  }

  @Put('subtopics/:id')
  updateSubtopic(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.updateSubtopic(id, body)
  }

  @Delete('subtopics/:id')
  deleteSubtopic(@Param('id') id: string) {
    return this.admin.deleteSubtopic(id)
  }
}
