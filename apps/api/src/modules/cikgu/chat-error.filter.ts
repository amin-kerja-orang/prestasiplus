import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common'
import { CIKGU_AI_UNAVAILABLE_CODE, CIKGU_AI_UNAVAILABLE_MESSAGE, CIKGU_RATE_LIMITED_MESSAGE } from '@pp/contract'
import type { Response } from 'express'

import { AllExceptionsFilter } from '../../common/errors/all-exceptions.filter'
import { ApiError } from '../../common/errors/api-error'
import { CikguAiUnavailableError } from './ai.port'

/**
 * Route-level filter of `POST /cikgu/send`, the one RAW (un-enveloped) route of the API. The live client reads the body
 * of every status untouched, so on this route only:
 *  - a guest (no session) is 401 with the body exactly `{}`;
 *  - the per-minute throttle is 429 `{error: <BM text>, code: "RATE_LIMITED", retryAfter}` plus `Retry-After`
 *    (the daily quota is a different 429 body, written by the controller);
 *  - an unavailable AI provider is 503 `{error: <BM text>, code: "AI_UNAVAILABLE"}`;
 * Everything else (CSRF_INVALID 403, 403 FORBIDDEN, 413, 500, and a malformed JSON body, which the body parser rejects before any route filter runs: 422 VALIDATION_ERROR) is rendered by the standard error envelope.
 * It is a route-level filter so the shared `AllExceptionsFilter` stays untouched (BE-03 common code).
 */
@Catch()
export class ChatRawErrorFilter implements ExceptionFilter {
  private readonly standard = new AllExceptionsFilter()

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>()
    if (exception instanceof CikguAiUnavailableError) {
      res.status(503).json({ error: CIKGU_AI_UNAVAILABLE_MESSAGE, code: CIKGU_AI_UNAVAILABLE_CODE })
      return
    }
    if (exception instanceof ApiError) {
      if (exception.code === 'UNAUTHORIZED') {
        res.status(401).json({})
        return
      }
      if (exception.code === 'RATE_LIMITED') {
        const retryAfter = exception.retryAfter ?? 1
        res.setHeader('Retry-After', String(retryAfter))
        res.status(429).json({ error: CIKGU_RATE_LIMITED_MESSAGE, code: 'RATE_LIMITED', retryAfter })
        return
      }
    }
    this.standard.catch(exception, host)
  }
}
