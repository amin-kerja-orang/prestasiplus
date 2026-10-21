import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { CurrentCaller, type Caller } from '../users/caller'
import { PkskAdminAccessService } from './pksk-admin-access.service'
import { PkskAdminQuestionsService } from './pksk-admin-questions.service'
import { PKSK_LIMITS } from './pksk.constants'

/** PKSK question bank (S5 to S7), admin only. `stats` and `bulk` are declared before `:id`. */
@Controller('admin/pksk-questions')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PkskAdminQuestionsController {
  constructor(private readonly questions: PkskAdminQuestionsService) {}

  @Get()
  @RateLimit(PKSK_LIMITS.adminRead)
  list(@Query() query: unknown) {
    return this.questions.list(query)
  }

  @Get('stats')
  @RateLimit(PKSK_LIMITS.adminRead)
  async stats() {
    return ok(await this.questions.stats())
  }

  @Post('bulk')
  @HttpCode(200)
  @RateLimit(PKSK_LIMITS.adminWrite)
  bulk(@CurrentCaller() caller: Caller, @Body() body: unknown) {
    return this.questions.bulk(caller, body)
  }

  @Get(':id')
  @RateLimit(PKSK_LIMITS.adminRead)
  async get(@Param('id') id: string) {
    return ok(await this.questions.get(id))
  }

  /** 201 (the Nest default for POST). */
  @Post()
  @RateLimit(PKSK_LIMITS.adminWrite)
  create(@CurrentCaller() caller: Caller, @Body() body: unknown) {
    return this.questions.create(caller, body)
  }

  @Put(':id')
  @RateLimit(PKSK_LIMITS.adminWrite)
  update(@CurrentCaller() caller: Caller, @Param('id') id: string, @Body() body: unknown) {
    return this.questions.update(caller, id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  @RateLimit(PKSK_LIMITS.adminWrite)
  async remove(@CurrentCaller() caller: Caller, @Param('id') id: string): Promise<void> {
    await this.questions.remove(caller, id)
  }
}

/** PKSK access grants (S8), admin only: personal data of paying users, never cached. */
@Controller('admin/pksk-access')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PkskAdminAccessController {
  constructor(private readonly access: PkskAdminAccessService) {}

  @Get()
  @RateLimit(PKSK_LIMITS.adminRead)
  list(@Query() query: unknown) {
    return this.access.list(query)
  }

  @Get('stats')
  @RateLimit(PKSK_LIMITS.adminRead)
  async stats() {
    return ok(await this.access.stats())
  }

  /** 201 (the Nest default for POST). */
  @Post()
  @RateLimit(PKSK_LIMITS.adminWrite)
  grant(@CurrentCaller() caller: Caller, @Body() body: unknown) {
    return this.access.grant(caller, body)
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @RateLimit(PKSK_LIMITS.adminWrite)
  revoke(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return this.access.revoke(caller, id)
  }
}

/** The 3 packages (M07-21), admin only. */
@Controller('pksk-packages')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PkskPackagesController {
  constructor(private readonly access: PkskAdminAccessService) {}

  @Get()
  @RateLimit(PKSK_LIMITS.adminRead)
  async list() {
    return ok(await this.access.packages())
  }
}
