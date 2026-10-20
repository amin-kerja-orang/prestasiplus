import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../common/guards/decorators'
import { listMeta, NoStoreInterceptor, ok, okList } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor, type ClassActor } from './actor'
import { CLASS_LIMITS } from './classes.constants'
import { ClassesService } from './classes.service'

/**
 * Teacher routes of M10 part A (`/api/guru/*`, SRS #12 to #17, #1, #35 to #38, #51, #59). Role `teacher` only;
 * every answer is `no-store` (it names pupils, who are minors); reads and writes are rate limited per user (D57).
 * Bodies are parsed (strictly) inside the service so that rule failures are reported together with schema failures.
 */
@Controller('guru')
@Roles('teacher')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class TeacherClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get('classes')
  @RateLimit(CLASS_LIMITS.read)
  async list(@Actor() actor: ClassActor) {
    const items = await this.classes.listClasses(actor)
    return okList(items, listMeta(1, Math.max(1, items.length), items.length))
  }

  @Post('classes')
  @RateLimit(CLASS_LIMITS.write)
  async create(@Actor() actor: ClassActor, @Body() body: unknown) {
    return ok(await this.classes.createClass(actor, body))
  }

  @Get('classes/:id/qr-data')
  @RateLimit(CLASS_LIMITS.read)
  async qrData(@Actor() actor: ClassActor, @Param('id') id: string) {
    return this.classes.qrData(actor, id)
  }

  @Get('students')
  @RateLimit(CLASS_LIMITS.read)
  async students(@Actor() actor: ClassActor, @Query() query: Record<string, unknown>) {
    return this.classes.students(actor, query)
  }

  @Put('students/:id')
  @RateLimit(CLASS_LIMITS.write)
  async addStudent(@Actor() actor: ClassActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.classes.addStudent(actor, id, body))
  }

  @Delete('students/:id')
  @RateLimit(CLASS_LIMITS.write)
  async removeStudent(@Actor() actor: ClassActor, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return ok(await this.classes.removeStudent(actor, id, query))
  }

  @Get('dashboard')
  @RateLimit(CLASS_LIMITS.read)
  async dashboard(@Actor() actor: ClassActor) {
    return ok(await this.classes.dashboard(actor))
  }

  @Get('chapters')
  @RateLimit(CLASS_LIMITS.read)
  async chapters(@Query() query: Record<string, unknown>) {
    return this.classes.chapters(query)
  }

  @Post('chapters')
  @RateLimit(CLASS_LIMITS.write)
  async createChapter(@Actor() actor: ClassActor, @Body() body: unknown) {
    return this.classes.createChapter(actor, body)
  }

  @Get('topics')
  @RateLimit(CLASS_LIMITS.read)
  async topics(@Query() query: Record<string, unknown>) {
    return this.classes.topics(query)
  }

  @Post('topics')
  @RateLimit(CLASS_LIMITS.write)
  async createTopic(@Actor() actor: ClassActor, @Body() body: unknown) {
    return this.classes.createTopic(actor, body)
  }

  @Get('contributions')
  @RateLimit(CLASS_LIMITS.read)
  async contributions(@Actor() actor: ClassActor) {
    return this.classes.contributions(actor)
  }

  @Get('galeri-rajah')
  @RateLimit(CLASS_LIMITS.read)
  gallery(@Query() query: Record<string, unknown>) {
    return this.classes.gallery(query)
  }
}
