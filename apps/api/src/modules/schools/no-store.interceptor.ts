import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common'
import type { Response } from 'express'
import type { Observable } from 'rxjs'

/**
 * Sets `Cache-Control: no-store` before the handler runs, so success and error responses of the
 * admin school routes (join codes) are never cached (D57b, BE-NFR-40).
 */
@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    ctx.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store')
    return next.handle()
  }
}
