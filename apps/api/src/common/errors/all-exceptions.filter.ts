import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common'
import { type ErrorBody, ERROR_STATUS, type ErrorCode } from '@pp/contract'
import type { Request, Response } from 'express'

import { requestIdOf } from '../request/request-id'
import { ApiError, DEFAULT_ERROR_MESSAGES } from './api-error'

const CODE_BY_STATUS: Readonly<Record<number, ErrorCode>> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
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
      // A malformed body (400 from the body parser or BadRequestException) is a validation error.
      const mapped = raw === 400 ? 422 : raw
      const code = mapped ? CODE_BY_STATUS[mapped] : undefined
      if (code) {
        status = ERROR_STATUS[code]
        payload = { code, message: DEFAULT_ERROR_MESSAGES[code] }
      } else {
        status = 500
        payload = { code: 'SERVER_ERROR', message: DEFAULT_ERROR_MESSAGES.SERVER_ERROR }
        // The stack goes to the log only, never to the client.
        this.logger.error(
          exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
        )
      }
    }

    if (payload.retryAfter !== undefined) res.setHeader('Retry-After', String(payload.retryAfter))
    res.status(status).json({ error: { ...payload, requestId } } satisfies ErrorBody)
  }
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
