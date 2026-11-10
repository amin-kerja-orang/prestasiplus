import { Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards'
import { NoStoreInterceptor } from '../../../common/http'
import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type AuditActor } from '../builder/actor'
import { KERTAS_DOKUMEN_LIMITS } from './documents.constants'
import { DocumentsService } from './documents.service'

/**
 * Pupil side of the Kertas Subjektif page-image documents (V2 `GET /kertas-subjektif` and `GET /kertas-subjektif/{paper}`). Student role
 * only (an admin inside Mod Pelajar acts as a student, as on `/bijak/papers`); a Draf document is 404, never served.
 */
@Controller('bijak/kertas-dokumen')
@Roles('student')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class KertasDokumenController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}

  @Get()
  @RateLimit(KERTAS_DOKUMEN_LIMITS.read)
  async list() {
    return ok(await this.documents.listPublished())
  }

  @Get(':id')
  @RateLimit(KERTAS_DOKUMEN_LIMITS.read)
  async get(@Param('id') id: string) {
    return ok(await this.documents.getPublished(id))
  }
}

/** Admin Pusat side (V2 `GET /admin/kertas-subjektif` and `POST /admin/kertas-subjektif/{paper}/terbit`). CSRF on the POST is enforced by the session guard. */
@Controller('admin/kertas-dokumen')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class KertasDokumenAdminController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}

  @Get()
  @RateLimit(KERTAS_DOKUMEN_LIMITS.read)
  async list(@Query() query: unknown) {
    return ok(await this.documents.listForAdmin(query))
  }

  @Get(':id')
  @RateLimit(KERTAS_DOKUMEN_LIMITS.read)
  async get(@Param('id') id: string) {
    return ok(await this.documents.getForAdmin(id))
  }

  @Post(':id/terbit')
  @HttpCode(200)
  @RateLimit(KERTAS_DOKUMEN_LIMITS.write)
  async toggle(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.documents.toggle(actor, id))
  }
}
