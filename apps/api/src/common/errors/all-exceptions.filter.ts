import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common'
import { type ErrorBody, type ErrorCode } from '@pp/contract'
import type { Request, Response } from 'express'

import { DEFAULT_JSON_LIMIT_BYTES } from '../http/body-limits'
import { requestIdOf } from '../request/request-id'
import { ApiError, DEFAULT_ERROR_MESSAGES } from './api-error'

const CODE_BY_STATUS: Readonly<Record<number, ErrorCode>> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'TIMEOUT',
}

/** Renders every error as `{ error: { code, message, fields?, details?, retryAfter?, requestId } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const res = http.getResponse<Response>()
    const req = http.getRequest<Request>()
    const requestId = requestIdOf(req)

    let status: number
    let payload: ErrorBody['error']

    if (exception instanceof ApiError) {
      status = exception.getStatus()
      payload = {
        code: exception.code,
        message: exception.message,
        ...(exception.fields ? { fields: exception.fields } : {}),
        ...(exception.details ? { details: exception.details } : {}),
        ...(exception.retryAfter !== undefined ? { retryAfter: exception.retryAfter } : {}),
      }
    } else {
      const raw = statusOf(exception)
      // A malformed body (400 from the body parser or BadRequestException) keeps the 422 status (ERR-REQ-02, X10.11) with code BAD_REQUEST.
      const mapped = raw === 400 ? 422 : raw
      const code = raw === 400 ? 'BAD_REQUEST' : mapped ? CODE_BY_STATUS[mapped] : undefined
      if (mapped === 413) {
        // A body over the parser limit (the default JSON limit; the import and content routes have larger ones) or an upload over its size limit.
        status = 413
        payload = { code: 'PAYLOAD_TOO_LARGE', message: payloadTooLargeMessage(exception) }
      } else if (raw === 400) {
        status = 422
        payload = { code: 'BAD_REQUEST', message: DEFAULT_ERROR_MESSAGES.BAD_REQUEST }
      } else if (code && mapped) {
        status = mapped
        payload = { code, message: DEFAULT_ERROR_MESSAGES[code] }
      } else if (mapped !== undefined && mapped >= 400 && mapped < 500) {
        // An unmapped 4xx (405, 408, 410 ...) keeps its status; no stack in the log.
        status = mapped
        payload = { code: 'BAD_REQUEST', message: DEFAULT_ERROR_MESSAGES.BAD_REQUEST }
      } else {
        // A non-HTTP exception, or a 5xx without its own code: the stack goes to the log only, never to the client.
        status = mapped !== undefined && mapped >= 500 ? mapped : 500
        payload = { code: 'SERVER_ERROR', message: DEFAULT_ERROR_MESSAGES.SERVER_ERROR }
      }
    }

    this.log(status, payload.code, exception, req, requestId)
    if (payload.retryAfter !== undefined) res.setHeader('Retry-After', String(payload.retryAfter))
    res.status(status).json({ error: { ...payload, requestId } } satisfies ErrorBody)
  }

  /** Exactly one line per error response (X10.3.9, AC-ERR-12): 5xx error with stack, 401/403/429 warn, other 4xx info; a 4xx never carries a stack. */
  private log(status: number, code: string, exception: unknown, req: Request, requestId: string | undefined): void {
    const line = `${req.method} ${req.originalUrl ?? req.url} -> ${String(status)} ${code} requestId=${requestId ?? '-'}`
    if (status >= 500) this.logger.error(`${line}\n${stackOf(exception)}`)
    else if (status === 401 || status === 403 || status === 429) this.logger.warn(line)
    else this.logger.log(line)
  }
}

function stackOf(exception: unknown): string {
  return exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)
}

/**
 * The 413 text with `{n}` = the limit that applied (body-parser errors carry `limit` in bytes), rounded up to whole MB, minimum 1.
 * A 413 without `limit` (e.g. a multer PayloadTooLargeException) uses the app's configured default JSON body limit (DEFAULT_JSON_LIMIT_BYTES, the same source configure-app uses); upload modules that
 * know their own file limit throw an ApiError with their own text instead.
 */
function payloadTooLargeMessage(exception: unknown): string {
  const limit = (exception as { limit?: unknown } | null)?.limit
  const bytes = typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_JSON_LIMIT_BYTES
  const mb = Math.max(1, Math.ceil(bytes / (1024 * 1024)))
  return DEFAULT_ERROR_MESSAGES.PAYLOAD_TOO_LARGE.replace('{n}', String(mb))
}

function statusOf(exception: unknown): number | undefined {
  if (exception instanceof HttpException) return exception.getStatus()
  if (typeof exception === 'object' && exception !== null) {
    const e = exception as { status?: unknown; statusCode?: unknown }
    const s = e.status ?? e.statusCode
    if (typeof s === 'number' && s >= 400 && s < 500) return s
  }
  return undefined
}
