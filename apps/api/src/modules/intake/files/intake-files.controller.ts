import {
  type CanActivate,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  type ExecutionContext,
} from '@nestjs/common'
import {
  IntakeBatchCreateSchema,
  IntakeBatchDetailSchema,
  IntakeBatchListQuerySchema,
  IntakeBatchSummarySchema,
  IntakePageListSchema,
  IntakeUploadResultSchema,
  type IntakeBatchCreate,
  type IntakeBatchListQuery,
} from '@pp/contract'
import type { Request, Response } from 'express'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards'
import { NoStoreInterceptor, ok, okList } from '../../../common/http'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { INTAKE_LIMITS } from './intake-files.config'
import { type CallerInfo, IntakeFilesService, type ServedBytes } from './intake-files.service'
import { IntakeUploadInterceptor } from './intake-upload.interceptor'
import { IntakeUploadService, type UploadedPart } from './intake-upload.service'

type Req = Request & RequestWithAuth

function authOf(req: Req): AuthContext {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth
}

function infoOf(req: Request): CallerInfo {
  return { ip: req.ip ?? req.socket.remoteAddress ?? null, requestId: requestIdOf(req) ?? null }
}

/** Runs BEFORE the body is read: an unknown, foreign or closed batch costs no buffer (404 / 409). */
@Injectable()
export class IntakeUploadGuard implements CanActivate {
  constructor(@Inject(IntakeUploadService) private readonly uploads: IntakeUploadService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Req>()
    await this.uploads.assertOpen(authOf(req), String(req.params.id))
    return true
  }
}

/** Page number from the path: anything that is not a positive whole number is simply "no such page" (404). */
function pageNumber(raw: string): number {
  return /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : Number.NaN
}

/**
 * Intake submissions and their files (BE-37). Guru on own batches, Admin Pusat on all; every other role is 403,
 * anything not visible is 404 (never 403 on an id). CSRF on the POSTs is enforced by the global session guard.
 * Responses carry no storage key, hash or internal file id and are never cached.
 */
@Controller('intake')
@Roles('teacher', 'admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class IntakeFilesController {
  constructor(
    @Inject(IntakeFilesService) private readonly batches: IntakeFilesService,
    @Inject(IntakeUploadService) private readonly uploads: IntakeUploadService,
  ) {}

  @Post('batches')
  @HttpCode(201)
  @RateLimit(INTAKE_LIMITS.write)
  async create(@Req() req: Req, @Body(new ZodValidationPipe(IntakeBatchCreateSchema)) body: IntakeBatchCreate) {
    return ok(IntakeBatchSummarySchema.parse(await this.batches.createBatch(authOf(req), body, infoOf(req))))
  }

  @Get('batches')
  async list(@Req() req: Req, @Query(new ZodValidationPipe(IntakeBatchListQuerySchema)) query: IntakeBatchListQuery) {
    const { data, meta } = await this.batches.listBatches(authOf(req), query)
    return okList(
      data.map((b) => IntakeBatchSummarySchema.parse(b)),
      meta,
    )
  }

  @Get('batches/:id')
  async one(@Req() req: Req, @Param('id') id: string) {
    return ok(IntakeBatchDetailSchema.parse(await this.batches.getBatch(authOf(req), id)))
  }

  @Post('batches/:id/files')
  @HttpCode(201)
  @RateLimit(INTAKE_LIMITS.write)
  @UseGuards(IntakeUploadGuard)
  @UseInterceptors(IntakeUploadInterceptor)
  async upload(@Req() req: Req, @Param('id') id: string, @UploadedFiles() files: UploadedPart[] | undefined) {
    const parts = (files ?? []).filter((f): f is UploadedPart => Boolean(f?.buffer))
    return ok(IntakeUploadResultSchema.parse(await this.uploads.upload(authOf(req), id, parts, infoOf(req))))
  }

  @Post('batches/:id/cancel')
  @HttpCode(200)
  @RateLimit(INTAKE_LIMITS.write)
  async cancel(@Req() req: Req, @Param('id') id: string) {
    return ok(IntakeBatchDetailSchema.parse(await this.batches.cancelBatch(authOf(req), id, infoOf(req))))
  }

  @Get('files/:id/pages')
  async pages(@Req() req: Req, @Param('id') id: string) {
    return ok(IntakePageListSchema.parse(await this.batches.listPages(authOf(req), id)))
  }

  @Get('files/:id/pages/:n/image')
  @RateLimit(INTAKE_LIMITS.read)
  async pageImage(@Req() req: Req, @Param('id') id: string, @Param('n') n: string, @Res() res: Response): Promise<void> {
    send(res, await this.batches.pageImage(authOf(req), id, pageNumber(n), 'image'))
  }

  @Get('files/:id/pages/:n/thumb')
  @RateLimit(INTAKE_LIMITS.read)
  async pageThumb(@Req() req: Req, @Param('id') id: string, @Param('n') n: string, @Res() res: Response): Promise<void> {
    send(res, await this.batches.pageImage(authOf(req), id, pageNumber(n), 'thumb'))
  }

  @Get('figures/:id/image')
  @RateLimit(INTAKE_LIMITS.read)
  async figureImage(@Req() req: Req, @Param('id') id: string, @Res() res: Response): Promise<void> {
    send(res, await this.batches.figureImage(authOf(req), id))
  }

  @Get('files/:id/original')
  @RateLimit(INTAKE_LIMITS.read)
  async original(@Req() req: Req, @Param('id') id: string, @Res() res: Response): Promise<void> {
    send(res, await this.batches.original(authOf(req), id))
  }
}

/** Streams stored bytes with the stored type, `nosniff`, `no-store`, and `inline` (the original is an attachment). */
function send(res: Response, served: ServedBytes): void {
  res
    .status(200)
    .set({
      'Content-Type': served.mime,
      'Content-Length': String(served.bytes.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Content-Disposition': served.disposition ?? 'inline',
      // Defence in depth if a browser ever renders the bytes as a document.
      'Content-Security-Policy': "default-src 'none'; sandbox",
    })
    .end(served.bytes)
}
