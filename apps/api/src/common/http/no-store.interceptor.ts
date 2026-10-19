import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common'
import type { Response } from 'express'
import type { Observable } from 'rxjs'

/**
 * Sets `Cache-Control: no-store` before the handler runs, so the success response and any error the
 * handler or its pipes throw (a 422, a 404) are never cached (D57b, BE-NFR-40). Interceptors run
 * AFTER the global guards, so a 401/403/429 raised by a guard does not carry the header.
 */
@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    ctx.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store')
    return next.handle()
  }
}
