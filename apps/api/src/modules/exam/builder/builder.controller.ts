import {
  BadRequestException,
  Body,
  type CallHandler,
  type CanActivate,
  Controller,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Injectable,
  type NestInterceptor,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { BIJAK_BUILDER_MESSAGES } from '@pp/contract'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards'
import { NoStoreInterceptor } from '../../../common/http'
import { ok } from '../../../common/http/respond'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type AuditActor } from './actor'
import { BIJAK_BUILDER_LIMITS, PAPER_SOURCE_MAX_BYTES } from './builder.constants'
import { BuilderService } from './builder.service'
import { PaperSourceService, type SourceParts } from './paper-source.service'

/** A part that went over the 30 MB limit; carries the form field so the 422 lands on `paper` or `scheme`. */
class SourcePartTooLarge extends Error {
  constructor(readonly field: 'paper' | 'scheme') {
    super('source part too large')
  }
}

/**
 * Memory storage for multer that knows the field of an oversized part. Multer's own LIMIT_FILE_SIZE is turned by Nest into a
 * `PayloadTooLargeException` without the field name, so the 30 MB rule is enforced here, while the part streams, and names its field.
 */
const sourcePartStorage = {
  _handleFile(_req: unknown, file: { fieldname: string; stream: NodeJS.ReadableStream }, cb: (err: Error | null, info?: { buffer: Buffer; size: number }) => void): void {
    const chunks: Buffer[] = []
    let size = 0
    let done = false
    const finish = (err: Error | null, info?: { buffer: Buffer; size: number }) => {
      if (done) return
      done = true
      chunks.length = 0
      cb(err, info)
    }
    file.stream.on('data', (chunk: Buffer) => {
      if (done) return
      size += chunk.length
      if (size > PAPER_SOURCE_MAX_BYTES) {
        finish(new SourcePartTooLarge(file.fieldname === 'scheme' ? 'scheme' : 'paper'))
        return
      }
      chunks.push(chunk)
    })
    file.stream.on('error', (e: Error) => finish(e))
    file.stream.on('end', () => {
      if (done) return
      const buffer = Buffer.concat(chunks)
      done = true
      cb(null, { buffer, size: buffer.length })
    })
  },
  _removeFile(_req: unknown, file: { buffer?: Buffer }, cb: (err: Error | null) => void): void {
    delete file.buffer
    cb(null)
  },
}

/**
 * S3-T06 (API-BIJAK-14): reads the multipart body of the source upload (`paper` required, `scheme` optional, 30 MB each, one text field `declaration`).
 * A JSON body (`{ apply: true }`) passes through untouched. Multer errors become the contract's 422 texts.
 */
@Injectable()
export class PaperSourceUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor = new (FileFieldsInterceptor(
    [
      { name: 'paper', maxCount: 1 },
      { name: 'scheme', maxCount: 1 },
    ],
    // The 30 MB rule fires while the part streams (`sourcePartStorage`, with the field name). Multer's own cap sits one byte above the limit as a backstop.
    { storage: sourcePartStorage, limits: { fileSize: PAPER_SOURCE_MAX_BYTES + 1, files: 2, fields: 2, fieldSize: 64, parts: 4 } },
  ))({})

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      const tooLarge = BIJAK_BUILDER_MESSAGES.sourcePdfTooLarge
      if (err instanceof SourcePartTooLarge) throw ApiError.of('VALIDATION_ERROR', { message: tooLarge, fields: { [err.field]: tooLarge } })
      if (err instanceof PayloadTooLargeException) throw ApiError.of('VALIDATION_ERROR', { message: tooLarge, fields: { paper: tooLarge } })
      if (err instanceof BadRequestException) {
        throw ApiError.of('VALIDATION_ERROR', { message: BIJAK_BUILDER_MESSAGES.sourcePdfInvalid, fields: { paper: BIJAK_BUILDER_MESSAGES.sourcePdfInvalid } })
      }
      throw err
    }
  }
}

/** Runs BEFORE the multipart body is read (as `IntakeUploadGuard` does): an unknown, non-Subjektif, Terbit or already sourced paper costs no buffer. JSON apply passes. */
@Injectable()
export class PaperSourceGate implements CanActivate {
  constructor(@Inject(PaperSourceService) private readonly source: PaperSourceService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>()
    if (req.is('multipart/form-data')) await this.source.assertUploadable(String(req.params.id))
    return true
  }
}

/**
 * Paper builder (BE-39), Admin Pusat only. Bodies and the list query are read raw and parsed in the
 * service, so that a missing paper is 404 before a bad body is 422 (the mock's order). CSRF on every
 * mutation is enforced by the session guard. `POST preview` is declared before the `:id` routes.
 */
@Controller('admin/papers')
@Roles('admin')
@UseGuards(RateLimitGuard)
export class BuilderController {
  constructor(
    @Inject(BuilderService) private readonly builder: BuilderService,
    @Inject(PaperSourceService) private readonly source: PaperSourceService,
  ) {}

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

  /**
   * API-BIJAK-14 (S3-T06). Multipart (`paper`, optional `scheme`, `declaration`) creates the intake batch of THIS Kertas Subjektif: 202 `{batchId}`.
   * JSON `{ apply: true }` appends the accepted items of that batch as placements of the paper: 201 `{placements}`.
   */
  @Post(':id/source')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  @UseGuards(PaperSourceGate)
  @UseInterceptors(PaperSourceUploadInterceptor)
  async paperSource(
    @Req() req: Request & RequestWithAuth,
    @Actor() actor: AuditActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFiles() files: { paper?: SourceParts['paper'][]; scheme?: SourceParts['scheme'][] } | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.is('multipart/form-data')) {
      const auth = req[AUTH_CONTEXT_KEY]
      if (!auth) throw ApiError.of('UNAUTHORIZED')
      const parts: SourceParts = { ...(files?.paper?.[0] ? { paper: files.paper[0] } : {}), ...(files?.scheme?.[0] ? { scheme: files.scheme[0] } : {}) }
      const declaration = (body as { declaration?: unknown } | undefined)?.declaration
      const who = { ip: req.ip ?? req.socket.remoteAddress ?? null, requestId: requestIdOf(req) ?? null }
      const out = await this.source.upload(auth, actor, id, parts, typeof declaration === 'string' ? declaration : undefined, who)
      res.status(202)
      return ok(out)
    }
    res.status(201)
    return ok(await this.source.apply(actor, id, body))
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

  /** R1-T48 "Tambah bahagian". */
  @Post(':id/sections')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async addSection(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.builder.addSection(actor, id, body))
  }

  /** R1-T48 "Tambah soalan": creates a blank Draf question in the paper and places it in an admin-added Bahagian. */
  @Post(':id/sections/:sid/questions')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async createQuestion(@Actor() actor: AuditActor, @Param('id') id: string, @Param('sid') sid: string, @Body() body: unknown) {
    return ok(await this.builder.createQuestion(actor, id, sid, body))
  }

  /** R1-T48 "Padam soalan": removes a question added through "Tambah soalan". */
  @Delete(':id/questions/:questionId')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async deleteAddedQuestion(@Actor() actor: AuditActor, @Param('id') id: string, @Param('questionId') questionId: string) {
    return ok(await this.builder.deleteAddedQuestion(actor, id, questionId))
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
