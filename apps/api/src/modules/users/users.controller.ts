import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  BulkDeleteRequestSchema,
  BulkImportMultipartSchema,
  BulkImportRequestSchema,
  CreateUserRequestSchema,
  IMPORT_MAX_CHARS,
  UpdateUserRequestSchema,
  USER_MESSAGES,
  UserListQuerySchema,
  type CreateUserRequest,
  type UpdateUserRequest,
} from '@pp/contract'
import type { Request } from 'express'
import { catchError, throwError, type Observable } from 'rxjs'

import { Roles } from '../../common/guards/decorators'
import { ApiError } from '../../common/errors/api-error'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { CurrentCaller, type Caller } from './caller'
import { UserImportService } from './import'
import { NoStoreInterceptor } from './no-store.interceptor'
import { RateLimit, UsersRateLimitGuard } from './rate-limit'
import { UsersService, type UserListQueryInput } from './users.service'
import type { BulkDeleteBody } from './users.types'

/** A multer size limit (413 from the upload parser) becomes the contract `PAYLOAD_TOO_LARGE` error. */
@Injectable()
export class PayloadTooLargeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) =>
        err instanceof HttpException && err.getStatus() === 413
          ? throwError(() => new ApiError({ code: 'PAYLOAD_TOO_LARGE', status: 413, message: USER_MESSAGES.importTooLarge }))
          : throwError(() => err),
      ),
    )
  }
}

interface UploadedText {
  buffer: Buffer
}

/**
 * Admin user management (BE-05 part A). Admin may call every route; school_admin the same routes
 * inside its own school (the repository applies the scope). Everything here is `no-store`.
 * `POST /admin/users/:id/impersonate` does not exist (UD-2): it falls through to 404.
 */
@Controller('admin/users')
@Roles('admin', 'school_admin')
@UseGuards(UsersRateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly imports: UserImportService,
  ) {}

  @Get()
  @RateLimit('read')
  async list(
    @CurrentCaller() caller: Caller,
    @Query(new ZodValidationPipe(UserListQuerySchema)) query: UserListQueryInput,
  ) {
    return this.users.list(caller, query)
  }

  @Get('filters')
  @RateLimit('read')
  async filters(@CurrentCaller() caller: Caller) {
    return { data: await this.users.filters(caller) }
  }

  @Get(':id')
  @RateLimit('read')
  async detail(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return { data: await this.users.detail(caller, id) }
  }

  @Post()
  @RateLimit('write')
  async create(
    @CurrentCaller() caller: Caller,
    @Body(new ZodValidationPipe(CreateUserRequestSchema)) body: CreateUserRequest,
  ) {
    return this.users.create(caller, body)
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @RateLimit('write')
  async bulkDelete(
    @CurrentCaller() caller: Caller,
    @Body(new ZodValidationPipe(BulkDeleteRequestSchema)) body: BulkDeleteBody,
  ) {
    return this.users.bulkRemove(caller, body.ids)
  }

  /** JSON, or multipart/form-data with the file in `csvFile` (over 1 MB is 413). */
  @Post('bulk-import')
  @HttpCode(200)
  @RateLimit('import')
  @UseInterceptors(
    PayloadTooLargeInterceptor,
    FileInterceptor('csvFile', { limits: { fileSize: IMPORT_MAX_CHARS, files: 1, fieldSize: IMPORT_MAX_CHARS, fields: 10 } }),
  )
  async bulkImport(
    @CurrentCaller() caller: Caller,
    @Req() req: Request,
    @Body() raw: unknown,
    @UploadedFile() file?: UploadedText,
  ) {
    const body = req.is('multipart/form-data')
      ? new ZodValidationPipe(BulkImportMultipartSchema).transform({
          ...(typeof raw === 'object' && raw !== null ? raw : {}),
          ...(file ? { csvFile: file.buffer.toString('utf8') } : {}),
        })
      : new ZodValidationPipe(BulkImportRequestSchema).transform(raw)
    const { result, status } = await this.imports.run(caller, body)
    return { data: result, status }
  }

  @Put(':id')
  @RateLimit('write')
  async update(
    @CurrentCaller() caller: Caller,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserRequestSchema)) body: UpdateUserRequest,
  ) {
    return this.users.update(caller, id, body)
  }

  @Delete(':id')
  @RateLimit('write')
  async remove(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return this.users.remove(caller, id)
  }

  @Post(':id/toggle-active')
  @HttpCode(200)
  @RateLimit('write')
  async toggle(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return this.users.toggleActive(caller, id)
  }
}

