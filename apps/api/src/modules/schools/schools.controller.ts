import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import {
  type AdminSchool,
  type Jpn,
  type ListMeta,
  type Ppd,
  type SchoolOption,
  SchoolOptionsQuerySchema,
  type SchoolSummary,
} from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { Public, Roles } from '../../common/guards/decorators'
import { ok } from '../../common/http/respond'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { NoStoreInterceptor } from './no-store.interceptor'
import { RateLimit, RateLimitGuard } from './rate-limit'
import { SchoolsRepository } from './schools.repository'
import { type ListQuery, type RequestMeta, type SearchQuery, SchoolsService } from './schools.service'

type Req = Request & RequestWithAuth

function authOf(req: Req): AuthContext {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth
}

function metaOf(req: Req): RequestMeta {
  return { requestId: requestIdOf(req) ?? null, ip: req.ip ?? req.socket.remoteAddress ?? null }
}

/**
 * Admin school management (Admin Pusat only, as in the mock: a school admin gets 403 on every
 * route here). Join codes are bearer secrets, so every response is `no-store`. Reads and writes are
 * rate limited per user (D57a).
 */
@Controller()
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class SchoolsAdminController {
  constructor(@Inject(SchoolsService) private readonly schools: SchoolsService) {}

  @Get('admin/schools')
  @RateLimit('read')
  async list(@Query() query: ListQuery): Promise<{ data: AdminSchool[]; meta: ListMeta }> {
    return this.schools.list(query)
  }

  // Declared before `:id` (a static segment wins anyway).
  @Get('admin/schools/options')
  @RateLimit('read')
  async options(): Promise<{ data: SchoolOption[] }> {
    return ok(await this.schools.options())
  }

  @Get('admin/schools/:id')
  @RateLimit('read')
  async get(@Param('id') id: string): Promise<{ data: AdminSchool }> {
    return ok(await this.schools.get(id))
  }

  @Post('admin/schools')
  @RateLimit('write')
  async create(@Body() body: unknown, @Req() req: Req): Promise<{ data: AdminSchool; status: string }> {
    return this.schools.create(body, authOf(req), metaOf(req))
  }

  @Put('admin/schools/:id')
  @RateLimit('write')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: Req): Promise<{ data: AdminSchool; status: string }> {
    return this.schools.update(id, body, authOf(req), metaOf(req))
  }

  @Post('admin/schools/:id/toggle')
  @HttpCode(200)
  @RateLimit('write')
  async toggle(@Param('id') id: string, @Req() req: Req): Promise<{ data: { isActive: boolean }; status: string }> {
    return this.schools.toggle(id, authOf(req), metaOf(req))
  }

  /** XL-13 alias of `admin/schools/options`; `all=1` is required. */
  @Get('schools')
  @RateLimit('read')
  async all(@Query() query: unknown): Promise<{ data: SchoolOption[] }> {
    new ZodValidationPipe(SchoolOptionsQuerySchema).transform(query)
    return ok(await this.schools.options())
  }
}

/** The unauthenticated pickers of login and register. Rate limited per client address (D57a). */
@Controller()
@Public()
@UseGuards(RateLimitGuard)
@RateLimit('public')
export class SchoolsPublicController {
  constructor(
    @Inject(SchoolsService) private readonly schools: SchoolsService,
    @Inject(SchoolsRepository) private readonly repo: SchoolsRepository,
  ) {}

  @Get('schools/search')
  async search(@Query() query: SearchQuery): Promise<{ data: SchoolSummary[] }> {
    return ok(await this.schools.search(query))
  }

  @Get('jpn')
  async jpn(): Promise<{ data: Jpn[] }> {
    return ok(await this.repo.jpnList())
  }

  @Get('jpn/:id/ppd')
  async ppd(@Param('id') id: string): Promise<{ data: Ppd[] }> {
    const rows = await this.repo.ppdList(id)
    if (!rows) throw ApiError.of('NOT_FOUND')
    return ok(rows)
  }
}
