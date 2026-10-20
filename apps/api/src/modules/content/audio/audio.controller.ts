import {
  BadRequestException,
  type CallHandler,
  Body,
  Controller,
  type ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  type NestInterceptor,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { AnyFilesInterceptor } from '@nestjs/platform-express'
import { AUDIO_TEMPLATE_CONTENT_TYPES, AUDIO_TEMPLATE_FORMATS, CONTENT_MESSAGES, contentFileRefused } from '@pp/contract'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { AUDIO_LIMITS, AUDIO_MULTER_LIMITS, TEMPLATE_PLACEHOLDER } from './audio.constants'
import { AudioReadGate } from './audio-read-gate'
import { AudioService, type Actor, type AdminListQuery } from './audio.service'
import type { UploadedPart } from './audio-form'

type Req = Request & RequestWithAuth

function actorOf(req: Req): Actor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { scope } = auth.active
  return {
    userId: auth.userId,
    role: auth.active.role,
    sessionRowId: auth.sessionRowId,
    scopeLevel: scope.level,
    schoolId: scope.schoolId ?? null,
    isTest: auth.mode !== null,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
  }
}

/** A query value that is one plain string (a repeated key or a nested object is ignored). */
const one = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/**
 * Reads the multipart body of the set create with hard limits (4 files, 20 MB each, 400 text parts), so an
 * oversize body is cut off while reading. Multer errors become the contract's 422 instead of a 400/413.
 * A JSON body passes through untouched.
 */
@Injectable()
export class AudioUploadInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor

  constructor() {
    const Interceptor = AnyFilesInterceptor({ limits: { ...AUDIO_MULTER_LIMITS } })
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { sections: contentFileRefused('audio') }, message: contentFileRefused('audio') })
      }
      if (err instanceof BadRequestException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { form: CONTENT_MESSAGES.fieldInvalid }, message: CONTENT_MESSAGES.fieldInvalid })
      }
      throw err
    }
  }
}

/** Parses `Range: bytes=a-b` (one range) against a body of `size` bytes; null = whole body (also for an invalid spec, RFC 7233), 'bad' = unsatisfiable. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'bad' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return null // multi-range or another unit: serve the whole body
  const [, a = '', b = ''] = m
  if (a === '' && b === '') return null
  let start: number
  let end: number
  if (a === '') {
    const suffix = Number(b)
    if (suffix === 0) return 'bad'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(a)
    end = b === '' ? size - 1 : Math.min(Number(b), size - 1)
  }
  if (!Number.isSafeInteger(start)) return null
  // RFC 7233: an end before the start is not a valid range spec and is ignored (whole body, 200); a start past the end is unsatisfiable.
  if (b !== '' && a !== '' && Number(b) < start) return null
  if (start >= size) return 'bad'
  return { start, end }
}

/**
 * Audio KBAT student play (matrix row 27, D53(a)). Any signed-in user; only approved sets are visible. Every
 * JSON answer is `no-store`. The player data never carries the answer key; marking happens on the server.
 */
@Controller('audio-kbat-sets')
@UseGuards(RateLimitGuard)
export class AudioKbatController {
  constructor(
    private readonly audio: AudioService,
    private readonly gate: AudioReadGate,
  ) {}

  @Get()
  @UseInterceptors(NoStoreInterceptor)
  @RateLimit(AUDIO_LIMITS.read)
  async list(@Query() query: Record<string, unknown>) {
    return this.audio.listApproved({ educationLevelId: one(query.educationLevelId), subjectId: one(query.subjectId) })
  }

  @Get(':id')
  @UseInterceptors(NoStoreInterceptor)
  @RateLimit(AUDIO_LIMITS.read)
  async detail(@Param('id') id: string) {
    return ok(await this.audio.play(id))
  }

  /** The section audio, behind the session (BE-NFR-29): not a public path. Supports one `Range` for seeking. */
  @Get(':id/sections/:no/audio')
  @RateLimit(AUDIO_LIMITS.file)
  async sectionAudio(@Param('id') id: string, @Param('no') no: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    // At most a few whole-file reads at once (429 when full); the slot is held until the response is done.
    const release = this.gate.acquire()
    res.once('close', release)
    let file: Awaited<ReturnType<AudioService['audio']>>
    try {
      file = await this.audio.audio(id, no)
    } catch (err) {
      release()
      throw err
    }
    const size = file.bytes.length
    const range = parseRange(req.headers.range, size)
    const headers = {
      'Content-Type': file.contentType,
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-site',
    }
    if (range === 'bad') {
      res.status(416).set({ ...headers, 'Content-Range': `bytes */${String(size)}` }).end()
      return
    }
    if (range) {
      const body = file.bytes.subarray(range.start, range.end + 1)
      res
        .status(206)
        .set({ ...headers, 'Content-Range': `bytes ${String(range.start)}-${String(range.end)}/${String(size)}`, 'Content-Length': String(body.length) })
        .end(body)
      return
    }
    res.status(200).set({ ...headers, 'Content-Length': String(size) }).end(file.bytes)
  }

  @Post(':id/attempts')
  @HttpCode(201)
  @UseInterceptors(NoStoreInterceptor)
  @RateLimit(AUDIO_LIMITS.attempt)
  async attempt(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.audio.attempt(actorOf(req), id, body))
  }
}

/** Audio KBAT admin tools (matrix #21 to #23): admin only. */
@Controller('admin/audio-kbat-sets')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@Roles('admin')
export class AudioKbatAdminController {
  constructor(private readonly audio: AudioService) {}

  @Get()
  @RateLimit(AUDIO_LIMITS.read)
  async list(@Query() query: Record<string, unknown>) {
    const q: AdminListQuery = {
      educationLevelId: one(query.educationLevelId),
      subjectId: one(query.subjectId),
      status: one(query.status),
      search: one(query.search),
      page: one(query.page),
      pageSize: one(query.pageSize),
    }
    return this.audio.adminList(q)
  }

  /** Matches before any `:id` path. A placeholder file (OQ-M09-03), as the mock. */
  @Get('template')
  @RateLimit(AUDIO_LIMITS.read)
  template(@Query('format') format: unknown, @Res() res: Response): void {
    const wanted = format === undefined ? 'xlsx' : typeof format === 'string' ? format.trim().toLowerCase() : ''
    const known = (AUDIO_TEMPLATE_FORMATS as readonly string[]).includes(wanted)
    if (!known) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { format: CONTENT_MESSAGES.fieldInvalid }, message: CONTENT_MESSAGES.fieldInvalid })
    }
    const ext = wanted as (typeof AUDIO_TEMPLATE_FORMATS)[number]
    const body = Buffer.from(TEMPLATE_PLACEHOLDER, 'utf8')
    res
      .status(200)
      .set({
        'Content-Type': AUDIO_TEMPLATE_CONTENT_TYPES[ext],
        'Content-Disposition': `attachment; filename="template-audio-kbat.${ext}"`,
        'Content-Length': String(body.length),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .end(body)
  }

  @Post()
  @HttpCode(201)
  @RateLimit(AUDIO_LIMITS.adminWrite)
  @UseInterceptors(AudioUploadInterceptor)
  async create(@Req() req: Req, @Body() body: unknown, @UploadedFiles() files: UploadedPart[] | undefined) {
    return this.audio.create(actorOf(req), body, files ?? [])
  }
}
