import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  HttpCode,
  Controller,
  Get,
  Inject,
  Injectable,
  type NestInterceptor,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  DIAGRAM_AUDIT_IMAGE_MIME_TYPES,
  DIAGRAM_AUDIT_KINDS,
  DIAGRAM_AUDIT_MESSAGES,
} from '@pp/contract'
import type { Request } from 'express'
import type { Observable } from 'rxjs'

import { ApiError } from '../../../../common/errors/api-error'
import { NoStoreInterceptor } from '../../../../common/http'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { isIdString } from '../../../../db/ids'
import { Actor, AdminOnly, actorOf, type WorkflowActor } from '../actor'
import { QUESTION_WORKFLOW_IMAGE_MAX_BYTES, WORKFLOW_ADMIN_WRITE_LIMIT } from '../quality/limits'
import { type DiagramAuditFilters, DiagramAuditService, type DiagramKind } from './diagram-audit.service'

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

function parseKind(value: string): DiagramKind {
  if ((DIAGRAM_AUDIT_KINDS as readonly string[]).includes(value)) return value as DiagramKind
  throw ApiError.of('NOT_FOUND')
}

function parseId(value: string): string {
  if (isIdString(value)) return value
  throw ApiError.of('NOT_FOUND')
}

const page = (v: unknown): number | undefined => {
  if (typeof v !== 'string' || !/^[1-9]\d{0,8}$/.test(v)) return undefined
  return Number(v)
}

/** A filter that is present but not an id matches nothing (the empty id never exists). */
const filterId = (v: unknown): string | undefined => {
  if (typeof v !== 'string' || v === '') return undefined
  return isIdString(v) ? v : ''
}

/** Multer limit of 2 MB; its errors become the contract's 422 on `fields.image`. */
@Injectable()
export class DiagramImageInterceptor implements NestInterceptor {
  private readonly inner: NestInterceptor
  constructor() {
    const Interceptor = FileInterceptor('image', {
      limits: { files: 1, fields: 4, fieldSize: 1024, parts: 6, headerPairs: 50, fileSize: QUESTION_WORKFLOW_IMAGE_MAX_BYTES },
    })
    this.inner = new Interceptor({})
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.inner.intercept(ctx, next)
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { image: DIAGRAM_AUDIT_MESSAGES.fileType } })
      }
      if (err instanceof BadRequestException) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { image: DIAGRAM_AUDIT_MESSAGES.fileRequired } })
      }
      throw err
    }
  }
}

interface UploadedImage {
  buffer?: Buffer
  mimetype?: string
  originalname?: string
  size?: number
}

/** The MIME / extension / size check of the mock (#24). Returns the bytes, or throws the 422. */
function checkedBytes(file: UploadedImage | undefined): Buffer {
  const required = ApiError.of('VALIDATION_ERROR', { fields: { image: DIAGRAM_AUDIT_MESSAGES.fileRequired } })
  const wrongType = ApiError.of('VALIDATION_ERROR', { fields: { image: DIAGRAM_AUDIT_MESSAGES.fileType } })
  if (!file?.buffer || file.buffer.length === 0) throw required
  const name = file.originalname ?? ''
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  const mime = file.mimetype ?? ''
  if (mime !== '' && !mime.startsWith('image/')) throw required
  if (mime === '' && !EXTENSIONS.includes(ext)) throw required
  if (mime !== '' && !(DIAGRAM_AUDIT_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) throw wrongType
  if (!EXTENSIONS.includes(ext) || file.buffer.length > QUESTION_WORKFLOW_IMAGE_MAX_BYTES) throw wrongType
  return file.buffer
}

/** Diagram audit, S11. Admin Pusat only. */
@AdminOnly()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('diagram-audit')
export class DiagramAuditController {
  constructor(@Inject(DiagramAuditService) private readonly audit: DiagramAuditService) {}

  @Get()
  async list(@Query() query: Record<string, unknown>) {
    const filters: DiagramAuditFilters = {}
    const subjectId = filterId(query.subjectId)
    const schoolId = filterId(query.schoolId)
    if (subjectId !== undefined) filters.subjectId = subjectId
    if (schoolId !== undefined) filters.schoolId = schoolId
    const mcqPage = page(query.mcqPage)
    const strPage = page(query.strPage)
    if (mcqPage !== undefined) filters.mcqPage = mcqPage
    if (strPage !== undefined) filters.strPage = strPage
    return this.audit.list(filters)
  }

  @Post(':kind/:id/image')
  @HttpCode(200)
  @RateLimit(WORKFLOW_ADMIN_WRITE_LIMIT)
  @UseInterceptors(DiagramImageInterceptor)
  async image(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @Req() req: Request & RequestWithAuth,
  ) {
    const k = parseKind(kind)
    const qid = parseId(id)
    const auth = req[AUTH_CONTEXT_KEY]
    if (!auth) throw ApiError.of('UNAUTHORIZED')
    // 404 (unknown question) is decided before the body is judged, like the mock.
    await this.audit.assertExists(k, qid)
    const bytes = checkedBytes(file)
    return this.audit.uploadImage(auth, k, qid, bytes, (({ ip, requestId }) => ({ ip, requestId }))(actorOf(req)))
  }

  @Post(':kind/:id/dismiss')
  @HttpCode(200)
  @RateLimit(WORKFLOW_ADMIN_WRITE_LIMIT)
  dismiss(@Actor() actor: WorkflowActor, @Param('kind') kind: string, @Param('id') id: string) {
    return this.audit.dismiss(actor.userId, parseKind(kind), parseId(id))
  }
}
