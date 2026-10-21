import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common'
import type { Response } from 'express'
import type { Observable } from 'rxjs'

/** Sets `Pragma: no-cache` before the handler runs (credential and export routes), so errors carry it too. Pair with `NoStoreInterceptor`. */
@Injectable()
export class PragmaNoCacheInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    ctx.switchToHttp().getResponse<Response>().setHeader('Pragma', 'no-cache')
    return next.handle()
  }
}
